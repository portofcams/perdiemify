# PERDIEMIFY — CLAUDE.md (v4.0 Final)

> Save this file as `CLAUDE.md` in the repo root. Claude Code reads it automatically.
> Start with: `"Read CLAUDE.md. Begin Phase 1, Day 1."`
>
> ⚠️ **SECURITY:** This file contains server details for development use. The setup script disables root password login and enforces SSH key-only auth. Never commit passwords to git. Use GitHub Secrets for CI/CD credentials.

---

# 1. PROJECT IDENTITY

| Key | Value |
|-----|-------|
| **Name** | Perdiemify |
| **Domain** | perdiemify.com (registered on Cloudflare) |
| **Tagline** | "Keep the difference." |
| **Purpose** | Help professionals maximize per diem allowances — search flights, hotels, cars; scrape discount codes; track loyalty programs; show exactly how much they pocket. |
| **Vibe** | Friendly & approachable (Mint / Robinhood). Not stuffy corporate. |
| **Voice** | Conversational, confident, helpful. Like a savvy coworker who always finds the best deals. |
| **Builder** | Solo founder + Claude Code. Corporate/contractor per diem experience. Comfortable with Linux, Docker, VPS. |
| **Budget** | $100-500/month for infrastructure + APIs |

---

# 1B. LIVE INFRASTRUCTURE (Deployed)

## Vultr Production Server

| Key | Value |
|-----|-------|
| **IP Address** | `45.77.120.186` |
| **Hostname** | `perdiemify-prod` |
| **Location** | Los Angeles (Vultr High Frequency) |
| **Specs** | 4 vCPU / 8GB RAM / 256GB NVMe SSD |
| **OS** | Ubuntu 24.04 LTS (x64) |
| **SSH User** | `root` (create `deploy` user during setup — see below) |
| **SSH Key** | `~/.ssh/perdiemify` (ed25519) |
| **SSH Command** | `ssh -i ~/.ssh/perdiemify root@45.77.120.186` |
| **Docker path** | `/opt/perdiemify` (clone repo here) |
| **Backups** | Enabled (auto) |

## DNS Records (Cloudflare)

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `perdiemify.com` | Cloudflare Pages auto | ✅ Proxied |
| CNAME | `www` | `perdiemify.com` | ✅ Proxied |
| A | `api` | `45.77.120.186` | ✅ Proxied |

## Firewall Rules (Vultr `perdiemify-fw`)

| Protocol | Port | Source | Purpose |
|----------|------|--------|---------|
| TCP | 22 | Your IP only | SSH |
| TCP | 80 | 0.0.0.0/0 | HTTP → HTTPS redirect |
| TCP | 443 | 0.0.0.0/0 | HTTPS (API) |

## Initial Server Setup Script

Run this ONCE after first SSH into the server:

```bash
#!/bin/bash
# setup-vultr.sh — Run as root on first login
# ssh -i ~/.ssh/perdiemify root@45.77.120.186

set -e

echo "=== Perdiemify Server Setup ==="

# 1. Update system
apt update && apt upgrade -y

# 2. Install Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

# 3. Install Docker Compose (v2 plugin)
apt install -y docker-compose-plugin
docker compose version

# 4. Create deploy user (use this instead of root going forward)
adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy
usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys

# 5. Configure UFW firewall (backup to Vultr firewall)
apt install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# 6. Install fail2ban
apt install -y fail2ban
systemctl enable fail2ban
systemctl start fail2ban

# 7. Configure swap (4GB safety net)
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# 8. Set up project directory
mkdir -p /opt/perdiemify
chown deploy:deploy /opt/perdiemify

# 9. Install certbot for SSL (api.perdiemify.com)
apt install -y certbot
# SSL will be handled by Cloudflare proxy, but certbot available if needed

# 10. Install useful tools
apt install -y htop curl wget git jq unzip nano

# 11. Configure log rotation for Docker
cat > /etc/docker/daemon.json << 'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF
systemctl restart docker

# 12. Auto security updates
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades

# 13. Harden SSH (disable password auth after key works)
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/PermitRootLogin yes/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
systemctl restart sshd

echo "=== Setup Complete ==="
echo "Next steps:"
echo "1. Test SSH as deploy user: ssh -i ~/.ssh/perdiemify deploy@45.77.120.186"
echo "2. Clone repo: cd /opt/perdiemify && git clone <repo-url> ."
echo "3. Copy .env file to /opt/perdiemify/.env"
echo "4. Run: docker compose -f infra/docker-compose.prod.yml up -d"
```

## Post-Setup SSH Access

After running setup, switch to the `deploy` user for all future work:
```bash
# Use this going forward (not root):
ssh -i ~/.ssh/perdiemify deploy@45.77.120.186

# Deploy new code:
cd /opt/perdiemify
git pull origin main
docker compose -f infra/docker-compose.prod.yml up -d --build
```

## Daily PostgreSQL Backup (add to deploy user crontab)

```bash
# Run: crontab -e (as deploy user), add:
0 3 * * * docker exec perdiemify-postgres-1 pg_dump -U perdiemify perdiemify | gzip > /opt/perdiemify/backups/db-$(date +\%Y\%m\%d).sql.gz && find /opt/perdiemify/backups -mtime +7 -delete
```

---

# 2. TARGET USERS

| Segment | Per Diem Source | Key Need |
|---------|----------------|----------|
| Government/Federal | GSA per diem rates | Stay within limits, pocket M&IE savings |
| Military (TDY/PCS) | JTR per diem rates | Optimize lodging + meals split |
| Corporate travelers | Company travel policy | Cheapest compliant options |
| Contractors/Consultants | Client-reimbursed per diem | Maximize savings on long assignments |

