import { nanoid } from 'nanoid'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { AnyDocumentDTO } from '@/app/core/types/dto'
import type { AnyBlock, TemplateV1 } from '@/app/core/types/template'
import { useTemplateStore } from '@/app/core/storage/templateStore'
import { useBrandingStore } from '@/app/core/storage/brandingStore'
import { useSettingsStore } from '@/app/core/storage/settingsStore'
import { MockOdooProvider } from '@/app/core/odoo/MockOdooProvider'
import { HttpOdooProvider } from '@/app/core/odoo/HttpOdooProvider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/shell/ui/card'
import { Button } from '@/app/shell/ui/button'
import { Input } from '@/app/shell/ui/input'
import { toast } from '@/lib/toastStore'
import { BlockPalette } from './BlockPalette'
import { CanvasA4 } from './CanvasA4'
import { PropertiesPanel } from './properties/PropertiesPanel'
import { ThemePanel } from './properties/ThemePanel'

function createBlock(type: AnyBlock['type']): AnyBlock {
  const id = nanoid()
  switch (type) {
    case 'header':
      return { id, type, props: { showLogo: true, showTaxId: true, showContactLines: true } }
    case 'title':
      return { id, type, props: { titleEn: 'TITLE', titleTh: undefined, showOriginalBadge: false } }
    case 'customerInfo':
      return { id, type, props: { showAddress: true, showTaxId: false, showTel: false, label: 'Customer' } }
    case 'docMeta':
      return { id, type, props: { fields: ['number', 'date', 'reference'] } }
    case 'itemsTable':
      return { id, type, props: { compact: false, showUnit: false, showDiscount: true, currency: 'THB' } }
    case 'summaryTotals':
      return { id, type, props: { showVat: true, showDiscount: true } }
    case 'amountInWords':
      return { id, type, props: { label: 'Amount in words' } }
    case 'paymentMethod':
      return { id, type, props: { style: 'checkboxes', showBank: true, showDate: true, showChequeNo: true } }
    case 'journalItems':
      return { id, type, props: { title: 'Journal Items' } }
    case 'signature':
      return { id, type, props: { leftLabel: 'Customer', rightLabel: 'Authorized' } }
    case 'notes':
      return { id, type, props: { text: '' } }
    case 'stamp':
      return { id, type, props: { enabled: true, label: 'Stamp' } }
    default:
      return { id, type: 'notes', props: { text: '' } }
  }
}

