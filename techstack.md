# Tech stack

Decided 2026-10-31: **Next.js + Neon + R2 + simple auth**, for Manikanta first and
then HH Site Builder. The target is about 100 small sites in a year, all from one
codebase. Capacitor mobile apps come later.

The work plan is in `dynamic-admin-page.md`.

## 1. Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js (App Router), React, TypeScript strict | Pin an exact current stable version in Phase 0 |
| Hosting | Vercel, **one project for all sites** | Each site is a domain on that project, found by hostname |
| Database | Neon Postgres, **one project for all sites** | Every row carries `site_id`. Driver: `@neondatabase/serverless` |
| Database access | Plain SQL, numbered migration files, no ORM | The builder's schema is already SQL |
| Images | Cloudflare R2, one public bucket on a custom domain | Files at `<slug>/<uuid>.webp`; the database stores only that relative path |
| Image processing | In the admin's browser: crop, rotate, resize, compress | Ported from `../fmwa`. No server processing and no Vercel image optimizer |
| Auth | Own small module on Node's `crypto`, sessions in Postgres | No auth library or auth service |
| Mobile (later) | Capacitor + a small Vite build | See §6 |

Not used: Supabase (for HH sites), Prisma or Drizzle, Auth.js, Server Actions,
`next/image`, S3 SDK (`aws4fetch` signs R2 uploads).

## 2. Why one database, not one per site

Supabase's two-project limit never required one project per site, because the
builder already runs many sites from one project. The real Supabase limit was the
shared quota. The same design applies here.

Neon's free plan allows 100 projects, and one per site would multiply the free
compute. **Still start with one shared project:** otherwise every schema change has
to run up to 100 times, and platform-wide queries and backups get harder. If shared
compute becomes the limit, pay for usage or move only the busiest sites out.

## 3. Rules that keep it safe with 100 sites

| Rule | Why |
|---|---|
| **The public site reads the database only on a cache miss.** Pages are cached per site and language, and a save refreshes that site's cache by tag | Neon's free plan suspends a project for the rest of the month when its 100 compute hours run out, which would take every site's admin down. Cached public pages keep it idle. |
| **`site_id` comes from the session, never from the request.** Every admin API route goes through one wrapper, `withAuth(cap, handler)`. Every data function takes `siteId` as a required argument | Without Supabase's database rules, this code is what separates one shop from another |
| **An automated test tries cross-site access on every admin route**, and a check fails the build if a route file doesn't use the wrapper | One forgotten check must fail the build, not expose a shop |
| Vercel uses a limited database role (no schema changes). Migrations run from your laptop with the owner role | A bug or leak in the app can't drop tables |
| No secrets under `NEXT_PUBLIC_*`. Database and R2 keys stay server-only | Those variables go into the browser bundle |
| **Add Postgres row-level security before storing private customer data** (jobs, enquiries) | Today's data is public content plus password hashes. Private data needs a second layer. |
| Nightly `pg_dump` to R2 through GitHub Actions, before the first paying client | One database holds every client's content |
| The platform admin is **never deployed**. It runs on your laptop with the owner role | Same rule the builder has today (R20) |

## 4. Auth

| Item | Decision |
|---|---|
| Password storage | `crypto.scrypt` with a per-user salt, compared with `timingSafeEqual` |
| Sessions | Random 32-byte token. Only its SHA-256 is stored, in `hh_sessions`, with a 30-day expiry |
| Web | `HttpOnly`, `Secure`, `SameSite=Lax` cookie. Writes also check the request's `Origin` |
| Mobile | The same token as a Bearer header, kept in the phone's secure storage |
| Login limits | 5 failed tries per username and IP locks for 15 minutes, in a Postgres table |
| Password reset | No email. The owner resets staff passwords; you reset an owner's with a laptop script. Changing a password ends that user's sessions |
| Users | `hh_users` with `site_id`, `username` (unique per site), and `is_owner` |
| Permissions | Keep the builder's `hh_roles`, `hh_user_roles` and `can.js` logic, and add `content.edit`. The owner has everything in their own site |

