/* global hexo */
'use strict';

// The sidebar TOC numbers headings (toc.number). Headings the author has
// already numbered — "1. …", "一、…", "第 2 讲…" — would read "2.1. 1. …",
// so for those the automatic number is left out and the author's own stays.
const OWN_NUMBER = /^\s*(?:\d+(?:\.\d+)*[.、)）]|[一二三四五六七八九十百]+[、.]|第\s*[\d一二三四五六七八九十百]+\s*[讲章节部篇步课题])/;

const toc = hexo.extend.helper.get('toc');

hexo.extend.helper.register('toc', function(...args) {
  const html = toc.apply(this, args);
  return html.replace(
    /<span class="nav-number">[^<]*<\/span>\s*(<span class="nav-text">)([^<]*)/g,
    (match, open, text) => (OWN_NUMBER.test(text) ? open + text : match)
  );
});
