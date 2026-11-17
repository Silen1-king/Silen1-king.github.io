/* global hexo */
'use strict';

// The sidebar TOC numbers headings (toc.number). When the author numbers a
// level themselves — "1. …", "一、…", "第 2 讲…", "第一题…" — the automatic
// numbers would read "2.1. 1. …", so that whole level, and everything under
// it, goes without automatic numbers. One level is always one style: either
// all automatic numbers or none.
const OWN_NUMBER = /^\s*(?:\d+(?:\.\d+)*[.、)）]|[一二三四五六七八九十百]+[、.]|第\s*[\d一二三四五六七八九十百]+\s*[讲章节部篇步课题道关])/;
const TOKEN = /<ol\b[^>]*>|<\/ol>|<li\b[^>]*>|<span class="nav-number">[^<]*<\/span>\s*(?=<span class="nav-text">([^<]*))/g;

function numberLevels(html) {
  const groups = [];
  const stack = [];
  let match;
  while ((match = TOKEN.exec(html))) {
    const token = match[0];
    const group = stack[stack.length - 1];
    if (token.startsWith('<ol')) {
      const next = { parent: group ? group.items[group.items.length - 1] : null, items: [] };
      groups.push(next);
      stack.push(next);
    } else if (token === '</ol>') {
      stack.pop();
    } else if (token.startsWith('<li')) {
      if (group) group.items.push({ group, spans: [], own: false });
    } else if (group && group.items.length) {
      const item = group.items[group.items.length - 1];
      item.spans.push([match.index, match.index + token.length]);
      if (OWN_NUMBER.test(match[1])) item.own = true;
    }
  }

  // Parents come before their children in `groups`.
  const cut = [];
  for (const group of groups) {
    group.bare = Boolean(group.parent && group.parent.group.bare) || group.items.some(item => item.own);
    if (group.bare) group.items.forEach(item => cut.push(...item.spans));
  }
  cut.sort((a, b) => b[0] - a[0]);
  for (const [start, end] of cut) html = html.slice(0, start) + html.slice(end);
  return html;
}

const toc = hexo.extend.helper.get('toc');

hexo.extend.helper.register('toc', function(...args) {
  return numberLevels(toc.apply(this, args));
});
