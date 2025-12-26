#!/bin/bash

# SplitEase Deployment Script
# Run this script on the EC2 instance to deploy/update the application

set -e  # Exit on any error

echo "🚀 Starting SplitEase Deployment..."

# Configuration
APP_DIR="/var/www/html"
FRONTEND_DIR="$APP_DIR/SplitEase"
BACKEND_DIR="$APP_DIR/SplitEase-backend"
LOG_DIR="$APP_DIR/logs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_step() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Create logs directory
echo ""
echo "📁 Creating log directory..."
mkdir -p $LOG_DIR

# Backend deployment
echo ""
echo "🔧 Deploying Backend..."
cd $BACKEND_DIR

if [ ! -f ".env" ]; then
    print_error "Backend .env file not found! Please create it first."
    echo "   Required variables: MONGO_URL, JWT_SECRET, FRONTEND_URL, CLOUDINARY_*"
    exit 1
fi

echo "   Installing dependencies..."
npm install --production --silent

print_step "Backend dependencies installed"

# Frontend deployment
echo ""
echo "🎨 Deploying Frontend..."
cd $FRONTEND_DIR

echo "   Installing dependencies..."
npm install --silent

echo "   Building production bundle..."
npm run build

if [ -d "dist" ]; then
    print_step "Frontend build successful"
else
    print_error "Frontend build failed - dist folder not found"
    exit 1
fi

# PM2 management
echo ""
echo "🔄 Managing PM2 processes..."
cd $APP_DIR

# Check if PM2 config exists
if [ -f "ecosystem.static.config.cjs" ]; then
    CONFIG_FILE="ecosystem.static.config.cjs"
elif [ -f "ecosystem.config.cjs" ]; then
    CONFIG_FILE="ecosystem.config.cjs"
else
    print_error "PM2 config file not found!"
    exit 1
fi

# Stop existing processes
pm2 delete all 2>/dev/null || true

# Start with fresh config
pm2 start $CONFIG_FILE
pm2 save

print_step "PM2 processes started"

# Nginx reload
echo ""
echo "🌐 Reloading Nginx..."
sudo nginx -t && sudo systemctl reload nginx
print_step "Nginx reloaded"

# Status check
echo ""
echo "📊 Deployment Status:"
echo "-----------------------------------"
pm2 status

echo ""
echo "-----------------------------------"
print_step "Deployment Complete!"
echo ""
echo "🌍 Application URLs:"
echo "   Frontend: https://splitease.suhani.site"
echo "   API Health: https://splitease.suhani.site/health"
echo ""
echo "📋 Useful commands:"
echo "   pm2 logs           - View logs"
echo "   pm2 status         - Check status"
echo "   pm2 restart all    - Restart all apps"
