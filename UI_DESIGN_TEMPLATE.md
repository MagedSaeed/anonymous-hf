# UI Design Template

> Reusable design system blueprint extracted from CoReview. Replace `{APP_NAME}` and customize sections marked with `<!-- CUSTOMIZE -->` for your project.

## Design Philosophy

This design system follows a **clean, content-first** approach suited for professional/academic tools. The visual language borrows from modern SaaS dashboards — minimal ornamentation, generous whitespace, and a neutral color palette with strategic use of color for semantic meaning only.

### Core Principles

1. **Content-first**: Application data is the focal point. UI chrome is subdued. No decorative gradients, illustrations, or visual noise competing with content.
2. **Progressive disclosure**: Complex information is hidden behind collapsible sections, toggles, and modals. Show the minimum needed, let users drill in.
3. **Immediate feedback**: Every user action gets visual acknowledgment — spinners for API calls, save indicators for forms, color transitions for state changes.
4. **Responsive by default**: Every component adapts from mobile (360px) to desktop (1280px+). Mobile is not an afterthought.
5. **Semantic color**: Color carries meaning (success/error/warning/info), not brand identity. The base palette is neutral gray.

## Technology Choices

| Tool | Why |
|------|-----|
| **Tailwind CSS 3.4** | Utility-first eliminates context-switching between files. Co-location of style with markup. No class naming debates. |
| **Inter (Google Fonts)** | Clean, professional sans-serif with excellent readability at small sizes. Widely used in developer/academic tools. |
| **Inline SVG icons (Heroicons style)** | No icon font overhead. Tree-shakeable. Customizable size/color via Tailwind classes. |
| **ReactMarkdown** | For apps rendering user-generated or AI-generated content. Custom component overrides ensure consistent styling. |
| **No component library** | No Material UI, Chakra, Ant Design. Full control over design, smaller bundle, no fighting library defaults. Trade-off: more manual work, but every pixel is intentional. |
| **No CSS-in-JS** | Tailwind utilities inline + a small `@layer components` extract covers everything. No runtime style injection overhead. |

## Setup

### 1. Tailwind Configuration

```javascript
// tailwind.config.js
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        // <!-- CUSTOMIZE: Replace with your brand accent if needed -->
        // Keep these subtle — primary actions use gray-900, not these
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          500: '#0ea5e9',   // Focus rings, active states
          600: '#0284c7',
          700: '#0369a1',
          900: '#0c4a6e',
        },
        accent: {
          50: '#fefce8',
          100: '#fef9c3',
          500: '#eab308',   // Warnings, highlights
          600: '#ca8a04',
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      }
    },
  },
  plugins: [],
}
```

### 2. Global CSS

```css
/* index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

@layer base {
  html {
    font-family: 'Inter', system-ui, sans-serif;
  }
  body {
    @apply bg-gray-50 text-gray-900;
  }
}

@layer components {
  .btn-primary {
    @apply inline-flex items-center justify-center px-4 py-2 border border-transparent
           text-sm font-medium rounded-lg text-white bg-primary-600
           hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2
           focus:ring-primary-500 transition-colors duration-200;
  }
  .btn-secondary {
    @apply inline-flex items-center justify-center px-4 py-2 border border-gray-300
           text-sm font-medium rounded-lg text-gray-700 bg-white
           hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2
           focus:ring-primary-500 transition-colors duration-200;
  }
  .card {
    @apply bg-white rounded-xl shadow-sm border border-gray-200 p-6;
  }
  .input-field {
    @apply w-full px-3 py-2 border border-gray-300 rounded-lg
           focus:outline-none focus:ring-2 focus:ring-primary-500
           focus:border-transparent transition-colors duration-200;
  }
  .form-label {
    @apply block text-sm font-medium text-gray-700 mb-1;
  }
}
```

### 3. HTML Head

```html
<meta name="theme-color" content="#374151" />
<!-- gray-700: subtle, professional theme color for mobile browsers -->
```

## Color System

### Base Palette: Neutral Gray

