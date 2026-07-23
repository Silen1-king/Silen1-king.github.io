'use strict';

const fs = require('node:fs');
const path = require('node:path');
const frontMatter = require('hexo-front-matter');

const YEAR_MS = 365.2425 * 24 * 60 * 60 * 1000;
const ALERT_TYPES = {
  NOTE: { title: '注意', icon: 'ℹ️' },
  TIP: { title: '提示', icon: '💡' },
  IMPORTANT: { title: '重要', icon: '❗' },
  WARNING: { title: '警告', icon: '⚠️' },
  CAUTION: { title: '谨慎', icon: '🚧' }
};

function transformAlerts(html) {
  return String(html || '').replace(/<blockquote>([\s\S]*?)<\/blockquote>/gi, (blockquote, inner) => {
    const firstParagraph = inner.match(/^\s*<p>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(?:<br\s*\/?>\s*)?([\s\S]*?)<\/p>/i);
    if (!firstParagraph) return blockquote;

    const type = firstParagraph[1].toUpperCase();
    const alert = ALERT_TYPES[type];
    const firstBody = firstParagraph[2].trim();
    const remainingBody = inner.slice(firstParagraph[0].length).trim();
    const body = `${firstBody ? `<p>${firstBody}</p>` : ''}${remainingBody}`;

    return `<aside class="markdown-alert markdown-alert-${type.toLowerCase()}" role="note">
      <p class="markdown-alert-title"><span aria-hidden="true">${alert.icon}</span>${alert.title}</p>
      <div class="markdown-alert-body">${body}</div>
    </aside>`;
  });
}

function addImageLoadingHints(html) {
  return String(html || '').replace(/<img\b([^>]*)>/gi, (tag, attributes) => {
    const additions = [];
    if (!/\bloading\s*=/i.test(attributes)) additions.push('loading="lazy"');
    if (!/\bdecoding\s*=/i.test(attributes)) additions.push('decoding="async"');
    if (!additions.length) return tag;
    return `<img${attributes} ${additions.join(' ')}>`;
  });
}

function asDate(value) {
  if (!value) return null;
  const date = value && typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function sourceFileFor(post) {
  if (post.full_source && fs.existsSync(post.full_source)) return post.full_source;
  if (!post.source) return null;

  const relativeSource = String(post.source).replace(/^source[\\/]/, '');
  const sourceFile = path.isAbsolute(relativeSource)
    ? relativeSource
    : path.join(hexo.source_dir, relativeSource);
  return fs.existsSync(sourceFile) ? sourceFile : null;
}

function readExplicitMetadata(post) {
  const sourceFile = sourceFileFor(post);
  if (!sourceFile) return { date: post.date };

  try {
    const raw = fs.readFileSync(sourceFile, 'utf8')
      .replace(/^\uFEFF/, '')
      .replace(/\r\n?/g, '\n');
    return frontMatter.parse(raw);
  } catch (error) {
    hexo.log.warn(`无法读取文章 Front-matter：${post.source}（${error.message}）`);
    return { date: post.date };
  }
}

function staleNoticeFor(post, now = new Date()) {
  const metadata = readExplicitMetadata(post);
  const published = asDate(metadata.date || post.date);
  const explicitlyUpdated = Object.prototype.hasOwnProperty.call(metadata, 'updated')
    ? asDate(metadata.updated)
    : null;
  if (!published) return '';

  // An invalid/older `updated` must not make a post older than its publication.
  const lastReviewed = explicitlyUpdated && explicitlyUpdated > published
    ? explicitlyUpdated
    : published;
  if (now.getTime() - lastReviewed.getTime() <= YEAR_MS) return '';

  const publishedYears = Math.max(1, Math.floor((now.getTime() - published.getTime()) / YEAR_MS));
  return `<aside class="post-stale-notice" role="note">
    <span class="post-stale-notice-icon" aria-hidden="true">⚠️</span>
    <p><em>本文发布于 ${publishedYears} 年前，部分技术细节可能已发生变更，请结合最新文档参考。</em></p>
  </aside>`;
}

function taxonomyNames(collection) {
  if (!collection) return [];
  const items = typeof collection.toArray === 'function'
    ? collection.toArray()
    : (Array.isArray(collection) ? collection : [collection]);
  return [...new Set(items
    .map(item => typeof item === 'string' ? item : item && item.name)
    .map(item => String(item || '').trim())
    .filter(Boolean))];
}

function normalizedSet(items) {
  return new Set(items.map(item => item.toLocaleLowerCase('zh-CN')));
}

function relatedReason(sharedTags, sharedCategories) {
  const reasons = [];
  if (sharedTags.length) reasons.push(`共同标签：${sharedTags.slice(0, 2).join('、')}`);
  if (sharedCategories.length) reasons.push(`同属分类：${sharedCategories.slice(0, 2).join('、')}`);
  return reasons.join(' · ');
}

function relatedPostsFor(currentPost, allPosts, limit = 3) {
  const currentTags = normalizedSet(taxonomyNames(currentPost.tags));
  const currentCategories = normalizedSet(taxonomyNames(currentPost.categories));

  return allPosts
    .filter(candidate => candidate.path && candidate.path !== currentPost.path)
    .map(candidate => {
      const candidateTags = taxonomyNames(candidate.tags);
      const candidateCategories = taxonomyNames(candidate.categories);
      const sharedTags = candidateTags.filter(tag => currentTags.has(tag.toLocaleLowerCase('zh-CN')));
      const sharedCategories = candidateCategories.filter(category => currentCategories.has(category.toLocaleLowerCase('zh-CN')));
      const score = sharedTags.length * 3 + sharedCategories.length * 2;
      const date = asDate(candidate.date);

      return {
        path: candidate.path,
        title: candidate.title || '未命名文章',
        dateLabel: date ? new Intl.DateTimeFormat('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).format(date) : '',
        reason: relatedReason(sharedTags, sharedCategories),
        score,
        timestamp: date ? date.getTime() : 0
      };
    })
    .filter(candidate => candidate.score > 0)
    .sort((a, b) => b.score - a.score || b.timestamp - a.timestamp || a.title.localeCompare(b.title, 'zh-CN'))
    .slice(0, limit)
    .map(({ path: postPath, title, dateLabel, reason }) => ({ path: postPath, title, dateLabel, reason }));
}

hexo.extend.filter.register('after_post_render', function enhancePost(post) {
  if (post.layout !== 'post') return post;

  const staleNotice = staleNoticeFor(post);
  post.content = staleNotice + addImageLoadingHints(transformAlerts(post.content));
  return post;
});

hexo.extend.filter.register('template_locals', function prepareRelatedPosts(locals) {
  if (!locals.page || locals.page.layout !== 'post' || !locals.site || !locals.site.posts) {
    return locals;
  }

  const posts = locals.site.posts.toArray();
  locals.page.related_posts_by_metadata = relatedPostsFor(locals.page, posts, 3);
  return locals;
});

module.exports = {
  addImageLoadingHints,
  relatedPostsFor,
  staleNoticeFor,
  transformAlerts
};
