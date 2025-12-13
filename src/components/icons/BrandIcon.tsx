interface BrandIconProps {
  variant?: 'gold' | 'pink' | 'aqua'
  size?: number
}

export function BrandIcon({ variant = 'gold', size = 32 }: BrandIconProps) {
  const gradientId = `brand-${variant}`
  const colorMap: Record<typeof variant, string> = {
    gold: '#FBBF24',
    pink: '#C93C8D',
    aqua: '#00A8C5',
  } as const

  const stopColor = colorMap[variant]

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      className="drop-shadow-md"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor={stopColor} />
          <stop offset="60%" stopColor="#00A8C5" />
          <stop offset="100%" stopColor="#031F3B" />
        </linearGradient>
      </defs>
      <rect
        x="3"
        y="3"
        width="34"
        height="34"
        rx="14"
        fill={`url(#${gradientId})`}
      />
      <path
        d="M12 24.5C15 18 17.5 16 20 16c2.5 0 5 2 8 8.5"
        stroke="#F0F7FF"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="20" cy="15" r="2.4" fill="#F0F7FF" />
    </svg>
  )
}


