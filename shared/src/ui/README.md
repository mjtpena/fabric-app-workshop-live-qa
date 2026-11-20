# @x10/shared/ui: component reference

The design-system kit for the ten apps. Read `docs/DESIGN.md` for the bar; this file is the API.
See every component and state live: `npm run playground -w shared` → http://localhost:5200
(`?accent=ember&theme=dark`, routes `#/`, `#/shell`, `#/signin`, `#/boot`). Screenshots: `shared/playground/screenshots/`.

```ts
import { Button, Stat, StatStrip, … } from '@x10/shared/ui';
import { SimpleBarChart, useChartColors, … } from '@x10/shared/charts';
import { motion, AnimatePresence, layoutSpring, MotionProvider } from '@x10/shared/motion'; // only where order changes live
import { AppShell, AppLogo, useApp, useThemePref } from '@x10/shared/runtime';
```

Icons: `lucide-react` (already a dependency of `@x10/shared`). 16 px in controls; the kit sets stroke 1.75 inside its components.

## Tokens (Tailwind utilities)

| Group | Utilities / variables |
|---|---|
| Surfaces | `bg-bg` page · `bg-surface` panel · `bg-surface-2` fill/hover · `bg-surface-sunken` wells, code, table header · `bg-surface-raised` popovers · `bg-inverse text-on-inverse` toasts/tooltips |
| Lines | `border-line` hairline · `border-line-strong` controls · `divide-[var(--line)]` |
| Text | `text-fg` · `text-muted` (secondary, AA) · `text-faint` (placeholder, captions only) |
| Gray ramp | `bg-gray-1 … gray-12` (1–2 backgrounds, 3–5 component fills, 6–8 borders, 9–10 solid, 11–12 text) |
| Accent ramp | `bg-accent-9 text-accent-contrast` solid · `bg-accent-3 text-accent-11` soft · `text-accent-11` accent text · `border-accent-7` |
| Named ramps | `indigo ember blue plum amber violet coral teal gold cyan green red`, steps 1–12 (`bg-ember-9`, `text-green-11`, `var(--gold-4)`) for a second colour (Keep vs Kill, Certified vs Promoted). Never Tailwind's `teal-500` palette. |
| Status | `ok warn bad info` × `-solid` `-soft` `-text` `-line` `-contrast` (`bg-bad-soft text-bad-text`). `text-ok` etc. = the text step (v1 names). |
| v1 aliases | `--brand` = accent-9, `--brand-strong` = accent-10, `--brand-soft` = accent-3, `--brand-text` = accent-11, `--on-brand`; `--chart-1..6`, `--chart-ok/warn/bad`, `--shadow`, `--focus`. Use `text-brand-text` (not `text-brand`) for accent-coloured text: bright accents (amber, gold, cyan, coral) are not text colours. |
| Type | `text-xs` 12 · `text-ui` 13 · `text-sm` 14 (body) · `text-base` 16 · `text-lg` 18 · `text-xl` 22 · `text-2xl` 28 · `text-3xl` 36 · `text-4xl` 48 · `text-5xl` 64 (tracking built in). `font-mono` (Geist Mono) · `x-serif` / `font-serif` (Instrument Serif, editorial headlines only) · `num` = tabular figures |
| Elevation | `shadow-xs` controls · `shadow-1` popovers/menus · `shadow-2` dialogs. Radii: `rounded-md` 6 small controls · `rounded-lg` 8 controls · `rounded-xl` 12 panels · `rounded-full` avatars/dots only |
| Motion | `ease-standard` = cubic-bezier(0.2,0,0,1), 120–200 ms (`duration-[160ms]`). Reduced motion is respected globally. |
| Layout | `--header-h` 52px · `--content-max` 1200 · `--content-wide` 1360 · `--x-bottom-inset` (phone tab bar height; add to fixed bottom UI) |
| Dark | `dark:` variant follows the system unless `<html data-theme>` forces one. Design both themes; don't hard-code `#fff`. |
| Classes | `x-table` (+ `.num` cells, `is-compact`, `is-sticky`) · `x-control` (custom field shells) · `x-panel` (floating panel) · `x-skeleton` · `x-tap` (44px hit area on touch) · `x-noprint` · `x-mono` |

