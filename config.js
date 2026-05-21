/**
 * ═══════════════════════════════════════════════════════════
 * SITE CONFIG — STRYDE FOOTWEAR
 * ═══════════════════════════════════════════════════════════
 */

window.SITE_CONFIG = {

  /* ── Identity ── */
  name:        'STRYDE',
  tagline:     'Built for the Bold.',
  description: 'Premium footwear engineered for those who move with purpose.',
  logo:        'STRYDE',

  /* ── Supabase credentials ── */
  supabase: {
    url:     'https://YOUR_PROJECT.supabase.co',
    anonKey: 'YOUR_ANON_KEY',
  },

  /* ── Tables ── */
  table: {
    products: 'products',
    orders:   'orders',
    users:    'users',
  },

  /* ── Navigation ── */
  nav: [
    { label: 'HOME',        href: '#/'                    },
    { label: 'SNEAKERS',    href: '#/category/sneakers'   },
    { label: 'RUNNING',     href: '#/category/running'    },
    { label: 'BASKETBALL',  href: '#/category/basketball' },
    { label: 'BOOTS',       href: '#/category/boots'      },
    { label: 'LOAFERS',     href: '#/category/loafers'    },
    { label: 'SANDALS',     href: '#/category/sandals'    },
    { label: 'FORMAL',      href: '#/category/formal'     },
    { label: 'LIMITED',     href: '#/category/limited'    },
  ],

  /* ── Footer ── */
  footer: {
    columns: [
      {
        title: 'Shop',
        links: [
          { label: 'Sneakers',   href: '#/category/sneakers'   },
          { label: 'Running',    href: '#/category/running'    },
          { label: 'Basketball', href: '#/category/basketball' },
          { label: 'Boots',      href: '#/category/boots'      },
          { label: 'Loafers',    href: '#/category/loafers'    },
          { label: 'Limited',    href: '#/category/limited'    },
        ]
      },
      {
        title: 'Info',
        links: [
          { label: 'About Us',     href: '#/about'      },
          { label: 'Size Guide',   href: '#/size-guide' },
          { label: 'Contact',      href: '#/contact'    },
          { label: 'Easy Returns', href: '#/returns'    },
          { label: 'Track Order',  href: '#/orders'     },
        ]
      }
    ]
  },

  /* ── Hero ── */
  hero: {
    eyebrow:      'Season 01',
    title:        'STEP<br>DIFFERENT',
    desc:         'Built for the Bold. Crafted for the streets.',
    ctaPrimary:   { label: 'Shop Now',     href: '#products'          },
    ctaSecondary: { label: 'New Arrivals', href: '#/category/limited' },
    stats: [],
    badge: 'FREE SHIPPING ON ORDERS ABOVE ₹1499',
  },

  /* ── Products section ── */
  products: {
    sectionEyebrow:  'Season 01',
    sectionTitle:    'New Arrivals',
    sectionSubtitle: 'Every step tells a story.',
    lowStockThreshold: 5,
    categories: [
      { slug: 'all',        label: 'ALL'        },
      { slug: 'sneakers',   label: 'SNEAKERS'   },
      { slug: 'running',    label: 'RUNNING'    },
      { slug: 'basketball', label: 'BASKETBALL' },
      { slug: 'boots',      label: 'BOOTS'      },
      { slug: 'loafers',    label: 'LOAFERS'    },
      { slug: 'sandals',    label: 'SANDALS'    },
      { slug: 'formal',     label: 'FORMAL'     },
      { slug: 'limited',    label: 'LIMITED'    },
    ],
  },

  /* ── Currency & locale ── */
  locale: {
    currency: 'INR',
    symbol:   '₹',
    locale:   'en-IN',
  },

  /* ── Feature flags ── */
  features: {
    auth:        true,
    cart:        true,
    adminPanel:  true,
    stockBadges: false,
    search:      true,
    categories:  true,
  },

  /* ── Admin ── */
  admin: {
    adminEmails: ['admin@stryde.com'],
  },

  /* ── Payment ── */
  payment: {
    provider:        'demo',
    razorpayKeyId:   'rzp_test_Ss0QakTcjWWNYc',
    stripePublicKey: 'bqBpen5KUcR9j5hspYTNLXgA',
    currency:        'INR',
  },

  /* ── Theming — Red + White Athletic ── */
  theme: {
    '--color-primary':       '#C8102E',
    '--color-primary-hover': '#a00c24',
    '--color-accent':        '#C8102E',
    '--color-accent-hover':  '#a00c24',
    '--color-bg':            '#F7F4F1',
    '--color-surface':       '#FFFFFF',
    '--color-surface-2':     '#F0ECE8',
    '--color-border':        '#E4DED8',
    '--color-text':          '#0F0F0F',
    '--color-text-muted':    '#6B6560',
    '--color-text-light':    '#B0A8A3',
    '--font-display':        "'Barlow Condensed', system-ui, sans-serif",
    '--font-body':           "'Manrope', system-ui, sans-serif",
    '--navbar-h':            '60px',
    '--hero-image':          'url(https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1400&q=80)',
  },

};

Object.freeze(window.SITE_CONFIG.features);
Object.freeze(window.SITE_CONFIG.locale);
