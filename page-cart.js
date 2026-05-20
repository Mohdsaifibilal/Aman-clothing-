/**
 * PAGE / cart-page.js
 * Address modal added — collects delivery details before placing order
 */

Engine.Pages = Engine.Pages || {};

Engine.Pages.CartPage = (() => {

  let _checkingOut = false;

  function render() {
    _checkingOut = false;
    _renderPage();
  }

  function _renderPage() {
    const items   = Engine.Store.get('cart');
    const summary = Engine.Logic.cartSummary(items);

    Engine.Renderer.mount('#app-root', `
      <div style="padding-top:calc(var(--navbar-h) + var(--space-12));padding-bottom:var(--space-20)">
        <div class="container">
          <div class="section-header">
            <div class="section-eyebrow">Your Order</div>
            <h1 class="section-title">Shopping Cart</h1>
            ${items.length > 0 ? `<p class="section-subtitle">${summary.count} item${summary.count !== 1 ? 's' : ''}</p>` : ''}
          </div>

          ${items.length === 0
            ? `<div class="empty-state" style="padding:var(--space-20) 0">
                 <div class="empty-state-icon">🛒</div>
                 <h2 class="empty-state-title">Your cart is empty</h2>
                 <p class="empty-state-desc">Browse our collection and add something you love.</p>
                 <a class="btn btn-primary btn-lg mt-4" href="#/">Continue Shopping</a>
               </div>`
            : `<div style="display:grid;grid-template-columns:1fr 360px;gap:var(--space-10);align-items:start">
                 <div id="cart-page-items" role="list">
                   ${items.map(_renderItem).join('')}
                 </div>
                 <aside style="background:var(--color-surface);border:1px solid var(--color-border);
                               border-radius:var(--radius-lg);padding:var(--space-8);
                               position:sticky;top:calc(var(--navbar-h) + var(--space-6))"
                        aria-label="Order summary">
                   <h2 style="font-size:var(--text-xl);margin-bottom:var(--space-6)">Order Summary</h2>
                   <div style="display:flex;flex-direction:column;gap:var(--space-3);margin-bottom:var(--space-6)">
                     ${items.map(i => `
                       <div style="display:flex;justify-content:space-between;font-size:var(--text-sm);color:var(--color-text-muted)">
                         <span>${Engine.Renderer.escape(i.product.name)} &times; ${i.quantity}</span>
                         <span>${Engine.Logic.formatPrice(i.product.price * i.quantity)}</span>
                       </div>`).join('')}
                   </div>
                   <div style="border-top:1px solid var(--color-border);padding-top:var(--space-5);margin-bottom:var(--space-6)">
                     <div style="display:flex;justify-content:space-between;align-items:baseline">
                       <span style="font-size:var(--text-sm);color:var(--color-text-muted)">Total</span>
                       <span style="font-family:var(--font-display);font-size:var(--text-3xl)" aria-live="polite">
                         ${summary.subtotalFormatted}
                       </span>
                     </div>
                   </div>
                   <button class="btn btn-primary btn-full btn-lg" id="cart-page-checkout">
                     Proceed to Checkout
                   </button>
                   <a href="#/" class="btn btn-ghost btn-full" style="margin-top:var(--space-3);justify-content:center">
                     ← Continue Shopping
                   </a>
                 </aside>
               </div>`
          }
        </div>
      </div>

      <!-- ADDRESS MODAL -->
      <div id="address-modal-overlay" style="display:none;position:fixed;inset:0;z-index:1000;
           background:rgba(0,0,0,.55);backdrop-filter:blur(4px);
           align-items:center;justify-content:center;padding:var(--space-4)">
        <div style="background:var(--color-surface);border-radius:var(--radius-xl);
                    width:100%;max-width:480px;max-height:90vh;overflow-y:auto;
                    padding:var(--space-8);position:relative">

          <button id="address-modal-close" aria-label="Close" style="
            position:absolute;top:var(--space-4);right:var(--space-4);
            background:none;border:none;font-size:1.5rem;cursor:pointer;
            color:var(--color-text-muted)">×</button>

          <h2 style="font-family:var(--font-display);font-size:var(--text-2xl);margin-bottom:var(--space-2)">
            Delivery Address
          </h2>
          <p style="color:var(--color-text-muted);font-size:var(--text-sm);margin-bottom:var(--space-6)">
            Apna delivery address fill karein
          </p>

          <div style="display:flex;flex-direction:column;gap:var(--space-4)">

            <div>
              <label style="font-size:var(--text-sm);font-weight:600;display:block;margin-bottom:var(--space-2)">
                Full Name *
              </label>
              <input id="addr-name" type="text" placeholder="Apna poora naam" style="
                width:100%;padding:var(--space-3) var(--space-4);
                border:1px solid var(--color-border);border-radius:var(--radius-md);
                font-size:var(--text-base);background:var(--color-bg);
                color:var(--color-text);box-sizing:border-box" />
            </div>

            <div>
              <label style="font-size:var(--text-sm);font-weight:600;display:block;margin-bottom:var(--space-2)">
                Phone Number *
              </label>
              <input id="addr-phone" type="tel" placeholder="10 digit mobile number" maxlength="10" style="
                width:100%;padding:var(--space-3) var(--space-4);
                border:1px solid var(--color-border);border-radius:var(--radius-md);
                font-size:var(--text-base);background:var(--color-bg);
                color:var(--color-text);box-sizing:border-box" />
            </div>

            <div>
              <label style="font-size:var(--text-sm);font-weight:600;display:block;margin-bottom:var(--space-2)">
                Address (Ghar/Flat/Street) *
              </label>
              <textarea id="addr-line" rows="2" placeholder="House no, street, mohalla..." style="
                width:100%;padding:var(--space-3) var(--space-4);
                border:1px solid var(--color-border);border-radius:var(--radius-md);
                font-size:var(--text-base);background:var(--color-bg);
                color:var(--color-text);box-sizing:border-box;resize:vertical"></textarea>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3)">
              <div>
                <label style="font-size:var(--text-sm);font-weight:600;display:block;margin-bottom:var(--space-2)">
                  City *
                </label>
                <input id="addr-city" type="text" placeholder="Shehar" style="
                  width:100%;padding:var(--space-3) var(--space-4);
                  border:1px solid var(--color-border);border-radius:var(--radius-md);
                  font-size:var(--text-base);background:var(--color-bg);
                  color:var(--color-text);box-sizing:border-box" />
              </div>
              <div>
                <label style="font-size:var(--text-sm);font-weight:600;display:block;margin-bottom:var(--space-2)">
                  State *
                </label>
                <input id="addr-state" type="text" placeholder="Pradesh" style="
                  width:100%;padding:var(--space-3) var(--space-4);
                  border:1px solid var(--color-border);border-radius:var(--radius-md);
                  font-size:var(--text-base);background:var(--color-bg);
                  color:var(--color-text);box-sizing:border-box" />
              </div>
            </div>

            <div>
              <label style="font-size:var(--text-sm);font-weight:600;display:block;margin-bottom:var(--space-2)">
                Pincode *
              </label>
              <input id="addr-pincode" type="text" placeholder="6 digit pincode" maxlength="6" style="
                width:100%;padding:var(--space-3) var(--space-4);
                border:1px solid var(--color-border);border-radius:var(--radius-md);
                font-size:var(--text-base);background:var(--color-bg);
                color:var(--color-text);box-sizing:border-box" />
            </div>

            <div id="address-modal-error" style="display:none;color:var(--color-error);
                 font-size:var(--text-sm);padding:var(--space-2) 0"></div>

            <button id="address-modal-submit" class="btn btn-primary btn-full btn-lg"
                    style="margin-top:var(--space-2)">
              Place Order
            </button>

          </div>
        </div>
      </div>
    `);

    _bindEvents();
  }

  function _renderItem(item) {
    const { product, quantity } = item;
    const imgSrc  = Engine.Renderer.safeUrl(product.image_url);
    const imgHtml = imgSrc
      ? `<img src="${Engine.Renderer.escape(imgSrc)}"
              alt="${Engine.Renderer.escape(product.name)}"
              loading="lazy" decoding="async"
              onerror="this.style.display='none'"
              style="width:100px;height:100px;object-fit:cover;
                     border-radius:var(--radius-md);flex-shrink:0" />`
      : `<div style="width:100px;height:100px;background:var(--color-surface-2);
                     border-radius:var(--radius-md);display:flex;align-items:center;
                     justify-content:center;font-size:2rem;flex-shrink:0">🏺</div>`;

    return `
      <article style="display:flex;gap:var(--space-5);padding:var(--space-5);
                       background:var(--color-surface);border:1px solid var(--color-border);
                       border-radius:var(--radius-lg);margin-bottom:var(--space-4)"
               data-cart-page-item="${Engine.Renderer.escape(product.id)}" role="listitem">
        ${imgHtml}
        <div style="flex:1;min-width:0">
          <div style="font-family:var(--font-display);font-size:var(--text-xl);margin-bottom:var(--space-1)">
            ${Engine.Renderer.escape(product.name)}
          </div>
          <div style="font-size:var(--text-sm);color:var(--color-text-muted);margin-bottom:var(--space-4)">
            ${Engine.Logic.formatPrice(product.price)} each
            ${item.size ? ` &nbsp;·&nbsp; <strong>Size: ${Engine.Renderer.escape(item.size)}</strong>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:var(--space-4)">
            <div class="qty-selector" style="border-width:1px" role="group" aria-label="Quantity">
              <button class="qty-btn"
                      data-cpage-dec="${Engine.Renderer.escape(product.id)}"
                      data-cpage-dec-size="${Engine.Renderer.escape(item.size || '')}"
                      aria-label="Decrease" ${quantity <= 1 ? 'disabled' : ''}>−</button>
              <span class="qty-display" aria-live="polite">${quantity}</span>
              <button class="qty-btn"
                      data-cpage-inc="${Engine.Renderer.escape(product.id)}"
                      data-cpage-inc-size="${Engine.Renderer.escape(item.size || '')}"
                      aria-label="Increase" ${quantity >= product.stock ? 'disabled' : ''}>+</button>
            </div>
            <button class="btn btn-ghost btn-sm"
                    data-cpage-remove="${Engine.Renderer.escape(product.id)}"
                    data-cpage-remove-size="${Engine.Renderer.escape(item.size || '')}"
                    style="color:var(--color-error)"
                    aria-label="Remove ${Engine.Renderer.escape(product.name)}">Remove</button>
            <span style="margin-left:auto;font-family:var(--font-display);font-size:var(--text-xl)">
              ${Engine.Logic.formatPrice(product.price * quantity)}
            </span>
          </div>
        </div>
      </article>
    `;
  }

  /* ── Open address modal ── */
  function _openAddressModal() {
    const overlay = document.getElementById('address-modal-overlay');
    if (overlay) {
      overlay.style.display = 'flex';
      document.getElementById('addr-name')?.focus();
    }
  }

  function _closeAddressModal() {
    const overlay = document.getElementById('address-modal-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  /* ── Validate address fields ── */
  function _getAddress() {
    const name    = document.getElementById('addr-name')?.value.trim();
    const phone   = document.getElementById('addr-phone')?.value.trim();
    const line    = document.getElementById('addr-line')?.value.trim();
    const city    = document.getElementById('addr-city')?.value.trim();
    const state   = document.getElementById('addr-state')?.value.trim();
    const pincode = document.getElementById('addr-pincode')?.value.trim();

    if (!name)                          return { error: 'Naam daalna zaroori hai' };
    if (!phone || !/^\d{10}$/.test(phone)) return { error: 'Sahi 10 digit phone number daalo' };
    if (!line)                          return { error: 'Address daalna zaroori hai' };
    if (!city)                          return { error: 'City daalna zaroori hai' };
    if (!state)                         return { error: 'State daalna zaroori hai' };
    if (!pincode || !/^\d{6}$/.test(pincode)) return { error: 'Sahi 6 digit pincode daalo' };

    return { data: { name, phone, line, city, state, pincode } };
  }

  function _bindEvents() {
    const container = document.getElementById('cart-page-items');
    let _qtyTimer = null;

    container?.addEventListener('click', (e) => {
      const dec    = e.target.closest('[data-cpage-dec]');
      const inc    = e.target.closest('[data-cpage-inc]');
      const remove = e.target.closest('[data-cpage-remove]');

      if (dec) {
        clearTimeout(_qtyTimer);
        _qtyTimer = setTimeout(() => {
          const id   = dec.dataset.cpageDec;
          const size = dec.dataset.cpageDecSize || null;
          const item = Engine.Store.get('cart').find(i => i.product.id === id && (i.size || null) === (size || null));
          if (item) { Engine.Cart.updateQty(id, item.quantity - 1, size || null); _renderPage(); }
        }, 80);
      } else if (inc) {
        clearTimeout(_qtyTimer);
        _qtyTimer = setTimeout(() => {
          const id   = inc.dataset.cpageInc;
          const size = inc.dataset.cpageIncSize || null;
          const item = Engine.Store.get('cart').find(i => i.product.id === id && (i.size || null) === (size || null));
          if (item) { Engine.Cart.updateQty(id, item.quantity + 1, size || null); _renderPage(); }
        }, 80);
      } else if (remove) {
        const size = remove.dataset.cpageRemoveSize || null;
        Engine.Cart.remove(remove.dataset.cpageRemove, size || null);
        _renderPage();
      }
    });

    /* Checkout button — open address modal */
    document.getElementById('cart-page-checkout')
      ?.addEventListener('click', () => {
        const user = Engine.Store.get('user');
        if (!user) {
          Engine.EventBus.emit(Engine.Events.NOTIFY, {
            msg: 'Pehle login karein', type: 'error'
          });
          Engine.Router.navigate('/auth');
          return;
        }
        _openAddressModal();
      });

    /* Close modal */
    document.getElementById('address-modal-close')
      ?.addEventListener('click', _closeAddressModal);

    document.getElementById('address-modal-overlay')
      ?.addEventListener('click', (e) => {
        if (e.target.id === 'address-modal-overlay') _closeAddressModal();
      });

    /* Place Order button inside modal */
    document.getElementById('address-modal-submit')
      ?.addEventListener('click', async () => {
        if (_checkingOut) return;

        const errEl = document.getElementById('address-modal-error');
        const btn   = document.getElementById('address-modal-submit');

        const { data: address, error: addrErr } = _getAddress();
        if (addrErr) {
          if (errEl) { errEl.textContent = addrErr; errEl.style.display = 'block'; }
          return;
        }
        if (errEl) errEl.style.display = 'none';

        _checkingOut = true;
        if (btn) { btn.disabled = true; btn.textContent = 'Placing Order…'; }

        const items = Engine.Store.get('cart');
        const user  = Engine.Store.get('user');
        const { error } = await Engine.API.createOrder(items, user?.id, address);

        _checkingOut = false;
        if (btn) { btn.disabled = false; btn.textContent = 'Place Order'; }

        if (error) {
          if (errEl) { errEl.textContent = error; errEl.style.display = 'block'; }
          Engine.EventBus.emit(Engine.Events.NOTIFY, { msg: error, type: 'error', duration: 6000 });
        } else {
          _closeAddressModal();
          Engine.EventBus.emit(Engine.Events.NOTIFY, { msg: 'Order place ho gayi! 🎉', type: 'success' });
          _renderPage();
        }
      });
  }

  return { render };

})();

Engine.Router.register('/cart', () => Engine.Pages.CartPage.render());
