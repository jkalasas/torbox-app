# Design

## Theme

Dark-forward cross-platform app (desktop + mobile). The primary experience is dark mode — a dim, focused workspace where the download list is the center of attention. Light mode is a deliberate, well-tested alternative, not an afterthought.

Dark mode is the default. Mantine's `auto` scheme detection follows the OS preference; fresh installs on dark-mode systems get dark immediately.

## Color

All colors use OKLCH. The palette is restrained: one indigo primary accent, neutral grays, and semantic status colors. No gradient backgrounds, no decorative tints.

### Dark mode (primary experience)

| Role | Value | Usage |
|---|---|---|
| `--bg` | `oklch(0.08 0 0)` | Window background |
| `--surface` | `oklch(0.12 0 0)` | Panels, sidebars, card rows |
| `--surface-elevated` | `oklch(0.16 0 0)` | Modals, dropdowns, hover states |
| `--border` | `oklch(0.20 0 0)` | Subtle separators, input borders |
| `--border-strong` | `oklch(0.28 0 0)` | Focus rings, active borders |
| `--ink` | `oklch(0.92 0 0)` | Body text, headings |
| `--ink-muted` | `oklch(0.55 0 0)` | Secondary text, captions, placeholders |
| `--primary` | `oklch(0.52 0.17 260)` | Primary buttons, selected states, progress fill |
| `--primary-hover` | `oklch(0.56 0.17 260)` | Hover/pressed primary |
| `--primary-text` | `oklch(0.98 0 0)` | Text on primary fills |
| `--accent` | `oklch(0.55 0.14 195)` | Links, active indicators, status pills |
| `--success` | `oklch(0.50 0.14 155)` | Downloaded/complete states |
| `--warning` | `oklch(0.55 0.14 80)` | Queued/processing states |
| `--danger` | `oklch(0.50 0.18 25)` | Errors, delete actions |

### Light mode

| Role | Value | Usage |
|---|---|---|
| `--bg` | `oklch(1.0 0 0)` | Window background (pure white) |
| `--surface` | `oklch(0.97 0 0)` | Panels, sidebars, card rows |
| `--surface-elevated` | `oklch(1.0 0 0)` | Modals, dropdowns (with border) |
| `--border` | `oklch(0.88 0 0)` | Subtle separators, input borders |
| `--border-strong` | `oklch(0.75 0 0)` | Focus rings, active borders |
| `--ink` | `oklch(0.15 0 0)` | Body text, headings |
| `--ink-muted` | `oklch(0.50 0 0)` | Secondary text, captions, placeholders |
| `--primary` | `oklch(0.42 0.161 260)` | Primary buttons, selected states, progress fill |
| `--primary-hover` | `oklch(0.38 0.165 260)` | Hover/pressed primary |
| `--primary-text` | `oklch(0.98 0 0)` | Text on primary fills |
| `--accent` | `oklch(0.48 0.14 195)` | Links, active indicators, status pills |
| `--success` | `oklch(0.45 0.14 155)` | Downloaded/complete states |
| `--warning` | `oklch(0.50 0.14 80)` | Queued/processing states |
| `--danger` | `oklch(0.45 0.18 25)` | Errors, delete actions |

### Contrast

- Body text (`--ink`) vs background (`--bg`): ≥7:1 in both modes (WCAG AAA for body text).
- Secondary text (`--ink-muted`) vs background: ≥4.5:1 in both modes.
- White text on primary fills: ≥4.5:1 in both modes.
- Placeholder text: same contrast as secondary text. Never the browser default muted-gray.

## Typography

System font stack. No web fonts — the app runs in a desktop window and should feel native.

```
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans',
             Helvetica, Arial, sans-serif, 'Apple Color Emoji',
             'Segoe UI Emoji';
```

Monospace for technical values (hashes, file sizes, speeds) uses the system monospace stack:

```
font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas,
             'Liberation Mono', monospace;
```

### Scale

