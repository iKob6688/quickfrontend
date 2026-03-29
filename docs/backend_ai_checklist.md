# Backend AI Features Checklist

เอกสารนี้ใช้สำหรับตรวจสอบและปรับปรุง backend (`adt_th_api`) เพื่อให้ทำงานสอดคล้องกับ frontend AI features

## ✅ สิ่งที่มีอยู่แล้ว (Implemented)

### 1. AI Service (`services/ai_service.py`)
- [x] `call_openai_chat()` - GPT-4 Chat API
- [x] `call_gpt4_vision()` - GPT-4 Vision API (สำหรับสแกนภาพ)
- [x] `extract_json_from_text()` - แปลง AI response เป็น JSON
- [x] `ocr_image_to_text()` - OCR ภาพด้วย Tesseract
- [x] `ocr_pdf_to_text()` - OCR PDF ด้วย PyMuPDF

### 2. Agent API Controller (`controllers/api_agent.py`)
- [x] `POST /api/th/v1/agent/ocr` - สแกนข้อความจากภาพ/PDF
- [x] `POST /api/th/v1/agent/expense/auto-post` - สร้าง expense จากใบเสร็จ
- [x] `POST /api/th/v1/agent/quotation/create` - สร้าง quotation จากเอกสาร
- [x] `POST /api/th/v1/agent/contact/create` - สร้าง contact จากนามบัตร
- [x] `POST /api/th/v1/agent/status` - ดูสถานะและ permissions

### 3. Agent User Model (`models/agent_user.py`)
- [x] Token-based authentication (`X-Agent-Token` header)
- [x] Permissions: `can_ocr`, `can_post_expense`, `can_create_quotation`, `can_create_contact`, `can_update_data`
- [x] Usage tracking: `requests_today`, `max_requests_per_day`, `total_requests`

---

## ❌ สิ่งที่ยังขาด (Missing)

### 1. Invoice Creation Endpoint

**Endpoint ที่ต้องเพิ่ม:**
```python
@http.route(
    "/api/th/v1/agent/invoice/create",
    type="json",
    auth="public",
    methods=["POST"],
    csrf=False,
)
def agent_create_invoice(self, **payload):
    """Create invoice from AI-extracted or provided data.
    
    Payload:
    {
        "customer_id": 123,  // or customer data
        "customer_data": {
            "name": "Company Name",
            "email": "email@example.com",
            "phone": "0123456789",
            "vat": "1234567890123"
        },
        "invoice_date": "2026-01-15",
        "due_date": "2026-02-15",
        "currency": "THB",
        "lines": [
            {
                "product_id": 456,  // optional
                "description": "Product/Service name",
                "quantity": 1.0,
                "unit_price": 1000.0,
                "tax_ids": [1, 2]  // optional
            }
        ],
        "notes": "Additional notes",
        "file": "base64_encoded_invoice",  // Optional: extract from file
        "extracted_data": {...}  // Optional: pre-extracted data
    }
    """
```

**Response:**
```python
{
    "invoice_id": 789,
    "invoice_number": "INV/2026/0001",
    "customer_id": 123,
    "customer_name": "Company Name",
    "amount_total": 1070.0,
    "status": "draft"
}
```

**Implementation Steps:**
1. เพิ่ม permission `can_create_invoice` ใน `adt.agent.user` model
2. สร้าง method `agent_create_invoice()` ใน `AdtAgentApiController`
3. ใช้ GPT-4 Vision เพื่อ extract invoice data จากไฟล์ (ถ้ามี)
4. สร้างหรือหา customer จาก `customer_data` หรือ `customer_id`
5. สร้าง `account.move` (out_invoice) พร้อม invoice lines
6. Return invoice data ตาม response format

