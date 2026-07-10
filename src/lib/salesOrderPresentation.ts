import type { SalesOrder, SalesOrderType } from '@/api/services/sales-orders.service'

export function getSalesOrderCustomerDisplayName(
  order: Pick<SalesOrder, 'customerNameText' | 'partnerName'> | null | undefined,
) {
  return order?.customerNameText || order?.partnerName || 'ไม่ระบุลูกค้า'
}

export function getSalesOrderCustomerContactText(
  order:
    | Pick<SalesOrder, 'customerPhoneText' | 'customerEmailText' | 'customerTaxIdText' | 'customerBranchText'>
    | null
    | undefined,
) {
  return [order?.customerPhoneText, order?.customerEmailText, order?.customerTaxIdText, order?.customerBranchText]
    .filter(Boolean)
    .join(' · ')
}

export function getSalesOrderDocumentLabel(orderType?: SalesOrderType) {
  return orderType === 'sale' ? 'Sale Order' : 'ใบเสนอราคา'
}

export function getSalesOrderDocumentTitle(orderType: SalesOrderType, isEdit: boolean) {
  const label = getSalesOrderDocumentLabel(orderType)
  const prefix = isEdit ? 'แก้ไข' : 'สร้าง'
  return label === 'Sale Order' ? `${prefix} ${label}` : `${prefix}${label}`
}
