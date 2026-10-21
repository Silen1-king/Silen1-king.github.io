/* global CONFIG */

// SIGNAL interface: header address readout, home page canvases (hero
// particles, realm emblems), the series route graph, counters, the hex
// reading offset on posts, and the harmonograph that closes every page.
// Mouse input only adds a slight parallax to the hero; there is no cursor
// follower.
(function() {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const hex = (value, width = 8) => '0x' + Math.max(0, Math.round(value)).toString(16).toUpperCase().padStart(width, '0');
  const pad2 = value => String(value).padStart(2, '0');
  const BASE_ADDRESS = 0x401000;

  // NexT calls window.anime() for back-to-top and TOC jumps, but only ships
  // anime.js when motion is on. Stand in with native scrolling, keeping
  // headings clear of the fixed header.
  if (typeof window.anime !== 'function') {
    window.anime = ({ targets, scrollTop, complete }) => {
      if (!targets || typeof scrollTop !== 'number') return;
      const page = targets === document.scrollingElement;
      const headerHeight = page && scrollTop > 0 ? ($('.header')?.offsetHeight || 0) : 0;
      (page ? window : targets).scrollTo({ top: Math.max(0, scrollTop - headerHeight), behavior: reduceMotion ? 'auto' : 'smooth' });
      if (complete) setTimeout(complete, 500);
    };
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fitCanvas(canvas) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    const context = canvas.getContext('2d');
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    return [context, width, height];
  }

  // Runs a frame callback only while the element is on screen and the tab is visible.
  function whileVisible(element, draw) {
    let visible = false;
    let frame = 0;
    function loop(time) {
      frame = 0;
      if (!visible || document.hidden) return;
      draw(time);
      frame = requestAnimationFrame(loop);
    }
    function start() {
      if (!frame && visible && !document.hidden) frame = requestAnimationFrame(loop);
    }
    new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting);
      start();
    }).observe(element);
    document.addEventListener('visibilitychange', start);
    return start;
  }

  const scrollHandlers = [];
  const resizeHandlers = [];
  function onScroll() {
    scrollHandlers.forEach(handler => handler());
  }
  let resizeTimer = 0;
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      resizeHandlers.forEach(handler => handler());
      onScroll();
    }, 150);
  });

  /* ───── Header: scroll address, or reading offset on posts ───── */
  const header = $('.header');
  const ripLabel = $('[data-signal-rip-label]');
  const ripValue = $('[data-signal-rip]');
  const postBody = $('.post-body');
  const isPost = Boolean(window.CONFIG && CONFIG.page && CONFIG.page.isPost && postBody);

  if (isPost && ripLabel) ripLabel.textContent = 'OFFSET';
  scrollHandlers.push(() => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const progress = max > 0 ? clamp(window.scrollY / max) : 0;
    header?.classList.toggle('is-scrolled', window.scrollY > 8);
    if (!ripValue) return;
    if (isPost) {
      const total = Math.max(0x400, postBody.textContent.length * 3);
      ripValue.textContent = `${hex(progress * total, 4)} / ${hex(total, 4)}`;
    } else {
      ripValue.textContent = hex(BASE_ADDRESS + progress * 0xFFFF);
    }
  });

  // Floating buttons hide while scrolling down and return on the way up or
  // at the end of the page, so they never sit on the line being read.
  let lastScrollY = window.scrollY;
  scrollHandlers.push(() => {
    const y = window.scrollY;
    if (Math.abs(y - lastScrollY) < 6) return;
    const atEnd = y + window.innerHeight >= document.documentElement.scrollHeight - 40;
    document.documentElement.classList.toggle('signal-chrome-hidden', y > lastScrollY && y > 240 && !atEnd);
    lastScrollY = y;
  });

  // Post headings carry a code-address label, like the prototype reader.
  if (postBody) {
    $$('.post-body > h2').forEach((heading, index) => {
      heading.dataset.loc = 'loc_' + (BASE_ADDRESS + index * 0x40).toString(16);
    });
  }

  /* ───── Hero: SILEN1 drawn in particles ───── */
  const heroCanvas = $('.signal-hero-canvas');
  const hero = $('.signal-hero');
  let scatter = 0;

  if (heroCanvas && hero) {
    const heroCopy = $('.signal-hero-copy');
    const wordmark = heroCanvas.dataset.wordmark || 'SILEN1';
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    let context;
    let width = 0;
    let height = 0;
    let particles = [];

    const buildParticles = () => {
      [context, width, height] = fitCanvas(heroCanvas);
      if (!width || !height) return;
      const offscreen = document.createElement('canvas');
      offscreen.width = width;
      offscreen.height = height;
      const draw = offscreen.getContext('2d');
      const fontSize = Math.min(width * 0.27, height * 0.48);
      draw.fillStyle = '#fff';
      draw.textAlign = 'center';
      draw.textBaseline = 'middle';
      draw.font = `900 ${fontSize}px "Big Shoulders Display", "Arial Narrow", Impact, sans-serif`;
      draw.fillText(wordmark, width / 2, width < 760 ? height * 0.36 : height * 0.4);
      const data = draw.getImageData(0, 0, width, height).data;
      const step = Math.max(3, Math.round(fontSize / (width < 760 ? 30 : 52)));
      const previous = particles;
      particles = [];
      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          if (data[(y * width + x) * 4 + 3] <= 140) continue;
          const old = previous[particles.length];
          const angle = Math.random() * Math.PI * 2;
          // Scatter into dust that mostly stays on screen, so the hand-off to
          // 疆域 never passes through an empty frame.
          const radius = (0.15 + Math.random() * 0.6) * Math.max(width, height);
          particles.push({
            hx: x,
            hy: y,
            x: old ? old.x : x,
            y: old ? old.y : y,
            vx: 0,
            vy: 0,
            sx: width / 2 + Math.cos(angle) * radius,
            sy: height / 2 + Math.sin(angle) * radius,
            t: x / width,
            size: Math.random() * 1.4 + 1.2,
            phase: Math.random() * 6.28,
            depth: Math.random()
          });
        }
      }
    };

    // Particles fly in from everywhere once the intro opens.
    const flyIn = () => {
      if (reduceMotion) return;
      particles.forEach(particle => {
        particle.x = width / 2 + (Math.random() - 0.5) * width * 1.6;
        particle.y = height / 2 + (Math.random() - 0.5) * height * 1.6;
      });
    };

    const drawHero = time => {
      mouse.x += (mouse.tx - mouse.x) * 0.04;
      mouse.y += (mouse.ty - mouse.y) * 0.04;
      context.clearRect(0, 0, width, height);

      const gridX = mouse.x * 14;
      const gridY = mouse.y * 10;
      context.strokeStyle = 'rgba(150, 170, 255, 0.05)';
      context.lineWidth = 1;
      context.beginPath();
      for (let x = ((time * 0.01 + gridX) % 60 + 60) % 60; x < width; x += 60) {
        context.moveTo(x, 0);
        context.lineTo(x, height);
      }
      for (let y = ((gridY % 60) + 60) % 60; y < height; y += 60) {
        context.moveTo(0, y);
        context.lineTo(width, y);
      }
      context.stroke();

      const T = time * 0.001;
      const spread = reduceMotion ? 0 : scatter;
      for (const p of particles) {
        const parallax = 2 + p.depth * 5;
        const tx = p.hx + (p.sx - p.hx) * spread + Math.sin(T * 1.3 + p.phase) * 0.8 - mouse.x * parallax;
        const ty = p.hy + (p.sy - p.hy) * spread + Math.cos(T * 1.1 + p.phase) * 0.8 - mouse.y * parallax;
        p.vx = (p.vx + (tx - p.x) * 0.06) * 0.78;
        p.vy = (p.vy + (ty - p.y) * 0.06) * 0.78;
        p.x += p.vx;
        p.y += p.vy;
        const speed = Math.min(1, Math.hypot(p.vx, p.vy) / 6);
        context.fillStyle = `rgba(${124 + 44 * p.t | 0}, ${236 - 97 * p.t | 0}, 255, ${(0.72 + speed * 0.28) * (1 - spread * 0.55)})`;
        const size = p.size * (1 + spread * 0.6);
        context.fillRect(p.x, p.y, size + speed * 3, size);
      }

      const base = height * (width < 760 ? 0.54 : 0.62);
      const waveX = (mouse.x * 0.5 + 0.5) * width;
      context.beginPath();
      for (let x = 0; x <= width; x += 4) {
        const near = Math.exp(-Math.pow((x - waveX) / 260, 2));
        const y = base + Math.sin(x * 0.03 + T * 2.4) * (3 + near * 5) + Math.sin(x * 0.011 - T * 1.2) * 3;
        if (x) context.lineTo(x, y);
        else context.moveTo(x, y);
      }
      const gradient = context.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, 'rgba(124, 236, 255, 0)');
      gradient.addColorStop(0.5, 'rgba(124, 236, 255, .7)');
      gradient.addColorStop(1, 'rgba(168, 139, 255, 0)');
      context.strokeStyle = gradient;
      context.lineWidth = 1.1;
      context.globalAlpha = 1 - spread;
      context.stroke();
      context.globalAlpha = 1;
    };

    if (finePointer && !reduceMotion) {
      window.addEventListener('pointermove', event => {
        if (event.pointerType !== 'mouse') return;
        mouse.tx = event.clientX / window.innerWidth * 2 - 1;
        mouse.ty = event.clientY / window.innerHeight * 2 - 1;
      }, { passive: true });
    }

    // With reduced motion the wordmark is drawn once, already assembled.
    const drawStill = () => {
      buildParticles();
      drawHero(0);
    };
    buildParticles();
    const introPending = document.documentElement.classList.contains('blog-intro-pending');
    const startHero = reduceMotion ? drawStill : whileVisible(hero, drawHero);
    if (introPending) window.addEventListener('blog-intro:end', flyIn, { once: true });
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
      buildParticles();
      if (!introPending) flyIn();
      startHero();
    });

    scrollHandlers.push(() => {
      const rect = hero.getBoundingClientRect();
      const progress = clamp(-rect.top / Math.max(1, rect.height * 0.9));
      scatter = Math.pow(progress, 1.6);
      if (heroCopy) {
        heroCopy.style.opacity = String(1 - clamp(progress * 2.2));
        heroCopy.style.transform = `translateY(${-progress * 80}px)`;
      }
    });
    resizeHandlers.push(reduceMotion ? drawStill : buildParticles);
  }

  /* ───── Coda: every page rings out on a harmonograph ───── */
  // It draws itself once the footer comes into view, so it never holds the
  // scroll. The home page keeps the 2 : 3 figure; every other page gets its
  // own ratio and phases from its path, a small signature at the end of it.
  const codaCanvas = $('[data-coda-trace]');
  if (codaCanvas) {
    const timeLabel = $('[data-coda-time]');
    const RATIOS = [[2, 3], [3, 4], [3, 2], [4, 5], [1, 2], [5, 4], [3, 5], [2, 1]];
    const TMAX = 140;
    const DURATION = 4200;
    const isHome = Boolean($('#signal-hero'));
    let seed = 0;
    for (const char of location.pathname.replace(/index\.html$/, '')) seed = (seed * 31 + char.codePointAt(0)) >>> 0;
    const [a, b] = isHome ? [2, 3] : RATIOS[seed % RATIOS.length];
    const phases = isHome ? [0.3, 1.2, 0, 0.7] : [0, 1, 2, 3].map(i => (seed >>> (i * 8) & 255) / 255 * Math.PI * 2);
    $('[data-coda-f1]').textContent = a.toFixed(3);
    $('[data-coda-f2]').textContent = (b + 0.01).toFixed(3);

    let context;
    let width = 0;
    let height = 0;
    let shown = 0;

    const point = t => {
      const amplitude = Math.min(width, height) * 0.34;
      const x = amplitude * Math.sin(a * t + phases[0]) * Math.exp(-0.012 * t) + amplitude * 0.45 * Math.sin((b + 0.01) * t + phases[1]) * Math.exp(-0.018 * t);
      const y = amplitude * Math.sin(b * t + phases[2]) * Math.exp(-0.014 * t) + amplitude * 0.45 * Math.sin((a + 0.005) * t + phases[3]) * Math.exp(-0.02 * t);
      return [width / 2 + x, height / 2 + y];
    };
    const draw = progress => {
      shown = progress;
      if (!width || !height) return;
      context.clearRect(0, 0, width, height);
      const tEnd = TMAX * progress;
      if (timeLabel) timeLabel.textContent = tEnd.toFixed(2);
      if (tEnd <= 0) return;
      const steps = Math.max(3, Math.floor(tEnd * 22));
      let previous = point(0);
      context.lineWidth = 0.7;
      // Three segments per stroke; the colour drifts cyan to violet as it decays.
      for (let i = 1; i <= steps; i += 3) {
        const mix = i / steps * tEnd / TMAX;
        context.strokeStyle = `rgba(${124 + 44 * mix | 0}, ${236 - 97 * mix | 0}, 255, ${0.25 + 0.45 * (i / steps)})`;
        context.beginPath();
        context.moveTo(previous[0], previous[1]);
        for (let j = i; j < i + 3 && j <= steps; j++) {
          previous = point(j / steps * tEnd);
          context.lineTo(previous[0], previous[1]);
        }
        context.stroke();
      }
      const pen = context.createRadialGradient(previous[0], previous[1], 0, previous[0], previous[1], 16);
      pen.addColorStop(0, 'rgba(231, 234, 244, .95)');
      pen.addColorStop(0.3, 'rgba(124, 236, 255, .4)');
      pen.addColorStop(1, 'rgba(124, 236, 255, 0)');
      context.fillStyle = pen;
      context.beginPath();
      context.arc(previous[0], previous[1], 16, 0, Math.PI * 2);
      context.fill();
    };
    const size = () => {
      [context, width, height] = fitCanvas(codaCanvas);
      draw(shown);
    };
    const ringOut = () => {
      if (reduceMotion) {
        draw(1);
        return;
      }
      const begin = performance.now();
      const tick = now => {
        const k = clamp((now - begin) / DURATION);
        draw(1 - Math.pow(1 - k, 3));
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    size();
    resizeHandlers.push(size);
    new IntersectionObserver((entries, observer) => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      ringOut();
    }, { threshold: 0.3 }).observe(codaCanvas);
  }

  /* ───── 疆域: emblems, and a horizontal track once there are 3+ realms ───── */
  const realms = $('.signal-realms');
  if (realms) {
    const grid = $('.signal-realm-grid', realms);
    const indexLabel = $('[data-realm-index]', realms);
    const count = Number(realms.dataset.count) || 0;
    const emblems = $$('canvas[data-emblem]', realms).map(canvas => ({
      canvas,
      type: canvas.dataset.emblem,
      seed: Number(canvas.dataset.seed) || 7
    }));

    const drawFlag = (context, width, height, t) => {
      const cols = 30;
      const rows = 19;
      const gap = Math.min(width * 0.62 / cols, height * 0.58 / rows);
      const x0 = width / 2 - cols * gap / 2 + gap * 0.6;
      const y0 = height / 2 - rows * gap / 2;
      context.strokeStyle = 'rgba(150, 170, 255, .4)';
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(x0 - gap, y0 - gap * 1.2);
      context.lineTo(x0 - gap, Math.min(height - 16, y0 + rows * gap * 1.5));
      context.stroke();
      context.fillStyle = 'rgba(231, 234, 244, .8)';
      context.beginPath();
      context.arc(x0 - gap, y0 - gap * 1.4, 2.4, 0, Math.PI * 2);
      context.fill();
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const k = c / cols;
          const phase = c * 0.32 - t * 2.2 + r * 0.05;
          const dx = -Math.abs(Math.sin(phase)) * gap * 0.3 * k;
          const dy = Math.sin(phase) * gap * 1.5 * k;
          const light = 0.5 + 0.5 * Math.cos(phase);
          const m = r / rows;
          const s = gap * (0.22 + 0.2 * light);
          context.fillStyle = `rgba(${124 + 44 * m | 0}, ${236 - 97 * m | 0}, 255, ${0.25 + 0.7 * light})`;
          context.fillRect(x0 + c * gap + dx - s / 2, y0 + r * gap + dy - s / 2, s, s);
        }
      }
    };

    // Unconfigured realms get a rose curve seeded by their name.
    const drawRose = (context, width, height, t, seed) => {
      const n = 2 + seed % 5;
      const d = 1 + (seed >> 4) % 3;
      const k = n / d;
      const radius = Math.min(width, height) * 0.36;
      for (let layer = 0; layer < 3; layer++) {
        context.beginPath();
        for (let i = 0; i <= 600; i++) {
          const theta = i / 600 * Math.PI * 2 * d;
          const r = radius * (0.6 + layer * 0.2) * Math.cos(k * theta + t * 0.3 * (layer + 1));
          const angle = theta + t * 0.12 * (layer % 2 ? 1 : -1);
          const x = width / 2 + r * Math.cos(angle);
          const y = height / 2 + r * Math.sin(angle);
          if (i) context.lineTo(x, y);
          else context.moveTo(x, y);
        }
        context.strokeStyle = `rgba(${124 + 22 * layer}, ${236 - 48 * layer}, 255, .35)`;
        context.lineWidth = 0.8;
        context.stroke();
      }
    };

    const drawEmblems = time => {
      const t = reduceMotion ? 1 : time / 1000;
      emblems.forEach(emblem => {
        const [context, width, height] = fitCanvas(emblem.canvas);
        context.clearRect(0, 0, width, height);
        if (emblem.type === 'flag') drawFlag(context, width, height, t);
        else drawRose(context, width, height, t, emblem.seed);
      });
    };
    if (reduceMotion) {
      drawEmblems(1000);
      resizeHandlers.push(() => drawEmblems(1000));
    } else if (emblems.length) {
      whileVisible(realms, drawEmblems);
    }

    const isTrack = () => realms.dataset.mode === 'track' && window.innerWidth > 820;
    // Travel until the last card sits as far from the right edge as the first sat from the left.
    const trackExtra = () => grid.scrollWidth - window.innerWidth + (parseFloat(getComputedStyle(grid).paddingLeft) || 24);
    const sizeTrack = () => {
      realms.style.height = isTrack() ? `${window.innerHeight + Math.max(0, trackExtra())}px` : '';
      if (!isTrack()) grid.style.transform = '';
    };
    sizeTrack();
    resizeHandlers.push(sizeTrack);
    scrollHandlers.push(() => {
      if (!isTrack()) return;
      const rect = realms.getBoundingClientRect();
      const progress = clamp(-rect.top / Math.max(1, rect.height - window.innerHeight));
      grid.style.transform = `translateX(${-progress * Math.max(0, trackExtra())}px)`;
      if (indexLabel) indexLabel.textContent = `${pad2(Math.min(count, 1 + Math.floor(progress * (count - 0.001))))} / ${pad2(count)}`;
    });
  }

  /* ───── 札记: realm filter chips (only rendered for 2+ realms) ───── */
  const filters = $('[data-realm-filters]');
  if (filters) {
    filters.addEventListener('click', event => {
      const chip = event.target.closest('[data-realm-filter]');
      if (!chip) return;
      const realm = chip.dataset.realmFilter;
      $$('[data-realm-filter]', filters).forEach(button => button.setAttribute('aria-pressed', String(button === chip)));
      $$('.signal-seg').forEach(row => {
        row.hidden = Boolean(realm) && row.dataset.realm !== realm;
      });
    });
  }

  /* ───── 远征: series route graph ───── */
  function routeEdges(rowA, rowB) {
    const pairs = [];
    const last = list => Math.max(1, list.length - 1);
    const used = new Set();
    rowB.forEach((node, j) => {
      const i = rowA.length === 1 ? 0 : Math.round(j * (rowA.length - 1) / last(rowB));
      used.add(i);
      pairs.push([rowA[i], node]);
    });
    rowA.forEach((node, i) => {
      if (used.has(i)) return;
      pairs.push([node, rowB[rowB.length === 1 ? 0 : Math.round(i * (rowB.length - 1) / last(rowA))]]);
    });
    return pairs;
  }

  function renderRoute(container, route, animate) {
    if (!route || !route.rows || !route.rows.length) {
      container.innerHTML = '';
      return;
    }
    const narrow = container.clientWidth < 700;
    const NODE_H = 58;
    const ROW_H = narrow ? 104 : 116;
    const VIEW_W = narrow ? 380 : 960;
    const GAP = narrow ? 14 : 40;
    const fontSize = narrow ? 14 : 16;
    const VIEW_H = route.rows.length * ROW_H + 10;
    let address = 0;

    const rows = route.rows.map((row, rowIndex) => {
      const nodeW = Math.min(narrow && row.length > 1 ? 172 : 300, (VIEW_W - 24 - (row.length - 1) * GAP) / row.length);
      const total = row.length * nodeW + (row.length - 1) * GAP;
      const maxChars = Math.max(4, Math.floor((nodeW - 28) / fontSize));
      return row.map((step, column) => ({
        ...step,
        w: nodeW,
        maxChars,
        x: (VIEW_W - total) / 2 + column * (nodeW + GAP),
        y: 24 + rowIndex * ROW_H
      }));
    });

    let markup = '<defs><marker id="route-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z"/></marker></defs>';
    for (let r = 0; r < rows.length - 1; r++) {
      routeEdges(rows[r], rows[r + 1]).forEach(([a, b]) => {
        const x1 = a.x + a.w / 2;
        const y1 = a.y + NODE_H;
        const x2 = b.x + b.w / 2;
        const y2 = b.y - 2;
        markup += `<path class="route-edge" d="M${x1} ${y1} C${x1} ${(y1 + y2) / 2} ${x2} ${(y1 + y2) / 2} ${x2} ${y2}" marker-end="url(#route-arrow)"/>`;
      });
      if (rows[r].length === 1 && rows[r + 1].length > 1) {
        markup += `<text class="route-label" x="${VIEW_W / 2 + 10}" y="${rows[r][0].y + NODE_H + 30}">either</text>`;
      }
    }
    rows.flat().forEach(node => {
      const published = Boolean(node.url);
      const title = node.title.length > node.maxChars ? node.title.slice(0, node.maxChars - 1) + '…' : node.title;
      const body = `<rect x="${node.x}" y="${node.y}" width="${node.w}" height="${NODE_H}"/>`
        + `<rect class="route-bar" x="${node.x}" y="${node.y}" width="3" height="${NODE_H}"/>`
        + `<text class="route-addr" x="${node.x + 14}" y="${node.y + 20}">loc_${(BASE_ADDRESS + address * 0x40).toString(16)}${published ? '' : '  PLANNED'}</text>`
        + `<text class="route-title" x="${node.x + 14}" y="${node.y + 44}">${escapeHtml(title)}</text>`
        + `<title>${escapeHtml(node.title)}</title>`;
      markup += published
        ? `<a class="route-node is-published" href="${escapeHtml(node.url)}">${body}</a>`
        : `<g class="route-node is-planned">${body}</g>`;
      address++;
    });

    container.innerHTML = `<svg class="route-svg${narrow ? ' is-narrow' : ''}" viewBox="0 0 ${VIEW_W} ${VIEW_H}" role="img" aria-label="${escapeHtml(route.name)}">${markup}</svg>`;
    const svg = container.firstElementChild;
    $$('.route-edge', svg).forEach(path => path.style.setProperty('--len', Math.ceil(path.getTotalLength())));
    if (animate && !reduceMotion) {
      svg.classList.add('is-hidden');
      svg.getBoundingClientRect();
      requestAnimationFrame(() => requestAnimationFrame(() => svg.classList.remove('is-hidden')));
    }
  }

  function parseJson(value, fallback) {
    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  }

  $$('.route-graph').forEach(container => {
    const routes = container.dataset.routes ? parseJson(container.dataset.routes, []) : [parseJson(container.dataset.route, null)];
    const tabs = container.closest('section')?.querySelector('[data-route-tabs]');
    let current = 0;
    let seen = false;
    const draw = animate => renderRoute(container, routes[current], animate);

    draw(false);
    new IntersectionObserver((entries, observer) => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      seen = true;
      draw(true);
      observer.disconnect();
    }, { threshold: 0.3 }).observe(container);
    resizeHandlers.push(() => draw(false));

    tabs?.addEventListener('click', event => {
      const tab = event.target.closest('[data-route-index]');
      if (!tab) return;
      current = Number(tab.dataset.routeIndex) || 0;
      $$('[data-route-index]', tabs).forEach(button => button.setAttribute('aria-pressed', String(button === tab)));
      draw(seen);
    });
  });

  /* ───── 年鉴: registers count up when they come into view ───── */
  const registers = $('.signal-registers');
  if (registers && !reduceMotion) {
    new IntersectionObserver((entries, observer) => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      $$('[data-count-to]', registers).forEach(element => {
        const target = Number(element.dataset.countTo) || 0;
        const startedAt = performance.now();
        const step = now => {
          const progress = clamp((now - startedAt) / 1400);
          element.textContent = Math.round(target * (1 - Math.pow(1 - progress, 3))).toLocaleString('en');
          if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }, { threshold: 0.4 }).observe(registers);
  }

  /* ───── Navigation marks the page you are on ───── */
  // Each menu word opens a page (札记 /archives/, 远征 /learning-paths/,
  // 疆域 /categories/); pages under it count too, and a post belongs to 札记.
  const root = (window.CONFIG && CONFIG.root) || '/';
  $$('.main-menu .menu-item a[href]').forEach(link => {
    const path = link.pathname;
    const inside = path !== root && location.pathname.startsWith(path);
    const postHome = isPost && path === root + 'archives/';
    if (inside || postHome) link.setAttribute('aria-current', 'page');
  });

  onScroll();
})();