## Accent and logomark (AppConfig)

```ts
export const config: AppConfig<Schema> = {
  …,
  accent: 'ember',                    // indigo | ember | blue | plum | amber | violet | coral | teal | gold | cyan
  logo: <KillGlyph />,                 // inline <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
  // or, to keep app.config.ts JSX-free (seed tools load it in Node):
  logoPaths: ['M7 7l10 10', 'M17 7 7 17'],
  nav: [{ to: '/', label: 'Board', end: true, icon: <LayoutGrid /> }, …], // icon is for the phone tab bar
};
```

Without `accent`, mountApp uses the accent assigned to the appId in DESIGN.md §3. Without `logo`, the tile shows the
title's initial. `<AppLogo size={32} />` renders the logomark anywhere inside the app (big screen, empty states).
`data-accent="<name>"` on any element re-themes that subtree.

## Shell (runtime)

`AppShell` (`wide` for boards, 1360px): 52px header with logomark, text nav with active underline, identity menu
(avatar, name, role tag; rename, theme, persona switcher, reset demo, sign out). Phones: compact header and a bottom tab
bar (first 3–4 nav items, the rest under More). Slim dismissible demo strip (`data-testid="demo-banner"`), one-line footer.
`AdminOnly`, `SignInPage`, `BootScreen`, `useThemePref()` are exported too. Main content has 24px gutters (16 on phones).

## Components

All accept `className` unless noted. `Tone` = `'ok' | 'warn' | 'bad' | 'info' | 'neutral' | 'brand'`.

### Actions
- **Button** `variant` primary | secondary (default) | ghost | subtle | soft | danger · `size` sm 28 | md 32 | lg 40 · `icon` · `iconRight` · `busy` (spinner, keeps width and accessible name) · native button props. Icon with no children = square icon button.
- **IconButton** `label` (required, aria-label + title) · `icon` · `variant` (ghost) · `size`.
- **LinkButton** `to` (react-router) or `href` · same `variant`/`size`/`icon`/`iconRight` as Button.
- **buttonClass({ variant, size, square, className })** class string for anything that should look like a button.
- **CopyButton** `text` (string or fn) · `label` · `size` · `variant`.

### Status and labels
- **Chip** `tone` · `icon` (default true: hairline tag with a status dot; `false`: soft tinted tag, no dot). No glyphs.
- **Badge** `tone` · `variant` dot (default: dot + text, for tables) | outline | soft | solid · `size` sm | md · `icon` · `pulse`.
- **StatusDot** `tone` · `pulse` (live) · `size` px · `label` (sr text when alone).
- **Tag** neutral label for domains/keywords · `tone` · `mono` · `size` · `icon` · `onRemove` (+ `removeLabel`).
- **Kbd** keyboard key. **Spinner** `small` · `size` · `label`.
- **Avatar** `name` · `size` xs 20 | sm 24 | md 28 | lg 32 | xl 40 | number · `ring`. Stable colour per name.
- **AvatarStack** `names` · `max` (4) · `size` · `label`.
- **LogoTile** `title` · `logo` · `size` (use `AppLogo` inside apps).

### Layout
- **PageHeader** `title` · `subtitle` (one line, optional) · `actions` · `eyebrow` (breadcrumb/back link) · `meta` (badges, owner, dates row).
- **Section** `title` · `description` · `actions` · `id`.
- **Card** `as` section | div | article | li · `interactive` (hover lift) · any data-/aria- props. The primary object only; never card-in-card.
- **List** divided list panel (`as` ul | ol | div, `label`); put `<li className="px-4 py-3">` rows inside.
- **Toolbar** compact filter bar · `sticky` (pins under the header).

