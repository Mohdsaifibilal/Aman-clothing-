/**
 * ═══════════════════════════════════════════════════════════
 * ENGINE / renderer.js
 * Path: js/engine/renderer.js
 *
 * Depends on: core.js
 *
 * DOM utilities — no business logic, no API calls.
 * All components and pages use these helpers.
 *
 * PRODUCTION IMPROVEMENTS:
 *  1. escape() — XSS protection on ALL user/DB strings
 *  2. safeUrl() — blocks javascript: and data: URLs
 *  3. showError() — accepts optional retry callback
 *  4. animateIn() — uses requestAnimationFrame (no layout thrash)
 *  5. mount() — logs missing target as error (not silent noop)
 * ═══════════════════════════════════════════════════════════
 */

Engine.Renderer = (() => {

  function _el(target) {
    return typeof target === 'string' ? document.querySelector(target) : target;
  }

  /* ─────────────────────────────────────────────────────────
     MOUNT
     ───────────────────────────────────────────────────────── */

  function mount(target, html) {
    const el = _el(target);
    if (!el) {
      Engine.Logger.error('Renderer', `Mount target not found: ${target}`);
      return null;
    }
    el.innerHTML = html;
    return el;
  }

  function append(target, html) {
    const el = _el(target);
    if (!el) return null;
    el.insertAdjacentHTML('beforeend', html);
    return el;
  }

  /* ─────────────────────────────────────────────────────────
     STANDARD STATES
     ───────────────────────────────────────────────────────── */

  function showLoader(target) {
    mount(target, `
      <div class="page-loader" aria-busy="true" aria-label="Loading">
        <div class="loader-ring"></div>
      </div>
    `);
  }

  function showEmpty(target, {
    icon   = '📭',
    title  = 'Nothing here',
    desc   = '',
    action = '',
  } = {}) {
    mount(target, `
      <div class="empty-state">
        <div class="empty-state-icon" aria-hidden="true">${icon}</div>
        <h3 class="empty-state-title">${escape(title)}</h3>
        ${desc   ? `<p class="empty-state-desc">${escape(desc)}</p>` : ''}
        ${action ? `<div class="mt-4">${action}</div>` : ''}
      </div>
    `);
  }

  function showError(target, msg = 'Something went wrong', onRetry = null) {
    const retryHtml = onRetry
      ? `<button class="btn btn-outline mt-4" id="renderer-retry-btn">Try again</button>`
      : `<button class="btn btn-outline mt-4" onclick="location.reload()">Reload page</button>`;

    mount(target, `
      <div class="error-state" role="alert">
        <div style="font-size:2.5rem;margin-bottom:1rem">⚠️</div>
        <p style="color:var(--color-text-muted);margin-bottom:1rem">${escape(msg)}</p>
        ${retryHtml}
      </div>
    `);

    if (onRetry) {
      document.getElementById('renderer-retry-btn')?.addEventListener('click', onRetry);
    }
  }

  /* ─────────────────────────────────────────────────────────
     ANIMATION
     ───────────────────────────────────────────────────────── */

  function animateIn(el) {
    if (!el) return;
    requestAnimationFrame(() => {
      el.classList.remove('page-enter');
      requestAnimationFrame(() => el.classList.add('page-enter'));
    });
  }

  /* ─────────────────────────────────────────────────────────
     SECURITY HELPERS
     ───────────────────────────────────────────────────────── */

  /* XSS protection — use on ALL user/database strings in templates */
  function escape(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/`/g, '&#96;');
  }

  /* Validate URLs — blocks javascript: and data: schemes */
  function safeUrl(url, fallback = '') {
    if (!url || typeof url !== 'string') return fallback;
    const trimmed = url.trim();
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return trimmed;
      Engine.Logger.warn('Renderer', `Blocked unsafe URL: ${parsed.protocol}`);
      return fallback;
    } catch (_) {
      if (trimmed.startsWith('/') || trimmed.startsWith('./')) return trimmed;
      return fallback;
    }
  }

  function attr(obj) {
    return Object.entries(obj)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([k, v]) => `${escape(k)}="${escape(String(v))}"`)
      .join(' ');
  }

  /* ─────────────────────────────────────────────────────────
     MISC
     ───────────────────────────────────────────────────────── */

  function setText(target, text) {
    const el = _el(target);
    if (el) el.textContent = text;
  }

  function toggleClass(target, cls, force) {
    const el = _el(target);
    if (el) el.classList.toggle(cls, force);
  }

  Engine.Logger.info('Renderer', 'DOM renderer ready ✓');

  return {
    mount, append,
    showLoader, showEmpty, showError,
    animateIn,
    escape, safeUrl, attr,
    setText, toggleClass,
  };

})();
