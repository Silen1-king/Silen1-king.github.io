'use strict';

/**
 * Each post's own share card. When source/images/og/ holds a card for the
 * post (drawn by tools/og-cards.js), its page points og:image and
 * twitter:image at it instead of the site card. The address carries a hash
 * of the image, so chat apps fetch it again after it is redrawn. Runs before
 * signal-seo.js, so the structured data names the same image.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const cardName = require('../tools/og-name');

hexo.extend.filter.register('after_render:html', html => {
  if (!html.includes('<meta property="og:type" content="article">')) return html;
  const url = /<meta property="og:url" content="([^"]+)">/.exec(html);
  if (!url) return html;

  const name = cardName(new URL(url[1]).pathname);
  const file = path.join(hexo.source_dir, 'images', 'og', name);
  if (!fs.existsSync(file)) return html;

  const version = crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex').slice(0, 8);
  const image = `${hexo.config.url.replace(/\/$/, '')}/images/og/${encodeURIComponent(name)}?v=${version}`;
  return html.replace(/(<meta (?:property="og:image"|name="twitter:image") content=")[^"]*(">)/g, `$1${image}$2`);
}, 9);