### Numbers
- **Stat** `label` · `value` · `hint` · `tone` (colours the value) · `delta` `{ value, direction: up|down|flat, good: up|down }` · `icon` · `size` sm | md | lg.
- **StatStrip** row of Stats in one panel with hairline dividers (2 cols on phones) · `columns` · `bare` (dividers only, inside a Card).
- **KpiCard / KpiRow** v1 API, render as Stat / StatStrip.
- **Meter** `value` · `max` · `tone` · `label` · `showValue` · `format(v,max)` · `size` sm | md | lg · `markers` `[{ value, label }]` (thresholds such as 60%).
- **Progress** `value` (omit = indeterminate) · `max` · `tone` · `label` · `size`.
- **ProgressRing** `value` · `max` · `size` · `thickness` · `tone` | `color` · `label` · children in the centre (scores).
- **ShareBar** `parts [{ value, color, label }]` · `label` · `size`.
- **Countdown** `to` · `from` + `ring` (ring of time left) · `format` auto | clock | short · `doneLabel` · `onDone` · `tone` (auto: warn < 1 day, bad < 1 h) · `now` (tests). `formatCountdown(ms, format)` helper.
- **Timeline** `items [{ title, time, description, tone, icon, gap }]` (`gap` renders the duration between steps).

### Tables
- **TableWrap** scroll container (never page-level horizontal scroll) · `label` · `maxHeight` (enables an internal sticky header).
- **Table** `density` normal | compact · `stickyHeader`. **Th** `numeric`. **Td** `numeric` (right, mono, tabular) · `muted`. **Tr** `selected` · `onClick` (keep a real link in a cell too).
- Existing `<table className="x-table">` markup gets the same styling; add `className="num"` to numeric cells.

### Forms (32px, 40px on phones; 16px text on phones so iOS does not zoom)
- **Field** `label` · `htmlFor` · `hint` · `error` · `required` · `counter { value, max }`.
- **Input / Select / TextArea** native props + `invalid` · `controlSize` sm | md | lg (Input, Select).
- **Checkbox** `label` · `checked` · `onChange(bool)` · `description` · `disabled`.
- **Switch** `label` (aria) · `checked` · `onChange` · `size` sm | md.
- **SearchInput** `value` · `onChange` · `label` · `placeholder` · `shortcut` (e.g. "/" focuses it) · clear button, Escape clears.
- **FilterSelect** `label` (sits inside the control: "Status  Open ⌄") · `value` · `onChange` · `options`.
- **SegmentedControl** `options [{ value, label, icon, ariaLabel, disabled }]` · `value` · `onChange` · `label` · `size` · `fullWidth`. Radiogroup with arrow keys.

### Overlays (top layer: never clipped, above dialogs)
- **Tooltip** `content` · `side` · `delay` · `shortcut`. Short labels only; touch users can't hover.
- **Popover** `trigger` (one element) · children or `(close) => …` · `placement` · `width` · `label` · controlled `open`/`onOpenChange`.
- **Menu** `trigger` · `label` · `items` (`{ label, icon, shortcut, description, onSelect, danger, disabled, checked, role, testId }`, `{ type: 'separator' }`, `{ type: 'label', label }`) or `children={(close) => <MenuItem …/>}` · `placement` · `width` · `header`. Arrow keys, Home/End, Escape, focus return.
- **Dialog** `open` · `onClose` · `title` · `description` · `footer` · `drawer` (right panel on desktop) · `size` md | wide. Bottom sheet on phones automatically.
- **Sheet** `side` bottom | right | left, same props. Mobile filters, More menus.
- **ConfirmDialog** unchanged API (`noteLabel`, `noteRequired`, `danger`, `onConfirm(note)`).
- **Tabs** underline tabs · `tabs [{ value, label, count }]` · `value` · `onChange` · `label`. Arrow keys.
- **Toast** `message` · `onDone` · `action { label, onClick }` (Undo) · `tone` ok | bad · `duration`. Bottom centre, above the tab bar.

### States
- **DataState** `state` (useAsync) · `isEmpty` · `empty` · `skeleton` (pass a layout-matching skeleton) · `loadingRows`.
- **EmptyState** `title` · children (one line) · `action` · `icon` · `compact` · `bordered`.
- **ErrorPanel** `error` · `onRetry` · `title`. **InlineError** `error`. **Callout** `tone` · `title` · `action` · `icon` (inline guidance next to the decision).
- **Skeleton** `width` · `height` · `circle`. **SkeletonText** `lines`. **LoadingBlock** `rows`.

