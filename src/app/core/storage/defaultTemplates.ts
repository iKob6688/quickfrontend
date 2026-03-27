import { nanoid } from 'nanoid'
import type { TemplateV1 } from '../types/template'
import { templateV1Schema } from '../schema/templateV1'
import { defaultBranding } from '../schema/brandingSchema'

const basePage: TemplateV1['page'] = {
  mode: 'A4',
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
    id: 'invoice_default_v1',
    name: 'Invoice (Default v1)',
    docType: 'invoice',
    theme: { ...baseTheme, headerBarColor: '#111111', tableHeaderBgColor: '#111111' },
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
          titleEn: 'INVOICE',
          titleTh: 'ใบแจ้งหนี้',
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
        props: { fields: ['number', 'date', 'quotationNo', 'invoiceRefTop', 'salesperson', 'creditTerm', 'contact', 'reference'] },
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
    id: 'invoice_tax_invoice_default_v1',
    name: 'Tax Invoice - ใบแจ้งหนี้ / ใบกำกับภาษี',
    docType: 'invoice',
    theme: { ...baseTheme, headerBarColor: '#111111', tableHeaderBgColor: '#111111' },
    page: basePage,
    blocks: [
      { id: nanoid(), type: 'header', props: { showLogo: true, showTaxId: true, showContactLines: true } },
      {
        id: nanoid(),
        type: 'title',
        props: {
          titleEn: 'TAX INVOICE',
          titleTh: 'ใบแจ้งหนี้ / ใบกำกับภาษี',
          subtitleRight: 'ต้นฉบับ / Original',
          showOriginalBadge: true,
        },
      },
      { id: nanoid(), type: 'customerInfo', props: { showAddress: true, showTaxId: true, showTel: false, label: 'Customer / ลูกค้า' } },
      { id: nanoid(), type: 'docMeta', props: { fields: ['number', 'date', 'quotationNo', 'invoiceRefTop', 'salesperson', 'creditTerm', 'contact', 'reference'] } },
      { id: nanoid(), type: 'itemsTable', props: { compact: false, showUnit: true, showDiscount: true, currency: 'THB' } },
      { id: nanoid(), type: 'summaryTotals', props: { showVat: true, showDiscount: true } },
      { id: nanoid(), type: 'amountInWords', props: { label: 'จำนวนเงิน (ตัวอักษร) / Amount' } },
      { id: nanoid(), type: 'signature', props: { leftLabel: 'ผู้รับ / Customer Signature', rightLabel: 'ผู้มีอำนาจลงนาม / Authorized Signature' } },
    ],
  }),

  mkDefaultTemplate({
    id: 'sales_credit_note_default_v1',
    name: 'Sales Credit Note (Default v1)',
    docType: 'sales_credit_note',
    theme: { ...baseTheme, headerBarColor: '#111111', tableHeaderBgColor: '#111111' },
    page: basePage,
    blocks: [
      { id: nanoid(), type: 'header', props: { showLogo: true, showTaxId: true, showContactLines: true } },
      {
        id: nanoid(),
        type: 'title',
        props: { titleEn: 'CREDIT NOTE', titleTh: 'ใบลดหนี้', subtitleRight: 'ต้นฉบับ / Original', showOriginalBadge: true },
      },
      { id: nanoid(), type: 'customerInfo', props: { showAddress: true, showTaxId: true, showTel: false, label: 'Customer / ลูกค้า' } },
      { id: nanoid(), type: 'docMeta', props: { fields: ['number', 'date', 'reference', 'salesperson', 'creditTerm', 'contact'] } },
      { id: nanoid(), type: 'itemsTable', props: { compact: false, showUnit: true, showDiscount: true, currency: 'THB' } },
      { id: nanoid(), type: 'summaryTotals', props: { showVat: true, showDiscount: true } },
      { id: nanoid(), type: 'amountInWords', props: { label: 'จำนวนเงิน (ตัวอักษร) / Amount' } },
      { id: nanoid(), type: 'signature', props: { leftLabel: 'ผู้รับ / Customer Signature', rightLabel: 'ผู้มีอำนาจลงนาม / Authorized Signature' } },
    ],
  }),

  mkDefaultTemplate({
    id: 'sales_debit_note_default_v1',
    name: 'Sales Debit Note (Default v1)',
    docType: 'sales_debit_note',
    theme: { ...baseTheme, headerBarColor: '#111111', tableHeaderBgColor: '#111111' },
    page: basePage,
    blocks: [
      { id: nanoid(), type: 'header', props: { showLogo: true, showTaxId: true, showContactLines: true } },
      {
        id: nanoid(),
        type: 'title',
        props: { titleEn: 'DEBIT NOTE', titleTh: 'ใบเพิ่มหนี้', subtitleRight: 'ต้นฉบับ / Original', showOriginalBadge: true },
      },
      { id: nanoid(), type: 'customerInfo', props: { showAddress: true, showTaxId: true, showTel: false, label: 'Customer / ลูกค้า' } },
      { id: nanoid(), type: 'docMeta', props: { fields: ['number', 'date', 'reference', 'salesperson', 'creditTerm', 'contact'] } },
      { id: nanoid(), type: 'itemsTable', props: { compact: false, showUnit: true, showDiscount: true, currency: 'THB' } },
      { id: nanoid(), type: 'summaryTotals', props: { showVat: true, showDiscount: true } },
      { id: nanoid(), type: 'amountInWords', props: { label: 'จำนวนเงิน (ตัวอักษร) / Amount' } },
      { id: nanoid(), type: 'signature', props: { leftLabel: 'ผู้รับ / Customer Signature', rightLabel: 'ผู้มีอำนาจลงนาม / Authorized Signature' } },
    ],
  }),

  mkDefaultTemplate({
    id: 'purchase_credit_note_default_v1',
    name: 'Purchase Credit Note (Default v1)',
    docType: 'purchase_credit_note',
    theme: { ...baseTheme, headerBarColor: '#111111', tableHeaderBgColor: '#111111' },
    page: basePage,
    blocks: [
      { id: nanoid(), type: 'header', props: { showLogo: true, showTaxId: true, showContactLines: true } },
      {
        id: nanoid(),
        type: 'title',
        props: { titleEn: 'PURCHASE CREDIT NOTE', titleTh: 'ใบลดหนี้ซื้อ', subtitleRight: 'ต้นฉบับ / Original', showOriginalBadge: true },
      },
      { id: nanoid(), type: 'customerInfo', props: { showAddress: true, showTaxId: true, showTel: false, label: 'Vendor / ผู้ขาย' } },
      { id: nanoid(), type: 'docMeta', props: { fields: ['number', 'date', 'reference', 'contact'] } },
      { id: nanoid(), type: 'itemsTable', props: { compact: false, showUnit: true, showDiscount: true, currency: 'THB' } },
      { id: nanoid(), type: 'summaryTotals', props: { showVat: true, showDiscount: true } },
      { id: nanoid(), type: 'amountInWords', props: { label: 'จำนวนเงิน (ตัวอักษร) / Amount' } },
      { id: nanoid(), type: 'signature', props: { leftLabel: 'ผู้รับ / Receiver', rightLabel: 'ผู้มีอำนาจลงนาม / Authorized' } },
    ],
  }),

  mkDefaultTemplate({
    id: 'purchase_debit_note_default_v1',
    name: 'Purchase Debit Note (Default v1)',
    docType: 'purchase_debit_note',
    theme: { ...baseTheme, headerBarColor: '#111111', tableHeaderBgColor: '#111111' },
    page: basePage,
    blocks: [
      { id: nanoid(), type: 'header', props: { showLogo: true, showTaxId: true, showContactLines: true } },
      {
        id: nanoid(),
        type: 'title',
        props: { titleEn: 'PURCHASE DEBIT NOTE', titleTh: 'ใบเพิ่มหนี้ซื้อ', subtitleRight: 'ต้นฉบับ / Original', showOriginalBadge: true },
      },
      { id: nanoid(), type: 'customerInfo', props: { showAddress: true, showTaxId: true, showTel: false, label: 'Vendor / ผู้ขาย' } },
      { id: nanoid(), type: 'docMeta', props: { fields: ['number', 'date', 'reference', 'contact'] } },
      { id: nanoid(), type: 'itemsTable', props: { compact: false, showUnit: true, showDiscount: true, currency: 'THB' } },
      { id: nanoid(), type: 'summaryTotals', props: { showVat: true, showDiscount: true } },
      { id: nanoid(), type: 'amountInWords', props: { label: 'จำนวนเงิน (ตัวอักษร) / Amount' } },
      { id: nanoid(), type: 'signature', props: { leftLabel: 'ผู้รับ / Receiver', rightLabel: 'ผู้มีอำนาจลงนาม / Authorized' } },
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
      { id: nanoid(), type: 'docMeta', props: { fields: ['number', 'date', 'invoiceRefTop', 'quotationNo', 'reference'] } },
      { id: nanoid(), type: 'itemsTable', props: { compact: false, showUnit: true, showDiscount: false, currency: 'THB' } },
      { id: nanoid(), type: 'summaryTotals', props: { showVat: true, showDiscount: true } },
      { id: nanoid(), type: 'amountInWords', props: { label: 'จำนวนเงิน (ตัวอักษร) / Amount' } },
      { id: nanoid(), type: 'paymentMethod', props: { style: 'checkboxes', showBank: true, showDate: true, showChequeNo: true } },
      { id: nanoid(), type: 'signature', props: { leftLabel: 'ผู้รับ / Receiver', rightLabel: 'ผู้มีอำนาจลงนาม / Authorized' } },
    ],
  }),


  mkDefaultTemplate({
    id: 'receipt_tax_invoice_default_v1',
    name: 'Receipt/Tax Invoice - ใบเสร็จรับเงิน / ใบกำกับภาษี',
    docType: 'receipt_full',
    theme: { ...baseTheme, headerBarColor: '#111111', tableHeaderBgColor: '#111111' },
    page: basePage,
    blocks: [
      { id: nanoid(), type: 'header', props: { showLogo: true, showTaxId: true, showContactLines: true } },
      {
        id: nanoid(),
        type: 'title',
        props: {
          titleEn: 'RECEIPT / TAX INVOICE',
          titleTh: 'ใบเสร็จรับเงิน / ใบกำกับภาษี',
          subtitleRight: undefined,
          showOriginalBadge: false,
        },
      },
      { id: nanoid(), type: 'customerInfo', props: { showAddress: true, showTaxId: true, showTel: true, label: 'Customer / ลูกค้า' } },
      { id: nanoid(), type: 'docMeta', props: { fields: ['number', 'date', 'invoiceRefTop', 'quotationNo', 'reference'] } },
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
    page: { ...basePage, mode: 'THERMAL', thermalMm: { widthMm: 80, marginMm: 3 } },
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
