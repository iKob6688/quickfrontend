import type { PropsWithChildren, ReactNode } from 'react'

export function Tooltip({
  content,
  children,
}: PropsWithChildren<{ content: ReactNode }>) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 hidden -translate-x-1/2 rounded-2xl bg-surfaceDark px-3 py-2 text-[12px] font-semibold text-white shadow-card group-hover:block group-focus-within:block">
        {content}
      </span>
    </span>
  )
}


