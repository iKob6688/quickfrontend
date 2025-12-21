import { useMemo, useState } from 'react'
import { Modal } from 'react-bootstrap'
import { useNavigate } from 'react-router-dom'
import type { TemplateV1 } from '@/app/core/types/template'
import { useTemplateStore } from '@/app/core/storage/templateStore'
import { useSettingsStore } from '@/app/core/storage/settingsStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/shell/ui/card'
import { Button } from '@/app/shell/ui/button'
import { Input } from '@/app/shell/ui/input'

export function TemplateCard({ tpl }: { tpl: TemplateV1 }) {
  const navigate = useNavigate()
  const settings = useSettingsStore((s) => s.settings)
  const createFromDefault = useTemplateStore((s) => s.createFromDefault)
  const duplicateTemplate = useTemplateStore((s) => s.duplicateTemplate)
  const renameTemplate = useTemplateStore((s) => s.renameTemplate)
  const deleteTemplate = useTemplateStore((s) => s.deleteTemplate)
  const togglePublish = useTemplateStore((s) => s.togglePublish)

  const [renameOpen, setRenameOpen] = useState(false)
  const [name, setName] = useState(tpl.name)

  const badges = useMemo(() => {
    const out: string[] = []
    if (tpl.isDefault) out.push('Default')
    if (tpl.published) out.push('Published')
    return out
  }, [tpl.isDefault, tpl.published])

  const isPrintDefault = useMemo(() => {
    const map = settings.defaultTemplateIdByDocType
    if (!map) return false
    if (tpl.docType === 'trf_receipt') return false
    return map[tpl.docType as 'quotation' | 'receipt_full' | 'receipt_short'] === tpl.id
  }, [settings.defaultTemplateIdByDocType, tpl.docType, tpl.id])

  return (
    <div className="relative">
      {isPrintDefault ? (
        <div
          className="pointer-events-none absolute left-3 top-0 z-10 -translate-y-1/2 rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-semibold text-white shadow"
          title="This template is used by default when printing from ERPTH"
        >
          Default for print
        </div>
      ) : null}
      <Card className={isPrintDefault ? 'border-emerald-300' : undefined}>
      <CardHeader>
        <CardTitle>{tpl.name}</CardTitle>
        <CardDescription className="flex items-center gap-2">
          <span>{tpl.docType}</span>
          {badges.length ? <span className="text-slate-400">•</span> : null}
          {badges.length ? <span className="text-slate-500">{badges.join(' • ')}</span> : null}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => navigate(`/reports-studio/preview/${tpl.id}`)}>
            Preview
          </Button>
          <Button variant="outline" onClick={() => navigate(`/reports-studio/editor/${tpl.id}`)}>
            Open Editor
          </Button>

          {tpl.isDefault ? (
            <Button
              onClick={() => {
                const newId = createFromDefault(tpl.id)
                if (newId) navigate(`/reports-studio/editor/${newId}`)
              }}
            >
              Create from default
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  const newId = duplicateTemplate(tpl.id)
                  if (newId) navigate(`/reports-studio/editor/${newId}`)
                }}
              >
                Duplicate
              </Button>
              <Button variant="outline" onClick={() => setRenameOpen(true)}>
                Rename
              </Button>
              <Button variant="outline" onClick={() => togglePublish(tpl.id)}>
                {tpl.published ? 'Unpublish' : 'Publish'}
              </Button>
              <Button variant="destructive" onClick={() => deleteTemplate(tpl.id)}>
                Delete
              </Button>
            </>
          )}
        </div>
      </CardContent>

      <Modal show={renameOpen} onHide={() => setRenameOpen(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Rename template</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="text-muted small mb-2">Keep names short and clear.</div>
          <Input value={name} onChange={(e: any) => setName(e.target.value)} />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setRenameOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              renameTemplate(tpl.id, name.trim() || tpl.name)
              setRenameOpen(false)
            }}
          >
            Save
          </Button>
        </Modal.Footer>
      </Modal>
      </Card>
    </div>
  )
}