The brand identity uses gray — not a saturated brand color. This keeps the UI professional and lets semantic colors stand out.

| Token | Hex | Role |
|-------|-----|------|
| `gray-900` | `#111827` | **Primary action color**. Buttons, major headings. |
| `gray-800` | `#1f2937` | Button hover states |
| `gray-700` | `#374151` | Navbar background, theme-color |
| `gray-600` | `#4b5563` | Secondary text |
| `gray-500` | `#6b7280` | Placeholder text, helper text |
| `gray-300` | `#d1d5db` | Borders, input outlines |
| `gray-200` | `#e5e7eb` | Card borders, dividers |
| `gray-100` | `#f3f4f6` | Hover backgrounds |
| `gray-50` | `#f9fafb` | Page background |
| `white` | `#ffffff` | Card/input backgrounds |

**Important**: Primary actions (main CTA buttons) use `bg-gray-900`, not the custom `primary` color. The `primary` tokens are reserved for focus rings and subtle highlights.

### Semantic Colors

Never use color purely for decoration. Every color communicates state:

| State | Background | Text | Border | When to use |
|-------|-----------|------|--------|-------------|
| **Success** | `green-50` or `green-100` | `green-600` to `green-800` | `green-200` or `green-300` | Completed actions, valid fields, save confirmations |
| **Error** | `red-50` or `red-100` | `red-600` to `red-800` | `red-200` or `red-300` | Failed actions, validation errors, destructive states |
| **Warning** | `yellow-50` or `amber-50` | `yellow-600` to `amber-700` | `yellow-200` or `amber-200` | Pending states, stale data, caution notices |
| **Info** | `blue-50` or `blue-100` | `blue-600` to `blue-800` | `blue-200` or `blue-400` | Links, active selections, informational banners |
| **Special** | `purple-100` | `purple-600` to `purple-700` | — | AI/ML features, premium features |

### Semantic Color Pattern

Always combine background + text + (optional) border from the same hue:
```
bg-green-50 text-green-700 border border-green-200    ✓ Correct
bg-green-50 text-red-700                               ✗ Never mix hues
```

## Typography

### Type Scale

| Class | Size | Use for |
|-------|------|---------|
| `text-xs` | 12px | Metadata, badges, character counts, helper text |
| `text-sm` | 14px | Body text, form labels, card content |
| `text-base` | 16px | Main paragraphs, descriptions |
| `text-lg` | 18px | Card titles, sub-headings |
| `text-xl` | 20px | Page headings |
| `text-2xl` | 24px | Section titles |
| `text-3xl` | 30px | Hero subtext |
| `text-4xl` | 36px | Landing page headline |

### Responsive Text

Always scale text for mobile:
```
text-xl sm:text-2xl       ← headings
text-sm sm:text-base      ← body text
text-2xl sm:text-3xl      ← hero text
```

### Font Weights

- `font-medium` (500): Button text, standard emphasis
- `font-semibold` (600): Section headings, form labels, badges
- `font-bold` (700): Major headings, hero text

### Line Heights

- `leading-relaxed`: Long-form text (descriptions, reviews, articles)
- `leading-tight`: Headlines and compact headings
- `leading-snug`: Dense metadata sections

## Layout

### Page Shell

```jsx
<div className="min-h-screen bg-gray-50">
  <Navbar />
  <main className="container mx-auto px-4 py-8">
    {/* Page content with its own max-w-* */}
  </main>
</div>
```

### Container Width Guide

| Width | Class | Use for |
|-------|-------|---------|
| Narrow | `max-w-md` (448px) | Login/signup, simple modals |
| Medium | `max-w-2xl` (672px) | Standard modals, settings |
| Standard | `max-w-3xl` (768px) | Forms, content pages |
| Wide | `max-w-4xl` (896px) | Main content, detail pages |
| Full | `max-w-6xl` (1152px) | Dashboards, lists |

### Spacing Rules

**Card padding** (responsive):
```
p-4 sm:p-6 md:p-8
```

