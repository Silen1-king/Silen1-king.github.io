/* global NexT */

(() => {
  'use strict';

  const languageAliases = {
    js: 'JAVASCRIPT',
    ts: 'TYPESCRIPT',
    py: 'PYTHON',
    sh: 'SHELL',
    plaintext: 'TEXT',
    text: 'TEXT'
  };

  function detectLanguage(...elements) {
    for (const element of elements) {
      if (!element) continue;
      for (const className of element.classList) {
        const match = className.match(/^(?:language|lang)-(.+)$/i);
        if (match) return languageAliases[match[1].toLowerCase()] || match[1].toUpperCase();
      }
    }

    const figure = elements.find(element => element && element.matches && element.matches('figure.highlight'));
    if (figure) {
      const language = [...figure.classList].find(className => className !== 'highlight');
      if (language) return languageAliases[language.toLowerCase()] || language.toUpperCase();
    }

    return 'TEXT';
  }

  function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    return copied;
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // Fall through for browsers that expose but deny Clipboard API.
      }
    }
    return fallbackCopy(text);
  }

  function addCopyButton(container, codeElement) {
    if (container.querySelector(':scope > .copy-btn')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'copy-btn post-copy-btn';
    button.title = '复制代码';
    button.setAttribute('aria-label', '复制代码');
    button.innerHTML = '<i class="fa fa-copy fa-fw" aria-hidden="true"></i>';

    button.addEventListener('click', async () => {
      const success = await copyText(codeElement.innerText || codeElement.textContent || '');
      const icon = button.querySelector('i');
      icon.className = success ? 'fa fa-check-circle fa-fw' : 'fa fa-times-circle fa-fw';
      button.title = success ? '已复制' : '复制失败';
      button.setAttribute('aria-label', button.title);

      window.setTimeout(() => {
        icon.className = 'fa fa-copy fa-fw';
        button.title = '复制代码';
        button.setAttribute('aria-label', '复制代码');
      }, 1600);
    });

    container.appendChild(button);
  }

  function addLanguageLabel(container, language) {
    let label = container.querySelector(':scope > .code-lang');
    if (!label) {
      label = document.createElement('div');
      label.className = 'code-lang';
      container.prepend(label);
    }
    label.textContent = language;
  }

  function enhanceFigure(figure) {
    if (figure.dataset.postCodeEnhanced === 'true') return;
    const container = figure.querySelector('.code-container') || figure;
    const code = figure.querySelector('.code') || figure.querySelector('code') || figure;
    const pre = figure.querySelector('pre');
    addLanguageLabel(container, detectLanguage(code, pre, figure));
    addCopyButton(container, code);
    figure.dataset.postCodeEnhanced = 'true';
  }

  function enhancePre(pre) {
    if (pre.closest('figure.highlight') || pre.querySelector('figure.highlight')) return;
    if (pre.dataset.postCodeEnhanced === 'true') return;

    const code = pre.querySelector(':scope > code') || pre;
    let container = pre.parentElement && pre.parentElement.classList.contains('code-container')
      ? pre.parentElement
      : null;

    if (!container) {
      container = document.createElement('div');
      container.className = 'code-container post-code-container notranslate';
      pre.before(container);
      container.appendChild(pre);
    }

    addLanguageLabel(container, detectLanguage(code, pre));
    addCopyButton(container, code);
    pre.dataset.postCodeEnhanced = 'true';
  }

  function enhanceCodeBlocks(root = document) {
    // NexT owns its generated figure.highlight blocks. Handling only plain
    // pre/Prism structures here prevents duplicate toolbars after DOMContentLoaded.
    root.querySelectorAll('.post-body pre').forEach(enhancePre);
  }

  let zoomOverlay = null;
  let zoomImage = null;
  let zoomCaption = null;
  let previousZoomFocus = null;

  function closeImageZoom() {
    if (!zoomOverlay || zoomOverlay.hidden) return;
    zoomOverlay.classList.remove('is-open');
    zoomOverlay.hidden = true;
    document.body.classList.remove('image-zoom-open');
    if (previousZoomFocus && typeof previousZoomFocus.focus === 'function') previousZoomFocus.focus();
  }

  function ensureZoomOverlay() {
    if (zoomOverlay) return;
    zoomOverlay = document.createElement('div');
    zoomOverlay.className = 'image-zoom-overlay';
    zoomOverlay.hidden = true;
    zoomOverlay.setAttribute('role', 'dialog');
    zoomOverlay.setAttribute('aria-modal', 'true');
    zoomOverlay.setAttribute('aria-label', '图片预览');
    zoomOverlay.innerHTML = `<button class="image-zoom-close" type="button" aria-label="关闭图片预览">×</button>
      <figure class="image-zoom-figure">
        <img alt="">
        <figcaption></figcaption>
      </figure>`;
    document.body.appendChild(zoomOverlay);
    zoomImage = zoomOverlay.querySelector('img');
    zoomCaption = zoomOverlay.querySelector('figcaption');
    zoomOverlay.querySelector('.image-zoom-close').addEventListener('click', closeImageZoom);
    zoomOverlay.addEventListener('click', event => {
      if (event.target === zoomOverlay) closeImageZoom();
    });
  }

  function openImageZoom(sourceImage) {
    ensureZoomOverlay();
    previousZoomFocus = document.activeElement;
    zoomImage.src = sourceImage.currentSrc || sourceImage.src;
    zoomImage.alt = sourceImage.alt || '';
    zoomCaption.textContent = sourceImage.alt || '';
    zoomCaption.hidden = !sourceImage.alt;
    zoomOverlay.hidden = false;
    document.body.classList.add('image-zoom-open');
    requestAnimationFrame(() => zoomOverlay.classList.add('is-open'));
    zoomOverlay.querySelector('.image-zoom-close').focus();
  }

  function enhanceImages(root = document) {
    root.querySelectorAll('.post-body img').forEach(img => {
      if (!img.hasAttribute('loading')) img.loading = 'lazy';
      if (!img.hasAttribute('decoding')) img.decoding = 'async';
      if (img.closest('a') || img.dataset.postImageEnhanced === 'true') return;

      img.classList.add('post-image-zoomable');
      img.tabIndex = 0;
      img.setAttribute('role', 'button');
      img.setAttribute('aria-label', img.alt ? `放大图片：${img.alt}` : '放大图片');
      img.addEventListener('click', () => openImageZoom(img));
      img.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openImageZoom(img);
        }
      });
      img.dataset.postImageEnhanced = 'true';
    });
  }

  // Code that runs past the right edge fades out there, as a hint that the
  // block scrolls sideways. NexT adds .table-container on DOMContentLoaded,
  // so this runs a frame later.
  function markClippedCode(root = document) {
    root.querySelectorAll('.post-body figure.highlight .table-container').forEach(box => {
      if (box.dataset.clipWatched === 'true') return;
      const update = () => box.classList.toggle('is-clipped', box.scrollWidth - box.clientWidth - box.scrollLeft > 1);
      update();
      box.addEventListener('scroll', update, { passive: true });
      if (window.ResizeObserver) new ResizeObserver(update).observe(box);
      box.dataset.clipWatched = 'true';
    });
  }

  // Same address: hovering an address or a name in code lights up every
  // place in the post's code that holds it, the way IDA marks a symbol
  // everywhere. Addresses compare by value, so 0000000000401186 (nm),
  // 401186 (objdump) and 0x401186 (exploit.py) light up together. It paints
  // with the CSS Custom Highlight API and leaves the code's DOM alone;
  // browsers without the API, and touch screens, get nothing.
  const WORD = /[A-Za-z0-9_]+/g;

  function wordKey(word) {
    if (/^0x[0-9a-f]+$/i.test(word)) return 'a' + BigInt(word).toString(16);
    // Bare hex as nm and objdump print it; needs a digit, so words like "deadbeef" stay names.
    if (/^[0-9a-f]{6,16}$/i.test(word) && /\d/.test(word)) return 'a' + BigInt('0x' + word).toString(16);
    if (/^[A-Za-z_]\w+$/.test(word)) return 's' + word;
    return '';
  }

  function caretAt(x, y) {
    if (document.caretPositionFromPoint) {
      const position = document.caretPositionFromPoint(x, y);
      return position && { node: position.offsetNode, offset: position.offset };
    }
    if (document.caretRangeFromPoint) {
      const range = document.caretRangeFromPoint(x, y);
      return range && { node: range.startContainer, offset: range.startOffset };
    }
    return null;
  }

  function rangeOf(node, start, end) {
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, end);
    return range;
  }

  function watchSameAddress(root = document) {
    const body = root.querySelector('.post-body');
    if (!body || body.dataset.sameAddress === 'true') return;
    if (!window.CSS || !CSS.highlights || typeof Highlight !== 'function') return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    body.dataset.sameAddress = 'true';

    let places = null; // key -> [{ node, start, end }]
    let words = null; // text node -> [{ start, end, key }]
    let current = null;
    let frame = 0;
    let x = 0;
    let y = 0;

    // Built on first use, after NexT has finished wrapping the code blocks.
    function index() {
      places = new Map();
      words = new Map();
      const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, {
        acceptNode: node => node.parentElement.closest('pre, code') && !node.parentElement.closest('.gutter')
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT
      });
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const list = [];
        for (const match of node.nodeValue.matchAll(WORD)) {
          const key = wordKey(match[0]);
          if (!key) continue;
          const word = { start: match.index, end: match.index + match[0].length, key };
          list.push(word);
          if (!places.has(key)) places.set(key, []);
          places.get(key).push({ node, start: word.start, end: word.end });
        }
        if (list.length) words.set(node, list);
      }
    }

    function show(word) {
      if (!word && !current) return;
      if (word && current && word.node === current.node && word.start === current.start) return;
      current = word;
      if (!word) {
        CSS.highlights.delete('signal-same');
        CSS.highlights.delete('signal-here');
        return;
      }
      CSS.highlights.set('signal-same', new Highlight(...places.get(word.key).map(place => rangeOf(place.node, place.start, place.end))));
      const here = new Highlight(rangeOf(word.node, word.start, word.end));
      here.priority = 1;
      CSS.highlights.set('signal-here', here);
    }

    function update() {
      frame = 0;
      if (!places) index();
      const caret = caretAt(x, y);
      const list = caret && words.get(caret.node);
      // The caret lands between characters, so check the word's box really holds the pointer.
      const word = list && list.find(item => item.start <= caret.offset && caret.offset <= item.end
        && [...rangeOf(caret.node, item.start, item.end).getClientRects()].some(box =>
          x >= box.left - 1 && x <= box.right + 1 && y >= box.top - 1 && y <= box.bottom + 1));
      show(word ? { node: caret.node, ...word } : null);
    }

    body.addEventListener('pointermove', event => {
      if (event.pointerType !== 'mouse' || event.buttons) return;
      if (!event.target.closest('pre, code')) {
        cancelAnimationFrame(frame);
        frame = 0;
        show(null);
        return;
      }
      x = event.clientX;
      y = event.clientY;
      if (!frame) frame = requestAnimationFrame(update);
    }, { passive: true });
    body.addEventListener('pointerleave', () => {
      cancelAnimationFrame(frame);
      frame = 0;
      show(null);
    });
  }

  function enhancePost(root = document) {
    enhanceCodeBlocks(root);
    enhanceImages(root);
    watchSameAddress(root);
    requestAnimationFrame(() => markClippedCode(root));
  }

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && zoomOverlay && !zoomOverlay.hidden) closeImageZoom();
  });
  document.addEventListener('DOMContentLoaded', () => enhancePost());
  document.addEventListener('pjax:success', () => enhancePost());
})();
