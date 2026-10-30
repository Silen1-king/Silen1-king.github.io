'use strict';

/**
 * Content Security Policy for every page, as a <meta> tag: GitHub Pages
 * cannot send response headers. Left off only inside Google's translation
 * proxy (see the gate at the end).
 *
 * Scripts may only come from this site and giscus (comments). The few inline
 * scripts (the intro gate in head.njk, the uptime clock in footer.njk) are
 * allowed by their SHA-256, computed here from the final HTML, so editing one
 * needs nothing else. JSON blocks (NexT's config) are data, never run, and
 * need no hash. Inline styles stay allowed: the design uses style="--c:…".
 *
 * Adding a third-party script, iframe or API: add its origin below.
 * frame-ancestors, report-uri and sandbox are ignored in a <meta> CSP.
 */

const crypto = require('crypto');

const SOURCES = {
  'default-src': ["'self'"],
  'script-src': ["'self'", 'https://giscus.app'],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:'],
  'font-src': ["'self'"],
  'connect-src': ["'self'", 'https://events.vercount.one'],
  'frame-src': ['https://giscus.app'],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"]
};

const INLINE_SCRIPT = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi;

function inlineHashes(html) {
  const hashes = new Set();
  for (const [, attributes = '', body] of html.matchAll(INLINE_SCRIPT)) {
    if (/\ssrc\s*=/i.test(attributes)) continue;
    const type = /\stype\s*=\s*["']?([^"'\s>]+)/i.exec(attributes);
    if (type && !/^(text|application)\/(javascript|ecmascript)$|^module$/i.test(type[1])) continue;
    hashes.add(`'sha256-${crypto.createHash('sha256').update(body, 'utf8').digest('base64')}'`);
  }
  return [...hashes];
}

hexo.extend.filter.register('after_render:html', html => {
  if (!html.includes('<head>') || html.includes('http-equiv="Content-Security-Policy"')) return html;
  const policy = Object.entries(SOURCES).map(([directive, sources]) => {
    const list = directive === 'script-src' ? [...sources, ...inlineHashes(html)] : sources;
    return `${directive} ${list.join(' ')}`;
  }).concat('upgrade-insecure-requests').join('; ');

  // As early in <head> as possible: the policy covers only what follows it.
  // Written by a one-line script so it can stay off inside Google's web
  // translation (<host>.translate.goog, opened by signal-translate.js):
  // there the page runs on Google's origin and Google adds its own scripts,
  // which the policy would block, leaving the page untranslated and bare.
  // Everywhere else the policy is exactly as before.
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}">`;
  const gate = '<script>if(!/\\.translate\\.goog$/.test(location.hostname))'
    + `document.write(${JSON.stringify(meta).replace(/</g, '\\u003c')})</script>`
    + '<noscript>' + meta + '</noscript>'
    + '<meta name="referrer" content="strict-origin-when-cross-origin">';
  return html.replace(/<head>(\s*<meta charset="[^"]*">)?/i, match => match + gate);
});
