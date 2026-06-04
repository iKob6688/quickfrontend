import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ButtonGroup, Button } from 'react-bootstrap'
import { twMerge } from 'tailwind-merge'

export interface TabItem<T extends string> {
  key: T
  label: string
  count?: number
}

export function Tabs<T extends string>(props: {
  items: TabItem<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}) {
  const { items, value, onChange, className } = props
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const dragStartXRef = useRef(0)
  const dragStartScrollLeftRef = useRef(0)
  const isMouseDraggingRef = useRef(false)
  const [canScroll, setCanScroll] = useState(false)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollState = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    const maxScrollLeft = Math.max(0, el.scrollWidth - el.clientWidth)
    setCanScroll(maxScrollLeft > 1)
    setCanScrollLeft(el.scrollLeft > 1)
    setCanScrollRight(el.scrollLeft < maxScrollLeft - 1)
  }, [])

  useEffect(() => {
    updateScrollState()
    const el = scrollerRef.current
    if (!el || typeof window === 'undefined') return

    window.addEventListener('resize', updateScrollState)
    return () => {
      window.removeEventListener('resize', updateScrollState)
    }
  }, [items.length, updateScrollState])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return

    const handleNativeWheel = (event: globalThis.WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
      event.preventDefault()
      el.scrollLeft += event.deltaY
      updateScrollState()
    }

    el.addEventListener('wheel', handleNativeWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', handleNativeWheel)
    }
  }, [updateScrollState])

  useEffect(() => {
    const activeButton = scrollerRef.current?.querySelector<HTMLButtonElement>(
      '.qf-tabs__btn--active',
    )
    activeButton?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    updateScrollState()
  }, [updateScrollState, value])

  const scrollTabs = (direction: -1 | 1) => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollBy({
      left: direction * Math.max(180, Math.floor(el.clientWidth * 0.68)),
      behavior: 'smooth',
    })
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const el = scrollerRef.current
    if (!el || event.pointerType !== 'mouse' || el.scrollWidth <= el.clientWidth) return
    isMouseDraggingRef.current = true
    dragStartXRef.current = event.clientX
    dragStartScrollLeftRef.current = el.scrollLeft
    el.classList.add('is-dragging')
    el.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const el = scrollerRef.current
    if (!el || !isMouseDraggingRef.current) return
    event.preventDefault()
    el.scrollLeft = dragStartScrollLeftRef.current - (event.clientX - dragStartXRef.current)
    updateScrollState()
  }

  const stopMouseDrag = (event: PointerEvent<HTMLDivElement>) => {
    const el = scrollerRef.current
    if (!el || !isMouseDraggingRef.current) return
    isMouseDraggingRef.current = false
    el.classList.remove('is-dragging')
    if (el.hasPointerCapture(event.pointerId)) {
      el.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <div className={twMerge('qf-tabs-shell', className)}>
      {canScroll ? (
        <button
          type="button"
          className="qf-tabs__scroll-btn"
          onClick={() => scrollTabs(-1)}
          disabled={!canScrollLeft}
          aria-label="เลื่อนเมนูไปทางซ้าย"
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
      ) : null}

      <ButtonGroup
        ref={scrollerRef}
        className="qf-tabs rounded-pill shadow-sm"
        onScroll={updateScrollState}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopMouseDrag}
        onPointerCancel={stopMouseDrag}
        onPointerLeave={stopMouseDrag}
      >
        {items.map((item) => {
          const active = item.key === value
          return (
            <Button
              key={item.key}
              variant={active ? 'primary' : 'outline-secondary'}
              onClick={() => onChange(item.key)}
              aria-pressed={active}
              className={twMerge(
                'qf-tabs__btn d-flex align-items-center gap-2',
                active && 'qf-tabs__btn--active',
                !active && 'bg-white',
              )}
            >
              <span className="qf-tabs__label">{item.label}</span>
              {typeof item.count === 'number' && (
                <span className="badge bg-secondary rounded-pill ms-1">
                  {item.count}
                </span>
              )}
            </Button>
          )
        })}
      </ButtonGroup>

      {canScroll ? (
        <button
          type="button"
          className="qf-tabs__scroll-btn"
          onClick={() => scrollTabs(1)}
          disabled={!canScrollRight}
          aria-label="เลื่อนเมนูไปทางขวา"
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
}
