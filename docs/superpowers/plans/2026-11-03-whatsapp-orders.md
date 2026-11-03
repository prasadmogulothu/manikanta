# WhatsApp Orders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Customers add priced products to a cart, submit name/phone/address, the order is saved and opens in WhatsApp to the owner; the owner manages orders in the admin and can switch ordering on/off.

**Architecture:** Products gain per-pack prices in the existing content JSON. A public `POST /api/v1/orders/place` re-prices the cart from the saved content, stores it in a new `hh_orders` table and returns the order; the browser then opens a `wa.me` link with the message. A platform flag `features.orders` (set by the builder, owner can't change it) decides whether a site may take orders; the owner's `orders.enabled` switch decides whether it does right now.

**Tech Stack:** Next.js 16, React 19, Neon Postgres, plain CSS in `src/themes/base.css`. No new dependencies.

**Spec:** `whatsapp-order.md` plus these decisions agreed in chat (2026-11-03):
- Order by **pack size**: each product has a list of packs `{ label, price }`; customer picks a pack and a count with − / +.
- The Add button shows **only** on products with at least one pack that has a label and a price.
- WhatsApp method: plain `wa.me` link (customer presses Send). The order is saved first, so it is never lost.
- Owner switch "Take orders on WhatsApp" + editable delivery note; Manikanta's note: `Delivery available to Kollapur area only`.
- Statuses: `received`, `delivered`, `cancelled` (cancel needs a reason). Newest first.
- Builder: a shop site (`template_category: 'retail'`) can be created with ordering available.
- Added 2026-11-03: each pack may have an optional **offer price**. When set (and lower than the price), the customer pays it, and the site shows the price crossed out beside it.
- Added 2026-11-03: the customer's copy is a **Save PDF** button on the order receipt (the browser's print → Save as PDF). No PDF library, no paid WhatsApp API.

## Global Constraints

- No new npm dependencies.
- No site wording in `src/` (`scripts/modules.check.mjs` fails on `manikanta|మణికంఠ|95816`); "Kollapur" goes in content, not code.
- Never trust prices from the browser; the server prices every line from saved content.
- Every admin route uses `withAuth`; the one new public route is listed in `PUBLIC_ROUTES`.
- `npm run check` passes after every task.

## Review Focus

1. Owner edits a price, renames a product or removes a pack while it sits in a customer's cart → server refuses with `Some items changed. Please check your cart.`; nothing saved. (Task 2 test)
2. Phone typed as `+91 95816 17244`, `095816 17244`, `9581617244` → all accepted and stored as `9581617244`; `12345`, `5581617244` refused. (Task 2 test)
3. Owner switches orders off while a customer still has the page open → `403 Orders are closed right now.` (Task 3 test)
4. Telugu product names in the WhatsApp text → message survives `encodeURIComponent` / `decodeURIComponent` unchanged. (Task 2 test)
5. Customer taps Submit twice → only one order; button disabled while sending. (Task 5, manual check)

---

### Task 1: `hh_orders` table and `orders.manage` capability

**Files:**
- Create: `migrations/003_orders.sql`
- Modify: `scripts/migrate.check.mjs`

**Interfaces:**
- Produces: table `hh_orders(id bigint identity, site_id uuid, name text, phone text, address text, items jsonb, total int, status text default 'received', cancel_reason text, ip text, created_at, updated_at)`; capability `'orders.manage'` accepted by `hh_roles_caps_known`.

- [ ] **Step 1: Add checks to `scripts/migrate.check.mjs`**, before `set role hh_app`:
  - inserting a role with caps `'{orders.manage}'` succeeds;
  - `insert into hh_orders (site_id, name, phone, address, items, total, ip, status) values (A, 'x','9581617244','x','[]',1,'i','shipped')` is refused (unknown status).

  After `set role hh_app`:
  - insert an order for site A succeeds; `update hh_orders set status = 'delivered', cancel_reason = null, updated_at = now()` succeeds;
  - refused: `update hh_orders set total = 0` ("no re-pricing an order"), `update hh_orders set site_id = B` ("no moving orders"), `delete from hh_orders` ("orders are kept").

