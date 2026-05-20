/**
 * PAGE / product.js — AMAN CLOTHING
 *
 * CHANGES:
 *  · Related products: loads via Engine.API.getProducts({category}) after main product renders
 *    — subscribe to 'products' store only within product context, unsubscribe after
 *  · Size selector (S/M/L/XL) — local state
 *  · Sticky Add to Cart bar
 *  · Reviews section
 *  · SVG icons (no emojis)
 *  · Proper product image card with aspect ratio
 */

Engine.Pages = Engine.Pages || {};

Engine.Pages.Product = (() => {

  let _qty          = 1;
  let _adding       = false;
  let _selectedSize = null;
  let _unsubscribe  = null;
  let _relUnsub     = null;

  /* ── RENDER ── */
  function render(params) {
    const id = params?.id;
    if (!id) { Engine.Router.navigate('/'); return; }

    _qty = 1; _adding = false; _selectedSize = null;

    _renderSkeleton();

    if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }
    if (_relUnsub)    { _relUnsub();    _relUnsub    = null; }

    _unsubscribe = Engine.Store.subscribe('currentProduct', (product) => {
      if (!product || product.id !== id) return;
      _renderProduct(product);

      /* After product renders, fetch related — listen to store once */
      const cat = product.category;
      if (_relUnsub) { _relUnsub(); _relUnsub = null; }

      _relUnsub = Engine.Store.subscribe('products', (products) => {
        if (!Array.isArray(products) || products.length === 0) return;
        _renderRelated(product, products);
        /* unsubscribe after first successful render */
        if (_relUnsub) { _relUnsub(); _relUnsub = null; }
      });

      Engine.API.getProducts(cat ? { category: cat } : {});
    });

    /* Fetch reviews in background — non-blocking */
    Engine.API.getReviews(id);

    /* Subscribe to reviews store — renders when data arrives */
    Engine.Store.subscribe('reviews', (reviews) => {
      const rating = Engine.Store.get('reviewRating');
      if (Array.isArray(reviews)) _renderReviews(reviews, rating);
    });

    Engine.API.getProduct(id).then(({ data, error }) => {
      if (error || !data) {
        Engine.Renderer.mount('#app-root', `
          <div class="container" style="padding-top:calc(var(--navbar-h) + 4rem)">
            <div class="empty-state">
              <div class="empty-state-icon">🔍</div>
              <h2 class="empty-state-title">Product not found</h2>
              <p class="empty-state-desc">This product may have been removed.</p>
              <a class="btn btn-primary mt-4" href="#/">← Back to shop</a>
            </div>
          </div>
        `);
      }
    });
  }

  /* ── SKELETON ── */
  function _renderSkeleton() {
    Engine.Renderer.mount('#app-root', `
      <div class="product-detail">
        <div class="container">
          <div style="height:14px;background:var(--color-border);border-radius:4px;width:200px;margin-bottom:2rem"></div>
          <div class="product-detail-grid">
            <div class="product-detail-image-wrap" style="background:var(--color-surface-2);border-radius:4px"></div>
            <div class="product-detail-info">
              <div style="height:12px;background:var(--color-border);border-radius:4px;width:80px;margin-bottom:1rem"></div>
              <div style="height:32px;background:var(--color-border);border-radius:4px;width:80%;margin-bottom:1rem"></div>
              <div style="height:40px;background:var(--color-border);border-radius:4px;width:40%;margin-bottom:1.5rem"></div>
              <div style="height:56px;background:var(--color-border);border-radius:4px;margin-bottom:1rem"></div>
              <div style="height:48px;background:var(--color-border);border-radius:8px;width:60%"></div>
            </div>
          </div>
        </div>
      </div>
    `);
  }

  /* ── SVG ICON HELPERS ── */
  const _svg = {
    truck:  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`,
    refresh:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`,
    check:  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`,
    star:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    leaf:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>`,
    shield: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  };

  /* ── RENDER REAL PRODUCT ── */
  function _renderProduct(product) {
    const price     = Engine.Logic.formatPrice(product.price);
    const stockSt   = Engine.Logic.stockStatus(product.stock);
    const stockLbl  = Engine.Logic.stockLabel(product.stock);
    const inStock   = stockSt !== 'out';
    const cartItem  = Engine.Store.get('cart').find(i => i.product.id === product.id);
    const inCartQty = cartItem?.quantity || 0;
    const canAdd    = Engine.Logic.canAddToCart(product, inCartQty);

    const imgSrc  = Engine.Renderer.safeUrl(product.image_url);
    const imgHtml = imgSrc
      ? `<img src="${Engine.Renderer.escape(imgSrc)}"
              alt="${Engine.Renderer.escape(product.name)}"
              loading="lazy" decoding="async"
              onerror="this.style.display='none'" />`
      : `<div class="product-detail-img-placeholder">👕</div>`;

    const safeCategory = product.category ? Engine.Renderer.escape(product.category) : null;
    const sizes = ['XS','S','M','L','XL','XXL'];

    Engine.Renderer.mount('#app-root', `
      <div class="product-detail">
        <div class="container">

          <!-- Breadcrumb -->
          <nav class="product-detail-breadcrumb" aria-label="Breadcrumb">
            <a href="#/">Shop</a>
            <span class="breadcrumb-sep" aria-hidden="true">›</span>
            ${safeCategory ? `
              <a href="#/category/${safeCategory}">
                ${safeCategory.charAt(0).toUpperCase() + safeCategory.slice(1)}
              </a>
              <span class="breadcrumb-sep" aria-hidden="true">›</span>
            ` : ''}
            <span aria-current="page">${Engine.Renderer.escape(product.name)}</span>
          </nav>

          <!-- Main grid -->
          <div class="product-detail-grid">

            <!-- Image card -->
            <div class="product-detail-image-card">
              <div class="product-detail-image-wrap">${imgHtml}</div>
              ${!inStock ? `<div class="product-detail-soldout-badge">SOLD OUT</div>` : ''}
            </div>

            <!-- Info -->
            <div class="product-detail-info">

              ${safeCategory ? `<div class="product-detail-category">${safeCategory}</div>` : ''}

              <h1 class="product-detail-name">${Engine.Renderer.escape(product.name)}</h1>

              <div class="product-detail-price" aria-label="Price: ${price}">${price}</div>

              ${product.description
                ? `<p class="product-detail-desc">${Engine.Renderer.escape(product.description)}</p>`
                : ''}

              <!-- Size selector -->
              <div class="size-selector-wrap">
                <div class="size-selector-label">
                  SELECT SIZE
                  <span class="size-guide-link" id="size-guide-btn">Size Guide ↗</span>
                </div>
                <div class="size-selector" id="size-selector" role="group" aria-label="Select size">
                  ${sizes.map(s => `
                    <button class="size-btn ${_selectedSize === s ? 'active' : ''}"
                            data-size="${s}" aria-pressed="${_selectedSize === s}">${s}</button>
                  `).join('')}
                </div>
              </div>

              <!-- Stock indicator -->
              <div class="product-detail-stock">
                <span class="stock-dot ${stockSt === 'ok' ? '' : stockSt}" aria-hidden="true"></span>
                <span>${stockLbl}</span>
                ${inCartQty > 0 ? `
                  <span style="margin-left:auto;font-size:var(--text-xs);color:var(--color-accent)">
                    ${inCartQty} already in cart
                  </span>
                ` : ''}
              </div>

              <!-- Qty -->
              ${inStock ? `
                <div class="qty-selector" role="group" aria-label="Quantity">
                  <button class="qty-btn" id="qty-dec" aria-label="Decrease" ${_qty <= 1 ? 'disabled' : ''}>−</button>
                  <span class="qty-display" id="qty-display" aria-live="polite">${_qty}</span>
                  <button class="qty-btn" id="qty-inc" aria-label="Increase" ${_qty >= (product.stock - inCartQty) ? 'disabled' : ''}>+</button>
                </div>
              ` : ''}

              <!-- Actions -->
              <div class="product-detail-actions">
                <button class="btn btn-primary btn-lg" id="add-to-cart-main"
                        style="flex:1"
                        ${!inStock || !canAdd ? 'disabled' : ''}>
                  ${!inStock ? 'Out of Stock' : !canAdd ? 'Max in cart' : 'Add to Cart'}
                </button>
                <button class="btn btn-outline btn-lg" id="open-cart-btn">View Cart</button>
              </div>

              <!-- Trust strip (SVG icons) -->
              <div class="product-meta-strip">
                <div class="product-meta-item">${_svg.truck}<span>Free delivery above ₹999</span></div>
                <div class="product-meta-item">${_svg.refresh}<span>7-day easy returns</span></div>
                <div class="product-meta-item">${_svg.shield}<span>100% authentic product</span></div>
              </div>

            </div>
          </div>
        </div>
      </div>

      <!-- Sticky bar -->
      <div class="sticky-cart-bar" id="sticky-cart-bar">
        <div class="sticky-cart-info">
          <span class="sticky-cart-name">${Engine.Renderer.escape(product.name)}</span>
          <span class="sticky-cart-price">${price}</span>
        </div>
        <button class="btn btn-primary sticky-cart-btn" id="sticky-add-btn"
                ${!inStock ? 'disabled' : ''}>
          ${inStock ? 'Add to Cart' : 'Out of Stock'}
        </button>
      </div>

      <!-- Related products placeholder — filled by _renderRelated() -->
      <div id="related-section-wrap"></div>

      <!-- Reviews — rendered dynamically by _renderReviews() after store updates -->
      <section class="reviews-section" id="reviews-section">
        <div class="container">
          <div class="reviews-loading">Loading reviews…</div>
        </div>
      </section>

    `);

    _bindEvents(product);
    _renderSizeGuideModal();
  }

  /* ── RENDER RELATED (called after products store updates) ── */
  function _renderRelated(product, allProducts) {
    const wrap = document.getElementById('related-section-wrap');
    if (!wrap) return;

    const sameCategory = allProducts.filter(p =>
      p.id !== product.id && p.category === product.category
    ).slice(0, 4);

    const others = allProducts.filter(p => p.id !== product.id).slice(0, 4);
    const related = sameCategory.length >= 2 ? sameCategory : others;

    if (!related.length) return;

    wrap.innerHTML = `
      <section class="related-section">
        <div class="container">
          <h2 class="section-heading">YOU MAY ALSO LIKE</h2>
          <div class="related-grid" id="related-grid">
            ${related.map(p => Engine.Components.ProductCard.render(p)).join('')}
          </div>
        </div>
      </section>
    `;

    const grid = document.getElementById('related-grid');
    if (grid) Engine.Components.ProductCard.bindGrid(grid);
  }

  /* ── RENDER REVIEWS (called from store subscribe) ── */
  function _renderReviews(reviews, rating) {
    const section = document.getElementById('reviews-section');
    if (!section) return;

    const user = Engine.Store.get('user');

    /* Star rating helper */
    function _stars(n) {
      return Array.from({length:5}, (_,i) =>
        `<span style="color:${i < Math.round(n) ? '#f0a500' : 'var(--color-border)'}">★</span>`
      ).join('');
    }

    /* Time ago helper */
    function _timeAgo(iso) {
      const diff = (Date.now() - new Date(iso).getTime()) / 1000;
      if (diff < 3600)  return `${Math.floor(diff/60)} minutes ago`;
      if (diff < 86400) return `${Math.floor(diff/3600)} hours ago`;
      if (diff < 2592000) return `${Math.floor(diff/86400)} days ago`;
      return `${Math.floor(diff/2592000)} months ago`;
    }

    const avg   = rating?.avg_rating   || 0;
    const count = rating?.review_count || 0;

    const userReview = user
      ? reviews.find(r => r.user_id === user.id)
      : null;

    /* Review form — only if logged in and hasn't reviewed */
    const formHtml = user && !userReview ? `
      <div class="review-form-wrap" id="review-form-wrap">
        <h3 class="review-form-title">Write a Review</h3>
        <div class="review-star-picker" id="star-picker" role="group" aria-label="Select rating">
          ${[1,2,3,4,5].map(n =>
            `<button class="star-pick-btn" data-star="${n}" aria-label="${n} stars">★</button>`
          ).join('')}
        </div>
        <input type="text" id="review-title-input" placeholder="Short title (optional)"
               maxlength="120" style="width:100%;margin-bottom:var(--space-3);padding:var(--space-3);border:1.5px solid var(--color-border);border-radius:4px;background:var(--color-surface);font-size:var(--text-sm);" />
        <textarea id="review-body-input" placeholder="Tell others about your experience… (min 10 chars)"
                  rows="4" maxlength="1000"
                  style="width:100%;padding:var(--space-3);border:1.5px solid var(--color-border);border-radius:4px;background:var(--color-surface);font-size:var(--text-sm);resize:vertical;"></textarea>
        <button class="btn btn-primary" id="review-submit-btn" style="margin-top:var(--space-3)">Submit Review</button>
        <p id="review-form-error" style="color:red;font-size:var(--text-xs);margin-top:var(--space-2);display:none"></p>
      </div>
    ` : (!user ? `
      <div class="review-login-prompt">
        <a href="#/auth" class="btn btn-outline" style="font-size:var(--text-sm)">Log in to leave a review</a>
      </div>
    ` : '');

    const reviewsHtml = reviews.length ? reviews.map(r => `
      <div class="review-card">
        <div class="review-card-header">
          <div>
            <div class="review-stars">${_stars(r.rating)}</div>
            ${r.title ? `<div class="review-title-text">${Engine.Renderer.escape(r.title)}</div>` : ''}
          </div>
          ${r.verified ? '<span class="verified-badge">✓ Verified</span>' : ''}
        </div>
        <p class="review-text">${Engine.Renderer.escape(r.body)}</p>
        <div class="review-meta">
          <span class="review-author">${Engine.Renderer.escape(r.profiles?.full_name || 'Customer')}</span>
          <span class="review-date">${_timeAgo(r.created_at)}</span>
          ${user && r.user_id === user.id ? `
            <button class="review-delete-btn" data-review-id="${r.id}" style="margin-left:auto;background:none;border:none;color:var(--color-text-muted);font-size:var(--text-xs);cursor:pointer;">Delete</button>
          ` : ''}
        </div>
      </div>
    `).join('') : `
      <div class="review-empty">No reviews yet — be the first!</div>
    `;

    section.innerHTML = `
      <div class="container">
        <div class="reviews-header">
          <h2 class="section-heading">CUSTOMER REVIEWS</h2>
          ${count > 0 ? `
            <div class="reviews-summary">
              <div class="reviews-stars-row">${_stars(avg)}</div>
              <span class="reviews-score">${avg}</span>
              <span class="reviews-count">(${count} review${count !== 1 ? 's' : ''})</span>
            </div>
          ` : ''}
        </div>
        ${formHtml}
        <div class="reviews-grid" id="reviews-list">${reviewsHtml}</div>
      </div>
    `;

    /* Bind review form events */
    _bindReviewForm(section);
  }

  /* ── BIND REVIEW FORM ── */
  function _bindReviewForm(section) {
    let _pickedStar = 0;
    const currentProduct = Engine.Store.get('currentProduct');
    if (!currentProduct) return;

    /* Star picker */
    section.querySelectorAll('.star-pick-btn').forEach(btn => {
      btn.addEventListener('mouseover', () => {
        const n = +btn.dataset.star;
        section.querySelectorAll('.star-pick-btn').forEach((b,i) => {
          b.style.color = i < n ? '#f0a500' : 'var(--color-border)';
        });
      });
      btn.addEventListener('mouseleave', () => {
        section.querySelectorAll('.star-pick-btn').forEach((b,i) => {
          b.style.color = i < _pickedStar ? '#f0a500' : 'var(--color-border)';
        });
      });
      btn.addEventListener('click', () => {
        _pickedStar = +btn.dataset.star;
        section.querySelectorAll('.star-pick-btn').forEach((b,i) => {
          b.style.color = i < _pickedStar ? '#f0a500' : 'var(--color-border)';
          b.setAttribute('aria-pressed', String(i < _pickedStar));
        });
      });
    });

    /* Submit */
    section.querySelector('#review-submit-btn')?.addEventListener('click', async () => {
      const titleEl = section.querySelector('#review-title-input');
      const bodyEl  = section.querySelector('#review-body-input');
      const errEl   = section.querySelector('#review-form-error');
      const btn     = section.querySelector('#review-submit-btn');

      errEl.style.display = 'none';

      if (!_pickedStar) { errEl.textContent = 'Please select a star rating'; errEl.style.display = 'block'; return; }
      if (!bodyEl.value.trim() || bodyEl.value.trim().length < 10) {
        errEl.textContent = 'Review must be at least 10 characters';
        errEl.style.display = 'block';
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Submitting…';

      const { error } = await Engine.API.createReview({
        productId: currentProduct.id,
        rating:    _pickedStar,
        title:     titleEl?.value?.trim() || '',
        body:      bodyEl.value.trim(),
      });

      if (error) {
        errEl.textContent = error;
        errEl.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Submit Review';
      }
      /* On success: store subscribe fires automatically — reviews re-render */
    });

    /* Delete */
    section.querySelectorAll('.review-delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete your review?')) return;
        await Engine.API.deleteReview(btn.dataset.reviewId, currentProduct.id);
      });
    });
  }

  /* ── EVENT BINDINGS ── */

  /* ── SIZE GUIDE MODAL ── */
  function _renderSizeGuideModal() {
    const existing = document.getElementById('size-guide-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'size-guide-modal';
    modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.55);backdrop-filter:blur(4px);align-items:center;justify-content:center;padding:16px';

    modal.innerHTML = `
      <div style="background:var(--color-surface);border-radius:var(--radius-xl);width:100%;max-width:520px;max-height:90vh;overflow-y:auto;padding:var(--space-6);position:relative">

        <button id="size-guide-close" style="position:absolute;top:16px;right:16px;background:none;border:none;font-size:1.5rem;cursor:pointer;color:var(--color-text-muted);line-height:1">×</button>

        <h2 style="font-family:var(--font-display);font-size:var(--text-2xl);margin-bottom:var(--space-1)">Size Guide</h2>
        <p style="color:var(--color-text-muted);font-size:var(--text-sm);margin-bottom:var(--space-6)">Standard Indian sizing — measurements in inches</p>

        <!-- Hoodies & Shirts -->
        <h3 style="font-size:var(--text-sm);font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin-bottom:var(--space-3)">Hoodies & Shirts</h3>
        <div style="overflow-x:auto;margin-bottom:var(--space-6)">
          <table style="width:100%;border-collapse:collapse;font-size:var(--text-sm)">
            <thead>
              <tr style="background:var(--color-surface-2)">
                <th style="padding:var(--space-2) var(--space-3);text-align:left;border:1px solid var(--color-border)">Size</th>
                <th style="padding:var(--space-2) var(--space-3);text-align:center;border:1px solid var(--color-border)">Chest (in)</th>
                <th style="padding:var(--space-2) var(--space-3);text-align:center;border:1px solid var(--color-border)">Length (in)</th>
                <th style="padding:var(--space-2) var(--space-3);text-align:center;border:1px solid var(--color-border)">Shoulder (in)</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style="padding:var(--space-2) var(--space-3);border:1px solid var(--color-border);font-weight:600">S</td><td style="padding:var(--space-2) var(--space-3);text-align:center;border:1px solid var(--color-border)">36–38</td><td style="padding:var(--space-2) var(--space-3);text-align:center;border:1px solid var(--color-border)">27</td><td style="padding:var(--space-2) var(--space-3);text-align:center;border:1px solid var(--color-border)">16.5</td></tr>
              <tr style="background:var(--color-surface-2)"><td style="padding:var(--space-2) var(--space-3);border:1px solid var(--color-border);font-weight:600">M</td><td style="padding:var(--space-2) var(--space-3);text-align:center;border:1px solid var(--color-border)">38–40</td><td style="padding:var(--space-2) var(--space-3);text-align:center;border:1px solid var(--color-border)">28</td><td style="padding:var(--space-2) var(--space-3);text-align:center;border:1px solid var(--color-border)">17.5</td></tr>
              <tr><td style="padding:var(--space-2) var(--space-3);border:1px solid var(--color-border);font-weight:600">L</td><td style="padding:var(--space-2) var(--space-3);text-align:center;border:1px solid var(--color-border)">40–42</td><td style="padding:var(--space-2) var(--space-3);text-align:center;border:1px solid var(--color-border)">29</td><td style="padding:var(--space-2) var(--space-3);text-align:center;border:1px solid var(--color-border)">18.5</td></tr>
              <tr style="background:var(--color-surface-2)"><td style="padding:var(--space-2) var(--space-3);border:1px solid var(--color-border);font-weight:600">XL</td><td style="padding:var(--space-2) var(--space-3);text-align:center;border:1px solid var(--color-border)">42–44</td><td style="padding:var(--space-2) var(--space-3);text-align:center;border:1px solid var(--color-border)">30</td><td style="padding:var(--space-2) var(--space-3);text-align:center;border:1px solid var(--color-border)">19.5</td></tr>
              <tr><td style="padding:var(--space-2) var(--space-3);border:1px solid var(--color-border);font-weight:600">XXL</td><td style="padding:var(--space-2) var(--space-3);text-align:center;border:1px solid var(--color-border)">44–46</td><td style="padding:var(--space-2) var(--space-3);text-align:center;border:1px solid var(--color-border)">31</td><td style="padding:var(--space-2) var(--space-3);text-align:center;border:1px solid var(--color-border)">20.5</td></tr>
            </tbody>
          </table>
        </div>

        <!-- T-Shirts -->
        <h3 style="font-size:var(--text-sm);font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin-bottom:var(--space-3)">T-Shirts</h3>
        <div style="overflow-x:auto;margin-bottom:var(--space-6)">
          <table style="width:100%;border-collapse:collapse;font-size:var(--text-sm)">
            <thead>
              <tr style="background:var(--color-surface-2)">
                <th style="padding:var(--space-2) var(--space-3);text-align:left;border:1px solid var(--color-border)">Size</th>
                <th style="padding:var(--space-2) var(--space-3);text-align:center;border:1px solid var(--color-border)">Chest (in)</th>
                <th style="padding:var(--space-2) var(--space-3);text-align:center;border:1px solid var(--color-border)">Length (in)</th>
                <th style="padding:var(--space-2) var(--space-3);text-align:center;border:1px solid var(--color-border)">Shoulder (in)</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style="padding:var(--space-2) var(--space-3);border:1px solid var(--color-border);font-weight:600">S</td><td style="padding:var(--space-2) var(--space-3);text-align:center;border:1px solid var(--color-border)">35–37</td><td style="padding:var(--space-2) var(--space-3);text-align:center;border:1px solid var(--color-border)">26</td><td style="padding:var(--space-2) var(--space-3);text-align:center;border:1px solid var(--color-border)">16</td></tr>
              <tr style="background:var(--color-surface-2)"><td style="padding:var(--space-2) var(--space-3);border:1px solid var(--color-border);font-weight:600">M</td><td style="padding:var(--space-2) var(--space-3);text-align:center;border:1px solid var(--color-border)">37–39</td><td style="padding:var(--space-2) var(--space-3);text-align:center;border:1px solid var(--color-border)">27</td><td style="padding:var(--space-2) var(--space-3);text-align:center;border:1px solid var(--color-border)">17</td></tr>
              <tr><td style="padding:var(--space-2) var(--space-3);border:1px solid var(--color-border);font-weight:600">L</td><td style="padding:var(--space-2) var(--space-3);text-align:center;border:1px solid var(--color-border)">39–41</td><td style="padding:var(--space-2) var(--space-3);text-align:center;border:1px solid var(--color-border)">28</td><td style="padding:var(--space-2) var(--space-3);text-align:center;border:1px solid var(--color-border)">18</td></tr>
              <tr style="background:var(--color-surface-2)"><td style="padding:var(--space-2) var(--space-3);border:1px solid var(--color-border);font-weight:600">XL</td><td style="padding:var(--space-2) var(--space-3);text-align:center;border:1px solid var(--color-border)">41–43</td><td style="padding:var(--space-2) var(--space-3);text-align:center;border:1px solid var(--color-border)">29</td><td style="padding:var(--space-2) var(--space-3);text-align:center;border:1px solid var(--color-border)">19</td></tr>
              <tr><td style="padding:var(--space-2) var(--space-3);border:1px solid var(--color-border);font-weight:600">XXL</td><td style="padding:var(--space-2) var(--space-3);text-align:center;border:1px solid var(--color-border)">43–45</td><td style="padding:var(--space-2) var(--space-3);text-align:center;border:1px solid var(--color-border)">30</td><td style="padding:var(--space-2) var(--space-3);text-align:center;border:1px solid var(--color-border)">20</td></tr>
            </tbody>
          </table>
        </div>

        <!-- How to Measure -->
        <div style="background:var(--color-surface-2);border-radius:var(--radius-md);padding:var(--space-4)">
          <h3 style="font-size:var(--text-sm);font-weight:700;margin-bottom:var(--space-3)">📏 How to Measure</h3>
          <div style="font-size:var(--text-xs);color:var(--color-text-muted);display:flex;flex-direction:column;gap:var(--space-2)">
            <p><strong>Chest:</strong> Measure around the fullest part of your chest, keeping tape horizontal.</p>
            <p><strong>Length:</strong> Measure from the highest point of shoulder down to the hem.</p>
            <p><strong>Shoulder:</strong> Measure from one shoulder seam to the other across the back.</p>
          </div>
        </div>

        <p style="margin-top:var(--space-4);font-size:var(--text-xs);color:var(--color-text-muted);text-align:center">
          Not sure? WhatsApp us at <strong>+91 92350 52684</strong>
        </p>

      </div>
    `;

    document.body.appendChild(modal);

    /* Open */
    document.getElementById('size-guide-btn')?.addEventListener('click', () => {
      modal.style.display = 'flex';
    });

    /* Close */
    document.getElementById('size-guide-close')?.addEventListener('click', () => {
      modal.style.display = 'none';
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.style.display = 'none';
    });
  }

  function _bindEvents(product) {
    const cartItem   = Engine.Store.get('cart').find(i => i.product.id === product.id);
    const inCartQty  = cartItem?.quantity || 0;
    const maxAddable = product.stock - inCartQty;

    const decBtn    = document.getElementById('qty-dec');
    const incBtn    = document.getElementById('qty-inc');
    const display   = document.getElementById('qty-display');
    const addBtn    = document.getElementById('add-to-cart-main');
    const stickyBtn = document.getElementById('sticky-add-btn');
    const stickyBar = document.getElementById('sticky-cart-bar');

    function _updateQtyUI() {
      if (display) display.textContent = _qty;
      if (decBtn)  decBtn.disabled     = _qty <= 1;
      if (incBtn)  incBtn.disabled     = _qty >= maxAddable;
    }

    decBtn?.addEventListener('click', () => { if (_qty > 1) { _qty--; _updateQtyUI(); } });
    incBtn?.addEventListener('click', () => { if (_qty < maxAddable) { _qty++; _updateQtyUI(); } });

    /* Size selector */
    document.getElementById('size-selector')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.size-btn');
      if (!btn) return;
      _selectedSize = btn.dataset.size;
      document.querySelectorAll('.size-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.size === _selectedSize);
        b.setAttribute('aria-pressed', String(b.dataset.size === _selectedSize));
      });
    });

    function _doAddToCart(btn) {
      if (_adding || !btn || btn.disabled) return;

      /* Size validation — must select before adding */
      if (!_selectedSize) {
        /* Shake the size selector to draw attention */
        const sizeSelector = document.getElementById('size-selector');
        if (sizeSelector) {
          sizeSelector.style.animation = 'none';
          sizeSelector.style.outline   = '2px solid var(--color-error)';
          sizeSelector.style.borderRadius = 'var(--radius-md)';
          setTimeout(() => {
            if (sizeSelector) sizeSelector.style.outline = '';
          }, 2000);
        }
        Engine.EventBus.emit(Engine.Events.NOTIFY, {
          msg:  'Please select a size first',
          type: 'warning',
        });
        return;
      }

      _adding = true;
      btn.disabled    = true;
      btn.textContent = 'Adding…';
      const added = Engine.Cart.add(product, _qty, _selectedSize);
      if (added) {
        btn.textContent      = '✓ Added!';
        btn.style.background = 'var(--color-success)';
        setTimeout(() => { _adding = false; _qty = 1; _renderProduct(product); }, 1400);
      } else {
        _adding = false; btn.disabled = false; btn.textContent = 'Add to Cart';
      }
    }

    addBtn?.addEventListener('click', () => _doAddToCart(addBtn));
    stickyBtn?.addEventListener('click', () => _doAddToCart(stickyBtn));

    /* Sticky bar visibility */
    if (stickyBar && addBtn) {
      const observer = new IntersectionObserver(
        ([entry]) => stickyBar.classList.toggle('visible', !entry.isIntersecting),
        { threshold: 0 }
      );
      observer.observe(addBtn);
    }

    document.getElementById('open-cart-btn')?.addEventListener('click', () => {
      Engine.EventBus.emit(Engine.Events.CART_OPENED);
    });
  }

  return { render };

})();

Engine.Router.register('/product/:id', (p) => Engine.Pages.Product.render(p));