### Stage kit: centrepieces (DESIGN.md top section and §3)

Every app's home screen is a centrepiece in this frame. The kit gives the frame; the app draws the world (three.js,
canvas or SVG; add your own rendering library, `@x10/shared` deliberately ships none). Full demo: playground `#/stage`
(an isometric SVG town with lenses, Today, view-as and the list fallback; source `shared/playground/stage-demo.tsx`).

```tsx
<AppShell immersive>                       {/* full-bleed main, fills the viewport under the header (desktop), no footer */}
  <StagePage
    label="Report garden"                  // accessible name of the stage region
    view={view}                            // 'stage' | 'list'
    breadcrumb={[{ label: 'Garden', onClick: reset }, { label: bed?.name ?? 'All beds' }]}
    title="The report garden" meta="25 reports · 4 beds"
    topRight={<><FlyTo /><ViewToggle value={view} onChange={setView} glass={view === 'stage'} /></>}
    lenses={<LensBar lenses={LENSES} value={lens} onChange={setLens} />}
    legend={<Legend title="Staleness" items={legend} collapsible />}
    bottomRight={<ViewAsSwitch options={roles} value={role} onChange={setRole} />}
    side={<TodayPanel bare items={today} date="Fri 20 Nov" activeId={focus} onSelect={(it) => flyTo(it.id)} />}
    sideCount={today.length}
    stage={supportsWebGL() ? <Garden3D lens={lens} focus={focus} /> : <GardenSvg … />}
    list={<GardenTable />}                 // the accessible equivalent, same data
  />
</AppShell>
```

- **StagePage** (alias **ImmersiveLayout**) props: `stage` (fills the stage; size your canvas to its parent) · `label` ·
  `title` · `breadcrumb` (items or node) · `meta` · `topRight` · `lenses` (bottom centre) · `legend` (bottom left) ·
  `bottomRight` · `side` (right glass panel on desktop, collapsible; a bottom sheet behind a "Today (n)" button on phones) ·
  `sideTitle` · `sideCount` · `sideOpen`/`onSideOpenChange` · `view` + `list` · `background` (default: the world sky
  gradient) · `children` (below the stage on phones, below the list). The root sets `--side-w` (side panel width + gap,
  0 when closed): offset your camera or SVG so the focal point centres left of the panel
  (`className="w-[calc(100%-var(--side-w,0px))]"`). Phones: title, stage at 58svh, lenses, then the sheet button.
- **FloatingPanel** glass panel (16px radius, translucent, blur, hairline, soft shadow, both themes) · `title` (mono
  caption) · `actions` · `padding` none | sm | md | lg · `as`. The class `x-glass` gives any element the same look.
- **LensBar** `lenses [{ value, label, swatch (CSS colour or gradient), icon, description }]` · `value` · `onChange` ·
  `label` ("Lens") · `hotkeys` (1–9, default on) · `showLabel` · `glass`.
- **ViewAsSwitch** `options [{ value, label, name (avatar), icon }]` · `value` · `onChange` · `label` ("View as") ·
  `cycleKey` ("v"; `false` to turn off) · `glass`.
- **ViewToggle** `value` 'stage' | 'list' · `onChange` · `stageLabel` ("Map") · `listLabel` · icons · `hotkey` ("l") ·
  `glass`. Name the stage label in the metaphor ("Garden", "Radar", "Board").
- **Legend** `items [{ label, color, shape dot|square|line|dash|ring|diamond, icon, value }]` · `title` · `collapsible` ·
  `defaultOpen` · `columns` 1 | 2 · `bare`. Labels are small mono caps (`x-legend-label`).
- **TodayPanel** `items [{ id, title, severity (Tone), value (big number), unit, lens, meta, onClick }]` (rank them: 3–5
  items) · `onSelect(item)` · `activeId` · `title` · `date` · `empty` · `bare` (inside StagePage `side`). Each item is a
  button: fly the centrepiece to the thing behind it and switch to the item's lens.