- [ ] **Step 2: Run `node scripts/migrate.check.mjs`** — expect FAIL (relation `hh_orders` does not exist).

- [ ] **Step 3: Write `migrations/003_orders.sql`**: drop and re-add `hh_roles_caps_known` with the existing list plus `'orders.manage'`; create `hh_orders` as above with `status check (status in ('received','delivered','cancelled'))`; indexes `(site_id, id desc)` and `(ip, created_at)`; `grant select, insert on hh_orders to hh_app; grant update (status, cancel_reason, updated_at) on hh_orders to hh_app;`. Header comment: orders are never deleted or re-priced by the app.

- [ ] **Step 4: Run `node scripts/migrate.check.mjs`** — expect `migrate.check: ok`.

- [ ] **Step 5: Commit** `Orders table and orders.manage capability`.

---

### Task 2: Order rules (pure)

**Files:**
- Create: `src/lib/orders.ts` (pure, no imports, like `content.ts`)
- Modify: `src/lib/content.ts` (`PLATFORM_KEYS` gets `'features'`)
- Modify: `scripts/modules.check.mjs`

**Interfaces:**
- Produces:
  - `type Pack = { label: string; price: number; offer?: number }`
  - `type OrderLine = { title: string; title_2?: string; pack: string; price: number; mrp?: number; qty: number }` — `price` is what the customer pays; `mrp` is set only when an offer applied
  - `type Order = { name: string; phone: string; address: string; items: OrderLine[]; total: number }`
  - `class OrderError extends Error`
  - `ordersOn(config): boolean` — `config.features?.orders === true && config.orders?.enabled === true`
  - `packsOf(item): Pack[]` — packs with a trimmed label and an integer price 1…1 000 000 (`Number(p.price)`; admin `num` fields may be strings). `offer` kept only when it is an integer ≥ 1 and below `price`; otherwise dropped
  - `cleanPhone(raw: unknown): string | null` — digits only; strip leading `91` from 12 digits or `0` from 11; must match `/^[6-9]\d{9}$/`
  - `prepareOrder(config, body: unknown): Order` — throws `OrderError`
  - `orderMessage(order: Order, id: number): string`
  - `MAX_LINES = 30`, `MAX_QTY = 50`

