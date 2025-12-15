# ทดสอบ API Endpoint

## 🔍 ตรวจสอบ Route

### 1. ทดสอบด้วย Verbose Mode

```bash
curl -X POST http://v18.erpth.net/api/th/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "X-ADT-API-Key: your-api-key" \
  -d '{
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
      "login": "admin",
      "password": "qadmin",
      "db": "q01"
    }
  }' -v --max-time 10
```

### 2. ทดสอบด้วย HTTPS

```bash
curl -X POST https://v18.erpth.net/api/th/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "X-ADT-API-Key: your-api-key" \
  -d '{
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
      "login": "admin",
      "password": "qadmin",
      "db": "q01"
    }
  }' -v --max-time 10
```

### 3. ทดสอบโดยตรงที่ Odoo Port

```bash
# ถ้า Odoo อยู่ที่ port 8069
curl -X POST http://v18.erpth.net:8069/api/th/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "X-ADT-API-Key: your-api-key" \
  -d '{
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
      "login": "admin",
      "password": "qadmin",
      "db": "q01"
    }
  }' -v --max-time 10
```

### 4. ทดสอบจาก Localhost

```bash
# ถ้า Odoo อยู่บน server เดียวกัน
curl -X POST http://127.0.0.1:8069/api/th/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "X-ADT-API-Key: your-api-key" \
  -d '{
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
      "login": "admin",
      "password": "qadmin",
      "db": "q01"
    }
  }' -v --max-time 10
```

## 🔍 ตรวจสอบ Network

### 1. ตรวจสอบ DNS

```bash
nslookup v18.erpth.net
ping -c 3 v18.erpth.net
```

### 2. ตรวจสอบ Port

```bash
# ตรวจสอบว่า port เปิดอยู่
telnet v18.erpth.net 80
telnet v18.erpth.net 8069
# หรือ
nc -zv v18.erpth.net 80
nc -zv v18.erpth.net 8069
```

### 3. ตรวจสอบ Firewall

```bash
# ตรวจสอบ firewall rules
sudo iptables -L -n
sudo ufw status
```

## 🔧 Troubleshooting

### ไม่มี Response

**สาเหตุที่เป็นไปได้:**
1. Connection timeout
2. Firewall block
3. Odoo ไม่ทำงาน
4. Route ยังไม่มี

**แก้ไข:**
```bash
# ตรวจสอบ Odoo status
sudo systemctl status odoo18

# ตรวจสอบ Odoo logs
sudo tail -f /var/log/odoo18/odoo-server.log

# ตรวจสอบว่า route ถูก register
# เข้า Odoo shell
sudo -u odoo18 /opt/odoo18/odoo-venv/bin/python /opt/odoo18/odoo/odoo-bin shell -c /etc/odoo18.conf -d q01
```

ใน Odoo shell:
```python
import odoo.http
# ดู routes
for route in odoo.http._get_controllers():
    if '/api/th/v1/auth' in str(route):
        print(route)
```

### Connection Refused

**แก้ไข:**
- ตรวจสอบว่า Odoo ทำงานอยู่
- ตรวจสอบ firewall
- ตรวจสอบว่า port ถูกต้อง

### 404 Not Found

**แก้ไข:**
- ตรวจสอบว่า module ถูก install
- Restart Odoo
- ตรวจสอบ route path

## 📋 Checklist

- [ ] DNS resolve ได้ (`nslookup v18.erpth.net`)
- [ ] Port เปิดอยู่ (`nc -zv v18.erpth.net 80`)
- [ ] Odoo ทำงานอยู่ (`systemctl status odoo18`)
- [ ] Module ถูก install
- [ ] Route ถูก register
- [ ] curl ได้ response (ไม่ใช่ empty)
