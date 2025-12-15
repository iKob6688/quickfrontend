# แก้ไข VITE_API_BASE_URL

## 🔴 ปัญหา

`VITE_API_BASE_URL` ต้องมี `/api` ต่อท้ายเสมอ

## ❌ ผิด

```env
VITE_API_BASE_URL=https://qacc.erpth.net
```

จะทำให้ URL เป็น: `https://qacc.erpth.net/th/v1/auth/login` (ผิด!)

## ✅ ถูกต้อง

```env
VITE_API_BASE_URL=https://qacc.erpth.net/api
```

จะทำให้ URL เป็น: `https://qacc.erpth.net/api/th/v1/auth/login` (ถูกต้อง!)

## 🔧 วิธีแก้ไข

### บน Server

```bash
cd /opt/quickfrontend

# แก้ไข .env
nano .env
```

แก้ไขเป็น:
```env
VITE_API_BASE_URL=https://qacc.erpth.net/api
```

### Validate

```bash
npm run validate-env:prod
```

### Build ใหม่ (สำคัญ!)

```bash
npm run build
```

### Deploy ใหม่

```bash
sudo rsync -av --delete dist/ /var/www/qacc/
sudo chown -R www-data:www-data /var/www/qacc
```

## 📝 Quick Fix

```bash
cd /opt/quickfrontend

# แก้ไข .env
sed -i 's|VITE_API_BASE_URL=https://qacc.erpth.net|VITE_API_BASE_URL=https://qacc.erpth.net/api|' .env

# Validate
npm run validate-env:prod

# Build
npm run build

# Deploy
sudo rsync -av --delete dist/ /var/www/qacc/
sudo chown -R www-data:www-data /var/www/qacc
```

## ✅ ตรวจสอบ

```bash
cat .env | grep VITE_API_BASE_URL
```

ต้องเห็น:
```
VITE_API_BASE_URL=https://qacc.erpth.net/api
```
