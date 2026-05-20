/**
 * ═══════════════════════════════════════════════════════════
 * ENGINE / store.js
 * Path: js/engine/store.js
 *
 * Depends on: js/engine/core.js
 *
 * Centralised reactive state store.
 * · Components READ via Store.get()
 * · Engine writes via Store.set()
 * · Objects returned as deep copies — prevents accidental
 *   shared-reference mutations (very common silent bug)
 * · batch() — apply multiple changes, fire each subscriber
 *   only once after all changes applied (no cascade renders)
 * ═══════════════════════════════════════════════════════════
 */

Engine.Store = (() => {

  /* ── State shape — all keys must be declared here ── */
  const _state = {
    products:          [],
    productsLoading:   false,
    productsError:     null,
    productsLastFetch: 0,
    orders:            [],
    ordersLoading:     false,
    ordersError:       null,
    currentProduct:    null,
    cart:              [],
    user:              null,
    isAdmin:           false,
    route:             { path: '/', params: {} },
    loading:           false,
    /* ── Reviews ── */
    reviews:           [],
    reviewsLoading:    false,
    reviewsError:      null,
    reviewRating:      null,   /* { avg_rating, review_count } for current product */
    /* ── Newsletter ── */
    newsletterStatus:  null,   /* null | 'loading' | 'success' | 'error' */
    newsletterError:   null,
  };

  const _subs     = {};
  let   _batching = false;
  const _dirty    = new Set();

  /* ── get() returns deep copy for objects/arrays ── */
  function get(key) {
    if (!(key in _state)) {
      Engine.Logger.warn('Store', `Read of unknown key: "${key}"`);
      return undefined;
    }
    const val = _state[key];
    if (val === null || typeof val !== 'object') return val;
    try { return JSON.parse(JSON.stringify(val)); }
    catch (_) { return val; }
  }

  /* ── set() notifies subscribers immediately unless batching ── */
  function set(key, value) {
    if (!(key in _state)) {
      Engine.Logger.warn('Store', `Blocked write to unknown key: "${key}"`);
      return;
    }
    _state[key] = value;
    Engine.Logger.debug('Store', `set: ${key}`);
    if (_batching) {
      _dirty.add(key);
      return;
    }
    _notify(key, value);
  }

  function _notify(key, value) {
    (_subs[key] || []).forEach(fn => {
      try { fn(value); }
      catch (e) { Engine.Logger.error('Store', `Subscriber error on "${key}"`, e); }
    });
  }

  /* ── batch() — multiple sets, each subscriber fires once ── */
  function batch(fn) {
    _batching = true;
    try { fn(); }
    finally {
      _batching = false;
      _dirty.forEach(key => _notify(key, _state[key]));
      _dirty.clear();
    }
  }

  /* ── subscribe() — calls fn immediately with current value ── */
  function subscribe(key, fn) {
    if (!_subs[key]) _subs[key] = [];
    _subs[key].push(fn);
    fn(_state[key]);
    return () => { _subs[key] = (_subs[key] || []).filter(f => f !== fn); };
  }

  /* ── snapshot() — full read-only copy of entire state ── */
  function snapshot() {
    return JSON.parse(JSON.stringify(_state));
  }

  Engine.Logger.info('Store', 'State store ready ✓');
  return { get, set, subscribe, batch, snapshot };

})();
