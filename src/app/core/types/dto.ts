export type DocType =
  | 'quotation'
  | 'invoice'
  | 'receipt_full'
  | 'receipt_short'
  | 'trf_receipt'
  | 'sales_credit_note'
  | 'sales_debit_note'
  | 'purchase_credit_note'
  | 'purchase_debit_note'

export type Money = number

export type CompanyDTO = {
  name: string
  addressLines: string[]
  taxId?: string
  tel?: string
  fax?: string
  email?: string
  website?: string
  logoBase64?: string
}

export type PartnerDTO = {
  name: string
  addressLines?: string[]
  taxId?: string
  branch?: string
  tel?: string
}

export type DocumentMetaDTO = {
  number: string
  date: string // ISO date
  dueDate?: string
  quotationNo?: string
  invoiceRefTop?: string
  reference?: string
  salesperson?: string
  creditTerm?: string
  contact?: string
  project?: string
  journal?: string
  paymentMethod?: string
  bankReference?: string
  chequeNo?: string
  notes?: string
  linkedInvoices?: Array<{
    number: string
    reference?: string
    date?: string
    total?: Money
  }>
}

export type ItemLineDTO = {
  no: number
  productName?: string
  description: string
  qty: number
  unit?: string
  unitPrice: Money
  discount: Money
  amount: Money
}

export type TotalsDTO = {
  subtotal: Money
  discount: Money
  afterDiscount: Money
  vat?: Money
  whtAmount?: Money
  whtRate?: Money
  whtCode?: string
  total: Money
  amountText: string
  currency?: 'THB' | string
}

export type ReceiptPaymentDTO = {
  method: 'cash' | 'transfer' | 'cheque' | 'other'
  bank?: string
  chequeNo?: string
  transferAmount?: Money
  date?: string
}

export type TRFFixedRowsDTO = {
  transportation: Money
  gateChargeAdvanced: Money
  returnContainerAdvanced: Money
}

export type JournalItemDTO = {
  accountCode: string
  accountName: string
  label: string
  partnerName?: string
  debit: Money
  credit: Money
}

export type BaseDocumentDTO = {
  docType: DocType
  company: CompanyDTO
  partner: PartnerDTO
  document: DocumentMetaDTO
  items: ItemLineDTO[]
  totals: TotalsDTO
}

export type ReceiptDTO = BaseDocumentDTO & {
  docType: 'receipt_full' | 'receipt_short'
  payment: ReceiptPaymentDTO
}

export type QuotationDTO = BaseDocumentDTO & {
  docType: 'quotation'
}

export type InvoiceDTO = BaseDocumentDTO & {
  docType: 'invoice'
}

export type NoteDTO = BaseDocumentDTO & {
  docType:
    | 'sales_credit_note'
    | 'sales_debit_note'
    | 'purchase_credit_note'
    | 'purchase_debit_note'
}

export type TRFReceiptDTO = Omit<BaseDocumentDTO, 'items'> & {
  docType: 'trf_receipt'
  fixedRows: TRFFixedRowsDTO
  journalItems: JournalItemDTO[]
  payment?: ReceiptPaymentDTO
}

export type AnyDocumentDTO = QuotationDTO | InvoiceDTO | NoteDTO | ReceiptDTO | TRFReceiptDTO
