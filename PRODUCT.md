# Product

## Register

product

## Users

TorBox users managing their cloud torrents and web downloads across devices. On desktop, they're power users — adding magnet links, checking progress, browsing files, grabbing download links. On mobile, they're checking in — confirming a download finished, adding a quick magnet link from clipboard, grabbing a file link to open elsewhere. The primary task on any screen is scanning download status and acting on it.

## Product Purpose

A native cross-platform client for the TorBox cloud torrent/debrid service — desktop (macOS, Windows, Linux) and mobile (Android, iOS). It wraps TorBox's API into a fast, focused interface that feels native to each platform. Users shouldn't need to open a browser tab to manage their downloads.

## Brand Personality

Clean, restrained, functional. Three words: **quiet, precise, effortless.**

The app should feel like a well-made tool — not a website, not a "platform." It does one category of things well and stays out of the way. Motrix is the north star: minimal chrome, clear information hierarchy, dark-forward, no decoration that doesn't serve the task.

## Anti-references

- **BitTorrent / uTorrent / qBittorrent** — dense data grids, tiny controls, "expert" clutter, 2000s-era toolbars. The opposite of clean.
- **Over-branded SaaS dashboards** — gradient accents, hero-metric cards, "Welcome back, [user]" cruft. This is a tool, not a dashboard.
- **"Gamer" aesthetics** — neon accents, dark-mode-as-edgy, aggressive typography.
- **Web-app-ported-to-desktop** — excessive padding, browser chrome, scroll-driven layouts that feel like a website squeezed into a window.

## Design Principles

1. **Every element earns its place.** If removing it doesn't make the task harder, remove it. The default state should feel spacious, not sparse.

2. **Task-first, not data-first.** The UI exposes actions at the point of need. Adding a magnet link is one step. Getting a download link is one click. Progress is glanceable.

3. **Respect the platform.** On desktop: compact controls, keyboard shortcuts, right-click context menus, drag-and-drop for torrent files. On mobile: 44px minimum tap targets, swipe actions on download rows, bottom sheets over modals, haptic feedback for confirmations. Same codebase, platform-native feel.

4. **Quiet confidence.** The UI doesn't announce itself. It uses restraint in color, motion, and typography to let the content — download names, speeds, file lists — do the work.

5. **Dark-forward, light-capable.** The primary experience is dark. Light mode is a deliberate, well-tested alternative, not an afterthought.

## Accessibility & Inclusion

WCAG 2.2 AA minimum. All interactive elements must be keyboard-accessible. Reduced motion via `prefers-reduced-motion: reduce`. Color is never the sole channel for status — progress bars, icons, and text labels reinforce each other.
