'use strict';

/**
 * Hexo generators for the two link pages:
 *
 *   /friends/ (友链) from source/_data/friends.yml: friends' blogs.
 *   /wander/  (漫游) from source/_data/wander.yml: sites outside my own field,
 *             kept for curiosity, one standalone link each.
 *
 * /friends/:
 * Each friend is { name, url, description?, avatar? }. Avatars must be files
 * on this site (source/images/friends/): the CSP only loads images from
 * 'self', so a friend without one gets the first letter of their name.
 * The page ends with this site's own details, ready to copy for a link swap.
 */

const FRIENDS = {
  path: 'friends/index.html',
  title: '友链',
  subtitle: 'other signals',
  description: '朋友们的博客。'
};

const WANDER = {
  path: 'wander/index.html',
  title: '漫游',
  subtitle: 'off the map',
  description: '专业以外的地方，凭兴趣逛逛。'
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function site(entry, label) {
  const name = String(entry && entry.name || '').trim();
  let url;
  try { url = new URL(String(entry && entry.url || '').trim()); } catch { url = null; }
  if (!name || !url || !['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`${label} 需要 name 和 http(s) 开头的 url`);
  }
  return {
    name,
    url: url.href,
    host: url.host.replace(/^www\./, ''),
    description: String(entry.description || '').trim()
  };
}

function friendList(data) {
  const list = Array.isArray(data) ? data : [];
  return list.map((friend, index) => {
    const { name, url, host, description } = site(friend, `friends.yml 第 ${index + 1} 项`);
    const avatar = String(friend.avatar || '').trim();
    if (avatar && !avatar.startsWith('/')) {
      throw new Error(`friends.yml「${name}」的 avatar 要放在站内，例如 /images/friends/xxx.png`);
    }
    return { name, url, host, description, avatar };
  });
}

function renderFriend(friend, index, root) {
  const loc = `0x${(index + 1).toString(16).toUpperCase().padStart(2, '0')}`;
  const avatar = friend.avatar
    ? `<img class="friend-avatar" src="${escapeHtml(root + friend.avatar.replace(/^\//, ''))}" alt="" loading="lazy" width="52" height="52">`
    : `<span class="friend-avatar friend-avatar-letter" aria-hidden="true">${escapeHtml(Array.from(friend.name)[0].toUpperCase())}</span>`;
  return `<li><a class="friend-card" href="${escapeHtml(friend.url)}" target="_blank" rel="noopener friend">
  ${avatar}
  <span class="friend-body">
    <span class="friend-name">${escapeHtml(friend.name)}</span>
    <span class="friend-host">${escapeHtml(friend.host)}</span>
    ${friend.description ? `<span class="friend-description">${escapeHtml(friend.description)}</span>` : ''}
  </span>
  <span class="friend-loc" aria-hidden="true">${loc}</span>
</a></li>`;
}

function renderFriends(friends, config) {
  const root = config.root || '/';
  const list = friends.length
    ? `<ul class="friend-grid">${friends.map((friend, index) => renderFriend(friend, index, root)).join('\n')}</ul>`
    : '<p class="friends-empty">还没有友链。</p>';
  const self = [
    ['name', config.title],
    ['url', `${config.url.replace(/\/?$/, '/')}`],
    ['description', config.description]
  ];
  return `${list}
<section class="friends-self">
  <h2>交换友链<small>swap signals</small></h2>
  <p>想互换友链的话，把下面这几行加到你的友链里，再把你的博客告诉我。</p>
  <dl class="friends-self-card">
${self.map(([key, value]) => `    <dt>${key}</dt><dd>${escapeHtml(value)}</dd>`).join('\n')}
  </dl>
</section>`;
}

function wanderSites(data) {
  const list = Array.isArray(data) ? data : [];
  return list.map((entry, index) => site(entry, `wander.yml 第 ${index + 1} 个网站`));
}

function renderWander(sites) {
  if (!sites.length) return '<p class="friends-empty">还没有收藏。</p>';
  return `<ul class="wander-list">
${sites.map(entry => `  <li><a class="wander-site" href="${escapeHtml(entry.url)}" target="_blank" rel="noopener">
    <span class="wander-name">${escapeHtml(entry.name)}</span>
    <span class="wander-host">${escapeHtml(entry.host)}</span>
    ${entry.description ? `<span class="wander-description">${escapeHtml(entry.description)}</span>` : ''}
  </a></li>`).join('\n')}
</ul>`;
}

function page(meta, type, content) {
  return {
    path: meta.path,
    layout: 'page',
    data: {
      title: meta.title,
      subtitle: meta.subtitle,
      description: meta.description,
      type,
      comments: false,
      content,
      toc: { enable: false }
    }
  };
}

hexo.extend.generator.register('friends', function generateFriends(locals) {
  const friends = friendList(locals.data && locals.data.friends);
  return page(FRIENDS, 'friends', renderFriends(friends, hexo.config));
});

hexo.extend.generator.register('wander', function generateWander(locals) {
  const sites = wanderSites(locals.data && locals.data.wander);
  return page(WANDER, 'wander', renderWander(sites));
});
