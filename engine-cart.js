/**
 * ═══════════════════════════════════════════════════════════
 * ENGINE / cart.js
 * Path: js/engine/cart.js
 *
 * Depends on: js/engine/core.js, js/engine/store.js
 *
 * Cart state management.
 * · All cart mutations go through here — never directly to Store
 * · Cross-tab sync via localStorage storage event
 * · Corrupted localStorage recovery (no crash on bad data)
 * · Stock validation checks cart qty + product.stock combined
 * · Debounced persist (rapid qty clicks don't thrash localStorage)
 * · Stores minimal product snapshot (keeps localStorage small)
 * ═══════════════════════════════════════════════════════════
 */

Engine.Cart = (() => {

  const STORAGE_KEY   = 'engine_cart';
  let   _persistTimer = null;

  function _getCart() { return Engine.Store.get('cart'); }

  function _save(cart) {
    Engine.Store.set('cart', cart);
    Engine.EventBus.emit(Engine.Events.CART_UPDATED, cart);
    _debouncedPersist(cart);
  }

  /* 150ms debounce — rapid qty clicks don't spam localStorage writes */
  function _debouncedPersist(cart) {
    clearTimeout(_persistTimer);
    _persistTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
      } catch (e) {
        /* QuotaExceededError — storage full, not fatal */
        Engine.Logger.warn('Cart', `localStorage write failed: ${e.name}`);
      }
    }, 150);
  }

  /* ── Restore cart from localStorage on app boot ── */
  function restore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (raw) {
        const parsed = JSON.parse(raw);

        /* Hard validation — malformed data cleared silently */
        if (!Array.isArray(parsed)) {
          Engine.Logger.warn('Cart', 'Corrupt cart in localStorage — clearing');
          localStorage.removeItem(STORAGE_KEY);
        } else {
          const valid = parsed.filter(i =>
            i &&
            i.product &&
            typeof i.product.id    !== 'undefined' &&
            typeof i.product.price === 'number'    &&
            typeof i.quantity      === 'number'    &&
            i.quantity > 0
          );

          if (valid.length !== parsed.length) {
            Engine.Logger.warn('Cart', `Removed ${parsed.length - valid.length} malformed cart items`);
          }

          Engine.Store.set('cart', valid);
        }
      }

    } catch (e) {
      Engine.Logger.warn('Cart', 'Failed to restore cart — resetting', e);
      localStorage.removeItem(STORAGE_KEY);
    }

    /* Always init cross-tab sync regardless of whether cart had data */
    _initCrossTabSync();
  }

  /* ── Cross-tab sync ──
     localStorage 'storage' event fires on ALL other tabs when
     a key changes. Cart stays in sync across all open tabs.     */
  function _initCrossTabSync() {
    window.addEventListener('storage', (e) => {
      if (e.key !== STORAGE_KEY) return;
      try {
        const cart = e.newValue ? JSON.parse(e.newValue) : [];
        if (!Array.isArray(cart)) return;
        /* Write to store directly — NOT _save() or we'd loop back */
        Engine.Store.set('cart', cart);
        Engine.EventBus.emit(Engine.Events.CART_UPDATED, cart);
        Engine.Logger.debug('Cart', 'Cross-tab sync applied');
      } catch (_) {}
    });
  }

  /* ── add() ─────────────────────────────────────────────── */
  /* add(product, qty, size)
     size is optional — null for one-size items
     Cart treats same product + different size as SEPARATE line items */
  function add(product, qty = 1, size = null) {
    if (!product) return false;

    if (typeof product.stock !== 'number' || product.stock < 1) {
      Engine.EventBus.emit(Engine.Events.NOTIFY, { msg: 'Out of stock', type: 'error' });
      return false;
    }

    qty = Math.max(1, Math.floor(qty));

    const cart = [..._getCart()];

    /* Match by product id AND size — different sizes = separate line items */
    const idx    = cart.findIndex(i =>
      i.product.id === product.id && (i.size || null) === (size || null)
    );
    const inCart = idx > -1 ? cart[idx].quantity : 0;
    const newQty = inCart + qty;

    /* Validate against remaining stock */
    if (newQty > product.stock) {
      const remaining = product.stock - inCart;
      const msg = remaining > 0
        ? `Only ${remaining} more available (${inCart} already in cart)`
        : 'Maximum quantity already in cart';
      Engine.EventBus.emit(Engine.Events.NOTIFY, { msg, type: 'warning' });
      return false;
    }

    if (idx > -1) {
      cart[idx] = { ...cart[idx], quantity: newQty };
    } else {
      cart.push({
        product: {
          id:        product.id,
          name:      product.name,
          price:     product.price,
          stock:     product.stock,
          image_url: product.image_url || null,
          category:  product.category  || null,
        },
        quantity: qty,
        size:     size || null,   /* stored with cart item */
      });
    }

    _save(cart);
    Engine.EventBus.emit(Engine.Events.NOTIFY, {
      msg:  `${product.name}${size ? ' (' + size + ')' : ''} added to cart`,
      type: 'success',
    });
    return true;
  }

  function remove(productId, size = null) {
    /* Size-aware: only remove the exact size variant */
    _save(_getCart().filter(i =>
      !(i.product.id === productId && (i.size || null) === (size || null))
    ));
  }

  function updateQty(productId, qty, size = null) {
    /* Size-aware: only update the exact size variant */
    if (typeof qty !== 'number' || qty < 1) { remove(productId, size); return; }
    _save(_getCart().map(i =>
      i.product.id === productId && (i.size || null) === (size || null)
        ? { ...i, quantity: Math.min(Math.floor(qty), i.product.stock) }
        : i
    ));
  }

  function clear() { _save([]); }

  function total() {
    return _getCart().reduce((s, i) => s + i.product.price * i.quantity, 0);
  }

  function count() {
    return _getCart().reduce((s, i) => s + i.quantity, 0);
  }

  function hasItem(productId) {
    return _getCart().some(i => i.product.id === productId);
  }

  Engine.Logger.info('Cart', 'Cart engine ready ✓');
  return { add, remove, updateQty, clear, total, count, hasItem, restore };

})();