**Input padding**: `px-4 py-3` for comfortable touch targets.

**Section spacing**: Use `space-y-*` for vertical rhythm within cards:
- `space-y-4`: Tight (form fields)
- `space-y-6`: Standard (card sections)
- `space-y-8`: Loose (page sections)
- `space-y-12`: Very loose (major page divisions)

**Flex/grid gaps**: `gap-2` (tight), `gap-3` (standard), `gap-4` (loose).

## Component Catalog

### Buttons

**Primary** (dark, high contrast — main CTA):
```html
<button className="bg-gray-900 text-white px-6 py-3 rounded-xl font-medium
  hover:bg-gray-800 transition-all duration-200 shadow-sm hover:shadow-md">
  Action
</button>
```

**Secondary** (outlined — secondary action):
```html
<button className="bg-white text-gray-700 border border-gray-300 px-6 py-3
  rounded-xl font-medium hover:bg-gray-50 hover:border-gray-400
  transition-all duration-200 shadow-sm hover:shadow-md">
  Cancel
</button>
```

**Destructive** (red — delete/remove):
```html
<button className="bg-red-600 text-white px-4 py-2 rounded-xl font-medium
  hover:bg-red-700 transition-all duration-200">
  Delete
</button>
```

**Text/Link** (inline action):
```html
<button className="text-blue-600 hover:text-blue-800 underline
  decoration-dotted hover:decoration-solid transition-colors">
  View details
</button>
```

**Disabled state** (apply to any button):
```
opacity-50 cursor-not-allowed
```

### Cards

Three tiers of visual weight:

**Standard card** (page sections, forms):
```html
<div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-6 sm:p-8">
```

**Compact card** (list items):
```html
<div className="bg-white border border-gray-200 rounded-lg p-4
  hover:border-gray-300 hover:shadow-sm transition-all duration-200">
```

**Interactive card** (selectable items):
```html
<div className="group bg-white border border-gray-200 rounded-lg p-4
  hover:border-gray-300 hover:shadow-sm cursor-pointer select-none
  transition-all duration-200">
```

### Border Radius Scale

| Class | Pixels | Use for |
|-------|--------|---------|
| `rounded` | 4px | Small tags, inline elements |
| `rounded-lg` | 8px | Compact cards, inputs, small buttons |
| `rounded-xl` | 12px | Standard buttons, inputs |
| `rounded-2xl` | 16px | Modals, medium cards |
| `rounded-3xl` | 24px | Hero cards, major page sections |
| `rounded-full` | 50% | Avatars, pills, status dots |

### Shadow Scale

| Class | Use for |
|-------|---------|
| `shadow-sm` | Cards at rest |
| `shadow-md` | Hover state for interactive cards |
| `shadow-lg` | Modals |
| `shadow-xl` | Overlays, dropdowns |
| `shadow-2xl` | Full-screen modals |

Interactive pattern: `shadow-sm` at rest → `hover:shadow-md` on hover.

### Modals

```jsx
{/* Overlay */}
<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center
  justify-center z-50 p-2 sm:p-4">
  {/* Container */}
  <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden">
    {/* Header */}
    <div className="flex items-center justify-between p-6 border-b border-gray-200">
      <h2 className="text-lg font-semibold text-gray-900">Title</h2>
      <button className="text-gray-400 hover:text-gray-600">
        {/* Close icon */}
      </button>
    </div>
    {/* Body */}
    <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
      {/* Content */}
    </div>
    {/* Footer */}
    <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
      {/* Actions */}
    </div>
  </div>
</div>
```

### Forms

**Input field**:
```html
<label className="block text-sm font-semibold text-gray-900 mb-3">
  Label
</label>
<input className="w-full px-4 py-3 border border-gray-300 rounded-xl
  focus:ring-2 focus:ring-gray-900 focus:border-transparent
  outline-none transition-all duration-200 bg-white text-gray-900" />
<p className="text-xs text-gray-500 mt-2">Helper text</p>
```