**Primary persona — "Road Warrior Rachel":** Contractor, travels 3-4 weeks/month. $150/night lodging + $79/day M&IE. Wants to pocket as much as possible while staying comfortable. Books 150+ hotel nights/year.

---

# 3. ARCHITECTURE

## Hybrid: Cloudflare (Edge) + Vultr (Compute)

```
                     ┌─────────────────────┐
                     │     USERS (PWA)      │
                     └──────────┬───────────┘
                                │
                ┌───────────────▼────────────────┐
                │    CLOUDFLARE EDGE LAYER        │
                │                                 │
                │  ┌───────────┐  ┌────────────┐ │
                │  │ CF Pages  │  │ CF Workers │ │
                │  │ (Next.js  │  │ (API Gate- │ │
                │  │  SSR/SSG) │  │  way, Auth, │ │
                │  │           │  │  Cache)     │ │
                │  └───────────┘  └─────┬──────┘ │
                │  ┌────────────────────┘        │
                │  │ CF KV (cache) + R2 (files)  │
                │  └─────────────────────────────│
                └────────────────┬───────────────┘
                                 │
                   ┌─────────────▼──────────────┐
                   │   VULTR VPS (Docker)         │
                   │   High Frequency 4vCPU/8GB   │
                   │                              │
                   │  ┌─────────────────────┐    │
                   │  │ Express API Server   │    │
                   │  └──────────┬──────────┘    │
                   │  ┌──────────▼──────────┐    │
                   │  │ Services: Search,    │    │
                   │  │ PerDiem, Loyalty,    │    │
                   │  │ Meals, AI Planner    │    │
                   │  └─────────────────────┘    │
                   │  ┌─────────────────────┐    │
                   │  │ Puppeteer Scrapers   │    │
                   │  │ (headless Chrome)    │    │
                   │  └─────────────────────┘    │
                   │  ┌─────────────────────┐    │
                   │  │ BullMQ Workers       │    │
                   │  │ (jobs, crons)        │    │
                   │  └─────────────────────┘    │
                   │  ┌──────────┐ ┌──────────┐  │
                   │  │PostgreSQL│ │  Redis   │  │
                   │  │  (Docker)│ │ (Docker) │  │
                   │  └──────────┘ └──────────┘  │
                   │  ┌──────────────────────┐   │
                   │  │ Nginx + Uptime Kuma  │   │
                   │  └──────────────────────┘   │
                   └──────────────────────────────┘
```

### Why This Split

| Component | Where | Reason |
|-----------|-------|--------|
| Frontend (Next.js) | Cloudflare Pages | Global CDN, instant deploys, free SSL |
| API Gateway + Cache | Cloudflare Workers | Edge-fast auth, rate limiting, response caching |
| Core API (business logic) | Vultr | No CPU/time limits, persistent DB connections |
| PostgreSQL | Vultr (Docker) | Self-hosted = $0 extra, full control |
| Redis | Vultr (Docker) | Caching, BullMQ queue, sessions |
| Puppeteer scraping | Vultr (Docker) | Needs full Chrome — impossible on CF Workers |
| Background jobs/cron | Vultr (BullMQ) | Long-running scraping, scheduled tasks |
| File storage | Cloudflare R2 | Receipt images, exports, free egress |

### Request Flow

```
User searches → CF Pages (Next.js) → CF Worker (auth + cache check)
  → Cache HIT → instant response
  → Cache MISS → proxy to Vultr Express API
    → Amadeus + GSA.gov + discount DB → calculate per diem delta
      → attach loyalty points + discount codes → return enriched results
        → CF Worker caches in KV (15 min TTL) → user sees results
```

---

# 4. VULTR SERVER SPECS

## Recommended: High Frequency — 4 vCPU / 8GB RAM / 256GB NVMe (~$48/mo)

### What Runs on It

| Service | RAM Usage | CPU | Notes |
|---------|----------|-----|-------|
| Express API | ~200-500MB | Low-Med | Core business logic |
| PostgreSQL 16 | ~500MB-2GB | Medium | Per diem rates, users, bookings |
| Redis 7 | ~100-256MB | Low | Cache, sessions, BullMQ queue |
| Puppeteer/Chrome × 2-3 | ~500MB-1.5GB each | HIGH (spikes) | Scraping engine |
| BullMQ workers | ~100-200MB | Low-Med | Background job processing |
| Nginx | ~50MB | Low | Reverse proxy + SSL |
| Uptime Kuma | ~100MB | Low | Monitoring dashboard |
| OS + Docker | ~500MB | Low | Overhead |
| **Total baseline** | **~3-6GB** | | **8GB gives headroom** |

### Why Not Smaller

- Puppeteer/Chrome eats 500MB-1.5GB per instance. 2-3 concurrent scrapers = 3GB+ just for scraping.
- PostgreSQL needs 1-2GB for effective query caching.
- 7+ Docker containers need headroom to avoid OOM kills.
- The $24/mo difference between 4GB and 8GB prevents downtime.
- NVMe SSD is critical for PostgreSQL disk I/O performance.
- High Frequency (3GHz+ Xeon) gives faster single-thread API responses.

### Scaling Path

| Stage | Plan | Specs | Cost | Trigger |
|-------|------|-------|------|---------|
| **MVP** | High Frequency | 4 vCPU, 8GB, 256GB NVMe | ~$48/mo | Day 1 |
| **Growth** | High Frequency | 4 vCPU, 16GB, 512GB NVMe | ~$96/mo | 5K+ users or DB > 50GB |
| **Scale** | High Performance AMD | 8 vCPU, 32GB, 512GB NVMe | ~$192/mo | 25K+ users |
| **Big** | Dedicated Cloud | 8+ dedicated vCPU, 32GB+ | ~$180+/mo | 100K+ users |

### Server Location