| Step | Size | Weight | Usage |
|---|---|---|---|
| Heading | 1.125rem (18px) | 600 | Page/section titles |
| Body | 0.875rem (14px) | 400 | Primary content, download names |
| Body-sm | 0.8125rem (13px) | 400 | Secondary info, metadata |
| Caption | 0.75rem (12px) | 400 | Speed, ETA, file counts |
| Code | 0.8125rem (13px) | 400 | Hashes, magnet links (mono) |

### Rules

- No all-caps body copy. Uppercase reserved for short button labels (≤3 words) and status badges.
- `text-wrap: balance` on headings, `text-wrap: pretty` on long prose (file names, paths).
- Line height: 1.5 for body, 1.3 for headings, 1.4 for mono.
- Download names truncate with ellipsis at the column boundary — never overflow.
- All interactive elements must have a minimum tap target of 44×44px (WCAG 2.5.5). On mobile, download rows are ≥48px tall with action areas ≥44px.

## Layout

### Responsive breakpoints

| Breakpoint | Width | Target |
|---|---|---|
| Mobile | < 600px | Android, iOS phones |
| Tablet | 600–900px | iPad, Android tablets |
| Desktop | > 900px | macOS, Windows, Linux (default 1000×700 window) |

Same React component tree adapts via CSS media/container queries and Mantine's responsive props. No separate mobile code path — layout changes, not component duplication.

### Desktop (≥900px)

Motrix-style dual sidebar shell. Window defaults to 1000×700 (per `tauri.conf.json`), resizable, minimum 720×480.

**Title bar (platform hybrid)**
- macOS: overlay title bar + native traffic lights over the icon rail (`titleBarStyle: Overlay`)
- Windows/Linux: decorations off + custom min/max/close controls styled to app tokens
- Drag regions on the icon-rail logo area and content header title

```
┌────┬──────────────┬─────────────────────────────────────┐
│ TB │ Status       │  Active · Torrents            [↻]   │
│ ☁  │  ▶ Active    │  ┌───────────────────────────────┐  │
│ 💾 │  ⏸ Inactive  │  │ name            [actions pill]│  │
│ ＋ │  ■ Error     │  │ ████████░░░░░░░░              │  │
│ ⚙  │  · All       │  │ 1.0/2.6 GB   ↓12.5 MB/s  2m  │  │
│    │ Type         │  └───────────────────────────────┘  │
│    │  Torrents    │                       [speed badge] │
│    │  Web DLs     │                                     │
└────┴──────────────┴─────────────────────────────────────┘
```

- Icon rail (~52px, near-black): Cloud / Local / Add / Settings
- Secondary sidebar (~180px, `--surface`): status filters + cloud type filters
- Content: section title, search, bordered list rows, floating speed badge

### Tablet (600–899px)

Keep the icon rail. Collapse the secondary sidebar into horizontal chip filters under the content header.

### Mobile (< 600px)

Full-width single column. No sidebars. Bottom action for primary task (Add).

```
┌──────────────────┐
│ Active     [↻][⚙]│  Content header
│ Cloud │ Local    │  Mode chips
│ Torrents│Web     │  Type chips (cloud)
│ All Active …     │  Status chips
├──────────────────┤
│ name             │
│ ████░░░░         │  Download row
│ 2.4 GB · 4 MB/s  │  (≥48px tap height)
├──────────────────┤
│                  │  Scrollable area
├──────────────────┤
│     [ ＋ Add ]   │  Bottom bar (50px)
└──────────────────┘
```

### Rules (all platforms)

- Flexbox for 1D layouts (rail, side nav, download rows). Grid only if needed later.
- Download items are **gapped, bordered list rows** (Motrix-style), not a card grid and not flush table separators.
- Semantic z-index scale: dropdown (100) → sticky header (200) → modal backdrop (300) → modal/bottom-sheet (400) → toast (500).
- Never `z-index: 999` or `z-index: 9999`.

## Components

Built on Mantine 9. Customize via `createTheme`, not by fighting the library.

### Download row

Motrix-style bordered list item (not a card grid):

**Desktop / tablet**:
- **Name** (truncated, `--ink`) + **action pill** (pause/resume, retry, download-to-device, files, remove) — pill muted until row hover/focus
- **Full-width progress bar** (4px, `--primary` / success / danger fill)
- **Metadata**: size progress left · speed / ETA / peers right (`--ink-muted`, caption)

