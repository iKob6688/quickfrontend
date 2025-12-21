import type { AnyDocumentDTO, DocType, ItemLineDTO, JournalItemDTO, Money } from '../types/dto'
import type { GetDocumentParams, OdooProvider } from './OdooProvider'

function thb(n: Money): Money {
  return Math.round(n * 100) / 100
}

function sampleCompany() {
  return {
    name: 'ERPTH Co., Ltd.',
    addressLines: ['123 ถนนสุขุมวิท', 'แขวง/เขต ...', 'กรุงเทพฯ 10110'],
    taxId: '0105559999999',
    tel: '02-000-0000',
    email: 'info@example.com',
    website: 'www.example.com',
  }
}

function samplePartnerFull() {
  return {
    name: 'SME MOVE (Thailand) Co., Ltd.',
    addressLines: ['88/8 ถนนสุขุมวิท', 'แขวง/เขต ...', 'กรุงเทพฯ 10200'],
    taxId: '0105551111111',
    branch: '00000',
    tel: '081-234-5678',
  }
}

function sampleItems(count: number): ItemLineDTO[] {
  return Array.from({ length: count }).map((_, i) => {
    const qty = i % 3 === 0 ? 1 : i % 3 === 1 ? 2 : 5
    const unitPrice = 1500 + i * 250
    const discount = i % 4 === 0 ? 100 : 0
    const amount = thb(qty * unitPrice - discount)
    return {
      no: i + 1,
      description: `Service / Product line item ${i + 1} — รายการ ${i + 1}`,
      qty,
      unit: 'EA',
      unitPrice: thb(unitPrice),
      discount: thb(discount),
      amount,
    }
  })
}

function calcTotals(items: ItemLineDTO[]) {
  const subtotal = thb(items.reduce((s, x) => s + x.qty * x.unitPrice, 0))
  const discount = thb(items.reduce((s, x) => s + x.discount, 0))
  const afterDiscount = thb(subtotal - discount)
  const vat = thb(afterDiscount * 0.07)
  const total = thb(afterDiscount + vat)
  return {
    subtotal,
    discount,
    afterDiscount,
    vat,
    total,
    amountText: 'หนึ่งหมื่นสองพันสามร้อยสี่สิบห้าบาทถ้วน',
    currency: 'THB',
  }
}

function journalItems(): JournalItemDTO[] {
  return [
    { accountCode: '110100', accountName: 'Cash', label: 'Cash received', debit: 5000, credit: 0 },
    { accountCode: '410000', accountName: 'Service Revenue', label: 'Transportation', debit: 0, credit: 3000 },
    { accountCode: '410100', accountName: 'Gate Charge', label: 'Gate Charge (Advanced)', debit: 0, credit: 1200 },
    { accountCode: '410200', accountName: 'Return Container', label: 'Return Container (Advanced)', debit: 0, credit: 800 },
  ]
}

export class MockOdooProvider implements OdooProvider {
  async getDocumentDTO(params: GetDocumentParams): Promise<AnyDocumentDTO> {
    // recordId is kept to support UX flows; mock returns deterministic sample.
    const { docType } = params
    switch (docType) {
      case 'quotation': {
        const items = sampleItems(8)
        const totals = calcTotals(items)
        return {
          docType,
          company: sampleCompany(),
          partner: samplePartnerFull(),
          document: {
            number: 'QT-2025-0001',
            date: '2025-12-20',
            reference: 'RFQ-7788',
            salesperson: 'Somchai',
            creditTerm: '30 Days',
            contact: 'Kob',
            project: 'SME MOVE - Relocation',
          },
          items,
          totals,
        }
      }
      case 'receipt_full': {
        const items = sampleItems(5)
        const totals = calcTotals(items)
        return {
          docType,
          company: sampleCompany(),
          partner: samplePartnerFull(),
          document: {
            number: 'RC-2025-0100',
            date: '2025-12-20',
            reference: 'INV-2025-0550',
          },
          items,
          totals,
          payment: {
            method: 'transfer',
            bank: 'Bangkok Bank',
            transferAmount: totals.total,
            date: '2025-12-20',
          },
        }
      }
      case 'receipt_short': {
        const items = sampleItems(3)
        const totals = calcTotals(items)
        return {
          docType,
          company: sampleCompany(),
          partner: { name: 'Walk-in Customer', tel: '08x-xxx-xxxx' },
          document: { number: 'RC-2025-0101', date: '2025-12-20' },
          items,
          totals: { ...totals, vat: undefined },
          payment: { method: 'cash', date: '2025-12-20' },
        }
      }
      case 'trf_receipt': {
        const fixedRows = {
          transportation: 3000,
          gateChargeAdvanced: 1200,
          returnContainerAdvanced: 800,
        }
        const total = thb(fixedRows.transportation + fixedRows.gateChargeAdvanced + fixedRows.returnContainerAdvanced)
        return {
          docType,
          company: sampleCompany(),
          partner: samplePartnerFull(),
          document: { number: 'RC-2025-TR-0009', date: '2025-12-20', reference: 'JOB-TR-7788' },
          fixedRows,
          journalItems: journalItems(),
          payment: { method: 'cheque', bank: 'KBank', chequeNo: '123456', date: '2025-12-20' },
          totals: {
            subtotal: total,
            discount: 0,
            afterDiscount: total,
            vat: undefined,
            total,
            amountText: 'ห้าพันบาทถ้วน',
            currency: 'THB',
          },
        }
      }
      default:
        throw new Error(`Unsupported docType: ${docType as DocType}`)
    }
  }
}