Pick closest to primary users: **New Jersey** (DC/gov), **Dallas** (central/military), **Chicago** (balanced US latency).

---

# 5. TECH STACK

| Layer | Technology | Location | Cost |
|-------|-----------|----------|------|
| Frontend | Next.js 14+ (App Router), React, TypeScript | Cloudflare Pages | Free |
| API Gateway | Cloudflare Workers (Hono framework) | Cloudflare | Free tier |
| Core API | Node.js + Express + TypeScript | Vultr Docker | Included |
| Database | PostgreSQL 16 (Docker) | Vultr | Included |
| ORM | Drizzle ORM | — | Free |
| Cache / Queue | Redis 7 (Docker) + BullMQ | Vultr | Included |
| Scraping | Puppeteer + Cheerio (Docker) | Vultr | Included |
| Object Storage | Cloudflare R2 | Cloudflare | Free (10GB) |
| Auth | Clerk (free tier: 10K MAU) | Managed | Free |
| Payments | Stripe | Managed | 2.9% + 30¢ |
| Email | Resend (free: 3K/mo) | Managed | Free |
| State Mgmt | Zustand | — | Free |
| Data Fetching | TanStack Query (React Query) | — | Free |
| UI | shadcn/ui + Tailwind CSS | — | Free |
| Charts | Recharts | — | Free |
| Animations | Framer Motion | — | Free |
| Icons | Lucide React | — | Free |
| Analytics | Plausible (self-hosted Docker) | Vultr | Included |
| Monitoring | Uptime Kuma (Docker) | Vultr | Included |
| Domain/SSL | Cloudflare Registrar | Cloudflare | ~$10/yr |

### Monthly Costs

| Service | Month 1 | Month 3 | Month 6 |
|---------|---------|---------|---------|
| Vultr (4vCPU/8GB HF) | $48 | $48 | $48-96 |
| Cloudflare | $0 | $0 | $0-5 |
| Clerk | $0 | $0 | $0 |
| Stripe fees | $0 | ~$50 | ~$200 |
| Amadeus API | $0 | $0-50 | $50-100 |
| Domain | $1 | $1 | $1 |
| Resend | $0 | $0 | $0-20 |
| **Total** | **~$49** | **~$100-150** | **~$300-425** |

---

# 6. BRAND & DESIGN SYSTEM

| Element | Detail |
|---------|--------|
| Colors (primary) | Emerald green: `#10b981` (brand-500), `#047857` (brand-700) |
| Colors (accent) | Warm amber: `#f59e0b` (accent-500) |
| Colors (per diem) | Under budget: `#10b981` 🟢, Near limit: `#f59e0b` 🟡, Over: `#ef4444` 🔴 |
| Font | Plus Jakarta Sans (fallback: Inter, system-ui) |
| Border radius | 0.75rem default (friendly, rounded) |
| Logo | Clean wordmark "Perdiemify" with subtle upward arrow or pocket icon |
| Tone | "You saved $47!" not "Savings: $47.00" — always celebrate |

### Tailwind Config Tokens

```javascript
colors: {
  brand: { 50: '#f0fdf4', 100: '#dcfce7', 500: '#10b981', 600: '#059669', 700: '#047857', 900: '#064e3b' },
  accent: { 50: '#fffbeb', 500: '#f59e0b', 600: '#d97706' },
  perdiem: { under: '#10b981', near: '#f59e0b', over: '#ef4444' },
},
fontFamily: { sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'] },
borderRadius: { DEFAULT: '0.75rem' },
```

### Design Principles

1. Per diem delta is the hero — biggest number on every result card
2. Friendly, not corporate — rounded corners, warm colors, casual microcopy
3. Side-by-side always — 💰 Savings Max vs ⭐ Smart Value on every search
4. Traffic light badges — 🟢🟡🔴 at a glance
5. Mobile-first — 375px minimum, thumb-zone navigation
6. Celebrate savings — confetti on milestones, progress bars, streaks

---

# 7. DATABASE SCHEMA

