/**
 * ═══════════════════════════════════════════════════════════
 * app.js — Application Bootstrap
 * Path: js/app.js
 *
 * Runs LAST — after all engine, components, and pages load.
 * Initialises everything in the correct order.
 *
 * LOAD ORDER (set in index.html):
 *  [A] supabase CDN
 *  [B] sites/config.js
 *  [C] js/engine/core.js      → Engine namespace, Logger, EventBus, Events
 *  [D] js/engine/store.js     → Engine.Store
 *  [E] js/engine/cart.js      → Engine.Cart
 *  [F] js/engine/supabase.js  → SupabaseClient
 *  [G] js/engine/api.js       → Engine.API
 *  [H] js/engine/logic.js     → Engine.Logic
 *  [I] js/engine/renderer.js  → Engine.Renderer
 *  [J] js/engine/router.js    → Engine.Router
 *  [K] js/components/*
 *  [L] js/pages/*
 *  [M] js/app.js              → THIS FILE
 * ═══════════════════════════════════════════════════════════
 */

(async function Bootstrap() {

  performance.mark('engine-boot-start');
  Engine.Logger.info('App', `🚀 Starting "${window.SITE_CONFIG.name}"`);

  /* ── 1. Apply CSS variable overrides from config.theme ── */
  _applyTheme();

  /* ── 2. Set page title immediately — removes "Loading..." ── */
  document.title = window.SITE_CONFIG.name;
  const titleEl  = document.getElementById('site-title');
  if (titleEl) titleEl.textContent = window.SITE_CONFIG.name;

  /* ── 3. Initialise Supabase client ── */
  SupabaseClient.init();

  /* Clear stale localStorage product cache on boot so demo products
     cached before Supabase was connected do not mix with real products */
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith('engine_cache_products'))
      .forEach(k => localStorage.removeItem(k));
  } catch(e) {}

  /* ── 4. Init Payment layer ── */
  Engine.Payment.init(window.SITE_CONFIG.payment);

  /* ── 5. Restore cart from localStorage ── */
  Engine.Cart.restore();

  /* ── 5. Auth state change listener ── */
  Engine.API.onAuthStateChange((user) => {
    const isAdmin = user ? Engine.Logic.isAdmin(user) : false;
    Engine.Store.batch(() => {
      Engine.Store.set('user', user);
      Engine.Store.set('isAdmin', isAdmin);
    });
    Engine.EventBus.emit(
      user ? Engine.Events.USER_SIGNED_IN : Engine.Events.USER_SIGNED_OUT,
      user
    );
    /* AUTH_CHANGED — navbar listens to this to re-render with/without admin link */
    Engine.EventBus.emit(Engine.Events.AUTH_CHANGED, user);
    Engine.Components.Navbar.render();
  });

  /* ── 6. Mount persistent components ── */
  Engine.Components.Navbar.init();
  Engine.Components.Cart.init();
  Engine.Components.Modal.init();
  Engine.Components.Notify.init();
  Engine.Components.Footer.render();

  /* ── 7. Admin route guard ── */
  Engine.Router.guard((route) => {
    if (!route.pattern.startsWith('/admin')) return true;
    const user = Engine.Store.get('user');
    if (Engine.Logic.isAdmin(user)) return true;
    Engine.Logger.warn('App', 'Admin access blocked — not authenticated');
    Engine.EventBus.emit(Engine.Events.NOTIFY, {
      msg:  'Please sign in as admin to access this page',
      type: 'warning',
    });
    Engine.Router.navigate('/auth');
    return false;
  });

  /* ── 8. Restore existing session FIRST (before router) ──
     Admin panel needs user state before route guard runs.
     Race with 2s timeout — fast enough, doesn't block.   */
  try {
    const sessionResult = await Promise.race([
      Engine.API.getSession(),
      new Promise(resolve => setTimeout(() => resolve({ data: null }), 2000)),
    ]);
    const sessionUser = sessionResult?.data?.session?.user;
    if (sessionUser) {
      const isAdmin = Engine.Logic.isAdmin(sessionUser);
      Engine.Store.batch(() => {
        Engine.Store.set('user',    sessionUser);
        Engine.Store.set('isAdmin', isAdmin);
      });
      Engine.Components.Navbar.render();
      Engine.Logger.info('App', 'Session restored ✓ user=' + sessionUser.email);
    }
  } catch(e) {
    Engine.Logger.warn('App', 'Session restore failed', e);
  }

  /* ── 9. START ROUTER — user state already set above ── */
  Engine.Router.start();

  /* ── 10. Global error boundary ── */
  window.addEventListener('error', (e) => {
    Engine.Logger.error('App', 'Unhandled error', e.error || e.message);
  });

  window.addEventListener('unhandledrejection', (e) => {
    Engine.Logger.error('App', 'Unhandled promise rejection', e.reason);
  });

  /* ── 11. Refresh stale data when user returns to tab ── */
  const VISIBILITY_STALE_MS = 60_000;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const lastFetch = Engine.Store.get('productsLastFetch') || 0;
    if (Date.now() - lastFetch > VISIBILITY_STALE_MS) {
      Engine.Logger.debug('App', 'Tab visible — refreshing stale products in background');
      Engine.API.getProducts();
    }
  });

  /* ── 12. Boot time measurement ── */
  performance.mark('engine-boot-end');
  performance.measure('Engine Boot', 'engine-boot-start', 'engine-boot-end');
  const [measure] = performance.getEntriesByName('Engine Boot');
  Engine.Logger.info('App', `✅ Ready in ${Math.round(measure.duration)}ms`);

})();

/* ── Apply CSS variables from config.theme ── */
function _applyTheme() {
  const theme = window.SITE_CONFIG.theme || {};
  if (!Object.keys(theme).length) return;
  const root = document.documentElement;
  Object.entries(theme).forEach(([key, val]) => {
    root.style.setProperty(key, val);
  });
  Engine.Logger.debug('App', 'Theme tokens applied', theme);
}
