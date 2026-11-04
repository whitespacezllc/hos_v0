# Admin Design System

Single source of truth for the House of Shakti admin panel.

> **Admin prioritizes legibility and density over editorial restraint.** Use this document when in doubt.

The admin shares the public site's color tokens but applies them with a
different philosophy: information first, restraint second. It also runs on a
**white surface + burgundy/black accent** palette and a **clean sans-serif**,
both scoped to `.admin-scope` (set on the admin shell in `DashboardLayout.tsx`
and on `/login`). The public site keeps its cream palette and Chalet face
untouched.

`.admin-scope` in `globals.css` redefines `--font-body` to Arial, so every
`font-body` utility inside the admin resolves to the sans-serif with no
per-component class changes.

---

## 1. Typography

| Stack | Family | When to use |
|---|---|---|
| `font-display` | Krylon | ONLY the sidebar logo "House of Shakti". Never body, labels, or buttons. |
| `font-body` | **Arial** (sans-serif, via `.admin-scope`) | Default for everything: page headings, labels, table headers, body, buttons, badges. |

### Size scale

| Element | Classes |
|---|---|
| Page heading | `font-body text-2xl lg:text-3xl font-normal text-ink` |
| Section heading | `font-body text-lg font-medium text-ink` |
| Body text | `font-body text-sm text-ink/80` |
| Table headers | `font-body text-xs font-medium text-ink/70` |
| Field labels | `font-body text-sm text-ink/80` |
| Small helper text | `font-body text-xs text-ink/70` |

**No small spaced capitals and no eyebrows.** Labels are sentence case at a size
that can be read; extra information goes below a title, never above it. Only
acronyms stay in capitals (ES/EN, USD).

Line height: `leading-tight` for headings, `leading-normal` for body. Avoid
`leading-relaxed` — too much vertical space for an admin tool.

---

## 2. Color palette

### Surfaces

