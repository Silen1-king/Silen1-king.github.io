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
    root.querySelectorAll('.post-body figure.highlight').forEach(enhanceFigure);
    root.querySelectorAll('.post-body pre').forEach(enhancePre);
  }

  document.addEventListener('DOMContentLoaded', () => enhanceCodeBlocks());
  document.addEventListener('pjax:success', () => enhanceCodeBlocks());
})();
