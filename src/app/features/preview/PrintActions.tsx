import { useEffect, useMemo, useRef, useState } from 'react'
import { Modal } from 'react-bootstrap'
import { useNavigate } from 'react-router-dom'
import type { Branding } from '@/app/core/types/branding'
import type { AnyDocumentDTO } from '@/app/core/types/dto'
import type { TemplateV1 } from '@/app/core/types/template'
import { toApiError } from '@/api/response'
import { Button } from '@/app/shell/ui/button'

export function PrintActions({
  template,
  dto,
  branding: _branding,
  recordId,
  autoPdf,
}: {
  template: TemplateV1
  dto: AnyDocumentDTO | null
  branding: Branding
  recordId: string
  autoPdf?: boolean
}) {
  const navigate = useNavigate()
  const [pdfError, setPdfError] = useState<string | null>(null)
  const canPdf = useMemo(() => !!dto, [dto])
  const autoTriggeredRef = useRef(false)

  async function openPdf() {
    setPdfError(null)
    if (!dto) return

    try {
      // Most reliable "PDF" experience across devices without a server:
      // open the print page in a new tab, let the browser's native Print UI handle Save as PDF.
      const url = `/reports-studio/print/${template.id}?recordId=${encodeURIComponent(recordId)}&autoprint=0`
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      setPdfError(toApiError(e).message)
    }
  }

  useEffect(() => {
    if (!autoPdf) return
    if (!dto) return
    if (autoTriggeredRef.current) return
    autoTriggeredRef.current = true
    // Fire-and-forget; errors are handled via modal state.
    void openPdf()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPdf, dto])

  return (
    <div className="rs-no-print flex flex-wrap items-center gap-2">
      <Button
        variant="secondary"
        onClick={() => {
          const url = `/reports-studio/print/${template.id}?recordId=${encodeURIComponent(recordId)}`
          window.open(url, '_blank', 'noopener,noreferrer')
        }}
      >
        Quick Print
      </Button>
      <Button variant="outline" disabled={!canPdf} onClick={openPdf}>
        Open PDF
      </Button>
      <Button variant="outline" onClick={() => navigate(`/reports-studio/editor/${template.id}`)}>
        Back to Editor
      </Button>

      <Modal show={!!pdfError} onHide={() => setPdfError(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>PDF failed</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="text-muted small mb-2">Use Quick Print as fallback (mobile friendly).</div>
          <div className="alert alert-danger mb-0">{pdfError}</div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setPdfError(null)}>
            Close
          </Button>
          <Button
            onClick={() => {
              const url = `/reports-studio/print/${template.id}?recordId=${encodeURIComponent(recordId)}`
              window.open(url, '_blank', 'noopener,noreferrer')
              setPdfError(null)
            }}
          >
            Quick Print
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}


