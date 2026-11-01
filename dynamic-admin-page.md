# Dynamic site and admin page: plan

Stack: `techstack.md` (Next.js + Neon + R2 + simple auth), replacing the earlier
Vite + Supabase plan.

**Branches, since 2026-11-01:** this work is on `main`. The static site's code is on
`static` (tag `static-final` is its older rollback point). `next-migration` is no
longer used. Each push to `main` fails on Vercel with `STATIC_BUILD_NO_OUT_DIR`,
because the project's Framework is still "Other", so Vercel keeps serving the last
good static deployment. That's expected until go-live, but it means **the live site
can't be updated from `main`**. To change it before go-live, deploy `static`. Go-live
needs the Framework set to Next.js and the environment variables added, and that
deploy is what replaces the static site.

**Status, 2026-11-01:**

| Phase | State |
|---|---|
| 0 Foundation, 1 Same page from the database | Done |
| 3 Auth and API, 4 Admin content | Built and tested, not yet checked on a real phone |
| 5 Images | **Next.** Image fields only take a typed path until this is done |
| 2 Two languages | Not started. English can be typed in the admin, but `/en` doesn't exist. Run alongside 5 |
| 6 Users and roles, 7 Go-live | Not started. Go-live needs the Vercel Pro decision, and the temporary `admin` password must change first |

Also added beyond this plan: a per-product `amount` shown as a tag on the photo, and
`config.show_prices`, a site-wide switch on the Products screen.

**New session, start here:** read `techstack.md`, then this file, then continue with
the next phase above. `npm run check` needs no accounts. `npm run check:api` needs
`DATABASE_URL_OWNER_DEV` (Neon `dev` branch). Never run tests against production.

## 1. Goal

- Every piece of content on the live site can be changed from `/admin`, with no
  code edit or deploy.
- There is **one product list and one category list**, and each product and
  category title is held in both Telugu and English.
- The design stays the same: same markup, same Polam theme.
- The code is generic from the start, so it can become HH Site Builder's new base
  and serve about 100 sites.
- Admin screens and modules stay reusable in a Capacitor app later.

## 2. Key decisions

| Decision | Choice | Why |
|---|---|---|
| Where it's built | In this repo on branch `next-migration`. The static site keeps serving production until Phase 7 | No risk to the live site while building |
| What gets reused from `../hh_site_builder` | Modules, header and footer, `base.css`, both themes, `can.js`, theme checks and the table design. Port JSX to TSX | They already fit this page. Only the data and security layers change |
| What gets replaced | Supabase login, database security rules, storage, PostgREST calls, the browser-side theme setup | See `techstack.md` |
| Products and categories | Stay in `hh_sites.config` as JSON. A category is a `services` section with `catalog: true`, and a product is one of its `items` | Fits 12 categories and 100 products per site, with one save path for all content. Add tables only for cart, stock counts or search |
| Languages | Keep the `_2` convention: `title` = Telugu, `title_2` = English, plus `config.lang_2: "en"` | Sites without `lang_2` stay single-language |
| Language switch | **తెలుగు / English** link in the header. `/` is the site's main language and `/en` the second. `localize(config, lang)` swaps every `x` with `x_2` on the server | Product and category titles still show both languages, active one first. Descriptions show only the active language. A missing translation shows the other language, never a blank |
| Saving | One API route that replaces the content document | Rejects stale saves and keeps platform-owned settings unchanged (see §6) |
| Undo | `hh_site_versions`, one snapshot per save, last 30 kept, with Restore | A mistake on a phone could otherwise wipe the product list |
| Publishing | Saving goes live straight away by refreshing that site's cache | Undo covers mistakes. Add drafts only if a shop asks |
| Who controls what | The owner edits content. Theme, domain, publish status and the "Developed by" credit stay with you | Same boundary the builder designed |
| Flyers | One flyer list. The admin marks flyers active and can choose one to open on page load; the other active flyers show in the bottom section. Details in §5b | Replaces the separate festival popup, so the popup is just a flyer choice |

The user confirmed the language, product storage, saving and owner-limit choices
above on 2026-10-31.

## 3. Phases

Size: S = under a day, M = 1 to 2 days, L = 3 or more days.

