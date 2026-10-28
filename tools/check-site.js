'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('parse5');

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}

function visit(node, callback) {
  callback(node);
  for (const child of node.childNodes || []) visit(child, callback);
  if (node.content) visit(node.content, callback);
}

// Use an inventory instead of existsSync so Windows also detects casing errors
// that would break on the Linux deployment host.
function checkSite({ publicDir, siteUrl, root = '/', posts = [], drafts = [], searchPath = 'search.json',
  sitemapPaths = ['sitemap.xml'], feedPaths = ['atom.xml'] }) {
  const errors = new Set();
  if (!fs.existsSync(publicDir)) return ['生成目录不存在，请先运行 npm run build。'];
  const files = new Set(walk(publicDir).map(file => path.relative(publicDir, file).split(path.sep).join('/')));
  const origin = new URL(siteUrl).origin;
  const base = new URL(root.endsWith('/') ? root : `${root}/`, origin);
  const outputPath = route => {
    const decoded = decodeURIComponent(route).replace(/^\/+/, '');
    return decoded.endsWith('/') || !decoded ? `${decoded}index.html` : decoded;
  };
  const forbidden = new Set(drafts.map(outputPath));

  function resolve(raw, from) {
    if (!raw || raw.startsWith('#')) return null;
    let url;
    try { url = new URL(raw, from); } catch { errors.add(`无效 URL：${raw}`); return null; }
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) return null;
    let pathname;
    try { pathname = decodeURIComponent(url.pathname); } catch { errors.add(`无效 URL 编码：${raw}`); return null; }
    const prefix = decodeURIComponent(base.pathname);
    if (!pathname.startsWith(prefix)) {
      errors.add(`站点根目录以外的引用：${raw}`);
      return null;
    }
    const relative = pathname.slice(prefix.length);
    return relative.endsWith('/') || !relative ? `${relative}index.html` : relative;
  }

  function check(raw, from, label) {
    const route = resolve(raw, from);
    if (route === null) return;
    // GitHub Pages also serves extensionless HTML URLs (e.g. /404 -> 404.html).
    const target = [route, `${route}/index.html`, `${route}.html`].find(candidate => files.has(candidate)) || route;
    if (forbidden.has(route) || forbidden.has(target)) errors.add(`${label}: 引用了草稿 ${raw}`);
    if (!files.has(target)) errors.add(`${label}: 本地目标不存在或大小写不匹配 ${raw}`);
  }

  function cssReferences(css, from, label) {
    const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const match of clean.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/gi)) {
      check(match[1] ?? match[2] ?? match[3], from, label);
    }
    for (const match of clean.matchAll(/@import\s+["']([^"']+)["']/gi)) check(match[1], from, label);
  }

  for (const required of ['index.html', '404.html', searchPath, ...sitemapPaths, ...feedPaths, ...posts]) {
    if (!files.has(outputPath(required))) errors.add(`缺少必需产物：${required}`);
  }
  for (const draft of forbidden) {
    if (files.has(draft)) errors.add(`产物中包含草稿页面：${draft}`);
  }

  for (const file of files) {
    const from = new URL(file, base);
    if (file.endsWith('.css')) cssReferences(fs.readFileSync(path.join(publicDir, file), 'utf8'), from, file);
    if (!file.endsWith('.html')) continue;
    const document = parse(fs.readFileSync(path.join(publicDir, file), 'utf8'));
    let documentBase = from;
    visit(document, node => {
      if (node.tagName === 'base') {
        const href = node.attrs.find(attr => attr.name === 'href');
        if (href) { try { documentBase = new URL(href.value, from); } catch { errors.add(`${file}: 无效 base URL`); } }
      }
    });
    visit(document, node => {
      const attrs = Object.fromEntries((node.attrs || []).map(attr => [attr.name, attr.value]));
      for (const name of ['src', 'href', 'poster', 'data-src']) {
        if (node.tagName !== 'base' && attrs[name]) check(attrs[name], documentBase, file);
      }
      if (attrs.srcset) {
        // Data URLs contain commas; do not split their payload into fake URLs.
        for (const match of attrs.srcset.matchAll(/(?:^|\s*,\s*)(\S+?)(?:\s+[\d.]+[wx])?(?=\s*,|$)/g)) {
          if (!match[1].startsWith('data:')) check(match[1], documentBase, file);
        }
      }
      if (attrs.style) cssReferences(attrs.style, documentBase, file);
      if (node.tagName === 'style') cssReferences((node.childNodes || []).map(child => child.value || '').join(''), documentBase, file);
      if (node.tagName === 'meta' && /^(og:image|og:url|twitter:image)$/.test(attrs.property || attrs.name || '')) {
        check(attrs.content, documentBase, file);
      }
    });
  }

  if (files.has(searchPath)) {
    try {
      const records = JSON.parse(fs.readFileSync(path.join(publicDir, searchPath), 'utf8'));
      if (!Array.isArray(records)) throw new Error('索引必须是数组');
      for (const record of records) {
        if (typeof record.url !== 'string' || !record.url.trim()) errors.add(`${searchPath}: 搜索记录缺少 URL`);
        else check(record.url, base, searchPath);
      }
    } catch (error) { errors.add(`${searchPath}: ${error.message}`); }
  }
  for (const file of [...sitemapPaths, ...feedPaths]) {
    if (!files.has(file)) continue;
    const xml = fs.readFileSync(path.join(publicDir, file), 'utf8');
    const decode = value => value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    for (const match of xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>|<link\b[^>]*\bhref=["']([^"']+)["']/g)) {
      check(decode((match[1] || match[2]).trim()), base, file);
    }
  }
  return [...errors];
}

async function main() {
  const Hexo = require('hexo');
  const hexo = new Hexo(process.cwd(), { silent: true });
  await hexo.init();
  if (hexo.config.render_drafts) throw new Error('生产配置禁止 render_drafts: true；本地预览请使用 npm run server:drafts。');
  // Read the database produced by the completed build without regenerating pages.
  if (!fs.existsSync(hexo.database.options.path)) throw new Error('缺少构建数据库，请先运行 npm run build。');
  await hexo.database.load();
  const allPosts = hexo.model('Post').toArray();
  const routes = published => allPosts.filter(post => Boolean(post.published) === published).map(post => post.path);
  const list = value => Array.isArray(value) ? value : [value];
  const errors = checkSite({
    publicDir: hexo.public_dir, siteUrl: hexo.config.url, root: hexo.config.root,
    posts: hexo.locals.get('posts').toArray().map(post => post.path), drafts: routes(false),
    searchPath: hexo.config.search.path,
    sitemapPaths: list(hexo.config.sitemap.path), feedPaths: list(hexo.config.feed.path)
  });
  if (errors.length) throw new Error(`产物检查失败（${errors.length} 项）：\n${errors.map(error => `- ${error}`).join('\n')}`);
  console.log(`[OK] 产物页面、资源、搜索、站点地图和订阅链接检查通过；${routes(false).length} 篇草稿未发布。`);
}

module.exports = { checkSite };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
