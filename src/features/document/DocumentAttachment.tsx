import { Card } from '@/components/ui/Card'

export type DocumentAttachmentItem = {
  id: string | number
  name: string
  size?: number | null
  type?: string | null
}

type Props = {
  title?: string
  items: DocumentAttachmentItem[]
  emptyText?: string
}

export function DocumentAttachment({ title = 'เอกสารแนบ', items, emptyText = 'ยังไม่มีเอกสารแนบ' }: Props) {
  return (
    <Card className="qf-document-attachment">
      <div className="qf-section-title mb-3">{title}</div>
      {items.length > 0 ? (
        <div className="qf-document-attachment__list">
          {items.map((item) => (
            <div key={item.id} className="qf-document-attachment__item">
              <div className="fw-semibold">{item.name}</div>
              <div className="small text-muted">
                {item.size ? `${Math.round(item.size / 1024)} KB` : 'size n/a'}
                {item.type ? ` • ${item.type}` : ''}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="small text-muted">{emptyText}</div>
      )}
    </Card>
  )
}
