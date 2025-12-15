# ขั้นตอนการ Deploy บน Server

## 📋 Checklist

### 1. บน Server - Pull Code ใหม่

```bash
cd /opt/quickfrontend
git pull origin main
```

### 2. Setup Environment (ครั้งแรกหรือเมื่อต้องการเปลี่ยน config)

```bash
# Interactive setup - จะถามค่าต่างๆ
npm run setup:prod
```

**ค่าที่ต้องกรอก:**
- **API Base URL**: Full URL ของ server เช่น `https://your-server.com/api`
- **API Key**: จาก Odoo → Settings → Technical → API Clients
- **Database Name**: ชื่อ database ใน Odoo
- **Allowed Scopes**: เช่น `auth,invoice,excel`
- **Register Master Key**: (Optional) สำหรับสร้างบริษัทใหม่

### 3. Validate Configuration

```bash
# ตรวจสอบว่าการตั้งค่าถูกต้อง
npm run validate-env:prod
```

ถ้า validation ผ่าน จะเห็น:
```
✅ Environment validation passed!
```

### 4. Build Application

```bash
# Build พร้อม validation อัตโนมัติ
npm run build
```

จะได้ folder `dist/` ที่พร้อม deploy

### 5. Deploy

#### วิธีที่ 1: Copy dist/ folder ไปยัง web server

```bash
# ตัวอย่าง: copy ไปยัง nginx
sudo cp -r dist/* /var/www/html/

# หรือถ้าใช้ Apache
sudo cp -r dist/* /var/www/html/
```

#### วิธีที่ 2: ใช้ symbolic link

```bash
# สร้าง symbolic link
sudo ln -sfn /opt/quickfrontend/dist /var/www/html/quickfront18
```

### 6. Configure Web Server

#### Nginx Configuration

สร้างไฟล์ `/etc/nginx/sites-available/quickfront18`:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    root /opt/quickfrontend/dist;
    index index.html;
    
    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # API proxy (ถ้า backend อยู่ที่อื่น)
    location /api {
        proxy_pass https://your-backend-server;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/quickfront18 /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### Apache Configuration

สร้างไฟล์ `/etc/apache2/sites-available/quickfront18.conf`:

```apache
<VirtualHost *:80>
    ServerName your-domain.com
    DocumentRoot /opt/quickfrontend/dist
    
    <Directory /opt/quickfrontend/dist>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
    
    # SPA routing
    RewriteEngine On
    RewriteBase /
    RewriteRule ^index\.html$ - [L]
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /index.html [L]
</VirtualHost>
```

Enable site:
```bash
sudo a2ensite quickfront18
sudo systemctl reload apache2
```

### 7. Test

1. เปิด browser ไปที่ `http://your-domain.com`
2. ทดสอบ login
3. ตรวจสอบว่าไม่มี error 405

## 🔄 Update Process (เมื่อมี code ใหม่)

```bash
# 1. Pull code
git pull origin main

# 2. Install dependencies (ถ้ามี)
npm install

# 3. Validate (ถ้ามีการเปลี่ยน env)
npm run validate-env:prod

# 4. Build
npm run build

# 5. Reload web server
sudo systemctl reload nginx
# หรือ
sudo systemctl reload apache2
```

## 🐛 Troubleshooting

### Error 405: Method Not Allowed

**สาเหตุ:** `VITE_API_BASE_URL` ไม่ถูกต้อง

**แก้ไข:**
```bash
npm run setup:prod
# กรอก full URL เมื่อถูกถาม
```

### Build ล้มเหลว

**ตรวจสอบ:**
```bash
# ตรวจสอบ environment
npm run validate-env:prod

# ตรวจสอบว่า .env มีอยู่
ls -la .env
```

### หน้าเว็บไม่แสดง

**ตรวจสอบ:**
1. Web server configuration ถูกต้อง
2. File permissions: `sudo chown -R www-data:www-data /opt/quickfrontend/dist`
3. Nginx/Apache error logs: `sudo tail -f /var/log/nginx/error.log`

## 📝 Quick Reference

```bash
# Setup ครั้งแรก
git pull origin main
npm run setup:prod
npm run build

# Update code
git pull origin main
npm run build
sudo systemctl reload nginx
```

## ✅ Success Indicators

- ✅ `npm run validate-env:prod` ผ่าน
- ✅ `npm run build` สำเร็จ (ได้ folder `dist/`)
- ✅ Login ได้ปกติ (ไม่มี error 405)
- ✅ หน้าเว็บแสดงผลถูกต้อง
