# Integrating Manikanta Naturals into HH Site Builder

This folder is the static, live version of the site
(`manikantanaturals.vercel.app`). It was built so that the move into
`../hh_site_builder` changes no design, section or element. Each step below
says what to run, and anything that needs a builder code change is listed in
§4.

## 0. What maps to what

| Here | In the builder |
|---|---|
| `index.html` markup | The output of `Header`, `Hero`, `Services`, `Intro`, `Gallery`, `Contact` and `Footer`, class for class. It is not copied anywhere: the modules already render it. |
| `base.css` | `src/themes/base.css`. This is a verbatim copy, so it must stay identical (§1). |
| `theme-a.css` | Template **`polam-paper`** ("Polam Paper"), category `retail`. |
| `theme-b.css` | Template **`vanam-grove`** ("Vanam Grove"), category `retail`. |
| each theme's `:root { … }` | the template's `tokens` |
| each theme's text after `/* ---- template css ---- */` | the template's `css` |
| `site.json` | one `hh_sites` row: `slug`, `name`, `hostnames`, `template_key` and `config` |
| `assets/img/*` | storage bucket `sites`, folder `manikantanaturals/` |
| `to-builder.mjs` | prints the catalogue entries and the seed SQL from the files above, so nothing is copied by hand |
| Design A/B switch in `index.html` | Nothing. It's a demo control, and the builder picks a template through `template_key`. |

Everything a template draws lives inside its CSS. That covers the gradients,
the leaf, millet and Ayurveda line-art backdrop (SVG data URIs), the frames,
the pill menu and the sticky mobile header. No template needs an image file.

## 1. Check base.css is still in sync

```
diff ../manikanta/base.css src/themes/base.css
```

If the builder's `base.css` has changed since this site was made, re-check the
two themes against it before going further. Two rules depend on base.css
behaviour:

- **`.card figure { grid-template:100% / 100%; }`** exists because base makes
  a card's `figure` a grid, and without it a tall photo overflows its frame.
- **The `@media (max-width:860px)` re-statements of `.intro` and `.foot`** are
  needed because `base.css` sits in `@layer base`, so its own mobile rules lose
  to the themes' desktop rules.

## 2. Add the two templates

From `hh_site_builder/`:

```
node ../manikanta/to-builder.mjs catalogue
```

That prints two complete `TEMPLATES` entries. Paste them into the array in
`src/themes/catalogue.js`, in the light section. Then:

```
npm run templates     # regenerates supabase/templates.sql (refuses on any contrast failure)
npm run check         # contrast, required tokens, category, class coverage
```

Both entries already pass the builder's `auditTokens` and required-token checks,
and the `retail` category is allowed by `hh_templates_category_known`. Load
`supabase/templates.sql` in Supabase Studio, or just the two new rows.

The CSS is pasted into a JS template literal. The script refuses to run if the
CSS ever contains a backtick, a backslash or `${`. In Studio, a template's
`css` column can still be edited later without a deploy.

## 3. Builder code changes this site needs

These are four small changes. Without them the page renders, but it isn't the
same page.

**a. In-page menu (`src/chrome/Chrome.jsx`, `Header`).** Today the menu comes
only from `hh_pages` (`/p/<slug>`). This site's menu is in-page anchors, so
`site.json` has `config.nav: [{ label, href }]`. Render those before the page
links:

```jsx
const own = site.config.nav || [];
// …
{(own.length > 0 || nav.length > 0) && (
  <nav className="top-nav">
    {own.map((n) => <a key={n.href} href={n.href}>{n.label}</a>)}
    {nav.map((n) => ( /* existing NavLink */ ))}
  </nav>
)}
```

The hrefs are `#millets` and so on, which match the section `id`s in the
config. They only resolve on the home route. If the site ever gains `/p/…`
pages, render them as `/#millets`.

**b. Page language (`src/lib/theme.js`, next to the `document.title` line).**
The builder's `index.html` says `lang="en"`, and this site is Telugu-first:

```js
document.documentElement.lang = site.config?.lang || 'en';
```

**c. Footer label (`Footer` in `Chrome.jsx`).** "Powered by" is hard-coded.
This site wants "Developed by", which `site.json` carries as
`footer.powered_by_label`:

