import type { DocType } from './dto'

export type TemplateSchemaVersion = 1

export type TemplateTheme = {
  primaryColor: string
  accentColor: string
  headerBarColor: string
  tableHeaderBgColor: string
  totalsBarBgColor: string
  totalsBarTextColor: string
  fontFamily: string
}

export type TemplatePage = {
  size: 'A4'
  marginMm: number
  gridPx: number
  canvasPx: { width: number; height: number }
}

export type BlockCommonStyle = {
  paddingPx: number
  marginPx: number
  border: { enabled: boolean; widthPx: number; color: string }
  backgroundColor?: string
  textColor?: string
  textAlign?: 'left' | 'center' | 'right'
  fontFamily?: string
  fontSizePx?: number
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold'
  borderRadiusPx?: number
}

export type BlockBase<TType extends string, TProps> = {
  id: string
  type: TType
  locked?: boolean
  style?: Partial<BlockCommonStyle>
  visibility?: Record<string, boolean>
  props: TProps
}

export type HeaderBlock = BlockBase<
  'header',
  {
    showLogo: boolean
    showTaxId: boolean
    showContactLines: boolean
  }
>

export type TitleBlock = BlockBase<
  'title',
  {
    titleEn: string
    titleTh?: string
    subtitleRight?: string
    showOriginalBadge?: boolean
  }
>

export type CustomerInfoBlock = BlockBase<
  'customerInfo',
  {
    showAddress: boolean
    showTaxId: boolean
    showTel: boolean
    label?: string
  }
>

export type DocMetaBlock = BlockBase<
  'docMeta',
  {
    fields: Array<
      | 'number'
      | 'date'
      | 'reference'
      | 'salesperson'
      | 'creditTerm'
      | 'contact'
      | 'project'
    >
  }
>

export type ItemsTableBlock = BlockBase<
  'itemsTable',
  {
    compact?: boolean
    showUnit?: boolean
    showDiscount?: boolean
    currency?: string
  }
>

export type SummaryTotalsBlock = BlockBase<
  'summaryTotals',
  {
    showVat?: boolean
    showDiscount?: boolean
  }
>

export type AmountInWordsBlock = BlockBase<
  'amountInWords',
  {
    label?: string
  }
>

export type NotesBlock = BlockBase<
  'notes',
  {
    text: string
  }
>

export type SignatureBlock = BlockBase<
  'signature',
  {
    leftLabel: string
    rightLabel: string
    bottomBarEnabled?: boolean
    bottomBarColor?: string
    bottomBarHeightPx?: number
  }
>

export type StampBlock = BlockBase<
  'stamp',
  {
    enabled: boolean
    label?: string
  }
>

export type PaymentMethodBlock = BlockBase<
  'paymentMethod',
  {
    style: 'checkboxes' | 'simple'
    showBank: boolean
    showDate: boolean
    showChequeNo: boolean
  }
>

export type JournalItemsBlock = BlockBase<
  'journalItems',
  {
    title?: string
  }
>

export type AnyBlock =
  | HeaderBlock
  | TitleBlock
  | CustomerInfoBlock
  | DocMetaBlock
  | ItemsTableBlock
  | SummaryTotalsBlock
  | AmountInWordsBlock
  | NotesBlock
  | SignatureBlock
  | StampBlock
  | PaymentMethodBlock
  | JournalItemsBlock

export type TemplateV1 = {
  schemaVersion: TemplateSchemaVersion
  id: string
  name: string
  docType: DocType
  published: boolean
  isDefault?: boolean
  theme: TemplateTheme
  page: TemplatePage
  blocks: AnyBlock[]
  updatedAt: string
}


