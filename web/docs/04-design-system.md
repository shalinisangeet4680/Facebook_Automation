# Design system

## 1. Direction

Calm, precise, and confident: a professional tool for business owners who are not marketers. Generous whitespace, clear hierarchy, one primary action per screen, quiet surfaces, and colour used for meaning.

## 2. Tokens

Defined as CSS variables in `globals.css` and exposed to Tailwind through `@theme`.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--background` | `#F7F7F8` | `#0A0A0B` | page |
| `--surface` | `#FFFFFF` | `#111113` | cards, panels |
| `--surface-muted` | `#F1F1F3` | `#18181B` | wells, inputs |
| `--border` | `#E4E4E7` | `#26262B` | dividers |
| `--foreground` | `#0B0B0F` | `#F4F4F5` | primary text |
| `--muted` | `#6B6B76` | `#A1A1AA` | secondary text |
| `--accent` | `#4F46E5` | `#7C74FF` | primary actions, focus |
| `--accent-soft` | `#EEF0FF` | `#1C1A3A` | selected states |
| `--success` | `#16A34A` | `#22C55E` | passed checks |
| `--warning` | `#D97706` | `#F59E0B` | warnings |
| `--danger` | `#DC2626` | `#F87171` | errors, destructive |

Radius: 8 px controls, 12 px cards, 16 px panels, full for pills. Shadows are subtle and only on raised surfaces.

## 3. Typography

Geist for UI, Geist Mono for codes, IDs, and token fragments.

| Style | Size / line height | Weight |
|---|---|---|
| Display | 40 / 44 | 600 |
| Title | 28 / 34 | 600 |
| Heading | 20 / 28 | 600 |
| Body | 15 / 24 | 400 |
| Small | 13 / 20 | 400–500 |
| Caption | 12 / 16 | 500 |

## 4. Spacing and layout

4 px base grid. App shell: 264 px sidebar, 64 px top bar, content max width 1120 px with 32 px gutters on desktop, 16 px on phones.

## 5. Motion

- Durations 150 ms (hover, press), 220 ms (enter), 320 ms (page and panel), 600–900 ms (illustrations).
- Easing `cubic-bezier(0.22, 1, 0.36, 1)` for entrances, springs for interactive elements.
- Every animation respects `prefers-reduced-motion`: illustrations become static frames, transitions become fades.

## 6. Components

Button (primary, secondary, ghost, danger; sm, md, lg; loading), Input, Phone input, OTP input, Textarea, Card, Badge, Status dot, Check row (passed, warning, failed, pending), Radio card, Skeleton, Spinner, Toast, Dialog, Dropdown menu, Tooltip, Progress ring, Empty state, Error state, Kbd, Copy button.

## 7. Themes

Light and dark, following the system by default with a manual toggle. The theme class is applied by an inline script before first paint, so there is no flash.

## 8. Charts

Charts follow the data-viz method: form first, colour by the job it does, validated palettes, thin marks, hover tooltips and a table view for every chart.

- **Single series** (counts, averages, languages): `--accent`.
- **Star ratings** are an ordered scale with a neutral middle, so they use a diverging palette, red ↔ blue with a gray midpoint. Validated with the data-viz validator in both modes (adjacent colour-blind ΔE ≥ 11, normal-vision ΔE ≥ 15); the light arms are below 3:1 contrast, so every chart ships a legend and a table view.

| Token | Light | Dark |
|---|---|---|
| `--chart-star-1` | `#c43c3b` | `#f07a79` |
| `--chart-star-2` | `#ef8f8e` | `#9c4847` |
| `--chart-star-3` | `#d6d5cf` | `#3a3a37` |
| `--chart-star-4` | `#86b6ef` | `#2e5f9e` |
| `--chart-star-5` | `#2a78d6` | `#5ea2f0` |
| `--chart-grid` | `#ececef` | `#1e1e22` |
| `--chart-axis` | `#d4d4d8` | `#34343b` |

- Marks: columns at most 24 px wide with a 4 px rounded data end, a 2 px gap between stacked segments, 2 px lines with ringed end dots, solid hairline grid. Labels and values use text tokens, never the series colour.
- No dual axes: rating and volume are separate charts.
- Status colours (`--success`, `--warning`, `--danger`) are only for state, always with an icon or label.