| # | Phase | What gets built | Done when | Size |
|---|---|---|---|---|
| 0 | **Foundation** | Tag `static-final`. Create the Next.js TypeScript app on `next-migration`. Connect Neon and R2. Write the migrations: port the builder's `hh_sites`, `hh_templates`, `hh_roles` and `hh_user_roles`, drop everything Supabase-specific, and add `hh_users`, `hh_sessions`, `hh_login_attempts` and `hh_site_versions`. Grants go in the same migration | App runs locally, migrations apply to Neon's production branch (no real data yet), a test file uploads to and displays from R2 | M |
| 1 | **Same page from the database** | Port modules, header, footer, `base.css` and themes. Find the site by hostname, render on the server, cache by site. Seed `site.json`, upload the 55 images. Apply `integrate.md` §3 and the §4 gaps below | Matches the static site at 1280, 768, 375 and 360px using the `integrate.md` §6 list, and products appear in view-source | L |
| 2 | **Two languages** | `localize()`, header link, `/en`, `<html lang>`, `hreflang`, English title and description. About 40 new English strings and short category titles (§5) | Both URLs show all 28 products in 5 categories. Header fits one line at 360px in both. The owner has approved the English | M |
| 3 | **Auth and API** | `lib/auth`, `withAuth`, login and logout, change password, `/api/v1` read and save, versions and restore. The cross-site test and the wrapper check from `techstack.md` §3 | All §6 cases pass | M |
| 4 | **Admin: content** | `/admin` client app: form generator from module `fields`, screens in §7, up/down reorder, Telugu and English inputs side by side, a warning when a title lacks either language, a warning before leaving unsaved changes | The owner can make every change in §4 **on a phone**, and it shows on the site after saving. Choosing a flyer makes it open on page load and removes it from the bottom section | L |
| 5 | **Images** | Port `ImagePicker.jsx`, `data/crop.js` and `data/upload.js` from `../fmwa`. Add WebP with JPEG fallback. API route signs an upload to a server-built key. Details in §5a | A phone photo, from Android and iPhone, becomes a product image that displays the right way up | M |
| 6 | **Users and roles** | Laptop script to create an owner. Users screen: add staff, reset password, remove. Roles screen: create a role, tick capabilities | Sign in as staff: they can do only what the role allows, and the API refuses the rest | M |
| 7 | **Go-live** | Sitemap, robots, share-preview tags, `noindex` on `/admin`. Nightly backup. Vercel Pro. Set the Vercel Framework to Next.js, add the environment variables, and redeploy `main` so `www.manikantanaturals.com`, `manikantanaturals.com` and `manikantanaturals.vercel.app` serve the new app. Freeze `site.json` | View-source and a WhatsApp preview are correct on the live URL, a save appears on the site, and rollback to `static-final` has been confirmed | M |
| 8 | **Builder base** (later) | Move this code into `hh_site_builder`. Port its other modules (Events, Tracking, Reviews, pages), the remaining templates and the local platform admin | A second test site runs from a new row, with no code change | L |
| 9 | **Owner mobile app** (later) | `mobile/` Vite + Capacitor, per `techstack.md` §6 | Owner app works on a real Android and iPhone | L |

Order: 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7. Phases 2 and 3 can run side by side.

## 4. Coverage: every piece of content on the site today

| Content | In `site.json` today? | Admin screen | Work needed |
|---|---|---|---|
| Logo, shop name, tagline | Yes | Site details | Add `_2` fields; the builder has no form for `brand` yet |
| Phone, WhatsApp, address, second number | Yes | Site details | Same. Hero buttons use the phone number as a typed link, so make them `call` / `whatsapp` actions that read `contact`, otherwise a number change leaves them stale |
| Map | Yes | Site details | Accept only Google Maps links |
| Menu links | Yes | Site details | Builder header needs `config.nav` (`integrate.md` §3a), plus `label_2`. Menu links are chosen separately, so 12 categories don't crowd the header |
| Hero image, headings, buttons | Yes | Home sections | Add image description and `sub_2` |
| **5 categories**: title, intro, column count, order, show/hide | Yes | Products | Add `catalog: true`; new categories get an `id` from their English title |
| **28 products**: photo, titles, description, price or note, order | Yes | Products | Add `body_2`, `price_2`, image description, and `enabled` so a product can be hidden when out of stock |
| Toothbrush photo fit | **No**, inline style in `index.html` | Products | Add a `fit` field that emits a class, because modules can't use inline styles |
| "Why millets" cards and icons | Yes | Home sections | Add 5 icons to the builder (`integrate.md` §3d) |
| Proprietor: name, photo, text, seal, stats | Yes | Home sections | Add `_2` for the stats and seal; keep Mahesh's name as `README.md` records |
| Flyers: images, order, active, which opens on page load | Images only, no descriptions | Flyers | Change items to the shape in §5b, still accepting plain strings. The section's kicker and headings stay in Home sections |
| Contact section labels | Yes | Home sections | Add a choice of icon for the second panel |
| Footer note | Yes | Site details | Add `note_2` |
| "Developed by" credit and link | Partly | None, platform only | Builder needs the label and link added |
| Search title and description | Yes, slightly different from the live page | Site details | Add `_2` and use the live wording |
| Skip link text | **No** | None | Add to the header as a fixed string per language |
| **Festival popup** | **No**, removed from the static site on 2026-10-31; its flyer now sits last in the flyer section | Flyers | Becomes a flyer chosen to open on page load (§5b). Recover its CSS from tag `static-final`, move it to `base.css` with a declared class list |
| Reviews section | Yes, disabled | Home sections (on/off) | Port the module and moderation in Phase 8, or sooner if the shop turns reviews on |

