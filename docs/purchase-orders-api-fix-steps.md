# Purchase Orders API - 404 Fix Steps

จาก terminal output ที่แสดง controller files มีอยู่แล้ว:
- `/opt/odoo18/odoo/adtv18/adt_th_api/controllers/api_purchase_orders.py`
- `/opt/odoo18/odoo/adtv18/adt_th_api/controllers/api_purchase_requests.py`
- `/opt/odoo18/odoo/adtv18/adt_th_api/controllers/api_purchase.py`

แต่เมื่อ test ได้ 404 แสดงว่า routes ยังไม่ได้ register ใน Odoo

## ขั้นตอนแก้ไข (บน Server)

### 1. ตรวจสอบว่า Controller ถูก Import ใน __init__.py

```bash
# ตรวจสอบ controllers/__init__.py
cat /opt/odoo18/odoo/adtv18/adt_th_api/controllers/__init__.py

# ควรมี import แบบนี้:
# from . import api_purchase_orders
# หรือ
# from . import api_purchase
```

**ถ้าไม่มี import**: เพิ่ม import statement สำหรับ controller ที่เกี่ยวข้อง

### 2. ตรวจสอบ Routes ใน Controller File

```bash
# ดู routes ใน api_purchase_orders.py
grep -n "@http.route\|'/api/th/v1/purchases/orders" /opt/odoo18/odoo/adtv18/adt_th_api/controllers/api_purchase_orders.py

# ตรวจสอบว่า routes ถูกต้องตามที่ frontend เรียกใช้:
# - POST /api/th/v1/purchases/orders/list
# - POST /api/th/v1/purchases/orders/:id
# - POST /api/th/v1/purchases/orders (create)
# - PUT /api/th/v1/purchases/orders/:id (update)
# - POST /api/th/v1/purchases/orders/:id/confirm
# - POST /api/th/v1/purchases/orders/:id/cancel
```

### 3. Upgrade Module และ Restart Service

```bash
# 1. Upgrade module
sudo -u odoo18 -H /opt/odoo18/odoo-venv/bin/python /opt/odoo18/odoo/odoo-bin \
  -c /etc/odoo18-api.conf -d q01 -u adt_th_api --stop-after-init

# 2. Restart service (สำคัญมาก! routes จะไม่โหลดถ้าไม่ restart)
sudo systemctl restart odoo18-api

# 3. ตรวจสอบว่า service ทำงาน
sudo systemctl status odoo18-api --no-pager

# 4. ตรวจสอบ PID ว่าเปลี่ยน (แสดงว่า restart สำเร็จ)
ps -ef | grep -E "/etc/odoo18-api\\.conf" | grep -v grep
```

### 4. ตรวจสอบ Routes ใน Odoo Shell

```bash
# เข้า Odoo shell
sudo -u odoo18 -H /opt/odoo18/odoo-venv/bin/python /opt/odoo18/odoo/odoo-bin \
  shell -c /etc/odoo18-api.conf -d q01
```

ใน Odoo shell:
```python
from odoo.http import root
root.get_wsgi_application()  # Build routing map

# หา routes ที่เกี่ยวข้องกับ purchases/orders
for rule in root.nodb_routing_map.iter_rules():
    if '/api/th/v1/purchases/orders' in str(rule.rule):
        print(f"Route: {rule.rule}, Methods: {rule.methods}, Endpoint: {rule.endpoint}")

# หรือดูทุก routes
for rule in root.nodb_routing_map.iter_rules():
    if 'purchase' in str(rule.rule).lower():
        print(f"Route: {rule.rule}")
```

### 5. Test API Endpoint อีกครั้ง

```bash
# ใช้ API key และ token ที่ถูกต้อง (ไม่ใช่ <key> และ <token>)
curl -i -X POST "http://127.0.0.1:18069/api/th/v1/purchases/orders/list?db=q01" \
  -H "X-ADT-API-Key: YOUR_ACTUAL_API_KEY" \
  -H "Authorization: Bearer YOUR_ACTUAL_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"call","params":{"limit":10},"id":1}'
```

### 6. ตรวจสอบ Odoo Logs

ถ้ายังไม่ได้ผล ให้ดู logs:

```bash
# ดู logs ล่าสุด
sudo journalctl -u odoo18-api -n 100 --no-pager | grep -i "purchase\|route\|404"

# หรือดู log file โดยตรง
sudo tail -n 100 /var/log/odoo18/odoo18-api.log | grep -i "purchase\|route\|404"
```

## สาเหตุที่เป็นไปได้

1. **Controller ไม่ได้ถูก import ใน `__init__.py`** - Odoo จะไม่รู้จัก routes
2. **Service ยังไม่ได้ restart** - Routes เก่าไม่มีการเปลี่ยนแปลง
3. **Routes path ไม่ตรงกับที่ frontend เรียกใช้** - ต้องตรวจสอบ routes ใน controller
4. **Module ยังไม่ได้ upgrade** - Controller code ใหม่ไม่ได้โหลด
5. **API key หรือ token ไม่ถูกต้อง** - แต่ควรได้ 401 ไม่ใช่ 404

## Checklist

- [ ] Controller files มีอยู่ (✅ จาก terminal output)
- [ ] Controller ถูก import ใน `__init__.py`
- [ ] Routes ใน controller ถูกต้องตาม spec
- [ ] Module upgrade แล้ว (`-u adt_th_api --stop-after-init`)
- [ ] Service restart แล้ว (`systemctl restart odoo18-api`)
- [ ] Routes ปรากฏใน Odoo routing map (ตรวจสอบด้วย shell)
- [ ] API key และ token ถูกต้อง

