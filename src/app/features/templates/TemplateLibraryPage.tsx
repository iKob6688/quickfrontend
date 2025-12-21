import { useMemo } from 'react'
import { useTemplateStore } from '@/app/core/storage/templateStore'
import { DEFAULT_TEMPLATES } from '@/app/core/storage/defaultTemplates'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/shell/ui/card'
import { Button } from '@/app/shell/ui/button'
import { TemplateCard } from './TemplateCard'

export function TemplateLibraryPage() {
  const templates = useTemplateStore((s) => s.templates)
  const ensureDefaults = useTemplateStore((s) => s.ensureDefaults)

  const defaults = useMemo(() => templates.filter((t) => t.isDefault), [templates])
  const customs = useMemo(() => templates.filter((t) => !t.isDefault), [templates])

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div>
        <div className="d-flex flex-wrap align-items-end justify-content-between gap-2">
          <div>
            <div className="text-2xl font-semibold text-slate-900">Template Library</div>
            <div className="text-sm text-slate-500">
              Defaults are read-only originals. Create a custom copy to edit safely.
            </div>
          </div>
          <div className="rs-no-print">
            <Button
              variant="secondary"
              onClick={() => ensureDefaults(DEFAULT_TEMPLATES)}
              title="Update local default templates to the latest shipped versions"
            >
              Refresh defaults
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        <section>
          <div className="mb-3 text-sm font-semibold text-slate-900">Default templates</div>
          <div className="grid gap-4 md:grid-cols-2">
            {defaults.map((t) => (
              <TemplateCard key={t.id} tpl={t} />
            ))}
          </div>
        </section>

        <section>
          <div className="mb-3 text-sm font-semibold text-slate-900">Your templates</div>
          {customs.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {customs.map((t) => (
                <TemplateCard key={t.id} tpl={t} />
              ))}
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>No custom templates yet</CardTitle>
                <CardDescription>Create one from a default above.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-slate-600">
                  Start with <span className="font-medium">Quotation (Default v1)</span> to get the SME-style layout with the required{' '}
                  <span className="font-mono">#26D6F0</span> header bar.
                </div>
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </div>
  )
}


