'use strict';

/**
 * Self-hosted fonts.
 *
 * The three Latin families are plain files in source/fonts/ and declared in
 * source/_data/signal-base.styl. Body text uses the reader's system Chinese
 * font. Noto Serif SC is only used for headings, so after each build this
 * script collects the characters that headings actually use and asks Google
 * Fonts for just those glyphs (the css2 `text=` parameter). The result is
 * served from /fonts/ with the rest of the site, and /fonts/display.css
 * declares it.
 *
 * The fetch happens at build time (GitHub Actions), never in the reader's
 * browser. When it fails, for example on a local build without access to
 * Google, display.css loads the same subset from Google at runtime instead,
 * which is what the site did before.
 */

const crypto = require('node:crypto');

const FAMILY = 'Noto Serif SC';
const WEIGHTS = '700;900';
const CSS_ROUTE = 'fonts/display.css';
// Keeps each request URL well under Google's limit; 9 bytes per CJK char.
const CHUNK = 600;
const TIMEOUT_MS = 8000;
// A browser user agent, so Google answers with woff2.
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

// Everything that is set in Noto Serif SC: headings, plus the elements the
// SIGNAL styles give the display font without a heading tag.
const HEADING = /<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/gi;
const TITLED = /<(\w+)\b[^>]*class="[^"]*\b(?:post-title|signal-h2)\b[^"]*"[^>]*>([\s\S]*?)<\/\1>/gi;
// Always included: ASCII (titles mix in Latin words) and CJK punctuation.
const BASE_CHARS = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('')
  + '，。、：；！？「」『』（）《》〈〉【】—…·‘’“”';

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function textOf(html) {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (entity, code) => {
      if (code[0] === '#') {
        const point = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return Number.isFinite(point) ? String.fromCodePoint(point) : '';
      }
      return ENTITIES[code.toLowerCase()] ?? entity;
    });
}

function readRoute(path) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    hexo.route.get(path)
      .on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
      .on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      .on('error', reject);
  });
}

async function headingCharacters() {
  const chars = new Set(BASE_CHARS);
  const pages = hexo.route.list().filter(path => path.endsWith('.html'));
  for (const path of pages) {
    const html = await readRoute(path);
    for (const pattern of [HEADING, TITLED]) {
      for (const match of html.matchAll(pattern)) {
        for (const char of textOf(match[match.length - 1])) {
          if (char.trim() || char === ' ') chars.add(char);
        }
      }
    }
  }
  return [...chars].sort((a, b) => a.codePointAt(0) - b.codePointAt(0));
}

function googleCssUrl(text) {
  const family = encodeURIComponent(FAMILY).replace(/%20/g, '+');
  return `https://fonts.googleapis.com/css2?family=${family}:wght@${WEIGHTS}&display=swap&text=${encodeURIComponent(text)}`;
}

async function download(url, as) {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return as === 'text' ? response.text() : Buffer.from(await response.arrayBuffer());
}

// Fetches the subset and rewrites Google's CSS to point at local files.
// Returns the CSS and the font files to add as routes.
async function selfHostedSubset(chars) {
  const files = new Map();
  const sheets = [];
  for (let i = 0; i < chars.length; i += CHUNK) {
    const css = await download(googleCssUrl(chars.slice(i, i + CHUNK).join('')), 'text');
    const urls = [...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map(match => match[1]))];
    if (!urls.length) throw new Error('no font URL in the Google Fonts response');
    let local = css;
    for (const url of urls) {
      const font = await download(url);
      const hash = crypto.createHash('sha1').update(font).digest('hex').slice(0, 10);
      const route = `fonts/noto-serif-sc.${hash}.woff2`;
      files.set(route, font);
      local = local.split(url).join(hexo.extend.helper.get('url_for').call(hexo, route));
    }
    sheets.push(local.trim());
  }
  return { css: sheets.join('\n'), files };
}

let cached = null;
// After one failed fetch, `hexo server` stops retrying for the session so
// each regeneration does not wait for the timeout again.
let unreachable = false;

function runtimeFallback(chars) {
  const imports = [];
  for (let i = 0; i < chars.length; i += CHUNK) {
    imports.push(`@import url("${googleCssUrl(chars.slice(i, i + CHUNK).join(''))}");`);
  }
  hexo.route.set(CSS_ROUTE, imports.join('\n'));
}

hexo.extend.filter.register('after_generate', async function signalDisplayFont() {
  const chars = await headingCharacters();
  const key = chars.join('');

  if (!cached || cached.key !== key) {
    if (unreachable) {
      runtimeFallback(chars);
      return;
    }
    try {
      const { css, files } = await selfHostedSubset(chars);
      cached = { key, css, files };
      const size = [...files.values()].reduce((sum, file) => sum + file.length, 0);
      hexo.log.info(`Display font: ${chars.length} glyphs, ${Math.round(size / 1024)} KB self-hosted`);
    } catch (error) {
      hexo.log.warn(`Display font: could not fetch the subset (${error.message}); headings load it from Google Fonts at runtime.`);
      unreachable = true;
      runtimeFallback(chars);
      return;
    }
  }

  for (const [route, font] of cached.files) hexo.route.set(route, font);
  hexo.route.set(CSS_ROUTE, cached.css);
});
