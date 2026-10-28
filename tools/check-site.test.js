'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { checkSite } = require('./check-site');

function fixture(t) {
  const publicDir = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-check-'));
  t.after(() => fs.rmSync(publicDir, { recursive: true, force: true }));
  const write = (file, content) => {
    fs.mkdirSync(path.dirname(path.join(publicDir, file)), { recursive: true });
    fs.writeFileSync(path.join(publicDir, file), content);
  };
  write('index.html', '<a href="/post/">Post</a><a href="https://elsewhere.example/missing">External</a>');
  write('404.html', '<a href="/">Home</a>');
  write('post/index.html', '<img src="/images/%E4%B8%AD%20%E6%96%87.png?v=2"><a href="#heading">Heading</a>');
  write('images/中 文.png', 'fixture');
  write('search.json', JSON.stringify([{ title: 'Post', url: 'https://blog.example/post/' }]));
  write('sitemap.xml', '<urlset><url><loc>https://blog.example/post/</loc></url></urlset>');
  write('atom.xml', '<feed><link href="https://blog.example/post/"/></feed>');
  const check = options => checkSite({ publicDir, siteUrl: 'https://blog.example', posts: ['post/'], drafts: ['draft/'], ...options });
  return { write, check };
}

test('accepts generated routes, encoded image names, query strings and external links', t => {
  assert.deepEqual(fixture(t).check(), []);
});

test('rejects broken resources, CSS fonts, internal links and wrong path casing', t => {
  const { write, check } = fixture(t);
  write('index.html', '<img src="/missing.png"><script src="/missing.js"></script><link rel="stylesheet" href="/style.css"><a href="/Post/">Wrong case</a>');
  write('style.css', '@font-face { src: url("/missing.woff2"); }');
  const errors = check().join('\n');
  for (const target of ['missing.png', 'missing.js', '/Post/', 'missing.woff2']) assert.ok(errors.includes(target), errors);
});

test('rejects draft pages and draft references in discovery outputs', t => {
  const { write, check } = fixture(t);
  write('draft/index.html', '<p>Unpublished</p>');
  write('search.json', '[{"url":"/draft/"}]');
  write('sitemap.xml', '<urlset><url><loc>https://blog.example/draft/</loc></url></urlset>');
  write('atom.xml', '<feed><link href="/draft/"/></feed>');
  const errors = check().join('\n');
  for (const target of ['草稿页面', 'search.json', 'sitemap.xml', 'atom.xml']) assert.ok(errors.includes(target), errors);
});

test('rejects malformed search JSON and missing required output', t => {
  const { write, check } = fixture(t);
  write('search.json', '{broken');
  const errors = check({ posts: ['absent/index.html'] }).join('\n');
  assert.ok(errors.includes('search.json'));
  assert.ok(errors.includes('absent/index.html'));
});

test('resolves relative URLs and a configured subdirectory root', t => {
  const { write, check } = fixture(t);
  write('index.html', '<a href="post/">Post</a>');
  write('404.html', '<a href="/blog/">Home</a>');
  write('post/index.html', '<img src="../images/%E4%B8%AD%20%E6%96%87.png">');
  write('search.json', '[{"url":"/blog/post/"}]');
  write('sitemap.xml', '<urlset><url><loc>https://blog.example/blog/post/</loc></url></urlset>');
  write('atom.xml', '<feed><link href="/blog/post/"/></feed>');
  assert.deepEqual(check({ root: '/blog/' }), []);
});
