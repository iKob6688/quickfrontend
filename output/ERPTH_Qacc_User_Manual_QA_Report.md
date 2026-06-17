# ERPTH Qacc Production User Manual QA Report

- Generated: 2026-06-17T12:51:10
- Source DOCX: `Users Manaul Qacc/ERPTH-Qacc-User-Manual-TH.docx`
- Source pages: unknown
- Source paragraphs extracted: 438
- Source tables extracted: 3
- Images extracted: 73
- Images mapped successfully: 73
- Images unmapped: 0
- Figures used in main/manual appendices: 20
- New workflow sections: 11
- Route coverage rows: 73
- Known issues: 31
- Live browser MP4 videos referenced: 6

## Quality Gate

- DOCX opens with python-docx: passed
- Image extraction: passed
- Main content rewritten as business workflow manual: passed
- Technical route/error content moved to appendices: passed
- Mobile version excluded: passed
- DOCX visual render: skipped because `soffice` is not available in this environment

## Known Issues

- `/customers/1` | รายละเอียดรายชื่อติดต่อ | ไม่พบหน้า | เปิดจากรายการเอกสารจริง ตรวจสิทธิ์ผู้ใช้ และตรวจ endpoint/ข้อมูลใน q01
- `/customers/1/edit` | แก้ไขรายชื่อติดต่อ | ไม่พบหน้า | เปิดจากรายการเอกสารจริง ตรวจสิทธิ์ผู้ใช้ และตรวจ endpoint/ข้อมูลใน q01
- `/products/1/edit` | แก้ไขสินค้า | ไม่พบหน้า | เปิดจากรายการเอกสารจริง ตรวจสิทธิ์ผู้ใช้ และตรวจ endpoint/ข้อมูลใน q01
- `/sales/orders/new` | สร้างใบเสนอราคา / คำสั่งขาย | แสดงข้อผิดพลาดจริง | เปิดจากรายการเอกสารจริง ตรวจสิทธิ์ผู้ใช้ และตรวจ endpoint/ข้อมูลใน q01
- `/sales/orders/1` | รายละเอียดใบเสนอราคา / คำสั่งขาย | ไม่พบหน้า | เปิดจากรายการเอกสารจริง ตรวจสิทธิ์ผู้ใช้ และตรวจ endpoint/ข้อมูลใน q01
- `/sales/orders/1/edit` | /sales/orders/1/edit | ไม่พบหน้า | เปิดจากรายการเอกสารจริง ตรวจสิทธิ์ผู้ใช้ และตรวจ endpoint/ข้อมูลใน q01
- `/sales/orders/1/print-preview` | /sales/orders/1/print-preview | ไม่พบหน้า | เปิดจากรายการเอกสารจริง ตรวจสิทธิ์ผู้ใช้ และตรวจ endpoint/ข้อมูลใน q01
- `/sales/deliveries/1` | ไม่พบ การส่งสินค้า | แสดงข้อผิดพลาดจริง | เปิดจากรายการเอกสารจริง ตรวจสิทธิ์ผู้ใช้ และตรวจ endpoint/ข้อมูลใน q01
- `/sales/invoices/1` | ไม่พบข้อมูล | แสดงข้อผิดพลาดจริง | เปิดจากรายการเอกสารจริง ตรวจสิทธิ์ผู้ใช้ และตรวจ endpoint/ข้อมูลใน q01
- `/notes` | ใบเพิ่ม/ลดหนี้ | แสดงข้อผิดพลาดจริง | เปิดจากรายการเอกสารจริง ตรวจสิทธิ์ผู้ใช้ และตรวจ endpoint/ข้อมูลใน q01
- `/sales/notes` | ใบเพิ่ม/ลดหนี้ | แสดงข้อผิดพลาดจริง | เปิดจากรายการเอกสารจริง ตรวจสิทธิ์ผู้ใช้ และตรวจ endpoint/ข้อมูลใน q01
- `/sales/notes/1` | ไม่พบข้อมูล | ไม่พบหน้า | เปิดจากรายการเอกสารจริง ตรวจสิทธิ์ผู้ใช้ และตรวจ endpoint/ข้อมูลใน q01
- `/purchases/orders/1` | รายละเอียดใบสั่งซื้อ | แสดงข้อผิดพลาดจริง | เปิดจากรายการเอกสารจริง ตรวจสิทธิ์ผู้ใช้ และตรวจ endpoint/ข้อมูลใน q01
- `/purchases/bills/1` | ไม่พบ บิลผู้ขาย | แสดงข้อผิดพลาดจริง | เปิดจากรายการเอกสารจริง ตรวจสิทธิ์ผู้ใช้ และตรวจ endpoint/ข้อมูลใน q01
- `/purchases/notes` | ใบเพิ่ม/ลดหนี้ | แสดงข้อผิดพลาดจริง | เปิดจากรายการเอกสารจริง ตรวจสิทธิ์ผู้ใช้ และตรวจ endpoint/ข้อมูลใน q01
- `/purchases/notes/1` | ไม่พบข้อมูล | ไม่พบหน้า | เปิดจากรายการเอกสารจริง ตรวจสิทธิ์ผู้ใช้ และตรวจ endpoint/ข้อมูลใน q01
- `/purchases/requests/new` | สร้างคำขอซื้อ | ไม่พบหน้า | เปิดจากรายการเอกสารจริง ตรวจสิทธิ์ผู้ใช้ และตรวจ endpoint/ข้อมูลใน q01
- `/purchases/requests/1/edit` | แก้ไขคำขอซื้อ | ไม่พบหน้า | เปิดจากรายการเอกสารจริง ตรวจสิทธิ์ผู้ใช้ และตรวจ endpoint/ข้อมูลใน q01
- `/expenses/1` | รายละเอียดรายจ่าย | แสดงข้อผิดพลาดจริง | เปิดจากรายการเอกสารจริง ตรวจสิทธิ์ผู้ใช้ และตรวจ endpoint/ข้อมูลใน q01
- `/accounting/reports/general-ledger` | สมุดบัญชีแยกประเภท | แสดงข้อผิดพลาดจริง | เปิดจากรายการเอกสารจริง ตรวจสิทธิ์ผู้ใช้ และตรวจ endpoint/ข้อมูลใน q01
- `/accounting/reports/partner-ledger` | ลูกหนี้/เจ้าหนี้ (รายงานลูกหนี้/เจ้าหนี้รายคู่ค้า) | แสดงข้อผิดพลาดจริง | เปิดจากรายการเอกสารจริง ตรวจสิทธิ์ผู้ใช้ และตรวจ endpoint/ข้อมูลใน q01
- `/accounting/reports/aged-receivables` | อายุลูกหนี้ | แสดงข้อผิดพลาดจริง | เปิดจากรายการเอกสารจริง ตรวจสิทธิ์ผู้ใช้ และตรวจ endpoint/ข้อมูลใน q01
- `/accounting/reports/aged-payables` | อายุเจ้าหนี้ | แสดงข้อผิดพลาดจริง | เปิดจากรายการเอกสารจริง ตรวจสิทธิ์ผู้ใช้ และตรวจ endpoint/ข้อมูลใน q01
- `/accounting/reports/cash-book` | สมุดเงินสด | แสดงข้อผิดพลาดจริง | เปิดจากรายการเอกสารจริง ตรวจสิทธิ์ผู้ใช้ และตรวจ endpoint/ข้อมูลใน q01
- `/accounting/reports/bank-book` | สมุดเงินฝากธนาคาร | แสดงข้อผิดพลาดจริง | เปิดจากรายการเอกสารจริง ตรวจสิทธิ์ผู้ใช้ และตรวจ endpoint/ข้อมูลใน q01
- `/accounting/reports/vat` | รายงาน VAT | แสดงข้อผิดพลาดจริง | เปิดจากรายการเอกสารจริง ตรวจสิทธิ์ผู้ใช้ และตรวจ endpoint/ข้อมูลใน q01
- `/accounting/reports/wht` | รายงานภาษีหัก ณ ที่จ่าย (WHT) | ไม่พบหน้า | เปิดจากรายการเอกสารจริง ตรวจสิทธิ์ผู้ใช้ และตรวจ endpoint/ข้อมูลใน q01
- `/accounting/etax` | เอกสาร e-Tax | ไม่พบหน้า | เปิดจากรายการเอกสารจริง ตรวจสิทธิ์ผู้ใช้ และตรวจ endpoint/ข้อมูลใน q01
- `/accounting/etax-settings` | e-Tax Settings | แสดงข้อผิดพลาดจริง | เปิดจากรายการเอกสารจริง ตรวจสิทธิ์ผู้ใช้ และตรวจ endpoint/ข้อมูลใน q01
- `/accounting/reports/general-ledger/account/1` | บัญชีแยกประเภท | แสดงข้อผิดพลาดจริง | เปิดจากรายการเอกสารจริง ตรวจสิทธิ์ผู้ใช้ และตรวจ endpoint/ข้อมูลใน q01
- `/accounting/reports/move-lines/1` | รายละเอียดรายการบัญชี #1 | แสดงข้อผิดพลาดจริง | เปิดจากรายการเอกสารจริง ตรวจสิทธิ์ผู้ใช้ และตรวจ endpoint/ข้อมูลใน q01

## Human Review Checklist

- เปิด DOCX ใน Microsoft Word แล้ว Update Table of Contents
- ตรวจคำศัพท์เฉพาะของบริษัท เช่น ชื่อเมนูและสิทธิ์ผู้ใช้
- ตรวจหน้า Known Issues กับสถานะ backend ล่าสุดก่อนส่งลูกค้า
- ตรวจภาพ screenshot ว่าตรงกับข้อมูล production/demo ที่ต้องการเผยแพร่
