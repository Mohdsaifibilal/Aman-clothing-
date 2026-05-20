/**
 * ═══════════════════════════════════════════════════════════
 * ENGINE / supabase.js
 * Path: js/engine/supabase.js
 *
 * Depends on: js/engine/core.js
 *
 * Supabase client singleton.
 * · ONE client instance for the entire app
 * · Credential validation before init attempt
 * · 12s fetch timeout — requests never hang indefinitely
 * · isReady() for safe conditional checks in API layer
 * · Falls back to demo mode gracefully — no crash
 * ═══════════════════════════════════════════════════════════
 */

const SupabaseClient = (() => {

  let _client = null;
  let _ready  = false;

  function init() {
    /* Guard: if CDN failed to load, supabase global is our stub — stay in demo mode */
    if (window._supabaseLoadError || typeof supabase === 'undefined' || !supabase.createClient) {
      Engine.Logger.warn('Supabase', 'Supabase SDK not available — running in DEMO mode');
      _client = null;
      _ready  = false;
      return null;
    }

    const cfg = window.SITE_CONFIG?.supabase || {};
    const { url, anonKey } = cfg;

    const isPlaceholder =
      !url     || url.includes('YOUR_PROJECT') ||
      !anonKey || anonKey.includes('YOUR_ANON');

    if (isPlaceholder) {
      Engine.Logger.warn(
        'Supabase',
        'No credentials found — running in DEMO mode. ' +
        'Set supabase.url + supabase.anonKey in sites/config.js to connect.'
      );
      _client = null;
      _ready  = false;
      return null;
    }

    /* Basic URL format check before attempting createClient */
    try { new URL(url); }
    catch (_) {
      Engine.Logger.error('Supabase', `Invalid URL in config: "${url}"`);
      return null;
    }

    try {
      _client = supabase.createClient(url, anonKey, {
        auth: {
          autoRefreshToken:   true,
          persistSession:     true,
          detectSessionInUrl: true,
        },
        /* Reduced to 8s timeout — faster fallback to demo on slow connections */
        global: {
          fetch: (input, init = {}) => {
            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), 8_000);
            return fetch(input, { ...init, signal: controller.signal })
              .finally(() => clearTimeout(tid));
          },
        },
      });

      /* Guard: stub createClient may return null */
      if (!_client) {
        Engine.Logger.warn('Supabase', 'createClient returned null — demo mode');
        _ready = false;
        return null;
      }

      _ready = true;
      Engine.Logger.info('Supabase', 'Client initialised ✓');
      return _client;

    } catch (err) {
      Engine.Logger.error('Supabase', 'Init failed', err);
      _client = null;
      _ready  = false;
      return null;
    }
  }

  function get()     { return _client; }
  function isReady() { return _ready && _client !== null; }

  return { init, get, isReady };

})();

/* Expose on window so api.js can access SupabaseClient */
window.SupabaseClient = SupabaseClient;
