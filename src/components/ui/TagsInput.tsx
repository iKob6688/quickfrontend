import { useMemo, useState, type KeyboardEvent } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'

interface TagsInputProps {
  id: string
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  helperText?: string
}

function normalizeTag(tag: string) {
  return tag.trim().replace(/\s+/g, ' ')
}

export function TagsInput({ id, value, onChange, placeholder, helperText }: TagsInputProps) {
  const [draft, setDraft] = useState('')

  const tags = useMemo(
    () => value.map((tag) => normalizeTag(tag)).filter(Boolean),
    [value],
  )

  const commitTag = (raw: string) => {
    const nextTag = normalizeTag(raw)
    if (!nextTag) return
    const exists = tags.some((tag) => tag.toLowerCase() === nextTag.toLowerCase())
    if (exists) return
    onChange([...tags, nextTag])
  }

  const removeTag = (index: number) => {
    onChange(tags.filter((_, i) => i !== index))
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' && e.key !== ',') return
    e.preventDefault()
    commitTag(draft)
    setDraft('')
  }

  return (
    <div>
      <div className="d-flex flex-wrap gap-2 mb-2">
        {tags.length > 0 ? (
          tags.map((tag, index) => (
            <Badge
              key={`${tag}-${index}`}
              tone="blue"
              className="d-inline-flex align-items-center gap-2 text-start"
            >
              <span>{tag}</span>
              <button
                type="button"
                className="btn btn-link p-0 text-decoration-none text-white-50"
                aria-label={`ลบ tag ${tag}`}
                onClick={() => removeTag(index)}
                style={{ lineHeight: 1 }}
              >
                ×
              </button>
            </Badge>
          ))
        ) : (
          <span className="small text-muted">ยังไม่มี tag</span>
        )}
      </div>
      <Input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        onBlur={() => {
          if (!draft.trim()) return
          commitTag(draft)
          setDraft('')
        }}
      />
      {helperText ? <div className="small text-muted mt-1">{helperText}</div> : null}
      <div className="small text-muted mt-1">กด Enter หรือพิมพ์ comma เพื่อเพิ่ม tag</div>
    </div>
  )
}
