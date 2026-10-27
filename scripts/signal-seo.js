'use strict';

/**
 * Structured data (schema.org BlogPosting, JSON-LD) for post pages, so search
 * engines can show the author and date. Built from the Open Graph tags NexT
 * already writes, so it always matches them. dateModified is left out: with
 * updated_option 'mtime' it would be the deploy time, not an edit.
 */

const META = /<meta (?:property|name)="([^"]+)" content="([^"]*)">/g;

const decode = value => value
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

hexo.extend.filter.register('after_render:html', html => {
  if (!html.includes('<meta property="og:type" content="article">')) return html;
  if (html.includes('application/ld+json')) return html;

  const meta = {};
  const tags = [];
  for (const [, key, value] of html.matchAll(META)) {
    if (key === 'article:tag') tags.push(decode(value));
    else if (!(key in meta)) meta[key] = decode(value);
  }
  const canonical = /<link rel="canonical" href="([^"]+)">/.exec(html);
  const { config } = hexo;

  const data = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: meta['og:title'],
    description: meta['og:description'],
    url: canonical ? canonical[1] : meta['og:url'],
    mainEntityOfPage: canonical ? canonical[1] : meta['og:url'],
    datePublished: meta['article:published_time'],
    image: meta['og:image'],
    inLanguage: config.language,
    keywords: tags.length ? tags.join(', ') : undefined,
    author: { '@type': 'Person', name: config.author, url: config.url + '/' },
    publisher: { '@type': 'Person', name: config.author, url: config.url + '/' }
  };

  // "<" is escaped so no value can close the script element.
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return html.replace('</head>', `<script type="application/ld+json">${json}</script></head>`);
});