```sql
-- Users (synced from Clerk webhook)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  subscription_tier VARCHAR(20) DEFAULT 'free',
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  per_diem_source VARCHAR(20) DEFAULT 'gsa',
  custom_lodging_rate DECIMAL(10,2),
  custom_mie_rate DECIMAL(10,2),
  referral_code VARCHAR(20) UNIQUE,
  referred_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trips
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  destination VARCHAR(255) NOT NULL,
  destination_state VARCHAR(2),
  origin VARCHAR(255),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  lodging_rate DECIMAL(10,2) NOT NULL,
  mie_rate DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  total_savings DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bookings (affiliate tracking)
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  type VARCHAR(20) NOT NULL,
  provider VARCHAR(100) NOT NULL,
  provider_name VARCHAR(255),
  price DECIMAL(10,2) NOT NULL,
  per_diem_delta DECIMAL(10,2),
  affiliate_partner VARCHAR(100),
  affiliate_link TEXT,
  booking_ref VARCHAR(255),
  loyalty_program VARCHAR(100),
  loyalty_points_earned INTEGER DEFAULT 0,
  discount_code_used VARCHAR(100),
  check_in DATE,
  check_out DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Loyalty Programs
CREATE TABLE loyalty_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  program_name VARCHAR(100) NOT NULL,
  program_category VARCHAR(20) NOT NULL,
  account_number VARCHAR(255),
  points_balance INTEGER DEFAULT 0,
  status_level VARCHAR(50),
  status_progress INTEGER DEFAULT 0,
  status_next_tier_at INTEGER,
  point_value_cents DECIMAL(5,3),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, program_name)
);

-- Discount Codes
CREATE TABLE discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(100) NOT NULL,
  provider VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL,
  value DECIMAL(10,2),
  description TEXT,
  source VARCHAR(100) NOT NULL,
  source_url TEXT,
  expires_at TIMESTAMPTZ,
  is_validated BOOLEAN DEFAULT FALSE,
  last_validated_at TIMESTAMPTZ,
  success_rate DECIMAL(3,2) DEFAULT 0,
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  applicable_to VARCHAR(20) DEFAULT 'all',
  submitted_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Meals (M&IE tracking)
CREATE TABLE meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  meal_type VARCHAR(20) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  vendor VARCHAR(255),
  notes TEXT,
  receipt_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Receipts
CREATE TABLE receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  image_url TEXT NOT NULL,
  ocr_vendor VARCHAR(255),
  ocr_amount DECIMAL(10,2),
  ocr_date DATE,
  ocr_category VARCHAR(50),
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Per Diem Rates (cached from GSA)
CREATE TABLE perdiem_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year INTEGER NOT NULL,
  state VARCHAR(2) NOT NULL,
  city VARCHAR(255) NOT NULL,
  county VARCHAR(255),
  lodging_rate DECIMAL(10,2) NOT NULL,
  mie_rate DECIMAL(10,2) NOT NULL,
  month INTEGER,
  effective_date DATE,
  UNIQUE(fiscal_year, state, city, county, month)
);

-- Points Valuations (scraped)
CREATE TABLE loyalty_valuations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_name VARCHAR(100) UNIQUE NOT NULL,
  point_value_cents DECIMAL(5,3) NOT NULL,
  best_redemption_type VARCHAR(100),
  source VARCHAR(100),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Featured Listings (marketplace)
CREATE TABLE featured_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_name VARCHAR(255) NOT NULL,
  listing_type VARCHAR(50) NOT NULL,
  target_destinations TEXT[],
  creative_url TEXT,
  landing_url TEXT NOT NULL,
  cpc_rate DECIMAL(10,4),
  cpm_rate DECIMAL(10,4),
  monthly_fee DECIMAL(10,2),
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scraper Logs
CREATE TABLE scraper_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL,
  codes_found INTEGER DEFAULT 0,
  codes_new INTEGER DEFAULT 0,
  duration_ms INTEGER,
  error_message TEXT,
  run_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_trips_user ON trips(user_id);
CREATE INDEX idx_trips_status ON trips(status);
CREATE INDEX idx_bookings_user ON bookings(user_id);
CREATE INDEX idx_bookings_trip ON bookings(trip_id);
CREATE INDEX idx_bookings_type ON bookings(type);
CREATE INDEX idx_meals_trip_date ON meals(trip_id, date);
CREATE INDEX idx_meals_user ON meals(user_id);
CREATE INDEX idx_discount_codes_provider ON discount_codes(provider);
CREATE INDEX idx_discount_codes_applicable ON discount_codes(applicable_to);
CREATE INDEX idx_discount_codes_expires ON discount_codes(expires_at);
CREATE INDEX idx_perdiem_rates_lookup ON perdiem_rates(fiscal_year, state, city);
CREATE INDEX idx_loyalty_user ON loyalty_accounts(user_id);
CREATE INDEX idx_receipts_user ON receipts(user_id);
CREATE INDEX idx_featured_active ON featured_listings(is_active);
```

---

# 8. FILE STRUCTURE

```
perdiemify/
├── CLAUDE.md                          # THIS FILE
├── .github/
│   └── workflows/
│       ├── deploy-frontend.yml        # CF Pages auto-deploy
│       └── deploy-backend.yml         # SSH deploy to Vultr
├── apps/
│   └── web/                           # Next.js → Cloudflare Pages
│       ├── public/
│       │   ├── manifest.json
│       │   ├── sw.js
│       │   └── icons/
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx
│       │   │   ├── page.tsx           # Landing + hero
│       │   │   ├── (auth)/sign-in/ & sign-up/
│       │   │   ├── search/page.tsx    # Unified results
│       │   │   ├── search/flights/ & hotels/ & cars/
│       │   │   ├── dashboard/page.tsx
│       │   │   ├── dashboard/savings/ & trips/ & loyalty/ & meals/
│       │   │   ├── deals/page.tsx     # Discount codes feed
│       │   │   ├── planner/page.tsx   # AI trip planner
│       │   │   ├── pricing/page.tsx   # Subscription plans
│       │   │   └── settings/page.tsx  # Profile, per diem config
│       │   ├── components/
│       │   │   ├── ui/                # shadcn/ui
│       │   │   ├── layout/            # Header, Footer, Sidebar, MobileNav
│       │   │   ├── search/            # UnifiedSearchBar, FlightSearchForm, HotelSearchForm, CarSearchForm
│       │   │   ├── results/           # ResultCard, PerDiemBadge, SavingsComparison, DiscountCodeTag, LoyaltyPointsChip
│       │   │   ├── dashboard/         # SavingsChart, PerDiemBreakdown, TripTimeline, QuickStats
│       │   │   ├── loyalty/           # ProgramCard, PointsValuation, StatusProgress
│       │   │   ├── meals/             # MealEntry, MIEBalance, DailyMealSummary
│       │   │   └── receipts/          # ReceiptScanner, ExpenseReport
│       │   ├── hooks/                 # useSearch, usePerDiem, useDiscountCodes, useLoyalty, useMeals, useSubscription
│       │   ├── lib/                   # api.ts, perdiem.ts, loyalty.ts, affiliates.ts, utils.ts
│       │   ├── stores/               # Zustand: searchStore, userStore, mealStore
│       │   └── types/index.ts
│       ├── next.config.js
│       ├── tailwind.config.ts
│       └── package.json
├── packages/
│   ├── api/                           # Express API → Vultr Docker
│   │   ├── Dockerfile
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── routes/               # search, perdiem, discounts, loyalty, meals, trips, receipts, planner, auth, billing
│   │   │   ├── services/             # search-aggregator, gsa-rates, discount-engine, loyalty-tracker, meal-tracker, receipt-ocr, ai-planner
│   │   │   ├── providers/            # amadeus, skyscanner, kiwi, booking
│   │   │   ├── middleware/           # auth, rateLimit, cache, subscription
│   │   │   ├── db/                   # Drizzle client, schema, migrations
│   │   │   ├── queue/                # BullMQ worker, jobs, scheduler
│   │   │   └── utils/                # redis, stripe, logger
│   │   └── package.json
│   ├── scraper/                       # Scraping engine → Vultr Docker
│   │   ├── Dockerfile
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── base-scraper.ts
│   │   │   ├── coupon-scraper.ts
│   │   │   ├── airline-promo-scraper.ts
│   │   │   ├── hotel-deal-scraper.ts
│   │   │   ├── reddit-deals-scraper.ts
│   │   │   ├── flyertalk-scraper.ts
│   │   │   ├── gov-discount-scraper.ts
│   │   │   └── validator.ts
│   │   └── package.json
│   ├── gateway/                       # Cloudflare Worker (API gateway)
│   │   ├── src/index.ts              # Hono: auth check, cache, proxy to Vultr
│   │   ├── wrangler.toml
│   │   └── package.json
│   └── shared/                        # Shared types, constants, validators
│       └── src/types.ts, constants.ts, validators.ts
├── infra/
│   ├── docker-compose.yml             # Dev
│   ├── docker-compose.prod.yml        # Production (see Section 9)
│   ├── nginx/nginx.conf
│   └── scripts/
│       ├── setup-vultr.sh             # Server bootstrap
│       ├── deploy.sh
│       ├── backup-db.sh
│       └── seed-perdiem-rates.ts
├── turbo.json
├── package.json
└── README.md
```

