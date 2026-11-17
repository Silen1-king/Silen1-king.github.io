'use strict';

/**
 * 读书 shelf. A reading note carries a `book:` block in its front-matter:
 *
 *   book:
 *     title: 苏菲的世界
 *     author: 乔斯坦·贾德
 *     chapters: 20      # total chapters, with `chapter: 3` = chapter reached
 *     pages: 520        # or total pages, with `read: 180` = page reached
 *                       # or just `progress: 35` (percent)
 *     started: 2026-11-12
 *     finished:         # date once done; also implied by read >= pages
 *     cover: /images/books/sophies-world.jpg   # optional cover image
 *     original: Sofies verden   # optional: original title
 *     translator: 萧宝森        # optional: this edition's translator,
 *     publisher: 作家出版社     #   publisher, edition and a short
 *     edition: 修订版           #   introduction, shown with the cover
 *     intro: 一句话介绍这本书和这个版本。   #   at the top of the note
 *
 * A category page whose posts carry `book:` shows them as a shelf (one row
 * per book: title, author, a thin progress line, pages) instead of the
 * year list. Books in progress come first, newest activity first. A
 * `cover` shows as a small thumbnail at the start of the shelf row, and with
 * the edition details as a small card at the top of the note.
 *
 *   signal_bookshelf(posts)   '' when no post has a book block
 */

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

function num(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(String(value).replace('%', ''));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function bookOf(post) {
  const book = post && post.book;
  if (!book || typeof book !== 'object') return null;
  const pages = num(book.pages);
  const read = num(book.read);
  const chapters = num(book.chapters);
  const chapter = num(book.chapter);
  let percent = num(book.progress);
  if (percent === null && chapters && chapter !== null) percent = (chapter / chapters) * 100;
  if (percent === null && pages && read !== null) percent = (read / pages) * 100;
  const finished = Boolean(book.finished) || (percent !== null && percent >= 100);
  if (finished) percent = 100;
  percent = percent === null ? 0 : Math.max(0, Math.min(100, Math.round(percent)));
  return {
    title: String(book.title || post.title || ''),
    author: String(book.author || ''),
    pages,
    read: finished && pages ? pages : read,
    chapters,
    chapter: finished && chapters ? chapters : chapter,
    percent,
    started: dotDate(book.started),
    done: dotDate(book.finished),
    finished,
    cover: book.cover ? String(book.cover) : '',
    original: String(book.original || ''),
    translator: String(book.translator || ''),
    publisher: String(book.publisher || ''),
    edition: String(book.edition || ''),
    intro: String(book.intro || ''),
    state: finished ? '读完' : percent > 0 ? '在读' : '想读'
  };
}

function dotDate(value) {
  if (!value) return '';
  const date = value && typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}

// "第 1 / 20 章", "186 / 520 页" or "35%".
function amount(book) {
  if (book.chapters) return `第 ${book.chapter ?? 0} / ${book.chapters} 章`;
  if (book.pages) return `${book.read ?? 0} / ${book.pages} 页`;
  return `${book.percent}%`;
}

// "2026.11.12 起" or "2026.11.12 — 2026.12.01".
function span(book) {
  if (book.started && book.done) return `${book.started} — ${book.done}`;
  if (book.started) return `${book.started} 起`;
  return book.done ? `${book.done} 读完` : '';
}

function stamp(post) {
  const value = post.updated || post.date;
  const date = value && typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

const ORDER = { 在读: 0, 想读: 1, 读完: 2 };

function shelfRows(posts) {
  return toArray(posts)
    .map(post => ({ post, book: bookOf(post) }))
    .filter(row => row.book)
    .sort((a, b) => ORDER[a.book.state] - ORDER[b.book.state] || stamp(b.post) - stamp(a.post));
}

function bar(book) {
  return `<span class="shelf-bar" role="progressbar" aria-label="阅读进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${book.percent}"><span style="width:${book.percent}%"></span></span>`;
}

// The compact trail inside the 读书 row on 疆域: title, line, amount.
function renderTrail(posts) {
  const rows = shelfRows(posts);
  if (!rows.length) return '';
  return `<span class="shelf-trail">${rows.map(({ book }) => `<span class="shelf-trail-item${book.finished ? ' is-done' : ''}">
      <span class="shelf-trail-title">${escapeHtml(book.title)}</span>${bar(book)}<span class="shelf-pages">${escapeHtml(amount(book))}</span>
    </span>`).join('')}</span>`;
}

function coverImg(book, urlFor, className) {
  if (!book.cover) return '';
  const src = /^(https?:)?\/\//.test(book.cover) ? book.cover : urlFor(book.cover);
  return `<img class="${className}" src="${escapeHtml(src)}" alt="《${escapeHtml(book.title)}》封面" loading="lazy" decoding="async">`;
}

// The card at the top of a note: cover, title, edition, short introduction.
function renderCard(book, urlFor) {
  if (!book.cover && !book.intro) return '';
  const byline = [book.author && `${book.author} 著`, book.translator && `${book.translator} 译`].filter(Boolean).join(' · ');
  const edition = [book.publisher, book.edition].filter(Boolean).join(' · ');
  return `<section class="book-card">${coverImg(book, urlFor, 'book-card-cover')}<div class="book-card-text">
      <p class="book-card-title">${escapeHtml(book.title)}${book.original ? ` <span>${escapeHtml(book.original)}</span>` : ''}</p>
      ${byline ? `<p class="book-card-meta">${escapeHtml(byline)}</p>` : ''}
      ${edition ? `<p class="book-card-meta">${escapeHtml(edition)}</p>` : ''}
      ${book.intro ? `<p class="book-card-intro">${escapeHtml(book.intro)}</p>` : ''}
    </div></section>`;
}

function renderShelf(posts, urlFor) {
  const rows = shelfRows(posts);
  if (!rows.length) return '';

  const items = rows.map(({ post, book }) => {
    const when = span(book);
    return `<li class="shelf-item${book.finished ? ' is-done' : ''}">
      <a class="shelf-row${book.cover ? ' has-cover' : ''}" href="${escapeHtml(urlFor(post.path))}">
        ${coverImg(book, urlFor, 'shelf-cover')}
        <span class="shelf-title">${escapeHtml(book.title)}</span>
        <span class="shelf-meta">${book.author ? `${escapeHtml(book.author)} · ` : ''}${book.state}</span>
        ${bar(book)}
        <span class="shelf-pages">${escapeHtml(amount(book))}</span>
        ${when ? `<span class="shelf-when">${escapeHtml(when)}</span>` : ''}
      </a>
    </li>`;
  }).join('');

  return `<ol class="shelf">${items}</ol>`;
}

// Also required by signal-channels.js, where `hexo` is not in scope.
if (typeof hexo !== 'undefined') {
  hexo.extend.helper.register('signal_bookshelf', function signalBookshelf(posts) {
    return renderShelf(posts, path => this.url_for(path));
  });

  hexo.extend.filter.register('after_post_render', function bookCard(post) {
    const book = post.layout === 'post' ? bookOf(post) : null;
    if (!book) return post;
    const root = String(hexo.config.root || '/').replace(/\/?$/, '/');
    post.content = renderCard(book, path => root + String(path).replace(/^\//, '')) + post.content;
    return post;
  });
}

module.exports = { bookOf, renderShelf, renderTrail };
