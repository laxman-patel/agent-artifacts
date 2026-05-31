---
name: Artifacts
description: Durable homes for agent-generated artifacts, rendered as a dark technical spec surface.
colors:
  background: "oklch(0.17 0 0)"
  foreground: "oklch(0.985 0 0)"
  card: "oklch(0.1871 0 0)"
  border: "oklch(26% 0 0)"
  muted: "oklch(0.269 0 0)"
  muted-foreground: "oklch(0.708 0 0)"
  primary: "oklch(0.87 0 0)"
  primary-foreground: "oklch(0.205 0 0)"
  shader-back: "#111111"
  shader-front: "#c8c8c8"
  accent-cyan: "oklch(0.72 0.08 215)"
  accent-amber: "oklch(0.72 0.08 75)"
  accent-rose: "oklch(0.68 0.09 15)"
  accent-emerald: "oklch(0.7 0.08 155)"
typography:
  display:
    fontFamily: "Geist Pixel Square, Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2rem, 4vw, 2.5rem)"
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "-0.045em"
  headline:
    fontFamily: "Geist Pixel Square, Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 3vw, 1.875rem)"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "-0.04em"
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Geist Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0.16em"
rounded:
  sm: "0.125rem"
  md: "0.375rem"
  lg: "0.625rem"
spacing:
  xs: "0.5rem"
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
  section: "3rem"
components:
  button-command:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.sm}"
    padding: "0.75rem 1rem"
  button-signin:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.sm}"
    padding: "0.5rem 1rem"
  card-double-border:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "0.25rem"
  video-frame:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "0"
  hero-dither:
    backgroundColor: "{colors.shader-back}"
    textColor: "{colors.shader-front}"
    rounded: "0"
    padding: "0"
---

# Design System: Artifacts

## 1. Overview

**Creative North Star: "The Durable Signal Lab"**

Artifacts should feel like a quiet technical instrument: precise, dark, inspectable, and built for people who trust systems that expose their mechanics. The product promise is durability after generation, so the interface should feel stable rather than flashy. Structure, thin rules, version-aware labels, and disciplined type carry the brand.

The visual language is a dark developer/docs surface with a crafted artifact at the center. It borrows from spec sheets, CLI windows, browser chrome, and version history, but it must not collapse into a generic docs template. Product primitives such as URLs, versions, access, previews, and auditability should be visible in the UI.

The hero dither animation is part of the brand object. It is a monochrome Paper warp dither, not a decorative gradient and not an explanatory product diagram. It sits behind the hero as a signal field: `warp`, `8x8`, size `2`, speed `0.28`, scale `1.08`, rotation `192`, background `#111111`, foreground `#c8c8c8`. It should remain non-interactive and abstract.

**Key Characteristics:**

- Dark neutral canvas, thin borders, restrained surfaces.
- Monochrome dither and pixel typography provide identity.
- Copy and UI should expose mechanics: URLs, versions, access, storage, review.
- No decorative color gradients ever.
- No glassmorphism, no oversized metrics, no generic AI visuals.

## 2. Colors

The palette is restrained monochrome with rare, muted artifact accents. Color is a notation system, not decoration.

### Primary

- **Signal White** (`oklch(0.985 0 0)`): Primary foreground, high-emphasis text, logo fill, and active nav states.
- **Control White** (`oklch(0.87 0 0)`): Sign-in button and compact primary controls.

### Secondary

- **Dither Gray** (`#c8c8c8`): The hero shader foreground. Use only inside the dither field or similarly pixelated technical imagery.
- **Artifact Cyan** (`oklch(0.72 0.08 215)`): One of the restrained artifact preview accents. Keep subtle.
- **Artifact Amber** (`oklch(0.72 0.08 75)`): Command, report, and plan accent. Use sparingly.
- **Artifact Rose** (`oklch(0.68 0.09 15)`): Review and risk accent. Avoid turning it into an alert color unless state requires it.
- **Artifact Emerald** (`oklch(0.7 0.08 155)`): Tooling and editor accent. Keep it quiet.

### Neutral

- **Site Black** (`oklch(0.17 0 0)`): Page background. This is the main canvas.
- **Shader Black** (`#111111`): Hero dither background, matching the page closely enough to feel embedded.
- **Card Black** (`oklch(0.1871 0 0)`): Framed panels, demo video shell, and contained surfaces.
- **Border Gray** (`oklch(26% 0 0)`): Section rails, double-border cards, and player/window chrome.
- **Muted Gray** (`oklch(0.708 0 0)`): Secondary text at reduced opacity.

### Named Rules

**No Color Gradients Ever.** Do not use visible color gradients for backgrounds, buttons, cards, text, icons, sections, or decorative accents. If a future implementation needs a fade for readability, use an alpha mask only as a functional reveal, never as a visible color treatment.

**The One Accent Rule.** A section may use one accent family at a time, and it should appear inside previews, labels, charts, or tiny state marks. Never flood a section with accent color.

**The Dither Is Not a Gradient Rule.** The hero animation is a monochrome dithered shader. Preserve the hard pixel structure and avoid soft color blends.

## 3. Typography

**Display Font:** Geist Pixel Square, backed by Geist and system sans.
**Body Font:** Geist, backed by system sans.
**Label/Mono Font:** Geist Mono, backed by platform monospace.

**Character:** Pixel type gives the landing page a memorable artifact-native signature. Use it for headlines and major calls only. Geist carries the product's precision; Geist Mono is for commands, URLs, metadata, and machine-readable labels.

### Hierarchy

