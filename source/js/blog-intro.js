(function() {
  'use strict';

  const root = document.documentElement;
  const intro = document.querySelector('[data-blog-intro]');
  if (!intro || !root.classList.contains('blog-intro-pending')) {
    intro?.remove();
    return;
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const skipButton = intro.querySelector('[data-intro-skip]');
  const canvas = intro.querySelector('[data-intro-stars]');
  const context = canvas?.getContext('2d');
  const startedAt = performance.now();
  let stars = [];
  let animationFrame = 0;
  let lastFrame = startedAt;
  let closing = false;
  let failsafeTimer = 0;

  try {
    window.sessionStorage.setItem('silen1:intro-seen', '1');
  } catch (error) {
    // Storage is optional; the visual experience still works without it.
  }

  intro.hidden = false;
  root.classList.add('blog-intro-active');
  requestAnimationFrame(() => intro.classList.add('is-ready'));

  function createStars(width, height) {
    const density = Math.min(170, Math.max(80, Math.floor((width * height) / 9500)));
    return Array.from({ length: density }, () => ({
      x: (Math.random() - 0.5) * width,
      y: (Math.random() - 0.5) * height,
      z: Math.random() * width + 1,
      size: Math.random() * 1.25 + 0.25,
      brightness: Math.random() * 0.55 + 0.25
    }));
  }

  function resizeCanvas() {
    if (!canvas || !context) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars = createStars(width, height);
  }

  function drawStars(now) {
    if (!context || !canvas || closing) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const centerX = width / 2;
    const centerY = height / 2;
    const delta = Math.min(40, now - lastFrame);
    lastFrame = now;

    context.clearRect(0, 0, width, height);
    for (const star of stars) {
      const previousZ = star.z;
      star.z -= delta * 0.029;
      if (star.z < 1) {
        star.x = (Math.random() - 0.5) * width;
        star.y = (Math.random() - 0.5) * height;
        star.z = width;
      }

      const scale = 92 / star.z;
      const previousScale = 92 / previousZ;
      const x = centerX + star.x * scale;
      const y = centerY + star.y * scale;
      const previousX = centerX + star.x * previousScale;
      const previousY = centerY + star.y * previousScale;

      if (x < 0 || x > width || y < 0 || y > height) {
        star.z = width;
        continue;
      }

      const alpha = Math.min(0.85, star.brightness + (1 - star.z / width) * 0.45);
      context.beginPath();
      context.moveTo(previousX, previousY);
      context.lineTo(x, y);
      context.strokeStyle = `rgba(181, 193, 255, ${alpha})`;
      context.lineWidth = Math.max(0.5, star.size * (1 - star.z / width));
      context.stroke();
    }

    animationFrame = requestAnimationFrame(drawStars);
  }

  function finishIntro() {
    if (closing) return;
    closing = true;
    window.clearTimeout(failsafeTimer);
    window.cancelAnimationFrame(animationFrame);
    window.removeEventListener('keydown', handleKeydown);
    window.removeEventListener('resize', resizeCanvas);
    root.classList.remove('blog-intro-pending');
    intro.classList.add('is-leaving');

    window.setTimeout(() => {
      intro.remove();
      root.classList.remove('blog-intro-pending', 'blog-intro-active');
    }, reduceMotion ? 20 : 760);
  }

  function finishWhenReady() {
    const minimumDuration = reduceMotion ? 650 : 3600;
    const remaining = Math.max(0, minimumDuration - (performance.now() - startedAt));
    window.setTimeout(finishIntro, remaining);
  }

  function handleKeydown(event) {
    if (event.key === 'Escape') finishIntro();
  }

  skipButton?.addEventListener('click', finishIntro);
  window.addEventListener('keydown', handleKeydown);
  window.addEventListener('resize', resizeCanvas, { passive: true });

  if (!reduceMotion && context) {
    resizeCanvas();
    animationFrame = requestAnimationFrame(drawStars);
  }

  if (document.readyState === 'complete') {
    finishWhenReady();
  } else {
    window.addEventListener('load', finishWhenReady, { once: true });
  }

  failsafeTimer = window.setTimeout(finishIntro, 6500);
})();
