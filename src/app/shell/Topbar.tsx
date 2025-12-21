import { useMemo, useState } from 'react'
import { Modal } from 'react-bootstrap'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTemplateStore } from '@/app/core/storage/templateStore'
import { Button } from './ui/button'

export function Topbar() {
  const { templateId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const templates = useTemplateStore((s) => s.templates)
  const duplicateTemplate = useTemplateStore((s) => s.duplicateTemplate)
  const togglePublish = useTemplateStore((s) => s.togglePublish)

  const tpl = useMemo(() => templates.find((t) => t.id === templateId), [templates, templateId])
  const [dupResult, setDupResult] = useState<string | undefined>()

  const title = tpl ? `${tpl.name}` : 'Reports Studio'
  const sub = tpl ? `${tpl.docType}${tpl.published ? ' • Published' : ''}` : location.pathname

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-slate-900">{title}</div>
        <div className="truncate text-xs text-slate-500">{sub}</div>
      </div>

      {tpl ? (
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              const newId = duplicateTemplate(tpl.id)
              setDupResult(newId)
            }}
          >
            Duplicate
          </Button>
          {!tpl.isDefault ? (
            <Button variant="outline" onClick={() => togglePublish(tpl.id)}>
              {tpl.published ? 'Unpublish' : 'Publish'}
            </Button>
          ) : null}
          <Button onClick={() => navigate(`/reports-studio/preview/${tpl.id}`)}>Preview</Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/reports-studio/templates')}>
            Templates
          </Button>
          <Button onClick={() => navigate('/reports-studio/branding')}>Branding</Button>
        </div>
      )}

      <Modal show={!!dupResult} onHide={() => setDupResult(undefined)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Template duplicated</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-muted">Your copy is ready.</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setDupResult(undefined)}>
            Close
          </Button>
          {dupResult ? (
            <Button
              onClick={() => {
                navigate(`/reports-studio/editor/${dupResult}`)
                setDupResult(undefined)
              }}
            >
              Open Editor
            </Button>
          ) : null}
        </Modal.Footer>
      </Modal>
    </div>
  )
}


