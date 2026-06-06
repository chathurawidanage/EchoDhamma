# Task 2: Design System, Theming & Global Layout

## Objective
Establish a premium, modern design system with a dark-first color scheme, glassmorphism elements, smooth micro-animations, and a responsive global layout.

## Scope & Requirements
- **Design Aesthetic**: Premium, clean, and spiritually calming interface. Harmonious colors, dark modes, soft gradients, and subtle borders.
- **Typography**: Inter (for English) and Noto Sans Sinhala (for Sinhala content) set up globally.
- **Responsive Layout**: Sidebar navigation for desktop and bottom navigation or collapsible header for mobile/tablet devices.
- **Accessibility**: High color contrast, visible focus states, and logical heading hierarchy.

## Proposed Steps

### 1. Define Design Tokens in globals.css
Create comprehensive CSS custom properties in [globals.css](file:///Users/chathura/code/EchoDhamma/web/src/styles/globals.css):
- **Colors**: Calming dark backgrounds (e.g., deep charcoal `#121214` and slate `#1a1a1e`), warm accent colors representing Dhamma (soft gold/amber HSL, e.g., `hsl(38, 92%, 50%)`), and clean, high-contrast text tones.
- **Gradients**: Subtle background overlays and gold-to-orange gradient borders/text.
- **Glassmorphism**: Backdrop filters (`backdrop-filter: blur(12px)`) with semi-transparent borders for cards, sidebars, and sticky player.
- **Animations**: Timings and cubic-bezier curves for hover effects, scale transformations, and page transition fades.

### 2. Implement Responsive Shell Layout
Create a Shell/Layout component that wraps all pages:
- **Sidebar (Desktop)**: Fixed navigation on the left including Theros list, Ebook section link, and settings.
- **Header (Mobile)**: Floating glass navbar with hamburger menu.
- **Main Content Area**: Scrollable area with proper padding and maximum readable line-width for content/transcripts.
- **Universal Audio Player container**: Pinned to the bottom of the viewport (designed in Task 5).

### 3. Create Shared Premium UI Elements
Build basic interactive elements inside `src/components/`:
- **Card**: Glassmorphic container with lift hover animation.
- **Button**: Hover states with gradient transitions and subtle scale clicks.
- **Badge**: Tiny labels for categories (e.g., "Ven. Thero", "Ebook", "YouTube", "Chapters").

## Files to Create / Modify
- [NEW] [task-2-design-system-and-layout.md](file:///Users/chathura/code/EchoDhamma/web/task-2-design-system-and-layout.md) (This file)
- [MODIFY] [src/styles/globals.css](file:///Users/chathura/code/EchoDhamma/web/src/styles/globals.css) - Global CSS variable definitions.
- [NEW] [src/components/Navigation.tsx](file:///Users/chathura/code/EchoDhamma/web/src/components/Navigation.tsx) - Main Navigation Sidebar/Header.
- [NEW] [src/components/Navigation.module.css](file:///Users/chathura/code/EchoDhamma/web/src/components/Navigation.module.css) - Navigation styles.
- [NEW] [src/components/UI.tsx](file:///Users/chathura/code/EchoDhamma/web/src/components/UI.tsx) - Shared styled primitives (Button, Card, Badge).
- [NEW] [src/components/UI.module.css](file:///Users/chathura/code/EchoDhamma/web/src/components/UI.module.css) - Primitives styling.

## Verification Plan
1. **Visual Testing**: Open the app and inspect the visual rendering of the sidebar and content layout across desktop, tablet, and mobile breakpoints.
2. **Theme Contrast**: Audit color contrast on major elements to ensure readability of Sinhala text.
3. **Animations**: Hover over buttons and navigate pages to verify smooth transitions and interactive micro-animations.
