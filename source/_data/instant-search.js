/* global CONFIG */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const trigger = document.querySelector('.global-search-trigger');
  const modal = document.querySelector('.global-search-modal');
  const input = modal && modal.querySelector('.global-search-input');
  const status = modal && modal.querySelector('.global-search-status');
  const results = modal && modal.querySelector('.global-search-results');
  if (!trigger || !modal || !input || !status || !results) return;

  document.body.appendChild(modal);

  const shortcut = trigger.querySelector('kbd');
  if (shortcut && /Mac|iPhone|iPad/i.test(navigator.platform)) shortcut.textContent = '⌘ K';

  let searchIndex = [];
  let indexPromise = null;
  let activeIndex = -1;
  let previousFocus = null;
  let debounceTimer = null;

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function decodeHtml(value) {
    const element = document.createElement('div');
    element.innerHTML = String(value ?? '');
    return (element.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function normalizeList(value) {
    const list = Array.isArray(value) ? value : (value ? [value] : []);
    return list.map(item => decodeHtml(item)).filter(Boolean);
  }

  function normalizeRecord(record) {
    const title = decodeHtml(record.title || '未命名文章');
    const tags = normalizeList(record.tags);
    const categories = normalizeList(record.categories);
    const content = decodeHtml(record.content);
    return {
      title,
      tags,
      categories,
      content,
      url: record.url || '#',
      normalized: {
        title: title.toLocaleLowerCase('zh-CN'),
        tags: tags.join(' ').toLocaleLowerCase('zh-CN'),
        categories: categories.join(' ').toLocaleLowerCase('zh-CN'),
        content: content.toLocaleLowerCase('zh-CN')
      }
    };
  }

  function loadIndex() {
    if (indexPromise) return indexPromise;
    if (!CONFIG.path) {
      indexPromise = Promise.reject(new Error('未配置本地搜索索引'));
      return indexPromise;
    }

    indexPromise = fetch(CONFIG.path)
      .then(response => {
        if (!response.ok) throw new Error(`搜索索引加载失败（${response.status}）`);
        return response.json();
      })
      .then(data => {
        searchIndex = (Array.isArray(data) ? data : []).map(normalizeRecord);
        return searchIndex;
      });
    return indexPromise;
  }

  function tokenized(query) {
    return [...new Set(query
      .trim()
      .toLocaleLowerCase('zh-CN')
      .split(/[\s\-_/]+/)
      .filter(Boolean))];
  }

  function occurrenceCount(text, keyword) {
    let count = 0;
    let position = 0;
    while ((position = text.indexOf(keyword, position)) !== -1) {
      count += 1;
      position += Math.max(keyword.length, 1);
    }
    return count;
  }

  function scoreRecord(record, keywords) {
    let score = 0;
    for (const keyword of keywords) {
      const titleHits = occurrenceCount(record.normalized.title, keyword);
      const tagHits = occurrenceCount(record.normalized.tags, keyword);
      const categoryHits = occurrenceCount(record.normalized.categories, keyword);
      const contentHits = occurrenceCount(record.normalized.content, keyword);
      if (titleHits + tagHits + categoryHits + contentHits === 0) return 0;
      score += titleHits * 12 + tagHits * 8 + categoryHits * 6 + Math.min(contentHits, 8);
    }
    return score;
  }

  function regexEscape(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function highlight(text, keywords) {
    if (!text || keywords.length === 0) return escapeHtml(text);
    const pattern = new RegExp(`(${keywords.map(regexEscape).sort((a, b) => b.length - a.length).join('|')})`, 'gi');
    return String(text).split(pattern).map((part, index) =>
      index % 2 ? `<mark>${escapeHtml(part)}</mark>` : escapeHtml(part)
    ).join('');
  }

  function snippetFor(record, keywords) {
    const lowerContent = record.normalized.content;
    const positions = keywords.map(keyword => lowerContent.indexOf(keyword)).filter(index => index >= 0);
    if (positions.length === 0) return record.content.slice(0, 210);
    const matchAt = Math.min(...positions);
    const start = Math.max(0, matchAt - 70);
    const end = Math.min(record.content.length, start + 230);
    return `${start > 0 ? '…' : ''}${record.content.slice(start, end)}${end < record.content.length ? '…' : ''}`;
  }

  function resultMarkup(record, keywords) {
    const metadata = [
      ...record.tags.slice(0, 3).map(tag => ({ type: '标签', value: tag })),
      ...record.categories.slice(0, 2).map(category => ({ type: '分类', value: category }))
    ];
    return `<li class="global-search-result" role="option">
      <a class="global-search-result-link" href="${escapeHtml(record.url)}">
        <h3>${highlight(record.title, keywords)}</h3>
        ${metadata.length ? `<div class="global-search-result-meta">${metadata.map(item =>
          `<span><small>${item.type}</small>${highlight(item.value, keywords)}</span>`
        ).join('')}</div>` : ''}
        <p>${highlight(snippetFor(record, keywords), keywords)}</p>
        <i class="fa fa-arrow-right" aria-hidden="true"></i>
      </a>
    </li>`;
  }

  function setActiveResult(index) {
    const links = [...results.querySelectorAll('.global-search-result-link')];
    if (links.length === 0) {
      activeIndex = -1;
      return;
    }
    activeIndex = (index + links.length) % links.length;
    links.forEach((link, linkIndex) => {
      const active = linkIndex === activeIndex;
      link.parentElement.classList.toggle('is-active', active);
      link.parentElement.setAttribute('aria-selected', String(active));
      if (active) link.scrollIntoView({ block: 'nearest' });
    });
  }

  function renderSearch() {
    const keywords = tokenized(input.value);
    activeIndex = -1;
    if (keywords.length === 0) {
      status.textContent = `已索引 ${searchIndex.length} 篇文章，请输入关键词`;
      results.innerHTML = '<li class="global-search-empty"><i class="fa fa-keyboard" aria-hidden="true"></i><p>可搜索文章标题、标签、分类和全部正文</p></li>';
      return;
    }

    const matched = searchIndex
      .map(record => ({ record, score: scoreRecord(record, keywords) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || a.record.title.localeCompare(b.record.title, 'zh-CN'))
      .slice(0, 20);

    status.textContent = `找到 ${matched.length} 篇匹配文章`;
    if (matched.length === 0) {
      results.innerHTML = `<li class="global-search-empty"><i class="far fa-frown" aria-hidden="true"></i><p>没有找到“${escapeHtml(input.value.trim())}”</p></li>`;
      return;
    }
    results.innerHTML = matched.map(item => resultMarkup(item.record, keywords)).join('');
    setActiveResult(0);
  }

  async function ensureIndexAndRender() {
    if (searchIndex.length > 0) {
      renderSearch();
      return;
    }
    status.textContent = '正在加载本地搜索索引…';
    results.innerHTML = '<li class="global-search-empty"><i class="fa fa-spinner fa-pulse" aria-hidden="true"></i></li>';
    try {
      await loadIndex();
      renderSearch();
    } catch (error) {
      status.textContent = '搜索暂不可用';
      results.innerHTML = `<li class="global-search-empty"><p>${escapeHtml(error.message)}</p></li>`;
    }
  }

  function isOpen() {
    return !modal.hidden;
  }

  function openSearch() {
    if (!isOpen()) {
      previousFocus = document.activeElement;
      modal.hidden = false;
      modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('global-search-open');
      requestAnimationFrame(() => modal.classList.add('is-open'));
    }
    input.focus();
    input.select();
    ensureIndexAndRender();
  }

  function closeSearch() {
    if (!isOpen()) return;
    modal.classList.remove('is-open');
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('global-search-open');
    if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
  }

  trigger.addEventListener('click', openSearch);
  modal.querySelectorAll('[data-search-close]').forEach(element => element.addEventListener('click', closeSearch));
  input.addEventListener('input', () => {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(ensureIndexAndRender, 100);
  });
  results.addEventListener('click', event => {
    if (event.target.closest('.global-search-result-link')) closeSearch();
  });

  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'k') {
      event.preventDefault();
      openSearch();
      return;
    }
    if (!isOpen()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSearch();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveResult(activeIndex + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveResult(activeIndex - 1);
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      const activeLink = results.querySelectorAll('.global-search-result-link')[activeIndex];
      if (activeLink) activeLink.click();
    }
  });

  if (CONFIG.localsearch && CONFIG.localsearch.preload) loadIndex().catch(() => {});
});
