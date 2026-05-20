/**
 * COMPONENT / modal.js
 * Also contains: Footer, Notify
 *
 * PRODUCTION IMPROVEMENTS (Modal):
 *  1. ESC key closes modal
 *  2. Focus trap within modal
 *  3. Focus restored to trigger element on close
 *  4. aria-modal + aria-labelledby for screen readers
 *
 * PRODUCTION IMPROVEMENTS (Notify):
 *  1. Notification queue — max 4 visible at once
 *  2. Duplicate message suppression — same message within 2s ignored
 *  3. Manual dismiss on click
 *  4. ARIA live region for screen readers (already in HTML)
 */

Engine.Components = Engine.Components || {};

/* ═══════════════════════════════════════════════════════════
   MODAL
   ═══════════════════════════════════════════════════════════ */
Engine.Components.Modal = (() => {

  let _triggerEl = null; /* Element that opened modal — restored on close */

  function open({ title = '', content = '', onConfirm = null } = {}) {
    /* Save the currently focused element */
    _triggerEl = document.activeElement;

    Engine.Renderer.mount('#modal-content', `
      <div class="modal-header">
        <h2 class="modal-title" id="modal-title">${Engine.Renderer.escape(title)}</h2>
        <button class="modal-close" id="modal-close-btn" aria-label="Close modal">✕</button>
      </div>
      <div id="modal-body">${content}</div>
    `);

    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
      overlay.classList.add('open');
      overlay.setAttribute('aria-labelledby', 'modal-title');
    }

    document.body.style.overflow = 'hidden';

    /* Bind close button */
    document.getElementById('modal-close-btn')?.addEventListener('click', close);

    /* Focus first focusable element inside modal */
    requestAnimationFrame(() => {
      const modal     = document.getElementById('modal-content');
      const focusable = modal?.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      focusable?.focus();
    });

    /* Focus trap + ESC */
    document.addEventListener('keydown', _handleKey);
  }

  function close() {
    document.getElementById('modal-overlay')?.classList.remove('open');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', _handleKey);

    /* Restore focus to the element that triggered the modal */
    requestAnimationFrame(() => _triggerEl?.focus());
    _triggerEl = null;
  }

  function _handleKey(e) {
    if (e.key === 'Escape') { close(); return; }

    if (e.key !== 'Tab') return;

    const modal     = document.getElementById('modal-content');
    const focusable = Array.from(modal?.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ) || []);
    if (!focusable.length) return;

    const first = focusable[0];
    const last  = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  }

  function init() {
    Engine.EventBus.on(Engine.Events.MODAL_OPEN,  open);
    Engine.EventBus.on(Engine.Events.MODAL_CLOSE, close);

    /* Overlay click closes (but not clicks inside .modal-content) */
    document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
      if (e.target === document.getElementById('modal-overlay')) close();
    });
  }

  return { init, open, close };

})();

/* ═══════════════════════════════════════════════════════════
   FOOTER
   ═══════════════════════════════════════════════════════════ */
Engine.Components.Footer = (() => {

  function render() {
    const cfg = window.SITE_CONFIG;

    const cols = (cfg.footer?.columns || []).map(col => `
      <div>
        <div class="footer-col-title">${Engine.Renderer.escape(col.title)}</div>
        ${col.links.map(l => `
          <a class="footer-link" href="${Engine.Renderer.escape(l.href)}">
            ${Engine.Renderer.escape(l.label)}
          </a>
        `).join('')}
      </div>
    `).join('');

    Engine.Renderer.mount('#footer-root', `
      <div class="footer">
        <div class="container">
          <div class="footer-inner">
            <div>
              <div class="footer-brand-name">${cfg.logo}</div>
              <p class="footer-brand-desc">${Engine.Renderer.escape(cfg.description)}</p>
            </div>
            ${cols}
          </div>
          <div class="footer-bottom">
            <span class="footer-copy">
              &copy; ${new Date().getFullYear()} ${Engine.Renderer.escape(cfg.name)}. All rights reserved.
            </span>
            <span class="footer-copy">Multi-Site Engine</span>
          </div>
        </div>
      </div>
    `);
  }

  return { render };

})();

/* ═══════════════════════════════════════════════════════════
   NOTIFICATIONS
   ═══════════════════════════════════════════════════════════ */
Engine.Components.Notify = (() => {

  const ICONS = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  const MAX_VISIBLE  = 4;
  const DISPLAY_MS   = 3500;
  const DEDUP_MS     = 2000;

  const _recent = []; /* [{ msg, ts }] for dedup */

  function show({ msg, type = 'info', duration = DISPLAY_MS }) {
    if (!msg) return;

    /* Dedup: same message within DEDUP_MS → ignore */
    const now   = Date.now();
    const duped = _recent.find(r => r.msg === msg && now - r.ts < DEDUP_MS);
    if (duped) return;
    _recent.push({ msg, ts: now });
    if (_recent.length > 20) _recent.shift();

    const container = document.getElementById('notification-container');
    if (!container) return;

    /* Max visible: remove oldest if over limit */
    const existing = container.querySelectorAll('.notification');
    if (existing.length >= MAX_VISIBLE) {
      existing[0].remove();
    }

    const el = document.createElement('div');
    el.className  = `notification ${type}`;
    el.innerHTML  = `
      <span class="notification-icon" aria-hidden="true">${ICONS[type] || 'ℹ'}</span>
      <span>${Engine.Renderer.escape(String(msg))}</span>
    `;
    el.setAttribute('role', 'status');
    el.style.cursor = 'pointer';
    el.title        = 'Click to dismiss';

    /* Manual dismiss */
    el.addEventListener('click', () => _dismiss(el));

    container.appendChild(el);

    /* Auto dismiss */
    setTimeout(() => _dismiss(el), duration);
  }

  function _dismiss(el) {
    if (!el.isConnected) return;
    el.style.opacity   = '0';
    el.style.transform = 'translateX(20px)';
    el.style.transition = 'all 0.2s ease';
    setTimeout(() => el.remove(), 220);
  }

  function init() {
    Engine.EventBus.on(Engine.Events.NOTIFY, show);
  }

  return { init, show };

})();