- **Breadcrumb** `items [{ label, to | href | onClick }]`; the last item is the current place.
- **StageMessage** centred glass message on the stage (`icon`, `title`, children, `action`): loading the world, an empty
  world, or "3D needs WebGL" with a button to the list.
- **SegmentedControl** `glass` gives the same translucent pill look for controls over the stage.

Hooks and helpers (also from `@x10/shared/ui`):
- `useHotkeys({ k: fn, 'shift+?': fn, 'mod+k': fn, escape: fn }, { enabled, allowInInputs, allowInDialogs })`: ignored
  while typing and while a dialog is open.
- `useReducedMotion()`: stop camera flights, physics, idle loops; jump instead of animate.
- `supportsWebGL()`: cached; `?nowebgl` in the URL forces false (test your fallback).
- `useThemeColors()`: concrete colours for renderers that can't read CSS vars: `{ dark, world: { sky, ground, … },
  accent[1..12], gray[1..12], ok, warn, bad, info, text, muted, surface, line }`; re-reads on theme/accent change.
  `cssVar('--world-glow')` for one value. `useMediaQuery(q)`, `useIsDesktop()`.

World tokens (light: airy pastels on a soft paper ground; dark: a calm night), as CSS vars `--world-*` and Tailwind
`bg-world-*` / `text-world-*`: `sky`, `sky-2` (horizon), `haze`, `ground`, `ground-2`, `structure`, `structure-2`
(lit / shaded faces), `water`, `water-2`, `foliage`, `foliage-2`, `glow` (lit windows, highlights), `ink`, `ink-muted`
(labels drawn in the world), `grid`, `shadow`. Use status and accent ramps for data encodings on top of them, never
for the world itself, so lenses stay readable. Glass: `--glass`, `--glass-strong`, `--glass-line`, `--shadow-float`.

Print: `.print-only` (hidden on screen) and `.no-print` / `.x-noprint`; glass panels print as plain bordered boxes,
`@page` margins are set, and a StagePage in list view prints as a document. Give each app a print path (a list, a
poster, a one-pager) rather than printing the canvas.

### Charts (`@x10/shared/charts`)
`SimpleBarChart`, `SimpleLineChart`, `SimpleScatterChart`, `Heatmap`, `ChartFrame` keep their v1 props and add
`description`, `bare` (no panel), `yFormat` (bar). Line charts label lines at their end for 2–4 series (`directLabels`).
`ChartLegend`, `ChartTooltip` for custom Recharts charts; `useChartColors()` returns concrete colours (series[0] is the
accent) and updates with theme and accent.

## Do / don't

- **Do** give the primary object the space; use type and whitespace for hierarchy. **Don't** put every list item in a Card or a card in a card.
- **Do** use `StatStrip` for a few numbers, or put numbers in context. **Don't** add a row of KPI cards to every page.
- **Do** keep PageHeader subtitles to one line or drop them. **Don't** write an instruction paragraph under each heading.
- **Do** show status as `Badge`/`Chip` (dot + label) or a soft `Tag`. **Don't** add ✓ ! i glyphs or pastel pills with icons.
- **Do** reserve colour for state, the accent and the signature visual. **Don't** use Tailwind's default palette (`teal-500`) or hex colours.
- **Do** right-align numbers in mono (`Td numeric`, `num`). **Don't** centre numeric columns.
- **Do** design loading (skeleton shaped like the result), empty (teach the next action) and error (Retry) for every view.
- **Do** use `Sheet`/bottom-anchored actions and 44px targets on phones; check 390px for horizontal scroll.
- **Do** check both themes. **Don't** use pure black or white surfaces; use the tokens.
- **Do** keep `data-testid`s and accessible names stable; tests rely on them.
- **Do** make the centrepiece the home screen, with lenses, Today, view-as and tools named in the metaphor; always ship
  the list view, a reduced-motion path and a no-WebGL path. **Don't** decorate: every mark in the world maps to data.
- **Do** keep chrome calm over the world: glass panels, mono legend labels, one dark pill for the active lens.
