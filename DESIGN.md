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
| Desktop | > 900px | macOS, Windows, Linux (default 800×600 window) |

Same React component tree adapts via CSS media/container queries and Mantine's responsive props. No separate mobile code path — layout changes, not component duplication.

### Desktop (≥900px)

The window is 800×600 by default (per `tauri.conf.json`). Resizable, minimum 640×400.

```
┌─────────────────────────────────────────┐
│  [TorBox]                    [⚙] [— □ ×] │  Title bar (OS-native or custom)
├─────────────────────────────────────────┤
│  [+ Add]  [Magnet] [↻]               │  Toolbar (compact, icon+label)
├─────────────────────────────────────────┤
│  ┌─ Torrents (3) ─┐  ┌─ Web DLs (2) ─┐ │  Tab bar
├─────────────────────────────────────────┤
│  ┌──────────────────────────────────┐   │
│  │  ubuntu-24.04.iso         ████░░ │   │  Download list
│  │  2.4 GB · 4.2 MB/s · 3m left│   │   │  (rows with progress)
│  ├──────────────────────────────────┤   │
│  │  debian-12.5.iso          ██████ │   │
│  │  3.8 GB · Complete · 2 files │   │   │
│  └──────────────────────────────────┘   │
├─────────────────────────────────────────┤
│  2 torrents · 1 active · 0 errors       │  Status bar
└─────────────────────────────────────────┘
```

### Mobile (< 600px)

Full-width single column. Bottom action for primary task (Add). Swipe on rows for secondary actions.

```
┌──────────────────┐
│  TorBox    [⚙]   │  Header (44px, compact)
├──────────────────┤
│ Torrents │ Web DL│  Segmented tabs
├──────────────────┤
│ ● ubuntu-24.04   │
│   ████░░░░  45%  │  Download row
│   2.4 GB · 4 MB/s│  (≥48px tap height)
├──────────────────┤
│ ● debian-12.5    │
│   ████████ 100%  │
│   3.8 GB · Done  │
├──────────────────┤
│                  │
│                  │  Scrollable area
├──────────────────┤
│ Downloads  [ ＋ ] │  Bottom bar (50px)
└──────────────────┘
```

### Rules (all platforms)

- Flexbox for 1D layouts (toolbar, status bar, download rows). Grid for 2D (if needed later).
- No nested cards. Download items are rows, not cards.
- Semantic z-index scale: dropdown (100) → sticky header (200) → modal backdrop (300) → modal/bottom-sheet (400) → toast (500).
- Never `z-index: 999` or `z-index: 9999`.

## Components

Built on Mantine 9. Customize via `createTheme`, not by fighting the library.

### Download row

**Desktop**: A compact horizontal row showing:
- **Status indicator** (colored dot: downloading=accent, complete=success, queued=warning, error=danger)
- **Name** (truncated, primary text color, `--ink`)
- **Progress bar** (thin, 4px height, `--primary` fill on `--surface` track)
- **Metadata** (size, speed, ETA in `--ink-muted` at caption size)
- **Actions** (icon-only buttons on hover: pause, delete, get link)

**Mobile**: Same data, taller row:
- Row height: ≥48px (touch-friendly)
- Progress bar: 6px height (easier to read at a glance)
- Metadata stacks below name (name + progress on first line, stats on second)
- Actions: swipe left to reveal delete + get-link buttons (native-feel gesture). Tap row to expand inline file list.
- Long-press to select multiple rows for bulk actions.

Rows are `--surface` background with a 1px `--border` bottom separator. Desktop hover lifts to `--surface-elevated`. Mobile has a `--primary` ripple on tap. No box-shadow.

### Toolbar / Actions

**Desktop**: Compact horizontal toolbar at the top:
- **Add button** (primary filled, opens a modal for magnet link or file upload)
- **Quick magnet input** (text field with paste support, detects magnet URIs)
- **Refresh button** (icon-only)
- **Settings** (gear icon, opens app settings)
- Drag-and-drop `.torrent` files onto the window to add them.

**Mobile**: Bottom action bar or FAB:
- **Add button** (primary filled, 56px FAB in bottom-right, or centered button in a 50px bottom bar)
- **Quick magnet**: tap Add → bottom sheet with paste-from-clipboard detection. Auto-detects magnet URIs.
- **Refresh**: pull-to-refresh gesture on the download list.
- **Settings**: gear icon in the header.

### Tabs

Torrents / Web Downloads as tab-style segments. Active tab has a 2px `--primary` bottom border. Inactive tabs are `--ink-muted`. No pill backgrounds.

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