## 5. Code rules

These keep modules reusable across web, the builder and mobile.

- Section modules and `src/admin/` import **nothing from `next/*`**. They take
  props and use plain `<a>` and `<img>`.
- The builder's module contract stays: no CSS imports, no inline styles except
  pass-through variables, a declared `classes` list, and `npm run check`.
- All admin data goes through a JSON API at `/api/v1/...`, with the base URL in one
  place. No Server Actions.
- No site name, phone number or Manikanta wording in `src/`. It all lives in the
  site's database row.
- Stored image paths stay relative, so the image domain can change in one setting.
- Language lives in the URL (`/` and `/en`), so pages cache cleanly and search
  engines see both.

## 6. Mobile with Capacitor (later)

**Nothing gets built now**, but §5 is what makes this possible.

| Topic | Decision |
|---|---|
| How it's built | A small `mobile/` Vite app that imports the same `src/admin` and modules, and calls the deployed `/api/v1` |
| Why not a Next.js static export | Capacitor needs static files. An export build has no API routes, server rendering or host routing, which the website needs |
| First app | **One shared "owner" app** for all clients: sign in, manage products, take a photo with the camera. Native camera and notifications give it real value beyond a website |
| Per-shop customer apps | Only for a client who pays for one, published under **that client's own developer account**, Play Store first |
| Setup needed then | Allow `capacitor://localhost` and `https://localhost` in API and R2 CORS, and test both |
| Accounts | Roughly $25 once for Google Play and $99 a year for Apple, per account. Confirm before buying |

**App store risk:** don't plan on 100 store apps. Reviewers have rejected Capacitor
apps that only wrap a website (Apple guideline 4.2). As far as I recall, Apple's
rules also reject near-identical apps from a template unless the content owner
submits them (4.2.6 and 4.3). I didn't confirm those two in this research, so read
Apple's current guidelines before promising apps to clients.

## 7. Limits and cost

Sizes are estimates for 100 sites, using Manikanta's numbers: about 6 MB of images
and 60 KB of content per site.

| Service | Estimated use | Free allowance | Cost |
|---|---|---|---|
| Vercel | One project, 100 domains | **Hobby is non-commercial only** and allows 50 domains per project | **Pro, $20 a month per developer seat**, from the first client site. Usage above the included credit is extra |
| Neon | Content about 6 MB; 30 saved versions per site up to 180 MB | 1 GB per project, 100 compute hours a month | Free at first. Then usage-based, with no monthly minimum |
| R2 | About 600 MB of images | 10 GB, 1M writes, 10M reads a month, **free egress** | Free |
| Domain | `hhappsolutions.com` subdomain for images | R2's `r2.dev` address is rate-limited and not for production, so a custom domain on Cloudflare is required | Existing domain |

Prices come from each provider's site in October 2026, and some of their pages
disagree. Confirm on the live pricing pages before quoting clients.

**Watch these monthly:** Neon compute hours, and Vercel usage against the Pro credit.

## 8. Accounts needed before Phase 0

| Item | Who | Note |
|---|---|---|
| Neon project `hh-sites` | You | Separate from the `seo-watch-saas` project |
| Cloudflare account, R2 bucket, API token | You | R2 may ask for a payment card even on the free tier |
| Cloudflare DNS for an image domain, such as `img.hhappsolutions.com` | You | Check where `hhappsolutions.com`'s DNS lives today |
| Vercel Pro decision | You | Manikanta is a real business site, so Hobby's terms don't cover it |

Sources:
[Vercel Hobby](https://vercel.com/docs/plans/hobby),
[Vercel pricing](https://vercel.com/pricing),
[Vercel multi-tenant limits](https://vercel.com/docs/multi-tenant/limits),
[Neon free plan limits](https://neon.com/faqs/free-plan-limits-and-quotas),
[R2 pricing](https://developers.cloudflare.com/r2/pricing/),
[R2 public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/),
[R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/),
[Next.js with Capacitor](https://capgo.app/blog/building-a-native-mobile-app-with-nextjs-and-capacitor)
