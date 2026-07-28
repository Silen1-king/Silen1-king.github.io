'use strict';

const fs = require('node:fs');
const path = require('node:path');
const frontMatter = require('hexo-front-matter');

const REQUIRED_FIELDS = ['title', 'description', 'tags', 'date'];
const MARKDOWN_IMAGE_PATTERN = /!\[[^\]]*\]\(([^)]+)\)/g;
const MARKDOWN_LINK_PATTERN = /(?<!!)\[[^\]]+\]\(([^)]+)\)/g;
const HTML_IMAGE_PATTERN = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
const ASSET_PATTERN = /\{%\s*asset_(?:img|link)\s+([^\s%]+)[^%]*%\}/g;

function findMarkdownFiles(directory) {
  const files = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...findMarkdownFiles(fullPath));
    if (entry.isFile() && /\.md$/i.test(entry.name)) files.push(fullPath);
  }

  return files.sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

function isMissing(value) {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function postsDirectoryFromArgs() {
  const directoryFlag = process.argv.indexOf('--dir');
  if (directoryFlag !== -1) {
    const suppliedPath = process.argv[directoryFlag + 1];
    if (!suppliedPath) throw new Error('--dir 后需要提供目录路径');
    return path.resolve(process.cwd(), suppliedPath);
  }

  return path.resolve(process.cwd(), 'source', '_posts');
}

function relativeName(postsDirectory, filePath) {
  return path.relative(postsDirectory, filePath).split(path.sep).join('/');
}

function cleanTarget(rawTarget) {
  let target = String(rawTarget || '').trim();
  if (target.startsWith('<') && target.includes('>')) target = target.slice(1, target.indexOf('>'));
  else target = target.split(/\s+["']/)[0];
  target = target.replace(/^['"]|['"]$/g, '').split(/[?#]/)[0];
  try {
    return decodeURIComponent(target);
  } catch {
    return target;
  }
}

function isExternalTarget(target) {
  return /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(target);
}

function referencedTargets(content, pattern) {
  return [...content.matchAll(pattern)].map(match => cleanTarget(match[1])).filter(Boolean);
}

function resolveLocalTarget(postsDirectory, filePath, target) {
  const sourceDirectory = path.dirname(postsDirectory);
  if (target.startsWith('/')) return path.join(sourceDirectory, target.replace(/^\/+/, ''));
  return path.resolve(path.dirname(filePath), target);
}

function missingLocalReferences(postsDirectory, filePath, content) {
  const imageTargets = [
    ...referencedTargets(content, MARKDOWN_IMAGE_PATTERN),
    ...referencedTargets(content, HTML_IMAGE_PATTERN),
    ...referencedTargets(content, ASSET_PATTERN)
  ];
  const linkTargets = referencedTargets(content, MARKDOWN_LINK_PATTERN)
    // Extensionless links are usually generated Hexo routes and are validated after build.
    .filter(target => /\.[a-z\d]{1,8}$/i.test(target));

  const missing = [];
  for (const target of [...new Set([...imageTargets, ...linkTargets])]) {
    if (isExternalTarget(target)) continue;
    const resolved = resolveLocalTarget(postsDirectory, filePath, target);
    if (!fs.existsSync(resolved)) missing.push(target);
  }
  return missing;
}

function main() {
  let postsDirectory;
  try {
    postsDirectory = postsDirectoryFromArgs();
  } catch (error) {
    console.error(`[ERROR] ${error.message}`);
    process.exitCode = 2;
    return;
  }

  if (!fs.existsSync(postsDirectory) || !fs.statSync(postsDirectory).isDirectory()) {
    console.error(`[ERROR] 文章目录不存在：${postsDirectory}`);
    process.exitCode = 2;
    return;
  }

  const files = findMarkdownFiles(postsDirectory);
  if (files.length === 0) {
    console.warn(`[WARN] 文章目录中没有 Markdown 文件：${postsDirectory}`);
    return;
  }

  let issueCount = 0;
  let affectedFiles = 0;

  for (const filePath of files) {
    const fileName = relativeName(postsDirectory, filePath);
    // hexo-front-matter expects LF separators; normalize Windows CRLF first.
    const raw = fs.readFileSync(filePath, 'utf8')
      .replace(/^\uFEFF/, '')
      .replace(/\r\n?/g, '\n');
    let attributes;

    try {
      attributes = frontMatter.parse(raw);
    } catch (error) {
      console.warn(`[WARN] ${fileName}: Front-matter 无法解析（${error.message}）`);
      issueCount += 1;
      affectedFiles += 1;
      continue;
    }

    const missingFields = REQUIRED_FIELDS.filter(field => isMissing(attributes[field]));
    const missingReferences = missingLocalReferences(postsDirectory, filePath, attributes._content || '');
    if (missingFields.length === 0 && missingReferences.length === 0) continue;

    if (missingFields.length) console.warn(`[WARN] ${fileName}: 缺少 ${missingFields.join(', ')}`);
    if (missingReferences.length) console.warn(`[WARN] ${fileName}: 本地资源不存在 ${missingReferences.join(', ')}`);
    issueCount += missingFields.length + missingReferences.length;
    affectedFiles += 1;
  }

  console.log('');
  if (issueCount === 0) {
    console.log(`[OK] 已检查 ${files.length} 篇文章，元数据与本地资源引用均有效。`);
    return;
  }

  console.warn(`[SUMMARY] 已检查 ${files.length} 篇文章；${affectedFiles} 篇存在问题，共缺少或损坏 ${issueCount} 项元数据。`);
  console.warn('请修复文章元数据或本地资源引用后重新运行 npm run check:posts。');
  process.exitCode = 1;
}

// Hexo loads every JavaScript file under scripts/. Only run this CLI when the
// file itself is invoked with `node scripts/check-posts.js`.
if (require.main === module) main();
