---
version: alpha
name: TempMail
description: Clean, modern disposable email UI. Indigo-violet accent on deep neutral surfaces. Minimal chrome, generous whitespace, subtle glass effects.
colors:
  primary: "#6366f1"
  primary-hover: "#818cf8"
  primary-muted: "#1a1a3e"
  secondary: "#a78bfa"
  surface-0: "#09090b"
  surface-1: "#111114"
  surface-2: "#18181b"
  surface-3: "#27272a"
  border: "#2e2e33"
  border-hover: "#3f3f46"
  text-primary: "#fafafa"
  text-secondary: "#a1a1aa"
  text-tertiary: "#52525b"
  success: "#22c55e"
  danger: "#ef4444"
  warning: "#eab308"
  light-surface-0: "#fafafa"
  light-surface-1: "#ffffff"
  light-surface-2: "#f4f4f5"
  light-surface-3: "#e4e4e7"
  light-border: "#d4d4d8"
  light-border-hover: "#a1a1aa"
  light-text-primary: "#09090b"
  light-text-secondary: "#52525b"
  light-text-tertiary: "#a1a1aa"
  light-primary-muted: "#eef2ff"
typography:
  h1:
    fontFamily: Inter
    fontSize: 1.75rem
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  h2:
    fontFamily: Inter
    fontSize: 1.25rem
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  h3:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: Inter
    fontSize: 0.8125rem
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: 400
    lineHeight: 1.4
  mono:
    fontFamily: "JetBrains Mono, SF Mono, Fira Code, monospace"
    fontSize: 0.8125rem
    fontWeight: 500
    lineHeight: 1.4
rounded:
  sm: 8px
  md: 12px
  lg: 16px
  xl: 20px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  "2xl": 48px
components:
  card:
    backgroundColor: "{colors.surface-2}"
    rounded: "{rounded.lg}"
    padding: 24px
  card-hover:
    backgroundColor: "{colors.surface-3}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: 12px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.sm}"
    padding: 8px
  button-ghost-hover:
    textColor: "{colors.text-primary}"
    backgroundColor: "{colors.primary-muted}"
  input:
    backgroundColor: "{colors.surface-3}"
    rounded: "{rounded.sm}"
    padding: 10px 14px
  input-focus:
    backgroundColor: "{colors.surface-3}"
  badge:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.full}"
    padding: 4px 10px
---

## Overview

TempMail uses **indigo-violet** as the sole accent — a single hue for all interactive elements. Dark mode is the default; light mode inverts surfaces while keeping the accent. The aesthetic is **restrained**: no heavy gradients, no skeuomorphism, just clean surfaces with subtle depth and a single accent for focus states.

## Colors

- **Primary (#6366f1):** Indigo — buttons, links, unread indicators, active states.
- **Secondary (#a78bfa):** Violet — logo gradient, avatar fills. Never used for text or buttons directly.
- **Surface hierarchy:** Four levels from `surface-0` (page bg) → `surface-3` (elevated cards). Each level steps up in lightness.
- **Light mode:** Separate token set (`light-*`) to avoid opacity hacks — direct hex values for each surface.

## Typography

Inter for all UI text. Single font family, no decorative fonts. Weight 400 for body, 500 for emphasis, 600-700 for headings. JetBrains Mono for email addresses (monospace alignment).

## Layout

Single-column, 640px max-width, centered. Mobile-first with 20px horizontal padding. Cards stack vertically with 16-24px gaps. No sidebars, no multi-column grids — email is a linear flow.

## Components

- **card:** Rounded 16px, surface-2 background, 1px border. Hover lifts to surface-3.
- **button-primary:** Solid indigo, white text, 12px radius. Hover brightens to primary-hover.
- **button-ghost:** Transparent, text-secondary. Hover shows primary-muted background.
- **input:** surface-3 fill, 1px border. Focus: indigo border + 3px glow.
- **badge:** Pill-shaped, surface-3 fill, used for email count.

## Do's and Don'ts

- **Do** use accent color sparingly — only for interactive elements (buttons, links, focus states).
- **Do** maintain surface hierarchy — never put surface-1 inside surface-3.
- **Don't** use colored borders except on focused inputs or unread indicators.
- **Don't** add drop shadows heavier than `0 4px 24px` — keep depth subtle.
