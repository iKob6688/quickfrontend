import type { Branding } from '@/app/core/types/branding'
import type { AnyDocumentDTO } from '@/app/core/types/dto'
import type { TemplateV1 } from '@/app/core/types/template'

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white p-3 text-[11px] text-slate-800">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

export function DebugPanel({
  dto,
  template,
  branding,
}: {
  dto: AnyDocumentDTO | null
  template: TemplateV1
  branding: Branding
}) {
  return (
    <div className="rs-no-print mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-sm font-semibold text-slate-900">Verification / Debug</div>
      <div className="text-xs text-slate-500">Raw JSON used for the preview (DTO + Template + Branding).</div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <details className="rounded-lg border border-slate-200 bg-white p-3" open={false}>
          <summary className="cursor-pointer text-sm font-semibold text-slate-900">DTO JSON</summary>
          <div className="mt-2">{dto ? <JsonBlock value={dto} /> : <div className="text-sm text-slate-500">No DTO loaded</div>}</div>
        </details>

        <details className="rounded-lg border border-slate-200 bg-white p-3" open={false}>
          <summary className="cursor-pointer text-sm font-semibold text-slate-900">Template JSON</summary>
          <div className="mt-2">
            <JsonBlock value={template} />
          </div>
        </details>

        <details className="rounded-lg border border-slate-200 bg-white p-3" open={false}>
          <summary className="cursor-pointer text-sm font-semibold text-slate-900">Branding JSON</summary>
          <div className="mt-2">
            <JsonBlock value={branding} />
          </div>
        </details>
      </div>
    </div>
  )
}


