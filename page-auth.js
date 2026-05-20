/**
 * PAGE / auth.js
 * Path: js/pages/auth.js
 *
 * NON-BLOCKING PATTERN:
 * · render() is synchronous — paints form immediately
 * · _handleSubmit() uses async (button action, not render)
 * · Auth API call stays async — form submit must wait for result
 */

Engine.Pages = Engine.Pages || {};

Engine.Pages.Auth = (() => {

  let _mode       = 'signin';
  let _failCount  = 0;
  let _submitting = false;

  /* ── RENDER — synchronous ── */
  function render() {
    /* Already signed in — redirect immediately */
    if (Engine.Store.get('user')) {
      Engine.Router.navigate('/');
      return;
    }
    _failCount  = 0;
    _submitting = false;
    _renderForm();
  }

  function _renderForm() {
    const isSignIn = _mode === 'signin';
    const cfg      = window.SITE_CONFIG;

    Engine.Renderer.mount('#app-root', `
      <div class="auth-page">
        <div class="auth-card">

          <div class="auth-logo"
               aria-label="${Engine.Renderer.escape(cfg.name)}">${cfg.logo}</div>
          <p class="auth-subtitle">
            ${isSignIn
              ? 'Welcome back. Sign in to continue.'
              : 'Create your account to get started.'}
          </p>

          <form class="auth-form" id="auth-form" novalidate>

            <div class="form-group">
              <label class="form-label" for="auth-email">Email address</label>
              <input class="form-input" id="auth-email" type="email"
                     placeholder="you@example.com"
                     autocomplete="email" inputmode="email" required />
              <span class="form-error" id="auth-email-err" role="alert"></span>
            </div>

            <div class="form-group">
              <label class="form-label" for="auth-password">Password</label>
              <input class="form-input" id="auth-password" type="password"
                     placeholder="${isSignIn ? 'Your password' : 'Min. 6 characters'}"
                     autocomplete="${isSignIn ? 'current-password' : 'new-password'}"
                     required />
              <span class="form-error" id="auth-password-err" role="alert"></span>
            </div>

            <span class="form-error" id="auth-global-err"
                  role="alert"
                  style="text-align:center;display:block"></span>

            ${_failCount >= 3 ? `
              <p style="font-size:var(--text-xs);color:var(--color-text-muted);
                        text-align:center;line-height:1.5">
                Multiple failed attempts — check credentials carefully.
              </p>
            ` : ''}

            <button type="submit" class="btn btn-primary btn-full btn-lg"
                    id="auth-submit">
              ${isSignIn ? 'Sign In' : 'Create Account'}
            </button>

            ${isSignIn ? `
              <div class="auth-divider">or</div>
              <div style="font-size:var(--text-xs);color:var(--color-text-light);
                          text-align:center;line-height:1.7">
                Demo admin: use any email from
                <code style="background:var(--color-surface-2);
                             padding:1px 6px;border-radius:3px">
                  config.js → adminEmails
                </code>
                with any 6+ char password.
              </div>
            ` : ''}

          </form>

          <div class="auth-switch">
            ${isSignIn
              ? `Don't have an account?
                 <button onclick="Engine.Pages.Auth.switchMode('signup')">
                   Sign up
                 </button>`
              : `Already have an account?
                 <button onclick="Engine.Pages.Auth.switchMode('signin')">
                   Sign in
                 </button>`}
          </div>

        </div>
      </div>
    `);

    setTimeout(() => document.getElementById('auth-email')?.focus(), 80);
    _bindEvents();
  }

  function _bindEvents() {
    document.getElementById('auth-form')
      ?.addEventListener('submit', (e) => { e.preventDefault(); _handleSubmit(); });

    document.getElementById('auth-email')
      ?.addEventListener('input', () => {
        const el = document.getElementById('auth-email-err');
        if (el) el.textContent = '';
      });

    document.getElementById('auth-password')
      ?.addEventListener('input', () => {
        const el = document.getElementById('auth-password-err');
        if (el) el.textContent = '';
        const g = document.getElementById('auth-global-err');
        if (g) g.textContent = '';
      });
  }

  /* ── SUBMIT — async is fine here: this is a button action, not render ── */
  async function _handleSubmit() {
    if (_submitting) return;

    const email    = (document.getElementById('auth-email')?.value || '').trim();
    const password =  document.getElementById('auth-password')?.value || '';

    ['email', 'password', 'global'].forEach(f => {
      const el = document.getElementById(`auth-${f}-err`);
      if (el) el.textContent = '';
    });

    let valid = true;
    if (!Engine.Logic.validateEmail(email)) {
      const el = document.getElementById('auth-email-err');
      if (el) el.textContent = 'Enter a valid email address';
      valid = false;
    }
    if (!Engine.Logic.validatePassword(password)) {
      const el = document.getElementById('auth-password-err');
      if (el) el.textContent = 'Password must be at least 6 characters';
      valid = false;
    }
    if (!valid) return;

    _submitting = true;
    const btn   = document.getElementById('auth-submit');
    if (btn) {
      btn.disabled    = true;
      btn.textContent = _mode === 'signin' ? 'Signing in…' : 'Creating account…';
    }

    const { data, error } = _mode === 'signin'
      ? await Engine.API.signIn(email, password)
      : await Engine.API.signUp(email, password);

    _submitting = false;
    if (btn) {
      btn.disabled    = false;
      btn.textContent = _mode === 'signin' ? 'Sign In' : 'Create Account';
    }

    if (error) {
      _failCount++;
      const g = document.getElementById('auth-global-err');
      if (g) g.textContent = error;
      if (_failCount >= 3) _renderForm();
      return;
    }

    _failCount = 0;
    const user    = data?.user || data?.session?.user;
    const isAdmin = user ? Engine.Logic.isAdmin(user) : false;

    /* ── CRITICAL: Sync store immediately ──────────────────────────────
       Real Supabase fires onAuthStateChange asynchronously AFTER signIn
       resolves. If we call Navbar.render() or navigate('/admin') before
       onAuthStateChange fires, Store still has user=null which causes:
         · Navbar to render without the admin link
         · Router guard to block /admin and redirect back to /auth
       Demo mode never had this bug because _demoAuth() sets the store
       synchronously before returning. We mirror that behaviour here.
    ────────────────────────────────────────────────────────────────── */
    if (user) {
      Engine.Store.batch(() => {
        Engine.Store.set('user',    user);
        Engine.Store.set('isAdmin', isAdmin);
      });
    }

    Engine.EventBus.emit(Engine.Events.NOTIFY, {
      msg:  _mode === 'signin' ? 'Welcome back!' : 'Account created!',
      type: 'success',
    });

    Engine.Components.Navbar.render();
    Engine.Router.navigate(isAdmin ? '/admin' : '/');
  }

  function switchMode(mode) {
    _mode       = mode;
    _submitting = false;
    _failCount  = 0;
    _renderForm();
  }

  return { render, switchMode };

})();

Engine.Router.register('/auth',  () => Engine.Pages.Auth.render());
Engine.Router.register('/login', () => Engine.Pages.Auth.render());
