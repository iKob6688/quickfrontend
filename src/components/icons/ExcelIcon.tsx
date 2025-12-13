interface ExcelIconProps {
  size?: number
}

export function ExcelIcon({ size = 18 }: ExcelIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      aria-hidden="true"
      className="text-primaryDark"
    >
      <rect
        x="3"
        y="3"
        width="10"
        height="14"
        rx="1.6"
        fill="#F0F7FF"
        stroke="#006495"
        strokeWidth="1.2"
      />
      <path
        d="M7 8.5 9 11l-2 2.5M11 8.5 9 11l2 2.5"
        fill="none"
        stroke="#006495"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="9.5"
        y="4"
        width="7.5"
        height="5.5"
        rx="1.4"
        fill="#15B89A"
      />
      <path
        d="M11 6.8h1.6M13.3 6.8h1.6"
        stroke="#F0F7FF"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  )
}


