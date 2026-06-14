---
name: Intelligent Synthesis
colors:
  surface: '#f8f9fa'
  surface-dim: '#d9dadb'
  surface-bright: '#f8f9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f5'
  surface-container: '#edeeef'
  surface-container-high: '#e7e8e9'
  surface-container-highest: '#e1e3e4'
  on-surface: '#191c1d'
  on-surface-variant: '#3d4a42'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f2'
  outline: '#6d7a72'
  outline-variant: '#bccac0'
  surface-tint: '#006c4a'
  primary: '#006948'
  on-primary: '#ffffff'
  primary-container: '#00855d'
  on-primary-container: '#f5fff7'
  inverse-primary: '#68dba9'
  secondary: '#0051d5'
  on-secondary: '#ffffff'
  secondary-container: '#316bf3'
  on-secondary-container: '#fefcff'
  tertiary: '#535d6b'
  on-tertiary: '#ffffff'
  tertiary-container: '#6b7584'
  on-tertiary-container: '#fdfcff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#85f8c4'
  primary-fixed-dim: '#68dba9'
  on-primary-fixed: '#002114'
  on-primary-fixed-variant: '#005137'
  secondary-fixed: '#dbe1ff'
  secondary-fixed-dim: '#b4c5ff'
  on-secondary-fixed: '#00174b'
  on-secondary-fixed-variant: '#003ea8'
  tertiary-fixed: '#d9e3f4'
  tertiary-fixed-dim: '#bdc7d8'
  on-tertiary-fixed: '#121c28'
  on-tertiary-fixed-variant: '#3e4755'
  background: '#f8f9fa'
  on-background: '#191c1d'
  surface-variant: '#e1e3e4'
typography:
  display-lg:
    fontFamily: Outfit
    fontSize: 57px
    fontWeight: '400'
    lineHeight: 64px
    letterSpacing: -0.25px
  headline-lg:
    fontFamily: Outfit
    fontSize: 32px
    fontWeight: '400'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Outfit
    fontSize: 28px
    fontWeight: '400'
    lineHeight: 36px
  title-lg:
    fontFamily: Outfit
    fontSize: 22px
    fontWeight: '500'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0.5px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0.25px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.1px
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.5px
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  baseline: 4px
  container-padding-x: 16px
  container-padding-y: 24px
  stack-gap: 12px
  section-gap: 32px
---

## Brand & Style

The design system is engineered for **NotebookLM Linker**, focusing on the intersection of academic rigor and AI-driven fluid intelligence. The brand personality is professional yet visionary, evoking a sense of organized discovery.

The design style is a refined interpretation of **Modern Material (MD3)**, utilizing high-clarity geometry and purposeful whitespace. It emphasizes a "layer-on-layer" approach to information architecture, where content sits on top of structural surfaces to define clear hierarchies. The aesthetic response should feel lightweight, responsive, and intellectually empowering.

## Colors

This design system utilizes a sophisticated palette centered on Emerald and Professional Blue to distinguish between AI capabilities and system integration.

- **Primary (Emerald):** Reserved for high-value AI interactions, successful processing states, and "Generate" actions.
- **Secondary (Blue):** Used for Google Drive connectivity, external link references, and navigation anchors.
- **Neutral/Surface:** A foundation of very light grey (`#f9fafb`) prevents eye fatigue, while deep grey accents (`#4b5563`) provide grounding for text and secondary icons.
- **Tonal Logic:** Follows MD3 color roles, where containers use a desaturated, lighter version of the seed color to maintain accessibility and visual softness.

## Typography

The typography strategy leverages two distinct sans-serifs to balance personality with readability.

- **Headlines (Outfit):** Chosen for its geometric clarity and modern character. It is used for large display text and section titles to provide a welcoming, high-tech feel.
- **Body & Labels (Inter):** Utilized for all functional text, chat messages, and data. Inter’s tall x-height ensures maximum legibility during long reading sessions within the app.
- **Scaling:** On mobile devices, headline sizes scale down slightly to prevent awkward line breaks while maintaining the same weight and rhythm.

## Layout & Spacing

The layout follows a **Fluid Grid** model designed for mobile-first consumption.

- **Grid:** A 4-column grid for mobile and an 8-column grid for tablet. Gutters are fixed at 16px to maintain a compact, information-dense environment.
- **Safe Zones:** Content is inset with a 16px margin on horizontal edges.
- **Vertical Rhythm:** Spacing is strictly based on a 4px increment system. Elements within a card use 8px or 12px gaps, while the cards themselves are separated by 16px to 24px increments to define distinct content blocks.

## Elevation & Depth

This design system employs **Tonal Layering** combined with **Ambient Shadows** to create a sense of physical presence without visual clutter.

- **Surfaces:** Use a 5-step elevation scale. Level 0 is the background. Level 1 (Cards) uses a white fill with a subtle 10% opacity grey shadow (4px blur).
- **Interactions:** Upon press or hover, cards increase their shadow spread to 12px blur to simulate "lifting" towards the user.
- **Overlays:** Modals and bottom sheets utilize a backdrop blur (12px) and a higher elevation shadow (Level 3) to focus the user's attention.

## Shapes

The shape language is the primary differentiator for this design system, favoring high-radius curves to appear friendly and approachable.

- **Primary Containers:** Large cards and bottom sheets use a 24px - 32px corner radius.
- **Buttons:** All primary and secondary buttons are fully pill-shaped (100px) to signify "touchability."
- **Chat Bubbles:** AI responses use a 24px radius on three corners and a 4px radius on the bottom-left to create a distinct directional tail.

## Components

### Buttons
- **Filled (AI):** Emerald background with white text. High-emphasis for "Generate" or "Sync."
- **Tonal (Links):** Light blue background with deep blue text. Used for secondary actions like "Add Source."
- **Outlined:** Used for "Cancel" or "Edit" actions to minimize visual weight.

### Chat & Messaging
- **User Bubble:** Professional Blue with white text, aligned to the right.
- **AI Bubble:** Tonal Emerald with deep grey text, aligned to the left, featuring a subtle icon watermark of the AI logo.

### Input Fields
- **Search/Chat Bar:** Large 32px rounded bar with a light grey fill and a subtle stroke. Icons are positioned at the leading and trailing edges.
- **State Indicators:** Use Material Symbols (Rounded style). Success states use Emerald; link processing uses Blue; errors use a muted Coral.

### Cards
- **Source Cards:** Feature a title-lg heading, a body-md description, and a bottom row of labels for "Date Added" or "Type." Corners are strictly 24px.