**Code Template:**
```python
@http.route(
    "/api/th/v1/agent/invoice/create",
    type="json",
    auth="public",
    methods=["POST"],
    csrf=False,
)
def agent_create_invoice(self, **payload):
    """Create invoice from AI-extracted or provided data."""
    start = time.time()
    agent, error_resp = self._auth_agent()
    if error_resp:
        return error_resp
    
    # TODO: Add permission check
    # if not agent.can_create_invoice:
    #     return self._json_response(
    #         error={"message": "Create invoice permission denied", "code": "PERMISSION_DENIED"},
    #         status=403
    #     )
    
    env = self._get_agent_env(agent)
    
    try:
        # Extract from file if provided
        extracted_data = payload.get("extracted_data")
        if not extracted_data and payload.get("file"):
            file_data = payload.get("file")
            file_bytes = base64.b64decode(file_data)
            
            prompt = """Extract invoice information from this document. Return JSON with:
{
    "customer_name": "customer name",
    "customer_email": "email",
    "customer_phone": "phone",
    "customer_vat": "tax ID if visible",
    "invoice_date": "YYYY-MM-DD",
    "due_date": "YYYY-MM-DD",
    "lines": [
        {
            "description": "product/service name",
            "quantity": 1.0,
            "unit_price": 1000.0
        }
    ],
    "total": 1070.0
}"""
            
            vision_result = AdtAiService.call_gpt4_vision(prompt, file_bytes)
            if "error" not in vision_result:
                extracted_text = vision_result.get("result", "")
                extracted_data = AdtAiService.extract_json_from_text(extracted_text)
        
        # Create or find customer
        customer_id = payload.get("customer_id")
        if not customer_id:
            customer_data = payload.get("customer_data") or {}
            if extracted_data:
                customer_data.update({
                    "name": extracted_data.get("customer_name") or customer_data.get("name"),
                    "email": extracted_data.get("customer_email") or customer_data.get("email"),
                    "phone": extracted_data.get("customer_phone") or customer_data.get("phone"),
                    "vat": extracted_data.get("customer_vat") or customer_data.get("vat"),
                })
            
            if customer_data.get("name"):
                # Find or create customer
                partner = env["res.partner"].search([
                    ("name", "=", customer_data["name"])
                ], limit=1)
                
                if not partner:
                    partner = env["res.partner"].create({
                        "name": customer_data["name"],
                        "email": customer_data.get("email"),
                        "phone": customer_data.get("phone"),
                        "vat": customer_data.get("vat"),
                        "customer_rank": 1,
                    })
                customer_id = partner.id
        
        if not customer_id:
            raise ValueError("customer_id or customer_data is required")
        
        # Prepare invoice lines
        lines_data = payload.get("lines") or []
        if extracted_data and extracted_data.get("lines"):
            # Merge extracted lines
            for ext_line in extracted_data["lines"]:
                # Find product by name if provided
                product_id = None
                product_name = ext_line.get("product_name")
                if product_name:
                    product = env["product.product"].search([
                        ("name", "ilike", product_name)
                    ], limit=1)
                    if product:
                        product_id = product.id
                
                lines_data.append({
                    "product_id": product_id,
                    "name": ext_line.get("description", ""),
                    "quantity": float(ext_line.get("quantity", 1.0)),
                    "price_unit": float(ext_line.get("unit_price", 0.0)),
                })
        
        if not lines_data:
            raise ValueError("lines are required")
        
        # Create invoice (account.move)
        invoice_date = payload.get("invoice_date") or extracted_data.get("invoice_date") or fields.Date.today()
        due_date = payload.get("due_date") or extracted_data.get("due_date")
        currency_code = payload.get("currency") or "THB"
        
        # Get currency
        currency = env["res.currency"].search([("name", "=", currency_code)], limit=1)
        if not currency:
            currency = env.company.currency_id
        
        invoice_vals = {
            "move_type": "out_invoice",
            "partner_id": customer_id,
            "invoice_date": invoice_date,
            "date": invoice_date,
            "currency_id": currency.id,
            "invoice_line_ids": [(0, 0, {
                "product_id": line.get("product_id"),
                "name": line.get("description", ""),
                "quantity": line.get("quantity", 1.0),
                "price_unit": line.get("unit_price", 0.0),
                "tax_ids": [(6, 0, line.get("tax_ids", []))] if line.get("tax_ids") else [],
            }) for line in lines_data],
        }
        
        if due_date:
            invoice_vals["invoice_date_due"] = due_date
        
        if payload.get("notes"):
            invoice_vals["narration"] = payload["notes"]
        
        invoice = env["account.move"].create(invoice_vals)
        
        # TODO: Track usage
        # agent.bump_usage("create_invoice")
        
        return self._json_response(data={
            "invoice_id": invoice.id,
            "invoice_number": invoice.name or None,
            "customer_id": customer_id,
            "customer_name": invoice.partner_id.name,
            "amount_total": invoice.amount_total,
            "status": invoice.state,
        })
    
    except ValueError as e:
        return self._json_response(
            error={"message": str(e), "code": "VALIDATION_ERROR"},
            status=400
        )
    except Exception as e:
        _logger.error(f"Error in agent_create_invoice: {e}", exc_info=True)
        return self._json_response(
            error={"message": str(e), "code": "SERVER_ERROR"},
            status=500
        )
```

### 2. Permission Field

