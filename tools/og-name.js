'use strict';

// The share card file for a post, from its path (2026/10/29/heap-intro-1/).
// Shared by tools/og-cards.js, which draws the cards, and
// scripts/signal-og.js, which points the post's page at its card. Slugs that
// aren't plain ASCII are hashed so card addresses stay simple.

const crypto = require('node:crypto');

module.exports = function cardName(postPath) {
  const parts = decodeURIComponent(postPath).replace(/(^\/+|\/?index\.html$|\/+$)/g, '').split('/');
  const slug = parts.pop();
  const date = parts.join('-');
  const name = /^[\w.-]+$/.test(slug) ? slug : crypto.createHash('sha1').update(slug).digest('hex').slice(0, 10);
  return `${date ? date + '-' : ''}${name}.png`;
};
