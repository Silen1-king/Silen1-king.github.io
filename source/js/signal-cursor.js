// The SIGNAL cursor: a phosphor dot drawn over the page, like the beam on an
// oscilloscope. Moving, it leaves a short afterglow. Over anything clickable
// it opens into corner brackets around it, over text it stretches into a
// caret as tall as the letters, and pressing sends out a ring. The dot is
// drawn exactly where the pointer is, so a click lands on it.
//
// Mouse only. The system cursor is hidden once this script has seen the
// mouse move, so until then, or if the script never loads, the redrawn
// system cursor from signal-base.styl is what shows. In the comments iframe
// and on the page scrollbar the system cursor takes over. Reduced motion keeps
// the shapes and drops the afterglow, the ring and the easing.
(function() {
  'use strict';

  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (window.matchMedia('(forced-colors: active)').matches) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;
  const lerp = (from, to, t) => from + (to - from) * t;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  // The same places the system cursor changes in signal-base.styl, plus the
  // components that ask for var(--cursor-pointer).
  const CLICKABLE = [
    'a[href]', 'button:not(:disabled)', '[role="button"]:not(img)', 'summary', 'label[for]', 'select',
    'input[type="checkbox"]', 'input[type="radio"]', 'input[type="submit"]', '.copy-btn',
    '.back-to-top.back-to-top-on', '.post-image-zoomable', '.blog-intro', '.global-search-trigger',
    '.global-search-close', '.image-zoom-close', '.site-nav-toggle .toggle', '.signal-chip'
  ].join(', ');
  // Links that cover their whole row, so the row is what they point at.
  const ROW_LINKS = '.signal-seg-link';
  const TEXTUAL = 'p, li, dt, dd, td:not(.gutter), th, blockquote, figcaption, pre, code, kbd, h1, h2, h3, h4, h5, h6, input:not([type]), input[type="text"], input[type="search"], textarea';
  const TRAIL_LIFE = 300;
  const RING_LIFE = 560;

  const canvas = document.createElement('canvas');
  canvas.className = 'signal-cursor';
  canvas.setAttribute('aria-hidden', 'true');
  const context = canvas.getContext('2d');
  let width = 0;
  let height = 0;

  const pointer = { x: 0, y: 0, on: false, down: false, moved: 0 };
  // The drawn shape eases toward what is under the pointer: a frame (box and
  // how open it is), a caret (how stretched, how tall) and a press.
  const shape = { x: 0, y: 0, w: 0, h: 0, frame: 0, caret: 0, caretHeight: 20, squeeze: 0 };
  const trail = [];
  const rings = [];
  let look = { kind: 'gone' };
  let sizedElement = null;
  let fontSize = 16;
  let raf = 0;

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    // clientWidth leaves out the page scrollbar, which the canvas must not cover.
    width = root.clientWidth;
    height = root.clientHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function kick() {
    if (!raf) raf = requestAnimationFrame(frame);
  }

  function boxOf(element) {
    const rects = [...element.getClientRects()];
    const near = r => pointer.x >= r.left - 3 && pointer.x <= r.right + 3 && pointer.y >= r.top - 3 && pointer.y <= r.bottom + 3;
    const hit = rects.find(near);
    // A link stretched over its whole row by an absolute ::after (ROW_LINKS)
    // frames its title only while the pointer is on the title, the whole
    // title however wide. Elsewhere in the row the row's own hover speaks.
    if (element.matches(ROW_LINKS)) {
      if (!hit) return null;
      const r = element.getBoundingClientRect();
      return { x: r.left - 8, y: r.top - 6, w: r.width + 16, h: r.height + 12 };
    }
    const rect = hit || element.getBoundingClientRect();
    // Corners far apart stop reading as one frame, so a whole row, a large
    // image or the intro gets a small frame around the pointer instead.
    if (rect.width > Math.min(640, width * 0.7) || rect.height > Math.min(160, height * 0.4)) {
      return { x: pointer.x - 14, y: pointer.y - 14, w: 28, h: 28 };
    }
    const pad = clamp(rect.height * 0.2, 4, 8);
    return { x: rect.left - pad, y: rect.top - pad, w: rect.width + pad * 2, h: rect.height + pad * 2 };
  }

  function classify() {
    if (!pointer.on || pointer.x >= width || pointer.y >= height) return { kind: 'gone' };
    const element = document.elementFromPoint(pointer.x, pointer.y);
    // The comments are another page inside an iframe, with their own cursor.
    if (!element || element.tagName === 'IFRAME') return { kind: 'gone' };
    const target = element.closest(CLICKABLE);
    if (target) {
      const box = boxOf(target);
      return box ? { kind: 'link', box } : { kind: 'free' };
    }
    if (element.closest(TEXTUAL)) {
      if (element !== sizedElement) {
        sizedElement = element;
        fontSize = parseFloat(getComputedStyle(element).fontSize) || 16;
      }
      return { kind: 'text', size: fontSize };
    }
    return { kind: 'free' };
  }

  // Jump straight to the resting shape, for when the pointer comes back.
  function settle() {
    Object.assign(shape, { x: pointer.x, y: pointer.y, w: 0, h: 0, frame: 0, caret: 0, squeeze: 0 });
    trail.length = 0;
  }

  function approach(key, target, rate) {
    const next = reduceMotion ? target : lerp(shape[key], target, rate);
    shape[key] = Math.abs(next - target) < 0.01 ? target : next;
    return shape[key] !== target;
  }

  /* Drawing */
  function corners(alpha) {
    if (alpha < 0.02 || shape.w < 1) return;
    const inset = shape.squeeze * 2;
    const x0 = shape.x + inset;
    const y0 = shape.y + inset;
    const x1 = shape.x + shape.w - inset;
    const y1 = shape.y + shape.h - inset;
    const arm = clamp(Math.min(x1 - x0, y1 - y0) / 3, 3, 10);
    context.beginPath();
    context.moveTo(x0, y0 + arm); context.lineTo(x0, y0); context.lineTo(x0 + arm, y0);
    context.moveTo(x1 - arm, y0); context.lineTo(x1, y0); context.lineTo(x1, y0 + arm);
    context.moveTo(x1, y1 - arm); context.lineTo(x1, y1); context.lineTo(x1 - arm, y1);
    context.moveTo(x0 + arm, y1); context.lineTo(x0, y1); context.lineTo(x0, y1 - arm);
    context.lineCap = 'square';
    context.lineJoin = 'miter';
    // A dark edge first, so the frame still reads on light screenshots.
    context.strokeStyle = `rgba(5, 6, 11, ${0.7 * alpha})`;
    context.lineWidth = 3.5;
    context.stroke();
    context.strokeStyle = `rgba(124, 236, 255, ${alpha})`;
    context.lineWidth = 1.5;
    context.shadowColor = `rgba(124, 236, 255, ${0.6 * alpha})`;
    context.shadowBlur = 6;
    context.stroke();
    context.shadowBlur = 0;
  }

  function pill(x, y, w, h) {
    context.beginPath();
    if (context.roundRect) context.roundRect(x, y, w, h, Math.min(w, h) / 2);
    else context.rect(x, y, w, h);
  }

  function drawRings(now) {
    for (let i = rings.length - 1; i >= 0; i--) {
      const k = (now - rings[i].t) / RING_LIFE;
      if (k >= 1) {
        rings.splice(i, 1);
        continue;
      }
      // Two rings, the second smaller and a little later.
      for (const [delay, reach] of [[0, 30], [0.18, 19]]) {
        const kk = clamp((k - delay) / (1 - delay), 0, 1);
        if (!kk) continue;
        context.strokeStyle = `rgba(124, 236, 255, ${0.55 * Math.pow(1 - kk, 1.5)})`;
        context.lineWidth = 1.2;
        context.beginPath();
        context.arc(rings[i].x, rings[i].y, 4 + reach * (1 - Math.pow(1 - kk, 3)), 0, Math.PI * 2);
        context.stroke();
      }
    }
  }

  function draw(now) {
    const { x, y } = pointer;

    // The afterglow: older segments thinner, fainter and shifting to violet.
    while (trail.length && now - trail[0].t > TRAIL_LIFE) trail.shift();
    context.globalCompositeOperation = 'lighter';
    context.lineCap = 'round';
    const points = [...trail, { x, y, t: now }];
    for (let i = 1; i < points.length; i++) {
      const k = 1 - (now - points[i].t) / TRAIL_LIFE;
      if (k <= 0) continue;
      context.strokeStyle = `rgba(${124 + 44 * (1 - k) | 0}, ${236 - 97 * (1 - k) | 0}, 255, ${0.55 * k * k})`;
      context.lineWidth = 0.5 + 2.4 * k;
      context.beginPath();
      context.moveTo(points[i - 1].x, points[i - 1].y);
      context.lineTo(points[i].x, points[i].y);
      context.stroke();
    }
    const glow = context.createRadialGradient(x, y, 0, x, y, 22);
    glow.addColorStop(0, `rgba(124, 236, 255, ${0.34 * (1 - 0.6 * shape.caret)})`);
    glow.addColorStop(1, 'rgba(124, 236, 255, 0)');
    context.fillStyle = glow;
    context.fillRect(x - 22, y - 22, 44, 44);
    context.globalCompositeOperation = 'source-over';

    corners(shape.frame);

    // The dot: a caret over text, a little smaller inside a frame.
    const size = lerp(6, 4, shape.frame);
    const w = lerp(size, 2, shape.caret);
    const h = lerp(size, shape.caretHeight, shape.caret);
    pill(x - w / 2 - 1.5, y - h / 2 - 1.5, w + 3, h + 3);
    context.fillStyle = 'rgba(5, 6, 11, .75)';
    context.fill();
    pill(x - w / 2, y - h / 2, w, h);
    context.fillStyle = '#eafcff';
    context.shadowColor = 'rgba(124, 236, 255, .95)';
    context.shadowBlur = 10;
    context.fill();
    context.shadowBlur = 0;

    drawRings(now);
    return trail.length > 0 || rings.length > 0;
  }

  // One loop, running only while something is moving or settling.
  function frame(now) {
    raf = 0;
    if (root.clientWidth !== width || root.clientHeight !== height) resize();
    look = classify();
    const shown = look.kind !== 'gone';

    if (!shown) trail.length = 0;
    else if (!reduceMotion) {
      const last = trail[trail.length - 1];
      if (last && Math.hypot(pointer.x - last.x, pointer.y - last.y) > 220) trail.length = 0;
      if (!last || last.x !== pointer.x || last.y !== pointer.y) trail.push({ x: pointer.x, y: pointer.y, t: now });
    }

    const box = look.kind === 'link' ? look.box : { x: pointer.x, y: pointer.y, w: 0, h: 0 };
    let busy = now - pointer.moved < 120;
    busy = approach('x', box.x, 0.3) || busy;
    busy = approach('y', box.y, 0.3) || busy;
    busy = approach('w', box.w, 0.3) || busy;
    busy = approach('h', box.h, 0.3) || busy;
    busy = approach('frame', look.kind === 'link' ? 1 : 0, 0.24) || busy;
    busy = approach('caret', look.kind === 'text' ? 1 : 0, 0.3) || busy;
    busy = approach('caretHeight', clamp((look.size || 16) * 1.25, 14, 40), 0.3) || busy;
    busy = approach('squeeze', pointer.down ? 1 : 0, 0.45) || busy;

    context.clearRect(0, 0, width, height);
    if (shown) busy = draw(now) || busy;
    if (busy) kick();
  }

  function hide() {
    pointer.on = false;
    pointer.down = false;
    kick();
  }

  function start() {
    resize();
    document.body.append(canvas);
    // Search and the image viewer add their overlays at the end of <body>;
    // stay after them so the cursor is drawn on top.
    new MutationObserver(() => {
      if (document.body.lastElementChild !== canvas) document.body.append(canvas);
    }).observe(document.body, { childList: true });

    window.addEventListener('pointermove', event => {
      if (event.pointerType === 'touch') return;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.moved = performance.now();
      if (!pointer.on) {
        pointer.on = true;
        settle();
      }
      // The page scrollbar is outside the canvas, so the dot can't be drawn
      // there. Hand that strip back to the system cursor instead of leaving
      // the pointer invisible on it.
      root.classList.toggle('signal-cursor-on', event.clientX < root.clientWidth && event.clientY < root.clientHeight);
      kick();
    }, { passive: true });

    window.addEventListener('pointerdown', event => {
      if (event.pointerType === 'touch') return hide();
      if (event.button !== 0 || !pointer.on) return;
      pointer.down = true;
      if (!reduceMotion) rings.push({ x: event.clientX, y: event.clientY, t: performance.now() });
      kick();
    });

    const release = () => {
      pointer.down = false;
      kick();
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    window.addEventListener('blur', release);

    // Off the page, or into the comments iframe.
    document.addEventListener('mouseout', event => {
      if (!event.relatedTarget) hide();
    });
    document.addEventListener('mouseover', event => {
      if (event.target.tagName === 'IFRAME') hide();
    });

    window.addEventListener('scroll', kick, { passive: true });
    window.addEventListener('resize', kick);
  }

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
})();