---

# 9. DOCKER COMPOSE (Production)

```yaml
version: '3.8'

services:
  api:
    build: ./packages/api
    ports: ["3001:3001"]
    env_file: .env
    depends_on: [postgres, redis]
    restart: unless-stopped
    networks: [perdiemify]

  scraper:
    build: ./packages/scraper
    env_file: .env
    depends_on: [postgres, redis]
    restart: unless-stopped
    networks: [perdiemify]

  worker:
    build: ./packages/api
    command: node dist/queue/worker.js
    env_file: .env
    depends_on: [postgres, redis]
    restart: unless-stopped
    networks: [perdiemify]

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: perdiemify
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: perdiemify
    volumes: [pgdata:/var/lib/postgresql/data]
    ports: ["127.0.0.1:5432:5432"]
    restart: unless-stopped
    networks: [perdiemify]

  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 512mb --maxmemory-policy allkeys-lru
    volumes: [redisdata:/data]
    ports: ["127.0.0.1:6379:6379"]
    restart: unless-stopped
    networks: [perdiemify]

  nginx:
    image: nginx:alpine
    ports: ["80:80", "443:443"]
    volumes:
      - ./infra/nginx/nginx.conf:/etc/nginx/nginx.conf
      - /etc/letsencrypt:/etc/letsencrypt
    depends_on: [api]
    restart: unless-stopped
    networks: [perdiemify]

  uptime-kuma:
    image: louislam/uptime-kuma:1
    ports: ["127.0.0.1:3010:3001"]
    volumes: [uptimekuma:/app/data]
    restart: unless-stopped
    networks: [perdiemify]

volumes:
  pgdata:
  redisdata:
  uptimekuma:

networks:
  perdiemify:
    driver: bridge
```

---

# 10. CI/CD PIPELINES

**Frontend (auto on push):**
```yaml
# .github/workflows/deploy-frontend.yml
on:
  push:
    branches: [main]
    paths: ['apps/web/**', 'packages/shared/**']
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci && npm run build --workspace=apps/web
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          command: pages deploy apps/web/.next --project-name=perdiemify
```

**Backend (SSH to Vultr on push):**
```yaml
# .github/workflows/deploy-backend.yml
on:
  push:
    branches: [main]
    paths: ['packages/api/**', 'packages/scraper/**', 'packages/shared/**', 'infra/**']
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: appleboy/ssh-action@v1
        with:
          host: 45.77.120.186
          username: deploy
          key: ${{ secrets.VULTR_SSH_KEY }}
          script: |
            cd /opt/perdiemify
            git pull origin main
            docker compose -f infra/docker-compose.prod.yml build
            docker compose -f infra/docker-compose.prod.yml up -d
            docker system prune -f
```

**GitHub Secrets to configure:**

| Secret Name | Value |
|-------------|-------|
| `CLOUDFLARE_API_TOKEN` | Your Cloudflare API token |
| `VULTR_SSH_KEY` | Contents of `~/.ssh/perdiemify` (private key) |

Note: `VULTR_HOST` is hardcoded as `45.77.120.186`. If server IP changes, update the workflow file.

---

# 11. ALL PHASES (Detailed Build Documentation)

Each phase is self-contained and produces a deployable increment. Claude Code should build each phase completely before moving to the next.

---

## PHASE 1: MVP Core (Weeks 1-2) — "Search & Save"

**Goal:** Users search hotels/flights/cars, see per diem impact, click affiliate links to book, subscribe to Pro.

### Week 1 (Days 1-7)

**Day 1 — Scaffolding:**
- Turborepo monorepo with `apps/web`, `packages/api`, `packages/scraper`, `packages/gateway`, `packages/shared`
- Next.js 14+ App Router in `apps/web` with Tailwind + shadcn/ui
- Express + TypeScript in `packages/api`
- Docker Compose for Vultr (Postgres, Redis, API, Nginx)
- GitHub repo + connect to Cloudflare Pages
- Deploy "Coming Soon" landing page
- DNS: perdiemify.com → CF Pages, api.perdiemify.com → Vultr (CF proxied)