**Textarea**:
```html
<textarea className="w-full px-4 py-3 border border-gray-300 rounded-lg
  focus:outline-none focus:ring-2 focus:ring-blue-500
  bg-gray-50 focus:bg-white transition-all duration-200
  resize-y min-h-[80px]" />
```

**Dynamic border colors** (for stateful inputs):
- Focused: `border-blue-500 ring-2 ring-blue-200`
- Valid: `border-green-300`
- Invalid: `border-red-300`
- Default: `border-gray-300`

### Badges & Tags

**Status badge**:
```html
<span className="inline-flex items-center px-2 py-1 rounded-full
  text-xs font-semibold bg-green-100 text-green-700">
  Completed
</span>
```

**Tag/chip**:
```html
<span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
  keyword
</span>
```

**Status dot** (in headers/tabs):
```html
<span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
```

### Collapsible Sections

```jsx
<button
  onClick={toggle}
  className="flex items-center justify-between w-full text-left
    font-semibold text-gray-900 p-3 hover:bg-gray-50 rounded-md
    border border-transparent hover:border-gray-200
    transition-all duration-200 cursor-pointer">
  <span>Section Title</span>
  <svg className={`w-5 h-5 transform transition-all duration-300
    ${collapsed ? 'rotate-0' : 'rotate-180'}`}>
    {/* Chevron icon */}
  </svg>
</button>
<div className={`transition-all duration-500 ease-in-out overflow-hidden
  ${collapsed ? 'max-h-0 opacity-0' : 'max-h-[2000px] opacity-100'}`}>
  {/* Content */}
</div>
```

## State Indicators

### Loading States

**Full-page spinner**:
```html
<div className="flex items-center justify-center py-20">
  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
</div>
```

**Inline spinner** (next to buttons):
```html
<div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
```

**Pulsing indicator** (in-progress items):
```html
<span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
```

### Empty States

```jsx
<div className="text-center py-12">
  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center
    justify-center mx-auto mb-4">
    {/* Icon */}
  </div>
  <h3 className="text-lg font-medium text-gray-900 mb-2">No items yet</h3>
  <p className="text-gray-500 mb-6">Description of what to do next.</p>
  <button className="btn-primary">Create first item</button>
</div>
```

### Auto-save Indicator

Positioned `absolute top-2 right-2` on input containers:
- Saving: Blue spinner
- Saved: Green check + "Saved" text
- Unsaved: Gray dot

### Error States

**Inline error**:
```html
<div className="bg-red-50 border border-red-200 rounded-2xl p-4">
  <p className="text-red-700 text-sm">Error message here.</p>
</div>
```

**Success message**:
```html
<div className="bg-green-50 text-green-700 border border-green-200 rounded-2xl px-4 py-2">
  Success message here.
</div>
```

## Responsive Design

### Breakpoints

Use Tailwind defaults: `sm` (640px), `md` (768px), `lg` (1024px), `xl` (1280px).

### Standard Responsive Patterns

**Layout shift** (stack on mobile → row on desktop):
```
flex flex-col sm:flex-row
```

**Text scaling**:
```
text-sm sm:text-base         ← body text
text-xl sm:text-2xl          ← headings
```

**Padding scaling**:
```
px-4 sm:px-6 md:px-8
p-4 sm:p-6
```

**Visibility**:
```
hidden sm:inline             ← desktop-only labels
sm:hidden                    ← mobile-only elements
```

**Container width**:
```
max-w-full sm:max-w-lg
```

**Truncation** for long text:
```
truncate block max-w-[200px] sm:max-w-[400px]
```

### Mobile Considerations

- Tab bars: `overflow-x-auto` for horizontal scrolling
- Modals: `max-h-[60vh]` on mobile, `max-h-[80vh]` on desktop
- Multi-column layouts: Collapse to single column below `lg:`
- Touch targets: Minimum `py-3 px-4` on interactive elements

## Animations & Transitions

### Standard Transition (apply to most interactive elements)

```
transition-all duration-200
```

Or for color-only changes:
```
transition-colors duration-200
```