| Token | Hex | Use |
|---|---|---|
| `bg-neutral-50` | `#fafafa` | Main content area background (soft white — less glare than pure white) |
| `bg-white` | `#ffffff` | Cards / tables / drawers / elevated surfaces |
| `bg-burgundy` | `#8D0000` | Sidebar background + primary actions (the landing's "bordó") |
| `bg-neutral-50` | `#fafafa` | Row hover state + table header rows |
| `bg-black` (or `hover:bg-dark`) | `#000000` / `#340000` | Secondary-button hover, total bars, high-contrast accents |

### Borders

| Token | Use |
|---|---|
| `border-ink/10` | Default 1px border |
| `border-ink/15` | Stronger separator (section dividers) |
| `border-cream/15` | Internal sidebar borders (on dark bg) |

### Text colors

On **light surfaces** (warm-white / white):
- Primary: `text-ink` (#313131)
- Secondary and labels: `text-ink/70` (the floor for text you need to read: about 5:1 on white)
- Placeholders and decorative icons only: `text-ink/50` → `text-ink/60`

On **sidebar (dark surface)**:
- Primary: `text-cream`
- Secondary: `text-cream/85`
- Muted: `text-cream/70`

### Accent palette (refined earth tones)

Used for status indicators, category labels, and confirmations. **Avoid any
saturated greens, blues, violets, oranges** — the current admin calendar uses
those and they will be migrated to this palette in Prompt 9.3.

| Name | Hex | Use |
|---|---|---|
| Burgundy | `#8D0000` | Primary actions, critical info, destructive confirmation |
| Olive / sage | `#6B7355` | Success states ("Active", "Confirmed") |
| Sand | `#A6896D` | Secondary highlights |
| Warm gray | `#7A6B5D` | Neutral states ("Draft", "Inactive") |
| Terracotta | `#8B6F47` | Warnings, attention states |

---

## 3. Spacing scale

Admin uses tighter spacing than the public site.

| Use case | Classes |
|---|---|
| Page frame | `<PageContainer>`: one width and one gutter for every page |
| Card padding | `p-4 sm:p-6` (NOT `p-8` or `p-12`) |
| Stack spacing | `space-y-4` → `space-y-6` (NOT `space-y-10`) |

---

## 4. Base components

Located in `/components/admin/`.

| Component | Purpose |
|---|---|
| `Sidebar.tsx` | Fixed left navigation from `lg`; below that, a top bar that opens it as a drawer. |
| `PageContainer.tsx` | The frame every page sits in. |
| `PageHeader.tsx` | Consistent header for every admin page (heading + description + actions). |
| `Modal.tsx` | Forms. Title and actions stay put and the form scrolls between them, so Save is always in sight. A sheet from the bottom on a phone. |
| `Drawer.tsx` | A record's details, on the right. Full screen on a phone. Escape closes it. |
| `RowIconButton.tsx` | A row's icon action: 40px for a finger, 32px and a tooltip for a mouse. |
| `DateFilter.tsx` | A date filter that says "Any date" when empty (Safari paints today's date in an empty date input). |
| `Button.tsx` | 4 variants: `primary`, `secondary`, `tertiary`, `destructive`. Supports `icon`, `loading`, `disabled`. No border-radius. |
| `Badge.tsx` | Status / category labels with a faint fill. 5 variants: `active`, `inactive`, `warning`, `destructive`, `neutral`. |
| `Card.tsx` | Base container (`bg-white`, 1px border, no radius, no shadow). Three padding modes. |
| `EmptyState.tsx` | Replaces weak "no data" patterns. Icon + heading + description + optional action. |
| `DeleteConfirmation.tsx` | Reusable destructive-action modal with ESC + backdrop close. |

---

## 5. Motion

Admin animations are **subtle and functional**, not editorial.

- Hover transitions: `transition-colors duration-200 ease-out`
- Active link transitions: `transition-all duration-200`
- Drawer (mobile): Framer Motion, duration 300ms, ease easeOut
- Modal (delete confirmation): scale 0.95 → 1 + fade, duration 200ms
- **No** scroll-triggered animations, **no** `useInView`, **no** word-by-word reveals

The admin is a tool. Tools open quickly and don't perform.

---

## 6. Layout shell

```tsx
<div className="admin-scope min-h-dvh bg-neutral-50 text-ink">
  <Sidebar />                               {/* fixed from lg, top bar below */}
  <main className="min-w-0 lg:ml-[260px]">
    <PageContainer>{/* the page */}</PageContainer>
  </main>
</div>
```

The sidebar is `260px` from `lg` up. Below `lg` the same navigation is a drawer
behind a sticky top bar, which is in the flow and so never covers a title. The
sidebar body is `w-full min-w-0`: nothing inside it, however long (the signed-in
email), can widen it past the space `main` reserves.

### Every width

Nothing may scroll the page sideways, at any width. What doesn't fit folds:

| Width | What there is |
|---|---|
| `< md` (phones) | Lists are cards; the calendar is a day selector plus that day's classes. |
| `md` → `lg` (tablets) | Tables and the week grid, full width, no sidebar. |
| `lg` → `xl` (small laptops) | Sidebar. Tables show only the columns that fit (Packs stays in cards). |
| `xl`+ | All the columns. |

A column that doesn't fit is hidden (its data is one click away in the drawer) or
folded into the cell next to it; a table never makes the reader scroll sideways
to find its actions. A filter or a search field is `text-base` below `md`: iOS
zooms the page on focus for anything smaller.

## 7. Prices

Packs → Prices is where the studio sets the drop-in and the packs
(`class_packs`, `app/actions/prices.ts`). The row with one class is the standard
price of a class: saving it moves every recurring class and upcoming session
still at the old standard. A class priced apart (a free meditation, a workshop)
keeps its own price, and the section lists them. What has been sold never
changes: a booking and a pack purchase each store the amount they were sold at.

## Language

The panel speaks English and Spanish. Which one is a preference, not a URL:
there is one `/admin`, and the language lives in the `hos_admin_locale`
cookie (`lib/admin-locale.ts`), written by the sidebar toggle
(`app/actions/admin-locale.ts`) and at sign-in to the language of the login
page. `i18n/request.ts` resolves it for every request outside `app/[locale]`,
and `app/admin/layout.tsx` hands the `admin` namespace of the catalogue to the
client tree.

- Every string the admin reads comes from `messages/{en,es}.json` under
  `admin.*`: `admin.common` (actions, statuses, payment methods, labels,
  units, feedback, validation — reuse before inventing), `admin.nav`,
  `admin.sidebar`, then one namespace per area (`admin.dashboard`,
  `admin.calendar`, `admin.schedule`, `admin.bookings`, `admin.packs`,
  `admin.upsells`, `admin.promo`, `admin.retreats`, `admin.shared`). The
  sign-in pages, which live under `app/[locale]`, use the top-level `auth`
  namespace and take the language from the URL.
- Client components: `useTranslations('admin.<area>')`; server components:
  `getTranslations('admin.<area>')`. Dates format with the reader's date-fns
  locale (`dateFnsLocale(useLocale())`), always in Costa Rica time.
- Database values (`pending`, `card`, class names, instructor names) are data
  and stay as they are; only copy is translated. `npm run check:messages`
  keeps both catalogues in step.
