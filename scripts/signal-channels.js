'use strict';

/**
 * The four menu pages as one set: 札记, 远征, 疆域, 漫游 are four districts of
 * the rainy city in the backdrop. Each page keeps the same head (Chinese
 * title, English italic subtitle) and adds:
 *
 *   - a district tag  DISTRICT 01 · ARCHIVE ROW,  with the title lit as a
 *     neon tube in the district's colour (--ch-1 … --ch-4);
 *   - a metro line at the end, LINE 0, the four pages as stops, this one lit.
 *
 * Helpers:
 *   signal_channel(page)       'log' | 'route' | 'map' | 'drift' | ''
 *   signal_channel_head(key)   the district tag, placed inside the page head
 *   signal_channel_next(key)   the metro line
 *   signal_realm_map()         the 疆域 body: a memory map of the realms
 */

const CHANNELS = [
  { key: 'log', code: 'ARCHIVE ROW', title: '札记', subtitle: 'every entry, by date', path: 'archives/' },
  { key: 'route', code: 'TRANSIT HUB', title: '远征', subtitle: 'a route through the series', path: 'learning-paths/' },
  { key: 'map', code: 'THE WARDS', title: '疆域', subtitle: 'where the puzzles live', path: 'categories/' },
  { key: 'drift', code: 'OUTSKIRTS', title: '漫游', subtitle: 'off the map', path: 'wander/' }
];

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

const hex = (n, width = 4) => `0x${n.toString(16).toUpperCase().padStart(width, '0')}`;

/* ───── realms (疆域) ───── */

function realmList(site, config) {
  const settings = config.realms && typeof config.realms === 'object' ? config.realms : {};
  const categories = toArray(site && site.categories).filter(category => !category.parent);
  return categories.map(category => {
    const options = settings[category.name] || {};
    return {
      name: category.name,
      path: category.path,
      count: category.length || toArray(category.posts).length,
      epithet: options.epithet || '',
      description: options.description || ''
    };
  }).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function renderRealmMap(site, config, urlFor) {
  const realms = realmList(site, config).filter(realm => realm.count);
  if (!realms.length) return '<p class="realm-map-empty">还没有分类。</p>';
  const total = realms.reduce((sum, realm) => sum + realm.count, 0);
  const max = realms[0].count;
  let base = 0;

  const bar = realms.map((realm, i) => `<span class="realm-map-seg" data-seg="${i % 2}" style="flex: ${realm.count} 1 0" title="${escapeHtml(realm.name)}"><i>${escapeHtml(realm.name)}</i></span>`).join('');
  const rows = realms.map(realm => {
    const start = base;
    base += realm.count;
    const fill = Math.max(Math.round(realm.count / max * 100), 6);
    return `<li>
      <a class="realm-map-row" href="${escapeHtml(urlFor(realm.path))}">
        <span class="realm-map-range" aria-hidden="true">${hex(start)}<b>–</b>${hex(base - 1)}</span>
        <span class="realm-map-body">
          <span class="realm-map-name">${escapeHtml(realm.name)}</span>
          ${realm.epithet ? `<span class="realm-map-epithet">${escapeHtml(realm.epithet)}</span>` : ''}
          ${realm.description ? `<span class="realm-map-desc">${escapeHtml(realm.description)}</span>` : ''}
        </span>
        <span class="realm-map-size">
          <span class="realm-map-meter" aria-hidden="true"><span style="width: ${fill}%"></span></span>
          <span class="realm-map-count">${realm.count}<small>${realm.count === 1 ? 'ENTRY' : 'ENTRIES'}</small></span>
        </span>
      </a>
    </li>`;
  }).join('');

  return `<div class="realm-map">
    <div class="realm-map-space" aria-hidden="true">
      <div class="realm-map-axis"><span>${hex(0)}</span><span>ADDRESS SPACE · ${realms.length} REALMS · ${total} ENTRIES</span><span>${hex(total - 1)}</span></div>
      <div class="realm-map-bar">${bar}</div>
    </div>
    <ol class="realm-map-list">${rows}</ol>
  </div>`;
}

/* ───── helpers ───── */

hexo.extend.helper.register('signal_channel', function signalChannel(page) {
  if (!page) return '';
  if (page.type === 'learning-paths') return 'route';
  if (page.type === 'categories') return 'map';
  if (page.type === 'wander') return 'drift';
  if (page.archive && !page.year && !page.month) return 'log';
  return '';
});

hexo.extend.helper.register('signal_channel_head', function signalChannelHead(key) {
  const index = CHANNELS.findIndex(channel => channel.key === key);
  if (index < 0) return '';
  const channel = CHANNELS[index];
  return `<div class="signal-district" data-ch="${key}" aria-hidden="true">
    <span class="signal-district-tag">DISTRICT ${String(index + 1).padStart(2, '0')} · ${channel.code}</span>
  </div>`;
});

// The four pages as stations on one metro line; this page is the lit stop.
hexo.extend.helper.register('signal_channel_next', function signalChannelNext(key) {
  const index = CHANNELS.findIndex(channel => channel.key === key);
  if (index < 0) return '';
  const root = String(this.config.root || '/').replace(/\/?$/, '/');
  const next = CHANNELS[(index + 1) % CHANNELS.length];
  const stops = CHANNELS.map((channel, i) => {
    const here = i === index;
    return `<li data-ch="${channel.key}"${here ? ' class="is-here"' : ''}>
      <a href="${escapeHtml(root + channel.path)}"${here ? ' aria-current="page"' : ''}>
        <i aria-hidden="true"></i>
        <b>${escapeHtml(channel.title)}</b>
        <small aria-hidden="true">${here ? 'YOU ARE HERE' : channel.code}</small>
      </a>
    </li>`;
  }).join('');
  return `<nav class="signal-metro" aria-label="四个页面">
    <div class="signal-metro-head" aria-hidden="true"><span>LINE 0 · 城市环线</span><span data-ch="${next.key}">NEXT STOP → ${escapeHtml(next.title)}</span></div>
    <ol>${stops}</ol>
  </nav>`;
});

hexo.extend.helper.register('signal_realm_map', function signalRealmMap() {
  return renderRealmMap(this.site, this.config, path => this.url_for(path));
});

module.exports = { CHANNELS, renderRealmMap };
