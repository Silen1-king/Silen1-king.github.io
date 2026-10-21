'use strict';

/**
 * SIGNAL home page sections, rendered by themes/next/layout/index.njk.
 *
 *   signal_home_hero()      hero, with a link to the newest entry
 *   signal_codex(posts)     札记 rows for the current index page
 *   signal_codex_filters()  realm filter chips, shown once there are 2+ realms
 *   signal_home_outro()     远征 (series route), 疆域 (one card per category)
 *                           and 年鉴 (stats)
 *   signal_reading_minutes(post)  reading time, shared with the post header
 *
 * Content comes first: 札记 follows the hero, the atmosphere after it.
 * Modules that need volume to mean anything wait for it: the route graph
 * draws once a series has ROUTE_MIN steps, the tag spectrum once the blog
 * has SPECTRUM_MIN entries. Until then they fall back to a plain line.
 *
 * Realms come from site.categories, optionally described in _config.yml:
 *
 *   realms:
 *     CTF:
 *       epithet: Capture the Flag
 *       emblem: flag
 *       description: ...
 *
 * Categories without settings still appear, with an emblem generated from
 * their name, so new categories need no template changes.
 */

const BASE_ADDRESS = 0x401000;
const ADDRESS_STRIDE = 0x1A40;
const ROUTE_MIN = 2;
const SPECTRUM_MIN = 5;
const SPECTRUM = ['var(--cyan)', 'var(--violet)', '#5f9dff', 'var(--heat)', 'var(--green)', '#e58bff', '#3a4260'];

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

function hex(value, width = 8) {
  return '0x' + Math.max(0, Math.round(value)).toString(16).toUpperCase().padStart(width, '0');
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

function hashName(name) {
  return [...String(name)].reduce((hash, char) => (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0, 7);
}

function sortedPosts(site) {
  return site && site.posts ? site.posts.sort('date', -1).toArray() : [];
}

// Every post keeps one address across pages: the oldest post sits lowest.
function addressMap(site) {
  const posts = sortedPosts(site);
  return new Map(posts.map((post, index) => [post._id, BASE_ADDRESS + (posts.length - index) * ADDRESS_STRIDE]));
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
      epithet: options.epithet || '',
      description: options.description || '',
      emblem: options.emblem || 'rose',
      path: category ? category.path : '',
      posts,
      tags: [...new Set(posts.flatMap(post => names(post.tags)))]
    };
  });
}

function realmMode(count) {
  if (count <= 1) return 'solo';
  return count === 2 ? 'pair' : 'track';
}

