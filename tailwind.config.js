/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontSize: {
        // Typography system (PEAK-like accounting SaaS) — uses CSS tokens
        xs: ['var(--qf-text-xs)', { lineHeight: 'var(--qf-lh-normal)' }],
        sm: ['var(--qf-text-sm)', { lineHeight: 'var(--qf-lh-normal)' }],
        base: ['var(--qf-text-base)', { lineHeight: 'var(--qf-lh-body)' }],
        lg: ['var(--qf-text-lg)', { lineHeight: 'var(--qf-lh-normal)' }],
        xl: ['var(--qf-text-xl)', { lineHeight: 'var(--qf-lh-normal)' }],
        '2xl': ['var(--qf-text-2xl)', { lineHeight: 'var(--qf-lh-tight)' }],
        // Semantic tokens
        pageTitle: ['var(--qf-text-page-title)', { lineHeight: 'var(--qf-lh-page-title)', fontWeight: 'var(--qf-weight-bold)' }],
        sectionTitle: ['var(--qf-text-section-title)', { lineHeight: 'var(--qf-lh-section-title)', fontWeight: 'var(--qf-weight-semibold)' }],
        body: ['var(--qf-text-body)', { lineHeight: 'var(--qf-lh-body)', fontWeight: 'var(--qf-weight-regular)' }],
        meta: ['var(--qf-text-meta)', { lineHeight: 'var(--qf-lh-meta)', fontWeight: 'var(--qf-weight-medium)' }],
        micro: ['var(--qf-text-micro)', { lineHeight: 'var(--qf-lh-micro)', fontWeight: 'var(--qf-weight-semibold)' }],
        number: ['var(--qf-text-number)', { lineHeight: 'var(--qf-lh-number)', fontWeight: 'var(--qf-weight-semibold)' }],
        numberLg: ['var(--qf-text-number-lg)', { lineHeight: 'var(--qf-lh-tight)', fontWeight: 'var(--qf-weight-bold)' }],
      },
      fontWeight: {
        regular: 'var(--qf-weight-regular)',
        medium: 'var(--qf-weight-medium)',
        semibold: 'var(--qf-weight-semibold)',
        bold: 'var(--qf-weight-bold)',
      },
      colors: {
        // Semantic color system (maps to CSS tokens)
        primary: 'var(--qf-primary)',
        primaryDark: 'var(--qf-primary-dark)',
        primaryWeak: 'var(--qf-primary-weak)',
        secondary: 'var(--qf-secondary)',
        accentGold: 'var(--qf-accent-gold)',
        accentPink: 'var(--qf-accent-pink)',
        // Surfaces
        bg0: 'var(--qf-bg-0)',
        bg1: 'var(--qf-bg-1)',
        bg2: 'var(--qf-bg-2)',
        bgLight: 'var(--qf-bg-2)', // Legacy alias
        // Text
        textStrong: 'var(--qf-text-strong)',
        text: 'var(--qf-text)',
        textMuted: 'var(--qf-text-muted)',
        surfaceDark: 'var(--qf-text-strong)', // Legacy alias
        muted: 'var(--qf-text-muted)', // Legacy alias
        // Borders
        border: 'var(--qf-border)',
        borderStrong: 'var(--qf-border-strong)',
        cardBorder: 'var(--qf-border)', // Legacy alias
        // Status
        success: 'var(--qf-success)',
        successWeak: 'var(--qf-success-weak)',
        warning: 'var(--qf-warning)',
        warningWeak: 'var(--qf-warning-weak)',
        danger: 'var(--qf-danger)',
        dangerWeak: 'var(--qf-danger-weak)',
        info: 'var(--qf-info)',
        infoWeak: 'var(--qf-info-weak)',
      },
      borderRadius: {
        sm: 'var(--qf-radius-sm)',
        md: 'var(--qf-radius-md)',
        lg: 'var(--qf-radius-lg)',
        xl: 'var(--qf-radius-xl)',
        '2xl': 'var(--qf-radius-xl)', // Legacy alias
        '3xl': 'var(--qf-radius-xl)', // Legacy alias
        full: 'var(--qf-radius-full)',
      },
      boxShadow: {
        soft: '0 18px 45px rgba(15, 23, 42, 0.12)',
        card: 'var(--qf-card-shadow)',
        cardHover: 'var(--qf-card-shadow-hover)',
      },
      backgroundImage: {
        'peak-header':
          'linear-gradient(90deg, #5B6CFF 0%, #3C9BEF 45%, #18D2C0 100%)',
        // Original ocean tone but diagonal (requested)
        'ocean-diagonal':
          'radial-gradient(circle at 0% 0%, rgba(201,60,141,0.16) 0, transparent 45%), radial-gradient(circle at 100% 0%, rgba(251,191,36,0.18) 0, transparent 55%), linear-gradient(135deg, #F0F7FF 0%, #C7ECFF 30%, #00A8C5 70%, #0B6EA6 100%)',
      },
    },
  },
  plugins: [],
}
