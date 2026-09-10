# ThermalTrace brand marks

Logo system (2026-09): T + through-stem temperature trace.

| File | Concept | Use |
|------|---------|-----|
| `../logo.svg` / `src/assets/gtm.svg` | #1 Wordmark + icon | Site header / sidebar |
| `mark-dark.svg` | #2 Monogram tile | App / PWA / favicon source |
| `mark-circle.svg` | #3 Circular | Discord / social avatar |
| `mark.svg` | #4 Bare (charcoal) | Light backgrounds / print |
| `mark-on-dark.svg` | #4 Bare (light T) | Dark UI without tile |
| `mark-line.svg` | #4 Minimal line | Mono / small UI |
| `mark-fg.svg` | Adaptive FG | Android foreground |
| `mark-maskable.svg` | Maskable | PWA safe-zone |

## Palette

| Token | Hex | Role |
|-------|-----|------|
| `--color-brand-charcoal` | `#2F3A45` | Hardware / tile base |
| `--color-brand-slate` | `#6B7C93` | Secondary steel |
| `--color-brand-orange` | `#FF7A00` | Trace, CTAs, focus |
| `--color-brand-yellow` | `#FFC107` | Trace highlight / node |

Fonts: **Sora** (display) + **Plus Jakarta Sans** (body) — do not swap for Inter/Roboto.

## CSS usage

Defined in `src/styles/global.css` `@theme`:

| Token family | Use for |
|--------------|---------|
| `--color-accent*` | Primary buttons, text links, focus rings, selected chrome, primary chart trace |
| `--color-info*` | Informational banners/chips only (stays blue) |
| `--color-warning*` | Freeze / high-risk urgency (deeper orange-red) |
| `--color-success*` | Normal / healthy states (restrained green) |
| `--color-danger*` | Errors / failures |

Legacy `--color-peach` / `--color-terracotta` map to the orange family for old class names.

Regenerate rasters: `pnpm brand:icons`
