// Reading the blog in the reader's own language. Shown only when the
// device's languages don't include Chinese (or with ?translate=<lang> to
// try it). Uses the browser's built-in, on-device translator (Chrome's
// Translator API), so nothing is sent anywhere. When the language model is
// already on the device the page is translated by itself; otherwise the EN
// button downloads it once. The choice is remembered in this browser, and
// the button switches back to the Chinese original.
//
// Browsers without the API keep their own page translation; the button
// then says where to find it. Code, addresses and counters are marked
// translate="no" here either way.
(function() {
  'use strict';

  // Code, addresses and live numbers stay as they are under any
  // translator, the browser's own one included.
  document.querySelectorAll('pre, code, kbd, .highlight, .signal-rip, .signal-seg-addr, [data-count-to], [id^="vercount_value_"], .footer-uptime')
    .forEach(element => element.setAttribute('translate', 'no'));

  const button = document.querySelector('[data-signal-translate]');
  const label = document.querySelector('[data-signal-translate-label]');
  if (!button) return;

  const forced = new URLSearchParams(window.location.search).get('translate');
  const languages = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''];
  if (!forced && languages.some(language => /^zh\b/i.test(language))) return;
  const target = (forced || languages[0] || 'en').split('-')[0].toLowerCase();
  if (!target || target === 'zh') return;

  const KEY = 'silen1:translate';
  const CODE = target.toUpperCase();
  const api = window.Translator;
  const originals = new Map();
  const root = document.documentElement;
  let translator = null;
  let translated = false;
  let busy = false;

  button.hidden = false;
  button.setAttribute('translate', 'no');
  label.textContent = CODE;
  button.title = `Read in ${new Intl.DisplayNames(['en'], { type: 'language' }).of(target) || CODE}`;

  function pref(value) {
    try {
      if (value === undefined) return window.localStorage.getItem(KEY);
      window.localStorage.setItem(KEY, value);
    } catch (error) {
      return null;
    }
    return null;
  }

  // Blocks translated as a whole, so a sentence keeps its sense. A block
  // that holds links or images is translated a text node at a time instead,
  // so the links keep working.
  const BLOCKS = 'h1, h2, h3, h4, p, li, td, th, dt, dd, figcaption, blockquote, .signal-seg-link, .signal-hero-latest-title, .signal-realm-desc, .post-meta-item-text';
  const SKIP = 'pre, code, kbd, script, style, svg, .highlight, [translate="no"], [aria-hidden="true"], .signal-cursor, [data-signal-translate]';
  const CJK = /[㐀-鿿]/;

  function units() {
    const scope = [...document.querySelectorAll('.header, .main, .footer')];
    const list = [];
    const seen = new Set();
    scope.forEach(area => area.querySelectorAll(BLOCKS).forEach(block => {
      if (block.closest(SKIP) || [...seen].some(done => done.contains(block))) return;
      if (!CJK.test(block.textContent)) return;
      const plain = !block.matches('li') && !block.querySelector('a, img, input, button, svg, [aria-hidden="true"], ' + BLOCKS);
      if (plain || block.matches('.signal-seg-link')) {
        seen.add(block);
        list.push({ node: block, whole: true, text: block.textContent.trim() });
      }
    }));
    // Everything else that is Chinese, a text node at a time.
    scope.forEach(area => {
      const walker = document.createTreeWalker(area, NodeFilter.SHOW_TEXT, {
        acceptNode: node => {
          if (!CJK.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
          const parent = node.parentElement;
          if (!parent || parent.closest(SKIP)) return NodeFilter.FILTER_REJECT;
          if ([...seen].some(block => block.contains(node))) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        list.push({ node, whole: false, text: node.nodeValue.trim() });
      }
    });
    return list;
  }

  async function translatePage() {
    const list = units();
    for (const unit of list) {
      if (!translated) return;
      if (!unit.text) continue;
      let output;
      try {
        output = await translator.translate(unit.text);
      } catch (error) {
        continue;
      }
      if (unit.whole) {
        originals.set(unit.node, unit.node.innerHTML);
        unit.node.textContent = output;
      } else {
        originals.set(unit.node, unit.node.nodeValue);
        const value = unit.node.nodeValue;
        unit.node.nodeValue = value.match(/^\s*/)[0] + output + value.match(/\s*$/)[0];
      }
    }
  }

  function restore() {
    originals.forEach((value, node) => {
      if (node.nodeType === Node.TEXT_NODE) node.nodeValue = value;
      else node.innerHTML = value;
    });
    originals.clear();
  }

  function show(state) {
    translated = state;
    button.setAttribute('aria-pressed', String(state));
    label.textContent = state ? '中' : CODE;
    root.lang = state ? target : 'zh-CN';
    root.classList.toggle('signal-translated', state);
  }

  async function turnOn(fromClick) {
    if (busy) return;
    busy = true;
    try {
      if (!translator) {
        label.textContent = '…';
        translator = await api.create({
          sourceLanguage: 'zh',
          targetLanguage: target,
          monitor(monitor) {
            monitor.addEventListener('downloadprogress', event => {
              label.textContent = `${Math.round(event.loaded * 100)}%`;
            });
          }
        });
      }
      show(true);
      await translatePage();
      pref('on');
    } catch (error) {
      show(false);
      if (fromClick) hint();
    }
    busy = false;
  }

  function turnOff() {
    show(false);
    restore();
    pref('off');
  }

  // No built-in translator here: point to the browser's own page translation.
  function hint() {
    const ua = navigator.userAgent;
    const where = /Firefox\//.test(ua)
      ? 'Firefox: click the translation icon in the address bar.'
      : /Safari\//.test(ua) && !/Chrome\//.test(ua)
        ? 'Safari: tap aA (or the translate icon) in the address bar, then Translate.'
        : 'Chrome or Edge: right-click the page and choose Translate.';
    window.alert(`This page is written in Chinese.\n${where}`);
  }

  button.addEventListener('click', () => {
    if (!api) {
      hint();
      return;
    }
    if (translated) turnOff();
    else turnOn(true);
  });

  // Translate straight away when the model is already here and the reader
  // hasn't switched back to Chinese before.
  if (api && pref() !== 'off') {
    api.availability({ sourceLanguage: 'zh', targetLanguage: target }).then(state => {
      if (state === 'available') turnOn(false);
      else if (state === 'unavailable') button.hidden = true;
    }).catch(() => {});
  }
})();
