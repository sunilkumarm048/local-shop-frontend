# Sarvopakar (ସର୍ବୋପକାର) — Frontend

**Sarvopakar** is a hyperlocal commerce platform for Odisha, India: customers
order from nearby shops with fast delivery, book local **home-service**
providers (electricians, plumbers, parlours, garages…) discoverable "near me"
with live provider location, and shop owners + delivery partners manage
everything from their own dashboards — on the web, as a PWA, or via the
native Android app. This repo is the **web client** (Next.js) and the
**Capacitor Android app**. The API lives in a separate backend repo.

> **Live:** https://www.sarvopakar.com

---

## ✨ Features

**Customer**
- Browse shops & products by category, filtered to your location
- Adjustable **"near me" search radius** (1–25 km)
- **Service discovery** — find local services (barber, parlour, laundry, etc.)
  with distance, rating, "Open now," one-tap **Call** and **Directions**
- Cart, checkout, online payment (Razorpay) or Cash on Delivery
- **Live order tracking** in real time
- Ratings, reviews, and review photos
- Installable **PWA** with push notifications
- **Service booking** — request now or schedule (date + time slot), then track
  the provider's **live location** with road distance + ETA (Ola Distance Matrix)
- **AI voice assistant** 🎤 — shop and book services by talking in **Odia,
  Hindi, or English** (Sarvam AI speech + Gemini/Sarvam-30B brain); can add to
  cart, answer prices, and create real bookings with spoken confirmations

**Shop owner**
- Guided shop setup (profile, location pin, documents, photo gallery)
- Product catalog management
- Incoming orders + status updates
- Storefront analytics

**Delivery partner**
- Go online/offline, set vehicle
- See nearby pickup jobs within an adjustable radius
- Wallet, earnings, and withdrawals
- Background **push notifications** for new jobs

**Admin**
- Approve/manage shops, users, categories
- Oversee orders, payouts, and withdrawal requests
- **Feature flags** (Settings tab) — toggle the products feed, phone login,
  and the voice assistant live, without a deploy

**Native Android app (Capacitor)**
- True **background live-location** for providers & delivery partners
  (keeps tracking with the screen off)
- **FCM push with a custom ring** that sounds even when the app is closed
- Built & signed automatically by GitHub Actions and served from the site
  (`public/sarvopakar.apk`) — no local Android toolchain needed

---

## 🛠 Tech Stack

| Area        | Tech                                              |
|-------------|---------------------------------------------------|
| Framework   | Next.js 15 (App Router) · React 18 · TypeScript   |
| Styling     | Tailwind CSS                                      |
| State       | Zustand                                           |
| Forms       | React Hook Form + Zod                             |
| Realtime    | Socket.IO client                                  |
| Payments    | Razorpay Checkout                                 |
| Media       | Cloudinary (image uploads)                        |
| PWA / Push  | Service worker + Web Push API                     |
| Hosting     | Vercel                                            |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- The [backend API](https://github.com/sunilkumarm048/Local-Shop-Backend) running
  (locally or deployed)

### Install & run
```bash
git clone https://github.com/sunilkumarm048/local-shop-frontend.git
cd local-shop-frontend
npm install
cp .env.example .env.local   # then fill in the values (see below)
npm run dev                  # http://localhost:3000
```

### Scripts
| Command              | Does                          |
|----------------------|-------------------------------|
| `npm run dev`        | Start dev server              |
| `npm run build`      | Production build              |
| `npm start`          | Run the production build      |
| `npm run lint`       | Lint                          |
| `npm run type-check` | TypeScript check (no emit)    |

---

## 🔑 Environment Variables

Create `.env.local` with:

```bash
# Base URL of the backend API (include the /api path)
NEXT_PUBLIC_API_URL=https://your-api-host/api

# Socket.IO server (usually the API host without /api)
NEXT_PUBLIC_SOCKET_URL=https://your-api-host

# Public site URL (used for SEO: sitemap, canonical, OG tags)
NEXT_PUBLIC_SITE_URL=https://your-site-url

# Cloudinary (unsigned uploads from the browser)
NEXT_PUBLIC_VOICE_API_URL=                # optional — voice endpoint override
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your_unsigned_preset
```

All client env vars are `NEXT_PUBLIC_*` (exposed to the browser by design — keep
true secrets like the Cloudinary API *secret* and the VAPID *private* key on the
backend only). The Web Push public key is fetched from the backend at runtime,
so it doesn't need an env var here.

---

## 📂 Project Structure

```
src/
├── app/                  # Next.js App Router pages
│   ├── customer/         # storefront, shop pages, service discovery
│   ├── shop/             # shop-owner dashboard
│   ├── delivery/         # delivery-partner dashboard
│   ├── admin/            # admin panel
│   ├── checkout/         # cart → payment
│   ├── orders/           # order history & tracking
│   ├── transport/        # vehicle/transport booking
│   ├── login/ signup/    # auth
│   ├── sitemap.ts        # dynamic SEO sitemap
│   ├── robots.ts         # robots.txt
│   ├── error.tsx         # error boundary
│   └── not-found.tsx     # 404
├── components/           # UI + feature components
├── lib/                  # API client, helpers (geo, push, shops…)
├── stores/               # Zustand stores (auth, cart, notifications)
└── public/               # PWA manifest, service worker, icons
```

---

## ☁️ Deployment (Vercel)

1. Import the repo in Vercel.
2. Add the environment variables above in **Project → Settings → Environment Variables**.
3. Deploy. Pushes to `main` auto-deploy.

The backend deploys separately (Render). Make sure the backend's `CLIENT_ORIGIN`
matches this app's URL, or CORS will block requests.

---

## 📌 Notes

- This is the frontend only — it needs the backend API to function.
- Built as a full hyperlocal-commerce learning project covering four roles
  (customer, shop, delivery, admin) end to end.

---

## 📄 License

Add a license of your choice (e.g. MIT) or leave unlicensed if private.
