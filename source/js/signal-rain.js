// Rain on the window, for the rain city behind the page. Off until the
// reader presses RAIN in the header; the choice is remembered in this
// browser and the sound comes back with the first click or key on later
// pages (browsers only start sound after the reader does something).
//
// No audio files: Web Audio makes it from noise. A soft hiss of rain, a low
// rumble of the city under it, and single drops ticking on the glass.
(function() {
  'use strict';

  const button = document.querySelector('[data-signal-rain]');
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!button || !AudioContext) return;
  button.hidden = false;

  const KEY = 'silen1:rain';
  let audio = null;
  let master = null;
  let dropTimer = 0;
  let on = false;

  function remember(value) {
    try {
      window.localStorage.setItem(KEY, value ? '1' : '0');
    } catch (error) {
      // Storage is optional; the button still works for this page.
    }
  }

  function remembered() {
    try {
      return window.localStorage.getItem(KEY) === '1';
    } catch (error) {
      return false;
    }
  }

  // Two seconds of noise, looped. Brown noise for the rumble is integrated
  // white noise, kept from drifting.
  function noiseBuffer(brown) {
    const length = audio.sampleRate * 2;
    const buffer = audio.createBuffer(1, length, audio.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      if (brown) {
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5;
      } else {
        data[i] = white;
      }
    }
    return buffer;
  }

  function loop(buffer, filters, gain) {
    const source = audio.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    let node = source;
    filters.forEach(([type, frequency, q]) => {
      const filter = audio.createBiquadFilter();
      filter.type = type;
      filter.frequency.value = frequency;
      if (q) filter.Q.value = q;
      node.connect(filter);
      node = filter;
    });
    const level = audio.createGain();
    level.gain.value = gain;
    node.connect(level).connect(master);
    source.start();
  }

  // One drop: a few milliseconds of noise through a narrow band, panned.
  function drop() {
    const white = audio.createBufferSource();
    white.buffer = drop.buffer || (drop.buffer = noiseBuffer(false));
    const band = audio.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 2200 + Math.random() * 3200;
    band.Q.value = 8;
    const level = audio.createGain();
    const now = audio.currentTime;
    level.gain.setValueAtTime(0, now);
    level.gain.linearRampToValueAtTime(0.05 + Math.random() * 0.08, now + 0.004);
    level.gain.exponentialRampToValueAtTime(0.0001, now + 0.06 + Math.random() * 0.06);
    let node = white.connect(band).connect(level);
    if (audio.createStereoPanner) {
      const pan = audio.createStereoPanner();
      pan.pan.value = Math.random() * 1.6 - 0.8;
      node = node.connect(pan);
    }
    node.connect(master);
    white.start(now, Math.random() * 1.5, 0.15);
    dropTimer = window.setTimeout(drop, 40 + Math.random() * 260);
  }

  function build() {
    audio = new AudioContext();
    master = audio.createGain();
    master.gain.value = 0;
    master.connect(audio.destination);
    const white = noiseBuffer(false);
    loop(white, [['highpass', 500], ['lowpass', 5200]], 0.05);
    loop(white, [['bandpass', 9000, 0.6]], 0.012);
    loop(noiseBuffer(true), [['lowpass', 260]], 0.09);
  }

  function setOn(value) {
    on = value;
    button.setAttribute('aria-pressed', String(on));
    if (on) {
      if (!audio) build();
      audio.resume();
      window.clearTimeout(dropTimer);
      drop();
    } else {
      window.clearTimeout(dropTimer);
    }
    if (audio) {
      const now = audio.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(on ? 0.9 : 0, now + (on ? 1.8 : 0.6));
    }
  }

  button.addEventListener('click', () => {
    setOn(!on);
    remember(on);
  });

  // Quiet while the tab is hidden.
  document.addEventListener('visibilitychange', () => {
    if (!audio || !on) return;
    if (document.hidden) {
      window.clearTimeout(dropTimer);
      audio.suspend();
    } else {
      audio.resume();
      drop();
    }
  });

  // Back on with the first thing the reader does, if they left it on.
  if (remembered()) {
    button.setAttribute('aria-pressed', 'true');
    const resume = event => {
      if (event.target.closest && event.target.closest('[data-signal-rain]')) return;
      ['pointerdown', 'keydown'].forEach(type => window.removeEventListener(type, resume, true));
      setOn(true);
    };
    ['pointerdown', 'keydown'].forEach(type => window.addEventListener(type, resume, true));
  }
})();
