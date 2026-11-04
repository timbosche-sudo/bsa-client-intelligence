# Official BSA logo files

Place the **official** BSA logo files here, downloaded from **Open Asset** (BSA Brand Style Guide 2026, p.18).
Never recreate the logo from text or redraw it (pp.10–16).

| File name | Version | Used on |
|---|---|---|
| `bsa-logo-white.svg` (or `.png`) | White logo | Dark theme, and over photography (p.11) |
| `bsa-logo-red.svg` (or `.png`) | Red logo, primary | Light theme (white backgrounds only) |

**Installed:** `bsa-logo-red.svg` is the official file supplied by BSA. `bsa-logo-white.svg` is the same artwork with only its fill changed to white (no geometry altered), for the dark theme. Replace it with the Open Asset white file if one is preferred.

The app picks these files up automatically at build time (`src/brand/Logo.tsx`). Until they exist, the app shows
a plain-text product name rather than an imitation of the logo.

Rules applied by the component:
- Clear space of about half the logo height on all sides (p.15).
- No effects, strokes, recolouring or added text inside the logo (p.16).
- Red logo never placed on dark backgrounds (p.16).
