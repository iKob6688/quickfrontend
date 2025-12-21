import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTemplateStore } from '@/app/core/storage/templateStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/shell/ui/card'
import { Button } from '@/app/shell/ui/button'

export function DashboardPage() {
  const navigate = useNavigate()
  const templates = useTemplateStore((s) => s.templates)
  const recent = useMemo(() => {
    return templates
      .slice()
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
      .slice(0, 4)
  }, [templates])

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-2xl font-semibold text-slate-900">Dashboard</div>
          <div className="text-sm text-slate-500">Pick a template, edit blocks, preview, then print/PDF.</div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate('/reports-studio/branding')}>
            Branding
          </Button>
          <Button onClick={() => navigate('/reports-studio/templates')}>Template Library</Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent templates</CardTitle>
            <CardDescription>Quick open your last edited templates.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              {recent.map((t) => (
                <Link
                  key={t.id}
                  to={`/reports-studio/editor/${t.id}`}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-900">{t.name}</div>
                      <div className="truncate text-xs text-slate-500">{t.docType}</div>
                    </div>
                    <div className="text-xs text-slate-500">{t.published ? 'Published' : 'Draft'}</div>
                  </div>
                </Link>
              ))}
              {!recent.length ? (
                <div className="text-sm text-slate-500">No templates yet (defaults will appear in Template Library).</div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Print checklist</CardTitle>
            <CardDescription>What “production-ready” means here.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
              <li>A4 preview matches print (margins/page breaks)</li>
              <li>Quotation header bar color is exactly #26D6F0</li>
              <li>Raw DTO JSON is visible in Debug panel</li>
              <li>Mobile friendly: Open PDF (new tab) + Quick Print</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


