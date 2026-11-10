(function() {
  'use strict';

  // Graphic intro, no text: a point of light blooms into rotating rose curves
  // and a tick ring, then collapses into a single line like a CRT power-off.
  // The line then settles where the home hero draws its signal wave, a pulse
  // runs out from its centre and turns it into that wave, the curtain closes
  // onto it, and the wordmark gathers out of the line (signal.js).
  const root = document.documentElement;
  const intro = document.querySelector('[data-blog-intro]');
  if (!intro || !root.classList.contains('blog-intro-pending')) {
    intro?.remove();
    return;
  }

  const skipButton = intro.querySelector('[data-intro-skip]');
  const canvas = intro.querySelector('[data-intro-canvas]');
  const context = canvas?.getContext('2d');
  const LAYERS = [[3, 1], [5, 2], [7, 3], [4, 3], [2, 5]];
  const DURATION = 4.05;
  const LAND = 3.45;
  // Where the hero's wave sits, as a share of the screen height (signal.js).
  const waveAt = () => (window.innerWidth < 760 ? 0.56 : 0.62);
  const startedAt = performance.now();
  let width = 0;
  let height = 0;
  let animationFrame = 0;
  let closing = false;
  let wavePhase = false;
  let failsafeTimer = 0;

  try {
    window.sessionStorage.setItem('silen1:intro-seen', '1');
  } catch (error) {
    // Storage is optional; the visual experience still works without it.
  }

  intro.hidden = false;
  root.classList.add('blog-intro-active');

  const clamp = value => Math.min(1, Math.max(0, value));
  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  function resizeCanvas() {
    if (!canvas || !context) return;
    width = window.innerWidth;
    height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.fillStyle = '#05060b';
    context.fillRect(0, 0, width, height);
  }

  // The hero's wave in signal.js (drawHero), at rAF time `now`, with the
  // mouse still centred. Keep the two in step.
  const heroWave = (x, now, base) => {
    const T = now * 0.001;
    const near = Math.exp(-Math.pow((x - width / 2) / 260, 2));
    return base + Math.sin(x * 0.03 + T * 2.4) * (3 + near * 5) + Math.sin(x * 0.011 - T * 1.2) * 3;
  };

  // Strokes a line y(x). `look` 0 is the intro's flat bright line, 1 is the
  // hero's thin wave that fades out at both ends (cyan to violet).
  function strokeLine(y, look) {
    const gradient = context.createLinearGradient(0, 0, width, 0);
    const edge = 0.9 * (1 - look);
    gradient.addColorStop(0, `rgba(124, 236, 255, ${edge})`);
    gradient.addColorStop(0.5, `rgba(124, 236, 255, ${0.9 - 0.2 * look})`);
    gradient.addColorStop(1, `rgba(${124 + 44 * look | 0}, ${236 - 97 * look | 0}, 255, ${edge})`);
    context.beginPath();
    for (let x = 0; x <= width; x += 3) {
      if (x) context.lineTo(x, y(x));
      else context.moveTo(x, y(x));
    }
    context.strokeStyle = gradient;
    context.lineWidth = 2 - 0.9 * look;
    context.stroke();
  }

  function drawWave(t, now) {
    const target = height * waveAt();
    const fall = ease(clamp((t - 2.95) / (LAND - 2.95)));
    const lineY = height / 2 + (target - height / 2) * fall;
    context.fillStyle = 'rgba(5, 6, 11, 0.42)';
    context.fillRect(0, 0, width, height);

    // On landing a pulse runs out from the centre to both ends;
    // behind it the line already carries the wave, ahead it is still flat.
    const since = Math.max(0, t - LAND);
    const reach = t < LAND ? 0 : ease(clamp(since / 0.55)) * (width / 2 + 120);
    const soft = 90;
    const behind = x => clamp((reach - Math.abs(x - width / 2)) / soft + 0.5);
    const look = ease(clamp(since / 0.6));
    strokeLine(x => {
      const d = Math.abs(x - width / 2) - reach;
      const kick = Math.exp(-d * d / 700) * Math.sin(d * 0.12) * 10 * (1 - look * 0.6);
      return lineY + (heroWave(x, now, target) - target) * behind(x) + (reach ? kick : 0);
    }, look);
    if (reach && reach < width / 2 + 60) {
      const glint = 1 - look;
      [-1, 1].forEach(side => {
        const x = width / 2 + side * reach;
        const g = context.createRadialGradient(x, lineY, 0, x, lineY, 26);
        g.addColorStop(0, `rgba(231, 234, 244, ${0.95 * glint})`);
        g.addColorStop(0.3, `rgba(124, 236, 255, ${0.45 * glint})`);
        g.addColorStop(1, 'rgba(124, 236, 255, 0)');
        context.fillStyle = g;
        context.fillRect(x - 26, lineY - 26, 52, 52);
      });
    }
    intro.style.setProperty('--intro-line', `${lineY}px`);
  }

  function drawFrame(now) {
    if (closing) {
      // Keep the wave moving while the curtain closes onto it, so the
      // hand-off to the hero's wave underneath has no seam.
      if (wavePhase && context && intro.isConnected) {
        drawWave(Math.max(DURATION, (now - startedAt) / 1000), now);
        animationFrame = requestAnimationFrame(drawFrame);
      }
      return;
    }
    if (!context) return;
    const t = (now - startedAt) / 1000;

    // After the power-off: the line glides down and turns into the hero's wave.
    if (t > 2.95) {
      wavePhase = true;
      drawWave(t, now);
      if (t < DURATION) animationFrame = requestAnimationFrame(drawFrame);
      else finishIntro();
      return;
    }

    const radius = Math.min(width, height) * 0.36;
    const grow = ease(clamp((t - 0.25) / 1.5));
    const flatten = ease(clamp((t - 2.4) / 0.55));

    context.fillStyle = 'rgba(5, 6, 11, 0.22)';
    context.fillRect(0, 0, width, height);
    context.save();
    context.translate(width / 2, height / 2);
    context.scale(1 + flatten * 1.8, Math.max(0.004, 1 - flatten));

    const core = clamp(t / 0.4) * (1 - grow * 0.6);
    const glow = context.createRadialGradient(0, 0, 0, 0, 0, radius * 0.25);
    glow.addColorStop(0, `rgba(231, 234, 244, ${0.9 * core})`);
    glow.addColorStop(0.25, `rgba(124, 236, 255, ${0.35 * core})`);
    glow.addColorStop(1, 'rgba(124, 236, 255, 0)');
    context.fillStyle = glow;
    context.beginPath();
    context.arc(0, 0, radius * 0.25, 0, Math.PI * 2);
    context.fill();

    LAYERS.forEach(([n, d], layer) => {
      const k = n / d;
      const turns = d * Math.PI * 2;
      const r0 = radius * grow * (0.42 + layer * 0.14);
      const rotation = t * (0.25 + layer * 0.07) * (layer % 2 ? 1 : -1);
      const mix = layer / (LAYERS.length - 1);
      context.beginPath();
      for (let i = 0; i <= 900; i++) {
        const theta = i / 900 * turns;
        const r = r0 * Math.cos(k * theta + t * 0.8);
        const x = r * Math.cos(theta + rotation);
        const y = r * Math.sin(theta + rotation);
        if (i) context.lineTo(x, y);
        else context.moveTo(x, y);
      }
      context.strokeStyle = `rgba(${124 + 44 * mix | 0}, ${236 - 97 * mix | 0}, 255, ${0.16 + 0.2 * grow})`;
      context.lineWidth = 0.8;
      context.stroke();
    });

    const ring = radius * 1.08 * grow;
    context.strokeStyle = `rgba(150, 170, 255, ${0.35 * grow})`;
    context.lineWidth = 1;
    context.beginPath();
    for (let i = 0; i < 144; i++) {
      const angle = i / 144 * Math.PI * 2 + t * 0.1;
      const length = i % 12 === 0 ? 14 : (i % 4 === 0 ? 7 : 3);
      context.moveTo(Math.cos(angle) * ring, Math.sin(angle) * ring);
      context.lineTo(Math.cos(angle) * (ring + length), Math.sin(angle) * (ring + length));
    }
    context.stroke();

    const sweep = t * 1.6;
    context.strokeStyle = `rgba(124, 236, 255, ${0.6 * grow})`;
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(Math.cos(sweep) * ring, Math.sin(sweep) * ring);
    context.stroke();
    context.restore();

    if (flatten > 0.6) {
      context.fillStyle = `rgba(124, 236, 255, ${(flatten - 0.6) * 2.2})`;
      context.fillRect(0, height / 2 - 1, width, 2);
    }

    if (t < DURATION) animationFrame = requestAnimationFrame(drawFrame);
    else finishIntro();
  }

  function finishIntro() {
    if (closing) return;
    closing = true;
    window.clearTimeout(failsafeTimer);
    window.cancelAnimationFrame(animationFrame);
    if (wavePhase) animationFrame = requestAnimationFrame(drawFrame);
    SKIP_EVENTS.forEach(type => window.removeEventListener(type, handleSkip));
    window.removeEventListener('resize', resizeCanvas);
    root.classList.remove('blog-intro-pending');
    // A skipped intro closes onto the wave too.
    if (!intro.style.getPropertyValue('--intro-line')) {
      intro.style.setProperty('--intro-line', `${height * waveAt()}px`);
    }
    intro.classList.add('is-leaving');
    window.dispatchEvent(new CustomEvent('blog-intro:end'));

    window.setTimeout(() => {
      intro.remove();
      root.classList.remove('blog-intro-pending', 'blog-intro-active');
    }, 720);
  }

  function handleSkip() {
    finishIntro();
  }

  // Any sign of the reader wanting the page ends the intro at once.
  const SKIP_EVENTS = ['keydown', 'wheel', 'touchstart', 'pointerdown'];
  intro.addEventListener('click', finishIntro);
  skipButton?.addEventListener('click', finishIntro);
  SKIP_EVENTS.forEach(type => window.addEventListener(type, handleSkip, { passive: true }));
  window.addEventListener('resize', resizeCanvas, { passive: true });

  if (context) {
    resizeCanvas();
    animationFrame = requestAnimationFrame(drawFrame);
  } else {
    finishIntro();
  }

  failsafeTimer = window.setTimeout(finishIntro, 6500);
})();