**Day 2 — Auth & Profiles:**
- Clerk integration (sign-up, sign-in, user sync webhook)
- User profile page: name, email, per diem type selector (GSA / JTR / Corporate / Custom)
- Custom rate inputs for Corporate/Custom
- DB migration: create `users` table
- Clerk webhook → sync user to PostgreSQL

**Day 3 — Per Diem Engine:**
- GSA per diem rate API integration: `https://api.gsa.gov/travel/perdiem/v2/rates/city/{city}/state/{state}/year/{year}`
- Cache all rates in `perdiem_rates` table by fiscal year
- Per diem calculator core logic (TypeScript):
  - Input: destination, dates, per diem source
  - Output: lodging rate, MIE rate, first/last day rate (75%), total allowance
- API route: `GET /api/perdiem/rates?city=Denver&state=CO`
- City search autocomplete component

**Day 4 — Hotel Search:**
- Amadeus Hotel Search API integration (free tier)
- `POST /api/search/hotels` → aggregated results
- Each result enriched with: per diem delta, traffic light badge (🟢🟡🔴)
- `ResultCard` component showing: hotel name, price/night, per diem badge, "You pocket $X/night"
- `SavingsComparison` component: side-by-side 💰 Savings Max vs ⭐ Smart Value
- Redis cache for search results (TTL: 15 min)

**Day 5 — Flights & Cars:**
- Amadeus Flight Offers Search API integration
- Amadeus Car Rental Search API integration (if unavailable, Skyscanner/Kiwi fallback)
- `POST /api/search/flights` and `POST /api/search/cars`
- `UnifiedSearchBar` component: destination, dates, search type tabs
- Unified results page with tabs: Hotels | Flights | Cars
- Per diem impact shown on every result

**Day 6 — Affiliate Links:**
- Travelpayouts affiliate account integration
- Booking.com affiliate deep link builder
- `affiliates.ts` utility: given a search result, generate the correct affiliate booking URL
- Every `ResultCard` gets a "Book Now" button → affiliate link (opens in new tab)
- Track clicks in `bookings` table (even before confirmed booking)
- Affiliate link UTM parameters for tracking

**Day 7 — Trips & Dashboard:**
- Trip CRUD: create trip (destination, dates, per diem rates auto-loaded)
- Link bookings to trips
- Basic dashboard: list of trips, total savings number, recent bookings
- `QuickStats` component: total savings, active trips, loyalty programs count

### Week 2 (Days 8-14)

**Day 8 — Payments:**
- Stripe integration: products for Pro ($9.99/mo, $99/yr) and Pro+ ($19.99/mo, $199/yr)
- `POST /api/billing/checkout` → Stripe Checkout session
- `POST /api/billing/webhook` → handle subscription events
- `subscription.ts` middleware: check `users.subscription_tier` on protected routes
- Feature gates: free = 5 searches/day, Pro/Pro+ = unlimited
- `/pricing` page with comparison table + Stripe Checkout buttons

**Day 9 — Discount Codes (Basic):**
- 3 initial scrapers: RetailMeNot (Cheerio), airline promo pages (Cheerio), Reddit r/churning (Reddit API)
- Base scraper class with error handling, rate limiting, logging
- BullMQ scheduler: run scrapers every 6 hours
- Store codes in `discount_codes` table
- `DiscountCodeTag` component on search result cards
- `/deals` page: browse all current codes by category
- Redis cache layer for active codes

**Day 10 — Loyalty Tracker (Basic):**
- `loyalty_accounts` CRUD API
- Manual entry: program name, category, balance, status level
- Supported programs list (airlines, hotels, cars, credit cards)
- `ProgramCard` component on loyalty dashboard
- Points valuation display (hardcoded initial values, scraping in Phase 3)
- `LoyaltyPointsChip` on search result cards: "Earn ~2,400 pts"

**Day 11 — Meal Tracker:**
- `meals` CRUD API
- Quick-entry UI: select meal type, enter amount, optional vendor
- `MIEBalance` component: daily progress bar against M&IE rate
- First/last travel days auto-calculate at 75% rate
- `DailyMealSummary`: breakdown of today's meals + remaining budget
- Link meals to active trip

