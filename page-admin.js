/**
 * PAGE / admin.js
 * Path: js/pages/admin.js
 *
 * NON-BLOCKING PATTERN:
 *  · render() is SYNCHRONOUS — paints layout + skeleton instantly
 *  · _switchTab() is synchronous — paints skeleton, fires API, subscribes
 *  · Store.subscribe('products') drives all tab renders
 *  · Button actions (save/delete/submit) stay async — correct behaviour
 *  · Route wrapper () => render() prevents {} params bug
 */

Engine.Pages = Engine.Pages || {};

Engine.Pages.Admin = (() => {

  let _activeTab   = 'dashboard';
  let _unsubscribe = null;        /* Prevent duplicate store listeners */

  const ADMIN_STALE_MS = 30_000;

  /* ── Check freshness — skip API if data is recent ── */
  function _productsAreFresh() {
    const existing  = Engine.Store.get('products');
    const lastFetch = Engine.Store.get('productsLastFetch') || 0;
    const isFresh   = (Date.now() - lastFetch) < ADMIN_STALE_MS;
    return existing && existing.length > 0 && isFresh &&
           !Engine.Store.get('productsError');
  }

  /* ══════════════════════════════════════════════
     RENDER — synchronous entry point
  ══════════════════════════════════════════════ */
  function render(params) {
    if (params?.tab) _activeTab = params.tab;

    const user = Engine.Store.get('user');
    if (!Engine.Logic.isAdmin(user)) {
      Engine.Renderer.mount('#app-root', `
        <div class="container"
             style="padding-top:calc(var(--navbar-h) + 4rem)">
          <div class="empty-state">
            <div class="empty-state-icon">🔒</div>
            <h2 class="empty-state-title">Access Denied</h2>
            <p class="empty-state-desc">Admin privileges required.</p>
            <a class="btn btn-primary mt-4" href="#/auth">Sign In</a>
          </div>
        </div>
      `);
      return;
    }

    /* 1. Paint layout skeleton immediately */
    Engine.Renderer.mount('#app-root', `
      <div class="admin-layout">
        <aside class="admin-sidebar" role="navigation"
               aria-label="Admin navigation">
          <div class="admin-sidebar-title">Admin</div>
          ${_navItem('dashboard', '📊', 'Dashboard')}
          ${_navItem('products',  '📦', 'Products')}
          ${_navItem('inventory', '🗃️',  'Inventory')}
          ${_navItem('orders',    '🧾',  'Orders')}
          ${_navItem('instagram', '📸',  'Instagram')}
          <div style="margin-top:2rem;border-top:1px solid var(--color-border);
                      padding-top:1rem">
            <button class="admin-nav-item" data-tab="back">
              <span class="admin-nav-icon" aria-hidden="true">←</span>
              Back to Shop
            </button>
          </div>
        </aside>
        <div class="admin-content" id="admin-content">
          ${_contentSkeleton()}
        </div>
      </div>
    `);

    /* 2. Bind sidebar immediately */
    _bindSidebar();

    /* 3. Load active tab — non-blocking */
    _switchTab(_activeTab);
  }

  /* ── NAV ITEM HTML ── */
  function _navItem(tab, icon, label) {
    return `
      <button class="admin-nav-item ${_activeTab === tab ? 'active' : ''}"
              data-tab="${tab}"
              aria-current="${_activeTab === tab ? 'page' : 'false'}">
        <span class="admin-nav-icon" aria-hidden="true">${icon}</span>
        ${Engine.Renderer.escape(label)}
      </button>
    `;
  }

  /* ── CONTENT SKELETON while data loads ── */
  function _contentSkeleton() {
    return `
      <div>
        <div style="height:32px;background:var(--color-border);
                    border-radius:6px;width:200px;margin-bottom:.5rem"></div>
        <div style="height:16px;background:var(--color-border);
                    border-radius:4px;width:280px;margin-bottom:2rem"></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));
                    gap:1rem;margin-bottom:2rem">
          ${Array(4).fill(0).map(() => `
            <div style="background:var(--color-surface);
                        border:1px solid var(--color-border);
                        border-radius:var(--radius-lg);
                        padding:1.25rem">
              <div style="height:12px;background:var(--color-border);
                          border-radius:3px;width:60%;margin-bottom:.75rem"></div>
              <div style="height:32px;background:var(--color-border);
                          border-radius:4px;width:40%"></div>
            </div>
          `).join('')}
        </div>
        <div style="background:var(--color-surface);
                    border:1px solid var(--color-border);
                    border-radius:var(--radius-lg);
                    padding:2rem;
                    display:flex;align-items:center;justify-content:center;
                    color:var(--color-text-light);font-size:.875rem">
          Loading products…
        </div>
      </div>
    `;
  }

  /* ── SIDEBAR BINDING ── */
  function _bindSidebar() {
    document.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        if (tab === 'back') { Engine.Router.navigate('/'); return; }
        _activeTab = tab;
        document.querySelectorAll('[data-tab]').forEach(b => {
          b.classList.toggle('active', b.dataset.tab === tab);
          b.setAttribute('aria-current', b.dataset.tab === tab ? 'page' : 'false');
        });
        /* Show skeleton for tab, then load data */
        Engine.Renderer.mount('#admin-content', _contentSkeleton());
        _switchTab(tab);
      });
    });
  }

  /* ══════════════════════════════════════════════
     SWITCH TAB — synchronous, non-blocking
  ══════════════════════════════════════════════ */
  function _switchTab(tab) {
    /* Clean up previous store subscription */
    if (_unsubscribe) {
      _unsubscribe();
      _unsubscribe = null;
    }

    /* Orders tab uses separate store key and API */
    if (tab === 'orders') {
      _unsubscribe = Engine.Store.subscribe('orders', (orders) => {
        if (!Engine.Store.get('ordersLoading')) {
          _renderOrders(orders || []);
        }
      });
      Engine.API.getAllOrders();
      return;
    }

    /* Subscribe to products store — renders tab when data arrives */
    _unsubscribe = Engine.Store.subscribe('products', (products) => {
      const error = Engine.Store.get('productsError');
      if (error) {
        Engine.Renderer.mount('#admin-content', `
          <div class="error-state" role="alert">
            <p style="color:var(--color-error);margin-bottom:1rem">${Engine.Renderer.escape(error)}</p>
            <button class="btn btn-outline" onclick="_switchTab('${tab}')">
              Try again
            </button>
          </div>
        `);
        return;
      }

      if (!products || products.length === 0) return; /* Wait for data */

      /* Route to correct tab renderer */
      if (tab === 'dashboard') _renderDashboard(products);
      else if (tab === 'products')  _renderProducts(products);
      else if (tab === 'inventory') _renderInventory(products);
      else if (tab === 'instagram') _renderInstagram();
    });

    /* Fire API — non-blocking */
    if (!_productsAreFresh()) {
      Engine.API.getProducts(); /* No await — store subscriber handles update */
    } else {
      /* Already fresh — subscriber fires immediately with current store value */
      Engine.Logger.debug('Admin', 'Products fresh — using store data');
    }
  }

  /* ══════════════════════════════════════════════
     DASHBOARD TAB
  ══════════════════════════════════════════════ */
  function _renderDashboard(products) {
    const totalProducts  = products.length;
    const outOfStock     = products.filter(p => p.stock === 0).length;
    const lowStock       = products.filter(p =>
      p.stock > 0 && p.stock <= window.SITE_CONFIG.products.lowStockThreshold
    ).length;
    const totalInventory = products.reduce((s, p) => s + (parseInt(p.stock) || 0), 0);
    const totalValue     = products.reduce(
      (s, p) => s + (parseFloat(p.price) || 0) * (parseInt(p.stock) || 0), 0
    );

    Engine.Renderer.mount('#admin-content', `
      <div>
        <h1 class="admin-page-title">Dashboard</h1>
        <p class="admin-page-desc">Store overview</p>
        <div class="admin-stats">
          ${_statCard('Products',       totalProducts,                         'in catalogue')}
          ${_statCard('Units in Stock', totalInventory,                        'total inventory')}
          ${_statCard('Inventory Value',Engine.Logic.formatPrice(totalValue),  'at retail')}
          ${_statCard('Low Stock',      lowStock,  'items',
            lowStock  > 0 ? 'var(--color-warning)' : '')}
          ${_statCard('Out of Stock',   outOfStock, 'items',
            outOfStock > 0 ? 'var(--color-error)' : '')}
        </div>
        <div style="margin-top:var(--space-8)">
          <div class="admin-toolbar">
            <h2 style="font-size:var(--text-xl);font-weight:500">
              Recent Products
            </h2>
            <button class="btn btn-primary btn-sm" id="dash-add-btn">
              + Add Product
            </button>
          </div>
          ${_buildTable(products.slice(0, 6))}
        </div>
      </div>
    `);

    document.getElementById('dash-add-btn')
      ?.addEventListener('click', () => openProductModal());
    _bindTableActions();
  }

  function _statCard(label, value, sub, color = '') {
    return `
      <div class="stat-card">
        <div class="stat-card-label">${Engine.Renderer.escape(label)}</div>
        <div class="stat-card-value" ${color ? `style="color:${color}"` : ''}>
          ${Engine.Renderer.escape(String(value))}
        </div>
        <div class="stat-card-sub">${Engine.Renderer.escape(sub)}</div>
      </div>
    `;
  }

  /* ══════════════════════════════════════════════
     PRODUCTS TAB
  ══════════════════════════════════════════════ */
  function _renderProducts(products) {
    Engine.Renderer.mount('#admin-content', `
      <div>
        <h1 class="admin-page-title">Products</h1>
        <p class="admin-page-desc">Manage your product catalogue</p>
        <div class="admin-toolbar">
          <div class="admin-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
            <input type="text" id="admin-search-input"
                   placeholder="Filter by name…"
                   aria-label="Filter products" />
          </div>
          <button class="btn btn-primary" id="add-product-btn">
            + Add Product
          </button>
        </div>
        <div id="admin-products-table">${_buildTable(products)}</div>
      </div>
    `);

    /* Client-side filter — no API call */
    let _filterTimer;
    document.getElementById('admin-search-input')
      ?.addEventListener('input', (e) => {
        clearTimeout(_filterTimer);
        _filterTimer = setTimeout(() => {
          const q       = e.target.value.toLowerCase().trim();
          const all     = Engine.Store.get('products');
          const filtered = q
            ? all.filter(p => p.name.toLowerCase().includes(q))
            : all;
          const wrap = document.getElementById('admin-products-table');
          if (wrap) wrap.innerHTML = _buildTable(filtered);
          _bindTableActions();
        }, 200);
      });

    document.getElementById('add-product-btn')
      ?.addEventListener('click', () => openProductModal());
    _bindTableActions();
  }

  /* ── TABLE BUILDER ── */
  function _buildTable(products) {
    if (!products || !products.length) {
      return `
        <div class="empty-state" style="padding:3rem">
          <div class="empty-state-icon">📦</div>
          <p class="empty-state-title">No products</p>
          <button class="btn btn-primary mt-4"
                  onclick="Engine.Pages.Admin.openProductModal()">
            Add your first product
          </button>
        </div>
      `;
    }
    return `
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th scope="col">Product</th>
              <th scope="col">Price</th>
              <th scope="col">Stock</th>
              <th scope="col">Category</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>${products.map(_productRow).join('')}</tbody>
        </table>
      </div>
    `;
  }

  function _productRow(p) {
    const stockSt  = Engine.Logic.stockStatus(p.stock);
    const stockCls = { ok: 'stock-ok', low: 'stock-low', out: 'stock-none' }[stockSt];
    const imgSrc   = Engine.Renderer.safeUrl(p.image_url);
    const imgHtml  = imgSrc
      ? `<img class="admin-product-thumb"
              src="${Engine.Renderer.escape(imgSrc)}"
              alt="" loading="lazy" decoding="async"
              onerror="this.style.display='none'" />`
      : `<div class="admin-product-thumb"
              style="display:flex;align-items:center;justify-content:center;
                     background:var(--color-surface-2);font-size:1.2rem">🏺</div>`;

    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:var(--space-3)">
            ${imgHtml}
            <div>
              <div class="admin-product-name">
                ${Engine.Renderer.escape(p.name)}
              </div>
              <div class="admin-product-sku">
                ID: ${Engine.Renderer.escape(String(p.id).slice(0,8))}…
              </div>
            </div>
          </div>
        </td>
        <td>${Engine.Logic.formatPrice(p.price)}</td>
        <td><span class="stock-badge ${stockCls}">${p.stock}</span></td>
        <td>${p.category ? Engine.Renderer.escape(p.category) : '—'}</td>
        <td>
          <div class="table-actions">
            <button class="btn btn-outline btn-sm"
                    data-edit="${Engine.Renderer.escape(p.id)}">Edit</button>
            <button class="btn btn-danger btn-sm"
                    data-delete="${Engine.Renderer.escape(p.id)}">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }

  function _bindTableActions() {
    document.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => {
        const product = Engine.Store.get('products')
          .find(p => p.id === btn.dataset.edit);
        if (product) openProductModal(product);
      });
    });
    document.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', () => {
        const product = Engine.Store.get('products')
          .find(p => p.id === btn.dataset.delete);
        if (product) _confirmDelete(product);
      });
    });
  }

  function _confirmDelete(product) {
    Engine.Components.Modal.open({
      title: 'Delete Product',
      content: `
        <p style="color:var(--color-text-muted);margin-bottom:var(--space-6);
                  line-height:1.7">
          Delete <strong>${Engine.Renderer.escape(product.name)}</strong>?
          This cannot be undone.
        </p>
        <div style="display:flex;gap:var(--space-3);justify-content:flex-end">
          <button class="btn btn-ghost" id="cancel-delete-btn">Cancel</button>
          <button class="btn btn-danger" id="confirm-delete-btn">Delete</button>
        </div>
      `,
    });

    document.getElementById('cancel-delete-btn')
      ?.addEventListener('click', () => Engine.Components.Modal.close());

    let _deleting = false;
    document.getElementById('confirm-delete-btn')
      ?.addEventListener('click', async () => {
        if (_deleting) return;
        _deleting = true;
        const btn = document.getElementById('confirm-delete-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'Deleting…'; }

        const { error } = await Engine.API.deleteProduct(product.id);
        Engine.Components.Modal.close();

        if (error) {
          Engine.EventBus.emit(Engine.Events.NOTIFY, { msg: error, type: 'error' });
        } else {
          Engine.EventBus.emit(Engine.Events.NOTIFY, {
            msg:  `"${product.name}" deleted`,
            type: 'success',
          });
          /* Store subscriber will auto-refresh the current tab */
        }
      });
  }

  /* ══════════════════════════════════════════════
     INVENTORY TAB
  ══════════════════════════════════════════════ */
  function _renderInventory(products) {
    Engine.Renderer.mount('#admin-content', `
      <div>
        <h1 class="admin-page-title">Inventory</h1>
        <p class="admin-page-desc">Adjust stock levels for all products</p>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col">Stock</th>
                <th scope="col">Status</th>
                <th scope="col">Adjust</th>
              </tr>
            </thead>
            <tbody id="inventory-tbody">
              ${products.map(_inventoryRow).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `);

    _bindInventoryActions();
  }

  function _inventoryRow(p) {
    const stockSt  = Engine.Logic.stockStatus(p.stock);
    const stockCls = { ok: 'stock-ok', low: 'stock-low', out: 'stock-none' }[stockSt];
    const stockLbl = { ok: 'In Stock', low: 'Low Stock', out: 'Out of Stock' }[stockSt];

    return `
      <tr data-inv-row="${Engine.Renderer.escape(p.id)}">
        <td>
          <div style="font-weight:500">${Engine.Renderer.escape(p.name)}</div>
          <div style="font-size:var(--text-xs);color:var(--color-text-light)">
            ${p.category ? Engine.Renderer.escape(p.category) : '—'}
          </div>
        </td>
        <td>
          <span style="font-size:var(--text-xl);font-weight:600">
            ${p.stock}
          </span>
        </td>
        <td><span class="stock-badge ${stockCls}">${stockLbl}</span></td>
        <td>
          <div style="display:flex;align-items:center;gap:var(--space-2)">
            <button class="btn btn-outline btn-sm"
                    data-inv-dec="${Engine.Renderer.escape(p.id)}"
                    aria-label="Minus 1">−1</button>
            <input type="number" class="form-input"
                   style="width:80px;text-align:center;padding:var(--space-2)"
                   data-inv-input="${Engine.Renderer.escape(p.id)}"
                   value="${p.stock}" min="0" max="999999"
                   aria-label="Stock for ${Engine.Renderer.escape(p.name)}" />
            <button class="btn btn-outline btn-sm"
                    data-inv-inc="${Engine.Renderer.escape(p.id)}"
                    aria-label="Plus 1">+1</button>
            <button class="btn btn-primary btn-sm"
                    data-inv-save="${Engine.Renderer.escape(p.id)}">Save</button>
          </div>
        </td>
      </tr>
    `;
  }

  function _bindInventoryActions() {
    const tbody   = document.getElementById('inventory-tbody');
    if (!tbody) return;
    const _saving = new Set();

    tbody.addEventListener('click', async (e) => {
      const dec  = e.target.closest('[data-inv-dec]');
      const inc  = e.target.closest('[data-inv-inc]');
      const save = e.target.closest('[data-inv-save]');

      if (dec) {
        const input = tbody.querySelector(
          `[data-inv-input="${dec.dataset.invDec}"]`
        );
        if (input) input.value = Math.max(0, parseInt(input.value || 0) - 1);

      } else if (inc) {
        const input = tbody.querySelector(
          `[data-inv-input="${inc.dataset.invInc}"]`
        );
        if (input) input.value = Math.min(999999, parseInt(input.value || 0) + 1);

      } else if (save) {
        const id       = save.dataset.invSave;
        if (_saving.has(id)) return;

        const input    = tbody.querySelector(`[data-inv-input="${id}"]`);
        const rawStock = parseInt(input?.value);

        if (isNaN(rawStock) || rawStock < 0) {
          Engine.EventBus.emit(Engine.Events.NOTIFY, {
            msg: 'Stock must be 0 or more', type: 'error',
          });
          return;
        }

        const newStock = Math.min(999999, Math.max(0, rawStock));
        _saving.add(id);
        save.disabled    = true;
        save.textContent = '…';

        const { error } = await Engine.API.updateProduct(id, { stock: newStock });

        _saving.delete(id);
        save.disabled    = false;
        save.textContent = 'Save';

        if (error) {
          Engine.EventBus.emit(Engine.Events.NOTIFY, { msg: error, type: 'error' });
        } else {
          Engine.EventBus.emit(Engine.Events.NOTIFY, {
            msg: 'Stock updated ✓', type: 'success',
          });
          /* Re-render just this row from updated store */
          const p = Engine.Store.get('products').find(x => x.id === id);
          if (p) {
            const row = tbody.querySelector(`[data-inv-row="${id}"]`);
            if (row) {
              row.outerHTML = _inventoryRow(p);
              _bindInventoryActions();
            }
          }
        }
      }
    });
  }

  /* ══════════════════════════════════════════════
     PRODUCT MODAL — Add / Edit
     async submit is correct — this is a button action
  ══════════════════════════════════════════════ */
  function openProductModal(product = null) {
    const isEdit = !!product;

    Engine.Components.Modal.open({
      title: isEdit ? 'Edit Product' : 'Add Product',
      content: `
        <form class="modal-form" id="product-form" novalidate>
          <div class="form-group">
            <label class="form-label" for="pf-name">Name *</label>
            <input class="form-input" id="pf-name" type="text"
                   value="${isEdit ? Engine.Renderer.escape(product.name) : ''}"
                   placeholder="Product name" maxlength="200" />
            <span class="form-error" id="pf-name-err" role="alert"></span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
            <div class="form-group">
              <label class="form-label" for="pf-price">Price *</label>
              <input class="form-input" id="pf-price" type="number"
                     min="0.01" max="999999" step="0.01"
                     value="${isEdit ? product.price : ''}"
                     placeholder="0.00" />
              <span class="form-error" id="pf-price-err" role="alert"></span>
            </div>
            <div class="form-group">
              <label class="form-label" for="pf-stock">Stock *</label>
              <input class="form-input" id="pf-stock" type="number"
                     min="0" max="999999"
                     value="${isEdit ? product.stock : '0'}" />
              <span class="form-error" id="pf-stock-err" role="alert"></span>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="pf-category">Category</label>
            <input class="form-input" id="pf-category" type="text"
                   value="${isEdit && product.category
                     ? Engine.Renderer.escape(product.category) : ''}"
                   placeholder="e.g. living, dining, bedroom" maxlength="80" />
          </div>
          <div class="form-group">
            <label class="form-label" for="pf-image">Image URL</label>
            <input class="form-input" id="pf-image" type="url"
                   value="${isEdit && product.image_url
                     ? Engine.Renderer.escape(product.image_url) : ''}"
                   placeholder="https://…" />
          </div>
          <div class="form-group">
            <label class="form-label" for="pf-desc">Description</label>
            <textarea class="form-textarea" id="pf-desc" maxlength="2000"
                      placeholder="Short product description…"
            >${isEdit && product.description
              ? Engine.Renderer.escape(product.description) : ''}</textarea>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" id="pf-cancel">
              Cancel
            </button>
            <button type="button" class="btn btn-primary" id="pf-submit">
              ${isEdit ? 'Save Changes' : 'Add Product'}
            </button>
          </div>
        </form>
      `,
    });

    setTimeout(() => document.getElementById('pf-name')?.focus(), 80);
    document.getElementById('pf-cancel')
      ?.addEventListener('click', () => Engine.Components.Modal.close());

    let _submitting = false;
    document.getElementById('pf-submit')
      ?.addEventListener('click', async () => {
        if (_submitting) return;

        const name     = document.getElementById('pf-name')?.value.trim();
        const price    = parseFloat(document.getElementById('pf-price')?.value);
        const stock    = parseInt(document.getElementById('pf-stock')?.value);
        const category = document.getElementById('pf-category')?.value.trim();
        const imageUrl = document.getElementById('pf-image')?.value.trim();
        const desc     = document.getElementById('pf-desc')?.value.trim();

        ['name','price','stock'].forEach(f => {
          const el = document.getElementById(`pf-${f}-err`);
          if (el) el.textContent = '';
        });

        const { valid, errors } = Engine.Logic.validateProduct({ name, price, stock });
        if (!valid) {
          Object.entries(errors).forEach(([f, msg]) => {
            const el = document.getElementById(`pf-${f}-err`);
            if (el) el.textContent = msg;
          });
          document.getElementById(`pf-${Object.keys(errors)[0]}`)?.focus();
          return;
        }

        _submitting = true;
        const btn   = document.getElementById('pf-submit');
        if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

        const payload = {
          name, price, stock,
          category:    category || null,
          image_url:   imageUrl || null,
          description: desc     || null,
        };

        const { error } = isEdit
          ? await Engine.API.updateProduct(product.id, payload)
          : await Engine.API.createProduct(payload);

        _submitting = false;
        if (btn) {
          btn.disabled    = false;
          btn.textContent = isEdit ? 'Save Changes' : 'Add Product';
        }

        if (error) {
          Engine.EventBus.emit(Engine.Events.NOTIFY, { msg: error, type: 'error' });
        } else {
          Engine.Components.Modal.close();
          Engine.EventBus.emit(Engine.Events.NOTIFY, {
            msg:  isEdit ? `"${name}" updated ✓` : `"${name}" added ✓`,
            type: 'success',
          });
          /* Store subscriber auto-refreshes the tab after API mutation */
        }
      });
  }


  /* ══════════════════════════════════════════════════════
     INSTAGRAM TAB — Manage lookbook / insta feed posts
  ══════════════════════════════════════════════════════ */
  async function _renderInstagram() {
    const panel = document.getElementById('admin-panel');
    if (!panel) return;

    panel.innerHTML = `
      <div style="padding:var(--space-6)">
        <div style="display:flex;align-items:center;justify-content:space-between;
                    margin-bottom:var(--space-6)">
          <div>
            <h2 style="font-size:var(--text-2xl);font-family:var(--font-display);
                       font-weight:300;margin-bottom:var(--space-1)">
              📸 Instagram / Lookbook
            </h2>
            <p style="font-size:var(--text-sm);color:var(--color-text-muted)">
              Manage homepage lookbook grid — add, reorder, or hide posts.
            </p>
          </div>
          <button class="btn btn-primary" id="ig-add-btn">+ Add Post</button>
        </div>

        <!-- Add / Edit Form (hidden by default) -->
        <div id="ig-form-wrap" style="display:none;
              background:var(--color-surface);
              border:1px solid var(--color-border);
              border-radius:var(--radius-lg);
              padding:var(--space-6);
              margin-bottom:var(--space-6)">
          <h3 style="font-size:var(--text-base);font-weight:600;
                     margin-bottom:var(--space-5)" id="ig-form-title">
            Add New Post
          </h3>
          <input type="hidden" id="ig-edit-id" value="" />

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4)">
            <div class="form-group" style="grid-column:1/-1">
              <label class="form-label">Image URL *</label>
              <input class="form-input" id="ig-image-url" type="url"
                     placeholder="https://your-image-url.com/photo.jpg" />
              <span style="font-size:var(--text-xs);color:var(--color-text-muted);
                           margin-top:var(--space-1);display:block">
                Upload to Supabase Storage → copy URL → paste here
              </span>
              <span class="form-error" id="ig-url-err"></span>
            </div>

            <div class="form-group">
              <label class="form-label">Caption (optional)</label>
              <input class="form-input" id="ig-caption" type="text"
                     maxlength="300" placeholder="Minimal vibes ✦" />
            </div>

            <div class="form-group">
              <label class="form-label">Instagram Link (optional)</label>
              <input class="form-input" id="ig-post-url" type="url"
                     placeholder="https://instagram.com/p/..." />
            </div>

            <div class="form-group">
              <label class="form-label">Sort Order</label>
              <input class="form-input" id="ig-sort-order" type="number"
                     value="0" min="0" style="max-width:100px" />
              <span style="font-size:var(--text-xs);color:var(--color-text-muted);
                           margin-top:var(--space-1);display:block">
                Lower number = appears first
              </span>
            </div>

            <div class="form-group" style="display:flex;align-items:center;gap:var(--space-3);padding-top:var(--space-4)">
              <label style="font-size:var(--text-sm);font-weight:500">Visible on homepage</label>
              <input type="checkbox" id="ig-active" checked
                     style="width:16px;height:16px;cursor:pointer" />
            </div>
          </div>

          <!-- Image Preview -->
          <div id="ig-preview-wrap" style="display:none;margin:var(--space-4) 0">
            <label class="form-label">Preview</label>
            <img id="ig-preview-img"
                 style="width:160px;height:160px;object-fit:cover;
                        border-radius:var(--radius-md);
                        border:1px solid var(--color-border)" />
          </div>

          <span class="form-error" id="ig-global-err"
                style="display:block;margin-bottom:var(--space-3)"></span>

          <div style="display:flex;gap:var(--space-3)">
            <button class="btn btn-primary" id="ig-save-btn">Save Post</button>
            <button class="btn btn-ghost" id="ig-cancel-btn">Cancel</button>
          </div>
        </div>

        <!-- Posts Grid -->
        <div id="ig-posts-grid" style="display:grid;
              grid-template-columns:repeat(auto-fill,minmax(200px,1fr));
              gap:var(--space-4)">
          <div style="grid-column:1/-1;text-align:center;padding:var(--space-8);
                      color:var(--color-text-muted);font-size:var(--text-sm)">
            Loading posts…
          </div>
        </div>
      </div>
    `;

    /* Bind add button */
    document.getElementById('ig-add-btn')?.addEventListener('click', () => _igOpenForm());

    /* Bind cancel */
    document.getElementById('ig-cancel-btn')?.addEventListener('click', () => _igCloseForm());

    /* Image URL preview */
    document.getElementById('ig-image-url')?.addEventListener('input', (e) => {
      const url  = e.target.value.trim();
      const wrap = document.getElementById('ig-preview-wrap');
      const img  = document.getElementById('ig-preview-img');
      if (url && wrap && img) {
        img.src = url;
        wrap.style.display = 'block';
      }
    });

    /* Save */
    document.getElementById('ig-save-btn')?.addEventListener('click', async () => {
      const urlInput = document.getElementById('ig-image-url');
      const errEl    = document.getElementById('ig-url-err');
      const globalEl = document.getElementById('ig-global-err');
      const saveBtn  = document.getElementById('ig-save-btn');
      const editId   = document.getElementById('ig-edit-id')?.value || null;

      if (errEl)    errEl.textContent    = '';
      if (globalEl) globalEl.textContent = '';

      const imageUrl = urlInput?.value.trim();
      if (!imageUrl) {
        if (errEl) errEl.textContent = 'Image URL is required';
        return;
      }

      saveBtn.disabled    = true;
      saveBtn.textContent = 'Saving…';

      const payload = {
        image_url:  imageUrl,
        caption:    document.getElementById('ig-caption')?.value.trim()    || null,
        post_url:   document.getElementById('ig-post-url')?.value.trim()   || null,
        sort_order: Number(document.getElementById('ig-sort-order')?.value) || 0,
        active:     document.getElementById('ig-active')?.checked !== false,
      };

      const { error } = await Engine.API.saveInstaPost(payload, editId || null);

      if (error) {
        if (globalEl) globalEl.textContent = error;
        saveBtn.disabled    = false;
        saveBtn.textContent = 'Save Post';
        return;
      }

      Engine.EventBus.emit(Engine.Events.NOTIFY,
        { msg: editId ? 'Post updated!' : 'Post added!', type: 'success' });
      _igCloseForm();
      _igRenderGrid();
    });

    _igRenderGrid();
  }

  function _igOpenForm(post = null) {
    const wrap = document.getElementById('ig-form-wrap');
    if (!wrap) return;
    wrap.style.display = 'block';

    document.getElementById('ig-form-title').textContent = post ? 'Edit Post' : 'Add New Post';
    document.getElementById('ig-edit-id').value          = post?.id || '';
    document.getElementById('ig-image-url').value        = post?.image_url || '';
    document.getElementById('ig-caption').value          = post?.caption   || '';
    document.getElementById('ig-post-url').value         = post?.post_url  || '';
    document.getElementById('ig-sort-order').value       = post?.sort_order ?? 0;
    document.getElementById('ig-active').checked         = post?.active !== false;

    /* Show preview if editing */
    const previewWrap = document.getElementById('ig-preview-wrap');
    const previewImg  = document.getElementById('ig-preview-img');
    if (post?.image_url && previewWrap && previewImg) {
      previewImg.src         = post.image_url;
      previewWrap.style.display = 'block';
    } else if (previewWrap) {
      previewWrap.style.display = 'none';
    }

    wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function _igCloseForm() {
    const wrap = document.getElementById('ig-form-wrap');
    if (wrap) wrap.style.display = 'none';
    const saveBtn = document.getElementById('ig-save-btn');
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Post'; }
  }

  async function _igRenderGrid() {
    const grid = document.getElementById('ig-posts-grid');
    if (!grid) return;

    const { data: posts } = await Engine.API.getAllInstaPosts();

    if (!posts || posts.length === 0) {
      grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:var(--space-12);
                    color:var(--color-text-muted)">
          <div style="font-size:2rem;margin-bottom:var(--space-3)">📸</div>
          <div style="font-weight:600;margin-bottom:var(--space-2)">No posts yet</div>
          <div style="font-size:var(--text-sm)">Click "Add Post" to get started.</div>
        </div>`;
      return;
    }

    grid.innerHTML = posts.map(post => `
      <div style="border:1px solid var(--color-border);
                  border-radius:var(--radius-lg);
                  overflow:hidden;
                  background:var(--color-surface);
                  opacity:${post.active ? '1' : '.45'}">
        <div style="aspect-ratio:1;
                    background-image:url(${Engine.Renderer.escape(post.image_url)});
                    background-size:cover;background-position:center;
                    position:relative">
          ${!post.active ? `
            <div style="position:absolute;inset:0;display:flex;align-items:center;
                        justify-content:center;background:rgba(0,0,0,.35)">
              <span style="color:#fff;font-size:var(--text-xs);font-weight:700;
                            letter-spacing:.1em;text-transform:uppercase">Hidden</span>
            </div>` : ''}
        </div>
        <div style="padding:var(--space-3) var(--space-3) var(--space-2)">
          <div style="font-size:var(--text-xs);color:var(--color-text-muted);
                      margin-bottom:var(--space-2);white-space:nowrap;
                      overflow:hidden;text-overflow:ellipsis">
            ${post.caption ? Engine.Renderer.escape(post.caption) : '<em>No caption</em>'}
          </div>
          <div style="display:flex;gap:var(--space-2)">
            <span style="font-size:10px;color:var(--color-text-light);
                          background:var(--color-bg);padding:2px 6px;
                          border-radius:999px;border:1px solid var(--color-border)">
              #${post.sort_order}
            </span>
            <button class="btn btn-xs btn-outline" style="flex:1;font-size:10px"
                    data-ig-edit="${Engine.Renderer.escape(post.id)}">
              Edit
            </button>
            <button class="btn btn-xs" style="flex:1;font-size:10px;
                    background:var(--color-error-bg,#fff0f0);
                    color:var(--color-error);border:1px solid var(--color-error)"
                    data-ig-delete="${Engine.Renderer.escape(post.id)}">
              Delete
            </button>
          </div>
        </div>
      </div>
    `).join('');

    /* Edit / Delete event delegation */
    grid.addEventListener('click', async (e) => {
      /* Edit */
      const editBtn = e.target.closest('[data-ig-edit]');
      if (editBtn) {
        const id   = editBtn.dataset.igEdit;
        const post = posts.find(p => p.id === id);
        if (post) _igOpenForm(post);
        return;
      }

      /* Delete */
      const delBtn = e.target.closest('[data-ig-delete]');
      if (delBtn) {
        if (!confirm('Delete this post? This cannot be undone.')) return;
        delBtn.textContent = '…';
        delBtn.disabled    = true;
        const { error } = await Engine.API.deleteInstaPost(delBtn.dataset.igDelete);
        if (error) {
          Engine.EventBus.emit(Engine.Events.NOTIFY, { msg: error, type: 'error' });
          delBtn.textContent = 'Delete';
          delBtn.disabled    = false;
          return;
        }
        Engine.EventBus.emit(Engine.Events.NOTIFY,
          { msg: 'Post deleted', type: 'success' });
        _igRenderGrid();
      }
    }, { once: true });
  }


  /* ══════════════════════════════════════════════
     ORDERS TAB — Admin view of all orders
  ══════════════════════════════════════════════ */
  function _renderOrders(orders) {
    const ORDER_STATUS = ['pending','confirmed','shipped','delivered','cancelled'];

    const STATUS_STYLE = {
      pending:   'background:var(--color-surface-2);color:var(--color-text-muted)',
      confirmed: 'background:rgba(39,174,96,.1);color:var(--color-success)',
      shipped:   'background:rgba(230,126,34,.1);color:var(--color-warning)',
      delivered: 'background:rgba(200,169,110,.15);color:var(--color-accent)',
      cancelled: 'background:rgba(192,57,43,.1);color:var(--color-error)',
    };

    Engine.Renderer.mount('#admin-content', `
      <div>
        <h1 class="admin-page-title">Orders</h1>
        <p class="admin-page-desc">Manage and update all customer orders</p>

        ${!orders || orders.length === 0 ? `
          <div class="empty-state" style="padding:3rem">
            <div class="empty-state-icon">🧾</div>
            <p class="empty-state-title">No orders yet</p>
            <p class="empty-state-desc">Orders will appear here after customers checkout</p>
          </div>
        ` : `
          <div class="admin-table-wrap">
            <table class="admin-table">
              <thead>
                <tr>
                  <th scope="col">Order ID</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Items</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Payment</th>
                  <th scope="col">Status</th>
                  <th scope="col">Date</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${orders.map(order => {
                  let items = [];
                  try {
                    items = typeof order.items === 'string'
                      ? JSON.parse(order.items)
                      : (Array.isArray(order.items) ? order.items : []);
                  } catch(_) { items = []; }

                  const itemCount   = items.reduce((s,i) => s + (i.quantity||1), 0);
                  const shortId     = String(order.id).slice(0,8).toUpperCase();
                  const shortUser   = order.user_id
                    ? String(order.user_id).slice(0,8) + '…'
                    : 'Guest';
                  const statusStyle = STATUS_STYLE[order.order_status] || STATUS_STYLE.pending;
                  const date        = new Date(order.created_at).toLocaleDateString('en-IN',{
                    day:'2-digit', month:'short', year:'numeric',
                  });

                  /* Build status dropdown options */
                  const options = ORDER_STATUS.map(s => `
                    <option value="${s}" ${order.order_status === s ? 'selected' : ''}>
                      ${s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                  `).join('');

                  return `
                    <tr data-order-row="${Engine.Renderer.escape(order.id)}">
                      <td>
                        <span style="font-family:var(--font-mono);
                                     font-size:var(--text-xs);font-weight:600">
                          #${Engine.Renderer.escape(shortId)}
                        </span>
                      </td>
                      <td>
                        <span style="font-family:var(--font-mono);
                                     font-size:var(--text-xs);color:var(--color-text-muted)">
                          ${Engine.Renderer.escape(shortUser)}
                        </span>
                        ${(() => {
                          try {
                            const addr = typeof order.address === 'string'
                              ? JSON.parse(order.address)
                              : order.address;
                            if (!addr || !addr.name) return '';
                            const n = Engine.Renderer.escape(addr.name || '');
                            const p = Engine.Renderer.escape(addr.phone || '');
                            const l = Engine.Renderer.escape(addr.line || '');
                            const c = Engine.Renderer.escape(addr.city || '');
                            const s = Engine.Renderer.escape(addr.state || '');
                            const z = Engine.Renderer.escape(addr.pincode || '');
                            return '<div style="margin-top:6px;font-size:var(--text-xs);color:var(--color-text)">'
                              + '<strong>' + n + '</strong><br>'
                              + (p ? '<a href="tel:' + p + '" style="color:var(--color-primary);font-weight:700;font-size:var(--text-sm);text-decoration:none">📞 ' + p + '</a><br>' : '')
                              + '<span style="color:var(--color-text-muted)">' + l + ', ' + c + ', ' + s + ' - ' + z + '</span>'
                              + '</div>';
                          } catch(_) { return ''; }
                        })()}
                      </td>
                      <td>
                        <div style="display:flex;flex-direction:column;gap:2px;font-size:var(--text-xs)">
                          ${items.map(i => {
                            const name = Engine.Renderer.escape((i.product?.name || i.name || 'Product').slice(0,25));
                            const size = i.size ? ' (' + Engine.Renderer.escape(i.size) + ')' : '';
                            const qty  = i.quantity || 1;
                            return '<span>' + name + size + ' &times;' + qty + '</span>';
                          }).join('')}
                        </div>
                      </td>
                      <td style="font-weight:600">
                        ${Engine.Logic.formatPrice(order.total ?? order.amount ?? 0)}
                      </td>
                      <td>
                        <span style="font-size:var(--text-xs);font-weight:600;
                                     color:${order.payment_status === 'paid'
                                       ? 'var(--color-success)'
                                       : 'var(--color-warning)'}">
                          ${(order.payment_status || 'pending').toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <span style="padding:var(--space-1) var(--space-3);
                                     border-radius:999px;
                                     font-size:var(--text-xs);font-weight:600;
                                     ${statusStyle}">
                          ${(order.order_status || 'pending').charAt(0).toUpperCase() +
                            (order.order_status || 'pending').slice(1)}
                        </span>
                      </td>
                      <td style="font-size:var(--text-xs);color:var(--color-text-muted)">
                        ${date}
                      </td>
                      <td>
                        <div style="display:flex;flex-direction:column;gap:var(--space-2)">

                          <!-- Status Update Row -->
                          <div style="display:flex;gap:var(--space-2);align-items:center">
                            <select
                              class="form-select"
                              style="padding:var(--space-1) var(--space-2);
                                     font-size:var(--text-xs);width:auto"
                              data-order-select="${Engine.Renderer.escape(order.id)}">
                              ${options}
                            </select>
                            <button
                              class="btn btn-primary btn-sm"
                              data-order-save="${Engine.Renderer.escape(order.id)}"
                              style="white-space:nowrap">
                              Update
                            </button>
                          </div>

                          <!-- Quick Action Buttons -->
                          <div style="display:flex;gap:var(--space-2);flex-wrap:wrap;margin-top:var(--space-2)">
                            ${!['delivered','cancelled'].includes(order.order_status) ? `
                              <button
                                class="btn btn-sm"
                                style="background:rgba(39,174,96,.1);color:var(--color-success);border:1px solid var(--color-success);white-space:nowrap"
                                data-quick-delivered="${Engine.Renderer.escape(order.id)}">
                                ✓ Mark Delivered
                              </button>
                              <button
                                class="btn btn-sm"
                                style="background:rgba(192,57,43,.1);color:var(--color-error);border:1px solid var(--color-error);white-space:nowrap"
                                data-quick-cancel="${Engine.Renderer.escape(order.id)}">
                                ✕ Cancel Order
                              </button>
                            ` : ''}
                          </div>

                          <!-- Shipment Row — always visible for admin -->
                          <div style="display:flex;gap:var(--space-2);align-items:center;flex-wrap:wrap">
                            <select
                              class="form-select"
                              style="padding:var(--space-1) var(--space-2);
                                     font-size:var(--text-xs);width:auto"
                              data-ship-courier="${Engine.Renderer.escape(order.id)}">
                              <option value="">Courier…</option>
                              <option value="Delhivery"  ${order.courier==='Delhivery'  ?'selected':''}>Delhivery</option>
                              <option value="Shiprocket" ${order.courier==='Shiprocket' ?'selected':''}>Shiprocket</option>
                              <option value="Bluedart"   ${order.courier==='Bluedart'   ?'selected':''}>Bluedart</option>
                              <option value="DTDC"       ${order.courier==='DTDC'       ?'selected':''}>DTDC</option>
                              <option value="Ekart"      ${order.courier==='Ekart'      ?'selected':''}>Ekart</option>
                              <option value="Xpressbees" ${order.courier==='Xpressbees' ?'selected':''}>Xpressbees</option>
                            </select>
                            <input
                              type="text"
                              class="form-input"
                              style="padding:var(--space-1) var(--space-2);
                                     font-size:var(--text-xs);width:120px"
                              placeholder="Tracking ID"
                              value="${order.tracking_id || ''}"
                              data-ship-tracking="${Engine.Renderer.escape(order.id)}" />
                            <button
                              class="btn btn-accent btn-sm"
                              data-ship-save="${Engine.Renderer.escape(order.id)}"
                              style="white-space:nowrap">
                              🚚 Ship
                            </button>
                            ${window.SITE_CONFIG?.shiprocket?.enabled && !order.shiprocket_order_id ? `
                            <button
                              class="btn btn-sm"
                              style="white-space:nowrap;background:#ff6b35;color:#fff;border:none"
                              data-shiprocket-create="${Engine.Renderer.escape(order.id)}">
                              📦 Auto-Ship via Shiprocket
                            </button>` : ''}
                            ${order.shiprocket_order_id ? `
                            <span style="font-size:var(--text-xs);color:var(--color-success);
                                         padding:2px 8px;background:rgba(39,174,96,.1);
                                         border-radius:4px;white-space:nowrap">
                              ✓ Shiprocket #${Engine.Renderer.escape(order.shiprocket_order_id)}
                            </span>` : ''}
                          </div>

                          <!-- Tracking link if already shipped -->
                          ${order.tracking_url ? `
                            <a href="${Engine.Renderer.escape(order.tracking_url)}"
                               target="_blank" rel="noopener noreferrer"
                               style="font-size:var(--text-xs);
                                      color:var(--color-accent);
                                      text-decoration:underline">
                              🔗 View Tracking
                            </a>
                          ` : ''}

                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `);

    _bindOrderActions();
  }

  function _bindOrderActions() {
    const saving = new Set();

    document.querySelectorAll('[data-order-save]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const orderId = btn.dataset.orderSave;
        if (saving.has(orderId)) return;

        const select = document.querySelector(
          `[data-order-select="${orderId}"]`
        );
        const newStatus = select?.value;
        if (!newStatus) return;

        saving.add(orderId);
        btn.disabled    = true;
        btn.textContent = '…';

        const { error } = await Engine.API.updateOrderStatus(orderId, newStatus);

        saving.delete(orderId);
        btn.disabled    = false;
        btn.textContent = 'Update';

        if (error) {
          Engine.EventBus.emit(Engine.Events.NOTIFY, {
            msg: error, type: 'error',
          });
        } else {
          Engine.EventBus.emit(Engine.Events.NOTIFY, {
            msg:  `Order status updated to "${newStatus}" ✓`,
            type: 'success',
          });
          /* Update badge in row without full re-render */
          const STATUS_STYLE = {
            pending:   'background:var(--color-surface-2);color:var(--color-text-muted)',
            confirmed: 'background:rgba(39,174,96,.1);color:var(--color-success)',
            shipped:   'background:rgba(230,126,34,.1);color:var(--color-warning)',
            delivered: 'background:rgba(200,169,110,.15);color:var(--color-accent)',
            cancelled: 'background:rgba(192,57,43,.1);color:var(--color-error)',
          };
          const row   = document.querySelector(`[data-order-row="${orderId}"]`);
          const badge = row?.querySelector('span[style*="border-radius:999px"]');
          if (badge) {
            badge.setAttribute('style',
              `padding:var(--space-1) var(--space-3);border-radius:999px;` +
              `font-size:var(--text-xs);font-weight:600;${STATUS_STYLE[newStatus]}`
            );
            badge.textContent = newStatus.charAt(0).toUpperCase() + newStatus.slice(1);
          }
        }
      });
    });

    /* ── Shipment binding — Mark as Shipped ── */
    /* Quick Cancel & Mark Delivered handlers */
    document.querySelectorAll('[data-quick-delivered]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const orderId = btn.dataset.quickDelivered;
        if (!confirm('Mark this order as Delivered?')) return;
        btn.disabled = true; btn.textContent = '…';
        const { error } = await Engine.API.updateOrderStatus(orderId, 'delivered');
        if (error) {
          btn.disabled = false; btn.textContent = '✓ Mark Delivered';
          Engine.EventBus.emit(Engine.Events.NOTIFY, { msg: error, type: 'error' });
        } else {
          Engine.EventBus.emit(Engine.Events.NOTIFY, { msg: 'Order marked as Delivered ✓', type: 'success' });
          Engine.API.getAllOrders();
        }
      });
    });

    document.querySelectorAll('[data-quick-cancel]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const orderId = btn.dataset.quickCancel;
        if (!confirm('Cancel this order? This cannot be undone.')) return;
        btn.disabled = true; btn.textContent = '…';
        const { error } = await Engine.API.cancelOrder(orderId, 'admin');
        if (error) {
          btn.disabled = false; btn.textContent = '✕ Cancel Order';
          Engine.EventBus.emit(Engine.Events.NOTIFY, { msg: error, type: 'error' });
        } else {
          Engine.EventBus.emit(Engine.Events.NOTIFY, { msg: 'Order cancelled ✓', type: 'success' });
          Engine.API.getAllOrders();
        }
      });
    });

    const shipping = new Set();

    document.querySelectorAll('[data-ship-save]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const orderId  = btn.dataset.shipSave;
        if (shipping.has(orderId)) return;

        const courier   = document.querySelector(`[data-ship-courier="${orderId}"]`)?.value;
        const trackingId = document.querySelector(`[data-ship-tracking="${orderId}"]`)?.value.trim();

        if (!courier) {
          Engine.EventBus.emit(Engine.Events.NOTIFY, {
            msg: 'Please select a courier', type: 'warning',
          });
          return;
        }
        if (!trackingId) {
          Engine.EventBus.emit(Engine.Events.NOTIFY, {
            msg: 'Please enter a tracking ID', type: 'warning',
          });
          return;
        }

        shipping.add(orderId);
        btn.disabled    = true;
        btn.textContent = '…';

        const { data, error } = await Engine.API.updateShipment(orderId, courier, trackingId);

        shipping.delete(orderId);
        btn.disabled    = false;
        btn.textContent = '🚚 Ship';

        if (error) {
          Engine.EventBus.emit(Engine.Events.NOTIFY, {
            msg: error, type: 'error',
          });
        } else {
          Engine.EventBus.emit(Engine.Events.NOTIFY, {
            msg:  `Order marked as shipped via ${courier} ✓`,
            type: 'success',
          });
          /* Show tracking link in-place without full re-render */
          const row = document.querySelector(`[data-order-row="${orderId}"]`);
          const existingLink = row?.querySelector('a[href*="track"]');
          if (!existingLink && row && data?.tracking_url) {
            const shipDiv = btn.closest('div[style*="flex-direction:column"]');
            if (shipDiv) {
              const link  = document.createElement('a');
              link.href   = data.tracking_url;
              link.target = '_blank';
              link.rel    = 'noopener noreferrer';
              link.style.cssText = 'font-size:var(--text-xs);color:var(--color-accent);text-decoration:underline';
              link.textContent   = '🔗 View Tracking';
              shipDiv.appendChild(link);
            }
          }
        }
      });
    });

    /* ── SHIPROCKET AUTO-CREATE — 📦 Auto-Ship via Shiprocket button ── */
    const _srCreating = new Set();

    document.querySelectorAll('[data-shiprocket-create]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const orderId = btn.dataset.shiprocketCreate;
        if (_srCreating.has(orderId)) return;

        _srCreating.add(orderId);
        const originalText = btn.textContent;
        btn.disabled   = true;
        btn.textContent = '⏳ Creating shipment…';

        Engine.EventBus.emit(Engine.Events.NOTIFY, {
          msg: 'Creating Shiprocket shipment…', type: 'info',
        });

        const { data, error } = await Engine.API.createShiprocketOrder(orderId);

        _srCreating.delete(orderId);
        btn.disabled    = false;
        btn.textContent = originalText;

        if (error) {
          Engine.EventBus.emit(Engine.Events.NOTIFY, {
            msg: `Shiprocket error: ${error}`, type: 'error', duration: 8000,
          });
        } else {
          Engine.EventBus.emit(Engine.Events.NOTIFY, {
            msg: `✓ Shipment created! AWB: ${data?.awb_code || 'N/A'} via ${data?.courier_name || 'Shiprocket'}`,
            type: 'success',
            duration: 6000,
          });
          /* Replace button with Shiprocket order ID badge + refresh orders */
          btn.closest('[data-shiprocket-create]') && btn.remove();
          await Engine.API.getAllOrders();
          /* Partial UI update — re-render just the row without losing scroll position */
          setTimeout(() => Engine.Pages.Admin.render(), 500);
        }
      });
    });
  }

  return { render, openProductModal };

})();

/* ── ROUTE REGISTRATION — wrapper prevents {} params bug ── */
Engine.Router.register('/admin',      () => Engine.Pages.Admin.render());
Engine.Router.register('/admin/:tab', (p) => Engine.Pages.Admin.render(p));
