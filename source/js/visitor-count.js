(function() {
  'use strict';

  // Visitor counts from Vercount (vercount.one, the busuanzi-compatible
  // counter). This is a small client of its public API, so no third-party
  // script runs on the page: one POST per page view, numbers written with
  // textContent into #vercount_value_site_uv / site_pv / page_pv. Local
  // previews are not counted. If the request fails the "—" stays.
  const API = 'https://events.vercount.one/api/v2/log';
  const FIELDS = ['site_uv', 'site_pv', 'page_pv'];

  if (/^(localhost|127\.|\[::1\]$)/.test(window.location.hostname)) return;
  const outputs = FIELDS.map(field => [field, document.getElementById('vercount_value_' + field)]);
  if (!outputs.some(([, element]) => element)) return;

  // A unique visitor is one without the year-long cookie, the same rule as
  // Vercount's own script, so counts stay consistent with it.
  const cookie = 'vercount_uv_' + window.location.host.replace(/[^a-zA-Z0-9_-]/g, '_');
  const isNewUv = !document.cookie.split('; ').includes(cookie + '=1');
  if (isNewUv) document.cookie = cookie + '=1; path=/; max-age=31536000; samesite=lax; secure';

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 5000);

  fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: window.location.href, isNewUv }),
    credentials: 'omit',
    referrerPolicy: 'strict-origin-when-cross-origin',
    signal: controller.signal
  })
    .then(response => (response.ok ? response.json() : null))
    .then(result => {
      const data = result && result.data;
      if (!data) return;
      outputs.forEach(([field, element]) => {
        const value = Number(data[field]);
        if (element && Number.isFinite(value)) element.textContent = value.toLocaleString('en-US');
      });
    })
    .catch(() => {})
    .finally(() => window.clearTimeout(timer));
})();
