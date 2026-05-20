/**
 * COMPONENT / productCard.js — AMAN CLOTHING
 *
 * Fashion-first product card with wishlist button.
 *
 * PRESERVED contracts:
 *  · data-product-card attribute
 *  · data-add-to-cart="id" attribute
 *  · add-to-cart-btn class
 *
 * ADDED:
 *  · data-wishlist-toggle attribute (visual only, no engine state)
 *  · Portrait 3:4 image ratio
 *  · Minimal card body — name + price only
 */

Engine.Components = Engine.Components || {};

Engine.Components.ProductCard = (() => {

  /* Track wishlist state locally (session only) */
  const _wishlisted = new Set();

  function render(product) {
    const price   = Engine.Logic.formatPrice(product.price);
    const inStock = product.stock > 0;

    const imgSrc  = Engine.Renderer.safeUrl(product.image_url);
    const isWishlisted = _wishlisted.has(product.id);

    const imgHtml = imgSrc
      ? `<img
           src="${Engine.Renderer.escape(imgSrc)}"
           alt="${Engine.Renderer.escape(product.name)}"
           loading="lazy"
           decoding="async"
           onerror="this.onerror=null;this.style.display='none';this.parentElement.querySelector('.product-card-image-placeholder').style.display='flex'"
         />
         <div class="product-card-image-placeholder" style="display:none" aria-hidden="true"></div>`
      : `<div class="product-card-image-placeholder" aria-hidden="true"></div>`;

    return `
      <article
        class="product-card"
        data-id="${Engine.Renderer.escape(product.id)}"
        data-product-card
        role="article"
        aria-label="${Engine.Renderer.escape(product.name)}"
      >
        <div class="product-card-image">
          ${imgHtml}

          <!-- Wishlist button -->
          <button
            class="wishlist-btn ${isWishlisted ? 'active' : ''}"
            data-wishlist-toggle="${Engine.Renderer.escape(product.id)}"
            aria-label="${isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}"
            aria-pressed="${isWishlisted ? 'true' : 'false'}"
          >
            <svg width="16" height="16" viewBox="0 0 24 24"
                 fill="${isWishlisted ? 'currentColor' : 'none'}"
                 stroke="currentColor" stroke-width="1.8"
                 stroke-linecap="round" stroke-linejoin="round"
                 aria-hidden="true">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </button>

          <!-- Out of stock overlay -->
          ${!inStock ? `<div class="product-card-soldout" aria-hidden="true">SOLD OUT</div>` : ''}
        </div>

        <div class="product-card-body">
          <div class="product-card-meta">
            <h3 class="product-card-name">${Engine.Renderer.escape(product.name)}</h3>
            <div class="product-price">${price}</div>
          </div>
          <button
            class="add-to-cart-btn"
            data-add-to-cart="${Engine.Renderer.escape(product.id)}"
            aria-label="Add ${Engine.Renderer.escape(product.name)} to cart"
            ${inStock ? '' : 'disabled'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round"
                 aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        </div>
      </article>
    `;
  }

  /* ── Bind once to container via event delegation ── */
  function bindGrid(container) {
    if (!container) return;

    /* Wishlist toggle */
    container.addEventListener('click', (e) => {
      const wishBtn = e.target.closest('[data-wishlist-toggle]');
      if (wishBtn) {
        e.stopPropagation();
        const id        = wishBtn.dataset.wishlistToggle;
        const isNowOn   = _wishlisted.has(id)
          ? (_wishlisted.delete(id), false)
          : (_wishlisted.add(id),    true);

        wishBtn.classList.toggle('active', isNowOn);
        wishBtn.setAttribute('aria-pressed', String(isNowOn));
        const svgPath = wishBtn.querySelector('svg');
        if (svgPath) svgPath.setAttribute('fill', isNowOn ? 'currentColor' : 'none');
        return;
      }

      /* Navigate to product page (not on add-to-cart) */
      if (e.target.closest('[data-add-to-cart]')) return;
      const card = e.target.closest('[data-product-card]');
      if (!card) return;
      Engine.Router.navigate(`/product/${card.dataset.id}`);
    });

    /* Add-to-cart with debounce */
    const _lastClick = new Map();
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-add-to-cart]');
      if (!btn || btn.disabled) return;

      const productId = btn.dataset.addToCart;
      const now       = Date.now();
      const last      = _lastClick.get(productId) || 0;
      if (now - last < 500) return;
      _lastClick.set(productId, now);

      /* Navigate to product page so user can select size first */
      Engine.Router.navigate(`/product/${productId}`);
    });
  }

  return { render, bindGrid };

})();
