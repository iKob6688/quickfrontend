import type { AnyBlock, TemplateV1 } from '@/app/core/types/template'
import { Button } from '@/app/shell/ui/button'
import { Input } from '@/app/shell/ui/input'
import { Label } from '@/app/shell/ui/label'

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-slate-700">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

export function PropertiesPanel({
  template,
  selectedBlock,
  onPatchBlock,
  onDeleteBlock,
}: {
  template: TemplateV1
  selectedBlock?: AnyBlock
  onPatchBlock: (blockId: string, patch: Partial<AnyBlock>) => void
  onDeleteBlock: (blockId: string) => void
}) {
  if (!selectedBlock) {
    return (
      <div className="space-y-3">
        <div className="text-sm font-semibold text-slate-900">Properties</div>
        <div className="text-xs text-slate-500">Select a block on the canvas to edit.</div>
      </div>
    )
  }

  const style = selectedBlock.style || {}
  const border = style.border || { enabled: false, widthPx: 1, color: '#CBD5E1' }

  const patchProps = (p: any) => onPatchBlock(selectedBlock.id, { props: { ...(selectedBlock as any).props, ...p } })
  const patchStyle = (p: any) => onPatchBlock(selectedBlock.id, { style: { ...style, ...p } })
  const patchBorder = (p: any) => patchStyle({ border: { ...border, ...p } })

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-900">Properties</div>
          <div className="text-xs text-slate-500">Block: {selectedBlock.type}</div>
        </div>
        <Button variant="destructive" size="sm" onClick={() => onDeleteBlock(selectedBlock.id)}>
          Remove
        </Button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="grid gap-3">
          <Toggle
            label="Locked (prevent moves)"
            checked={!!selectedBlock.locked}
            onChange={(v) => onPatchBlock(selectedBlock.id, { locked: v })}
          />

          <div className="grid gap-2">
            <Label>Padding (px)</Label>
            <Input
              type="number"
              value={style.paddingPx ?? 0}
              onChange={(e) => patchStyle({ paddingPx: Number(e.target.value) })}
            />
          </div>

          <div className="grid gap-2">
            <Label>Margin (px)</Label>
            <Input
              type="number"
              value={style.marginPx ?? 0}
              onChange={(e) => patchStyle({ marginPx: Number(e.target.value) })}
            />
          </div>

          <div className="grid gap-2">
            <Label>Border radius (px)</Label>
            <Input
              type="number"
              value={style.borderRadiusPx ?? 0}
              onChange={(e) => patchStyle({ borderRadiusPx: Number(e.target.value) })}
            />
          </div>

          <Toggle label="Border" checked={!!border.enabled} onChange={(v) => patchBorder({ enabled: v })} />
          {border.enabled ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1">
                <Label>Border width</Label>
                <Input
                  type="number"
                  value={border.widthPx ?? 1}
                  onChange={(e) => patchBorder({ widthPx: Number(e.target.value) })}
                />
              </div>
              <div className="grid gap-1">
                <Label>Border color</Label>
                <Input
                  type="color"
                  className="h-9 w-full p-1"
                  value={border.color ?? '#CBD5E1'}
                  onChange={(e) => patchBorder({ color: e.target.value })}
                />
              </div>
            </div>
          ) : null}

          <div className="grid gap-1">
            <Label>Background</Label>
            <div className="flex items-center gap-2">
              <Input
                type="color"
                className="h-9 w-14 p-1"
                value={style.backgroundColor || '#ffffff'}
                onChange={(e) => patchStyle({ backgroundColor: e.target.value })}
              />
              <Input
                value={style.backgroundColor || ''}
                placeholder="transparent"
                onChange={(e) => patchStyle({ backgroundColor: e.target.value || undefined })}
              />
            </div>
          </div>

          <div className="grid gap-1">
            <Label>Text color</Label>
            <div className="flex items-center gap-2">
              <Input
                type="color"
                className="h-9 w-14 p-1"
                value={style.textColor || '#0f172a'}
                onChange={(e) => patchStyle({ textColor: e.target.value })}
              />
              <Input
                value={style.textColor || ''}
                placeholder="inherit"
                onChange={(e) => patchStyle({ textColor: e.target.value || undefined })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1">
              <Label>Text align</Label>
              <select
                className="form-select"
                value={style.textAlign || ''}
                onChange={(e) => patchStyle({ textAlign: (e.target.value || undefined) as any })}
              >
                <option value="">(inherit)</option>
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </div>
            <div className="grid gap-1">
              <Label>Font weight</Label>
              <select
                className="form-select"
                value={style.fontWeight || ''}
                onChange={(e) => patchStyle({ fontWeight: (e.target.value || undefined) as any })}
              >
                <option value="">(inherit)</option>
                <option value="normal">Normal</option>
                <option value="medium">Medium</option>
                <option value="semibold">Semibold</option>
                <option value="bold">Bold</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1">
              <Label>Font size (px)</Label>
              <Input
                type="number"
                value={style.fontSizePx ?? ''}
                placeholder="inherit"
                onChange={(e) => patchStyle({ fontSizePx: e.target.value ? Number(e.target.value) : undefined })}
              />
            </div>
            <div className="grid gap-1">
              <Label>Font family</Label>
              <Input
                value={style.fontFamily || ''}
                placeholder="inherit"
                onChange={(e) => patchStyle({ fontFamily: e.target.value || undefined })}
              />
            </div>
          </div>

          {selectedBlock.type === 'signature' ? (
            <>
              <div className="border-t border-slate-200 pt-3">
                <div className="mb-2 text-sm font-semibold text-slate-900">Signature bottom bar</div>
                <div className="grid gap-3">
                  <Toggle
                    label="Bottom bar"
                    checked={selectedBlock.props.bottomBarEnabled ?? true}
                    onChange={(v) => patchProps({ bottomBarEnabled: v })}
                  />
                  {(selectedBlock.props.bottomBarEnabled ?? true) ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="grid gap-1">
                        <Label>Bar color</Label>
                        <Input
                          type="color"
                          className="h-9 w-full p-1"
                          value={selectedBlock.props.bottomBarColor ?? '#111111'}
                          onChange={(e) => patchProps({ bottomBarColor: e.target.value })}
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label>Bar height (px)</Label>
                        <Input
                          type="number"
                          value={selectedBlock.props.bottomBarHeightPx ?? 10}
                          onChange={(e) => patchProps({ bottomBarHeightPx: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="mb-2 text-sm font-semibold text-slate-900">Block toggles</div>

        {selectedBlock.type === 'header' ? (
          <div className="grid gap-2">
            <Toggle label="Show logo" checked={selectedBlock.props.showLogo} onChange={(v) => patchProps({ showLogo: v })} />
            <Toggle label="Show tax ID" checked={selectedBlock.props.showTaxId} onChange={(v) => patchProps({ showTaxId: v })} />
            <Toggle
              label="Show contact lines"
              checked={selectedBlock.props.showContactLines}
              onChange={(v) => patchProps({ showContactLines: v })}
            />
          </div>
        ) : null}

        {selectedBlock.type === 'customerInfo' ? (
          <div className="grid gap-2">
            <Toggle label="Show address" checked={selectedBlock.props.showAddress} onChange={(v) => patchProps({ showAddress: v })} />
            <Toggle label="Show tax ID" checked={selectedBlock.props.showTaxId} onChange={(v) => patchProps({ showTaxId: v })} />
            <Toggle label="Show tel" checked={selectedBlock.props.showTel} onChange={(v) => patchProps({ showTel: v })} />
          </div>
        ) : null}

        {selectedBlock.type === 'itemsTable' ? (
          <div className="grid gap-2">
            <Toggle label="Compact" checked={!!selectedBlock.props.compact} onChange={(v) => patchProps({ compact: v })} />
            <Toggle
              label="Show discount"
              checked={selectedBlock.props.showDiscount !== false}
              onChange={(v) => patchProps({ showDiscount: v })}
            />
          </div>
        ) : null}

        {selectedBlock.type === 'summaryTotals' ? (
          <div className="grid gap-2">
            <Toggle label="Show VAT" checked={selectedBlock.props.showVat !== false} onChange={(v) => patchProps({ showVat: v })} />
            <Toggle
              label="Show discount"
              checked={selectedBlock.props.showDiscount !== false}
              onChange={(v) => patchProps({ showDiscount: v })}
            />
          </div>
        ) : null}

        {selectedBlock.type === 'paymentMethod' ? (
          <div className="grid gap-2">
            <Toggle label="Show bank" checked={selectedBlock.props.showBank} onChange={(v) => patchProps({ showBank: v })} />
            <Toggle label="Show date" checked={selectedBlock.props.showDate} onChange={(v) => patchProps({ showDate: v })} />
            <Toggle
              label="Show cheque no"
              checked={selectedBlock.props.showChequeNo}
              onChange={(v) => patchProps({ showChequeNo: v })}
            />
          </div>
        ) : null}

      </div>

      {template.docType === 'quotation' ? (
        <div className="text-xs text-slate-500">
          Quotation default uses header bar color <span className="font-mono">#26D6F0</span> (see Theme panel).
        </div>
      ) : null}
    </div>
  )
}