**เพิ่มใน `models/agent_user.py`:**
```python
can_create_invoice = fields.Boolean(
    string="Can Create Invoice",
    default=False,
    help="Allow invoice creation operations",
)
```

**เพิ่มใน `views/agent_user_views.xml`:**
```xml
<field name="can_create_invoice"/>
```

**อัปเดต `agent_status` response:**
```python
"permissions": {
    "can_ocr": agent.can_ocr,
    "can_post_expense": agent.can_post_expense,
    "can_create_quotation": agent.can_create_quotation,
    "can_create_contact": agent.can_create_contact,
    "can_create_invoice": agent.can_create_invoice,  # เพิ่มบรรทัดนี้
    "can_update_data": agent.can_update_data,
},
```

---

## 🔍 การตรวจสอบ (Testing Checklist)

### 1. Invoice Creation
- [ ] Test: สร้าง invoice จาก customer_id ที่มีอยู่
- [ ] Test: สร้าง invoice พร้อมสร้าง customer ใหม่
- [ ] Test: สร้าง invoice จากไฟล์ภาพ (ใช้ GPT-4 Vision)
- [ ] Test: สร้าง invoice จากไฟล์ PDF
- [ ] Test: สร้าง invoice พร้อม invoice lines หลายรายการ
- [ ] Test: สร้าง invoice พร้อม tax_ids
- [ ] Test: Error handling - ไม่มี customer_data และ customer_id
- [ ] Test: Error handling - ไม่มี lines
- [ ] Test: Permission check - agent ไม่มี `can_create_invoice`

### 2. Integration Testing
- [ ] Test: Frontend → Backend → Odoo (end-to-end)
- [ ] Test: Agent token authentication
- [ ] Test: Usage tracking (`bump_usage`)
- [ ] Test: Company scoping (agent.company_id)

### 3. AI Service
- [ ] Test: GPT-4 Vision extraction accuracy
- [ ] Test: JSON extraction from AI response
- [ ] Test: Error handling - OpenAI API failure
- [ ] Test: Error handling - Invalid base64 file

---

## 📝 Notes

1. **Invoice Lines**: Backend ต้องรองรับ `product_id` เป็น `null` (สำหรับ non-product lines)
2. **Tax IDs**: ถ้าไม่ระบุ `tax_ids` ให้ใช้ default tax จาก product หรือ company
3. **Currency**: Default เป็น company currency ถ้าไม่ระบุ
4. **Invoice Date/Due Date**: ถ้าไม่ระบุให้ใช้ today และ today + 30 days
5. **Customer Creation**: ถ้า customer ยังไม่มี ให้สร้างใหม่พร้อม `customer_rank = 1`

---

## 🚀 Deployment Steps

1. **Update Odoo Module:**
   ```bash
   cd /opt/odoo18/odoo/adtv18
   git pull
   sudo -u odoo18 -H /opt/odoo18/odoo-venv/bin/python /opt/odoo18/odoo/odoo-bin \
     -c /etc/odoo18-api.conf -d q01 -u adt_th_api --stop-after-init
   ```

2. **Restart Odoo API Service:**
   ```bash
   sudo systemctl restart odoo18-api
   ```

3. **Verify Endpoint:**
   ```bash
   curl -X POST "http://localhost:8069/api/th/v1/agent/invoice/create" \
     -H "Content-Type: application/json" \
     -H "X-Agent-Token: <token>" \
     -d '{
       "jsonrpc": "2.0",
       "method": "call",
       "params": {
         "customer_data": {"name": "Test Customer"},
         "lines": [{"description": "Test", "quantity": 1, "unit_price": 100}]
       }
     }'
   ```

4. **Create Agent User in Odoo:**
   - ไปที่ **Settings → OpenClaw → AI Agent Identity**
   - ตั้งค่า login ที่ต้องการ (แนะนำ `iadmin`)
   - ใส่รหัสผ่านของบัญชีนี้ครั้งแรกในฟอร์มตั้งค่า
   - ให้สิทธิ์กลุ่ม business modules ที่ต้องใช้ แต่ไม่ต้องเพิ่มกลุ่ม system/admin
   - ใช้ login เดียวกันนี้ใน React UI เพื่อให้ backend เป็น source of truth

---

## 📚 Related Files

- `adt_th_api/controllers/api_agent.py` - Agent API controller
- `adt_th_api/services/ai_service.py` - AI service utilities
- `adt_th_api/models/agent_user.py` - Agent user model
- `adt_th_api/views/agent_user_views.xml` - Agent user UI

---

**Last Updated:** 2026-01-15  
**Status:** ⚠️ Invoice creation endpoint ยังไม่ implement
