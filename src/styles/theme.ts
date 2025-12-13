export const colors = {
  primary: '#00A8C5',
  primaryDark: '#006495',
  secondary: '#15B89A',
  accentGold: '#FBBF24',
  accentPink: '#C93C8D',
  bgLight: '#F0F7FF',
  surfaceDark: '#031F3B',
} as const

export type ColorToken = keyof typeof colors

export const radii = {
  xl: '0.75rem',
  '2xl': '1rem',
  '3xl': '1.5rem',
} as const

export const shadows = {
  soft: '0 18px 45px rgba(3, 31, 59, 0.25)',
  card: '0 14px 35px rgba(0, 168, 197, 0.20)',
} as const

export const layout = {
  maxWidth: '1200px',
} as const


