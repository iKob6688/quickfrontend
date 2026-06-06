interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg'
  tone?: 'dark' | 'light'
}

const sizeMap: Record<NonNullable<AppLogoProps['size']>, { width: number; height: number }> = {
  sm: { width: 150, height: 42 },
  md: { width: 190, height: 52 },
  lg: { width: 230, height: 62 },
}

export function AppLogo({ size = 'md', tone = 'dark' }: AppLogoProps) {
  const dimensions = sizeMap[size]

  return (
    <span
      className="inline-flex items-center justify-center"
      style={{
        width: dimensions.width,
        height: dimensions.height,
        padding: tone === 'light' ? '4px 8px' : 0,
        borderRadius: tone === 'light' ? 8 : 0,
        background: tone === 'light' ? 'rgba(255, 255, 255, 0.92)' : 'transparent',
      }}
    >
      <img
        src="/chonlatee-logo.png"
        alt="Chonlatee Innovation"
        style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain' }}
      />
    </span>
  )
}