function renderHero(config, latest, total, urlFor) {
  const wordmark = (config.signal && config.signal.wordmark) || 'SILEN1';
  const latestLink = latest ? `
        <a class="signal-hero-latest" href="${escapeHtml(urlFor(latest.path))}">
          <span class="signal-hero-latest-meta">LATEST · ${escapeHtml(dotDate(latest.date))} · ${pad2(total)} ${total === 1 ? 'ENTRY' : 'ENTRIES'}</span>
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

function renderRealm(realm, index, total, urlFor) {
  const latest = realm.posts[0] ? dotDate(realm.posts[0].date) : '—';
  const enter = realm.path
    ? `<a class="signal-realm-enter" href="${escapeHtml(urlFor(realm.path))}">ENTER REALM →</a>`
    : '<span class="signal-realm-enter is-empty">AWAITING ENTRIES</span>';

  return `
      <article class="signal-realm" data-realm="${escapeHtml(realm.name)}">
        <div class="signal-realm-emblem">
          <canvas data-emblem="${escapeHtml(realm.emblem)}" data-seed="${hashName(realm.name)}" aria-hidden="true"></canvas>
        </div>
        <div class="signal-realm-info">
          <span class="signal-realm-index">REALM ${pad2(index + 1)} / ${pad2(total)}</span>
          <h3>${escapeHtml(realm.name)}</h3>
          ${realm.epithet ? `<p class="signal-realm-epithet">${escapeHtml(realm.epithet)}</p>` : ''}
          ${realm.description ? `<p class="signal-realm-desc">${escapeHtml(realm.description)}</p>` : ''}
          <dl>
            <dt>ENTRIES</dt><dd>${pad2(realm.posts.length)}</dd>
            <dt>LATEST</dt><dd>${escapeHtml(latest)}</dd>
            <dt>TAGS</dt><dd>${escapeHtml(realm.tags.slice(0, 5).join(' · ') || '—')}</dd>
          </dl>
          ${enter}
        </div>
      </article>`;
}

function renderRealms(realms, urlFor) {
  const total = realms.length;
  const count = total > 2 ? `01 / ${pad2(total)}` : `${pad2(total)} ${total === 1 ? 'REALM' : 'REALMS'}`;
  const cards = realms.map((realm, index) => renderRealm(realm, index, total, urlFor)).join('');

  return `
  <section class="signal-section signal-realms" id="realms" data-mode="${realmMode(total)}" data-count="${total}" aria-labelledby="realms-title">
    <div class="signal-realms-stage">
      <div class="signal-inner signal-head">
        <h2 class="signal-h2" id="realms-title">疆域<small>where the puzzles live</small></h2>
        <span class="signal-count" data-realm-index>${count}</span>
      </div>
      <div class="signal-realm-rail">
        <div class="signal-realm-grid">${cards || '<p class="signal-empty">疆域正在绘制中。</p>'}</div>
      </div>
    </div>
  </section>`;
}

function readingMinutes(post) {
  const countWords = hexo.extend.helper.get('post_word_count');
  const words = countWords ? countWords(post) : plainText(post.content).length;
  return Math.max(1, Math.ceil(words / 350));
}

function renderCodexRow(post, address, urlFor) {
  const realm = names(post.categories)[0] || '';
  const date = post.date && typeof post.date.toDate === 'function' ? post.date.toDate() : new Date(post.date);
  const summary = summaryFor(post);
  const categoryLink = toArray(post.categories)[0];

  return `
    <article class="signal-seg" data-realm="${escapeHtml(realm)}">
      <span class="signal-seg-addr">${hex(address)}</span>
      <time datetime="${Number.isNaN(date.getTime()) ? '' : date.toISOString()}">${escapeHtml(dotDate(post.date))}</time>
      <div class="signal-seg-main">
        <h3><a class="signal-seg-link" href="${escapeHtml(urlFor(post.path))}">${escapeHtml(post.title || '未命名文章')}</a></h3>
        ${summary ? `<p>${escapeHtml(summary)}</p>` : ''}
      </div>
      <div class="signal-seg-tags">
        ${categoryLink && categoryLink.path ? `<a class="signal-seg-realm" href="${escapeHtml(urlFor(categoryLink.path))}">${escapeHtml(realm)}</a>` : ''}
        ${toArray(post.tags).map(tag => `<a href="${escapeHtml(urlFor(tag.path))}">#${escapeHtml(tag.name)}</a>`).join(' ')}
      </div>
      <span class="signal-seg-size">${readingMinutes(post)} min</span>
    </article>`;
}

function stepCount(route) {
  return route.rows.reduce((sum, row) => sum + row.length, 0);
}

function renderRoutes(routes, urlFor) {
  const drawn = routes.some(route => stepCount(route) >= ROUTE_MIN);
  const tabs = !drawn ? '' : routes.length > 1
    ? `<div class="signal-chips" role="group" aria-label="选择系列" data-route-tabs>${routes.map((route, index) =>
      `<button class="signal-chip" type="button" aria-pressed="${index === 0}" data-route-index="${index}">${escapeHtml(route.name)}</button>`).join('')}</div>`
    : (routes[0] ? `<span class="signal-count">${escapeHtml(routes[0].name.toUpperCase())}</span>` : '');
  const hasPlanned = routes.some(route => route.rows.some(row => row.some(step => !step.url)));
  const learningPath = (hexo.config.learning_paths && hexo.config.learning_paths.path) || 'learning-paths/';
  const more = `<a class="signal-more" href="${escapeHtml(urlFor(learningPath))}">全部路线 →</a>`;
  const list = `
      <ol class="signal-route-list">${routes.map(route => `
        <li>
          <span class="signal-route-name">${escapeHtml(route.name)}</span>
          <span class="signal-route-steps">${route.rows.flat().map(step => step.url
            ? `<a href="${escapeHtml(step.url)}">${escapeHtml(step.title)}</a>`
            : `<span class="is-planned">${escapeHtml(step.title)}</span>`).join('<i aria-hidden="true">→</i>')}</span>
          <span class="signal-count">${pad2(stepCount(route))} ${stepCount(route) === 1 ? 'STEP' : 'STEPS'}</span>
        </li>`).join('')}
      </ol>
      <div class="signal-legend">${more}</div>`;

  return `
  <section class="signal-section signal-odyssey" id="odyssey" aria-labelledby="odyssey-title">
    <div class="signal-inner">
      <div class="signal-head">
        <h2 class="signal-h2" id="odyssey-title">远征<small>a route through the series</small></h2>
        ${tabs}
      </div>
      ${!routes.length ? '<p class="signal-empty">路线正在铺设中。</p>' : drawn ? `
      <div class="route-graph route-graph-home" data-routes="${escapeHtml(JSON.stringify(routes))}"></div>
      <div class="signal-legend">
        <span><i class="is-published"></i>Published</span>
        ${hasPlanned ? '<span><i class="is-planned"></i>Planned</span>' : ''}
        ${more}
      </div>` : list}
    </div>
  </section>`;
}

function renderAlmanac(site, realms, urlFor) {
  const blogStats = hexo.extend.helper.get('blog_stats');
  const stats = blogStats ? blogStats(site.posts) : { postCount: toArray(site.posts).length, words: 0 };
  const tagCounts = toArray(site.tags)
    .map(tag => ({ name: tag.name, path: tag.path, count: tag.length }))
    .filter(tag => tag.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'));
  const registers = [
    ['RAX', 'Entries', stats.postCount],
    ['RBX', 'Words', stats.words],
    ['RCX', 'Tags', tagCounts.length],
    ['RDX', 'Realms', realms.length]
  ];
  const spectrum = stats.postCount >= SPECTRUM_MIN ? tagCounts.slice(0, SPECTRUM.length) : [];
  const total = Math.max(1, stats.postCount);

  return `
  <section class="signal-section signal-almanac" id="almanac" aria-labelledby="almanac-title">
    <div class="signal-inner">
      <h2 class="signal-h2" id="almanac-title">年鉴<small>the blog, in numbers</small></h2>
      <div class="signal-registers">
        ${registers.map(([name, label, value]) => `
        <div class="signal-register">
          <span class="signal-register-name">${name}</span>
          <span class="signal-register-value" data-count-to="${value}">${Number(value).toLocaleString('en')}</span>
          <span class="signal-register-label">${label}</span>
          <span class="signal-register-hex">${hex(value)}</span>
        </div>`).join('')}
      </div>
      ${spectrum.length ? `
      <div class="signal-spectrum">
        <div class="signal-eyebrow">Tag spectrum · entries carrying each tag</div>
        <div class="signal-spectrum-bar">${spectrum.map((tag, index) =>
          `<a href="${escapeHtml(urlFor(tag.path))}" style="flex:${tag.count};--c:${SPECTRUM[index]}" title="${escapeHtml(tag.name)} ${tag.count}/${stats.postCount}" aria-label="${escapeHtml(tag.name)}"></a>`).join('')}</div>
        <div class="signal-spectrum-keys">${spectrum.map((tag, index) =>
          `<a href="${escapeHtml(urlFor(tag.path))}"><i style="--c:${SPECTRUM[index]}"></i>${escapeHtml(tag.name)} ${Math.round(tag.count / total * 100)}%</a>`).join('')}</div>
      </div>` : ''}
    </div>
  </section>`;
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
    return `<span class="signal-count">${pad2(entries)} ENTRIES · ${pad2(realms.length)} REALM${realms.length === 1 ? '' : 'S'}</span>`;
  }
  return `<div class="signal-chips" role="group" aria-label="按疆域筛选" data-realm-filters>
    <button class="signal-chip" type="button" aria-pressed="true" data-realm-filter="">All</button>
    ${realms.map(realm => `<button class="signal-chip" type="button" aria-pressed="false" data-realm-filter="${escapeHtml(realm.name)}">${escapeHtml(realm.name)}</button>`).join('')}
  </div>`;
});

hexo.extend.helper.register('signal_codex', function signalCodex(posts) {
  const urlFor = path => this.url_for(path);
  const addresses = addressMap(this.site);
  const rows = toArray(posts).map(post => renderCodexRow(post, addresses.get(post._id) || BASE_ADDRESS, urlFor));
  return `<div class="signal-seglist">${rows.join('') || '<p class="signal-empty">第一篇札记正在路上。</p>'}</div>`;
});

hexo.extend.helper.register('signal_home_outro', function signalHomeOutro() {
  const urlFor = path => this.url_for(path);
  const routesHelper = hexo.extend.helper.get('learning_path_routes');
  // The longest series opens first, so the home graph starts with the fullest route.
  const routes = (routesHelper ? routesHelper(this.site.posts) : []).sort((a, b) => stepCount(b) - stepCount(a));
  const realms = realmList(this.site, this.config);
  return renderRoutes(routes, urlFor) + renderRealms(realms, urlFor) + renderAlmanac(this.site, realms, urlFor);
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