## 5. Language content

- **Needs English written:** 23 product descriptions, 5 menu links, 3 stats, the
  seal, the footer note, the hero and section intros, 2 price notes and the shop
  name: about 40 strings. Claude drafts them, and **the owner approves them**.
- **Health wording:** the English for Nasika must stay as careful as the Telugu,
  including "consult a doctor before use". The flyer's disease claims stay off
  the site, as `README.md` records.
- **Still to confirm:** "నల్ల పెబ్బర్లు" as *Black Cowpeas*.
- **One visible change in the Telugu view:** the line under each category title
  is an English sentence today ("Millets — five kinds, now in store"). To work in
  both directions, `heading_2` becomes the short title ("Millets") and the sentence
  moves to `sub_2`. Sections with no Telugu intro get one written.
- **Left as they are:** kickers and panel labels already carry both languages in
  one line ("కొత్త స్టాక్ · New Stock"), so they stay single, editable fields.
- **Fonts:** Polam's heading and body fonts are Telugu faces, and English moves
  into those positions in the English view. Check how that looks in Phase 2 and,
  if it looks wrong, add a `[lang=en]` font rule to the two themes.

## 5a. Images

| Step | Where it happens | Detail |
|---|---|---|
| Crop, rotate, resize, compress | Owner's browser | Products up to 640px on the long edge; hero and flyers up to 1200px |
| Format | Owner's browser | Try WebP and check `blob.type`. Safari can silently return PNG, so fall back to JPEG. Flatten transparent logos onto white when using JPEG |
| Sign the upload | `/api/v1/uploads` | Requires login and `content.edit`. The **server** builds the key as `<slug>/<uuid>.<ext>` from the session's site, and allows only image types. The link expires in minutes |
| Store the file | Cloudflare R2, uploaded directly from the browser | R2 needs a CORS rule for the site's origins. Set a long `Cache-Control`, since filenames never repeat |
| Verify | `/api/v1/uploads` confirm step | Checks the file's real size and first bytes, and deletes it if it's wrong, because browser checks can be bypassed |
| Store the path | Neon | The site's content holds only the relative path |
| Keep visits light | Public page | Add `loading="lazy"` to `Services` images, which don't have it today |

Old images stay in R2 because saved versions may still use them. All of Manikanta's
images come to about 6 MB, so add a clean-up only when storage use matters.

## 5b. Flyers

Each flyer is one item in the gallery section's `images` list:

```json
{ "src": "manikantanaturals/<uuid>.webp", "alt": "…", "alt_2": "…", "active": true,
  "popup": false, "popup_until": null, "caption": "…", "caption_2": "…" }
```

| Flyer state | Where it shows |
|---|---|
| Active, chosen to open on page load | Opens as the popup on the home page, and **not** in the bottom section |
| Active, not chosen | Bottom flyer section, in the admin's order |
| Not active | Nowhere. It stays in the admin so it can be reused next year |

| Rule | Detail |
|---|---|
| Upload | Same image flow as §5a, up to 1200px. New flyers start active and not chosen |
| Only one popup | A radio choice in the admin, including "None". The save API also refuses more than one |
| Popup behaviour | Opens on every home page load, as it does today. The close button or a click outside closes it. Uses the native `<dialog>` |
| Optional end date | `popup_until`, checked in the visitor's browser because the page is cached. After that date it stops opening, so a festival popup can't overstay. It stays out of the bottom section until the admin changes it |
| Caption | Optional line under the popup image, in both languages, like today's "విజయదశమి శుభాకాంక్షలు! · Happy Dussehra" |
| Bottom section empty | If no flyers remain, the section doesn't render |
| Existing content | All 10 flyers are seeded active and not chosen, in today's order, with Dussehra last, so **no popup opens at launch** until the admin chooses one |

## 6. Security: what the save API and tests must prove

