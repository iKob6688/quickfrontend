import { PageHeader } from '@/components/ui/PageHeader'
import { ExcelUploadCard } from './ExcelUploadCard'

export function ExcelImportPage() {
  return (
    <div>
      <PageHeader
        title="นำเข้าข้อมูลจาก Excel"
        subtitle="อัปโหลดไฟล์ .xlsx เพื่อสร้างลูกค้า สินค้า รายจ่าย หรือใบแจ้งหนี้ใน Odoo 18"
        breadcrumb="Tools · Excel Import"
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <ExcelUploadCard importType="invoices" />
        <ExcelUploadCard importType="customers" />
      </div>
    </div>
  )
}


