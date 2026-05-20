/**
 * ═══════════════════════════════════════════════════════════
 * ENGINE / logic.js
 * Path: js/engine/logic.js
 *
 * Depends on: core.js, store.js
 *
 * Pure business logic — no DOM, no API, no side effects.
 * Shared by engine, components, and pages.
 *
 * PRODUCTION IMPROVEMENTS:
 *  1. formatPrice() — handles NaN/null safely (never shows "NaN")
 *  2. validateProduct() — checks length limits + max values
 *  3. sanitiseSearchQuery() — strips chars that break ilike queries
 *  4. cartSummary() — guards against NaN prices in cart items
 *  5. isAdmin() — explicit 3-layer check with fallback to false
 * ═══════════════════════════════════════════════════════════
 */

Engine.Logic = (() => {

  const { currency, locale }  = window.SITE_CONFIG.locale;
  const { lowStockThreshold } = window.SITE_CONFIG.products;

  /* ─────────────────────────────────────────────────────────
     FORMATTING
     ───────────────────────────────────────────────────────── */

  function formatPrice(amount) {
    const n = parseFloat(amount);
    if (isNaN(n)) return '--';
    return new Intl.NumberFormat(locale, {
      style:                 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(n);
  }

  /* ─────────────────────────────────────────────────────────
     STOCK
     ───────────────────────────────────────────────────────── */

  function stockStatus(stock) {
    const s = parseInt(stock);
    if (isNaN(s) || s <= 0)    return 'out';
    if (s <= lowStockThreshold) return 'low';
    return 'ok';
  }

  function stockLabel(stock) {
    const s = stockStatus(stock);
    if (s === 'out') return 'Out of stock';
    if (s === 'low') return `Only ${parseInt(stock)} left`;
    return `${parseInt(stock)} in stock`;
  }

  function canAddToCart(product, cartQty = 0) {
    if (!product || typeof product.stock !== 'number') return false;
    return product.stock > 0 && cartQty < product.stock;
  }

  /* ─────────────────────────────────────────────────────────
     VALIDATION
     ───────────────────────────────────────────────────────── */

  function validateProduct(data) {
    const errors = {};
    const name   = String(data.name || '').trim();

    if (!name)              errors.name  = 'Name is required';
    if (name.length > 200)  errors.name  = 'Name must be under 200 characters';

    const price = parseFloat(data.price);
    if (isNaN(price) || price <= 0) errors.price = 'Price must be a positive number';
    if (price > 999_999)            errors.price = 'Price exceeds maximum';

    const stock = parseInt(data.stock);
    if (isNaN(stock) || stock < 0) errors.stock = 'Stock must be 0 or more';
    if (stock > 999_999)           errors.stock = 'Stock exceeds maximum';

    return { valid: Object.keys(errors).length === 0, errors };
  }

  function validateEmail(email) {
    return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  function validatePassword(pw) {
    return typeof pw === 'string' && pw.length >= 6;
  }

  /* Strip chars that break Supabase ilike queries */
  function sanitiseSearchQuery(q) {
    if (typeof q !== 'string') return '';
    return q.trim().replace(/[%_\\]/g, '').slice(0, 100);
  }

  /* ─────────────────────────────────────────────────────────
     PRODUCT DISPLAY
     ───────────────────────────────────────────────────────── */

  function productBadge(product) {
    const s = stockStatus(product.stock);
    if (s === 'out') return { label: 'Out of Stock',          cls: 'badge-out' };
    if (s === 'low') return { label: `${product.stock} left`, cls: 'badge-low' };
    return null;
  }

  function sortProducts(products, by = 'default') {
    if (!Array.isArray(products)) return [];
    const arr = [...products];
    switch (by) {
      case 'price-asc':  return arr.sort((a, b) => a.price - b.price);
      case 'price-desc': return arr.sort((a, b) => b.price - a.price);
      case 'name':       return arr.sort((a, b) => a.name.localeCompare(b.name));
      case 'stock':      return arr.sort((a, b) => b.stock - a.stock);
      default:           return arr;
    }
  }

  /* ─────────────────────────────────────────────────────────
     CART
     ───────────────────────────────────────────────────────── */

  function cartSummary(items) {
    if (!Array.isArray(items)) return { subtotal: 0, count: 0, subtotalFormatted: formatPrice(0) };
    let subtotal = 0;
    let count    = 0;
    for (const item of items) {
      const price = parseFloat(item?.product?.price);
      const qty   = parseInt(item?.quantity);
      if (!isNaN(price) && !isNaN(qty) && qty > 0) {
        subtotal += price * qty;
        count    += qty;
      }
    }
    return { subtotal, count, subtotalFormatted: formatPrice(subtotal) };
  }

  /* ─────────────────────────────────────────────────────────
     AUTH
     ───────────────────────────────────────────────────────── */

  function isAdmin(user) {
    if (!user || typeof user !== 'object') return false;
    if ((window.SITE_CONFIG.admin.adminEmails || []).includes(user.email)) return true;
    if (user.role === 'admin') return true;
    if (Engine.Store.get('isAdmin') === true) return true;
    return false;
  }

  Engine.Logger.info('Logic', 'Business logic ready ✓');

  return {
    formatPrice,
    stockStatus, stockLabel, canAddToCart,
    validateProduct, validateEmail, validatePassword, sanitiseSearchQuery,
    productBadge, sortProducts,
    cartSummary,
    isAdmin,
  };

})();