| Case | Expected result |
|---|---|
| No session, or an expired one | Refused |
| Owner or staff of another site, on **every** admin route | Refused |
| Staff without `content.edit` | Refused |
| Request names a different `site_id` | Ignored; the session's site is used |
| Owner sends changed `theme`, `tracking`, credit or other platform-owned fields | Saved, but those values stay as they were |
| Save based on an out-of-date copy (two people editing) | Refused with "reload first", nothing overwritten |
| Oversized or non-object content | Refused |
| More than one flyer chosen as the popup | Refused |
| Every successful save | A version snapshot exists, Restore brings it back, and the site's cache refreshes |
| Six wrong passwords | Locked for 15 minutes |
| Write from another website's origin | Refused |

Also required:

- Links and the map are checked at render. `javascript:` links are dropped, and
  the map iframe accepts Google Maps only.
- Admin code loads only on `/admin`, so the public page stays light.
- Security checks run in `npm run check`, against a Neon dev branch or local Postgres.

## 7. Admin screens

| Screen | Who sees it | What it does |
|---|---|---|
| Login, change password | All | Username and password for that site |
| **Products** (first screen) | `content.edit` | Categories and their products: add, edit, reorder, hide, delete, with a confirmation before deleting a category that has products |
| **Flyers** | `content.edit` | Upload, reorder, mark active or not, delete, and choose which one opens on page load, with an optional end date and caption |
| Home sections | `content.edit` | Hero, why millets, proprietor, flyer section headings and contact: edit, show/hide, reorder |
| Site details | `content.edit` | Logo, name, phones, address, map, menu, footer note, search text |
| History | `content.edit` | The last 30 saves, with who and when, and Restore |
| Users, Roles | `users.manage` (owner has it automatically) | Add, reset or remove staff; create roles |

Admin text is English with Telugu input fields. Add Telugu admin labels if the
owner finds English hard.

## 8. Moving into `hh_site_builder` (Phase 8)

The Manikanta row, images and logins are already in the shared Neon and R2, so
only code moves.

| Step | Action |
|---|---|
| 1 | Commit the builder's current uncommitted work (6 files, including `base.css` and `catalogue.js`). Do this **before Phase 1** too, so the code copied here matches a commit |
| 2 | On a builder branch, replace its app code with this repo's and keep its unported modules to convert |
| 3 | Port Events, Tracking, Reviews and pages to the API, adding row-level security before Tracking stores customer data |
| 4 | Load all templates from `catalogue.js`, including `polam-paper` and `vanam-grove` |
| 5 | Point the shared Vercel project at the builder repo and archive this repo |

`integrate.md` describes the old Supabase route. Rewrite it during this phase.
`to-builder.mjs seed` must refuse to overwrite an existing row after go-live, or
it would erase the owner's edits. Update `restructure.md` to match.

Other sites stay as they are: `../me` (Murali) keeps its own Supabase tables, and
any `hh_*` rows already in Supabase are exported when this phase starts.

## 9. Risks

| Risk | Handling |
|---|---|
| **A missing check exposes another shop's data**, now that the database doesn't enforce separation | One wrapper, required `siteId`, a build-failing check, and the cross-site test. Add row-level security before private data |
| **Neon compute runs out and suspends the database** | Public pages come from cache. Watch usage monthly, and move to the paid plan before it gets close |
| Hand-written login has a flaw | Standard `crypto` functions, hashed tokens, rate limits, and a security review before go-live |
| Vercel Hobby doesn't allow commercial use | Move to Pro at go-live. Budget for it with client pricing |
| Moving the `.vercel.app` address between projects | Test on a spare address first, and keep the static deployment ready to restore |
| R2 needs a custom domain on Cloudflare | Sort out DNS in Phase 0, before any image paths go live |
| The port changes the design by accident | Side-by-side comparison in Phase 1 at 4 widths, before any admin work |
| 100 near-identical store apps get rejected | One shared owner app first, per `techstack.md` §6 |

## 10. Left out on purpose

| Skipped | Add when |
|---|---|
| Cart, orders, payments, stock counts, product pages, search | The shop wants online ordering; WhatsApp and phone remain the way to buy |
| Separate product tables | One of the above arrives |
| Third language or a translations table | A third language is needed |
| Automatic translation | Typing and owner approval become too slow |
| Draft mode and side-by-side live preview | Saving live with Undo proves too risky |
| Theme switching by the owner | A shop wants it; for now you change `template_key` |
| Drag-and-drop reordering | Up/down buttons prove too slow |
| Password reset by email or SMS | Owners get locked out often enough to justify it |
