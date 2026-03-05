import { useEffect, useMemo, useRef, useState } from 'react'
import { Input } from '@/components/ui/Input'
import { createPortal } from 'react-dom'

export interface ComboboxOption {
  id: string | number
  label: string
  meta?: string
}

interface Props {
  id: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  options: ComboboxOption[]
  total?: number
  isLoading?: boolean
  isLoadingMore?: boolean
  emptyText?: string
  onPick: (opt: ComboboxOption) => void
  leftAdornment?: React.ReactNode
  /** If set, options only show when value length >= minChars */
  minChars?: number
  onLoadMore?: () => void
  /** Dropdown menu max height (px). Useful in tables/modals. */
  menuMaxHeight?: number
  /** Dropdown menu z-index */
  menuZIndex?: number
  /** Force dropdown min width (px), useful for narrow table cells */
  menuMinWidth?: number
  /** Dropdown max width (px) */
  menuMaxWidth?: number
}

/**
 * Production-grade combobox (Bootstrap-friendly):
 * - keyboard navigation (↑/↓/Enter/Esc)
 * - closes on outside click
 * - supports async options (isLoading + empty)
 */
export function Combobox({
  id,
  value,
  onChange,
  placeholder,
  disabled,
  options,
  total,
  isLoading,
  isLoadingMore,
  emptyText = 'ไม่พบข้อมูล',
  onPick,
  leftAdornment,
  minChars = 0,
  onLoadMore,
  menuMaxHeight = 280,
  menuZIndex = 1050,
  menuMinWidth,
  menuMaxWidth = 640,
}: Props) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [anchorWidth, setAnchorWidth] = useState(0)
  const [menuPos, setMenuPos] = useState<{ left: number; top: number; width: number; openUp: boolean }>({
    left: 0,
    top: 0,
    width: 0,
    openUp: false,
  })
  const rootRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const canOpen = useMemo(() => value.trim().length >= minChars, [minChars, value])
  const shownOptions = useMemo(() => (canOpen ? options : []), [canOpen, options])
  const canLoadMore = useMemo(() => {
    if (!onLoadMore) return false
    if (typeof total !== 'number') return false
    return shownOptions.length < total
  }, [onLoadMore, shownOptions.length, total])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const rootEl = rootRef.current
      const menuEl = menuRef.current
      if (!rootEl) return
      if (!(e.target instanceof Node)) return
      if (rootEl.contains(e.target)) return
      if (menuEl?.contains(e.target)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    // keep index in range
    setActiveIndex((i) => Math.max(0, Math.min(i, Math.max(0, shownOptions.length - 1))))
  }, [shownOptions.length])

  useEffect(() => {
    if (!open) return
    const updateMenuPos = () => {
      const rect = rootRef.current?.getBoundingClientRect()
      if (!rect) return
      const width = Math.max(rect.width, menuMinWidth ?? 0)
      const viewportHeight = window.innerHeight
      const spaceBelow = viewportHeight - rect.bottom
      const openUp = spaceBelow < Math.min(menuMaxHeight + 24, 320)
      const top = openUp ? Math.max(8, rect.top - menuMaxHeight - 6) : rect.bottom + 6
      setAnchorWidth(rect.width)
      setMenuPos({
        left: Math.max(8, rect.left),
        top,
        width,
        openUp,
      })
    }
    updateMenuPos()
    window.addEventListener('resize', updateMenuPos)
    window.addEventListener('scroll', updateMenuPos, true)
    return () => {
      window.removeEventListener('resize', updateMenuPos)
      window.removeEventListener('scroll', updateMenuPos, true)
    }
  }, [open, value, shownOptions.length, menuMaxHeight, menuMinWidth])

  const footer = useMemo(() => {
    if (typeof total !== 'number') return null
    return (
      <div className="border-top px-3 py-2 small text-muted d-flex justify-content-between">
        <span>
          แสดง {shownOptions.length} / {total}
        </span>
        {total > shownOptions.length ? <span>เลื่อน/โหลดเพิ่ม</span> : null}
      </div>
    )
  }, [shownOptions.length, total])

  return (
    <div ref={rootRef} className="position-relative">
      <Input
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          onChange(String(e.target.value))
          if (!open) setOpen(true)
          setActiveIndex(0)
        }}
        onFocus={() => canOpen && setOpen(true)}
        onKeyDown={(e) => {
          if (!open) {
            if (e.key === 'ArrowDown' && canOpen) setOpen(true)
            return
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActiveIndex((i) => Math.min(shownOptions.length - 1, i + 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActiveIndex((i) => Math.max(0, i - 1))
          } else if (e.key === 'Enter') {
            const picked = shownOptions[activeIndex]
            if (picked) {
              e.preventDefault()
              onPick(picked)
              setOpen(false)
            }
          } else if (e.key === 'Tab') {
            const picked = shownOptions[activeIndex]
            if (picked) {
              onPick(picked)
              setOpen(false)
            }
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        leftAdornment={leftAdornment}
        rightAdornment={
          isLoading ? <span className="text-muted small">กำลังโหลด...</span> : null
        }
      />

      {open && canOpen
        ? createPortal(
            <div
              ref={menuRef}
              className="dropdown-menu show p-0"
              style={{
                position: 'fixed',
                left: menuPos.left,
                top: menuPos.top,
                width: Math.max(anchorWidth, menuPos.width, menuMinWidth ?? 0),
                minWidth: Math.max(anchorWidth, menuPos.width, menuMinWidth ?? 0),
                maxWidth: menuMaxWidth,
                maxHeight: menuMaxHeight,
                overflowY: 'auto',
                zIndex: menuZIndex,
              }}
              role="listbox"
              aria-label="ตัวเลือก"
              data-open-up={menuPos.openUp ? '1' : '0'}
              onScroll={(e) => {
                if (!canLoadMore || isLoadingMore || isLoading) return
                const el = e.currentTarget
                const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 24
                if (nearBottom) onLoadMore?.()
              }}
            >
              {isLoading ? (
                <div className="px-3 py-2 small text-muted">กำลังค้นหา...</div>
              ) : shownOptions.length === 0 ? (
                <div className="px-3 py-2 small text-muted">{emptyText}</div>
              ) : (
                <>
                  {shownOptions.map((opt, idx) => (
                    <button
                      key={String(opt.id)}
                      type="button"
                      className={`dropdown-item text-start ${
                        idx === activeIndex ? 'active' : ''
                      }`}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        onPick(opt)
                        setOpen(false)
                      }}
                    >
                      <div className="fw-semibold text-truncate">{opt.label}</div>
                      <div className={`small ${idx === activeIndex ? 'text-white-50' : 'text-muted'}`}>
                        {opt.meta ? opt.meta : `ID: ${opt.id}`}
                      </div>
                    </button>
                  ))}
                  {canLoadMore ? (
                    <div className="border-top px-3 py-2 d-flex align-items-center justify-content-between">
                      <span className="small text-muted">มีรายการเพิ่มเติม</span>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        disabled={Boolean(isLoadingMore)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => onLoadMore?.()}
                      >
                        {isLoadingMore ? 'กำลังโหลด...' : 'โหลดเพิ่ม'}
                      </button>
                    </div>
                  ) : null}
                  {footer}
                </>
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
