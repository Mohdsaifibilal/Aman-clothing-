/**
 * COMPONENT / navbar.js — AMAN CLOTHING
 *
 * Layout: Hamburger (left) | Logo (center) | Actions (right)
 * Extras: Fullscreen menu drawer, bottom navigation bar
 *
 * PRESERVED contracts:
 *  · #main-navbar
 *  · #cart-toggle-btn
 *  · #cart-count
 *  · #user-menu-btn
 *  · .nav-link class on all nav links
 */

Engine.Components = Engine.Components || {};

Engine.Components.Navbar = (() => {

  let _rendered   = false;
  let _drawerOpen = false;

  /* ══════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════ */
  function render() {
    const cfg     = window.SITE_CONFIG;
    const user    = Engine.Store.get('user');
    const isAdmin = Engine.Logic.isAdmin(user);
    const count   = Engine.Cart.count();

    /* Build drawer nav links */
    const drawerLinks = (cfg.nav || []).map(link => `
      <a href="${Engine.Renderer.escape(link.href)}"
         class="nav-link drawer-link"
         aria-label="${Engine.Renderer.escape(link.label)}">
        ${Engine.Renderer.escape(link.label)}
      </a>
    `).join('');

    Engine.Renderer.mount('#navbar-root', `

      <!-- ── TOP NAVBAR ── -->
      <nav class="navbar" id="main-navbar" role="navigation" aria-label="Main navigation">
        <div class="navbar-inner">

          <!-- Left: hamburger -->
          <button class="hamburger" id="menu-toggle-btn" aria-label="Open menu" aria-expanded="false">
            <span></span>
            <span></span>
            <span></span>
          </button>

          <!-- Center: logo -->
          <a href="#/" class="navbar-logo" aria-label="${Engine.Renderer.escape(cfg.name)} home">
            ${Engine.Renderer.escape(cfg.name)}
          </a>

          <!-- Right: actions -->
          <div class="navbar-actions">

            <button class="icon-btn" id="search-btn" aria-label="Search">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="1.8"
                   stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
            </button>

            ${cfg.features.cart ? `
              <button class="icon-btn cart-icon-btn" id="cart-toggle-btn"
                      aria-label="Open shopping cart">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="1.8"
                     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                  <line x1="3" y1="6" x2="21" y2="6"/>
                  <path d="M16 10a4 4 0 0 1-8 0"/>
                </svg>
                <span class="cart-count" id="cart-count" aria-live="polite">
                  ${count > 0 ? count : ''}
                </span>
              </button>
            ` : ''}

            ${cfg.features.auth && user ? `
              <button class="user-btn" id="user-menu-btn"
                      title="Signed in as ${Engine.Renderer.escape(user.email)} — tap to sign out"
                      aria-label="Sign out">
                ${Engine.Renderer.escape(user.email[0].toUpperCase())}
              </button>
            ` : ''}

            ${isAdmin ? `
              <a href="#/admin" class="icon-btn admin-badge" aria-label="Admin panel">⚙</a>
            ` : ''}

          </div>
        </div>
      </nav>

      <!-- ── MENU DRAWER ── -->
      <div class="menu-drawer" id="menu-drawer" aria-hidden="true" role="dialog" aria-modal="true"
           aria-label="Navigation menu">

        <div class="menu-drawer-overlay" id="menu-drawer-overlay"></div>

        <div class="menu-drawer-panel" id="menu-drawer-panel">

          <!-- Drawer header -->
          <div class="menu-drawer-header">
            <span class="menu-drawer-logo">${Engine.Renderer.escape(cfg.name)}</span>
            <button class="menu-drawer-close" id="menu-drawer-close" aria-label="Close menu">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="1.8"
                   stroke-linecap="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <!-- Nav links -->
          <nav class="menu-drawer-nav" aria-label="Site navigation">
            ${drawerLinks}
            ${isAdmin ? `
              <a href="#/admin" class="nav-link drawer-link drawer-link--admin">
                ADMIN PANEL
              </a>
            ` : ''}
          </nav>

          <!-- Shipping perks -->
          <div class="menu-drawer-perks">
            <div class="perk-item">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
              <div>
                <div class="perk-title">Free Shipping</div>
                <div class="perk-sub">Above ₹999</div>
              </div>
            </div>
            <div class="perk-item">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
              <div>
                <div class="perk-title">Easy Returns</div>
                <div class="perk-sub">7 Days Return</div>
              </div>
            </div>
            <div class="perk-item">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <div>
                <div class="perk-title">Secure Payment</div>
                <div class="perk-sub">100% Secure</div>
              </div>
            </div>
          </div>

          <!-- Newsletter -->
          <div class="menu-drawer-newsletter">
            <p class="newsletter-label">STAY IN THE LOOP</p>
            <p class="newsletter-sub">Get updates on new drops and offers.</p>
            <div class="newsletter-row">
              <input type="email" class="newsletter-input" placeholder="Enter your email"
                     aria-label="Email for newsletter" />
              <button class="newsletter-btn" aria-label="Subscribe">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Footer -->
          <div class="menu-drawer-footer">
            <p class="menu-drawer-copy">&copy; AMAN. All Rights Reserved.</p>
          </div>

        </div>
      </div>

      <!-- ── BOTTOM NAV ── -->
      <nav class="bottom-nav" aria-label="Bottom navigation">

        <button class="bottom-nav-item" data-bottom-nav="home" data-href="#/" aria-label="Home">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          <span>HOME</span>
        </button>

        <button class="bottom-nav-item" data-bottom-nav="shop" data-href="#/" aria-label="Shop">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
          <span>SHOP</span>
        </button>

        <button class="bottom-nav-item" data-bottom-nav="favorites" aria-label="Favorites">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          <span>FAVORITES</span>
        </button>

        <button class="bottom-nav-item" data-bottom-nav="account"
                data-href="${user ? '#/orders' : '#/auth'}" aria-label="Account">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span>ACCOUNT</span>
        </button>

      </nav>

    `);

    _bindEvents();
    _initScrollEffect();
    _updateActiveLink();
    _rendered = true;
  }

  /* ══════════════════════════════════════════════
     BIND EVENTS
  ══════════════════════════════════════════════ */
  function _bindEvents() {

    /* Cart */
    document.getElementById('cart-toggle-btn')?.addEventListener('click', () => {
      Engine.EventBus.emit(Engine.Events.CART_OPENED);
    });

    /* User sign-out */
    document.getElementById('user-menu-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('user-menu-btn');
      if (btn) btn.disabled = true;
      const { error } = await Engine.API.signOut();
      if (error) {
        Engine.EventBus.emit(Engine.Events.NOTIFY, { msg: 'Sign out failed', type: 'error' });
        if (btn) btn.disabled = false;
      } else {
        Engine.EventBus.emit(Engine.Events.NOTIFY, { msg: 'Signed out', type: 'success' });
        render();
      }
    });

    /* Search button */
    document.getElementById('search-btn')?.addEventListener('click', () => {
      if (window.location.hash !== '#/') {
        Engine.Router.navigate('/');
        setTimeout(() => document.getElementById('product-search')?.focus(), 400);
      } else {
        const searchEl = document.getElementById('product-search');
        if (searchEl) {
          searchEl.focus();
          searchEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    });

    /* Hamburger → open drawer */
    document.getElementById('menu-toggle-btn')?.addEventListener('click', _openDrawer);

    /* Drawer close button */
    document.getElementById('menu-drawer-close')?.addEventListener('click', _closeDrawer);

    /* Drawer overlay click → close */
    document.getElementById('menu-drawer-overlay')?.addEventListener('click', _closeDrawer);

    /* Close drawer when nav link clicked */
    document.getElementById('menu-drawer-panel')
      ?.querySelector('.menu-drawer-nav')
      ?.addEventListener('click', (e) => {
        if (e.target.closest('.nav-link')) _closeDrawer();
      });

    /* ESC closes drawer */
    window._drawerKeyHandler && document.removeEventListener('keydown', window._drawerKeyHandler);
    window._drawerKeyHandler = (e) => { if (e.key === 'Escape' && _drawerOpen) _closeDrawer(); };
    document.addEventListener('keydown', window._drawerKeyHandler);

    /* Bottom nav clicks */
    document.querySelectorAll('[data-bottom-nav]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.bottomNav;
        const href   = btn.dataset.href;

        if (action === 'favorites') {
          Engine.EventBus.emit(Engine.Events.NOTIFY, {
            msg: 'Wishlist launching soon ♥', type: 'info',
          });
          return;
        }

        if (href) {
          const path = href.replace('#', '');
          Engine.Router.navigate(path);
        }
      });
    });
  }

  /* ══════════════════════════════════════════════
     DRAWER OPEN / CLOSE
  ══════════════════════════════════════════════ */
  function _openDrawer() {
    _drawerOpen = true;
    const drawer  = document.getElementById('menu-drawer');
    const toggleBtn = document.getElementById('menu-toggle-btn');
    drawer?.classList.add('open');
    drawer?.setAttribute('aria-hidden', 'false');
    toggleBtn?.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    setTimeout(() => document.getElementById('menu-drawer-close')?.focus(), 80);
  }

  function _closeDrawer() {
    _drawerOpen = false;
    const drawer    = document.getElementById('menu-drawer');
    const toggleBtn = document.getElementById('menu-toggle-btn');
    drawer?.classList.remove('open');
    drawer?.setAttribute('aria-hidden', 'true');
    toggleBtn?.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    toggleBtn?.focus();
  }

  /* ══════════════════════════════════════════════
     SCROLL EFFECT (throttled)
  ══════════════════════════════════════════════ */
  function _initScrollEffect() {
    const navbar = document.getElementById('main-navbar');
    if (!navbar) return;

    let _scrollTick = false;
    const handler = () => {
      if (_scrollTick) return;
      _scrollTick = true;
      requestAnimationFrame(() => {
        navbar.classList.toggle('scrolled', window.scrollY > 10);
        _scrollTick = false;
      });
    };

    window.removeEventListener('scroll', window._navbarScrollHandler);
    window._navbarScrollHandler = handler;
    window.addEventListener('scroll', handler, { passive: true });
  }

  /* ══════════════════════════════════════════════
     ACTIVE STATE UPDATES
  ══════════════════════════════════════════════ */
  function _updateCartCount(count) {
    const el = document.getElementById('cart-count');
    if (!el) return;
    const prev = parseInt(el.textContent) || 0;
    el.textContent = count > 0 ? count : '';
    if (count > prev) {
      el.classList.remove('bump');
      void el.offsetWidth;
      el.classList.add('bump');
    }
  }

  function _updateActiveLink() {
    const hash = window.location.hash;

    /* Drawer links */
    document.querySelectorAll('.nav-link').forEach(a => {
      a.classList.toggle('active', a.getAttribute('href') === hash);
    });

    /* Bottom nav active */
    document.querySelectorAll('[data-bottom-nav]').forEach(btn => {
      const href = btn.dataset.href || '';
      const isActive = href && hash === href;
      btn.classList.toggle('active', isActive);
    });
  }

  /* ══════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════ */
  function init() {
    render();

    Engine.EventBus.on(Engine.Events.CART_UPDATED, () => {
      _updateCartCount(Engine.Cart.count());
    });

    Engine.EventBus.on(Engine.Events.ROUTE_CHANGED, _updateActiveLink);
    Engine.EventBus.on(Engine.Events.AUTH_CHANGED, render);
  }

  return { init, render };

})();
