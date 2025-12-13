interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg'
  tone?: 'dark' | 'light'
}

const sizeMap: Record<NonNullable<AppLogoProps['size']>, number> = {
  sm: 28,
  md: 36,
  lg: 44,
}

export function AppLogo({ size = 'md', tone = 'dark' }: AppLogoProps) {
  const px = sizeMap[size]

  return (
    <div className="inline-flex items-center gap-2">
      <span
        className="inline-flex items-center justify-center rounded-3xl bg-gradient-to-br from-primary via-secondary to-surfaceDark shadow-card"
        style={{ width: px, height: px }}
      >
        <span className="h-[55%] w-[55%] rounded-[40%] bg-bgLight/95 shadow-soft" />
      </span>
      <span
        className={
          tone === 'light'
            ? 'text-sm font-semibold tracking-wide text-white'
            : 'text-sm font-semibold tracking-wide text-surfaceDark'
        }
      >
        Quickfront
        <span className="text-xs align-top text-accentGold">18</span>
      </span>
    </div>
  )
}


