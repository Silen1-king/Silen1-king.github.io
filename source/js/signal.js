/* global CONFIG */

// SIGNAL interface: the hero's particle wordmark and wave, the moon at the
// end of a post, 札记 filters, 远征 folds, and small header behaviour.
// The mouse only nudges what is already there: a slight parallax and a
// magnet on the hero. The cursor itself is drawn by signal-cursor.js. None
// of it runs for touch, and what moves stays still with reduced motion.
(function() {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

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

  /* ───── Header ───── */
  const header = $('.header');
  const postBody = $('.post-body');
  const isPost = Boolean(window.CONFIG && CONFIG.page && CONFIG.page.isPost && postBody);

  // 暗室: each entry develops like a print in the tray as it comes into view.
  // Without JS or with reduced motion, every entry is simply there.
  const diaryEntries = $$('.diary-room .diary-entry');
  if (diaryEntries.length && !reduceMotion && 'IntersectionObserver' in window) {
    diaryEntries.forEach(entry => entry.classList.add('is-latent'));
    const develop = new IntersectionObserver((seen, observer) => {
      seen.filter(item => item.isIntersecting).forEach((item, order) => {
        setTimeout(() => item.target.classList.remove('is-latent'), 120 + order * 220);
        observer.unobserve(item.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: .2 });
    diaryEntries.forEach(entry => develop.observe(entry));
  }

  scrollHandlers.push(() => {
    header?.classList.toggle('is-scrolled', window.scrollY > 8);
  });

  // Floating buttons hide while scrolling down and return on the way up or
  // at the end of the page, so they never sit on the line being read. Shown
  // anywhere but the end, they step aside again after a short pause.
  let lastScrollY = window.scrollY;
  let chromeTimer = 0;
  scrollHandlers.push(() => {
    const y = window.scrollY;
    if (Math.abs(y - lastScrollY) < 6) return;
    const atEnd = y + window.innerHeight >= document.documentElement.scrollHeight - 40;
    const hide = y > lastScrollY && y > 240 && !atEnd;
    window.clearTimeout(chromeTimer);
    document.documentElement.classList.toggle('signal-chrome-hidden', hide);
    if (!hide && !atEnd) restChrome();
    lastScrollY = y;
  });
  function restChrome() {
    window.clearTimeout(chromeTimer);
    chromeTimer = window.setTimeout(() => {
      if (!document.body.classList.contains('sidebar-active')) {
        document.documentElement.classList.add('signal-chrome-hidden');
      }
    }, 2500);
  }
  restChrome();

  /* ───── Hero: SILEN1 drawn in particles ───── */
  const heroCanvas = $('.signal-hero-canvas');
  const hero = $('.signal-hero');
  let scatter = 0;

  if (heroCanvas && hero) {
    const heroCopy = $('.signal-hero-copy');
    const wordmark = heroCanvas.dataset.wordmark || 'SILEN1';
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    // The magnet: particles near the mouse step aside and spring back.
    // Reach and push follow the size of the wordmark.
    const magnet = { x: -1e4, y: -1e4, reach: 90, push: 8 };
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
      // Phones get a larger wordmark, set lower, so it meets the slogan.
      const fontSize = Math.min(width * (width < 760 ? 0.33 : 0.27), height * 0.48);
      draw.fillStyle = '#fff';
      draw.textAlign = 'center';
      draw.textBaseline = 'middle';
      draw.font = `900 ${fontSize}px "Big Shoulders Display", "Arial Narrow", Impact, sans-serif`;
      draw.fillText(wordmark, width / 2, height * 0.4);
      const data = draw.getImageData(0, 0, width, height).data;
      const step = Math.max(3, Math.round(fontSize / (width < 760 ? 30 : 52)));
      magnet.reach = clamp(fontSize * 0.26, 70, 130);
      magnet.push = clamp(step * 1.4, 6, 12);
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

    // Particles fly in from everywhere, or, right after the intro, rise out
    // of the line it ended on, which is where the wave sits.
    const flyIn = fromLine => {
      if (reduceMotion) return;
      particles.forEach(particle => {
        if (fromLine) {
          particle.x = particle.hx + (Math.random() - 0.5) * width * 0.3;
          particle.y = waveBase() + (Math.random() - 0.5) * 3;
          particle.vy = -Math.random() * 4;
        } else {
          particle.x = width / 2 + (Math.random() - 0.5) * width * 1.6;
          particle.y = height / 2 + (Math.random() - 0.5) * height * 1.6;
        }
      });
    };
    // Same share of the screen as waveAt() in blog-intro.js.
    const waveBase = () => height * (width < 760 ? 0.56 : 0.62);

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
      const box = heroCanvas.getBoundingClientRect();
      const px = magnet.x - box.left;
      const py = magnet.y - box.top;
      const { reach } = magnet;
      const push = magnet.push * (1 - spread);
      for (const p of particles) {
        const parallax = 2 + p.depth * 5;
        let tx = p.hx + (p.sx - p.hx) * spread + Math.sin(T * 1.3 + p.phase) * 0.8 - mouse.x * parallax;
        let ty = p.hy + (p.sy - p.hy) * spread + Math.cos(T * 1.1 + p.phase) * 0.8 - mouse.y * parallax;
        const dx = tx - px;
        const dy = ty - py;
        if (push > 0 && Math.abs(dx) < reach && Math.abs(dy) < reach) {
          const distance = Math.hypot(dx, dy);
          if (distance > 0.01 && distance < reach) {
            const force = Math.pow(1 - distance / reach, 2) * push / distance;
            tx += dx * force;
            ty += dy * force;
          }
        }
        p.vx = (p.vx + (tx - p.x) * 0.06) * 0.78;
        p.vy = (p.vy + (ty - p.y) * 0.06) * 0.78;
        p.x += p.vx;
        p.y += p.vy;
        const speed = Math.min(1, Math.hypot(p.vx, p.vy) / 6);
        context.fillStyle = `rgba(${124 + 44 * p.t | 0}, ${236 - 97 * p.t | 0}, 255, ${(0.72 + speed * 0.28) * (1 - spread * 0.55)})`;
        const size = p.size * (1 + spread * 0.6);
        context.fillRect(p.x, p.y, size + speed * 3, size);
      }

      // blog-intro.js heroWave() draws this same wave; keep the two in step.
      const base = waveBase();
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
        magnet.x = event.clientX;
        magnet.y = event.clientY;
      }, { passive: true });
      document.documentElement.addEventListener('mouseleave', () => {
        magnet.x = -1e4;
        magnet.y = -1e4;
      });
    }

    // With reduced motion the wordmark is drawn once, already assembled.
    const drawStill = () => {
      buildParticles();
      drawHero(0);
    };
    buildParticles();
    const introPending = document.documentElement.classList.contains('blog-intro-pending');
    const startHero = reduceMotion ? drawStill : whileVisible(hero, drawHero);
    if (introPending) window.addEventListener('blog-intro:end', () => flyIn(true), { once: true });
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
      buildParticles();
      if (!introPending) flyIn(false);
      startHero();
    });

    scrollHandlers.push(() => {
      const rect = hero.getBoundingClientRect();
      const progress = clamp(-rect.top / Math.max(1, rect.height * 0.9));
      scatter = Math.pow(progress, 1.6);
      // The big moon over the skyline rises to the corner as the hero leaves.
      document.documentElement.classList.toggle('signal-past-hero', progress > 0.55);
      if (heroCopy) {
        heroCopy.style.opacity = String(1 - clamp(progress * 2.2));
        heroCopy.style.transform = `translateY(${-progress * 80}px)`;
      }
    });
    resizeHandlers.push(reduceMotion ? drawStill : buildParticles);
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

  /* ───── 远征: a long series unfolds on its button ───── */
  $$('.learning-path-card [data-fold-toggle]').forEach(toggle => {
    const card = toggle.closest('.learning-path-card');
    const label = toggle.textContent;
    const setFold = open => {
      card.classList.toggle('is-unfolded', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = open ? '收起' : label;
      if (!open) card.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
    };
    toggle.addEventListener('click', () => setFold(!card.classList.contains('is-unfolded')));
    if (location.hash === '#' + card.id) setFold(true);
  });

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
