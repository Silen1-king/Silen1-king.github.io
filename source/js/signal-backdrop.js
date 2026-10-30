// The page backdrop: a rainy night city behind everything. Three layers of
// towers with lit windows, beacons blinking on the spires, a few lights of
// air traffic, slanted neon rain, and in the bottom right corner the
// Afterlife sign. Up in the sky, behind the rain, a broken moon with a girl
// praying on it (/images/backdrop-moon.svg, which animates itself).
//
// One fixed canvas under the page. It draws at most 30 frames a second at 1x
// pixel density and stops while the tab is hidden. The static parts (towers,
// steady windows, the sign) are drawn once into an offscreen canvas. With
// reduced motion the canvas draws one still frame. On phones there is less
// rain, fewer cars and no sign, and signal-base.styl dims the whole layer.
(function() {
  'use strict';

  if (window.matchMedia('(forced-colors: active)').matches) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CYAN = [124, 236, 255];
  const VIOLET = [168, 139, 255];
  const ROSE = [255, 126, 157];
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

  // Seeded, so the skyline is the same on every page and every visit.
  function random(seed) {
    let s = seed >>> 0;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }

  // Far to near: farther towers are lower in contrast and tinted toward the
  // haze, with fog between the layers.
  const LAYERS = [
    { top: .24, spread: .22, width: [18, 46], body: [17, 16, 34], edge: VIOLET, edgeAlpha: .10, window: .5, windowOdds: .03 },
    { top: .16, spread: .2, width: [30, 70], body: [13, 15, 30], edge: CYAN, edgeAlpha: .08, window: .8, windowOdds: .06 },
    { top: .08, spread: .18, width: [50, 120], body: [7, 8, 16], edge: CYAN, edgeAlpha: .12, window: 1, windowOdds: .05 }
  ];

  function buildCity(w, h, r, small) {
    const city = document.createElement('canvas');
    city.width = w;
    city.height = h;
    const g = city.getContext('2d');
    const windows = [];
    const beacons = [];

    LAYERS.forEach((layer, depth) => {
      const near = depth === 2;
      let x = -30;
      while (x < w + 30) {
        const bw = layer.width[0] + r() * (layer.width[1] - layer.width[0]);
        const bh = h * (layer.top + r() * layer.spread) * (small ? .8 : 1);
        const top = h - bh;
        g.fillStyle = `rgb(${layer.body})`;
        g.fillRect(x, top, bw, bh);
        // A stepped crown on some towers, and a spire with a beacon on some of those.
        if (r() < .45) {
          const cw = bw * (.4 + r() * .3);
          const ch = 8 + r() * 26;
          g.fillRect(x + (bw - cw) / 2, top - ch, cw, ch);
          if (r() < .6) {
            const ax = x + bw / 2;
            const ah = 14 + r() * 40;
            g.fillRect(ax - .5, top - ch - ah, 1.4, ah);
            beacons.push({ x: ax, y: top - ch - ah, phase: r() * 6.28, near });
          }
        }
        g.fillStyle = rgba(layer.edge, layer.edgeAlpha);
        g.fillRect(x, top, bw, 1);
        g.fillRect(x, top, 1, bh);
        // Windows on a grid, most of them dark. Steady ones are drawn here,
        // the ones that fade in and out every frame.
        const size = near ? 3 : 2;
        for (let wy = top + 7; wy < h - 4; wy += near ? 9 : 7) {
          for (let wx = x + 4; wx < x + bw - 4; wx += near ? 7 : 5) {
            if (r() >= layer.windowOdds) continue;
            const color = r() < .55 ? CYAN : (r() < .75 ? VIOLET : ROSE);
            if (r() < .7) {
              g.fillStyle = rgba(color, .32 * layer.window);
              g.fillRect(wx, wy, size, 2);
            } else {
              windows.push({ x: wx, y: wy, size, color, alpha: layer.window, phase: r() * 6.28, speed: .2 + r() * .8 });
            }
          }
        }
        x += bw + (near ? r() * 18 : r() * 6);
      }
      if (!near) {
        const fog = g.createLinearGradient(0, h * .55, 0, h);
        fog.addColorStop(0, 'rgba(5,6,11,0)');
        fog.addColorStop(1, depth ? 'rgba(20,18,40,.55)' : 'rgba(30,24,60,.55)');
        g.fillStyle = fog;
        g.fillRect(0, h * .55, w, h * .45);
      }
    });

    return { city, windows, beacons, sign: small ? null : buildSign(g, w, h) };
  }

  // The Afterlife, on a dark corner block of its own, glow drawn once.
  function buildSign(g, w, h) {
    const size = 17;
    const font = `700 ${size}px "Big Shoulders Display", "Arial Narrow", sans-serif`;
    g.font = font;
    if ('letterSpacing' in g) g.letterSpacing = `${size * .18}px`;
    const textWidth = Math.ceil(g.measureText('AFTERLIFE').width);
    if ('letterSpacing' in g) g.letterSpacing = '0px';

    const image = document.createElement('canvas');
    image.width = textWidth + 40;
    image.height = size + 40;
    const s = image.getContext('2d');
    s.font = font;
    if ('letterSpacing' in s) s.letterSpacing = `${size * .18}px`;
    s.textBaseline = 'top';
    s.shadowColor = rgba(ROSE, 1);
    s.shadowBlur = 12;
    s.fillStyle = 'rgb(255,214,224)';
    s.fillText('AFTERLIFE', 20, 16);
    s.shadowBlur = 6;
    s.fillStyle = rgba(ROSE, .9);
    s.fillRect(20, 16 + size + 5, textWidth, 1.5);

    const blockWidth = textWidth + 70;
    const blockHeight = h * .2;
    const bx = w - blockWidth + 10;
    g.fillStyle = 'rgb(6,7,13)';
    g.fillRect(bx, h - blockHeight, blockWidth, blockHeight);
    g.fillStyle = rgba(ROSE, .14);
    g.fillRect(bx, h - blockHeight, blockWidth, 1);
    return { image, x: bx - 2, y: h - size - 60 };
  }

  const canvas = document.createElement('canvas');
  canvas.className = 'signal-backdrop';
  canvas.setAttribute('aria-hidden', 'true');
  const context = canvas.getContext('2d');
  const moon = new Image();
  moon.className = 'signal-moon';
  moon.alt = '';
  moon.decoding = 'async';
  moon.src = '/images/backdrop-moon.svg';
  document.body.prepend(moon, canvas);

  let width = 0;
  let height = 0;
  let scene = null;
  let raf = 0;
  let last = 0;
  let time = 0;

  function build() {
    width = document.documentElement.clientWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    const small = width < 768;
    const r = random(7);
    const density = small ? .6 : 1;
    scene = buildCity(width, height, r, small);
    scene.drops = Array.from({ length: Math.round(width * height / 9000 * density) }, () => ({
      x: r() * width * 1.2, y: r() * height, length: 8 + r() * 22, speed: 120 + r() * 220, depth: r(), color: r() < .7 ? CYAN : VIOLET
    }));
    scene.cars = Array.from({ length: Math.max(2, Math.round(width / 260 * density)) }, () => ({
      x: r() * width, y: height * (.45 + r() * .3), speed: (r() < .5 ? -1 : 1) * (14 + r() * 30), color: r() < .5 ? ROSE : CYAN
    }));
  }

  function draw(dt) {
    const c = context;
    const { city, windows, beacons, sign, cars, drops } = scene;
    c.clearRect(0, 0, width, height);
    const haze = c.createLinearGradient(0, height * .4, 0, height);
    haze.addColorStop(0, 'rgba(168,139,255,0)');
    haze.addColorStop(1, 'rgba(168,139,255,.09)');
    c.fillStyle = haze;
    c.fillRect(0, height * .4, width, height * .6);
    c.drawImage(city, 0, 0);

    windows.forEach(win => {
      const a = .5 + .5 * Math.sin(time * win.speed + win.phase);
      c.fillStyle = rgba(win.color, .45 * win.alpha * a);
      c.fillRect(win.x, win.y, win.size, 2);
    });
    beacons.forEach(b => {
      const on = Math.sin(time * 1.6 + b.phase) > .6;
      c.fillStyle = rgba(ROSE, on ? (b.near ? .8 : .45) : .12);
      c.fillRect(b.x - 1, b.y - 1, 2.5, 2.5);
    });
    if (sign) {
      // Lit, with a short stutter every nine seconds or so.
      const cycle = (time + 3) % 9;
      const stutter = cycle > 8.4 && Math.sin(cycle * 60) > 0;
      c.globalAlpha = stutter ? .2 : .78 + .08 * Math.sin(time * 3);
      c.drawImage(sign.image, sign.x, sign.y);
      c.globalAlpha = 1;
    }
    cars.forEach(car => {
      car.x += car.speed * dt;
      if (car.x < -40) car.x = width + 40;
      else if (car.x > width + 40) car.x = -40;
      const back = -Math.sign(car.speed) * 26;
      const tail = c.createLinearGradient(car.x, 0, car.x + back, 0);
      tail.addColorStop(0, rgba(car.color, .6));
      tail.addColorStop(1, rgba(car.color, 0));
      c.fillStyle = tail;
      c.fillRect(Math.min(car.x, car.x + back), car.y, 26, 1.2);
      c.fillStyle = 'rgba(255,255,255,.7)';
      c.fillRect(car.x - 1, car.y - .4, 2, 2);
    });
    c.lineCap = 'round';
    drops.forEach(d => {
      d.y += d.speed * (.5 + d.depth) * dt;
      d.x -= d.speed * .18 * (.5 + d.depth) * dt;
      if (d.y > height + 30) {
        d.y = -30;
        d.x = Math.random() * width * 1.2;
      }
      c.strokeStyle = rgba(d.color, .06 + d.depth * .16);
      c.lineWidth = d.depth > .8 ? 1.2 : .8;
      c.beginPath();
      c.moveTo(d.x, d.y);
      c.lineTo(d.x + d.length * .18, d.y - d.length);
      c.stroke();
    });
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (now - last < 33) return;
    const dt = last ? Math.min(.1, (now - last) / 1000) : 0;
    last = now;
    time += dt;
    draw(dt);
  }

  function start() {
    if (!raf && !document.hidden) raf = requestAnimationFrame(frame);
  }

  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
  }

  function still() {
    // Let the rain fall for a moment so the still frame isn't empty.
    for (let i = 0; i < 90; i++) {
      time += 1 / 30;
      draw(1 / 30);
    }
  }

  build();
  if (reduceMotion) {
    still();
  } else {
    start();
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  }

  // Phones resize the viewport as the address bar slides; only rebuild when
  // the width changes or the height changes a lot.
  let timer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const w = document.documentElement.clientWidth;
      if (w === width && Math.abs(window.innerHeight - height) < 120) return;
      build();
      if (reduceMotion) still();
    }, 200);
  });
})();
