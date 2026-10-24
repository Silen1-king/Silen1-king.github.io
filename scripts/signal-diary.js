'use strict';

/**
 * 暗室 (/0x7f/): a diary kept off every list.
 *
 * The whole diary is one file, source/_diary.md. Each entry is a date line
 * and then a sentence or a paragraph, no title:
 *
 *   ## 2026-10-24 22:30
 *
 *   今天想明白了一件事。
 *
 * The time is optional. Anything above the first date line, and anything
 * inside <!-- -->, is ignored.
 * Hexo skips files whose names start with "_", so the diary never becomes a
 * page or a post of its own: it is never on the home page, 札记, categories,
 * tags, the search index, the Atom feed or sitemap.xml. This script reads it
 * and builds /0x7f/, every entry in full, newest first. The only way in is
 * the dim "EOF · 0x7f" line at the end of every post
 * (source/_data/post-body-end.njk).
 *
 * Do not list /0x7f/ in robots.txt: that file is public and would point
 * straight at it. The page carries <meta name="robots" content="noindex">.
 */

const fs = require('fs');
const path = require('path');

const DIR = '0x7f/';
const FILE = '_diary.md';
const BASE_ADDRESS = 0x7f000000;
const DATE_LINE = /^##[ \t]+(\d{4})-(\d{1,2})-(\d{1,2})(?:[ \t]+(\d{1,2}):(\d{2}))?[ \t]*$/gm;

const pad = value => String(value).padStart(2, '0');

function readEntries() {
  let text;
  try {
    text = fs.readFileSync(path.join(hexo.source_dir, FILE), 'utf8');
  } catch (error) {
    return [];
  }

  // HTML comments hold notes and examples, never entries.
  const source = text.replace(/\r\n?/g, '\n').replace(/<!--[\s\S]*?-->/g, '');
  const marks = [...source.matchAll(DATE_LINE)];
  return marks.map((match, index) => {
    const [, year, month, day, hour, minute] = match;
    const end = index + 1 < marks.length ? marks[index + 1].index : source.length;
    const date = `${year}.${pad(month)}.${pad(day)}`;
    const time = hour === undefined ? '' : `${pad(hour)}:${minute}`;
    return {
      order: index,
      date,
      time,
      key: `${date}${time || '99:99'}`,
      body: source.slice(match.index + match[0].length, end).trim()
    };
  }).filter(entry => entry.body)
    // Newest first; on the same day, what was written later comes first.
    .sort((a, b) => b.key.localeCompare(a.key) || b.order - a.order);
}

hexo.extend.generator.register('signal-diary', async () => {
  const entries = readEntries();

  const rows = await Promise.all(entries.map(async (entry, index) => {
    const address = (BASE_ADDRESS + (entries.length - 1 - index) * 0x40).toString(16).toUpperCase();
    const body = await hexo.render.render({ text: entry.body, engine: 'markdown' });
    const iso = entry.date.replace(/\./g, '-') + (entry.time ? `T${entry.time}` : '');
    return `<article class="diary-entry">
      <header class="diary-row">
        <span class="diary-addr" aria-hidden="true">0x${address}</span>
        <time datetime="${iso}">${entry.date}${entry.time ? ` ${entry.time}` : ''}</time>
      </header>
      <div class="diary-body">${body}</div>
    </article>`;
  }));

  const content = `<p class="diary-intro">你读到了 EOF 之后。这里是一些不进目录的随手记。</p>
    ${rows.length ? `<div class="diary-feed">${rows.join('')}</div>` : '<p class="diary-empty">0x7f · 还是空的。</p>'}`;

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
