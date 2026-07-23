'use strict';

function toArray(collection) {
  if (!collection) return [];
  if (typeof collection.toArray === 'function') return collection.toArray();
  return Array.isArray(collection) ? collection : [collection];
}

function toDate(value) {
  const date = value && typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function taxonomyNames(collection) {
  return [...new Set(toArray(collection)
    .map(item => typeof item === 'string' ? item : item && item.name)
    .map(item => String(item || '').trim())
    .filter(Boolean))];
}

function countWords(html) {
  const text = String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:#\d+|#x[\da-f]+|[a-z]+);/gi, ' ')
    .replace(/\s+/g, ' ');
  const cjkCount = (text.match(/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g) || []).length;
  const latinCount = (text
    .replace(/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g, ' ')
    .match(/[a-zA-Z0-9]+(?:[-_'.][a-zA-Z0-9]+)*/g) || []).length;
  return cjkCount + latinCount;
}

function buildStats(postsInput) {
  const posts = toArray(postsInput);
  const tagCounts = new Map();
  let words = 0;

  for (const post of posts) {
    words += countWords(post.content || post.excerpt || '');
    for (const tag of taxonomyNames(post.tags)) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }

  const topTags = [...tagCounts.entries()]
    .map(([name, count]) => ({
      name,
      count,
      percent: posts.length ? Math.max(4, Math.round(count / posts.length * 100)) : 0
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'))
    .slice(0, 8);

  return {
    postCount: posts.length,
    words,
    wordWan: (words / 10000).toFixed(1),
    domainSummary: topTags.slice(0, 4).map(tag => tag.name).join('、') || '持续探索中',
    topTags
  };
}

function renderArchive(postsInput, root = '/') {
  const posts = toArray(postsInput).sort((a, b) => toDate(b.date) - toDate(a.date));
  const years = new Map();

  for (const post of posts) {
    const date = toDate(post.date);
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, '0');
    if (!years.has(year)) years.set(year, new Map());
    const months = years.get(year);
    if (!months.has(month)) months.set(month, []);
    months.get(month).push({ post, date });
  }

  const normalizedRoot = String(root || '/').replace(/\/?$/, '/');
  const cards = [...years.entries()].map(([year, months], yearIndex) => {
    const yearCount = [...months.values()].reduce((total, items) => total + items.length, 0);
    const monthPanels = [...months.entries()].map(([month, items], monthIndex) => `
      <details class="archive-month"${yearIndex === 0 && monthIndex === 0 ? ' open' : ''}>
        <summary>
          <span class="archive-month-name">${month} 月</span>
          <span class="archive-panel-count">${items.length} 篇</span>
        </summary>
        <ol class="archive-post-list">
          ${items.map(({ post, date }) => {
            const day = String(date.getDate()).padStart(2, '0');
            const url = normalizedRoot + String(post.path || '').replace(/^\/+/, '');
            return `<li>
              <time datetime="${date.toISOString()}">${month}-${day}</time>
              <a href="${escapeHtml(url)}">${escapeHtml(post.title || '未命名文章')}</a>
            </li>`;
          }).join('')}
        </ol>
      </details>`).join('');

    return `<details class="archive-year"${yearIndex === 0 ? ' open' : ''}>
      <summary>
        <span class="archive-year-name">${escapeHtml(year)}</span>
        <span class="archive-panel-count">${yearCount} 篇文章</span>
      </summary>
      <div class="archive-months">${monthPanels}</div>
    </details>`;
  }).join('');

  return cards || '<p class="archive-empty">暂无归档文章。</p>';
}

hexo.extend.helper.register('archive_tree', function archiveTree(posts) {
  return renderArchive(posts, hexo.config.root);
});

hexo.extend.helper.register('blog_stats', function blogStats(posts) {
  return buildStats(posts);
});

module.exports = { buildStats, countWords, renderArchive };
