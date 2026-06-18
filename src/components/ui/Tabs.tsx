import { useRef, useState, type MouseEvent } from 'react'
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
  const dragRef = useRef({ active: false, startX: 0, scrollLeft: 0 })
  const didDragRef = useRef(false)
  const [isDragging, setIsDragging] = useState(false)

  const endDrag = () => {
    dragRef.current.active = false
    setIsDragging(false)
  }

  const handleMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const scroller = scrollerRef.current
    if (!scroller || scroller.scrollWidth <= scroller.clientWidth) return
    dragRef.current = {
      active: true,
      startX: event.clientX,
      scrollLeft: scroller.scrollLeft,
    }
    didDragRef.current = false
    setIsDragging(true)
    event.preventDefault()
  }

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return
    const scroller = scrollerRef.current
    if (!scroller) return
    const deltaX = event.clientX - dragRef.current.startX
    if (Math.abs(deltaX) > 4) didDragRef.current = true
    scroller.scrollLeft = dragRef.current.scrollLeft - deltaX
    event.preventDefault()
  }

  return (
    <ButtonGroup
      ref={scrollerRef}
      className={twMerge('qf-tabs rounded-pill shadow-sm', isDragging && 'qf-tabs--dragging', className)}
      onClickCapture={(event) => {
        if (!didDragRef.current) return
        event.preventDefault()
        event.stopPropagation()
        didDragRef.current = false
      }}
      onMouseDown={handleMouseDown}
      onMouseLeave={endDrag}
      onMouseMove={handleMouseMove}
      onMouseUp={endDrag}
    >
      {items.map((item) => {
        const active = item.key === value
        return (
          <Button
            key={item.key}
            variant={active ? 'primary' : 'link'}
            onClick={() => onChange(item.key)}
            aria-pressed={active}
            className={twMerge(
              'qf-tabs__btn d-flex align-items-center gap-2 text-decoration-none',
              active && 'qf-tabs__btn--active',
              !active && 'text-muted bg-transparent border-0',
            )}
          >
            <span>{item.label}</span>
            {typeof item.count === 'number' && (
              <span className="badge bg-secondary rounded-pill ms-1">
                {item.count}
              </span>
            )}
          </Button>
        )
      })}
    </ButtonGroup>
  )
}