- **Display** (400, `clamp(2rem, 4vw, 2.5rem)`, 1.15): Hero title and final CTA. Keep it short and line-broken deliberately.
- **Headline** (400, `1.5rem` to `1.875rem`, 1.2): Section headings such as How it works and Outputs worth keeping.
- **Title** (600, `0.875rem`, 1.35): Card titles, artifact titles, and compact component headings.
- **Body** (400, `0.875rem`, 1.65): Marketing explanations and card descriptions. Keep line length under 65 to 75 characters.
- **Label** (500, `0.6875rem`, tracked uppercase or compact mono): Metadata, nav-like labels, file names, command labels, and version markers.

### Named Rules

**Pixel With Restraint.** Geist Pixel is a brand artifact, not the default voice. Do not use it for body copy, long labels, or dense UI.

**Commands Stay Mono.** CLI commands, URLs, IDs, versions, and file paths use Geist Mono. Surrounding prose stays Geist.

## 4. Elevation

Artifacts is flat by default. Depth comes from borders, tonal layering, clipped panels, and local contrast, not from heavy shadows. Shadows may appear only as subtle state feedback or to keep an isolated frame legible on the dark canvas.

### Shadow Vocabulary

- **Frame Hover Shadow** (`0 14px 28px oklch(0.08 0 0 / 0.28), 0 3px 10px oklch(0.08 0 0 / 0.2)`): Existing artifact preview hover lift. Use only for interactive preview cards.
- **Demo Frame Shadow** (`0 18px 48px oklch(0.08 0 0 / 0.22)`): Used for the demo video shell. Keep it subtle and dark.

### Named Rules

**Flat Until Touched.** Resting UI should be mostly flat. Add shadow only for hover, active presentation surfaces, or a video/artifact frame that needs separation.

**No Glow As Decoration.** Do not add colored glow, halo, neon bloom, or glass blur. The brand should feel engineered, not cyberpunk.

## 5. Components

### Buttons

- **Shape:** Small radius, usually `0.125rem` to `0.375rem`.
- **Primary:** Sign-in uses a light control surface on the dark nav, with dark text and compact padding.
- **Command CTA:** The setup command should look like a terminal affordance: mono text, thin border, dark fill, restrained hatch/pattern only if it does not read as a gradient.
- **Hover / Focus:** Use color opacity shifts, border shifts, or a clear focus outline. Avoid scale theatrics.

### Chips

- **Style:** Small mono labels with thin borders and low-opacity fills.
- **State:** Use text and border changes, not saturated fills. Chips are annotations, not badges of excitement.

### Cards / Containers

- **Corner Style:** Outer cards use `0.625rem`, inner surfaces use `0.375rem`.
- **Background:** Card surfaces sit just above the page background with `oklch(0.1871 0 0)` or low-opacity foreground fills.
- **Border:** Thin one-pixel borders are the main structure. Double-border treatments are allowed for feature cards and video/demo frames when they match the PayKit-like technical shell.
- **Internal Padding:** Prefer compact padding: `1rem`, `1.25rem`, or `1.5rem`. Avoid oversized SaaS card padding.

### Inputs / Fields

- **Style:** Dark fill, thin border, mono content when representing command or machine-readable text.
- **Focus:** Two-pixel focus outline using a mixed foreground color. Focus must be visible on the dark background.
- **Disabled:** Lower opacity rather than new colors.

### Navigation

- **Style:** Minimal top rail, small labels, active underline or top/bottom rule.
- **Links:** Lowercase labels are acceptable for the landing nav: docs, pricing, github.
- **Logo:** Use the actual white logo unboxed, close to the wordmark. Do not redraw it.

### Demo Video Frame

- **Style:** A quiet browser/player shell with no visible player controls until a real video is inserted.
- **Structure:** One outer frame and one video area. Do not create box-in-box nesting.
- **Copy:** Placeholder copy should be brief and functional. The frame should disappear once the recording is present.

### Hero Dither

- **Shader:** Paper `ditheringFragmentShader` with `DitheringShapes.warp` and `DitheringTypes["8x8"]`.
- **Parameters:** Size `2`, speed `0.28`, scale `1.08`, rotation `192`, offset `0, 0`.
- **Color:** `#111111` background and `#c8c8c8` foreground only.
- **Placement:** Behind the hero, biased to the right, fading into the text area only enough to preserve readability.
- **Behavior:** No cursor effects, no click effects, no orange logo, no explanatory icons.

## 6. Do's and Don'ts

### Do

- Use dark neutral structure, thin borders, and compact technical rhythm.
- Let the artifact lifecycle drive visuals: prompt, generated output, URL, versions, access, review.
- Use local Geist fonts from `apps/web/public/fonts/geist-font-1.7.1/`.
- Use Geist Pixel for short, memorable headings.
- Use the real logo from `apps/web/public/brand/artifacts-logo.svg`.
- Keep artifact previews restrained, with subtle inner accents only.
- Respect reduced motion. Pause marquees and shader motion where appropriate.
- Keep the dither animation monochrome, pixelated, and embedded in the page canvas.

### Don't

- Do not use color gradients ever. No gradient backgrounds, gradient buttons, gradient text, gradient cards, or gradient accents.
- Do not add glassmorphism, blur panels, neon glows, or generic AI auroras.
- Do not make the hero shader interactive unless explicitly requested again.
- Do not put orange logo walkers, cursor masks, or click ripples into the dither hero.
- Do not use the logo as decoration everywhere. Use it as an identity mark.
- Do not use Geist Pixel for long body copy or the standard wordmark.
- Do not create nested boxes unless each layer has a clear role.
- Do not turn quotes into endorsement boxes or imply unverified endorsement.
- Do not create oversized SaaS metric blocks or repeated icon-card grids beyond the current restrained feature pattern.
