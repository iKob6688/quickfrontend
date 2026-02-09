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
  return (
    <ButtonGroup className={twMerge('qf-tabs rounded-pill shadow-sm', className)}>
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

