import type { TemplateV1 } from '@/app/core/types/template'
import { Input } from '@/app/shell/ui/input'
import { Label } from '@/app/shell/ui/label'

export function ThemePanel({
  template,
  onPatchTheme,
}: {
  template: TemplateV1
  onPatchTheme: (patch: Partial<TemplateV1['theme']>) => void
}) {
  const t = template.theme
  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm font-semibold text-slate-900">Theme</div>
        <div className="text-xs text-slate-500">Only colors + font (safe for production).</div>
      </div>

      <div className="grid gap-3">
        <div className="grid gap-1">
          <Label>Primary color</Label>
          <div className="flex items-center gap-2">
            <Input
              type="color"
              className="h-9 w-14 p-1"
              value={t.primaryColor}
              onChange={(e) => onPatchTheme({ primaryColor: e.target.value })}
            />
            <Input value={t.primaryColor} onChange={(e) => onPatchTheme({ primaryColor: e.target.value })} />
          </div>
        </div>

        <div className="grid gap-1">
          <Label>Accent color</Label>
          <div className="flex items-center gap-2">
            <Input
              type="color"
              className="h-9 w-14 p-1"
              value={t.accentColor}
              onChange={(e) => onPatchTheme({ accentColor: e.target.value })}
            />
            <Input value={t.accentColor} onChange={(e) => onPatchTheme({ accentColor: e.target.value })} />
          </div>
        </div>

        <div className="grid gap-1">
          <Label>Quotation header bar color</Label>
          <div className="flex items-center gap-2">
            <Input
              type="color"
              className="h-9 w-14 p-1"
              value={t.headerBarColor}
              onChange={(e) => onPatchTheme({ headerBarColor: e.target.value })}
            />
            <Input value={t.headerBarColor} onChange={(e) => onPatchTheme({ headerBarColor: e.target.value })} />
          </div>
          {template.docType === 'quotation' ? (
            <div className="text-xs text-slate-500">
              Default quotation must be exactly <span className="font-mono">#26D6F0</span>.
            </div>
          ) : null}
        </div>

        <div className="grid gap-1">
          <Label>Table header background</Label>
          <div className="flex items-center gap-2">
            <Input
              type="color"
              className="h-9 w-14 p-1"
              value={t.tableHeaderBgColor}
              onChange={(e) => onPatchTheme({ tableHeaderBgColor: e.target.value })}
            />
            <Input
              value={t.tableHeaderBgColor}
              onChange={(e) => onPatchTheme({ tableHeaderBgColor: e.target.value })}
            />
          </div>
        </div>

        <div className="grid gap-1">
          <Label>Total bar background</Label>
          <div className="flex items-center gap-2">
            <Input
              type="color"
              className="h-9 w-14 p-1"
              value={t.totalsBarBgColor}
              onChange={(e) => onPatchTheme({ totalsBarBgColor: e.target.value })}
            />
            <Input value={t.totalsBarBgColor} onChange={(e) => onPatchTheme({ totalsBarBgColor: e.target.value })} />
          </div>
        </div>

        <div className="grid gap-1">
          <Label>Total bar text color</Label>
          <div className="flex items-center gap-2">
            <Input
              type="color"
              className="h-9 w-14 p-1"
              value={t.totalsBarTextColor}
              onChange={(e) => onPatchTheme({ totalsBarTextColor: e.target.value })}
            />
            <Input
              value={t.totalsBarTextColor}
              onChange={(e) => onPatchTheme({ totalsBarTextColor: e.target.value })}
            />
          </div>
        </div>

        <div className="grid gap-1">
          <Label>Font family</Label>
          <Input value={t.fontFamily} onChange={(e) => onPatchTheme({ fontFamily: e.target.value })} />
        </div>
      </div>
    </div>
  )
}


