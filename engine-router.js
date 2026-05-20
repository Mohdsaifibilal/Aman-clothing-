/**
 * ═══════════════════════════════════════════════════════════
 * ENGINE / router.js
 * Path: js/engine/router.js
 *
 * NON-BLOCKING ROUTER:
 * · handler() called WITHOUT await — returns immediately
 * · No showLoader() — pages render their own skeletons
 * · Guards still async (auth checks need await)
 * · Navigation token prevents stale renders
 * · Scroll position restored per route
 * ═══════════════════════════════════════════════════════════
 */

Engine.Router = (() => {

  const _routes = [];
  const _guards = [];
  let   _current = null;
  let   _navToken = 0;

  const _scrollPositions = new Map();
  const _history  = [];
  const MAX_HIST  = 50;

  function register(pattern, handler, options = {}) {
    _routes.push({ pattern, handler, options, _regex: _compile(pattern) });
    Engine.Logger.debug('Router', `Registered: ${pattern}`);
  }

  function guard(fn) {
    _guards.push(fn);
  }

  function navigate(path) {
    if (_current) _scrollPositions.set(_current.path, window.scrollY);
    window.location.hash = path.startsWith('/') ? path : '/' + path;
  }

  function back() {
    if (_history.length >= 2) {
      _history.pop();
      window.location.hash = _history[_history.length - 1];
    } else {
      navigate('/');
    }
  }

  function current() { return _current; }

  function _resolve(hash) {
    const raw  = hash.replace(/^#\/?/, '') || '/';
    const path = raw.startsWith('/') ? raw : '/' + raw;
    for (const route of _routes) {
      const match = path.match(route._regex);
      if (match) {
        return {
          pattern: route.pattern,
          path,
          params:  _extractParams(route.pattern, match),
          handler: route.handler,
          options: route.options,
        };
      }
    }
    return null;
  }

  function _compile(pattern) {
    // FIX: Protect :params, escape regex specials, restore as capture groups.
    var escaped = pattern.replace(/:[a-zA-Z_]+/g, 'ROUTEPARAM');
    escaped = escaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    escaped = escaped.replace(/ROUTEPARAM/g, '([^/]+)');
    return new RegExp('^' + escaped + '$');
  }

  function _extractParams(pattern, match) {
    const names  = [...pattern.matchAll(/:([a-zA-Z_]+)/g)].map(m => m[1]);
    const values = match.slice(1);
    return Object.fromEntries(
      names.map((n, i) => [n, decodeURIComponent(values[i] || '')])
    );
  }

  async function _handleChange() {
    const hash  = window.location.hash || '#/';
    const route = _resolve(hash);

    if (!route) {
      Engine.Logger.warn('Router', `No route: ${hash}`);
      _render404();
      return;
    }

    const myToken = ++_navToken;

    /* Run guards (auth checks are async — guards still await) */
    for (const g of _guards) {
      let allowed;
      try { allowed = await g(route); }
      catch (e) { Engine.Logger.error('Router', 'Guard threw', e); allowed = false; }
      if (!allowed) return;
      if (myToken !== _navToken) return; /* Superseded during guard */
    }

    /* Push history */
    const currentHash = window.location.hash;
    if (_history[_history.length - 1] !== currentHash) {
      _history.push(currentHash);
      if (_history.length > MAX_HIST) _history.shift();
    }

    _current = route;
    Engine.Store.set('route', { path: route.path, params: route.params });
    Engine.EventBus.emit(Engine.Events.ROUTE_CHANGED, route);
    Engine.Logger.info('Router', `→ ${route.path}`, route.params);

    /* ── NON-BLOCKING: call handler WITHOUT await ──
       Handler renders skeleton immediately and returns.
       Data loads in background via Store.subscribe().    */
    try {
      route.handler(route.params);
    } catch (err) {
      Engine.Logger.error('Router', `Handler error on ${route.path}`, err);
      Engine.Renderer.showError('#app-root', 'Something went wrong loading this page.');
      return;
    }

    /* Animate after handler has painted its skeleton */
    requestAnimationFrame(() => {
      if (myToken !== _navToken) return;
      Engine.Renderer.animateIn(document.getElementById('app-root'));
      const savedY = _scrollPositions.get(route.path);
      window.scrollTo({ top: savedY || 0, behavior: 'instant' });
    });
  }

  function _render404() {
    Engine.Renderer.mount('#app-root', `
      <div class="empty-state"
           style="min-height:70vh;display:flex;flex-direction:column;align-items:center;justify-content:center;">
        <div class="empty-state-icon">🗺️</div>
        <h2 class="empty-state-title">Page not found</h2>
        <p class="empty-state-desc">The page you're looking for doesn't exist.</p>
        <a class="btn btn-primary mt-4" href="#/">← Back home</a>
      </div>
    `);
  }

  function start() {
    window.addEventListener('hashchange', _handleChange);
    _handleChange();
    Engine.Logger.info('Router', 'Started ✓');
  }

  return { register, guard, navigate, back, current, start };

})();

Engine.Logger.info('Router', 'Router module ready ✓');
