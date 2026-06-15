import { createTheme } from '@mantine/core';

export const theme = createTheme({
  /** Custom brand palette — indigo/cobalt at hue 260° */
  colors: {
    brand: [
      'oklch(0.96 0.015 260)', // 0
      'oklch(0.90 0.03 260)',  // 1
      'oklch(0.83 0.05 260)',  // 2
      'oklch(0.75 0.08 260)',  // 3
      'oklch(0.67 0.10 260)',  // 4
      'oklch(0.58 0.13 260)',  // 5
      'oklch(0.50 0.15 260)',  // 6
      'oklch(0.42 0.161 260)', // 7 — the seed
      'oklch(0.34 0.14 260)',  // 8
      'oklch(0.26 0.11 260)',  // 9
    ],
  },

  primaryColor: 'brand',
  primaryShade: { light: 7, dark: 5 },

  /** Typography */
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji'",
  fontFamilyMonospace:
    "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",

  headings: {
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji'",
    sizes: {
      h1: { fontSize: '1.125rem', fontWeight: '600', lineHeight: '1.3' },
      h2: { fontSize: '1rem', fontWeight: '600', lineHeight: '1.3' },
      h3: { fontSize: '0.9375rem', fontWeight: '600', lineHeight: '1.3' },
    },
  },

  /** Radii — tighter than Mantine defaults for a desktop-native feel */
  defaultRadius: 'sm',

  /** Component defaults */
  components: {
    Button: {
      defaultProps: {
        radius: 'sm',
      },
      styles: {
        root: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
      },
    },

    Progress: {
      defaultProps: {
        radius: 'xs',
        size: 'sm',
      },
    },

    Input: {
      defaultProps: {
        radius: 'sm',
      },
    },

    Modal: {
      defaultProps: {
        radius: 'md',
        padding: 'lg',
      },
      styles: {
        overlay: {
          backdropFilter: 'none',
        },
      },
    },

    Tabs: {
      defaultProps: {
        radius: 'sm',
      },
    },

    Card: {
      defaultProps: {
        radius: 'sm',
        padding: 'md',
      },
      styles: {
        root: {
          boxShadow: 'none',
        },
      },
    },
  },

  /** Default spacing — slightly tighter for desktop density */
  spacing: {
    xs: '0.375rem',
    sm: '0.5rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.25rem',
  },
});
