'use strict';

/**
 * Chinese titles break between words, never inside one. The title text is
 * split into words (Intl.Segmenter) with <wbr> between them, and the CSS sets
 * word-break: keep-all, so 带领 stays whole where a line ends. Applies to
 * post titles and the 札记 rows on the home page.
 */

const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('zh', { granularity: 'word' }) : null;
const CJK = /[㐀-鿿豈-﫿]/;

// Text only: entities stay whole, and a break goes only next to Chinese.
function breakWords(text) {
  if (!segmenter || !CJK.test(text)) return text;
  const words = [...segmenter.segment(text)].map(part => part.segment);
  return words.reduce((out, word, index) => {
    const previous = words[index - 1];
    const join = index > 0 && (CJK.test(word[0]) || CJK.test(previous.slice(-1))) && !/^[\s&;]/.test(word);
    return out + (join ? '<wbr>' : '') + word;
  }, '');
}

// Leaves entities (&amp;) alone by splitting the text around them.
function typeset(text) {
  return text.split(/(&[#\w]+;)/).map(part => (part.startsWith('&') ? part : breakWords(part))).join('');
}

const TITLES = [
  /(<h1 class="post-title"[^>]*>)([^<]+)(<\/h1>)/g,
  /(<a class="signal-seg-link"[^>]*>)([^<]+)(<\/a>)/g,
  /(<span class="signal-hero-latest-title">)([^<]+)(<\/span>)/g
];

hexo.extend.filter.register('after_render:html', html => {
  for (const pattern of TITLES) {
    html = html.replace(pattern, (match, open, text, close) => open + typeset(text) + close);
  }
  return html;
});
