# local-shop-frontend

Next.js 15 (App Router) frontend for Local Shop.

## Stack
- **Next.js 15** with App Router + TypeScript (strict)
- **Tailwind CSS** + **shadcn/ui** (Radix primitives)
- **Zustand** with persist — client state (cart, auth)
- **react-hook-form + zod** — form validation
- **socket.io-client** — real-time order tracking
- **Razorpay** — checkout modal (CDN-loaded)

## Routes
| Route                       | What                                                    |
|-----------------------------|---------------------------------------------------------|
| `/`                         | Landing                                                 |
| `/login`                    | Email/password + phone OTP                              |
| `/signup`                   | Email signup with role picker (customer/shop/delivery) |
| `/customer`                 | Nearby shops (geo + categories + search)               |
| `/customer/shop/[id]`       | Single shop with add-to-cart                            |
| `/checkout`                 | Cart, recipient, vehicle, Razorpay / COD               |
| `/orders`                   | My orders list                                          |
| `/orders/[id]`              | Order detail with live status (Socket.IO)              |
| `/shop`, `/delivery`, `/admin` | Placeholders for Phases 4–6                        |

## Phase 1–3 status
- [x] Next.js + TS + Tailwind + shadcn setup, brand colors
- [x] Typed API client + Socket.IO singleton
- [x] Zustand stores for auth (persisted) and cart (replaces localStorage)
- [x] Login + Signup pages with email and phone OTP flows
- [x] Customer home with nearby-shops geo search
- [x] Shop detail page with cart controls
- [x] Checkout page with Razorpay modal integration
- [x] Order tracking with Socket.IO live status updates
- [ ] Shop/delivery/admin dashboards (Phases 4–6)
- [ ] Google OAuth (one provider in Auth.js when you have credentials)

## Setup
```bash
npm install
cp .env.example .env.local   # generate AUTH_SECRET with: openssl rand -hex 32
npm run dev
```

Start the backend first (`Local-Shop-Backend`). Open http://localhost:3000.

### Razorpay
Set `NEXT_PUBLIC_RAZORPAY_KEY_ID` to your **Razorpay test publishable key**
(the Key Id, not the secret). The backend sends the same Key Id back to the
client in the checkout response, so for the client SDK we read it from the
checkout response — the env var is just a fallback for any UI that needs the
key without a checkout call.

## Production (Vercel)
- Connect this GitHub repo on Vercel
- Set every env var from `.env.example`; point `NEXT_PUBLIC_API_URL` and
  `NEXT_PUBLIC_SOCKET_URL` at the deployed backend on Render
- Framework: Next.js (auto-detected). No special config.

## Conventions
- **Server vs Client.** Anything using `useState`, `useEffect`, hooks, or
  Zustand needs `'use client'`. Server Components are fine for static pages
  that don't read auth state.
- **Auth.** Token + user persisted in `localStorage` via Zustand. On boot,
  `useUser()` calls `/api/auth/me` to revalidate. API helpers pull the token
  from the store automatically.
- **Cart.** Server prices win at checkout — the `/quotes/order` call is the
  source of truth for what the customer pays.
