type ConnectionStatus = 'connected' | 'pending' | 'offline' | 'error'

interface Props {
  status: ConnectionStatus
  size?: number
}

export function ConnectionStatusIcon({ status, size = 18 }: Props) {
  const color =
    status === 'connected'
      ? '#15B89A'
      : status === 'pending'
        ? '#00A8C5'
        : status === 'error'
          ? '#C93C8D'
          : '#94A3B8'

  if (status === 'connected') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 20 20"
        aria-hidden="true"
        className="text-secondary"
      >
        <path
          d="M6.5 10.5 9 13l4.5-6"
          fill="none"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M4.5 8.5a5 5 0 0 1 7-3.9m4 3.9a5 5 0 0 1-7 3.9"
          fill="none"
          stroke={color}
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  if (status === 'pending') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 20 20"
        className="animate-spin text-primary"
        aria-hidden="true"
      >
        <circle
          cx="10"
          cy="10"
          r="6.5"
          stroke={color}
          strokeWidth="1.8"
          strokeDasharray="2 4"
          fill="none"
        />
      </svg>
    )
  }

  if (status === 'offline') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 20 20"
        aria-hidden="true"
        className="text-slate-400"
      >
        <path
          d="M4 9a6 4 0 0 1 10.5-1.8M4 14h9.5a2.5 2.5 0 1 0-3.9-2"
          fill="none"
          stroke={color}
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <path
          d="M4 4.5 15.5 16"
          stroke={color}
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      aria-hidden="true"
      className="text-accentPink"
    >
      <path
        d="M10 3.5 8.5 8.5h3L10 16.5"
        fill="none"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 9.5 10 3.5l5.5 6"
        fill="none"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}


