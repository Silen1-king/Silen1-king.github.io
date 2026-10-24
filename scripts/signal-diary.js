'use strict';

/**
 * 暗室 (/0x7f/): a diary kept off every list.
 *
 * Each entry is a standalone page at source/0x7f/<name>.md. Pages are not
 * posts, so entries never reach the home page, 札记, categories, tags, the
 * search index (search.field is `post`) or the Atom feed. This script keeps
 * them out of sitemap.xml and search engines too, and builds the /0x7f/
 * index. The only way in is the dim "EOF · 0x7f" line at the end of every
 * post (source/_data/post-body-end.njk).
 *
 * Do not list /0x7f/ in robots.txt: that file is public and would point
 * straight at it. Entries carry <meta name="robots" content="noindex">.
 */

const DIR = '0x7f/';
const BASE_ADDRESS = 0x7f000000;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const isEntry = page => typeof page.source === 'string'
  && page.source.startsWith(DIR)
  && page.source !== `${DIR}index.md`;

function entries(pages) {
  return pages.filter(isEntry).toArray()
    .sort((a, b) => b.date.valueOf() - a.date.valueOf());
}

// Hidden pages: no sitemap, no search engines, no comments, no TOC rail.
hexo.extend.filter.register('before_post_render', data => {
  if (data.layout !== 'page' || !isEntry(data)) return data;
  data.sitemap = false;
  data.noindex = true;
  data.comments = false;
  data.toc = { enable: false };
  if (!data.subtitle) data.subtitle = data.date.format('YYYY.MM.DD');
  return data;
});

// A way back out at the end of each entry.
hexo.extend.filter.register('after_post_render', data => {
  if (data.layout !== 'page' || !isEntry(data)) return data;
  const root = hexo.config.root;
  data.content += `<p class="diary-back"><a href="${root}${DIR}">← 0x7f</a></p>`;
  return data;
});

hexo.extend.generator.register('signal-diary', locals => {
  const root = hexo.config.root;
  const list = entries(locals.pages);

  const rows = list.map((page, index) => {
    const address = (BASE_ADDRESS + (list.length - 1 - index) * 0x40).toString(16).toUpperCase();
    return `<li class="diary-row">
      <span class="diary-addr" aria-hidden="true">0x${address}</span>
      <time datetime="${page.date.toISOString()}">${page.date.format('YYYY.MM.DD')}</time>
      <a href="${root}${page.path.replace(/index\.html$/, '')}">${escapeHtml(page.title)}</a>
    </li>`;
  }).join('');

  const content = `<p class="diary-intro">你读到了 EOF 之后。这里是一些不进目录的日记和小心得。</p>
    ${rows ? `<ol class="diary-list" reversed>${rows}</ol>` : '<p class="diary-empty">0x7f · 还是空的。</p>'}`;

  return {
    path: `${DIR}index.html`,
    layout: 'page',
    data: {
      title: '暗室',
      subtitle: 'past the end of file',
      type: 'diary',
      noindex: true,
      comments: false,
      toc: { enable: false },
      content
    }
  };
});
