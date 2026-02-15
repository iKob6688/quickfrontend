import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { toast } from '@/lib/toastStore'

type ReportCard = {
  title: string
  subtitle: string
  icon: string
  tone: 'blue' | 'green' | 'amber' | 'purple' | 'pink' | 'slate'
  path?: string
  ready?: boolean // true = มี implementation แล้ว, false = ยังไม่เสร็จ
}

const cards: ReportCard[] = [
  {
    title: 'งบกำไรขาดทุน (Profit & Loss)',
    subtitle: 'รายได้ · ค่าใช้จ่าย · กำไร — เลือกช่วงเวลา/เปรียบเทียบได้',
    icon: 'bi-graph-up-arrow',
    tone: 'blue',
    path: '/accounting/reports/profit-loss',
    ready: true,
  },
  {
    title: 'งบดุล (Balance Sheet)',
    subtitle: 'สินทรัพย์ · หนี้สิน · ส่วนของผู้ถือหุ้น',
    icon: 'bi-bank',
    tone: 'green',
    path: '/accounting/reports/balance-sheet',
    ready: true,
  },
  {
    title: 'สมุดบัญชีแยกประเภท (General Ledger)',
    subtitle: 'ดูรายการเดินบัญชีแยกตามบัญชี พร้อม drilldown',
    icon: 'bi-journal-text',
    tone: 'slate',
    path: '/accounting/reports/general-ledger',
    ready: true,
  },
  {
    title: 'งบทดลอง (Trial Balance)',
    subtitle: 'ยอดเดบิต/เครดิตและคงเหลือตามบัญชี',
    icon: 'bi-clipboard-data',
    tone: 'purple',
    path: '/accounting/reports/trial-balance',
    ready: true,
  },
  {
    title: 'ลูกหนี้/เจ้าหนี้ (Partner Ledger)',
    subtitle: 'แยกตามคู่ค้า พร้อมยอดรวม/คงค้าง',
    icon: 'bi-people',
    tone: 'amber',
    path: '/accounting/reports/partner-ledger',
    ready: true,
  },
  {
    title: 'อายุลูกหนี้ (Aged Receivables)',
    subtitle: 'not due / 0-30 / 31-60 / 61-90 / 91+',
    icon: 'bi-hourglass-split',
    tone: 'pink',
    path: '/accounting/reports/aged-receivables',
    ready: true,
  },
  {
    title: 'อายุเจ้าหนี้ (Aged Payables)',
    subtitle: 'วิเคราะห์หนี้คงค้างตามอายุ',
    icon: 'bi-hourglass',
    tone: 'pink',
    path: '/accounting/reports/aged-payables',
    ready: true,
  },
  {
    title: 'สมุดเงินสด (Cash Book)',
    subtitle: 'เคลื่อนไหวบัญชีเงินสดตามช่วงเวลา',
    icon: 'bi-cash',
    tone: 'green',
    path: '/accounting/reports/cash-book',
    ready: true,
  },
  {
    title: 'สมุดเงินฝากธนาคาร (Bank Book)',
    subtitle: 'เคลื่อนไหวบัญชีธนาคารตามช่วงเวลา',
    icon: 'bi-credit-card-2-front',
    tone: 'green',
    path: '/accounting/reports/bank-book',
    ready: true,
  },
  {
    title: 'รายงาน VAT',
    subtitle: 'ภาษีขาย/ภาษีซื้อ พร้อมสรุปยอด',
    icon: 'bi-receipt-cutoff',
    tone: 'blue',
    path: '/accounting/reports/vat',
    ready: true,
  },
  {
    title: 'รายงานภาษีหัก ณ ที่จ่าย (WHT)',
    subtitle: 'PND1/1A/2/3/53 พร้อมยอดรวม',
    icon: 'bi-file-earmark-text',
    tone: 'amber',
    path: '/accounting/reports/wht',
    ready: true,
  },
]

function toneClass(tone: ReportCard['tone']) {
  switch (tone) {
    case 'blue':
      return 'qf-report-card--blue'
    case 'green':
      return 'qf-report-card--green'
    case 'amber':
      return 'qf-report-card--amber'
    case 'purple':
      return 'qf-report-card--purple'
    case 'pink':
      return 'qf-report-card--pink'
    default:
      return 'qf-report-card--slate'
  }
}

export function AccountingReportsPage() {
  const navigate = useNavigate()

  return (
    <div>
      <PageHeader
        title="รายงานบัญชี"
        subtitle="ศูนย์รวมรายงานมาตรฐานไทย พร้อม รายละเอียดไปเอกสารที่เกี่ยวข้อง"
        breadcrumb="Home · Accounting"
        actions={
          <div className="d-flex gap-2 flex-wrap">
            <Button size="sm" onClick={() => navigate('/sales/invoices')}>
              ไปหน้าใบแจ้งหนี้
            </Button>
            <Button size="sm" variant="secondary" onClick={() => navigate('/purchases/orders')}>
              ไปหน้าใบสั่งซื้อ
            </Button>
            <Button size="sm" variant="secondary" onClick={() => navigate('/expenses')}>
              ไปหน้ารายจ่าย
            </Button>
          </div>
        }
      />

      <Card className="p-3 mb-3">
        <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2">
          <div>
            <div className="fw-semibold">แนวทางใช้งาน</div>
            <div className="text-muted small">
              ภาพรวมรายได้/ค่าใช้จ่าย “เดือนนี้” ถูกย้ายไปอยู่หน้าแดชบอร์ดแล้ว เพื่อให้เห็นภาพรวมเร็วขึ้น
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigate('/dashboard')}
          >
            กลับไปหน้าแดชบอร์ด
          </Button>
        </div>
      </Card>

      <div className="row g-3">
        {cards.map((c) => (
          <div key={c.title} className="col-md-6 col-xl-4">
            <Card
              className={`p-3 qf-report-card ${toneClass(c.tone)}`}
              role="button"
              tabIndex={0}
              onClick={() => {
                if (c.path) return navigate(c.path)
                toast.info('กำลังพัฒนา', 'หน้านี้จะพร้อมใน Phase 2 (เชื่อมต่อ API + drilldown)')
              }}
            >
              <div className="d-flex align-items-start justify-content-between gap-3">
                <div className="min-w-0">
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <i className={`bi ${c.icon} fs-5`} aria-hidden="true" />
                    <div className="fw-semibold text-truncate">{c.title}</div>
                  </div>
                  <div className="small text-muted">{c.subtitle}</div>
                </div>
                {!c.ready && <span className="badge bg-light text-dark border">เร็วๆนี้</span>}
              </div>
            </Card>
          </div>
        ))}
      </div>
    </div>
  )
}