```jsx
<span>{f.powered_by_label || 'Powered by'}</span>
```

**d. Icons (`src/modules/icons.jsx`, `ICONS`).** The "why millets" cards use
four names that don't exist yet. These are Lucide paths, identical to the
inline SVGs in `index.html`:

```js
leaf: ['M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z',
       'M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12'],
scale: ['m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z', 'm2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z',
        'M7 21h10', 'M12 3v18', 'M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2'],
'heart-pulse': ['M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z',
                'M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27'],
shield: ['M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z',
         'M9 12h6', 'M12 9v6'],
sprout: ['M7 20h10', 'M10 20c5.5-2.5.8-6.4 3-10',
         'M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z',
         'M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z'],
```

An unknown icon name falls back to `tool`, so skipping this step shows
spanners, not an error.

### Known small differences, all optional

- **Contact panel, second heading:** the builder uses its `clock` icon (it's
  the "hours" slot). The static page shows a chat bubble, because that slot
  lists the second phone number and WhatsApp. To match, add an icon choice
  for that heading, or accept the clock.
- **Skip link:** the static page has one ("ప్రధాన విషయానికి వెళ్ళండి"),
  and both templates already style `.skip`. Adding it to `Header` gives every
  builder site keyboard users a shortcut.
- **Alt text:** the static page has Telugu alt text on the hero, gallery and
  product photos, while the builder's modules emit `alt=""`. This makes no
  visual difference.

## 4. Upload the images

Upload every file in `../manikanta/assets/img/` (22 files) to the storage
bucket **`sites`**, folder **`manikantanaturals/`**.

The paths in `site.json` are `manikantanaturals/shop.webp` and so on, **without**
`sites/`. `asset()` in `src/lib/sb.js` already prefixes
`…/storage/v1/object/public/sites/`, as in `seed-murali.sql`.

The originals (`assets/*.jpeg`, `assets/shop.jpg`) stay out of storage. Only
`crop-assets.py` uses them, to regenerate `assets/img/`.

## 5. Create the site row

Choose the design first. In `site.json`, `template_key` is `polam-paper`
(design A) or `vanam-grove` (design B). Then:

```
node ../manikanta/to-builder.mjs seed > supabase/seed-manikanta.sql
```

Run it in Studio **after** `templates.sql`. It upserts by slug, so it's safe
to re-run, and it leaves `published = false` on purpose. The other template
stays in the catalogue, and the site can switch to it any time by changing
`template_key` alone.

## 6. Preview, compare and cut over

1. **Preview it unpublished.** Anon RLS only reads published sites, so
   `?site=manikantanaturals` returns nothing yet. Use the platform admin's
   live preview (`npm run platform`), which renders the config directly.
2. **Compare it with the live static site** at full width, 768 and 375:
   - the hero shop photo in its rectangular frame
   - the heading on two balanced lines
   - the pill menu on desktop and underlined links on mobile, all five on one line at 360px
   - the sticky header on mobile
   - card photos filling their frames, the nasika bottle whole on mobile
   - the line-art backdrop
   - the proprietor photo framed evenly
   - the HH logo in a white square tile, and "Developed by"
3. **Publish.** Set `published = true`. The row already lists
   `manikantanaturals.vercel.app` in `hostnames`, and `site.js` resolves the
   site from that hostname.
4. **Cut over.** Point the `manikantanaturals` Vercel project at the
   `hh_site_builder` repo (build `npm run build`, output `dist`), the same way
   Murali Electronics does in `tasks.md` §4.6. Verify it live, then archive
   this repo. Until then, this static folder is what serves the domain.

## 7. Afterwards: the admin side

The reviews section is already in `site.json`, disabled, with
`reviews.source: "public_form"`. Turn on `"enabled": true` when the shop wants
customer reviews.

The owner's login is the builder's `create-site-admin` Edge Function (see the
builder README), scoped to this site. Order tracking doesn't apply to a shop,
so `tracking.enabled` is `false`.

## Things still to confirm with the shop

These are also in `README.md`.

- **Map.** It points at Kollapur town, not the shop. Paste the shop's own
  Google Maps embed link into `contact.map_embed`.
- **Opening hours.** Not known yet.
- **Translation.** "నల్ల పెబ్బర్లు" is translated as *Black Cowpeas*.
