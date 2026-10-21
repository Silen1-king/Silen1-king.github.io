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
 *
 * Posts that share the same `order` inside a series are drawn side by side
 * as a branch of the route. Optional planned steps can be listed under
 * `learning_paths.planned` (series name -> titles or { title, order }).
 */

const DEFAULTS = {
  enable: true,
  path: 'learning-paths/',
  title: '学习路线',
  subtitle: '',
  description: '按专栏整理的系列教程，循序渐进地开始学习。',
  category_fallback: true,
  planned: {}
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

function plannedSteps(options, seriesName) {
  const planned = options.planned && options.planned[seriesName];
  return toArray(planned)
    .map(item => (typeof item === 'string' ? { title: item } : item || {}))
    .map(item => ({ title: String(item.title ?? '').trim(), order: numericOrder(item.order) }))
    .filter(item => item.title);
}

// Rows of the route graph: a row with more than one step is a branch.
function routeRows(group, options, root) {
  const published = group.posts.map(post => ({
    title: post.title || '未命名文章',
    url: joinRoot(root, post.path),
    date: dateInfo(post.date).iso.slice(0, 10),
    order: numericOrder(post.order)
  }));
  const publishedTitles = new Set(published.map(step => step.title));
  const planned = plannedSteps(options, group.name)
    .filter(step => !publishedTitles.has(step.title))
    .map(step => ({ title: step.title, url: '', date: '', order: step.order }));

  const steps = [...published, ...planned]
    .map((step, index) => ({ step, index }))
    .sort((a, b) => {
      const aOrder = a.step.order;
      const bOrder = b.step.order;
      if (aOrder !== null && bOrder !== null && aOrder !== bOrder) return aOrder - bOrder;
      if (aOrder !== null && bOrder === null) return -1;
      if (aOrder === null && bOrder !== null) return 1;
      return a.index - b.index;
    })
    .map(item => item.step);

  const rows = [];
  for (const step of steps) {
    const lastRow = rows[rows.length - 1];
    if (lastRow && step.order !== null && lastRow[0].order === step.order) lastRow.push(step);
    else rows.push([step]);
  }

  return rows.map(row => row.map(({ title, url, date }) => ({ title, url, date })));
}

function groupPosts(postsInput, options) {
  const groupedPosts = new Map();
  const posts = postsInput && typeof postsInput.toArray === 'function'
    ? postsInput.toArray()
    : toArray(postsInput);

  for (const post of posts) {
    for (const name of seriesNames(post, options.category_fallback)) {
      if (!groupedPosts.has(name)) groupedPosts.set(name, []);
      groupedPosts.get(name).push(post);
    }
  }

  return [...groupedPosts.entries()]
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
}

function learningOptions() {
  return Object.assign({}, DEFAULTS, hexo.config.learning_paths || {});
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

// A route is drawn once it has two steps; a single node on a grid says nothing
// the step list below it does not.
function graphFor(group, options, root) {
  const rows = routeRows(group, options, root);
  if (rows.reduce((sum, row) => sum + row.length, 0) < 2) return '';
  return `<div class="route-graph" data-route="${escapeHtml(JSON.stringify({ name: group.name, rows }))}" aria-hidden="true"></div>`;
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
      ${graphFor(group, options, root)}
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

// Route data for the home page 远征 section, one entry per series.
hexo.extend.helper.register('learning_path_routes', function learningPathRoutes(posts) {
  const options = learningOptions();
  if (!options.enable) return [];
  return groupPosts(posts, options).map(group => ({
    name: group.name,
    rows: routeRows(group, options, hexo.config.root)
  }));
});

hexo.extend.generator.register('learning-paths', function generateLearningPaths(locals) {
  const options = learningOptions();
  if (!options.enable) return [];

  const groups = groupPosts(locals.posts, options);

  const outputPath = String(options.path || DEFAULTS.path)
    .replace(/^\/+/, '')
    .replace(/\/?$/, '/');

  return {
    path: `${outputPath}index.html`,
    layout: 'page',
    data: {
      title: options.title,
      subtitle: options.subtitle,
      description: options.description,
      type: 'learning-paths',
      comments: false,
      content: renderPage(groups, options, hexo.config.root),
      toc: { enable: false }
    }
  };
});
