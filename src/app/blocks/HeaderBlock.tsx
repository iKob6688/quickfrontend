import type { HeaderBlock } from '@/app/core/types/template'
import type { BlockViewContext } from './shared'

export function HeaderBlockView({ block, ctx }: { block: HeaderBlock; ctx: BlockViewContext }) {
  const { branding, dto, theme } = ctx
  const companyName = branding.companyName || dto.company.name
  const addressLines = branding.addressLines?.length ? branding.addressLines : dto.company.addressLines

  const showLogo = block.props.showLogo
  const logo = branding.logoBase64 || dto.company.logoBase64

  const showTaxId = block.props.showTaxId
  const showContact = block.props.showContactLines

  const isShort = dto.docType === 'receipt_short'
  const isReceiptLike = dto.docType === 'receipt_full' || dto.docType === 'receipt_short'

  const contactLine = [
    branding.tel || dto.company.tel ? `Tel: ${branding.tel || dto.company.tel}` : null,
    branding.fax || dto.company.fax ? `Fax: ${branding.fax || dto.company.fax}` : null,
    branding.email || dto.company.email ? `Email: ${branding.email || dto.company.email}` : null,
    branding.website || dto.company.website ? `Web: ${branding.website || dto.company.website}` : null,
  ]
    .filter(Boolean)
    .join('  •  ')

  // Receipt-style header (short tax invoice) — stacked lines like POS receipts.
  if (isShort) {
    const taxId = branding.taxId || dto.company.taxId
    const vatCode = dto.partner.branch || '-'
    const posNo = dto.document.number || '-'

    const compactAddress = addressLines.filter(Boolean).join(' ')
    const lineCompany = companyName
    const lineAddress = compactAddress

    // Keep it simple: display only what we can guarantee from DTO/branding.
    return (
      <div
        className="text-[12px] leading-tight text-slate-900"
        style={{ fontFamily: theme.fontFamily || branding.defaultFont }}
      >
        <div className="d-flex align-items-start gap-2">
          {showLogo && logo ? (
            <img
              src={logo}
              alt="Company logo"
              className="rounded border border-slate-200 bg-white"
              style={{ width: 40, height: 40, objectFit: 'contain' }}
            />
          ) : null}
          <div className="flex-grow-1">
            <div className="fw-semibold">{lineCompany}</div>
            {lineAddress ? <div className="text-slate-700">{lineAddress}</div> : null}

            {showTaxId && taxId ? (
              <div className="mt-1 fw-semibold">
                TAX#{taxId} <span className="fw-normal">(VAT Included)</span>
              </div>
            ) : null}

            {/* Use available fields: partner.branch -> Vat Code, document.number -> POS# */}
            <div className="fw-semibold">
              Vat Code {vatCode} <span className="fw-normal">POS#{posNo}</span>
            </div>

            {showContact && contactLine ? <div className="mt-1 text-slate-700">{contactLine}</div> : null}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="grid items-start gap-3"
      style={{
        fontFamily: theme.fontFamily || branding.defaultFont,
        gridTemplateColumns: showLogo && !isShort ? '72px 1fr 190px' : '1fr 190px',
      }}
    >
      {/* Logo */}
      {showLogo ? (
        <div className="pt-0.5">
          <div className="h-[64px] w-[64px] overflow-hidden rounded-md border border-slate-200 bg-white">
            {logo ? (
              <img src={logo} alt="Company logo" className="h-full w-full object-contain" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">Logo</div>
            )}
          </div>
        </div>
      ) : null}

      {/* Company info */}
      <div className={isShort ? 'text-left' : 'text-center'}>
        <div className="text-[13px] font-semibold tracking-tight text-slate-900">{companyName}</div>
        <div className="mt-1 space-y-0.5 text-[11px] leading-snug text-slate-700">
          {addressLines.map((l, idx) => (
            <div key={idx}>{l}</div>
          ))}
          {showContact && contactLine ? <div className="pt-0.5">{contactLine}</div> : null}
          {showTaxId && (branding.taxId || dto.company.taxId) ? (
            <div className="pt-0.5">Tax ID: {branding.taxId || dto.company.taxId}</div>
          ) : null}
        </div>
      </div>

      {/* Right meta box (skip for quotation; for short, stack below) */}
      {dto.docType === 'quotation' ? null : isReceiptLike ? (
        <div className="justify-self-end">
          <div
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-[11px]"
          >
            <div className="font-semibold text-slate-900">Receipt No.</div>
            <div className="mt-0.5 font-mono text-slate-900">{dto.document.number}</div>
            <div className="mt-1 text-slate-600">Date: {dto.document.date}</div>
          </div>
        </div>
      ) : null}
    </div>
  )
}