### Custom Animations

**fade-in** (page/section appearance):
```
animate-fade-in   →   opacity 0→1 over 0.5s ease-in-out
```

**slide-up** (elements entering from below):
```
animate-slide-up   →   translateY(10px)→0 + opacity 0→1 over 0.3s ease-out
```

### Collapse/Expand

```
transition-all duration-500 ease-in-out
collapsed:  max-h-0 opacity-0 overflow-hidden
expanded:   max-h-[2000px] opacity-100
```

### Rotation (chevrons/triangles)

```
transform transition-transform duration-200
collapsed: rotate-0
expanded:  rotate-90 or rotate-180
```

### Built-in Tailwind

- `animate-spin`: Loading spinners
- `animate-pulse`: Skeleton loaders, in-progress dots
- `animate-bounce`: Attention elements (use sparingly)

## Icons

### Approach: Inline SVGs

No icon library dependency. Copy SVG paths from [Heroicons](https://heroicons.com/) as inline `<svg>` elements:

```jsx
<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="..." />
</svg>
```

### Size Scale

| Class | Pixels | Use for |
|-------|--------|---------|
| `w-3 h-3` | 12px | Inline tiny icons |
| `w-4 h-4` | 16px | Standard inline icons |
| `w-5 h-5` | 20px | Button icons |
| `w-6 h-6` | 24px | Header icons |
| `w-8 h-8` | 32px | Feature/hero icons |

### Icon Color

Icons inherit text color. Use `text-gray-400` for inactive, `text-gray-600` for default, `currentColor` for context-dependent.

## Accessibility Checklist

- [ ] All interactive elements have visible `focus:ring-2 focus:ring-gray-900` states
- [ ] Icon-only buttons have `aria-label`
- [ ] Clickable non-button elements have `tabIndex={0}` and `onKeyDown` handlers for Enter/Space
- [ ] Screen-reader-only labels use the `sr-only` class
- [ ] Disabled elements use `aria-disabled={true}`
- [ ] Color is never the sole indicator of state (add text/icons alongside)
- [ ] Form inputs have associated `<label>` elements

## Markdown Rendering

For apps displaying user/AI-generated content, use ReactMarkdown with styled overrides:

```jsx
<ReactMarkdown
  components={{
    p: ({children}) => <p className="mb-3 leading-relaxed text-base">{children}</p>,
    ul: ({children}) => <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>,
    ol: ({children}) => <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>,
    strong: ({children}) => <strong className="font-semibold text-gray-900">{children}</strong>,
    h1: ({children}) => <h1 className="text-xl font-bold text-gray-900 mb-3">{children}</h1>,
    h2: ({children}) => <h2 className="text-lg font-bold text-gray-900 mb-2">{children}</h2>,
    h3: ({children}) => <h3 className="text-base font-semibold text-gray-900 mb-2">{children}</h3>,
    code: ({children}) => <code className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono">{children}</code>,
  }}
>
  {content}
</ReactMarkdown>
```

Consider offering a **raw/formatted toggle** to let users switch between rendered markdown and a monospace `<pre>` view.

## Quick Reference: The Most Common Patterns

```
Page background:      bg-gray-50
Card:                 bg-white rounded-3xl shadow-sm border border-gray-200 p-6 sm:p-8
Primary button:       bg-gray-900 text-white rounded-xl px-6 py-3 font-medium
Secondary button:     bg-white text-gray-700 border border-gray-300 rounded-xl px-6 py-3
Input:                border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-gray-900
Label:                text-sm font-semibold text-gray-900 mb-3
Helper text:          text-xs text-gray-500 mt-2
Section heading:      text-xl font-semibold text-gray-900
Body text:            text-sm text-gray-600 leading-relaxed
Divider:              border-t border-gray-200
Badge:                px-2 py-1 rounded-full text-xs font-semibold bg-{color}-100 text-{color}-700
Transition:           transition-all duration-200
Focus ring:           focus:outline-none focus:ring-2 focus:ring-gray-900
```