**Day 12 — PWA:**
- `manifest.json`: name, icons (192/512), theme color (#10b981), display: standalone
- Service worker: cache app shell, API responses for offline viewing
- Install prompt component (show after 2nd visit)
- Mobile optimization pass: touch targets, bottom nav, swipe gestures

**Day 13 — Landing Page & SEO:**
- Hero section: tagline, search bar, "Start saving" CTA
- Feature cards: search, per diem calc, discount codes, loyalty, meals
- Social proof section (placeholder testimonials)
- Pricing section (embedded from /pricing)
- Footer: links, legal pages
- SEO: meta titles, descriptions, OG images for all routes
- Sitemap generation

**Day 14 — Launch:**
- End-to-end testing: sign up → set profile → search → see results → click affiliate link → create trip → track meals
- Bug fixes and polish
- Performance audit (Lighthouse target: 90+)
- Deploy all services to production
- Verify CI/CD pipelines work
- Soft launch 🚀

---

## PHASE 2: Discount Engine (Weeks 3-4) — "Find Deals"

**Goal:** Full scraping infrastructure with 7+ sources, community submissions, and real-time code validation.

**Deliverables:**
- Puppeteer-based scrapers (Docker container with headless Chrome)
- Additional scrapers: hotel chain offers, FlyerTalk, GovX/ID.me, SlickDeals travel
- Code validation engine (attempt to verify codes are still active)
- Community deal submission form (Pro+ feature) with upvote/downvote
- Deal alert emails via Resend for Pro+ users
- Enhanced `/deals` page with filtering, sorting, search
- Scraper health dashboard (scraper_logs monitoring)
- Circuit breakers for blocked/changed scraping targets

**Technical notes:**
- Puppeteer runs in `packages/scraper` Docker container
- Each scraper extends `BaseScraper` class
- Max 1 req/sec per domain, rotating user agents
- BullMQ handles job scheduling, retries, concurrency limits
- Respect robots.txt on all targets

---

## PHASE 3: Loyalty System (Weeks 5-6) — "Track Points"

**Goal:** Full loyalty tracking with points valuations, credit card optimizer, and elite status tracking.

**Deliverables:**
- Points valuation scraper (ThePointsGuy, NerdWallet) → `loyalty_valuations` table
- Auto-update valuations weekly
- Credit card recommendation engine: given a booking, suggest which user card earns most points
- Elite status progress tracker with visual progress bars
- Points transfer optimization suggestions
- Enhanced search results: show specific points earned and dollar value per booking
- OAuth integration for loyalty programs that support it (stretch)

---

## PHASE 4: Receipts & Expenses (Weeks 7-8) — "Track Every Dollar"

**Goal:** Receipt scanning via OCR, expense report generation, compliance reporting.

**Deliverables:**
- Camera capture component (mobile-first)
- Server-side OCR via Tesseract.js on Vultr
- Auto-extract vendor, amount, date, category from receipt images
- Receipt image storage on Cloudflare R2 (presigned upload URLs)
- Expense report generation: PDF + CSV export
- Per diem compliance summary (under/over for each day of trip)
- Export formats compatible with Concur, Expensify (CSV templates)

---

## PHASE 5: AI Trip Planner (Weeks 9-10) — "Plan Smart"

**Goal:** AI-powered trip planning that generates per diem-optimized itineraries.

**Deliverables:**
- `/planner` chat interface
- Input: destination, dates, worksite address, per diem rates, preferences
- Output: recommended hotel + car + meal budget + nearby amenities (grocery, gym, restaurants)
- Recommendations link to actual bookable search results
- Trip template saving and sharing
- "Re-optimize" button
- Usage limits: Free=0, Pro=3/month, Pro+=unlimited

**Technical:** Claude API (claude-sonnet-4-5-20250929), structured JSON responses, conversation history stored.

---

## PHASE 6: Analytics Dashboard (Weeks 11-12) — "See Your Savings"

**Goal:** Beautiful savings analytics with charts, trends, and exportable reports.

**Deliverables:**
- Cumulative savings line chart (Recharts)
- Savings by category donut chart (lodging / M&IE / transport)
- Trip-by-trip comparison bar chart
- Monthly/quarterly/annual summaries
- "You've saved $X this year" hero stat with confetti animation
- Projected annual savings based on upcoming trips
- Savings streak tracker
- Exportable analytics PDF for tax purposes
- Year-end summary email
- Performance optimization pass (Lighthouse 90+)
- Accessibility audit (WCAG 2.1 AA)

---

## PHASE 7: Marketplace & Content (Month 3-4) — "Monetize Deeper"

**Goal:** Featured listings marketplace, newsletter, SEO content, referral program.

**Deliverables:**
- `featured_listings` CRUD + advertiser self-serve dashboard
- "Per Diem Approved" badge system
- Sponsored search result placements (clearly labeled)
- Impression/click tracking for advertisers
- Weekly newsletter via Resend + React Email
- Newsletter sponsor slot
- SEO pages: "Best Per Diem Hotels in [City]" for top 50 cities
- Blog/guides: "How to Maximize Your GSA Per Diem" etc.
- Referral program: unique codes, both users get 1 month Pro free
- Social sharing for savings milestones

---

## PHASE 8: Enterprise B2B (Month 5-6) — "Sell to Companies"

**Goal:** Team and Business subscription plans for organizations.

**Deliverables:**
- Team plan ($299/mo, 5-25 users): admin dashboard, policy enforcement, team savings reports
- Business plan ($999/mo, 25-200 users): + SSO/SAML, API access, expense system integration, dedicated account manager
- Admin dashboard: org-wide savings, per-employee breakdown, compliance metrics
- Travel policy engine: set per diem limits by role/department/project
- Auto-enforce policies at search time (filter non-compliant results)
- Manager approval workflow for over-per-diem bookings
- Team savings leaderboard (gamification)
- Bulk user invite/management
- Stripe multi-seat billing

---

## PHASE 9: API & White-Label (Month 7-9) — "Platform Play"

**Goal:** License Perdiemify's capabilities as APIs and white-label.

**Deliverables:**
- Public API with rate limiting and API key management
- API products: Per Diem Rate API ($199/mo), Calculator API ($499/mo), Discount Code API ($999/mo), Loyalty Valuation API ($499/mo)
- API documentation (OpenAPI/Swagger)
- Developer portal with signup, key management, usage dashboards
- White-label option: custom branding, custom domain, dedicated instance
- White-label pricing: $10K-50K setup + $2K-10K/month
- Plugin for SAP Concur marketplace (stretch)

---

## PHASE 10: Financial Products & Scale (Year 2) — "Own the Category"

**Goal:** Explore financial products, government contracts, international expansion.

**Deliverables:**
- Research and potentially launch co-branded credit card (partner with Brex/Ramp)
- Per diem wallet concept (deposit allowance, auto-save difference)
- Travel insurance white-label (Allianz/Travel Guard partnership)
- GSA Schedule listing pursuit for government contracts
- International per diem support (OCONUS rates, EU per diem)
- Data products: anonymized travel data reports for hotels, airlines, investors
- Quarterly "State of Per Diem Travel" report

---

# 12. MONETIZATION SUMMARY (All 12 Streams)

| # | Stream | When | Revenue Model |
|---|--------|------|--------------|
| 1 | **Affiliate commissions** | Day 1 | 3-40% per booking via Travelpayouts, Booking.com, Skyscanner, etc. |
| 2 | **Premium subscriptions** | Week 2 | Free / Pro $9.99/mo / Pro+ $19.99/mo via Stripe |
| 3 | **Featured listings** | Month 2 | $200-500/mo per property badge, $1.50-5/click, CPM ads |
| 4 | **Non-travel affiliates** | Month 2 | eSIM, VPN, TSA PreCheck, luggage, parking (3-30%) |
| 5 | **Sponsored content** | Month 3 | Newsletter sponsors $500-2K/send, blog sponsors $2K-10K |
| 6 | **Enterprise SaaS** | Month 5 | Team $299/mo, Business $999/mo, Enterprise $3-8/user/mo |
| 7 | **API licensing** | Month 7 | $199-999/mo per API product |
| 8 | **White-label** | Month 9 | $10K-50K setup + $2K-10K/mo |
| 9 | **Government contracts** | Month 9+ | GSA Schedule, $50K-5M per contract |
| 10 | **Data & insights** | Year 2 | $5K-50K per report |
| 11 | **Financial products** | Year 2 | Card interchange, wallet float interest, insurance commissions |
| 12 | **Expert booking** | Year 2 | $25-50/booking or 15-25% commission |

---

# 13. ENVIRONMENT VARIABLES

```env
# === VULTR (.env) ===
DB_PASSWORD=<secure>
DATABASE_URL=postgresql://perdiemify:${DB_PASSWORD}@postgres:5432/perdiemify
REDIS_URL=redis://redis:6379
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=
AMADEUS_API_KEY=
AMADEUS_API_SECRET=
SKYSCANNER_API_KEY=
KIWI_API_KEY=
TRAVELPAYOUTS_API_KEY=
BOOKING_AFFILIATE_ID=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRO_PRICE_ID=
STRIPE_PROPLUS_PRICE_ID=
RESEND_API_KEY=
ANTHROPIC_API_KEY=
API_PORT=3001
NODE_ENV=production
CORS_ORIGIN=https://perdiemify.com
R2_ACCOUNT_ID=
R2_ACCESS_KEY=
R2_SECRET_KEY=
R2_BUCKET=perdiemify-uploads

# === CLOUDFLARE PAGES (dashboard env vars) ===
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
NEXT_PUBLIC_API_URL=https://api.perdiemify.com
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# === CF WORKER GATEWAY (wrangler secrets) ===
VULTR_API_ORIGIN=http://45.77.120.186:3001
CLERK_SECRET_KEY=
```

---

# 14. KEY METRICS

| Metric | Target | Phase |
|--------|--------|-------|
| Booking conversion | 3-5% of searches → clicks | Phase 1 |
| Free → Pro conversion | 10-15% | Phase 1 |
| Pro monthly churn | <5% | Phase 1+ |
| Revenue per user (ARPU) | $5-15/month | Phase 2+ |
| LTV (12-month) | $200+ | Phase 3+ |
| CAC | <$65 | Phase 7+ |
| Discount code validity | 60%+ | Phase 2 |
| DAU/MAU ratio | >30% | Phase 3+ |
| Time to first booking | <5 minutes | Phase 1 |
| Enterprise pipeline | 3+ demos/week | Phase 8 |

---

# 15. CLAUDE CODE RULES

1. Build complete, runnable files. Every file must work when deployed.
2. Follow the folder structure in Section 8 exactly.
3. Per diem delta on EVERY search result. This is THE differentiator.
4. Both comparison modes visible: 💰 Savings Max + ⭐ Smart Value, side by side.
5. Affiliate links on EVERY bookable result. This is day-1 revenue.
6. Subscription gates as middleware. Check tier before serving premium features.
7. Full TypeScript, strict mode. No `any` types.
8. Docker-first backend. Everything runs in containers on Vultr.
9. Cloudflare-native frontend. Pages, Workers, KV, R2.
10. Mobile-first. 375px minimum, thumb-zone navigation.
11. Free-tier APIs first. Amadeus free, GSA.gov free, Clerk free.
12. Ship daily. Every day = a deployable increment.
13. Friendly microcopy. "You saved $47!" not "Savings: $47.00".
14. Celebrate the user. Confetti, streaks, progress bars.
15. Self-host heavy workloads. Scraping, queues, DB on Vultr Docker.
16. Edge-cache public responses. CF Workers cache in KV.
17. Drizzle ORM for all database operations.
18. BullMQ for all background jobs and cron scheduling.
19. Resend for all transactional and marketing emails.
20. Always reference this CLAUDE.md when starting a new phase.

---

# 16. HOW TO USE WITH CLAUDE CODE

**Start building:**
```
claude "Read CLAUDE.md. Start Phase 1, Day 1: repo scaffolding, Docker Compose, Next.js shell, coming soon page."
```

**Continue:**
```
claude "Continue Perdiemify. I'm on Phase 1, Day 4. Days 1-3 are done. Build Day 4: hotel search with Amadeus, results UI with per diem badges."
```

**New phase:**
```
claude "Start Phase 2 of Perdiemify. Phase 1 is complete and deployed. Read CLAUDE.md Phase 2 section and begin building the discount scraping engine."
```

**Add feature:**
```
claude "Add [feature] to Perdiemify following the architecture in CLAUDE.md."
```

**Fix issue:**
```
claude "Fix [issue] in Perdiemify. Error: [paste]. File: [paste]."
```

---

*Perdiemify — Keep the difference.*
*CLAUDE.md v4.0 Final | February 2026*
