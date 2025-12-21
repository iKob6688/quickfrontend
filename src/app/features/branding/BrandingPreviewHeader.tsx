import type { Branding } from '@/app/core/types/branding'

export function BrandingPreviewHeader({ branding }: { branding: Branding }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          {branding.logoBase64 ? (
            <img src={branding.logoBase64} alt="Logo" className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">Logo</div>
          )}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-900">{branding.companyName || 'Company Name'}</div>
          <div className="mt-0.5 space-y-0.5 text-xs text-slate-600">
            {(branding.addressLines?.length ? branding.addressLines : ['Address line 1', 'Address line 2']).map((l, idx) => (
              <div key={idx} className="truncate">
                {l}
              </div>
            ))}
            <div className="truncate">
              {branding.tel ? `Tel: ${branding.tel}` : 'Tel: ...'}{' '}
              {branding.email ? `• ${branding.email}` : ''}
              {branding.website ? ` • ${branding.website}` : ''}
            </div>
            {branding.taxId ? <div className="truncate">Tax ID: {branding.taxId}</div> : null}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
        <span className="inline-block h-3 w-3 rounded-sm" style={{ background: branding.defaultPrimaryColor }} />
        Primary
        <span className="inline-block h-3 w-3 rounded-sm" style={{ background: branding.defaultAccentColor }} />
        Accent
        <span className="ml-auto" style={{ fontFamily: branding.defaultFont }}>
          Font Preview (ไทย/EN)
        </span>
      </div>
    </div>
  )
}


