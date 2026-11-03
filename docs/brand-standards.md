# BSA brand standards in the application

Source: **BSA Brand Style Guide 2026** (Visual Brand Manager: Katy Sturich). This page records how the guide is applied
in the UI so future changes stay compliant.

| Guide section | Application |
|---|---|
| **Name** (p.9) | The firm is "BSA" everywhere. "BSA LifeStructures, Inc." appears only in legal contexts, and "BSA Design" is never used as the firm name. |
| **Logo** (pp.10–18) | The logo is **never recreated**. Official files go in `src/brand/assets/` (see the README there) and are picked up automatically: the white logo on the dark theme and over photos, the red logo on light backgrounds only. Until the files are supplied, the app shows plain text ("BSA" + product name), which is not a logo imitation. No partner or client logo lockups. |
| **Color** (pp.19–23) | Tokens in `src/styles/index.css`. Backgrounds are black (dark theme) or white (light theme); raised surfaces are white screens over black. Text on colored fills is black or white only. Red `#cc1b2d` is the brand signature (primary actions, focus bars, the active tab). Teal `#56b1bf` is the interaction accent (Dark Teal `#3a7f8a` on white, for contrast). Secondary colors are used for status only: Green = ready, Yellow = partially ready/caution, Red = not ready/blocked. Gradients are not used. |
| **Typography** (pp.24–25) | Lato throughout. Headings use Lato Black and labels/eyebrows use Lato Regular in all caps with 100 tracking. Lato Light is not used for body text, and teal text is reserved for quotes and links. |
| **Layout** (pp.26–27) | Circles are perfect circles (avatars, numbered markers, icons). Sections are divided by single 1px lines, white space is generous, corners are near-square. |
| **Headshots** (p.33) | Headshots are cropped to a circle frame with room above the head. The cropper shows a circular guide. Official headshots should come from Open Asset. |
| **Photography / 3rd-party / AI** (pp.29–39) | No internet stock, client logos or AI-generated imagery. Neutral placeholders are used until authentic images exist. The upload form asks for an image credit and repeats the AI and internet-image restriction. |

## Accessibility decisions

- BSA Red text on black is 3.8:1 contrast (fails WCAG AA), so red is used as a **fill** with white text (5.6:1), never as small text on black.
- Teal on white is 2.5:1, so the light theme uses Dark Teal (4.6:1) for interactive text.
- Error messages use a red marker with readable white/black text.

Questions about visual brand use go to the Visual Brand Manager.
