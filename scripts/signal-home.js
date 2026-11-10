'use strict';

/**
 * The home page, rendered by themes/next/layout/index.njk: the hero, then
 * the newest entries. Everything else lives on its own page.
 *
 *   signal_home_hero()      hero, with a link to the newest entry
 *   signal_codex(posts)     札记 rows for the current index page
 *   signal_codex_filters()  category filter chips, shown once there are 2+
 *   signal_reading_minutes(post)  reading time, shared with the post header
 */

// A row shows at most this many tags; the post itself lists them all.
const ROW_TAGS = 2;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toArray(collection) {
  if (!collection) return [];
  if (typeof collection.toArray === 'function') return collection.toArray();
  return Array.isArray(collection) ? collection : [collection];
}

function names(collection) {
  return [...new Set(toArray(collection)
    .map(item => typeof item === 'string' ? item : item && item.name)
    .map(item => String(item || '').trim())
    .filter(Boolean))];
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function dotDate(value) {
  const date = value && typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}.${pad2(date.getMonth() + 1)}.${pad2(date.getDate())}`;
}

function plainText(value) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(?:#\d+|#x[\da-f]+|[a-z]+);/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function summaryFor(post) {
  const text = plainText(post.description || post.excerpt || '');
  return text.length > 96 ? `${text.slice(0, 96)}…` : text;
}

function sortedPosts(site) {
  return site && site.posts ? site.posts.sort('date', -1).toArray() : [];
}

function realmList(site, config) {
  const settings = config.realms && typeof config.realms === 'object' ? config.realms : {};
  const categories = toArray(site && site.categories).filter(category => !category.parent);
  const byName = new Map(categories.map(category => [category.name, category]));
  const realmNames = [...new Set([...Object.keys(settings), ...byName.keys()])];

  return realmNames.map(name => {
    const category = byName.get(name);
    const options = settings[name] || {};
    const posts = category ? category.posts.sort('date', -1).toArray() : [];
    return {
      name,
      path: category ? category.path : '',
      posts
    };
  });
}

function renderHero(config, latest, total, urlFor) {
  const wordmark = (config.signal && config.signal.wordmark) || 'SILEN1';
  const latestLink = latest ? `
        <a class="signal-hero-latest" href="${escapeHtml(urlFor(latest.path))}">
          <span class="signal-hero-latest-meta">Latest · ${escapeHtml(dotDate(latest.date))}</span>
          <span class="signal-hero-latest-title">${escapeHtml(latest.title || '未命名文章')} →</span>
        </a>` : '';
  return `
  <section class="signal-hero" id="signal-hero" aria-labelledby="signal-hero-title">
    <div class="signal-hero-stage">
      <canvas class="signal-hero-canvas" data-wordmark="${escapeHtml(wordmark)}" aria-hidden="true"></canvas>
      <div class="signal-hero-copy">
        <h1 class="signal-hero-title" id="signal-hero-title">Signal,<br><span>out of noise.</span></h1>${latestLink}
      </div>
      <span class="signal-scroll-hint" aria-hidden="true"></span>
    </div>
  </section>`;
}

function readingMinutes(post) {
  const countWords = hexo.extend.helper.get('post_word_count');
  const words = countWords ? countWords(post) : plainText(post.content).length;
  return Math.max(1, Math.ceil(words / 350));
}

function renderCodexRow(post, urlFor) {
  const realm = names(post.categories)[0] || '';
  const date = post.date && typeof post.date.toDate === 'function' ? post.date.toDate() : new Date(post.date);
  const summary = summaryFor(post);
  const categoryLink = toArray(post.categories)[0];

  const tags = toArray(post.tags).slice(0, ROW_TAGS);

  return `
    <article class="signal-seg" data-realm="${escapeHtml(realm)}">
      <time datetime="${Number.isNaN(date.getTime()) ? '' : date.toISOString()}">${escapeHtml(dotDate(post.date))}</time>
      <div class="signal-seg-main">
        <h3><a class="signal-seg-link" href="${escapeHtml(urlFor(post.path))}">${escapeHtml(post.title || '未命名文章')}</a></h3>
        ${summary ? `<p>${escapeHtml(summary)}</p>` : ''}
        ${tags.length ? `<div class="signal-seg-tags">${tags.map(tag => `<a href="${escapeHtml(urlFor(tag.path))}">#${escapeHtml(tag.name)}</a>`).join(' ')}</div>` : ''}
      </div>
      <div class="signal-seg-meta">
        ${categoryLink && categoryLink.path ? `<a class="signal-seg-realm" href="${escapeHtml(urlFor(categoryLink.path))}">${escapeHtml(realm)}</a>` : ''}
        <span class="signal-seg-size">${readingMinutes(post)} min</span>
      </div>
    </article>`;
}

hexo.extend.helper.register('signal_home_hero', function signalHomeHero() {
  const urlFor = path => this.url_for(path);
  const posts = sortedPosts(this.site);
  return renderHero(this.config, posts[0], posts.length, urlFor);
});

hexo.extend.helper.register('signal_reading_minutes', function signalReadingMinutes(post) {
  return readingMinutes(post);
});

hexo.extend.helper.register('signal_codex_filters', function signalCodexFilters() {
  const realms = realmList(this.site, this.config).filter(realm => realm.posts.length);
  const entries = toArray(this.site.posts).length;
  if (realms.length < 2) {
    return `<span class="signal-count">${entries} ${entries === 1 ? 'entry' : 'entries'}</span>`;
  }
  return `<div class="signal-chips" role="group" aria-label="按疆域筛选" data-realm-filters>
    <button class="signal-chip" type="button" aria-pressed="true" data-realm-filter="">All</button>
    ${realms.map(realm => `<button class="signal-chip" type="button" aria-pressed="false" data-realm-filter="${escapeHtml(realm.name)}">${escapeHtml(realm.name)}</button>`).join('')}
  </div>`;
});

hexo.extend.helper.register('signal_codex', function signalCodex(posts) {
  const urlFor = path => this.url_for(path);
  const rows = toArray(posts).map(post => renderCodexRow(post, urlFor));
  return `<div class="signal-seglist">${rows.join('') || '<p class="signal-empty">第一篇札记正在路上。</p>'}</div>`;
});

// hexo-generator-index writes nothing when there are no posts yet, which leaves
// the site without a home page. Render the home page with its empty states instead.
hexo.extend.generator.register('signal_empty_index', function signalEmptyIndex(locals) {
  if (locals.posts.length) return [];
  const indexConfig = this.config.index_generator || {};
  const base = indexConfig.path || '';
  return {
    path: base ? `${base.replace(/\/?$/, '/')}index.html` : 'index.html',
    layout: indexConfig.layout || ['index', 'archive'],
    data: {
      base,
      total: 1,
      current: 1,
      current_url: base,
      posts: locals.posts,
      prev: 0,
      prev_link: '',
      next: 0,
      next_link: '',
      __index: true
    }
  };
});