export function EditorPage() {
  const { templateId } = useParams()
  const navigate = useNavigate()

  const templates = useTemplateStore((s) => s.templates)
  const createFromDefault = useTemplateStore((s) => s.createFromDefault)
  const duplicateTemplate = useTemplateStore((s) => s.duplicateTemplate)
  const upsertTemplate = useTemplateStore((s) => s.upsertTemplate)
  const addBlock = useTemplateStore((s) => s.addBlock)
  const reorderBlocks = useTemplateStore((s) => s.reorderBlocks)
  const updateBlock = useTemplateStore((s) => s.updateBlock)

  const branding = useBrandingStore((s) => s.branding)
  const settings = useSettingsStore((s) => s.settings)
  const patchSettings = useSettingsStore((s) => s.patchSettings)

  const tpl = useMemo(() => templates.find((t) => t.id === templateId), [templates, templateId])

  const [selectedBlockId, setSelectedBlockId] = useState<string>('')
  const [recordId, setRecordId] = useState('sample')
  const [dto, setDto] = useState<AnyDocumentDTO | null>(null)
  const [dtoError, setDtoError] = useState<string | null>(null)
  const [rightTab, setRightTab] = useState<'theme' | 'block'>('theme')
  const [saveHint, setSaveHint] = useState<string>('') // small UX feedback for explicit actions

  useEffect(() => {
    if (!tpl) return
    setSelectedBlockId('')
  }, [tpl?.id])

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
  }, [tpl?.docType, recordId, settings.apiToken, settings.odooBaseUrl, tpl])

  const selectedBlock = useMemo(() => tpl?.blocks.find((b) => b.id === selectedBlockId), [tpl, selectedBlockId])

  if (!tpl) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <Card>
          <CardHeader>
            <CardTitle>Template not found</CardTitle>
            <CardDescription>Go back to Template Library.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/reports-studio/templates')}>Open Template Library</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isReadOnly = !!tpl.isDefault
  const currentDefaultId = settings.defaultTemplateIdByDocType?.[tpl.docType as 'quotation' | 'receipt_full' | 'receipt_short']
  const isCurrentDefault = currentDefaultId === tpl.id

  return (
    <div className="container-fluid px-2 pb-4">
      {isReadOnly ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          This is a <span className="font-semibold">default template</span> (read-only). Create a custom copy to edit safely.
          <div className="mt-2">
            <Button
              onClick={() => {
                const newId = createFromDefault(tpl.id)
                if (newId) navigate(`/reports-studio/editor/${newId}`)
              }}
            >
              Create editable copy
            </Button>
          </div>
        </div>
      ) : null}

      {/* Toolbar */}
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <div className="small text-muted">Record ID</div>
        <Input
          value={recordId}
          onChange={(e: any) => setRecordId(e.target.value)}
          className="w-auto"
          style={{ minWidth: 220 }}
          placeholder="recordId"
        />
        {dtoError ? <div className="text-danger small">{dtoError}</div> : null}
        <div className="ms-auto d-flex flex-wrap align-items-center gap-2">
          {saveHint ? <div className="small text-muted">{saveHint}</div> : null}
          {currentDefaultId ? (
            <div className="small text-muted">
              Default for this doc:{' '}
              <span className="font-monospace">{currentDefaultId}</span>
              {isCurrentDefault ? <span className="ms-2 badge text-bg-success">This template</span> : null}
            </div>
          ) : null}
          <div className="small text-muted">Grid: {tpl.page.gridPx}px</div>
          <Button
            variant="outline"
            onClick={() => {
              // Explicit save gives users confidence; templates are persisted via Zustand anyway.
              upsertTemplate({ ...tpl, updatedAt: new Date().toISOString() })
              setSaveHint('Saved')
              window.setTimeout(() => setSaveHint(''), 1200)
            }}
            disabled={isReadOnly}
            title={isReadOnly ? 'Default templates are read-only. Create a copy to edit.' : 'Save changes'}
          >
            Save
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              const newId = duplicateTemplate(tpl.id)
              if (newId) navigate(`/reports-studio/editor/${newId}`)
            }}
            title="Save As (create a copy)"
          >
            Save As
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              patchSettings({
                defaultTemplateIdByDocType: {
                  ...settings.defaultTemplateIdByDocType,
                  [tpl.docType]: tpl.id,
                },
              })
              setSaveHint('Set as default')
              window.setTimeout(() => setSaveHint(''), 1200)
              toast.success('ตั้งค่าเริ่มต้นสำหรับการพิมพ์แล้ว', `Template: ${tpl.id}`)
            }}
            title="Set as default template for printing"
          >
            Set default
          </Button>
        </div>
      </div>

      <div className="row g-3">
        {/* Left: Blocks */}
        <div className="col-12 col-lg-3">
          <div className="card" style={{ height: 'calc(100vh - 220px)', overflow: 'auto' }}>
            <div className="card-header">
              <div className="fw-semibold">Blocks</div>
              <div className="small text-muted">Drag into the canvas.</div>
            </div>
            <div className="card-body">
              <BlockPalette docType={tpl.docType} />
            </div>
          </div>
        </div>

        {/* Center: Canvas */}
        <div className="col-12 col-lg-6">
          <div className="rounded-3 border bg-white" style={{ height: 'calc(100vh - 220px)', overflow: 'auto' }}>
            <div className="p-3">
              {dto ? (
                <CanvasA4
                  template={tpl}
                  branding={branding}
                  dto={dto}
                  selectedBlockId={selectedBlockId || undefined}
                  onSelectBlock={(id) => {
                    setSelectedBlockId(id)
                    if (id) setRightTab('block')
                  }}
                  onBlocksReorder={(nextIds) => {
                    if (isReadOnly) return
                    reorderBlocks(tpl.id, nextIds)
                  }}
                  onAddBlock={(type, index) => {
                    if (isReadOnly) return
                    const block = createBlock(type)
                    if (typeof index === 'number' && index >= 0 && index < tpl.blocks.length) {
                      const nextBlocks = tpl.blocks.slice()
                      nextBlocks.splice(index, 0, block)
                      const nextTpl: TemplateV1 = { ...tpl, blocks: nextBlocks, updatedAt: new Date().toISOString() }
                      upsertTemplate(nextTpl)
                      return
                    }
                    addBlock(tpl.id, block)
                  }}
                />
              ) : (
                <div className="alert alert-secondary mb-0">Loading document DTO…</div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Config */}
        <div className="col-12 col-lg-3">
          <div className="card" style={{ height: 'calc(100vh - 220px)', overflow: 'auto' }}>
            <div className="card-header">
              <div className="fw-semibold mb-2">Config</div>
              <ul className="nav nav-tabs card-header-tabs">
                <li className="nav-item">
                  <button
                    className={`nav-link ${rightTab === 'theme' ? 'active' : ''}`}
                    onClick={() => setRightTab('theme')}
                    type="button"
                  >
                    Theme
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    className={`nav-link ${rightTab === 'block' ? 'active' : ''}`}
                    onClick={() => setRightTab('block')}
                    type="button"
                  >
                    Block
                  </button>
                </li>
              </ul>
            </div>
            <div className="card-body">
              {rightTab === 'theme' ? (
                <ThemePanel
                  template={tpl}
                  onPatchTheme={(patch) => {
                    if (isReadOnly) return
                    upsertTemplate({ ...tpl, theme: { ...tpl.theme, ...patch }, updatedAt: new Date().toISOString() })
                  }}
                  onPatchPage={(patch) => {
                    if (isReadOnly) return
                    upsertTemplate({ ...tpl, page: { ...tpl.page, ...patch }, updatedAt: new Date().toISOString() })
                  }}
                />
              ) : (
                <PropertiesPanel
                  template={tpl}
                  selectedBlock={selectedBlock}
                  onPatchBlock={(blockId, patch) => {
                    if (isReadOnly) return
                    updateBlock(tpl.id, blockId, patch)
                  }}
                  onDeleteBlock={(blockId) => {
                    if (isReadOnly) return
                    const nextBlocks = tpl.blocks.filter((b) => b.id !== blockId)
                    upsertTemplate({ ...tpl, blocks: nextBlocks, updatedAt: new Date().toISOString() })
                    setSelectedBlockId('')
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


