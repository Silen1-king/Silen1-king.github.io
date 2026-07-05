/* global CONFIG, LocalSearch */

document.addEventListener('DOMContentLoaded', () => {
  if (!CONFIG.path) {
    console.warn('`hexo-generator-searchdb` plugin is not installed!');
    return;
  }

  const localSearch = new LocalSearch({
    path             : CONFIG.path,
    top_n_per_article: 1,
    unescape         : false
  });

  const searchInput = document.querySelector('.instant-search-input');
  const resultsContainer = document.querySelector('.instant-search-results');
  const resultsList = document.querySelector('.instant-search-results-list');

  if (!searchInput || !resultsContainer || !resultsList) {
    console.warn('Instant search elements not found!');
    return;
  }

  let searchTimeout = null;

  // 即时搜索函数
  const performSearch = () => {
    const searchText = searchInput.value.trim().toLowerCase();

    if (!searchText || searchText.length < 1) {
      resultsContainer.style.display = 'none';
      return;
    }

    if (!localSearch.isfetched) {
      resultsContainer.style.display = 'block';
      resultsList.innerHTML = '<li class="instant-search-no-results"><i class="fa fa-spinner fa-pulse"></i> 加载中...</li>';
      localSearch.fetchData();
      return;
    }

    const keywords = searchText.split(/[-\s]+/);
    const resultItems = localSearch.getResultItems(keywords);

    if (resultItems.length === 0) {
      resultsContainer.style.display = 'block';
      resultsList.innerHTML = '<li class="instant-search-no-results"><i class="far fa-frown"></i> 没有找到相关文章</li>';
      return;
    }

    // 按匹配度排序
    resultItems.sort((left, right) => {
      if (left.includedCount !== right.includedCount) {
        return right.includedCount - left.includedCount;
      } else if (left.hitCount !== right.hitCount) {
        return right.hitCount - left.hitCount;
      }
      return right.id - left.id;
    });

    // 限制显示结果数量
    const maxResults = 10;
    const displayResults = resultItems.slice(0, maxResults);

    // 生成结果HTML
    resultsList.innerHTML = displayResults.map(result => {
      // 从原始结果项中提取标题和URL
      const linkMatch = result.item.match(/<a href="([^"]+)" class="search-result-title">([^<]+)<\/a>/);
      if (!linkMatch) return '';

      const url = linkMatch[1];
      const title = linkMatch[2];

      // 提取内容摘要
      const contentMatch = result.item.match(/<p class="search-result">([^<]+)<\/p>/);
      const content = contentMatch ? contentMatch[1] : '';

      return `<li>
        <a href="${url}" class="search-result-title">${title}</a>
        <a href="${url}"><p class="search-result">${content}</p></a>
      </li>`;
    }).join('');

    resultsContainer.style.display = 'block';
  };

  // 输入事件监听（带防抖）
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(performSearch, 300);
  });

  // 获得焦点时如果有内容则显示结果
  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim()) {
      performSearch();
    }
  });

  // 点击外部关闭结果列表
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.instant-search-container')) {
      resultsContainer.style.display = 'none';
    }
  });

  // ESC键关闭结果列表
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      resultsContainer.style.display = 'none';
      searchInput.blur();
    }
  });

  // 搜索数据加载完成后重新搜索
  window.addEventListener('search:loaded', performSearch);

  // 预加载搜索数据
  if (CONFIG.localsearch.preload) {
    localSearch.fetchData();
  }
});