**Mobile**:
- Row height: ≥48px (touch-friendly)
- Progress bar: 6px height
- Meta stacks vertically
- Actions always visible (no hover)
- Tap completed row to open file list

Rows use `--surface` fill, 1px `--border`, `--radius-md`, with gap between items. Desktop hover lifts to `--surface-elevated`. No box-shadow.

### Shell navigation

- **Icon rail**: primary mode (Cloud / Local) + Add + Settings
- **Side nav** (desktop): status filters (Active / Inactive / Error / All) and type (Torrents / Web)
- **Mobile / tablet chips**: same filters as horizontal pill chips
- **Content header**: current filter title + search + refresh
- **Speed badge** (desktop/tablet): floating aggregate download speed

### Actions

**Desktop**: Add and Settings live in the icon rail; refresh + name filter live in the content header. Drag-and-drop `.torrent` files onto the window to add them.

**Mobile**:
- **Add button** in a fixed bottom bar (full-width, 44px min height)
- **Settings** + **Refresh** in the content header
- **Quick magnet**: tap Add → modal/sheet with paste detection

### Modals / Bottom sheets

**Desktop**: Centered modal, 480px max-width, `--surface-elevated` background with 1px `--border`. Backdrop: `oklch(0 0 0 / 0.5)` in dark mode, `oklch(0 0 0 / 0.3)` in light.

**Mobile**: Bottom sheet (slides up from bottom, 90vh max, rounded top corners at 12px). Sheet has a drag handle at top. Dismisses on backdrop tap or swipe down. Same content as desktop modal, adapted layout. Backdrop: `oklch(0 0 0 / 0.5)`.

Used for: add magnet/torrent, confirm delete, file list for a download, settings.

### Empty state

When no downloads exist, show a centered prompt with:
- Subtle illustration or icon (not an SVG illustration — use a Mantine icon or simple geometric shape)
- "No downloads yet" heading
- "Add a magnet link or torrent file to get started" description
- Primary "Add download" button

### Error state

API errors show as an inline banner at the top of the list, not a toast. Red `--danger` left border (1px, not a side-stripe). Icon + message + dismiss button.

### Loading state

Skeleton rows while fetching. Match the exact height of download rows. No spinner in the center of an empty container.

## Motion

Minimal, functional motion. No entrance animations, no stagger reveals, no page transitions.

- **Hover states** (desktop): 150ms `ease-out` background-color transition on rows and buttons.
- **Tap feedback** (mobile): 100ms `--primary` ripple on download rows and buttons. Use Mantine's built-in ripple or a CSS `:active` scale (0.98).
- **Progress bars**: 300ms `ease-out` width transition when progress updates.
- **Modals** (desktop): 200ms `ease-out` fade + subtle scale (0.97 → 1).
- **Bottom sheets** (mobile): 250ms `ease-out` slide-up, 200ms `ease-in` slide-down on dismiss.
- **Swipe actions**: spring physics (200ms, stiffness 300, damping 25). Use a lightweight spring or CSS transition.
- **Pull-to-refresh**: native-feel spinner at list top.
- **Tab switches**: instant content swap. No crossfade, no slide.

### Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Framework mapping (Mantine 9)

Mantine's `createTheme` accepts a subset of these tokens. The full palette is implemented as CSS custom properties on `:root` and `[data-mantine-color-scheme="dark"]`. Mantine's built-in color system (blue, red, green, etc.) is overridden with these values.

Key Mantine overrides:
- `primaryColor`: mapped to the indigo primary
- `defaultRadius`: `sm` (4px) — tighter than Mantine's default, matching the desktop-native feel
- `fontFamily`: system font stack (already Mantine's default)
- `headings`: set sizes and weights per the typography scale above
- `components`: download rows, toolbar, and tabs use Mantine primitives (Group, Stack, Tabs) with custom styling

## Iconography

Use Mantine's built-in icon support (Tabler Icons via `@tabler/icons-react` or the Mantine icon components). No custom icon set. Icons are 16px in rows, 18px in toolbar, 20px in empty states. Stroke width 1.5–2.
