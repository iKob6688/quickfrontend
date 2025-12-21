import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import type { AnyDocumentDTO } from '@/app/core/types/dto'
import type { Branding } from '@/app/core/types/branding'
import type { AnyBlock, TemplateV1 } from '@/app/core/types/template'
import { useTemplateStore } from '@/app/core/storage/templateStore'
import { useBrandingStore } from '@/app/core/storage/brandingStore'
import { useSettingsStore } from '@/app/core/storage/settingsStore'
import { MockOdooProvider } from '@/app/core/odoo/MockOdooProvider'
import { HttpOdooProvider } from '@/app/core/odoo/HttpOdooProvider'
import { Input } from '@/app/shell/ui/input'
import { Label } from '@/app/shell/ui/label'
import { RenderBlock } from '@/app/features/editor/BlockRenderer'
import { PrintActions } from './PrintActions'
import { DebugPanel } from './DebugPanel'

function PreviewDocument({
  template,
  dto,
  branding,
  showGuides,
}: {
  template: TemplateV1
  dto: AnyDocumentDTO
  branding: Branding
  showGuides: boolean
}) {
  const blocks = template.blocks
  const isThermal = dto.docType === 'receipt_short' || template.page.mode === 'THERMAL'
  const thermalWidthMm = template.page.thermalMm?.widthMm ?? 80
  const thermalMarginMm = template.page.thermalMm?.marginMm ?? 3
  return (
    <div
      className="rs-page mx-auto bg-white shadow-sm"
      style={{
        width: isThermal ? `${thermalWidthMm}mm` : template.page.canvasPx.width,
        minHeight: isThermal ? undefined : template.page.canvasPx.height,
        fontFamily: template.theme.fontFamily || branding.defaultFont,
      }}
    >
      <div className="relative" style={isThermal ? { padding: `${thermalMarginMm}mm` } : { padding: 24 }}>
        {showGuides ? (
          <div className="pointer-events-none absolute inset-0">
            <div
              className="absolute border border-dashed border-slate-200"
              style={{
                left: isThermal ? `${thermalMarginMm}mm` : 38,
                top: isThermal ? `${thermalMarginMm}mm` : 38,
                right: isThermal ? `${thermalMarginMm}mm` : 38,
                bottom: isThermal ? `${thermalMarginMm}mm` : 38,
              }}
            />
          </div>
        ) : null}

        <div
          className={isThermal ? 'mx-auto' : undefined}
          style={isThermal ? { maxWidth: `${thermalWidthMm}mm` } : undefined}
        >
          <div className="space-y-3">
            {blocks.map((b, idx) => {
            const next = blocks[idx + 1]
            if (b.type === 'customerInfo' && next?.type === 'docMeta') {
              return (
                <div key={`${b.id}:${next.id}`} className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg">
                    <RenderBlock block={b} branding={branding} dto={dto} theme={template.theme} />
                  </div>
                  <div className="rounded-lg">
                    <RenderBlock block={next} branding={branding} dto={dto} theme={template.theme} />
                  </div>
                </div>
              )
            }
            if (idx > 0 && blocks[idx - 1]?.type === 'customerInfo' && b.type === 'docMeta') return null

            return (
              <div key={b.id} className="rounded-lg">
                <RenderBlock block={b as AnyBlock} branding={branding} dto={dto} theme={template.theme} />
              </div>
            )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export function PreviewPage() {
  const { templateId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const templates = useTemplateStore((s) => s.templates)
  const branding = useBrandingStore((s) => s.branding)
  const settings = useSettingsStore((s) => s.settings)

  const tpl = useMemo(() => templates.find((t) => t.id === templateId), [templates, templateId])
  const [dto, setDto] = useState<AnyDocumentDTO | null>(null)
  const [dtoError, setDtoError] = useState<string | null>(null)

  const recordId = searchParams.get('recordId') || 'sample'
  const showGuides = (searchParams.get('guides') || '1') === '1'
  const autoPdf = (searchParams.get('auto') || '').toLowerCase() === 'pdf'
  const showDebug = (searchParams.get('debug') || '0') === '1'

  useEffect(() => {
    if (!tpl) return
    const provider =
      settings.odooBaseUrl.trim().length > 0
        ? new HttpOdooProvider({ baseUrl: settings.odooBaseUrl, token: settings.apiToken })
        : new MockOdooProvider()
    setDtoError(null)
    provider
      .getDocumentDTO({ docType: tpl.docType, recordId })
      .then((d) => setDto(d))
      .catch((e) => {
        setDto(null)
        setDtoError(e instanceof Error ? e.message : String(e))
      })
  }, [recordId, settings.apiToken, settings.odooBaseUrl, tpl])

  if (!tpl) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Template not found.</div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="rs-no-print flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="text-2xl font-semibold text-slate-900">Preview</div>
          <div className="text-sm text-slate-500">A4 accurate preview with print CSS.</div>
        </div>

        <PrintActions template={tpl} dto={dto} branding={branding} recordId={recordId} autoPdf={autoPdf} />
      </div>

      <div className="rs-no-print mt-4 grid gap-4 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3">
        <div className="grid gap-2">
          <Label>Record ID</Label>
          <Input
            value={recordId}
            onChange={(e) => {
              setSearchParams((prev) => {
                prev.set('recordId', e.target.value)
                return prev
              })
            }}
          />
        </div>

        <div className="flex items-center gap-2 pt-6">
          <input
            type="checkbox"
            checked={showGuides}
            onChange={(e) => {
              setSearchParams((prev) => {
                prev.set('guides', e.target.checked ? '1' : '0')
                return prev
              })
            }}
          />
          <div className="text-sm text-slate-700">Show guides</div>
        </div>

        <div className="pt-6 text-sm text-slate-600">
          {dtoError ? <span className="text-red-600">{dtoError}</span> : dto ? 'DTO loaded' : 'Loading DTO…'}
        </div>
      </div>

      <div className="mt-6 rounded-xl bg-slate-100 p-4">
        {dto ? (
          <PreviewDocument template={tpl} dto={dto} branding={branding} showGuides={showGuides} />
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Loading…</div>
        )}
      </div>

      {showDebug ? <DebugPanel dto={dto} template={tpl} branding={branding} /> : null}
    </div>
  )
}

export function PrintPage() {
  const { templateId } = useParams()
  const [searchParams] = useSearchParams()
  const templates = useTemplateStore((s) => s.templates)
  const branding = useBrandingStore((s) => s.branding)
  const settings = useSettingsStore((s) => s.settings)
  const tpl = useMemo(() => templates.find((t) => t.id === templateId), [templates, templateId])

  const recordId = searchParams.get('recordId') || 'sample'
  const autoPrint = (searchParams.get('autoprint') || '1') !== '0'
  const [dto, setDto] = useState<AnyDocumentDTO | null>(null)
  const [dtoError, setDtoError] = useState<string | null>(null)

  useEffect(() => {
    if (!tpl) return
    const provider =
      settings.odooBaseUrl.trim().length > 0
        ? new HttpOdooProvider({ baseUrl: settings.odooBaseUrl, token: settings.apiToken })
        : new MockOdooProvider()
    setDtoError(null)
    provider
      .getDocumentDTO({ docType: tpl.docType, recordId })
      .then((d) => setDto(d))
      .catch((e) => {
        setDto(null)
        setDtoError(e instanceof Error ? e.message : String(e))
      })
  }, [recordId, settings.apiToken, settings.odooBaseUrl, tpl])

  useEffect(() => {
    if (!dto) return
    if (!autoPrint) return
    const t = window.setTimeout(() => window.print(), 250)
    return () => window.clearTimeout(t)
  }, [autoPrint, dto])

  if (!tpl) return <div className="p-6 text-sm text-slate-600">Template not found</div>
  if (dtoError) return <div className="p-6 text-sm text-red-600">{dtoError}</div>
  if (!dto) return <div className="p-6 text-sm text-slate-600">Loading…</div>

  const isThermal = tpl.page.mode === 'THERMAL' || tpl.docType === 'receipt_short'
  const thermalWidthMm = tpl.page.thermalMm?.widthMm ?? 80
  const thermalMarginMm = tpl.page.thermalMm?.marginMm ?? 3

  return (
    <div className="bg-white p-4">
      {isThermal ? (
        <style>{`@page { size: ${thermalWidthMm}mm auto; margin: ${thermalMarginMm}mm; }`}</style>
      ) : null}
      {!autoPrint ? (
        <div className="rs-no-print mb-3 d-flex flex-wrap align-items-center gap-2">
          <div className="small text-muted">Use your browser’s Print dialog to “Save as PDF”.</div>
          <button className="btn btn-primary btn-sm ms-auto" type="button" onClick={() => window.print()}>
            Print / Save as PDF
          </button>
        </div>
      ) : null}
      <PreviewDocument template={tpl} dto={dto} branding={branding} showGuides={false} />
    </div>
  )
}


