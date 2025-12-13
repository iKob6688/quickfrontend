interface TokenIconProps {
  size?: number
}

export function TokenIcon({ size = 18 }: TokenIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      aria-hidden="true"
      className="text-accentGold"
    >
      <circle cx="10" cy="10" r="6.5" fill="#FBBF24" opacity="0.15" />
      <circle
        cx="10"
        cy="10"
        r="5.2"
        fill="none"
        stroke="#FBBF24"
        strokeWidth="1.4"
      />
      <path
        d="M10 6.5v3.2l2.2 1.7"
        fill="none"
        stroke="#FBBF24"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}


