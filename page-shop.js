/**
 * PAGE / shop.js — AMAN CLOTHING
 * Path: js/pages/shop.js
 *
 * Full Shop page — shows all products with filters.
 * Reuses the same Engine.API.getProducts() + Store pattern.
 * NON-BLOCKING: render() is synchronous, data loads async via store.
 */

Engine.Pages = Engine.Pages || {};

Engine.Pages.Shop = (() => {

  const cfg = window.SITE_CONFIG;
  let _unsubscribe = null;

  function render(params) {
    const slug = (params?.slug && params.slug !== 'all') ? params.slug : undefined;

    const root = document.getElementById('app-root');
    if (!root) return;
    root.innerHTML = _skeleton(slug);

    _renderSkeletonCards();
    _bindEvents(slug);

    if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }

    _unsubscribe = Engine.Store.subscribe('products', (products) => {
      const error = Engine.Store.get('productsError');
      if (error) {
        Engine.Renderer.showError('#shop-products-grid', error, () => render(params));
        return;
      }
      if (Array.isArray(products) && products.length > 0) {
        _renderGrid(products, slug);
      }
    });

    const filters = {};
    if (slug) filters.category = slug;
    Engine.API.getProducts(filters);
  }

  function _skeleton(activeSlug) {
    const cats = cfg.features?.categories
      ? (cfg.products.categories || [
          { slug: 'all',      label: 'ALL'      },
          { slug: 'hoodies',  label: 'HOODIES'  },
          { slug: 't-shirts', label: 'T-SHIRTS' },
          { slug: 'shirts',   label: 'SHIRTS'   },
        ])
      : [];

    const filtersHtml = cats.length ? `
      <div class="filters-bar" id="shop-filters-bar" role="tablist" aria-label="Filter products">
        ${cats.map(c => `
          <button
            class="filter-chip ${(!activeSlug && c.slug === 'all') || activeSlug === c.slug ? 'active' : ''}"
            data-filter="${Engine.Renderer.escape(c.slug)}"
            role="tab"
            aria-selected="${(!activeSlug && c.slug === 'all') || activeSlug === c.slug ? 'true' : 'false'}"
          >
            ${Engine.Renderer.escape(c.label)}
          </button>
        `).join('')}
      </div>
    ` : '';

    const searchHtml = cfg.features?.search ? `
      <div class="product-search-wrap">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          type="text"
          id="shop-search"
          placeholder="Search products…"
          autocomplete="off"
          aria-label="Search products"
        />
      </div>
    ` : '';

    return `
      <!-- Page Header -->
      <div style="background:var(--color-surface);
                  border-bottom:1px solid var(--color-border);
                  padding:calc(var(--navbar-h) + var(--space-12)) 0 var(--space-8)">
        <div class="container">
          <p style="font-size:var(--text-xs);font-weight:700;letter-spacing:.14em;
                    text-transform:uppercase;color:var(--color-text-muted);
                    margin-bottom:var(--space-2)">
            ${Engine.Renderer.escape(cfg.name)} &mdash; Collection
          </p>
          <h1 style="font-size:var(--text-4xl);font-family:var(--font-display);
                     font-weight:300;letter-spacing:-.02em;
                     margin-bottom:var(--space-2)">
            ${activeSlug
              ? Engine.Renderer.escape(activeSlug.charAt(0).toUpperCase() + activeSlug.slice(1))
              : 'All Products'}
          </h1>
          <p style="color:var(--color-text-muted);font-size:var(--text-sm)">
            <span id="shop-count">Loading…</span>
          </p>
        </div>
      </div>

      <!-- Products Section -->
      <section style="padding:var(--space-10) 0 var(--space-20)">
        <div class="container">
          ${filtersHtml}
          ${searchHtml}
          <div class="products-grid" id="shop-products-grid"></div>
        </div>
      </section>
    `;
  }

  function _renderSkeletonCards() {
    const grid = document.getElementById('shop-products-grid');
    if (!grid) return;
    grid.innerHTML = Array(8).fill(0).map(() => `
      <div class="product-card product-card--skeleton" aria-hidden="true">
        <div class="product-card-image"></div>
        <div class="product-card-body">
          <div class="product-card-meta">
            <div class="skeleton-line" style="width:65%;height:14px;margin-bottom:6px"></div>
            <div class="skeleton-line" style="width:35%;height:13px"></div>
          </div>
        </div>
      </div>
    `).join('');
  }

  function _renderGrid(products, slug) {
    const grid    = document.getElementById('shop-products-grid');
    const countEl = document.getElementById('shop-count');
    if (!grid) return;

    if (countEl) {
      countEl.textContent = `${products.length} ${products.length === 1 ? 'product' : 'products'}`;
    }

    if (!products || products.length === 0) {
      Engine.Renderer.showEmpty('#shop-products-grid', {
        icon:  '🔍',
        title: 'No products found',
        desc:  'Try a different filter or search term.',
        action: `<button class="btn btn-outline" onclick="Engine.Pages.Shop.reset()">Clear filters</button>`,
      });
      return;
    }

    grid.innerHTML = products
      .map(p => Engine.Components.ProductCard.render(p))
      .join('');

    Engine.Components.ProductCard.bindGrid(grid);
  }

  function _bindEvents(currentSlug) {
    let _activeCategory = currentSlug || 'all';
    let _searchQuery    = '';
    let _searchTimer    = null;

    /* Filter chips */
    document.getElementById('shop-filters-bar')
      ?.addEventListener('click', (e) => {
        const chip = e.target.closest('.filter-chip');
        if (!chip) return;

        _activeCategory = chip.dataset.filter;

        document.querySelectorAll('#shop-filters-bar .filter-chip').forEach(c => {
          c.classList.toggle('active', c.dataset.filter === _activeCategory);
          c.setAttribute('aria-selected', c.dataset.filter === _activeCategory ? 'true' : 'false');
        });

        const stored = Engine.Store.get('products');
        if (_activeCategory === 'all' && !_searchQuery && stored && stored.length > 0) {
          _renderGrid(stored, null);
          return;
        }

        _renderSkeletonCards();
        const filters = _activeCategory !== 'all' ? { category: _activeCategory } : {};
        Engine.API.getProducts(filters);
      });

    /* Search */
    document.getElementById('shop-search')
      ?.addEventListener('input', (e) => {
        clearTimeout(_searchTimer);
        _searchTimer = setTimeout(() => {
          const q = Engine.Logic.sanitiseSearchQuery(e.target.value);
          _searchQuery = q;
          _renderSkeletonCards();
          const filters = {};
          if (q) filters.search = q;
          if (_activeCategory !== 'all') filters.category = _activeCategory;
          Engine.API.getProducts(filters);
        }, 350);
      });
  }

  function reset() { Engine.Router.navigate('/shop'); }

  return { render, reset };

})();

/* ── ROUTE REGISTRATION ── */
Engine.Router.register('/shop',               () => Engine.Pages.Shop.render());
Engine.Router.register('/shop/:slug',         (p) => Engine.Pages.Shop.render(p));
