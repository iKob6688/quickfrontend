import type { CSSProperties } from 'react'
import type { AnyDocumentDTO } from '@/app/core/types/dto'
import type { Branding } from '@/app/core/types/branding'
import type { AnyBlock, TemplateTheme } from '@/app/core/types/template'
import {
  AmountInWordsBlockView,
  CustomerInfoBlockView,
  DocMetaBlockView,
  HeaderBlockView,
  ItemsTableBlockView,
  JournalItemsBlockView,
  NotesBlockView,
  PaymentMethodBlockView,
  SignatureBlockView,
  StampBlockView,
  SummaryTotalsBlockView,
  TitleBlockView,
} from '@/app/blocks'

export type BlockRenderProps = {
  block: AnyBlock
  branding: Branding
  dto: AnyDocumentDTO
  theme: TemplateTheme
}

export function blockDisplayName(type: AnyBlock['type']): string {
  switch (type) {
    case 'header':
      return 'Header'
    case 'title':
      return 'Title'
    case 'customerInfo':
      return 'Customer Info'
    case 'docMeta':
      return 'Doc Meta'
    case 'itemsTable':
      return 'Items Table'
    case 'summaryTotals':
      return 'Summary Totals'
    case 'amountInWords':
      return 'Amount in Words'
    case 'notes':
      return 'Notes'
    case 'signature':
      return 'Signature'
    case 'stamp':
      return 'Stamp'
    case 'paymentMethod':
      return 'Payment Method'
    case 'journalItems':
      return 'Journal Items'
    default:
      return type
  }
}

export function RenderBlock({ block, branding, dto, theme }: BlockRenderProps) {
  const ctx = { branding, dto, theme }

  const style = block.style || {}
  const border = style.border
  const frameStyle: CSSProperties = {
    padding: typeof style.paddingPx === 'number' ? style.paddingPx : undefined,
    margin: typeof style.marginPx === 'number' ? style.marginPx : undefined,
    backgroundColor: style.backgroundColor || undefined,
    border: border?.enabled ? `${border.widthPx ?? 1}px solid ${border.color ?? '#CBD5E1'}` : undefined,
    borderRadius: typeof style.borderRadiusPx === 'number' ? style.borderRadiusPx : undefined,
    color: style.textColor || undefined,
    textAlign: style.textAlign || undefined,
    fontFamily: style.fontFamily || theme.fontFamily || branding.defaultFont,
    fontSize: typeof style.fontSizePx === 'number' ? style.fontSizePx : undefined,
    fontWeight: style.fontWeight || undefined,
  }

  const content = (() => {
  switch (block.type) {
    case 'header':
      return <HeaderBlockView block={block} ctx={ctx} />
    case 'title':
      return <TitleBlockView block={block} ctx={ctx} />
    case 'customerInfo':
      return <CustomerInfoBlockView block={block} ctx={ctx} />
    case 'docMeta':
      return <DocMetaBlockView block={block} ctx={ctx} />
    case 'itemsTable':
      return <ItemsTableBlockView block={block} ctx={ctx} />
    case 'summaryTotals':
      return <SummaryTotalsBlockView block={block} ctx={ctx} />
    case 'amountInWords':
      return <AmountInWordsBlockView block={block} ctx={ctx} />
    case 'paymentMethod':
      return <PaymentMethodBlockView block={block} ctx={ctx} />
    case 'journalItems':
      return <JournalItemsBlockView block={block} ctx={ctx} />
    case 'signature':
      return <SignatureBlockView block={block} ctx={ctx} />
    case 'notes':
      return <NotesBlockView block={block} ctx={ctx} />
    case 'stamp':
      return <StampBlockView block={block} ctx={ctx} />
    default:
      return null
  }
  })()

  // Frame is intentionally safe: user can tweak spacing + colors + typography without breaking layout rules.
  return <div style={frameStyle}>{content}</div>
}


