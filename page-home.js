/**
 * PAGE / home.js — AMAN CLOTHING
 *
 * NON-BLOCKING PATTERN (preserved):
 *  1. render() is SYNCHRONOUS — no async, no await
 *  2. Skeleton renders instantly
 *  3. Store.subscribe() listens for data
 *  4. API fires in background — no await
 *
 * NEW SECTIONS ADDED (all pure HTML/CSS — no engine changes needed):
 *  · Marquee ticker bar
 *  · Category tiles (visual shortcut to filter)
 *  · Brand trust strip (icons)
 *  · Mid-page featured drop banner
 *  · Testimonials section
 *  · Lookbook / Instagram grid
 *  · Newsletter signup
 *
 * PRESERVED:
 *  · #products-grid  (grid render target)
 *  · #filters-bar    (filter events target)
 *  · .filter-chip[data-filter] (filter pattern)
 *  · #product-search  (search input)
 */

Engine.Pages = Engine.Pages || {};

Engine.Pages.Home = (() => {

  const cfg = window.SITE_CONFIG;
  let _unsubscribe = null;

  /* ── RENDER — synchronous ── */
  function render(categorySlug) {
    const slug = (typeof categorySlug === 'string' && categorySlug !== 'all')
      ? categorySlug
      : undefined;

    const root = document.getElementById('app-root');
    if (!root) return;
    root.innerHTML = _skeleton(slug);

    _renderSkeletonCards();
    _bindEvents(slug);
    if (!slug) _initHeroSlider();

    /* Fire async section loaders — non-blocking */
    _loadReviews();
    _loadInstaFeed();

    if (_unsubscribe) {
      _unsubscribe();
      _unsubscribe = null;
    }

    _unsubscribe = Engine.Store.subscribe('products', (products) => {
      const error = Engine.Store.get('productsError');
      if (error) {
        Engine.Renderer.showError('#products-grid', error, () => render(slug));
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

  /* ═══════════════════════════════════════════════════════
     SKELETON — full page HTML structure
  ═══════════════════════════════════════════════════════ */
  function _skeleton(activeSlug) {

    /* ── Category filter chips ── */
    const cats = cfg.features.categories
      ? (cfg.products.categories || [
          { slug: 'all',      label: 'ALL'      },
          { slug: 'hoodies',  label: 'HOODIES'  },
          { slug: 't-shirts', label: 'T-SHIRTS' },
          { slug: 'shirts',   label: 'SHIRTS'   },
        ])
      : [];

    const filtersHtml = cats.length ? `
      <div class="filters-bar" id="filters-bar" role="tablist" aria-label="Filter products">
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

    /* ── Search bar ── */
    const searchHtml = cfg.features.search ? `
      <div class="product-search-wrap">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          type="text"
          id="product-search"
          placeholder="Search products…"
          autocomplete="off"
          aria-label="Search products"
        />
      </div>
    ` : '';

    /* ── CATEGORY PAGE (when filtering) ── */
    if (activeSlug) {
      return `
        <div class="category-page-header">
          <div class="container">
            <div class="category-page-inner">
              <div>
                <h1 class="category-page-title">
                  ${Engine.Renderer.escape(activeSlug.toUpperCase())}
                </h1>
                <span class="category-page-count" id="collection-count">Loading…</span>
              </div>
              <button class="filter-icon-btn" aria-label="Filter products">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                  <line x1="4" y1="6" x2="11" y2="6"/>
                  <line x1="13" y1="6" x2="20" y2="6"/>
                  <line x1="4" y1="12" x2="7" y2="12"/>
                  <line x1="9" y1="12" x2="20" y2="12"/>
                  <line x1="4" y1="18" x2="13" y2="18"/>
                  <line x1="15" y1="18" x2="20" y2="18"/>
                  <circle cx="12" cy="6" r="1.5" fill="currentColor" stroke="none"/>
                  <circle cx="8" cy="12" r="1.5" fill="currentColor" stroke="none"/>
                  <circle cx="14" cy="18" r="1.5" fill="currentColor" stroke="none"/>
                </svg>
                FILTER
              </button>
            </div>
          </div>
        </div>

        <section class="products-section" id="products">
          <div class="container">
            ${filtersHtml}
            ${searchHtml}
            <div class="products-grid" id="products-grid"></div>
          </div>
        </section>
      `;
    }

    /* ── FULL HOME PAGE ── */
    return `

      <!-- ① HERO SLIDER -->
      <section class="hero" aria-label="Hero banner">
        <div class="freeship-bar" aria-label="Free shipping offer">
          ${Engine.Renderer.escape(cfg.hero.badge || 'FREE SHIPPING ABOVE ₹999')}
        </div>
        <div class="hero-visual" id="hero-visual">
          <div class="hero-overlay"></div>
          <div class="hero-content">
            <div class="hero-eyebrow-tag">
              ${Engine.Renderer.escape(cfg.name)} &mdash; ${Engine.Renderer.escape(cfg.hero.eyebrow || 'New Season')}
            </div>
            <h1 class="hero-title">${cfg.hero.title || 'NEW<br>SEASON'}</h1>
            <p class="hero-desc">${Engine.Renderer.escape(cfg.hero.desc || 'Minimal. Timeless. Yours.')}</p>
            <div class="hero-ctas">
              <a href="${Engine.Renderer.escape(cfg.hero.ctaPrimary?.href || '#products')}"
                 class="btn btn-primary hero-cta-primary">
                ${Engine.Renderer.escape(cfg.hero.ctaPrimary?.label || 'Shop Now')}
              </a>
              <a href="${Engine.Renderer.escape(cfg.hero.ctaSecondary?.href || '#/about')}" class="btn btn-outline-white hero-cta-secondary">
                ${Engine.Renderer.escape(cfg.hero.ctaSecondary?.label || 'Explore')}
              </a>
            </div>
            <div class="hero-dots" id="hero-dots" aria-hidden="true">
              <span class="hero-dot active" data-index="0"></span>
              <span class="hero-dot" data-index="1"></span>
              <span class="hero-dot" data-index="2"></span>
            </div>
          </div>
        </div>
      </section>

      <!-- ② MARQUEE TICKER -->
      <div class="marquee-bar" aria-hidden="true">
        <div class="marquee-track">
          ${Array(3).fill('FREE SHIPPING &nbsp;·&nbsp; NEW SEASON DROP &nbsp;·&nbsp; PREMIUM STREETWEAR &nbsp;·&nbsp; LIMITED STOCK &nbsp;·&nbsp; CRAFTED IN INDIA &nbsp;·&nbsp; EASY RETURNS &nbsp;·&nbsp;').join('')}
        </div>
      </div>

      <!-- ③ CATEGORY TILES -->
      <section class="cat-tiles-section" aria-label="Shop by category">
        <div class="container">
          <h2 class="section-heading">SHOP BY CATEGORY</h2>
          <div class="cat-tiles-grid">
            <a href="#/category/hoodies" class="cat-tile" aria-label="Shop Hoodies">
              <div class="cat-tile-img" style="background-image:url(https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=600&q=80)"></div>
              <div class="cat-tile-label">HOODIES</div>
            </a>
            <a href="#/category/t-shirts" class="cat-tile" aria-label="Shop T-Shirts">
              <div class="cat-tile-img" style="background-image:url(https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=80)"></div>
              <div class="cat-tile-label">T-SHIRTS</div>
            </a>
            <a href="#/category/shirts" class="cat-tile" aria-label="Shop Shirts">
              <div class="cat-tile-img" style="background-image:url(https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&q=80)"></div>
              <div class="cat-tile-label">SHIRTS</div>
            </a>
          </div>
        </div>
      </section>

      <!-- ④ PRODUCTS GRID -->
      <section class="products-section" id="products">
        <div class="container">
          <div class="section-heading-row">
            <h2 class="section-heading">${Engine.Renderer.escape(cfg.products.sectionTitle || 'NEW SEASON')}</h2>
            <span class="collection-count-badge" id="collection-count"></span>
          </div>
          ${filtersHtml}
          ${searchHtml}
          <div class="products-grid" id="products-grid"></div>
        </div>
      </section>

      <!-- ⑤ FEATURED DROP BANNER -->
      <section class="drop-banner" aria-label="Featured drop">
        <div class="drop-banner-inner">
          <div class="drop-banner-text">
            <span class="drop-banner-eyebrow">LIMITED EDITION</span>
            <h2 class="drop-banner-title">DROP 01<br>IS HERE</h2>
            <p class="drop-banner-desc">Oversized silhouettes. Minimal branding.<br>Only for those who move quietly.</p>
            <a href="#/category/hoodies" class="btn btn-primary drop-banner-btn">SHOP THE DROP</a>
          </div>
          <div class="drop-banner-img" style="background-image:url(https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=800&q=80)"></div>
        </div>
      </section>

      <!-- ⑥ BRAND TRUST STRIP -->
      <section class="trust-strip" aria-label="Why choose us">
        <div class="container">
          <div class="trust-grid">
            <div class="trust-item">
              <div class="trust-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg></div>
              <div class="trust-title">Free Delivery</div>
              <div class="trust-desc">On orders above ₹999</div>
            </div>
            <div class="trust-item">
              <div class="trust-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg></div>
              <div class="trust-title">Sustainable</div>
              <div class="trust-desc">Eco-conscious materials</div>
            </div>
            <div class="trust-item">
              <div class="trust-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></div>
              <div class="trust-title">Premium Quality</div>
              <div class="trust-desc">400GSM+ fabrics only</div>
            </div>
            <div class="trust-item">
              <div class="trust-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg></div>
              <div class="trust-title">Easy Returns</div>
              <div class="trust-desc">7-day hassle-free policy</div>
            </div>
          </div>
        </div>
      </section>

      <!-- ⑦ TESTIMONIALS — dynamic via Supabase -->
      <section class="testimonials-section" aria-label="Customer reviews">
        <div class="container">
          <h2 class="section-heading">WHAT THEY SAY</h2>
          <div class="testimonials-grid" id="testimonials-grid">
            <!-- skeleton -->
            ${Array(3).fill(0).map(() => `
              <div class="testimonial-card testimonial-card--skeleton" aria-hidden="true">
                <div class="skeleton-line" style="width:60px;height:12px;margin-bottom:10px"></div>
                <div class="skeleton-line" style="width:90%;height:13px;margin-bottom:6px"></div>
                <div class="skeleton-line" style="width:75%;height:13px;margin-bottom:14px"></div>
                <div class="skeleton-line" style="width:45%;height:11px"></div>
              </div>
            `).join('')}
          </div>
        </div>
      </section>

      <!-- ⑧ LOOKBOOK GRID — dynamic via Supabase -->
      <section class="lookbook-section" aria-label="Lookbook">
        <div class="container">
          <div class="lookbook-header">
            <h2 class="section-heading">THE LOOKBOOK</h2>
            <span class="lookbook-tag">@${Engine.Renderer.escape(cfg.social?.instagramHandle || 'aman.clothing')}</span>
          </div>
          <div class="lookbook-grid" id="lookbook-grid">
            <!-- skeleton -->
            ${Array(6).fill(0).map(() => `
              <div class="lookbook-item lookbook-item--skeleton" aria-hidden="true"
                   style="background:var(--color-surface-2);border-radius:var(--radius-sm)"></div>
            `).join('')}
          </div>
        </div>
      </section>

      <!-- ⑨ NEWSLETTER -->
      <section class="newsletter-section" aria-label="Newsletter signup">
        <div class="container">
          <div class="newsletter-inner">
            <div class="newsletter-text">
              <h2 class="newsletter-title">GET EARLY ACCESS</h2>
              <p class="newsletter-desc">Be first to know about new drops, exclusive offers and restocks.</p>
            </div>
            <div class="newsletter-form">
              <input type="email" id="newsletter-email" placeholder="your@email.com" aria-label="Email address" />
              <button class="btn btn-primary" id="newsletter-submit">SUBSCRIBE</button>
            </div>
            <p class="newsletter-fine">No spam. Unsubscribe anytime.</p>
          </div>
        </div>
      </section>

    `;
  }

  /* ── DYNAMIC SECTION LOADERS ── */

  async function _loadReviews() {
    const grid = document.getElementById('testimonials-grid');
    if (!grid) return;

    const { data: reviews } = await Engine.API.getHomeReviews(6);

    if (!reviews || reviews.length === 0) {
      grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;
                    padding:var(--space-8);color:var(--color-text-muted);
                    font-size:var(--text-sm)">
          Be the first to leave a review!
        </div>`;
      return;
    }

    grid.innerHTML = reviews.map(r => {
      const stars  = '★'.repeat(Math.max(1, Math.min(5, r.rating || 5)));
      const empty  = '☆'.repeat(5 - (r.rating || 5));
      const name   = r.profiles?.full_name
        ? Engine.Renderer.escape(r.profiles.full_name)
        : 'Verified Buyer';
      const date   = r.created_at
        ? new Date(r.created_at).toLocaleDateString('en-IN',
            { month: 'short', year: 'numeric' })
        : '';
      return `
        <div class="testimonial-card">
          <div class="testimonial-stars" aria-label="${r.rating || 5} out of 5 stars">
            <span style="color:var(--color-accent)">${stars}</span><span style="color:var(--color-border)">${empty}</span>
          </div>
          ${r.title
            ? `<div style="font-weight:600;font-size:var(--text-sm);
                           margin-bottom:var(--space-2)">
                 ${Engine.Renderer.escape(r.title)}
               </div>`
            : ''}
          <p class="testimonial-text">"${Engine.Renderer.escape(r.body || '')}"</p>
          <div class="testimonial-author">
            — ${name}${date ? `, <span style="opacity:.6">${date}</span>` : ''}
            ${r.verified
              ? `<span style="display:inline-flex;align-items:center;gap:3px;
                              font-size:10px;font-weight:700;letter-spacing:.05em;
                              color:var(--color-success);margin-left:var(--space-2)">
                   ✓ Verified
                 </span>`
              : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  async function _loadInstaFeed() {
    const grid = document.getElementById('lookbook-grid');
    if (!grid) return;

    const { data: posts } = await Engine.API.getInstaFeed();

    if (!posts || posts.length === 0) {
      grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;
                    padding:var(--space-8);color:var(--color-text-muted);
                    font-size:var(--text-sm)">
          No posts yet — add some from the admin panel.
        </div>`;
      return;
    }

    grid.innerHTML = posts.map(post => {
      const inner = `
        <div class="lookbook-item"
             style="background-image:url(${Engine.Renderer.escape(post.image_url)});
                    background-size:cover;background-position:center;
                    cursor:${post.post_url ? 'pointer' : 'default'}"
             ${post.post_url
               ? `role="link" tabindex="0"
                  aria-label="${Engine.Renderer.escape(post.caption || 'View on Instagram')}"
                  data-insta-url="${Engine.Renderer.escape(post.post_url)}"`
               : `aria-label="${Engine.Renderer.escape(post.caption || 'Lookbook photo')}"`}>
          ${post.caption ? `
            <div class="lookbook-caption">
              ${Engine.Renderer.escape(post.caption)}
            </div>` : ''}
        </div>`;
      return inner;
    }).join('');

    /* Click handler for Instagram links */
    grid.addEventListener('click', (e) => {
      const item = e.target.closest('[data-insta-url]');
      if (item) window.open(item.dataset.instaUrl, '_blank', 'noopener,noreferrer');
    });
    grid.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const item = e.target.closest('[data-insta-url]');
        if (item) window.open(item.dataset.instaUrl, '_blank', 'noopener,noreferrer');
      }
    });
  }

  /* ── SKELETON CARDS ── */
  function _renderSkeletonCards() {
    const grid = document.getElementById('products-grid');
    if (!grid) return;
    grid.innerHTML = Array(6).fill(0).map(() => `
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

  /* ── RENDER GRID ── */
  function _renderGrid(products, slug) {
    const grid = document.getElementById('products-grid');
    if (!grid) return;

    const countEl = document.getElementById('collection-count');
    if (countEl) {
      countEl.textContent = `${products.length} ${products.length === 1 ? 'PRODUCT' : 'PRODUCTS'}`;
    }

    if (!products || products.length === 0) {
      Engine.Renderer.showEmpty('#products-grid', {
        icon:   '🔍',
        title:  'No products found',
        desc:   'Try a different filter or search term.',
        action: `<button class="btn btn-outline" onclick="Engine.Pages.Home.reset()">Clear filters</button>`,
      });
      return;
    }

    grid.innerHTML = products
      .map(p => Engine.Components.ProductCard.render(p))
      .join('');

    Engine.Components.ProductCard.bindGrid(grid);
  }

  /* ── HERO SLIDER ── */
  const _heroSlides = [
    'url(https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=1200&q=80)',
    'url(https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1200&q=80)',
    'url(https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=1200&q=80)',
  ];
  let _sliderTimer  = null;
  let _currentSlide = 0;

  function _initHeroSlider() {
    const visual = document.getElementById('hero-visual');
    const dots   = document.querySelectorAll('#hero-dots .hero-dot');
    if (!visual || !dots.length) return;
    if (_sliderTimer) clearInterval(_sliderTimer);

    function goTo(idx) {
      _currentSlide = idx;
      visual.style.backgroundImage    = _heroSlides[idx];
      visual.style.backgroundSize     = 'cover';
      visual.style.backgroundPosition = 'center top';
      dots.forEach((d, i) => d.classList.toggle('active', i === idx));
    }

    goTo(0);

    dots.forEach((dot, i) => {
      dot.style.cursor = 'pointer';
      dot.addEventListener('click', () => {
        clearInterval(_sliderTimer);
        goTo(i);
        _sliderTimer = setInterval(() => goTo((_currentSlide + 1) % _heroSlides.length), 4000);
      });
    });

    _sliderTimer = setInterval(() => goTo((_currentSlide + 1) % _heroSlides.length), 4000);
  }

  /* ── EVENT BINDINGS ── */
  function _bindEvents(currentSlug) {
    let _activeCategory = currentSlug || 'all';
    let _searchQuery    = '';
    let _searchTimer    = null;

    /* Filter chips */
    document.getElementById('filters-bar')
      ?.addEventListener('click', (e) => {
        const chip = e.target.closest('.filter-chip');
        if (!chip) return;

        _activeCategory = chip.dataset.filter;

        document.querySelectorAll('.filter-chip').forEach(c => {
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
    document.getElementById('product-search')
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

    /* Newsletter — real API call via Engine.API.subscribeNewsletter */
    document.getElementById('newsletter-submit')
      ?.addEventListener('click', async () => {
        const input = document.getElementById('newsletter-email');
        const btn   = document.getElementById('newsletter-submit');
        const email = input?.value?.trim();

        if (!email || !email.includes('@') || !email.includes('.')) {
          if (input) { input.style.borderColor = '#e53e3e'; setTimeout(() => input.style.borderColor = '', 1800); }
          return;
        }

        if (btn) { btn.textContent = 'Subscribing…'; btn.disabled = true; }

        const { error } = await Engine.API.subscribeNewsletter(email);

        if (error) {
          if (btn) { btn.textContent = 'Try Again'; btn.disabled = false; }
          if (input) { input.style.borderColor = '#e53e3e'; }
          Engine.EventBus.emit(Engine.Events.NOTIFY, { msg: error, type: 'error' });
        } else {
          if (btn) { btn.textContent = '✓ Subscribed!'; btn.style.background = 'var(--color-success)'; }
          if (input) input.value = '';
        }
      });

    /* Admin product changes */
    Engine.EventBus.on(Engine.Events.PRODUCT_UPDATED,
      () => _renderGrid(Engine.Store.get('products'), currentSlug));
    Engine.EventBus.on(Engine.Events.PRODUCT_DELETED,
      () => _renderGrid(Engine.Store.get('products'), currentSlug));
  }

  function reset() { window.location.hash = '#/'; }

  return { render, reset };

})();

/* ── ROUTE REGISTRATION ── */
Engine.Router.register('/',               () => Engine.Pages.Home.render());
Engine.Router.register('/category/:slug', (p) => Engine.Pages.Home.render(p.slug));