- [ ] **Step 1: Write the failing tests in `scripts/modules.check.mjs`** with a fixture config: `features: { orders: true }, orders: { enabled: true }`, one catalog section `{ id: 'millets', catalog: true, items: [{ title: 'కొర్రలు', title_2: 'Foxtail Millet', packs: [{ label: '500 g', price: '90' }, { label: '1 kg', price: 170, offer: '150' }, { label: '2 kg', price: 300, offer: 300 }, { label: '', price: 5 }] }, { title: 'NoPrice', packs: [] }] }`. Assert:
  - `ordersOn` true for the fixture; false when either flag is missing.
  - `packsOf(item0)` deep-equals `[{label:'500 g',price:90},{label:'1 kg',price:170,offer:150},{label:'2 kg',price:300}]` (an offer not below the price is dropped); `packsOf({})` is `[]`.
  - `cleanPhone` per Review Focus 2.
  - `prepareOrder` with `{ name:' Ravi ', phone:'+91 95816 17244', address:'Street 1, Kollapur', items:[{cat:'millets',title:'కొర్రలు',pack:'500 g',qty:2},{cat:'millets',title:'కొర్రలు',pack:'1 kg',qty:1}] }` → `total === 330`, `items[0].price === 90` with no `mrp`, `items[1].price === 150` and `items[1].mrp === 170`, `name === 'Ravi'`, `phone === '9581617244'`.
  - A client `price` field in a line is ignored (total still 330).
  - Throws `/Some items changed/` for: unknown cat, unknown title, unknown pack, `NoPrice` item, a hidden (`enabled:false`) item or section.
  - Throws `OrderError` for: orders off, empty items, 31 lines, qty `0`, `51`, `1.5`, name empty or > 80 chars, address < 5 or > 300 chars, non-empty honeypot `website`, body `null`.
  - `orderMessage(order, 1042)` includes `#1042`, `కొర్రలు (Foxtail Millet)`, `500 g × 2 = ₹180`, `1 kg × 1 = ₹150 (offer ₹150 each, was ₹170)`, `Total: ₹330`, `9581617244`; and `decodeURIComponent(encodeURIComponent(msg)) === msg`.
  - `prepareContent({ features: { orders: true } }, { features: { orders: false } }).features.orders === true` (owner can't flip the platform flag).

- [ ] **Step 2: Run `npm run check`** — expect FAIL (cannot find `src/lib/orders.ts`).

- [ ] **Step 3: Implement `src/lib/orders.ts`** with the interfaces above. Lines match by section `config.id === cat` with `catalog` and `enabled !== false`, item `title === title` with `enabled !== false`, then pack label. Duplicate lines (same cat/title/pack) are merged by summing qty. Message format:

```
New order #1042
Name: Ravi
Phone: 9581617244
Address: Street 1, Kollapur

1. కొర్రలు (Foxtail Millet) – 500 g × 2 = ₹180
2. కొర్రలు (Foxtail Millet) – 1 kg × 1 = ₹150 (offer ₹150 each, was ₹170)

Total: ₹330
```

  Add `'features'` to `PLATFORM_KEYS` in `src/lib/content.ts`.

- [ ] **Step 4: Run `npm run check`** — expect `modules.check: ok`.

- [ ] **Step 5: Commit** `Order rules: pack prices, phone, re-pricing and the WhatsApp message`.

---

### Task 3: Public "place order" route

**Files:**
- Create: `src/app/api/v1/orders/place/route.ts`
- Modify: `src/lib/auth.ts` (export `sameOrigin`)
- Modify: `src/lib/db.ts` (add order queries)
- Modify: `scripts/modules.check.mjs` (`PUBLIC_ROUTES` gets `'app/api/v1/orders/place/route.ts'`)
- Modify: `scripts/api.check.mjs`

**Interfaces:**
- Consumes: `prepareOrder`, `OrderError`, `ordersOn` (Task 2); `getSiteIdByHost`, `getContent`, `requestHost`, `requestIp`.
- Produces:
  - `db.ts`: `recentOrderCount(siteId, ip): Promise<number>` (orders from this ip, this site, last 60 min); `insertOrder(siteId, order: Order, ip): Promise<number>` (returns id).
  - `POST /api/v1/orders/place` → `200 { id: number, order: Order }`; errors `{ error }` with 400 (OrderError message), 403 (`Request refused` for missing/foreign Origin; `Orders are closed right now.`), 404 (unknown host), 429 (`Too many orders. Please call the shop.`) at 5 orders/hour/ip.

- [ ] **Step 1: Add cases to `scripts/api.check.mjs`** using site A with `features:{orders:true}, orders:{enabled:true}` and one priced product: a valid order returns an `id` and its row has `site_id = siteA` and the server total; no `Origin` → 403; orders off on site B → 403 `Orders are closed`; the 6th order from one ip in an hour → 429; a changed price → 400 `Some items changed`.

- [ ] **Step 2: Run `npm run check:api`** — expect FAIL (404 on `/api/v1/orders/place`).

- [ ] **Step 3: Implement the route**: `export async function POST(req)`, in this order: sameOrigin → site from host → `getContent` → `ordersOn` → rate limit → `prepareOrder` (catch `OrderError` → 400) → `insertOrder` → `json({ id, order })`. Comment: the second public route; the site comes from the address, prices from saved content.

- [ ] **Step 4: Run `npm run check && npm run check:api`** — expect both ok.

- [ ] **Step 5: Commit** `Public route to place an order`.

---

### Task 4: Admin order routes and the new capability

**Files:**
- Create: `src/app/api/v1/orders/route.ts`, `src/app/api/v1/orders/[id]/route.ts`
- Modify: `src/lib/db.ts`, `src/lib/users.ts` (`ASSIGNABLE_CAPS` adds `'orders.manage'`), `src/admin/people.tsx` (label `'orders.manage': 'See and update orders'`), `src/app/api/v1/auth/me/route.ts`, `scripts/api.check.mjs`

**Interfaces:**
- Produces:
  - `db.ts`: `listOrders(siteId): Promise<any[]>` (newest first, `limit 200`, ponytail comment: paging when a shop passes 200); `setOrderStatus(siteId, id, status, reason: string | null): Promise<boolean>`.
  - `GET /api/v1/orders` (`withAuth('orders.manage')`) → `{ orders: [{ id, name, phone, address, items, total, status, cancel_reason, created_at }] }` (no `ip`).
  - `PATCH /api/v1/orders/[id]` body `{ status, reason? }` → `{ ok: true }`; 400 unknown status, non-digit id, or `cancelled` without a 1–200 char reason; 404 when the id isn't this site's. Non-cancelled statuses store `cancel_reason = null`.
  - `GET /api/v1/auth/me` also returns `orders: boolean` = `features.orders === true` of the user's site.

- [ ] **Step 1: Add cases to `scripts/api.check.mjs`**: site B's owner listing orders sees none of site A's; PATCH of site A's order id from site B → 404; staff without `orders.manage` → 403; cancel without reason → 400; owner marks delivered → row status `delivered`.

- [ ] **Step 2: Run `npm run check:api`** — expect FAIL.

- [ ] **Step 3: Implement** the routes, db helpers, cap and `me` field. The test in `modules.check` that compares `people.tsx` labels to `ASSIGNABLE_CAPS` keeps the two in step.

- [ ] **Step 4: Run `npm run check && npm run check:api`** — expect both ok.

- [ ] **Step 5: Commit** `Admin routes to list and update orders`.

---

### Task 5: Cart on the public site

**Files:**
- Create: `src/chrome/Cart.tsx` (`'use client'`)
- Modify: `src/modules/Services.tsx`, `src/app/[host]/page.tsx`, `src/themes/base.css`, `scripts/modules.check.mjs` (add `'chrome/Cart.tsx'` to the contract loop)

**Interfaces:**
- Consumes: `ordersOn`, `packsOf`, `orderMessage`, `cleanPhone`, `Order` (Task 2); `POST /api/v1/orders/place` (Task 3).
- Produces: `Cart({ site }: { site: Site })`; `Services` renders, for orderable items when `ordersOn(site.config)`, `<button type="button" className="add" data-add={JSON.stringify({ cat: c.id, title, title_2, packs })}>`. `Cart` exports `classes`.

- [ ] **Step 1: Services** — when `showPrices` and `packsOf(it).length`, list each pack under the title: `500 g ₹90`, or with an offer `1 kg <s>₹170</s> <b>₹150</b>` (class `packs`, offer class `offer`). Then the Add button; `'add'`, `'packs'`, `'offer'` join `classes`. Services stays a server component: no click handler on it.

- [ ] **Step 2: Cart.tsx** — one delegated `click` listener on `document` for `[data-add]` opens the "add" `<dialog>` (pack radio list with prices, − / + count, "Add to cart"). A floating cart button with the line count opens the cart `<dialog>`: lines with − / + and remove, total, the delivery note `site.config.orders.note`, then "Send order" shows name / phone (`inputMode="tel"`) / address fields, a hidden `website` honeypot, and "Submit order". Cart lines and the customer's details are kept in `localStorage` (`hh-cart`, `hh-customer`), each read/write in try/catch. Pack choices and cart lines show the offer the same way (old price crossed out). On submit: disable the button, POST, then on success clear the cart and show the **receipt** (class `receipt`): shop name, `Order #id`, date, customer details, lines and total from the server's `order`, a "Save PDF" button calling `window.print()`, and the WhatsApp link; and set `window.location.href = https://wa.me/<digits of contact.whatsapp>?text=<encodeURIComponent(orderMessage(order, id))>` (not `window.open`: a popup after `await` is blocked). On error show the server's message. Labels from a `LABELS` map keyed by `site.config.lang` (`te`, `en`), like `Chrome.tsx`.

- [ ] **Step 3: page.tsx** — render `{ordersOn(site.config) && <Cart site={site} />}` after `<Footer>`.

- [ ] **Step 4: base.css** — rules for every class in `Cart`'s and Services' `classes`, mobile first, cart button clear of the iPhone home bar (`env(safe-area-inset-bottom)`). `@media print`: when `body` has class `printing-receipt` (Cart adds it before `window.print()`, removes it on `afterprint`), hide everything except `.receipt`.

- [ ] **Step 5: Run `npm run check`** — expect ok.

- [ ] **Step 6: Manual check with `npm run dev`** on a dev branch with orders on: add two packs, refresh (cart kept), change counts, submit with a wrong phone (error shown), submit correctly (one row in `hh_orders`, WhatsApp opens with the message), double-tap Submit (one row); tap Save PDF (only the receipt is printed, Android and iPhone both offer Save as PDF); an offer shows crossed out on the card, in the cart and in the message, and the total uses it. Switch orders off and reload: no Add buttons, no cart.

- [ ] **Step 7: Commit** `Cart and order form on the site`.

---

### Task 6: Admin — packs, switch and Orders screen

**Files:**
- Create: `src/admin/Orders.tsx`
- Modify: `src/modules/Services.tsx` (item field), `src/admin/Products.tsx`, `src/admin/App.tsx`, `src/admin/admin.css`

**Interfaces:**
- Consumes: `GET/PATCH /api/v1/orders…` (Task 4), `me.orders` (Task 4), `packsOf` (Task 2).
- Produces: `Orders()` screen component.

- [ ] **Step 1: Services item field** — `{ k: 'packs', t: 'list', label: 'Pack sizes for ordering', fields: [{ k: 'label', t: 'text', label: 'Pack', placeholder: '500 g' }, { k: 'price', t: 'num', label: 'Price ₹' }, { k: 'offer', t: 'num', label: 'Offer price ₹', hint: 'Optional. Lower than the price; customers see both.' }] }`. In `Products.tsx`, filter this field out when `!config.features?.orders`, and show "Can be ordered" in a product's row summary when `packsOf(it).length`.

- [ ] **Step 2: Products switch** — when `config.features?.orders`, under "Show prices on the site": checkbox "Take orders on WhatsApp" (`orders.enabled`) and a text field "Delivery note shown in the cart" (`orders.note`, placeholder `Delivery available to … area only`).

- [ ] **Step 3: Orders.tsx** — loads `GET /orders`; each card: `#id`, date, status, name, `tel:` phone link, address, lines, total. A status `<select>`; choosing Cancelled asks for the reason with `window.prompt` and does nothing if it's empty. Error and loading states as in `History`.

- [ ] **Step 4: App.tsx** — an "Orders" nav entry when `me.orders && (me.isOwner || me.caps.includes('orders.manage'))`, with the count of `received` orders fetched once on load.

- [ ] **Step 5: Run `npm run check`**, then a manual check: owner sees Orders, marks one delivered, cancels one with a reason; staff with only `content.edit` sees no Orders entry.

- [ ] **Step 6: Commit** `Admin: pack prices, orders switch and Orders screen`.

---

### Task 7: Turn it on for Manikanta, and the builder's shop option

**Files:**
- Modify: `site.json` (`config.features = { orders: true }`, `config.orders = { enabled: false, note: 'Delivery available to Kollapur area only' }`)
- Builder (`../hh_site_builder`): port Tasks 1–6, modify `scripts/new-site.mjs`

- [ ] **Step 1: Manikanta production** — after deploy and `npm run migrate`, set the platform flag once with the owner role (the app role can't, by design):
  `update hh_sites set config = config || '{"features":{"orders":true},"orders":{"enabled":false,"note":"Delivery available to Kollapur area only"}}' where slug = 'manikantanaturals';`
  `enabled: false` so nothing shows until the owner has entered pack prices and ticks the switch.

- [ ] **Step 2: Builder** — cherry-pick Tasks 1–6 onto the builder. In `new-site.mjs`, refuse `config.features.orders === true` unless `template_category === 'retail'` (`Orders are for shops: set template_category to "retail"`). For a shop it's the checkbox: `"features": { "orders": true }` in the site's `site.json`. Document it in the usage comment.

- [ ] **Step 3: Run `npm run check`** in both repos — expect ok.

- [ ] **Step 4: Commit** in each repo: `Manikanta: orders available, off until the owner turns them on` / `new-site: orders for shop sites`.
