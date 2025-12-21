import { useEffect, useMemo, useRef, useState } from 'react'
import { Modal } from 'react-bootstrap'
import { useNavigate } from 'react-router-dom'
import type { Branding } from '@/app/core/types/branding'
import type { AnyDocumentDTO } from '@/app/core/types/dto'
import type { TemplateV1 } from '@/app/core/types/template'
import { useSettingsStore } from '@/app/core/storage/settingsStore'
import { apiClient } from '@/api/client'
import { toApiError } from '@/api/response'
import { Button } from '@/app/shell/ui/button'

export function PrintActions({
  template,
  dto,
  branding,
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
  const settings = useSettingsStore((s) => s.settings)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const canPdf = useMemo(() => !!dto, [dto])
  const autoTriggeredRef = useRef(false)

  function normalizePdfEndpoint(input: string | undefined): string {
    const url = (input || '/api/print/pdf').trim()
    // Our axios client already has baseURL '/api'. If user keeps '/api/...' here, avoid '/api/api/...'.
    if (url.startsWith('/api/')) return url.slice('/api'.length)
    return url
  }

  function buildHtmlFromPreview(): string {
    const pageEl = document.querySelector('.rs-page') as HTMLElement | null
    if (!pageEl) throw new Error('Preview container not found (.rs-page).')

    // Include current app styles so Tailwind/Bootstrap classes render correctly in PDF.
    const styleTags = Array.from(document.querySelectorAll('style'))
      .map((s) => s.outerHTML)
      .join('\n')
    const cssLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .map((l) => {
        const href = (l as HTMLLinkElement).href
        // Keep absolute href so the PDF service (headless browser) can fetch assets.
        return href ? `<link rel="stylesheet" href="${href}">` : ''
      })
      .filter(Boolean)
      .join('\n')

    // Capture the rendered Report Studio layout as HTML for server-side PDF generation.
    // Keep styles minimal + print-safe; the PDF service can add additional CSS if needed.
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <base href="${window.location.origin}/" />
    ${cssLinks}
    ${styleTags}
    <style>
      @page { size: A4; margin: 10mm; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      html, body { margin: 0; padding: 0; background: #fff; }
      .rs-no-print { display: none !important; }
    </style>
  </head>
  <body>${pageEl.outerHTML}</body>
</html>`
  }

  async function openPdf() {
    setPdfError(null)
    if (!dto) return

    try {
      const endpoint = normalizePdfEndpoint(settings.pdfServiceUrl)
      const html = buildHtmlFromPreview()
      const res = await apiClient.post(endpoint, {
        templateId: template.id,
        templateJson: template,
        dtoJson: dto,
        brandingJson: branding,
        html,
      })

      const data = res.data as { pdfUrl?: string } | undefined
      const pdfUrl = data?.pdfUrl
      if (!pdfUrl) throw new Error('PDF service response missing pdfUrl')
      window.open(pdfUrl, '_blank', 'noopener,noreferrer')
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


