'use strict';

/**
 * 疆域 (/categories/): every category as one quiet row — name, English
 * epithet, one-line description, and how many entries it holds.
 *
 * Helper:
 *   signal_realm_map()   the 疆域 body
 */

const { renderTrail } = require('./signal-books');

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

function realmList(site, config) {
  const settings = config.realms && typeof config.realms === 'object' ? config.realms : {};
  const categories = toArray(site && site.categories).filter(category => !category.parent);
  return categories.map(category => {
    const options = settings[category.name] || {};
    return {
      name: category.name,
      path: category.path,
      count: category.length || toArray(category.posts).length,
      trail: renderTrail(category.posts),
      epithet: options.epithet || '',
      description: options.description || ''
    };
  }).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function renderRealmMap(site, config, urlFor) {
  const realms = realmList(site, config).filter(realm => realm.count);
  if (!realms.length) return '<p class="realm-map-empty">还没有分类。</p>';

  const rows = realms.map(realm => `<li>
      <a class="realm-map-row" href="${escapeHtml(urlFor(realm.path))}">
        <span class="realm-map-body">
          <span class="realm-map-name">${escapeHtml(realm.name)}</span>
          ${realm.epithet ? `<span class="realm-map-epithet">${escapeHtml(realm.epithet)}</span>` : ''}
          ${realm.description ? `<span class="realm-map-desc">${escapeHtml(realm.description)}</span>` : ''}
          ${realm.trail}
        </span>
        <span class="realm-map-count">${realm.count}<small>${realm.trail ? (realm.count === 1 ? 'book' : 'books') : (realm.count === 1 ? 'entry' : 'entries')}</small></span>
      </a>
    </li>`).join('');

  return `<div class="realm-map"><ol class="realm-map-list">${rows}</ol></div>`;
}

hexo.extend.helper.register('signal_realm_map', function signalRealmMap() {
  return renderRealmMap(this.site, this.config, path => this.url_for(path));
});

module.exports = { renderRealmMap };
