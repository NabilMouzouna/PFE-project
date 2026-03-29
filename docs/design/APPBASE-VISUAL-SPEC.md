# AppBase — Visual design specification

> **Purpose:** Canonical **style guide** for AppBase marketing pages, reference apps (`apps/example`), and future dashboard surfaces when they should feel consistent with the product brand.  
> **Reference:** Derived from the approved landing mockup (soft cream canvas, navy typography, teal / rose / mint accents, editorial serif + neutral sans). Replace placeholder copy with AppBase-specific messaging in implementation.

---

## Table of contents

1. [Design principles](#1-design-principles)
2. [Foundations](#2-foundations)
3. [Layout & grid](#3-layout--grid)
4. [Typography](#4-typography)
5. [Color system](#5-color-system)
6. [Elevation, borders & radii](#6-elevation-borders--radii)
7. [Core components](#7-core-components)
8. [Page patterns](#8-page-patterns)
9. [Motion](#9-motion)
10. [Accessibility](#10-accessibility)
11. [Implementation notes](#11-implementation-notes)
12. [Changelog](#12-changelog)

---

## 1. Design principles

| Principle | Intent for AppBase |
|-----------|---------------------|
| **Calm confidence** | Reads as infra you can trust: no neon gradients, no noisy chrome. |
| **Editorial clarity** | Serif for **hero / impact**; sans for **UI and long explanations**. |
| **Soft structure** | Rounded cards, dashed groupings, thick accent bars—structure without harsh grids. |
| **Color as meaning** | Teal = data / database; rose = files / storage; mint = platform / “glue” features; navy = brand + footer gravity. |
| **Generous rhythm** | Prefer **more whitespace** between sections than between elements inside a card. |

---

## 2. Foundations

### 2.1 Spacing scale (4px base)

| Token | Value | Typical use |
|-------|--------|-------------|
| `--space-1` | 4px | Tight icon gaps |
| `--space-2` | 8px | Inline pill padding (vertical) |
| `--space-3` | 12px | Card padding (compact) |
| `--space-4` | 16px | Form fields, list gaps |
| `--space-6` | 24px | Card padding (comfortable) |
| `--space-8` | 32px | Section-internal stacks |
| `--space-10` | 40px | Between sub-sections |
| `--space-12` | 48px | Major section breaks |
| `--space-16` | 64px | Hero → first content block |
| `--space-24` | 96px | Page top/bottom breathing room on large |

### 2.2 Content width

| Surface | Max width | Notes |
|---------|-----------|--------|
| **Reading column** | `min(42rem, 100% - 2 * padding)` | ~672px for body subcopy |
| **Landing stack** | `min(56rem, 100% - 2 * padding)` | ~896px for mockup-style single column |
| **Wide feature** | `min(72rem, 100% - 2 * padding)` | Full-width bands inside horizontal padding |

Horizontal page padding: **24px** mobile, **32–48px** tablet+, **64px** large desktop when the background is full-bleed cream.

---

## 3. Layout & grid

### 3.1 Default landing structure (top → bottom)

1. **Hero** — wordmark/title, partial underline rule, tagline (sans), optional **version badge** (top-right of hero cluster).
2. **Grouped capability** — e.g. “Authentication” inside a **dashed frame** with **pill chips**.
3. **Two-up feature cards** — equal-height row at `md+`; stack at `sm`.
4. **Full-width highlight band** — left **vertical accent bar** + tinted panel copy (platform / “why AppBase”).
5. **CTA footer** — **navy slab**, inverted type, primary + secondary actions.

### 3.2 Alignment

- Center the **main vertical stack** on marketing pages.
- **Left-align** text inside cards and the highlight band for readability.
- **CTA footer:** two-column split at `md+` (headline + subcopy left, actions right); stack on small screens with actions full-width.

---

## 4. Typography

### 4.1 Typefaces

| Role | Style | Usage |
|------|--------|--------|
| **Display / hero** | Transitional or **modern serif** (e.g. *Instrument Serif*, *Source Serif 4*, *Fraunces*) | Page title / “AppBase” wordmark, optional section titles |
| **UI & body** | **Humanist or neo-grotesque sans** (e.g. *DM Sans*, *Inter*, *Geist Sans*) | Taglines, card body, buttons, labels, navigation |

**Pairing rule:** Use **one serif family** and **one sans family** per surface. Do not add a third display face.

### 4.2 Scale (web, desktop-first)

| Token | Font | Weight | Size / line-height | Use |
|-------|------|--------|---------------------|-----|
| `display/xl` | Serif | 700 | clamp(2.5rem, 5vw, 3.75rem) / 1.05 | Hero title |
| `heading/lg` | Serif | 700 | 1.75rem–2rem / 1.2 | In-card titles (“Database →”) |
| `heading/md` | Sans | 700 | 1.125rem–1.25rem / 1.3 | Band titles (“Serverless Functions” style) |
| `body/lg` | Sans | 400 | 1.125rem / 1.55 | Hero tagline |
| `body/md` | Sans | 400 | 1rem / 1.6 | Card descriptions |
| `body/sm` | Sans | 500 | 0.875rem / 1.5 | Pills, badges, meta |
| `eyebrow` | Sans | 600 | 0.6875rem / 1.2; letter-spacing 0.08em; uppercase optional | Section labels embedded in rules |

**Title underline (hero):** A **2–3px** rule in **navy**, **shorter than the word** (roughly 55–70% of text width), left-aligned with the first letter. The rule sits **4–8px** below the baseline.

### 4.3 Arrow convention in titles

Feature links may use a **Unicode arrow** or icon: `Database →`, `Storage →`. The arrow inherits title color and weight; on hover, translate **2px right** (see Motion).

---

## 5. Color system

Values below are **spec targets**; tune in implementation for WCAG. Names are **semantic** for AppBase.

### 5.1 Core palette

| Token | Hex (target) | Usage |
|-------|----------------|--------|
| `--appbase-bg-canvas` | `#FDFCF8` | Page background (warm off-white) |
| `--appbase-ink-navy` | `#1B2A4A` | Primary headings, hero underline, CTA footer background |
| `--appbase-ink-muted` | `#4B5563` | Secondary body on cream |
| `--appbase-ink-inverse` | `#FFFFFF` | Text on navy footer |
| `--appbase-ink-inverse-muted` | `rgba(255,255,255,0.72)` | Subcopy on footer |

### 5.2 Accent: database (teal family)

| Token | Hex (target) | Usage |
|-------|----------------|--------|
| `--appbase-accent-db-bg` | `#E8F7F5` | Database card fill |
| `--appbase-accent-db-border` | `#2DB5A8` | Database card border |
| `--appbase-accent-db-dot` | `#14A89B` | Corner status dot |

### 5.3 Accent: storage (rose family)

| Token | Hex (target) | Usage |
|-------|----------------|--------|
| `--appbase-accent-storage-bg` | `#FCEFF2` | Storage card fill |
| `--appbase-accent-storage-border` | `#E8879A` | Storage card border |
| `--appbase-accent-storage-dot` | `#D65C75` | Corner status dot |

### 5.4 Accent: platform band (mint family)

| Token | Hex (target) | Usage |
|-------|----------------|--------|
| `--appbase-accent-platform-bg` | `#EEF9F0` | Full-width highlight panel |
| `--appbase-accent-platform-bar` | `#1FA896` | 4–6px vertical bar at left edge |

### 5.5 System & chrome

| Token | Hex (target) | Usage |
|-------|----------------|--------|
| `--appbase-border-hairline` | `#D1D5DB` | Dashed group border, pill outline |
| `--appbase-badge-version` | `#EAB308` | Version tag background (e.g. “v2.0 beta”) |
| `--appbase-badge-version-ink` | `#FFFFFF` | Version tag text |

### 5.6 Semantic mapping for AppBase product copy

| Mockup concept | AppBase mapping |
|----------------|-----------------|
| Authentication | `/auth/*`, SDK session + JWT |
| Database | `/db/*`, collections, real-time (per ADR) |
| Storage | `/storage/*`, FS driver, future S3-style adapter |
| “Serverless / edge” / long band | **Platform story**: single BaaS unit today, LAN/offline posture, M2 control plane (wording TBD—keep one clear sentence) |

---

## 6. Elevation, borders & radii

| Element | Border radius | Border / shadow |
|---------|----------------|-----------------|
| **Cards** | `8px` (`0.5rem`) | `1px` solid accent border; **no** drop shadow on mockup (keep flat) |
| **Pills** | `9999px` | `1px` `--appbase-border-hairline`; bg `#FFFFFF` |
| **Dashed group** | `8px` outer | `2px` dashed `--appbase-border-hairline`; label in **notch** or centered on top edge |
| **Version badge** | `4px` | No border; small **shadow** optional (`0 1px 2px rgba(0,0,0,0.08)`) |
| **CTA primary button** | `8px` | No border; bg white, text navy |
| **CTA secondary button** | `8px` | `1px` white @ 80% opacity; transparent fill |
| **Status dot** | 50% | 8–10px diameter; top-right **inside** card padding |

---

## 7. Core components

### 7.1 Hero block

- **Title:** `display/xl`, navy, optional two lines.
- **Underline:** navy bar, partial width, see §4.2.
- **Tagline:** `body/lg`, muted ink, max-width ~36rem, centered under hero cluster.
- **Version badge (optional):** small rectangle **yellow** bg, **white** sans label (e.g. `body/sm`), positioned **top-right** of the hero **container** (not viewport), slight overlap allowed (2–4px “sticky” feel).

### 7.2 Dashed capability frame (“Authentication” pattern)

- Outer **2px dashed** border, large radius (`8px`).
- **Label:** centered on top border—small sans, sits on top of a **cream “break”** in the dash (simulate with background strip matching canvas).
- **Interior:** horizontal **flex/wrap** of **pill chips**, gap `12px`, padding `24px` vertical / `20px` horizontal.

### 7.3 Feature card (two-up)

- **Min height:** align siblings; use flex column with `margin-top: auto` if actions are added later.
- **Padding:** `24px` (`--space-6`).
- **Title row:** `heading/lg` + arrow; color = border hue (teal or rose), not black.
- **Body:** `body/md`, muted ink.
- **Dot:** absolute or grid placement **top-right** inside padding.

### 7.4 Platform highlight band

- Full width inside page gutters.
- **Left bar:** `4–6px` wide, teal (`--appbase-accent-platform-bar`), full height of panel.
- **Panel:** mint background; **title** `heading/md` navy; **body** `body/md` muted.
- **Padding:** `24px–32px` vertical, `24px` horizontal (plus bar width).

### 7.5 CTA footer slab

- Background: `--appbase-ink-navy`.
- **Primary button:** white bg, navy text, **bold** sans.
- **Secondary button:** ghost on navy (transparent, white border, white label).
- **Layout:** headline left, supporting line under in inverse-muted; buttons grouped with **12px** gap.

---

## 8. Page patterns

### 8.1 Marketing landing (reference flow)

1. Canvas bg full viewport.
2. Centered stack with consistent **section spacing** (`--space-12`–`--space-16` between major blocks).
3. Feature cards in **CSS grid:** `grid-template-columns: 1fr` < `768px`; `1fr 1fr` ≥ `768px`; gap `24px`.
4. Footer slab **full-bleed** horizontally (edge to edge); content still constrained to max width with side padding.

### 8.2 App / dashboard adaptation

- Keep **navy + cream** or invert: **cream surfaces** inside **navy chrome** for tool header (optional variation).
- Reuse **pill** style for filters, **card** recipe for list tiles (flat border, accent dot optional for status).
- **Do not** use the dashed group frame for dense data tables without simplifying—it is for **marketing grouping** only.

---

## 9. Motion

| Interaction | Spec |
|-------------|------|
| **Link / arrow titles** | Hover: `translateX(2px)`, `transition: transform 150ms ease` |
| **Pills** | Hover: background `#F9FAFB`, border slightly darker |
| **Primary CTA** | Hover: `opacity 0.92` or `translateY(-1px)` (choose one family-wide) |
| **Page load** | Optional staggered fade-up **max 400ms** total; respect `prefers-reduced-motion` |

---

## 10. Accessibility

- **Contrast:** Navy on cream and white on navy must meet **WCAG AA** for body text; yellow badge needs **dark text** if white fails contrast (prefer **navy text on yellow** for small sizes if white is borderline).
- **Focus:** Visible **2px** focus ring, offset `2px`, color distinct on cream and on navy (e.g. teal or white ring on navy buttons).
- **Touch targets:** Minimum **44×44px** for pills and footer buttons on mobile.
- **Motion:** Honor `prefers-reduced-motion: reduce` by disabling stagger transforms.

---

## 11. Implementation notes

- **Design tokens:** Map §5 and §6 to CSS custom properties (e.g. `:root { --appbase-bg-canvas: … }`) or to Tailwind `@theme` entries in app `globals.css`.
- **Reference app (`apps/example`):** May retain its current neo-brutalist recipe until a deliberate reskin; this spec is the **target** for alignment.
- **Assets:** Store approved PNG/SVG references under `docs/design/assets/` when checked in (avoid linking private IDE-only paths in published docs).
- **Copy:** Replace any third-party placeholder names; keep tone: **simple, honest, builder-oriented**—aligned with `ARCHITECTURE.md` (single BaaS unit, LAN/offline, clear public API boundary).

---

## 12. Changelog

| Date | Change |
|------|--------|
| 2026-03-29 | Initial spec from approved landing mockup (cream / navy / teal / rose / mint, editorial type, component anatomy). |

---

## Related documents

- [`../ARCHITECTURE.md`](../ARCHITECTURE.md) — product boundaries and terminology
- [`../API-SPEC.md`](../API-SPEC.md) — public API (for accurate feature copy)
- [ADR-005](../adr/ADR-005-file-storage-strategy.md) — storage story for marketing accuracy
