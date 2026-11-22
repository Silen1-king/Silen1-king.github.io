'use strict';

/**
 * Math formulas, rendered at build time with KaTeX.
 *
 * Only posts with `math: true` in their front matter are touched, so a `$`
 * in a shell command elsewhere stays a dollar sign. In those posts:
 *
 *   $a^2 + b^2 = c^2$        inline formula
 *   $$ \sum_{i=1}^n i $$     display formula (may span several lines)
 *   \$                       a literal dollar sign
 *
 * Code blocks and `inline code` are left alone. Formulas are swapped for
 * plain tokens before Markdown runs (so marked never sees `_`, `*` or `\`
 * inside them, and Nunjucks never sees `{{`), then the tokens are replaced by
 * KaTeX's HTML after rendering. Readers get finished HTML: no script runs in
 * the browser. The stylesheet and fonts are served from /katex/ and linked
 * only on pages that actually contain a formula. Colours and spacing live in
 * source/_data/signal-article.styl.
 */

const fs = require('fs');
const path = require('path');
const katex = require('katex');

const DIST = path.dirname(require.resolve('katex/dist/katex.min.css'));
const CSS_ROUTE = 'katex/katex.min.css';
const ERROR_COLOR = '#ff7e9d';

const rendered = new Map();
let serial = 0;

function render(tex, displayMode, source) {
  const options = { displayMode, output: 'htmlAndMathml', strict: 'ignore', trust: false };
  try {
    return katex.renderToString(tex, { ...options, throwOnError: true });
  } catch (error) {
    hexo.log.warn(`[math] ${source}: ${error.message}`);
    return katex.renderToString(tex, { ...options, throwOnError: false, errorColor: ERROR_COLOR });
  }
}

// `code`, \$, $$display$$, $inline$ (no space just inside the dollars, and
// not followed by a digit, so "$5 and $6" stays text).
const INLINE = /(`+)[\s\S]*?\1|\\\$|\$\$([\s\S]+?)\$\$|\$(?=[^\s$])((?:\\.|[^$\\\n])*?(?:\\.|[^\s$\\]))\$(?!\d)/g;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;

function extract(text, source) {
  // Fenced code blocks pass through untouched.
  const lines = text.split('\n');
  const chunks = [];
  let buffer = [];
  let fence = null;
  for (const line of lines) {
    const match = FENCE.exec(line);
    if (fence) {
      buffer.push(line);
      if (match && match[1][0] === fence[0] && match[1].length >= fence.length && !line.trim().slice(match[1].length).length) {
        chunks.push({ code: true, text: buffer.join('\n') });
        buffer = [];
        fence = null;
      }
    } else if (match) {
      chunks.push({ code: false, text: buffer.join('\n') });
      buffer = [line];
      fence = match[1];
    } else {
      buffer.push(line);
    }
  }
  chunks.push({ code: Boolean(fence), text: buffer.join('\n') });

  const id = (++serial).toString(36);
  let count = 0;
  return chunks.map(chunk => chunk.code ? chunk.text : chunk.text.replace(INLINE, (whole, ticks, display, inline) => {
    if (ticks || whole === '\\$') return whole;
    const isDisplay = display !== undefined;
    const token = `SIGNALMATH${id}X${count++}${isDisplay ? 'D' : 'I'}Z`;
    rendered.set(token, render((isDisplay ? display : inline).trim(), isDisplay, source));
    return token;
  })).join('\n');
}

const TOKEN = /(<p>\s*)?(SIGNALMATH[0-9a-z]+X\d+([DI])Z)(\s*<\/p>)?/g;

function restore(html) {
  return html.replace(TOKEN, (whole, open, token, kind, close) => {
    const math = rendered.get(token);
    if (math === undefined) return whole;
    if (kind === 'D') {
      const block = `<div class="math-block">${math}</div>`;
      return open && close ? block : `${open || ''}${block}${close || ''}`;
    }
    return `${open || ''}${math}${close || ''}`;
  });
}

hexo.extend.filter.register('before_post_render', data => {
  if (!(data.math || data.mathjax) || typeof data.content !== 'string') return data;
  data.content = extract(data.content, data.source || data.title || 'post');
  return data;
}, 0); // before Hexo turns ``` fences into highlighted HTML

hexo.extend.filter.register('after_post_render', data => {
  if (typeof data.content === 'string' && data.content.includes('SIGNALMATH')) data.content = restore(data.content);
  if (typeof data.excerpt === 'string' && data.excerpt.includes('SIGNALMATH')) data.excerpt = restore(data.excerpt);
  return data;
}, 1);

// Stylesheet and woff2 fonts (every browser that runs this site reads woff2).
hexo.extend.generator.register('signal-math', () => {
  const css = fs.readFileSync(path.join(DIST, 'katex.min.css'), 'utf8')
    .replace(/,url\(fonts\/[^)]+\.(?:woff|ttf)\) format\("(?:woff|truetype)"\)/g, '');
  const fonts = fs.readdirSync(path.join(DIST, 'fonts'))
    .filter(name => name.endsWith('.woff2'))
    .map(name => ({ path: `katex/fonts/${name}`, data: () => fs.createReadStream(path.join(DIST, 'fonts', name)) }));
  return [{ path: CSS_ROUTE, data: css }, ...fonts];
});

hexo.extend.filter.register('after_render:html', html => {
  if (!html.includes('class="katex') || html.includes(CSS_ROUTE)) return html;
  return html.replace('</head>', `<link rel="stylesheet" href="${hexo.config.root}${CSS_ROUTE}">\n</head>`);
});
