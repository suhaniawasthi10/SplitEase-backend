# SplitEase Deployment Guide

Complete guide for deploying SplitEase on AWS EC2 with PM2, Nginx, and SSL.

---

## Prerequisites

- EC2 instance with Ubuntu
- Node.js and npm installed
- PM2 installed globally: `npm install -g pm2`
- Nginx installed: `sudo apt install nginx`
- Domain: `splitease.suhani.site`

---

## 1. DNS Configuration (Hostinger)

### Steps to Add A Record:

1. **Login to Hostinger**
   - Go to [hpanel.hostinger.com](https://hpanel.hostinger.com)
   - Navigate to **Domains** → **suhani.site** → **DNS / Nameservers**

2. **Add A Record**
   | Field | Value |
   |-------|-------|
   | Type | `A` |
   | Name | `splitease` |
   | Points to | `<Your EC2 Public IP>` |
   | TTL | `14400` (or default) |

3. **Save and Wait**
   - DNS propagation takes 5-30 minutes
   - Verify with: `nslookup splitease.suhani.site`

> [!TIP]
> Get your EC2 public IP from the AWS console or run `curl ifconfig.me` on the instance.

---

## 2. Server Setup

### 2.1 Create Log Directory

```bash
sudo mkdir -p /var/www/html/logs
sudo chown ubuntu:ubuntu /var/www/html/logs
```

### 2.2 Copy PM2 Config to Server

Copy `ecosystem.config.cjs` to `/var/www/html/`:

```bash
# From your local machine
scp -i ~/.ssh/your-key.pem deployment/ecosystem.config.cjs ubuntu@<EC2-IP>:/var/www/html/
```

Or create it directly on the server.

---

## 3. Backend Setup

### 3.1 Install Dependencies

```bash
cd /var/www/html/SplitEase-backend
npm install --production
```

### 3.2 Configure Environment

Create `.env` file in `/var/www/html/SplitEase-backend/`:

```bash
nano .env
```

Required variables:
```env
NODE_ENV=production
PORT=8002
MONGO_URL=mongodb+srv://...
JWT_SECRET=your-secret-key
FRONTEND_URL=https://splitease.suhani.site
ALLOWED_ORIGINS=https://splitease.suhani.site,http://splitease.suhani.site
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

---

## 4. Frontend Setup

### 4.1 Install Dependencies and Build

```bash
cd /var/www/html/SplitEase
npm install
npm run build
```

### 4.2 Update API Base URL

Before building, ensure `src/utils/axios.ts` has the production API URL:

```typescript
const API_BASE_URL = 'https://splitease.suhani.site/api';
```

---

## 5. PM2 Configuration

### 5.1 Start Applications

```bash
cd /var/www/html
pm2 start ecosystem.config.cjs
```

### 5.2 PM2 Commands Reference

| Command | Description |
|---------|-------------|
| `pm2 start ecosystem.config.cjs` | Start all apps |
| `pm2 restart all` | Restart all apps |
| `pm2 stop all` | Stop all apps |
| `pm2 status` | Check status |
| `pm2 logs` | View logs (real-time) |
| `pm2 logs splitease-backend` | Backend logs only |
| `pm2 logs splitease-frontend` | Frontend logs only |
| `pm2 monit` | Advanced monitoring |
| `pm2 save` | Save current process list |
| `pm2 startup` | Generate startup script |

### 5.3 Enable PM2 Startup on Boot

```bash
pm2 startup
# Copy and run the command it outputs
pm2 save
```

---

## 6. Nginx Configuration

### 6.1 Copy Nginx Config

```bash
sudo cp /var/www/html/SplitEase/deployment/nginx/splitease.conf /etc/nginx/sites-available/splitease
```

Or copy from local:
```bash
scp -i ~/.ssh/your-key.pem deployment/nginx/splitease.conf ubuntu@<EC2-IP>:/tmp/
ssh -i ~/.ssh/your-key.pem ubuntu@<EC2-IP> "sudo mv /tmp/splitease.conf /etc/nginx/sites-available/"
```

### 6.2 Enable Site

```bash
sudo ln -s /etc/nginx/sites-available/splitease /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default
```

### 6.3 Test and Reload

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 7. SSL Certificate (Let's Encrypt)

### 7.1 Install Certbot

```bash
sudo apt update
sudo apt install certbot python3-certbot-nginx
```

### 7.2 Get SSL Certificate

```bash
sudo certbot --nginx -d splitease.suhani.site
```

Follow prompts:
- Enter email address
- Agree to terms
- Choose to redirect HTTP to HTTPS (recommended)

### 7.3 Auto-Renewal

Certbot sets up auto-renewal automatically. Test it:

```bash
sudo certbot renew --dry-run
```

---

## 8. Verification

### 8.1 Check Services

```bash
# PM2 status
pm2 status

# Nginx status
sudo systemctl status nginx

# Test backend health
curl http://localhost:8002/health
```

### 8.2 Test External Access

From your browser:
- Frontend: `https://splitease.suhani.site`
- API Health: `https://splitease.suhani.site/health`

---

## 9. Troubleshooting

### PM2 Issues

```bash
# View logs
pm2 logs splitease-backend --lines 100

# Restart specific app
pm2 restart splitease-backend

# Delete and restart
pm2 delete all
pm2 start ecosystem.config.cjs
```

### Nginx Issues

```bash
# Check config syntax
sudo nginx -t

# Check logs
sudo tail -f /var/log/nginx/splitease.error.log
sudo tail -f /var/log/nginx/splitease.access.log

# Restart nginx
sudo systemctl restart nginx
```

### Port Conflicts

```bash
# Check what's using port 8002
sudo lsof -i :8002

# Kill process if needed
sudo kill -9 <PID>
```

### Firewall (if using UFW)

```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow 22
sudo ufw enable
```

---

## 10. Quick Commands Reference

```bash
# === Deployment ===
cd /var/www/html/SplitEase && npm run build
pm2 restart all

# === Logs ===
pm2 logs
sudo tail -f /var/log/nginx/splitease.error.log

# === Status ===
pm2 status
sudo systemctl status nginx

# === Restart Everything ===
pm2 restart all && sudo systemctl reload nginx
```

---

## Architecture Diagram

```
                    Internet
                        │
                        ▼
                ┌───────────────┐
                │   Nginx:80    │
                │   (SSL:443)   │
                └───────┬───────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
        ▼                               ▼
┌───────────────┐               ┌───────────────┐
│   /api/*      │               │   /*          │
│   Proxy to    │               │   Static      │
│   :8002       │               │   /dist       │
└───────────────┘               └───────────────┘
        │
        ▼
┌───────────────┐
│   Backend     │
│   PM2:8002    │
└───────────────┘
        │
        ▼
┌───────────────┐
│   MongoDB     │
│   Atlas       │
└───────────────┘
```
