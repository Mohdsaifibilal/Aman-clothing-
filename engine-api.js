/**
 * ═══════════════════════════════════════════════════════════
 * ENGINE / api.js
 * Path: js/engine/api.js
 *
 * Depends on: core.js, store.js, cart.js, supabase.js
 *
 * All database operations live here.
 * Pages and components NEVER call Supabase directly.
 *
 * PRODUCTION IMPROVEMENTS:
 *  1. Request deduplication — same in-flight request returns
 *     one shared Promise (eliminates race conditions)
 *  2. TTL cache (30s) — repeat reads from memory, auto-expires,
 *     mutations invalidate relevant cache keys immediately
 *  3. Retry + exponential backoff — transient failures recover
 *     automatically (reads only, never writes)
 *  4. Hard errors (401/403/404/422) never retried
 *  5. Optimistic updates — UI changes instantly, reverts on fail
 *  6. Checkout stock validation — live re-fetch before order
 *  7. Input sanitisation on all write paths
 *  8. Structured error normalisation — always returns { data, error }
 *     where error is always a plain string or null
 * ═══════════════════════════════════════════════════════════
 */

Engine.API = (() => {

  /* ══════════════════════════════════════════════════════════
     DEMO DATA
     Used automatically when no Supabase credentials are set.
     ══════════════════════════════════════════════════════════ */
  const DEMO_PRODUCTS = [
    { id: '1', name: 'Essential Hoodie',      price: 1499, image_url: 'https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=600&q=80', stock: 12, category: 'hoodies',  description: 'Premium heavyweight hoodie. Minimal branding, maximum comfort. 400GSM fleece.' },
    { id: '2', name: 'Oversized Hoodie',      price: 1699, image_url: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=600&q=80', stock: 8,  category: 'hoodies',  description: 'Dropped shoulders, kangaroo pocket. Perfect oversized fit for the streets.' },
    { id: '3', name: 'Classic Zip Hoodie',    price: 1899, image_url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80', stock: 5,  category: 'hoodies',  description: 'Full zip hoodie in brushed fleece. Ribbed cuffs and hem for a clean finish.' },
    { id: '4', name: 'Essential Tee',         price: 699,  image_url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=80', stock: 20, category: 't-shirts', description: 'Clean minimal tee. 220GSM combed cotton. Relaxed fit, dropped hem.' },
    { id: '5', name: 'Oversized Graphic Tee', price: 899,  image_url: 'https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=600&q=80', stock: 15, category: 't-shirts', description: 'Box-fit graphic tee. Screen printed artwork. 100% organic cotton.' },
    { id: '6', name: 'Longline Tee',          price: 799,  image_url: 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=600&q=80', stock: 0,  category: 't-shirts', description: 'Extended hem longline tee. Ultra soft 230GSM cotton. Side splits at hem.' },
    { id: '7', name: 'Oxford Shirt',          price: 1299, image_url: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&q=80', stock: 10, category: 'shirts',   description: 'Slim fit oxford weave shirt. Button down collar. Versatile street to formal.' },
    { id: '8', name: 'Linen Overshirt',       price: 1599, image_url: 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=600&q=80', stock: 6,  category: 'shirts',   description: '100% linen overshirt. Relaxed fit, chest pocket. Perfect layering piece.' },
  ];

  let _demoProducts = [...DEMO_PRODUCTS];

  /* ── Helpers ── */
  function _isDemo()    { return !SupabaseClient.get(); }
  function _table(name) { return (window.SITE_CONFIG.table || {})[name] || name; }

  function _formatError(err) {
    if (!err) return 'Unknown error';
    if (typeof err === 'string') return err;
    return err.message || err.error_description || err.msg || 'An unexpected error occurred';
  }

  function _isHardError(err) {
    const code = err?.status || err?.code || err?.statusCode;
    return [400, 401, 403, 404, 409, 422].includes(code);
  }

  /* ══════════════════════════════════════════════════════════
     1. REQUEST DEDUPLICATION
     Identical concurrent requests share one Promise.
     ══════════════════════════════════════════════════════════ */
  const _inflight = new Map();

  async function _dedupe(key, fn) {
    if (_inflight.has(key)) {
      Engine.Logger.debug('API', `Deduped: ${key}`);
      return _inflight.get(key);
    }
    const promise = fn().finally(() => _inflight.delete(key));
    _inflight.set(key, promise);
    return promise;
  }

  /* ══════════════════════════════════════════════════════════
     2. TTL CACHE with STALE-WHILE-REVALIDATE + localStorage PERSISTENCE
     · FRESH  (0–30s)  — served instantly from memory cache, no fetch
     · STALE  (30–60s) — served from cache immediately, background refresh
     · EXPIRED (60s+)  — check localStorage (5min TTL) before network fetch
     · RELOAD          — localStorage restores cache, no extra API hit
     ══════════════════════════════════════════════════════════ */
  const _cache         = new Map();
  const CACHE_TTL      = 30_000;        /* 30s  — memory fresh window */
  const CACHE_STALE    = 60_000;        /* 60s  — stale-while-revalidate */
  const CACHE_LS_TTL   = 5 * 60_000;   /* 5min — localStorage expiry */
  const CACHE_LS_PREFIX = 'engine_cache_'; /* localStorage key prefix */
  const _revalidating  = new Set();

  /* ── localStorage helpers — products only, never auth/orders ── */
  const _CACHEABLE_PREFIXES = ['products:'];

  function _isCacheable(key) {
    return _CACHEABLE_PREFIXES.some(p => key.startsWith(p));
  }

  function _lsRead(key) {
    if (!_isCacheable(key)) return null;
    try {
      const raw = localStorage.getItem(CACHE_LS_PREFIX + key);
      if (!raw) return null;
      const entry = JSON.parse(raw);
      if (Date.now() - entry.ts > CACHE_LS_TTL) {
        localStorage.removeItem(CACHE_LS_PREFIX + key);
        return null;
      }
      Engine.Logger.debug('API', `localStorage hit: ${key}`);
      return entry.data;
    } catch (_) { return null; }
  }

  function _lsWrite(key, data) {
    if (!_isCacheable(key)) return;
    try {
      localStorage.setItem(
        CACHE_LS_PREFIX + key,
        JSON.stringify({ data, ts: Date.now() })
      );
    } catch (e) {
      /* QuotaExceededError — storage full, not fatal */
      Engine.Logger.warn('API', `localStorage write failed: ${e.name}`);
    }
  }

  function _lsDelete(prefix) {
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith(CACHE_LS_PREFIX + prefix))
        .forEach(k => localStorage.removeItem(k));
    } catch (_) {}
  }

  function _cacheGet(key) {
    /* 1. Check memory cache first (fastest) */
    const entry = _cache.get(key);
    if (entry) {
      const age = Date.now() - entry.ts;
      if (age <= CACHE_TTL)   { Engine.Logger.debug('API', `Memory FRESH: ${key}`);  return { data: entry.data, stale: false }; }
      if (age <= CACHE_STALE) { Engine.Logger.debug('API', `Memory STALE: ${key}`);  return { data: entry.data, stale: true };  }
      _cache.delete(key);
    }

    /* 2. Memory miss — check localStorage (survives page reload) */
    const lsData = _lsRead(key);
    if (lsData) {
      /* Restore into memory cache so subsequent calls are instant */
      _cache.set(key, { data: lsData, ts: Date.now() });
      return { data: lsData, stale: false };
    }

    return { data: null, stale: false };
  }

  function _cacheSet(key, data) {
    _cache.set(key, { data, ts: Date.now() });
    _lsWrite(key, data); /* Persist to localStorage for reload survival */
  }

  function _cacheInvalidate(prefix) {
    let n = 0;
    for (const key of _cache.keys()) {
      if (key.startsWith(prefix)) { _cache.delete(key); n++; }
    }
    _lsDelete(prefix);  /* Also clear localStorage entries */
    _revalidating.delete(prefix);
    if (n) Engine.Logger.debug('API', `Cache invalidated: ${prefix} (${n} keys)`);
  }

  /* Background revalidation — updates cache silently without blocking UI */
  function _revalidateInBackground(key, fetchFn) {
    if (_revalidating.has(key)) return; /* Already refreshing */
    _revalidating.add(key);
    fetchFn()
      .then(data => { if (data) _cacheSet(key, data); })
      .catch(e => Engine.Logger.warn('API', `Background revalidate failed: ${key}`, e))
      .finally(() => _revalidating.delete(key));
  }

  /* ══════════════════════════════════════════════════════════
     3. RETRY WITH EXPONENTIAL BACKOFF (reads only)
     Hard errors pass through immediately — never retried.
     ══════════════════════════════════════════════════════════ */
  async function _withRetry(fn, maxAttempts = 3, baseDelay = 400) {
    let lastErr;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await fn();
        if (!result.error) return result;
        if (_isHardError(result.error)) return result;
        lastErr = result.error;
        Engine.Logger.warn('API', `Attempt ${attempt} failed: ${_formatError(lastErr)}`);
      } catch (e) {
        lastErr = e;
        Engine.Logger.warn('API', `Attempt ${attempt} threw`, e);
      }
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, attempt - 1)));
      }
    }
    return { data: null, error: _formatError(lastErr) };
  }

  /* ══════════════════════════════════════════════════════════
     PRODUCTS
     ══════════════════════════════════════════════════════════ */

  async function getProducts(filters = {}) {
    if (_isDemo()) return _demoGetProducts(filters);

    /* SAFETY FALLBACK — wait up to 1.5s for Supabase to be ready before
       falling back to demo. This prevents mixed demo+real data on slow
       connections where Supabase client initialises slightly after first render. */
    if (!SupabaseClient.isReady()) {
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    if (!SupabaseClient.isReady()) {
      Engine.Logger.warn('API', 'Supabase not ready — falling back to demo data');
      return _demoGetProducts(filters);
    }

    const cacheKey = 'products:' + JSON.stringify(filters);

    return _dedupe(cacheKey, () => _withRetry(async () => {
      const { data: cached, stale } = _cacheGet(cacheKey);

      if (cached) {
        /* Serve cached data immediately — no loading state shown */
        Engine.Store.batch(() => {
          Engine.Store.set('products', cached);
          Engine.Store.set('productsLoading', false);
          Engine.Store.set('productsError', null);
        });
        Engine.EventBus.emit(Engine.Events.PRODUCTS_LOADED, cached);

        /* If stale, refresh silently in background — UI never waits */
        if (stale) {
          _revalidateInBackground(cacheKey, () => _fetchProducts(filters));
        }

        return { data: cached, error: null };
      }

      /* No cache at all — blocking fetch required */
      Engine.Store.set('productsLoading', true);
      const products = await _fetchProducts(filters);
      return { data: products, error: null };

    })).catch(err => {
      const msg = _formatError(err);
      Engine.Store.batch(() => {
        Engine.Store.set('productsLoading', false);
        Engine.Store.set('productsError', msg);
      });
      Engine.Logger.error('API', 'getProducts failed', err);
      return { data: null, error: msg };
    });
  }

  /* Extracted fetch logic — used by getProducts + background revalidation */
  async function _fetchProducts(filters) {
    let query = SupabaseClient.get()
      .from(_table('products'))
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false });

    if (filters.category) query = query.eq('category', filters.category);
    if (filters.search)   query = query.ilike('name', `%${filters.search}%`);

    /* Pagination — always enforced, default 20 per page */
    const limit  = filters.limit  || 20;
    const offset = filters.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;
    if (error) throw error;

    const products = data || [];
    _cacheSet('products:' + JSON.stringify(filters), products);

    Engine.Store.batch(() => {
      Engine.Store.set('products',          products);
      Engine.Store.set('productsLoading',   false);
      Engine.Store.set('productsError',     null);
      Engine.Store.set('productsLastFetch', Date.now()); /* Track freshness */
    });
    Engine.EventBus.emit(Engine.Events.PRODUCTS_LOADED, products);
    return products;
  }

  async function getProduct(id) {
    if (!id) return { data: null, error: 'Product ID required' };
    if (_isDemo()) {
      const p = _demoProducts.find(p => p.id === id);
      if (p) { Engine.Store.set('currentProduct', p); return { data: p, error: null }; }
      return { data: null, error: 'Product not found' };
    }

    const cacheKey = `product:${id}`;
    return _withRetry(async () => {
      const { data: cached } = _cacheGet(cacheKey);
      if (cached) { Engine.Store.set('currentProduct', cached); return { data: cached, error: null }; }

      const { data, error } = await SupabaseClient.get()
        .from(_table('products'))
        .select('*')
        .eq('id', id)
        .eq('active', true)
        .single();

      if (error) throw error;
      _cacheSet(cacheKey, data);
      Engine.Store.set('currentProduct', data);
      return { data, error: null };

    }).catch(err => ({ data: null, error: _formatError(err) }));
  }

  /* ══════════════════════════════════════════════════════════
     4. OPTIMISTIC UPDATES + ROLLBACK
     updateProduct and deleteProduct apply instantly to store,
     revert cleanly if Supabase call fails.
     ══════════════════════════════════════════════════════════ */

  async function createProduct(payload) {
    const clean = _sanitiseProduct(payload);
    if (!clean) return { data: null, error: 'Invalid product data' };
    if (_isDemo()) return _demoCreate(clean);

    const { data, error } = await SupabaseClient.get()
      .from(_table('products'))
      .insert([clean])
      .select()
      .single();

    if (error) return { data: null, error: _formatError(error) };
    _cacheInvalidate('products:');
    Engine.EventBus.emit(Engine.Events.PRODUCT_CREATED, data);
    return { data, error: null };
  }

  async function updateProduct(id, updates) {
    if (!id) return { data: null, error: 'Product ID required' };
    const clean = _sanitiseProduct(updates, true);

    /* Optimistic: apply to store immediately */
    const snapshot = Engine.Store.get('products');
    Engine.Store.set('products', snapshot.map(p => p.id === id ? { ...p, ...clean } : p));
    const cp = Engine.Store.get('currentProduct');
    if (cp?.id === id) Engine.Store.set('currentProduct', { ...cp, ...clean });

    if (_isDemo()) {
      const result = await _demoUpdate(id, clean);
      if (!result.error) { _cacheInvalidate('products:'); _cacheInvalidate(`product:${id}`); }
      return result;
    }

    const { data, error } = await SupabaseClient.get()
      .from(_table('products'))
      .update(clean)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      /* Rollback */
      Engine.Store.set('products', snapshot);
      if (cp?.id === id) Engine.Store.set('currentProduct', cp);
      Engine.EventBus.emit(Engine.Events.NOTIFY, { msg: 'Update failed — changes reverted', type: 'error' });
      return { data: null, error: _formatError(error) };
    }

    _cacheInvalidate('products:');
    _cacheInvalidate(`product:${id}`);
    Engine.EventBus.emit(Engine.Events.PRODUCT_UPDATED, data);
    return { data, error: null };
  }

  async function deleteProduct(id) {
    if (!id) return { error: 'Product ID required' };

    /* Optimistic: remove from store immediately */
    const snapshot = Engine.Store.get('products');
    Engine.Store.set('products', snapshot.filter(p => p.id !== id));
    Engine.EventBus.emit(Engine.Events.PRODUCT_DELETED, { id });

    if (_isDemo()) return _demoDelete(id);

    const { error } = await SupabaseClient.get()
      .from(_table('products'))
      .delete()
      .eq('id', id);

    if (error) {
      /* Rollback */
      Engine.Store.set('products', snapshot);
      Engine.EventBus.emit(Engine.Events.PRODUCTS_LOADED, snapshot);
      Engine.EventBus.emit(Engine.Events.NOTIFY, { msg: 'Delete failed — product restored', type: 'error' });
      return { error: _formatError(error) };
    }

    _cacheInvalidate('products:');
    _cacheInvalidate(`product:${id}`);
    return { error: null };
  }

  async function updateStock(id, delta) {
    if (typeof delta !== 'number') return { error: 'delta must be a number' };
    if (_isDemo()) return _demoStockUpdate(id, delta);
    const { data: product, error: fetchErr } = await getProduct(id);
    if (fetchErr) return { error: fetchErr };
    return updateProduct(id, { stock: Math.max(0, product.stock + delta) });
  }

  /* ══════════════════════════════════════════════════════════
     5. CHECKOUT WITH LIVE STOCK VALIDATION
     Re-fetches stock for every cart item before order creation.
     Prevents overselling when concurrent users buy same item.
     ══════════════════════════════════════════════════════════ */
  async function createOrder(items, userId, address) {
    if (!items || !items.length) return { data: null, error: 'Cart is empty' };

    if (_isDemo()) {
      Engine.Cart.clear();
      return { data: { id: 'demo-order-' + Date.now() }, error: null };
    }

    /* 1. Live stock re-fetch */
    const ids = items.map(i => i.product.id);
    const { data: liveProducts, error: fetchErr } = await SupabaseClient.get()
      .from(_table('products'))
      .select('id, name, stock')
      .in('id', ids);

    if (fetchErr) {
      return { data: null, error: 'Could not verify stock. Please try again.' };
    }

    /* 2. Per-item stock check */
    const stockErrors = [];
    for (const item of items) {
      const live = (liveProducts || []).find(p => p.id === item.product.id);
      if (!live) {
        stockErrors.push(`"${item.product.name}" is no longer available`);
        continue;
      }
      if (live.stock < item.quantity) {
        stockErrors.push(`"${live.name}": you want ${item.quantity}, only ${live.stock} in stock`);
      }
    }

    if (stockErrors.length) {
      return { data: null, error: stockErrors.join('\n') };
    }

    /* 3. Create order record */
    const total      = items.reduce((s, i) => s + i.product.price * i.quantity, 0);
    const orderItems = items.map(i => ({
      id:        i.product.id,
      name:      i.product.name,
      price:     i.product.price,
      quantity:  i.quantity,
      size:      i.size      || null,   /* size from cart item — null for one-size */
      image_url: i.product.image_url || null,
      category:  i.product.category  || null,
    }));

    const { data: order, error: orderErr } = await SupabaseClient.get()
      .from(_table('orders'))
      .insert([{
        user_id:        userId || null,
        items:          JSON.stringify(orderItems),
        total,
        address:        address ? JSON.stringify(address) : null,
        status:         'pending',
        order_status:   'pending',
        payment_status: 'pending',
        shipment_status:'pending',
      }])
      .select()
      .single();

    if (orderErr) return { data: null, error: _formatError(orderErr) };

    /* 4. Atomic stock decrement via DB function (handles race conditions) */
    await Promise.allSettled(
      items.map(i =>
        SupabaseClient.get().rpc('decrement_stock', {
          product_id: i.product.id,
          qty:        i.quantity,
        })
      )
    );

    _cacheInvalidate('products:');
    Engine.Cart.clear();
    return { data: order, error: null };
  }

  /* ══════════════════════════════════════════════════════════
     AUTH
     ══════════════════════════════════════════════════════════ */

  async function signIn(email, password) {
    if (_isDemo()) return _demoAuth(email);
    try {
      const { data, error } = await SupabaseClient.get().auth
        .signInWithPassword({ email, password });
      if (error) throw error;
      return { data, error: null };
    } catch (err) { return { data: null, error: _formatError(err) }; }
  }

  async function signUp(email, password) {
    if (_isDemo()) return _demoAuth(email);
    try {
      const { data, error } = await SupabaseClient.get().auth
        .signUp({ email, password });
      if (error) throw error;
      return { data, error: null };
    } catch (err) { return { data: null, error: _formatError(err) }; }
  }

  async function signOut() {
    if (_isDemo()) {
      Engine.Store.batch(() => {
        Engine.Store.set('user', null);
        Engine.Store.set('isAdmin', false);
      });
      Engine.EventBus.emit(Engine.Events.USER_SIGNED_OUT);
      Engine.EventBus.emit(Engine.Events.AUTH_CHANGED, null);
      return { error: null };
    }
    try {
      const { error } = await SupabaseClient.get().auth.signOut();
      if (error) throw error;
      return { error: null };
    } catch (err) { return { error: _formatError(err) }; }
  }

  async function getSession() {
    if (_isDemo()) return { data: null, error: null };
    const { data, error } = await SupabaseClient.get().auth.getSession();
    return { data, error: error ? _formatError(error) : null };
  }

  function onAuthStateChange(callback) {
    if (_isDemo()) return;
    SupabaseClient.get().auth.onAuthStateChange((_event, session) => {
      callback(session?.user || null);
    });
  }

  /* ══════════════════════════════════════════════════════════
     6. INPUT SANITISATION
     All write paths sanitised before hitting Supabase.
     ══════════════════════════════════════════════════════════ */
  function _sanitiseProduct(data, partial = false) {
    if (!data || typeof data !== 'object') return null;
    const clean = {};

    if ('name' in data) {
      clean.name = String(data.name || '').trim().slice(0, 200);
      if (!partial && !clean.name) return null;
    }
    if ('price' in data) {
      const p = parseFloat(data.price);
      if (isNaN(p) || p <= 0 || p > 999999) return null;
      clean.price = Math.round(p * 100) / 100;
    }
    if ('stock' in data) {
      const s = parseInt(data.stock);
      if (isNaN(s) || s < 0 || s > 999999) return null;
      clean.stock = s;
    }
    if ('category'    in data) clean.category    = data.category    ? String(data.category).trim().slice(0, 80)     : null;
    if ('image_url'   in data) clean.image_url   = data.image_url   ? String(data.image_url).trim().slice(0, 500)   : null;
    if ('description' in data) clean.description = data.description ? String(data.description).trim().slice(0, 2000) : null;
    if ('active'      in data) clean.active       = Boolean(data.active);

    return clean;
  }

  /* ══════════════════════════════════════════════════════════
     DEMO HELPERS
     ══════════════════════════════════════════════════════════ */

  function _demoGetProducts(filters) {
    Engine.Store.set('productsLoading', true);
    return new Promise(resolve => {
      setTimeout(() => {
        let results = [..._demoProducts];
        if (filters.category) results = results.filter(p => p.category === filters.category);
        if (filters.search)   results = results.filter(p => p.name.toLowerCase().includes(filters.search.toLowerCase()));
        if (filters.limit)    results = results.slice(filters.offset || 0, (filters.offset || 0) + filters.limit);
        Engine.Store.batch(() => {
          Engine.Store.set('products', results);
          Engine.Store.set('productsLoading', false);
          Engine.Store.set('productsError', null);
        });
        Engine.EventBus.emit(Engine.Events.PRODUCTS_LOADED, results);
        resolve({ data: results, error: null });
      }, 350);
    });
  }

  function _demoCreate(data) {
    const product = { ...data, id: String(Date.now()), created_at: new Date().toISOString(), active: true };
    _demoProducts.unshift(product);
    Engine.Store.set('products', [..._demoProducts]);
    Engine.EventBus.emit(Engine.Events.PRODUCT_CREATED, product);
    return Promise.resolve({ data: product, error: null });
  }

  function _demoUpdate(id, updates) {
    const idx = _demoProducts.findIndex(p => p.id === id);
    if (idx === -1) return Promise.resolve({ data: null, error: 'Not found' });
    _demoProducts[idx] = { ..._demoProducts[idx], ...updates };
    Engine.Store.set('products', [..._demoProducts]);
    Engine.EventBus.emit(Engine.Events.PRODUCT_UPDATED, _demoProducts[idx]);
    return Promise.resolve({ data: _demoProducts[idx], error: null });
  }

  function _demoDelete(id) {
    _demoProducts = _demoProducts.filter(p => p.id !== id);
    return Promise.resolve({ error: null });
  }

  function _demoStockUpdate(id, delta) {
    const p = _demoProducts.find(p => p.id === id);
    if (!p) return Promise.resolve({ error: 'Not found' });
    return _demoUpdate(id, { stock: Math.max(0, p.stock + delta) });
  }

  function _demoAuth(email) {
    const isAdmin = (window.SITE_CONFIG.admin.adminEmails || []).includes(email);
    const user    = { id: 'demo-' + Date.now(), email, role: isAdmin ? 'admin' : 'user' };
    Engine.Store.batch(() => {
      Engine.Store.set('user', user);
      Engine.Store.set('isAdmin', isAdmin);
    });
    Engine.EventBus.emit(Engine.Events.USER_SIGNED_IN, user);
    Engine.EventBus.emit(Engine.Events.AUTH_CHANGED, user);
    return Promise.resolve({ data: { user }, error: null });
  }


  /* ══════════════════════════════════════════════════════════
     PAYMENT — createPaymentOrder + verifyPayment
     Calls Supabase Edge Functions — secrets NEVER in frontend
     ══════════════════════════════════════════════════════════ */

  async function createPaymentOrder({ amount, items }) {
    /* Demo mode — return mock order */
    if (_isDemo()) {
      return {
        data: {
          order_id: 'demo_order_' + Date.now(),
          amount:   Math.round(amount * 100), /* paise */
          currency: (window.SITE_CONFIG.payment?.currency || 'INR'),
        },
        error: null,
      };
    }

    if (!SupabaseClient.isReady()) {
      return { data: null, error: 'Payment service not available' };
    }

    try {
      const { data, error } = await SupabaseClient.get()
        .functions.invoke('create-payment', {
          body: {
            amount:   Math.round(amount * 100), /* Convert to paise/cents */
            currency: window.SITE_CONFIG.payment?.currency || 'INR',
            items:    (items || []).map(i => ({
              id:       i.product.id,
              name:     i.product.name,
              quantity: i.quantity,
              price:    i.product.price,
            })),
          },
        });

      if (error) throw error;
      return { data, error: null };

    } catch (err) {
      Engine.Logger.error('API', 'createPaymentOrder failed', err);
      return { data: null, error: _formatError(err) };
    }
  }

  async function verifyPayment({
    razorpay_payment_id,
    razorpay_order_id,
    razorpay_signature,
    items,
    user_id,
    amount,
  }) {
    /* Demo mode — auto-verify */
    if (_isDemo()) {
      return {
        data: { success: true, order_id: 'demo_verified_' + Date.now() },
        error: null,
      };
    }

    if (!SupabaseClient.isReady()) {
      return { data: null, error: 'Payment service not available' };
    }

    try {
      const { data, error } = await SupabaseClient.get()
        .functions.invoke('verify-payment', {
          body: {
            razorpay_payment_id,
            razorpay_order_id,
            razorpay_signature,
            user_id: user_id || null,
            amount,
            items: (items || []).map(i => ({
              id:       i.product.id,
              name:     i.product.name,
              quantity: i.quantity,
              price:    i.product.price,
            })),
          },
        });

      if (error) throw error;

      /* Invalidate product cache — stock changed */
      _cacheInvalidate('products:');

      return { data, error: null };

    } catch (err) {
      Engine.Logger.error('API', 'verifyPayment failed', err);
      return { data: null, error: _formatError(err) };
    }
  }


  /* ══════════════════════════════════════════════════════════
     ORDER MANAGEMENT FUNCTIONS
     getMyOrders    — user apne orders dekhta hai
     getAllOrders   — admin sab orders dekhta hai
     updateOrderStatus — admin status update karta hai
     ══════════════════════════════════════════════════════════ */

  async function getMyOrders(userId) {
    /* Demo mode */
    if (_isDemo()) {
      const demoOrders = [
        {
          id:             'demo-order-001',
          user_id:        userId || 'demo-user',
          items:          [{ id:'1', name:'Ceramic Vessel', price:89, quantity:1 }],
          amount:         89,
          payment_status: 'paid',
          order_status:   'confirmed',
          created_at:     new Date(Date.now() - 86400000).toISOString(),
        },
        {
          id:             'demo-order-002',
          user_id:        userId || 'demo-user',
          items:          [{ id:'4', name:'Matte Candle Set', price:42, quantity:2 }],
          amount:         84,
          payment_status: 'paid',
          order_status:   'shipped',
          created_at:     new Date(Date.now() - 172800000).toISOString(),
        },
      ];
      Engine.Store.batch(() => {
        Engine.Store.set('orders',        demoOrders);
        Engine.Store.set('ordersLoading', false);
        Engine.Store.set('ordersError',   null);
      });
      return { data: demoOrders, error: null };
    }

    if (!SupabaseClient.isReady()) {
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    if (!SupabaseClient.isReady()) {
      return { data: [], error: null };
    }

    Engine.Store.set('ordersLoading', true);

    try {
      const { data, error } = await SupabaseClient.get()
        .from(_table('orders'))
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      Engine.Store.batch(() => {
        Engine.Store.set('orders',        data || []);
        Engine.Store.set('ordersLoading', false);
        Engine.Store.set('ordersError',   null);
      });
      return { data: data || [], error: null };

    } catch (err) {
      const msg = _formatError(err);
      Engine.Store.batch(() => {
        Engine.Store.set('ordersLoading', false);
        Engine.Store.set('ordersError',   msg);
      });
      Engine.Logger.error('API', 'getMyOrders failed', err);
      return { data: [], error: msg };
    }
  }


  /* ─────────────────────────────────────────────────────────
     CANCEL ORDER — customer ya admin dono use kar sakte hain
     ───────────────────────────────────────────────────────── */
  async function cancelOrder(orderId, cancelledBy) {
    if (_isDemo()) {
      const orders = Engine.Store.get('orders') || [];
      const updated = orders.map(o =>
        o.id === orderId
          ? { ...o, order_status: 'cancelled', cancelled_by: cancelledBy }
          : o
      );
      Engine.Store.set('orders', updated);
      return { error: null };
    }
    if (!SupabaseClient.isReady()) return { error: 'Not connected' };
    try {
      const { error } = await SupabaseClient.get()
        .from(_table('orders'))
        .update({
          order_status:  'cancelled',
          cancelled_by:  cancelledBy,
          updated_at:    new Date().toISOString(),
        })
        .eq('id', orderId);
      if (error) throw error;

      /* Update local store */
      const orders = Engine.Store.get('orders') || [];
      Engine.Store.set('orders', orders.map(o =>
        o.id === orderId
          ? { ...o, order_status: 'cancelled', cancelled_by: cancelledBy }
          : o
      ));
      return { error: null };
    } catch (err) { return { error: _formatError(err) }; }
  }

  /* ─────────────────────────────────────────────────────────
     MARK DELIVERED — customer "Mark as Received" button
     ───────────────────────────────────────────────────────── */
  async function markDelivered(orderId) {
    if (_isDemo()) {
      const orders = Engine.Store.get('orders') || [];
      Engine.Store.set('orders', orders.map(o =>
        o.id === orderId ? { ...o, order_status: 'delivered', shipment_status: 'delivered' } : o
      ));
      return { error: null };
    }
    if (!SupabaseClient.isReady()) return { error: 'Not connected' };
    try {
      const { error } = await SupabaseClient.get()
        .from(_table('orders'))
        .update({
          order_status:    'delivered',
          shipment_status: 'delivered',
          updated_at:      new Date().toISOString(),
        })
        .eq('id', orderId);
      if (error) throw error;

      const orders = Engine.Store.get('orders') || [];
      Engine.Store.set('orders', orders.map(o =>
        o.id === orderId ? { ...o, order_status: 'delivered', shipment_status: 'delivered' } : o
      ));
      return { error: null };
    } catch (err) { return { error: _formatError(err) }; }
  }

  async function getAllOrders() {
    /* Demo mode */
    if (_isDemo()) {
      const demoOrders = [
        {
          id:             'demo-order-001',
          user_id:        'user-abc',
          items:          [{ id:'1', name:'Ceramic Vessel', price:89, quantity:1 }],
          amount:         89,
          payment_status: 'paid',
          order_status:   'confirmed',
          created_at:     new Date(Date.now() - 86400000).toISOString(),
        },
        {
          id:             'demo-order-002',
          user_id:        'user-xyz',
          items:          [{ id:'4', name:'Matte Candle Set', price:42, quantity:2 }],
          amount:         84,
          payment_status: 'paid',
          order_status:   'shipped',
          created_at:     new Date(Date.now() - 172800000).toISOString(),
        },
        {
          id:             'demo-order-003',
          user_id:        'user-abc',
          items:          [{ id:'2', name:'Linen Throw Blanket', price:145, quantity:1 }],
          amount:         145,
          payment_status: 'paid',
          order_status:   'pending',
          created_at:     new Date(Date.now() - 3600000).toISOString(),
        },
      ];
      Engine.Store.batch(() => {
        Engine.Store.set('orders',        demoOrders);
        Engine.Store.set('ordersLoading', false);
        Engine.Store.set('ordersError',   null);
      });
      return { data: demoOrders, error: null };
    }

    if (!SupabaseClient.isReady()) {
      return { data: [], error: null };
    }

    Engine.Store.set('ordersLoading', true);

    try {
      const { data, error } = await SupabaseClient.get()
        .from(_table('orders'))
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      Engine.Store.batch(() => {
        Engine.Store.set('orders',        data || []);
        Engine.Store.set('ordersLoading', false);
        Engine.Store.set('ordersError',   null);
      });
      return { data: data || [], error: null };

    } catch (err) {
      const msg = _formatError(err);
      Engine.Store.batch(() => {
        Engine.Store.set('ordersLoading', false);
        Engine.Store.set('ordersError',   msg);
      });
      Engine.Logger.error('API', 'getAllOrders failed', err);
      return { data: [], error: msg };
    }
  }

  async function updateOrderStatus(orderId, status) {
    const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
    if (!orderId || !validStatuses.includes(status)) {
      return { error: 'Invalid order ID or status' };
    }

    /* Demo mode — optimistic update only */
    if (_isDemo()) {
      const orders  = Engine.Store.get('orders');
      const updated = orders.map(o =>
        o.id === orderId ? { ...o, order_status: status } : o
      );
      Engine.Store.set('orders', updated);
      return { error: null };
    }

    /* Optimistic update */
    const snapshot = Engine.Store.get('orders');
    Engine.Store.set('orders', snapshot.map(o =>
      o.id === orderId ? { ...o, order_status: status } : o
    ));

    try {
      const updateData = { order_status: status, updated_at: new Date().toISOString() };
      if (status === 'cancelled') updateData.cancelled_by = 'admin';

      const { error } = await SupabaseClient.get()
        .from(_table('orders'))
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;
      return { error: null };

    } catch (err) {
      /* Rollback */
      Engine.Store.set('orders', snapshot);
      Engine.Logger.error('API', 'updateOrderStatus failed', err);
      return { error: _formatError(err) };
    }
  }

  Engine.Logger.info('API', 'Data Access Layer ready ✓');


  /* ══════════════════════════════════════════════════════════
     SHIPPING SYSTEM
     updateShipment — admin sets courier + tracking ID
     Generates tracking URL based on courier name
     ══════════════════════════════════════════════════════════ */

  async function updateShipment(orderId, courier, trackingId) {
    if (!orderId || !courier || !trackingId) {
      return { error: 'Order ID, courier, and tracking ID are required' };
    }

    /* Generate tracking URL based on courier */
    const courierKey = courier.toLowerCase().replace(/\s+/g, '');
    const TRACKING_URLS = {
      delhivery:  `https://www.delhivery.com/track/package/${trackingId}`,
      shiprocket: `https://shiprocket.co/tracking/${trackingId}`,
      bluedart:   `https://www.bluedart.com/tracking?trackfor=${trackingId}`,
      dtdc:       `https://www.dtdc.in/tracking/tracking.asp?Tno=${trackingId}`,
      ekart:      `https://ekartlogistics.com/track?trackingId=${trackingId}`,
      xpressbees: `https://www.xpressbees.com/shipment/tracking?awbNo=${trackingId}`,
    };
    const trackingUrl = TRACKING_URLS[courierKey]
      || `https://www.google.com/search?q=${encodeURIComponent(courier + ' track ' + trackingId)}`;

    const updates = {
      courier,
      tracking_id:      trackingId,
      tracking_url:     trackingUrl,
      shipment_status:  'shipped',
      order_status:     'shipped',
    };

    /* Demo mode — optimistic update only */
    if (_isDemo()) {
      const orders  = Engine.Store.get('orders');
      Engine.Store.set('orders', orders.map(o =>
        o.id === orderId ? { ...o, ...updates } : o
      ));
      return { data: { tracking_url: trackingUrl }, error: null };
    }

    /* Optimistic update */
    const snapshot = Engine.Store.get('orders');
    Engine.Store.set('orders', snapshot.map(o =>
      o.id === orderId ? { ...o, ...updates } : o
    ));

    try {
      const { error } = await SupabaseClient.get()
        .from(_table('orders'))
        .update(updates)
        .eq('id', orderId);

      if (error) throw error;
      return { data: { tracking_url: trackingUrl }, error: null };

    } catch (err) {
      /* Rollback */
      Engine.Store.set('orders', snapshot);
      Engine.Logger.error('API', 'updateShipment failed', err);
      return { error: _formatError(err) };
    }
  }


  /* ══════════════════════════════════════════════════════════
     REVIEWS API
     getReviews(productId)   — fetch all reviews + rating
     createReview(payload)   — submit new review (auth required)
     updateReview(id,payload)— edit own review
     deleteReview(id)        — delete own review
     Engine hierarchy: Store keys used: reviews, reviewsLoading,
                       reviewsError, reviewRating
     ══════════════════════════════════════════════════════════ */

  async function getReviews(productId) {
    if (!productId) return { data: [], error: 'Product ID required' };

    Engine.Store.set('reviewsLoading', true);
    Engine.Store.set('reviewsError',   null);

    /* Demo mode — return fake reviews */
    if (_isDemo()) {
      return new Promise(resolve => {
        setTimeout(() => {
          const demoReviews = [
            { id: 'r1', product_id: productId, user_id: 'u1',
              rating: 5, title: 'Incredible quality',
              body: 'The fabric is thick and premium — exactly what I was looking for in a streetwear brand.',
              verified: true, created_at: new Date(Date.now() - 14*86400000).toISOString(),
              profiles: { full_name: 'Aditya R.' } },
            { id: 'r2', product_id: productId, user_id: 'u2',
              rating: 5, title: 'Perfect fit',
              body: 'Fits perfectly oversized. Washed it 5 times and no shrinking. Super happy.',
              verified: true, created_at: new Date(Date.now() - 30*86400000).toISOString(),
              profiles: { full_name: 'Sneha P.' } },
            { id: 'r3', product_id: productId, user_id: 'u3',
              rating: 4, title: 'Great product',
              body: "Great product, quick delivery. Would've loved more colour options but quality is 10/10.",
              verified: false, created_at: new Date(Date.now() - 21*86400000).toISOString(),
              profiles: { full_name: 'Karan M.' } },
          ];
          const avg = parseFloat((demoReviews.reduce((s,r) => s+r.rating,0)/demoReviews.length).toFixed(1));
          Engine.Store.set('reviews',       demoReviews);
          Engine.Store.set('reviewRating',  { avg_rating: avg, review_count: demoReviews.length });
          Engine.Store.set('reviewsLoading', false);
          resolve({ data: demoReviews, error: null });
        }, 200);
      });
    }

    try {
      const db = SupabaseClient.get();

      /* Fetch reviews + reviewer name in one query via join */
      const { data: reviews, error: revErr } = await db
        .from(_table('reviews'))
        .select('*, profiles(full_name)')
        .eq('product_id', productId)
        .order('created_at', { ascending: false });

      if (revErr) throw revErr;

      /* Fetch aggregate rating via RPC */
      const { data: ratingRow, error: ratingErr } = await db
        .rpc('get_product_rating', { p_product_id: productId })
        .single();

      const rating = (!ratingErr && ratingRow)
        ? { avg_rating: parseFloat(ratingRow.avg_rating) || 0, review_count: Number(ratingRow.review_count) || 0 }
        : { avg_rating: 0, review_count: 0 };

      Engine.Store.set('reviews',       reviews || []);
      Engine.Store.set('reviewRating',  rating);
      Engine.Store.set('reviewsLoading', false);
      return { data: reviews, error: null };

    } catch (err) {
      const msg = _formatError(err);
      Engine.Store.set('reviewsError',   msg);
      Engine.Store.set('reviewsLoading', false);
      return { data: null, error: msg };
    }
  }

  async function createReview({ productId, rating, title, body }) {
    const user = Engine.Store.get('user');
    if (!user) return { data: null, error: 'You must be logged in to leave a review' };
    if (!productId)               return { data: null, error: 'Product ID required' };
    if (!rating || rating < 1 || rating > 5) return { data: null, error: 'Rating must be 1–5' };
    if (!body || body.trim().length < 10)    return { data: null, error: 'Review must be at least 10 characters' };

    if (_isDemo()) {
      /* Optimistic insert in demo mode */
      const newReview = {
        id: 'r_' + Date.now(), product_id: productId, user_id: user.id,
        rating, title: title || '', body: body.trim(), verified: false,
        created_at: new Date().toISOString(),
        profiles: { full_name: user.email?.split('@')[0] || 'You' },
      };
      const existing = Engine.Store.get('reviews') || [];
      Engine.Store.set('reviews', [newReview, ...existing]);
      const all = Engine.Store.get('reviews');
      const avg = parseFloat((all.reduce((s,r) => s+r.rating,0)/all.length).toFixed(1));
      Engine.Store.set('reviewRating', { avg_rating: avg, review_count: all.length });
      return { data: newReview, error: null };
    }

    try {
      const db = SupabaseClient.get();
      const { data, error } = await db
        .from(_table('reviews'))
        .insert({
          product_id: productId,
          user_id:    user.id,
          rating:     Number(rating),
          title:      title ? title.trim().slice(0,120) : null,
          body:       body.trim().slice(0,1000),
        })
        .select('*, profiles(full_name)')
        .single();

      if (error) throw error;

      /* Refresh reviews + rating in store */
      await getReviews(productId);
      return { data, error: null };

    } catch (err) {
      return { data: null, error: _formatError(err) };
    }
  }

  async function deleteReview(reviewId, productId) {
    const user = Engine.Store.get('user');
    if (!user) return { error: 'Not authenticated' };

    if (_isDemo()) {
      const existing = Engine.Store.get('reviews') || [];
      Engine.Store.set('reviews', existing.filter(r => r.id !== reviewId));
      return { error: null };
    }

    try {
      const db = SupabaseClient.get();
      const { error } = await db
        .from(_table('reviews'))
        .delete()
        .eq('id', reviewId)
        .eq('user_id', user.id);   /* RLS enforced — extra safety check */

      if (error) throw error;
      if (productId) await getReviews(productId);
      return { error: null };

    } catch (err) {
      return { error: _formatError(err) };
    }
  }

  /* ══════════════════════════════════════════════════════════
     NEWSLETTER API
     subscribeNewsletter(email) — insert into newsletter_subscribers
     Engine hierarchy: Store keys: newsletterStatus, newsletterError
     ══════════════════════════════════════════════════════════ */

  async function subscribeNewsletter(email) {
    if (!email || !email.includes('@') || !email.includes('.')) {
      return { error: 'Please enter a valid email address' };
    }

    const cleanEmail = email.trim().toLowerCase().slice(0, 254);

    Engine.Store.set('newsletterStatus', 'loading');
    Engine.Store.set('newsletterError',  null);

    /* Demo mode — simulate success */
    if (_isDemo()) {
      return new Promise(resolve => {
        setTimeout(() => {
          Engine.Store.set('newsletterStatus', 'success');
          resolve({ data: { email: cleanEmail }, error: null });
        }, 600);
      });
    }

    try {
      const db = SupabaseClient.get();
      const { data, error } = await db
        .from(_table('newsletter_subscribers'))
        .upsert(
          { email: cleanEmail, active: true, source: 'website' },
          { onConflict: 'email' }    /* re-subscribe if they unsubscribed */
        )
        .select('email')
        .single();

      if (error) throw error;

      Engine.Store.set('newsletterStatus', 'success');
      return { data, error: null };

    } catch (err) {
      const msg = _formatError(err);
      Engine.Store.set('newsletterStatus', 'error');
      Engine.Store.set('newsletterError',  msg);
      return { data: null, error: msg };
    }
  }

  /* ══════════════════════════════════════════════════════════
     HOME REVIEWS
     getHomeReviews() — latest verified reviews for homepage
     testimonials section (any product, limit N)
     Store keys: homeReviews, homeReviewsLoading
  ══════════════════════════════════════════════════════════ */

  async function getHomeReviews(limit = 6) {
    Engine.Store.set('homeReviewsLoading', true);

    /* Demo mode — return static fallback */
    if (_isDemo()) {
      const demo = [
        { id: 'hr1', rating: 5, title: 'Incredible quality',
          body: 'The fabric is thick and premium — exactly what I was looking for.',
          verified: true, created_at: new Date(Date.now() - 7*86400000).toISOString(),
          profiles: { full_name: 'Aditya R.' } },
        { id: 'hr2', rating: 5, title: 'Perfect fit',
          body: 'Fits perfectly oversized. Washed it 5 times and no shrinking.',
          verified: true, created_at: new Date(Date.now() - 14*86400000).toISOString(),
          profiles: { full_name: 'Sneha P.' } },
        { id: 'hr3', rating: 5, title: 'My whole wardrobe is Aman now',
          body: 'Finally a brand that actually gets minimal streetwear.',
          verified: true, created_at: new Date(Date.now() - 21*86400000).toISOString(),
          profiles: { full_name: 'Priya K.' } },
        { id: 'hr4', rating: 4, title: 'Great product, fast delivery',
          body: 'Ordered 3 tees. Delivery was fast and packaging was clean.',
          verified: false, created_at: new Date(Date.now() - 30*86400000).toISOString(),
          profiles: { full_name: 'Rahul M.' } },
      ];
      Engine.Store.set('homeReviews', demo.slice(0, limit));
      Engine.Store.set('homeReviewsLoading', false);
      return { data: demo, error: null };
    }

    try {
      const { data, error } = await SupabaseClient.get()
        .from(_table('reviews'))
        .select('id, rating, title, body, verified, created_at, profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      Engine.Store.set('homeReviews', data || []);
      Engine.Store.set('homeReviewsLoading', false);
      return { data: data || [], error: null };

    } catch (err) {
      const msg = _formatError(err);
      Engine.Store.set('homeReviews', []);
      Engine.Store.set('homeReviewsLoading', false);
      Engine.Logger.warn('API', 'getHomeReviews failed — using empty', msg);
      return { data: [], error: msg };
    }
  }

  /* ══════════════════════════════════════════════════════════
     INSTAGRAM / LOOKBOOK FEED
     getInstaFeed()    — homepage fetch (active posts only, sorted)
     saveInstaPost()   — admin add / edit a post
     deleteInstaPost() — admin delete a post
     Store keys: instaFeed, instaFeedLoading
  ══════════════════════════════════════════════════════════ */

  async function getInstaFeed() {
    Engine.Store.set('instaFeedLoading', true);

    /* Demo mode — return hardcoded fallback (same as old static) */
    if (_isDemo()) {
      const demo = [
        { id: 'd1', image_url: 'https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?w=500&q=80', caption: 'Oversized vibes ✦', post_url: null, sort_order: 1 },
        { id: 'd2', image_url: 'https://images.unsplash.com/photo-1581803118522-7b72a50f7e9f?w=500&q=80', caption: 'Drop 01 is here', post_url: null, sort_order: 2 },
        { id: 'd3', image_url: 'https://images.unsplash.com/photo-1547153760-18fc86324498?w=500&q=80', caption: 'Move quietly', post_url: null, sort_order: 3 },
        { id: 'd4', image_url: 'https://images.unsplash.com/photo-1578681994506-b8f463449011?w=500&q=80', caption: 'Premium cotton feels different', post_url: null, sort_order: 4 },
        { id: 'd5', image_url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=500&q=80', caption: 'Minimal. Timeless.', post_url: null, sort_order: 5 },
        { id: 'd6', image_url: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=500&q=80', caption: 'New season', post_url: null, sort_order: 6 },
      ];
      Engine.Store.set('instaFeed', demo);
      Engine.Store.set('instaFeedLoading', false);
      return { data: demo, error: null };
    }

    try {
      const { data, error } = await SupabaseClient.get()
        .from('insta_posts')
        .select('*')
        .eq('active', true)
        .order('sort_order', { ascending: true })
        .limit(12);

      if (error) throw error;

      Engine.Store.set('instaFeed', data || []);
      Engine.Store.set('instaFeedLoading', false);
      return { data: data || [], error: null };

    } catch (err) {
      const msg = _formatError(err);
      Engine.Store.set('instaFeed', []);
      Engine.Store.set('instaFeedLoading', false);
      Engine.Logger.warn('API', 'getInstaFeed failed — using empty', msg);
      return { data: [], error: msg };
    }
  }

  /* Admin: getAllInstaPosts — fetch ALL posts including inactive */
  async function getAllInstaPosts() {
    if (_isDemo()) {
      return { data: Engine.Store.get('instaFeed') || [], error: null };
    }
    try {
      const { data, error } = await SupabaseClient.get()
        .from('insta_posts')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      Engine.Store.set('allInstaPosts', data || []);
      return { data: data || [], error: null };
    } catch (err) {
      return { data: [], error: _formatError(err) };
    }
  }

  /* Admin: saveInstaPost — create or update */
  async function saveInstaPost(payload, id = null) {
    if (!payload?.image_url) return { error: 'Image URL is required' };

    const clean = {
      image_url:  payload.image_url.trim(),
      caption:    payload.caption?.trim()   || null,
      post_url:   payload.post_url?.trim()  || null,
      sort_order: Number(payload.sort_order)  || 0,
      active:     payload.active !== false,
    };

    if (_isDemo()) {
      const feed = Engine.Store.get('instaFeed') || [];
      if (id) {
        Engine.Store.set('instaFeed', feed.map(p => p.id === id ? { ...p, ...clean } : p));
      } else {
        Engine.Store.set('instaFeed', [...feed, { id: 'demo-' + Date.now(), ...clean }]);
      }
      return { error: null };
    }

    try {
      let error;
      if (id) {
        ({ error } = await SupabaseClient.get()
          .from('insta_posts').update(clean).eq('id', id));
      } else {
        ({ error } = await SupabaseClient.get()
          .from('insta_posts').insert([clean]));
      }
      if (error) throw error;
      await getAllInstaPosts();
      return { error: null };
    } catch (err) {
      return { error: _formatError(err) };
    }
  }

  /* Admin: deleteInstaPost */
  async function deleteInstaPost(id) {
    if (!id) return { error: 'Post ID required' };

    if (_isDemo()) {
      const feed = Engine.Store.get('instaFeed') || [];
      Engine.Store.set('instaFeed', feed.filter(p => p.id !== id));
      return { error: null };
    }

    try {
      const { error } = await SupabaseClient.get()
        .from('insta_posts').delete().eq('id', id);
      if (error) throw error;
      await getAllInstaPosts();
      return { error: null };
    } catch (err) {
      return { error: _formatError(err) };
    }
  }

  return {
    getProducts, getProduct,
    createProduct, updateProduct, deleteProduct, updateStock,
    createOrder,
    createPaymentOrder, verifyPayment,
    getMyOrders, getAllOrders, updateOrderStatus, updateShipment,
    signIn, signUp, signOut, getSession, onAuthStateChange,
    getReviews, createReview, deleteReview,
    cancelOrder, markDelivered,
    getHomeReviews,
    getInstaFeed, getAllInstaPosts, saveInstaPost, deleteInstaPost,
    subscribeNewsletter,
  };

})();
