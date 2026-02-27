# Perdiemify Session Log

## 2026-02-26 — Day 4: Hotel Search (Amadeus)

### Where we left off (last night, Feb 25)
- **Day 1** completed: Full monorepo scaffold (Turborepo, Next.js 14, Express, Docker, CI/CD, CF Workers gateway)
- **Day 3** completed: Per diem engine + search UI (GSA API, calculator, city autocomplete, badges, breakdown)
- **Day 2 skipped**: Auth & Profiles (Clerk) — not yet wired

### Phase 1 status after today
| Day | Task | Status |
|-----|------|--------|
| 1 | Scaffolding | Done |
| 2 | Auth & Profiles (Clerk) | Skipped (need Clerk account) |
| 3 | Per Diem Engine | Done |
| 4 | Hotel Search (Amadeus) | **Done** (today) |
| 5 | Flights & Cars | Not started |
| 6 | Affiliate Links | Not started |
| 7 | Trips & Dashboard | Not started |
| 8 | Payments (Stripe) | Not started |
| 9 | Discount Codes | Not started |
| 10 | Loyalty Tracker | Not started |
| 11 | Meal Tracker | Not started |
| 12 | PWA | Not started |
| 13 | Landing Page & SEO | Not started |
| 14 | Launch polish | Not started |

### Today's completed work (Feb 26)

#### Day 4 — Hotel Search (all done)
- [x] **Amadeus API provider** (`packages/api/src/providers/amadeus.ts`)
  - OAuth2 token management with caching
  - Hotel List API (by city code) + Hotel Offers API (prices)
  - 50+ city IATA code mappings (gov/military hubs)
  - Title-case name formatting (Amadeus returns ALL CAPS)
  - Sorts results by price ascending
- [x] **Search aggregator** (`packages/api/src/services/search-aggregator.ts`)
  - Enriches Amadeus results with per diem delta + badge
  - Loyalty program detection (Marriott, Hilton, IHG, Hyatt, Wyndham, Best Western, Choice)
  - Estimated loyalty points calculation per booking
  - Picks "Savings Max" (highest savings) and "Smart Value" (balance of savings + rating)
  - Prevents duplicate if same hotel would be both picks
- [x] **Updated search route** (`packages/api/src/routes/search.ts`)
  - POST /api/search/hotels now calls real Amadeus API
  - Redis cache check before API call (15 min TTL)
  - Caches successful results to avoid redundant Amadeus calls
- [x] **Redis cache utility** (`packages/api/src/utils/redis.ts`)
  - Lazy connection (app works without Redis)
  - Generic getCached/setCache with prefix-based keys
  - Non-fatal failures (cache miss = fresh API call)
- [x] **ResultCard component** (`apps/web/src/components/results/ResultCard.tsx`)
  - Hotel name, rating stars, price/night, total price
  - Per diem badge (green/yellow/red)
  - Per diem delta (+$X you keep / -$X over budget)
  - Loyalty program + estimated points
  - Room type/amenity tags
  - "Savings Max" / "Smart Value" highlight rings
  - Book Now button (opens affiliate link)
- [x] **SavingsComparison component** (`apps/web/src/components/results/SavingsComparison.tsx`)
  - Side-by-side cards: Savings Max vs Smart Value
  - Shows per-night price, rating, total savings, loyalty program
- [x] **Updated search page** (`apps/web/src/app/search/page.tsx`)
  - Tries real API first (POST /api/search/hotels)
  - Falls back to per diem calc + mock hotels if Amadeus unavailable
  - Last resort: fully offline mock data
  - "Demo data" badge when using mock results
  - Quick tip sidebar when savings available

### New files created today
```
packages/api/src/providers/amadeus.ts       — Amadeus API client
packages/api/src/services/search-aggregator.ts — Per diem enrichment
packages/api/src/utils/redis.ts             — Redis cache utility
apps/web/src/components/results/ResultCard.tsx      — Hotel result card
apps/web/src/components/results/SavingsComparison.tsx — Savings picks
```

### Files modified today
```
packages/api/src/routes/search.ts           — Real hotel search + caching
apps/web/src/app/search/page.tsx            — Real API + graceful fallback
```

### Accounts needed to go live
1. **Amadeus** (developers.amadeus.com) — hotel/flight/car search API (free tier)
2. **Stripe** (stripe.com) — payments for Pro/Pro+ subscriptions
3. **Clerk** (clerk.com) — auth (magic link + Google OAuth, free 10K MAU)
4. **Resend** (resend.com) — transactional email (free 3K/month)
5. **Vultr server** — already provisioned at 45.77.120.186, needs setup script run

### Deployment (also Feb 26)
- [x] **Vultr VPS deployed** — all 7 Docker containers running at 45.77.120.186
  - infra-api-1, infra-worker-1, infra-scraper-1
  - infra-postgres-1, infra-redis-1, infra-nginx-1, infra-uptime-kuma-1
- [x] **Docker build fixes**
  - Standalone tsconfigs (removed `extends` for Docker context)
  - Added `skipLibCheck: true` (drizzle-orm type errors)
  - Added `esModuleInterop: true` (express/cors/morgan default imports)
  - Type cast `res.json()` for strict mode TS (`as` casts)
  - Copied `tsconfig.json` in both API and scraper Dockerfiles
- [x] **API keys configured** in `.env`
  - Amadeus, Stripe, Clerk, Resend all set
- [x] **Git workflow**: push from Mac → pull on Vultr → docker compose rebuild

### Upgrades applied (Feb 26)
- Next.js 14.2 → 15.5.12 (Node 25 incompatible with Next 14)
- React 18.3 → 19.2.4
- Tried Next.js 16 but Turbopack compilation hung; reverted to 15

### Local dev status (Feb 26–27)
- [x] Next.js dev server running on port 3000 — **working**
- [x] Homepage renders correctly (Coming Soon landing page)
- [x] Search page renders: city autocomplete, date pickers, Hotels/Flights/Cars tabs
- [x] Mock search results working (Demo data fallback when API not running locally)
- [x] Hotel cards show: pricing, per diem delta, loyalty points, amenities, Book Now
- [ ] API server not running locally (only on Vultr) — need `npm run dev --workspace=packages/api`

---

## 2026-02-27 — Day 5: Landing Page Polish + Continued Build

### Next session: pick up here
- **Landing page polish** — make the Coming Soon page production-ready
- Day 5: Flight search + car rental search (Amadeus APIs)
- Day 6: Affiliate links (Travelpayouts, Booking.com)
- Day 7: Trip CRUD + dashboard
- Set up DNS/SSL for perdiemify.com → 45.77.120.186

---
*Last updated: Feb 27, 2026*
