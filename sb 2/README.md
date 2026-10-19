# Sony Brothers — Wholesale Store (website + installable app)

Zero-dependency Node.js store. No `npm install` needed. Requires **Node.js 22.13 or newer**.

## What's inside
- **Storefront:** home with all categories, shop/category pages with filters + sort, search, product pages (colour, size-wise quantity, "size set" button), quick-add from any product card, bag drawer with live **4-piece MOQ** meter (mix any products/sizes).
- **Login:** browse freely; **OTP on mobile** only at checkout.
- **Payments (Razorpay):** Prepaid (100%) or **COD with 20% advance** (balance collected on delivery). Signature-verified + webhook backup.
- **Orders:** confirmation page, order tracker, My Account (orders, profile, GSTIN, saved addresses), public Track Order page.
- **GST tax invoice** per order (CGST+SGST within your state, IGST outside; 5% ≤ ₹2,500/pc, 18% above — editable).
- **All Razorpay-required pages:** About, Contact (with map + form), Terms, Privacy, Shipping & Delivery, Return/Refund, Cancellation, plus FAQ, Size Guide, How Wholesale Works.
- **Instagram / YouTube / WhatsApp** buttons, floating WhatsApp chat button.
- **App:** installable PWA (Add to Home Screen on Android/iPhone), app-style bottom tab bar on mobile.
- **Admin panel** at `/admin`: dashboard + go-live checklist, orders (status, courier, AWB, COD collected, WhatsApp the customer, CSV export), products (photos with auto-compression, drag to reorder), categories, customers, messages, settings (business details, MOQ, COD %, GST, shipping fee, home page text & hero image).
- SEO: meta + Open Graph tags, product schema, sitemap.xml, robots.txt. Security: hashed OTPs, rate limits, secure cookies, HSTS.

## Try it on your computer
```
node server.js
```
Open http://localhost:3000 — test mode: OTP shows on screen, payments are simulated. Admin: http://localhost:3000/admin (password `admin123` in test mode only).

## Go live today — checklist
1. **Razorpay** (dashboard.razorpay.com): sign up → complete KYC (PAN, GST, bank). Activation usually takes 1–3 working days; in the meantime use Test keys. Give them your website URL — all required policy pages are already there.
2. **OTP SMS:** quickest is **2Factor.in** (sign up → copy API key). MSG91 also works but needs DLT template approval.
3. **Hosting** (pick one):
   - **Railway.app (easiest):** New Project → Deploy from GitHub repo (upload this folder) → it uses the Dockerfile. Add a **Volume** mounted at `/data`. Add the variables from `.env.example` under *Variables*. Settings → Domains → add `www.sonybrothers.com` and follow the DNS instructions.
   - **VPS (Hostinger / DigitalOcean, ~₹400–700/month):** install Node 22, copy the folder, create `.env` from `.env.example`, run with `pm2 start "node --no-warnings server.js" --name store`, put Nginx in front and get free SSL with `certbot --nginx`.
4. **Fill `.env`:** `SESSION_SECRET`, `ADMIN_PASSWORD`, `SITE_URL`, Razorpay keys, SMS key. With `NODE_ENV=production` the site refuses fake payments/OTPs, so nothing goes live half-configured.
5. **Razorpay webhook:** Dashboard → Webhooks → `https://YOUR-DOMAIN/api/razorpay/webhook`, events `payment.captured` and `order.paid`, copy the secret into `RAZORPAY_WEBHOOK_SECRET`.
6. **Admin → Settings:** registered name, GSTIN, address, phone, WhatsApp number, email, Instagram + YouTube links.
7. **Admin → Products:** upload real photos, adjust prices/stock. Sample catalogue (17 styles) is pre-loaded — edit or hide.
8. Place one real ₹ order yourself, then refund it from Razorpay.

> GST note: rates/threshold are pre-set per the Sept 2025 GST changes for apparel; confirm with your CA and edit in Admin → Settings if needed. Policy pages are solid templates — have them reviewed for your business.

## Android Play Store app (optional, later)
Once live on HTTPS, go to **pwabuilder.com**, enter your URL → *Package for Stores* → Android. Upload the generated file to Google Play Console (one-time $25 fee).

## Backups
Everything lives in `DATA_DIR` (`store.db` + `uploads/`). Back up that folder regularly.
