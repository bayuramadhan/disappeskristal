#!/bin/bash
# DistribusiPro - First-time Setup Script
# Jalankan setelah PostgreSQL berjalan dan .env dikonfigurasi

set -e

echo "================================================"
echo "  DistribusiPro - Database Setup"
echo "================================================"

# 1. Pastikan .env ada
if [ ! -f .env ]; then
  cp .env.example .env
  echo "⚠️  File .env dibuat dari .env.example"
  echo "   Edit DATABASE_URL di .env sebelum melanjutkan!"
  exit 1
fi

# 2. Apply migration
echo ""
echo "📦 Applying database migration..."
npx prisma migrate deploy

# 3. Create RevenueSummary VIEW
echo ""
echo "📊 Creating RevenueSummary view..."
npx ts-node -e "
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();
const sql = fs.readFileSync('./prisma/views.sql', 'utf-8');
prisma.\$executeRawUnsafe(sql)
  .then(() => { console.log('✅ View created'); return prisma.\$disconnect(); })
  .catch((e) => { console.error('❌ View error:', e.message); return prisma.\$disconnect(); });
" 2>/dev/null || \
npx ts-node --compiler-options '{"module":"CommonJS"}' -e "
import { prisma } from './lib/db';
import * as fs from 'fs';
const sql = fs.readFileSync('./prisma/views.sql', 'utf-8');
prisma.\$executeRawUnsafe(sql)
  .then(() => console.log('✅ View created'))
  .finally(() => prisma.\$disconnect());
" 2>/dev/null || echo "⚠️  Jalankan manual: psql \$DATABASE_URL -f prisma/views.sql"

# 4. Generate Prisma Client
echo ""
echo "🔧 Generating Prisma Client..."
npx prisma generate

# 5. Seed database
echo ""
echo "🌱 Seeding database..."
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts

echo ""
echo "================================================"
echo "  ✅ Setup selesai!"
echo ""
echo "  Jalankan: npm run dev"
echo "  Login  : admin@distribusipro.com / admin123"
echo "================================================"
