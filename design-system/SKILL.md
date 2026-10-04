---
name: banket-design
description: Use this skill to generate well-branded interfaces and assets for Banket (SaaS de gestão para buffets e casas de eventos), either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the readme.md file within this skill, and explore the other available files.

- `styles.css` — link this one file; it imports tokens (`tokens/`), the General Sans webfonts and all component CSS.
- `components/` — React primitives (`.jsx` + `.d.ts` + `.prompt.md`). In HTML artifacts load the compiled `_ds_bundle.js` and read components from `window.BanketDesignSystem_f9651f`.
- `ui_kits/banket-app/` — full click-through of the app; copy screens as starting points.
- `assets/` — official logo (dark, light, mark) and fonts. Never redraw the logo.
- Icons: Tabler Icons outline, stroke 1.5, via the `Icon` component (`components/core/iconPaths.js`).

Key rules: pt-BR copy in sentence case; General Sans 400/500; terracotta (`--terracotta-600` primary action, `--terracotta-700` links) on warm clay neutrals (`--bg-app` clay-50, white cards, clay-200 hairlines); radii 8 (controls) / 12 (cards); warm soft shadows; no emoji; one primary button per region.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.
