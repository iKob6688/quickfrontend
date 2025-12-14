# Production Deployment Guide

## 🚀 One-Command Setup

```bash
npm run setup
```

That's it! The script will guide you through the setup process.

## Quick Start

### 1. Setup Environment

```bash
# Interactive setup (recommended)
npm run setup

# Or for production mode
npm run setup:prod
```

### 2. Validate Configuration

```bash
# Validate before building
npm run validate-env

# Or for production
npm run validate-env:prod
```

### 3. Build

```bash
# Build with validation (recommended)
npm run build

# Build without validation (for development)
npm run build:dev
```

### 4. Deploy

Deploy the `dist/` folder to your server.

## Environment Variables

The setup script will create/update `.env` with:

```env
VITE_API_BASE_URL=https://your-server.com/api
VITE_API_KEY=your-api-key
VITE_ODOO_DB=your-database
VITE_ALLOWED_SCOPES=auth,invoice,excel
```

### Required Variables

- **VITE_API_BASE_URL**: Full URL for production (e.g., `https://api.example.com`)
- **VITE_API_KEY**: API key from Odoo
- **VITE_ODOO_DB**: Database name
- **VITE_ALLOWED_SCOPES**: Comma-separated scopes

### Optional Variables

- **VITE_REGISTER_MASTER_KEY**: For creating new companies via UI

## Production Checklist

- [ ] Run `npm run setup:prod`
- [ ] Verify `.env` file exists
- [ ] Run `npm run validate-env:prod` (should pass)
- [ ] Run `npm run build`
- [ ] Deploy `dist/` folder
- [ ] Configure web server (nginx/apache)
- [ ] Test login functionality

## Troubleshooting

### Error: "VITE_API_BASE_URL must be a full URL in production"

**Solution:** Update `.env`:
```env
VITE_API_BASE_URL=https://your-server.com/api
```

Then run:
```bash
npm run validate-env:prod
```

### Error: "VITE_API_KEY is required"

**Solution:** Get API key from Odoo:
1. Odoo → Settings → Technical → API Clients
2. Copy the API key
3. Run `npm run setup` again

### Error 405: Method Not Allowed

**Cause:** `VITE_API_BASE_URL` is incorrect (using `/api` instead of full URL)

**Solution:**
```bash
npm run setup:prod
# Enter full URL when prompted
```

## CI/CD Integration

Add to your CI/CD pipeline:

```yaml
# Example GitHub Actions
- name: Validate environment
  run: npm run validate-env:prod

- name: Build
  run: npm run build
```

## Manual Setup (Alternative)

If you prefer manual setup:

1. Create `.env` file:
```bash
nano .env
```

2. Add configuration:
```env
VITE_API_BASE_URL=https://your-server.com/api
VITE_API_KEY=your-api-key
VITE_ODOO_DB=your-database
VITE_ALLOWED_SCOPES=auth,invoice,excel
```

3. Validate:
```bash
npm run validate-env:prod
```

## Web Server Configuration

### Nginx Example

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    root /path/to/dist;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass https://your-backend-server;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Apache Example

```apache
<VirtualHost *:80>
    ServerName your-domain.com
    DocumentRoot /path/to/dist
    
    <Directory /path/to/dist>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
    
    RewriteEngine On
    RewriteBase /
    RewriteRule ^index\.html$ - [L]
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /index.html [L]
</VirtualHost>
```

## Support

For issues or questions:
- Check [Troubleshooting](#troubleshooting) section
- Review error messages (they now include actionable guidance)
- Run `npm run validate-env:prod` to check configuration
