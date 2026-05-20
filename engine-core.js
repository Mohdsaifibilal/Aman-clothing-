/**
 * ═══════════════════════════════════════════════════════════
 * ENGINE / core.js
 * Path: js/engine/core.js
 *
 * LOADS FIRST — before all other engine files.
 * Contains:
 *   · Engine namespace
 *   · Engine.Logger
 *   · Engine.EventBus
 *   · Engine.Events (catalogue)
 *
 * Every other engine file depends on this.
 * ═══════════════════════════════════════════════════════════
 */

window.Engine = window.Engine || {};

/* ─────────────────────────────────────────────────────────
   LOGGER
   · Silent in production (non-localhost domains)
   · Force verbose anywhere: localStorage.setItem('debug','1')
   · Rolling error log queryable via Engine.Logger.getErrors()
   ───────────────────────────────────────────────────────── */
Engine.Logger = (() => {
  const PREFIX = '[Engine]';

  const _isProd = (() => {
    const h = window.location.hostname;
    return h !== '' && h !== 'localhost' && h !== '127.0.0.1' && !h.startsWith('192.168.');
  })();

  const _verbose = !_isProd || localStorage.getItem('debug') === '1';

  const styles = {
    info:  'color:#2ecc71;font-weight:bold',
    warn:  'color:#f39c12;font-weight:bold',
    error: 'color:#e74c3c;font-weight:bold',
    debug: 'color:#3498db;font-weight:bold',
  };

  const _errorLog = [];
  const MAX_ERRORS = 50;

  function _log(level, module, msg, data) {
    if (!_verbose && (level === 'debug' || level === 'info')) return;
    const label  = `${PREFIX}[${module}] ${msg}`;
    const method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
    data !== undefined
      ? console[method](`%c${label}`, styles[level] || '', data)
      : console[method](`%c${label}`, styles[level] || '');
    if (level === 'error') {
      _errorLog.push({ ts: new Date().toISOString(), module, msg, data: String(data) });
      if (_errorLog.length > MAX_ERRORS) _errorLog.shift();
    }
  }

  return {
    info:      (mod, msg, d) => _log('info',  mod, msg, d),
    warn:      (mod, msg, d) => _log('warn',  mod, msg, d),
    error:     (mod, msg, d) => _log('error', mod, msg, d),
    debug:     (mod, msg, d) => _log('debug', mod, msg, d),
    getErrors: ()            => [..._errorLog],
  };
})();


/* ─────────────────────────────────────────────────────────
   EVENTBUS
   · Duplicate listener prevention (no memory leaks)
   · Listener cap per event with leak warning
   · Wildcard '*' listeners for monitoring/analytics hooks
   · once() guaranteed single-fire under concurrent emits
   ───────────────────────────────────────────────────────── */
Engine.EventBus = (() => {
  const _listeners    = {};
  const MAX_LISTENERS = 20;

  function on(event, handler, context = null) {
    if (!_listeners[event]) _listeners[event] = [];
    /* Prevent duplicate — same fn + context already registered */
    const exists = _listeners[event].some(
      l => l.handler === handler && l.context === context
    );
    if (exists) return;
    if (_listeners[event].length >= MAX_LISTENERS) {
      Engine.Logger.warn(
        'EventBus',
        `Possible listener leak on "${event}" — ${_listeners[event].length} listeners registered`
      );
    }
    _listeners[event].push({ handler, context });
  }

  function off(event, handler) {
    if (!_listeners[event]) return;
    _listeners[event] = _listeners[event].filter(l => l.handler !== handler);
  }

  function emit(event, payload) {
    Engine.Logger.debug('EventBus', `emit: ${event}`, payload);
    /* Copy array before iterating — handlers may call off() mid-loop */
    const targets = [...(_listeners[event] || [])];
    targets.forEach(({ handler, context }) => {
      try { handler.call(context, payload); }
      catch (err) { Engine.Logger.error('EventBus', `Error in "${event}" handler`, err); }
    });
    /* Wildcard listeners — useful for analytics / global monitoring */
    if (event !== '*') {
      const wildcards = [...(_listeners['*'] || [])];
      wildcards.forEach(({ handler, context }) => {
        try { handler.call(context, { event, payload }); }
        catch (_) {}
      });
    }
  }

  /* Guaranteed single-fire even under concurrent emits */
  function once(event, handler) {
    let fired = false;
    function _wrapper(payload) {
      if (fired) return;
      fired = true;
      off(event, _wrapper);
      handler(payload);
    }
    on(event, _wrapper);
  }

  function listenerCount(event) {
    return (_listeners[event] || []).length;
  }

  return { on, off, emit, once, listenerCount };
})();


/* ─────────────────────────────────────────────────────────
   EVENTS CATALOGUE
   Single source of truth for all event name strings.
   Using constants prevents typos causing silent failures.
   ───────────────────────────────────────────────────────── */
Engine.Events = Object.freeze({
  PRODUCTS_LOADED:  'products:loaded',
  PRODUCT_UPDATED:  'product:updated',
  PRODUCT_CREATED:  'product:created',
  PRODUCT_DELETED:  'product:deleted',

  CART_UPDATED:     'cart:updated',
  CART_OPENED:      'cart:opened',
  CART_CLOSED:      'cart:closed',

  ROUTE_CHANGED:    'route:changed',

  AUTH_CHANGED:     'auth:changed',
  USER_SIGNED_IN:   'auth:signedIn',
  USER_SIGNED_OUT:  'auth:signedOut',

  NOTIFY:           'ui:notify',
  MODAL_OPEN:       'ui:modal:open',
  MODAL_CLOSE:      'ui:modal:close',

  LOADING_START:    'ui:loading:start',
  LOADING_END:      'ui:loading:end',
});

Engine.Logger.info('Core', 'Engine core initialised ✓ (Logger + EventBus + Events)');
