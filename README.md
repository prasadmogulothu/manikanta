# Manikanta Naturals · మణికంఠ న్యాచురల్స్

A static site for an organic, millets and Ayurveda store in Kollapur,
Nagarkurnool district. Proprietor: **Mahesh Kashipuram**. The content is
Telugu first, with English kept for product names and taglines.

There are two design templates over one page, built so the site can move into
`../hh_site_builder` without changing the markup.

```
python -m http.server 8788        →  http://localhost:8788/   (?d=b for design B)
```

| File | What it is |
|---|---|
| `index.html` | The page. Its markup copies what the builder's modules emit (`Header`, `Hero`, `Services`, `Intro`, `Gallery`, `Contact`, `Footer`), class for class. |
| `base.css` | A verbatim copy of `hh_site_builder/src/themes/base.css`. Do not edit it here. |
| `theme-a.css` | **Design A — Polam (పొలం).** Warm paper, leaf green and turmeric. Noto Serif Telugu, Anek Telugu and Fraunces. Arch-shaped image windows. |
| `theme-b.css` | **Design B — Vanam (వనం).** Mid forest-green gradients and brass. Noto Sans Telugu and Lora. Medallion images, and the organic list set as a bill of fare. |
| `site.json` | The `hh_sites` row (`slug`, `template_key`, `config`) carrying all of this content. |
| `crop-assets.py` | Cuts the WhatsApp flyers in `assets/` into the WebPs in `assets/img/`. |

## Switching designs

The **Design A / B** pill at the bottom left is a demo control. Before launch,
delete the `.demo-switch` markup, its `<style>` and both `/* design switcher */`
scripts from `index.html`, then delete the theme file you didn't pick.

## Moving into hh_site_builder

1. **Templates.** Each theme file has two parts. Its `:root { … }` block is the
   template's `tokens` (drop the `--` prefixes), and everything after
   `/* ---- template css ---- */` is its `css`. Add both to
   `src/themes/catalogue.js` as `polam-paper` and `vanam-night`, both
   `category: 'retail'`. Then run `node tools/gen-templates.mjs` and
   `npm run check`. Both palettes already pass the builder's `auditTokens`
   contrast check.
2. **Assets.** Upload `assets/img/*` to the storage bucket at
   `sites/manikantanaturals/`.
3. **Site.** Insert `site.json` as the `hh_sites` row. Set `template_key` to
   whichever design was chosen.
4. **Icons.** The "why millets" cards use `leaf`, `scale`, `shield` and `sprout`.
   Only `heart` exists in `src/modules/icons.jsx` today, so add the other four.
   They are the Lucide paths already inlined in `index.html`.

The templates restyle a few sections by their config `id` (`#millets`,
`#benefits`, `#organic`, `#ayurveda`). Each of those rules has a generic
fallback, so any other site using the templates still renders properly.

## Things to confirm with the shop

- **Photos.** Every image is cut from WhatsApp flyers at 575–843px wide, so they
  look soft on large screens. Original product photos and a proper portrait
  would improve the site most.
- **Map.** It points at Kollapur town, not the exact shop. Replace
  `map_embed` with the shop's own Google Maps embed link.
- **Opening hours.** Not known. The contact panel lists the second phone number
  where the hours would go.
- **Nasika claims.** The flyer lists diseases such as brain tumour, paralysis
  and OCD. The site only says it is traditionally used for headache, cold,
  sinus and sleeplessness, and adds "consult a doctor before use".
- **"నల్ల పెబ్బర్లు"** is translated as *Black Cowpeas*. Check this with the owner.
