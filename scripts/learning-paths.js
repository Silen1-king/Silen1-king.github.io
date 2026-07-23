'use strict';

/**
 * Hexo generator: build /learning-paths/ from post `series` or `categories`.
 *
 * Supported front matter:
 *   series: PWN 入门
 *   order: 1
 *
 * When `series` is absent, category names are used if
 * `learning_paths.category_fallback` is enabled (the default).
 */

const DEFAULTS = {
  enable: true,
  path: 'learning-paths/',
  title: '学习路线',
  description: '按专栏整理的系列教程，循序渐进地开始学习。',
  category_fallback: true
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toArray(value) {
  if (value === undefined || value === null || value === '') return [];
  return Array.isArray(value) ? value : [value];
}

function categoryNames(post) {
  if (!post.categories) return [];

  const categories = typeof post.categories.toArray === 'function'
    ? post.categories.toArray()
    : toArray(post.categories);

  return categories
    .map(category => typeof category === 'string' ? category : category && category.name)
    .filter(Boolean);
}

function seriesNames(post, categoryFallback) {
  const explicitSeries = toArray(post.series)
    .map(item => typeof item === 'string' ? item.trim() : String(item ?? '').trim())
    .filter(Boolean);

  if (explicitSeries.length > 0) return [...new Set(explicitSeries)];
  if (!categoryFallback) return [];
  return [...new Set(categoryNames(post))];
}

function dateInfo(value) {
  const date = value && typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { timestamp: Number.MAX_SAFE_INTEGER, iso: '', label: '日期未知' };
  }

  return {
    timestamp: date.getTime(),
    iso: date.toISOString(),
    label: new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date)
  };
}

function numericOrder(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function plainText(value) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function excerptFor(post) {
  const excerpt = plainText(post.description || post.excerpt || '');
  if (!excerpt) return '';
  return excerpt.length > 110 ? `${excerpt.slice(0, 110)}…` : excerpt;
}

function joinRoot(root, postPath) {
  const normalizedRoot = String(root || '/').replace(/\/?$/, '/');
  return normalizedRoot + String(postPath || '').replace(/^\/+/, '');
}

function renderPost(post, index, root) {
  const date = dateInfo(post.date);
  const order = numericOrder(post.order);
  const description = excerptFor(post);
  const stepLabel = order === null ? index + 1 : order;
  const title = post.title || '未命名文章';
  const url = joinRoot(root, post.path);

  return `
    <li class="learning-path-step">
      <span class="learning-path-step-number" aria-hidden="true">${escapeHtml(stepLabel)}</span>
      <div class="learning-path-step-content">
        <a class="learning-path-step-title" href="${escapeHtml(url)}">${escapeHtml(title)}</a>
        <time class="learning-path-step-date" datetime="${escapeHtml(date.iso)}">${escapeHtml(date.label)}</time>
        ${description ? `<p class="learning-path-step-description">${escapeHtml(description)}</p>` : ''}
      </div>
    </li>`;
}

function renderPage(groups, options, root) {
  const totalPosts = new Set(groups.flatMap(group => group.posts.map(post => post._id || post.path))).size;
  const cards = groups.map((group, index) => `
    <section class="learning-path-card">
      <header class="learning-path-card-header">
        <span class="learning-path-card-index">${String(index + 1).padStart(2, '0')}</span>
        <div>
          <h2>${escapeHtml(group.name)}</h2>
          <span class="learning-path-card-count">${group.posts.length} 篇教程</span>
        </div>
      </header>
      <ol class="learning-path-steps">
        ${group.posts.map((post, postIndex) => renderPost(post, postIndex, root)).join('')}
      </ol>
    </section>`).join('');

  return `
    <div class="learning-paths-intro">
      <p>${escapeHtml(options.description)}</p>
      <div class="learning-paths-stats" aria-label="路线统计">
        <span><strong>${groups.length}</strong> 条路线</span>
        <span><strong>${totalPosts}</strong> 篇文章</span>
      </div>
    </div>
    <div class="learning-path-grid">
      ${cards || '<p class="learning-paths-empty">暂无可展示的专栏。请在文章 Front-matter 中添加 <code>series</code> 或 <code>categories</code>。</p>'}
    </div>`;
}

hexo.extend.generator.register('learning-paths', function generateLearningPaths(locals) {
  const options = Object.assign({}, DEFAULTS, hexo.config.learning_paths || {});
  if (!options.enable) return [];

  const groupedPosts = new Map();
  const posts = locals.posts && typeof locals.posts.toArray === 'function'
    ? locals.posts.toArray()
    : [];

  for (const post of posts) {
    for (const name of seriesNames(post, options.category_fallback)) {
      if (!groupedPosts.has(name)) groupedPosts.set(name, []);
      groupedPosts.get(name).push(post);
    }
  }

  const groups = [...groupedPosts.entries()]
    .map(([name, groupPosts]) => ({
      name,
      posts: groupPosts.sort((a, b) => {
        const aOrder = numericOrder(a.order);
        const bOrder = numericOrder(b.order);
        if (aOrder !== null && bOrder !== null && aOrder !== bOrder) return aOrder - bOrder;
        if (aOrder !== null && bOrder === null) return -1;
        if (aOrder === null && bOrder !== null) return 1;

        const dateDifference = dateInfo(a.date).timestamp - dateInfo(b.date).timestamp;
        if (dateDifference !== 0) return dateDifference;
        return String(a.title || '').localeCompare(String(b.title || ''), 'zh-CN');
      })
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));

  const outputPath = String(options.path || DEFAULTS.path)
    .replace(/^\/+/, '')
    .replace(/\/?$/, '/');

  return {
    path: `${outputPath}index.html`,
    layout: 'page',
    data: {
      title: options.title,
      description: options.description,
      type: 'learning-paths',
      comments: false,
      content: renderPage(groups, options, hexo.config.root),
      toc: { enable: false }
    }
  };
});
