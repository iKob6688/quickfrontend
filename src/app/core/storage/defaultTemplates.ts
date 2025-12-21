import { nanoid } from 'nanoid'
import type { TemplateV1 } from '../types/template'
import { templateV1Schema } from '../schema/templateV1'
import { defaultBranding } from '../schema/brandingSchema'

const basePage: TemplateV1['page'] = {
  size: 'A4',
  marginMm: 10,
  gridPx: 8,
  canvasPx: { width: 794, height: 1123 },
}

const baseTheme: TemplateV1['theme'] = {
  primaryColor: '#26D6F0',
  accentColor: '#0B6EA6',
  headerBarColor: '#26D6F0',
  tableHeaderBgColor: '#26D6F0',
  totalsBarBgColor: '#111111',
  totalsBarTextColor: '#ffffff',
  fontFamily: defaultBranding.defaultFont,
}

function mkDefaultTemplate(partial: Omit<TemplateV1, 'schemaVersion' | 'updatedAt' | 'published' | 'isDefault'>) {
  return templateV1Schema.parse({
    schemaVersion: 1,
    published: true,
    isDefault: true,
    updatedAt: new Date(0).toISOString(),
    ...partial,
  })
}

export const DEFAULT_TEMPLATES: TemplateV1[] = [
  mkDefaultTemplate({
    id: 'quotation_default_v1',
    name: 'Quotation (Default v1)',
    docType: 'quotation',
    // Requirement: quotation header bar MUST be exactly #26D6F0
    // Keep table header dark to match provided sample table styling.
    theme: { ...baseTheme, headerBarColor: '#26D6F0', tableHeaderBgColor: '#111111' },
    page: basePage,
    blocks: [
      {
        id: nanoid(),
        type: 'header',
        props: { showLogo: true, showTaxId: true, showContactLines: true },
      },
      {
        id: nanoid(),
        type: 'title',
        props: {
          titleEn: 'QUOTATION',
          titleTh: 'ใบเสนอราคา',
          subtitleRight: 'ต้นฉบับ / Original',
          showOriginalBadge: true,
        },
      },
      {
        id: nanoid(),
        type: 'customerInfo',
        props: { showAddress: true, showTaxId: true, showTel: false, label: 'Customer / ลูกค้า' },
      },
      {
        id: nanoid(),
        type: 'docMeta',
        props: { fields: ['number', 'date', 'salesperson', 'creditTerm', 'contact', 'project', 'reference'] },
      },
      {
        id: nanoid(),
        type: 'itemsTable',
        props: { compact: false, showUnit: true, showDiscount: true, currency: 'THB' },
      },
      {
        id: nanoid(),
        type: 'summaryTotals',
        props: { showVat: true, showDiscount: true },
      },
      {
        id: nanoid(),
        type: 'amountInWords',
        props: { label: 'จำนวนเงิน (ตัวอักษร) / Amount' },
      },
      {
        id: nanoid(),
        type: 'signature',
        props: { leftLabel: 'ผู้รับ / Customer Signature', rightLabel: 'ผู้มีอำนาจลงนาม / Authorized Signature' },
      },
    ],
  }),

  mkDefaultTemplate({
    id: 'receipt_full_default_v1',
    name: 'Tax Invoice (Full) (Default v1)',
    docType: 'receipt_full',
    theme: { ...baseTheme, headerBarColor: '#111111', tableHeaderBgColor: '#111111' },
    page: basePage,
    blocks: [
      { id: nanoid(), type: 'header', props: { showLogo: true, showTaxId: true, showContactLines: true } },
      {
        id: nanoid(),
        type: 'title',
        props: { titleEn: 'TAX INVOICE', titleTh: 'ใบกำกับภาษี', subtitleRight: undefined, showOriginalBadge: false },
      },
      { id: nanoid(), type: 'customerInfo', props: { showAddress: true, showTaxId: true, showTel: true, label: 'Customer / ลูกค้า' } },
      { id: nanoid(), type: 'docMeta', props: { fields: ['number', 'date', 'reference'] } },
      { id: nanoid(), type: 'itemsTable', props: { compact: false, showUnit: true, showDiscount: false, currency: 'THB' } },
      { id: nanoid(), type: 'summaryTotals', props: { showVat: true, showDiscount: true } },
      { id: nanoid(), type: 'amountInWords', props: { label: 'จำนวนเงิน (ตัวอักษร) / Amount' } },
      { id: nanoid(), type: 'paymentMethod', props: { style: 'checkboxes', showBank: true, showDate: true, showChequeNo: true } },
      { id: nanoid(), type: 'signature', props: { leftLabel: 'ผู้รับ / Receiver', rightLabel: 'ผู้มีอำนาจลงนาม / Authorized' } },
    ],
  }),

  mkDefaultTemplate({
    id: 'receipt_short_default_v1',
    name: 'Tax Invoice (Short) (Default v1)',
    docType: 'receipt_short',
    theme: {
      ...baseTheme,
      headerBarColor: '#111111',
      tableHeaderBgColor: '#111111',
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace',
    },
    page: basePage,
    blocks: [
      { id: nanoid(), type: 'header', props: { showLogo: false, showTaxId: false, showContactLines: true } },
      { id: nanoid(), type: 'title', props: { titleEn: 'TAX INVOICE', titleTh: 'ใบกำกับภาษีอย่างย่อ', showOriginalBadge: false } },
      { id: nanoid(), type: 'docMeta', props: { fields: ['number', 'date'] } },
      { id: nanoid(), type: 'itemsTable', props: { compact: true, showUnit: false, showDiscount: false, currency: 'THB' } },
      { id: nanoid(), type: 'summaryTotals', props: { showVat: false, showDiscount: false } },
    ],
  }),

  mkDefaultTemplate({
    id: 'trf_receipt_default_v1',
    name: 'Receipt (Transport) (Default v1)',
    docType: 'trf_receipt',
    theme: { ...baseTheme },
    page: basePage,
    blocks: [
      { id: nanoid(), type: 'header', props: { showLogo: true, showTaxId: true, showContactLines: true } },
      { id: nanoid(), type: 'title', props: { titleEn: 'RECEIPT', titleTh: 'ใบเสร็จรับเงิน', showOriginalBadge: false } },
      { id: nanoid(), type: 'docMeta', props: { fields: ['number', 'date', 'reference'] } },
      // Fixed rows rendered via itemsTable when dto.docType === 'trf_receipt'
      { id: nanoid(), type: 'itemsTable', props: { compact: false, showUnit: false, showDiscount: false, currency: 'THB' } },
      { id: nanoid(), type: 'amountInWords', props: { label: 'BAHT in words / จำนวนเงิน (ตัวอักษร)' } },
      { id: nanoid(), type: 'paymentMethod', props: { style: 'checkboxes', showBank: true, showDate: true, showChequeNo: true } },
      { id: nanoid(), type: 'journalItems', props: { title: 'Journal Items' } },
      { id: nanoid(), type: 'signature', props: { leftLabel: 'Payer', rightLabel: 'Authorized' } },
    ],
  }),
]


