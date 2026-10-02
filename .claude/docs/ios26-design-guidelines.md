# iOS 26 Design Guidelines — Project Design Bible

> **This is the design north star for german-vocab-trainer.** All 5 screens
> (top5k / grammar / preps / ausdruck / chat) should converge on these rules.
> Source: learnui.design/blog/ios-design-guidelines-templates.html (iOS 26 /
> Liquid Glass era). When a design decision is in question, this file wins.

---

## 0. How we apply this here (app-specific notes)

- The app is a dark-mode PWA on iOS WebKit (installed to home screen). Dark
  mode values below are the ones that matter most.
- Our font is **Lora** (serif), not SF Pro — a deliberate identity choice.
  Where the guidelines say "SF Pro / weight not size," we keep the *principle*
  (emphasize via weight + color, hold size constant) but in Lora.
- We already use a floating Liquid-Glass pill dock (`.iosDock`) — that IS the
  iOS 26 tab-bar pattern. The open design problem is chat's composer coexisting
  with it (see §3, tab bar "hidden when keyboard is shown").

---

## 1. Screen dimensions & safe areas

- **Design baseline**: 390 × 844 pt (most common width). Verify at 440 pt
  (Pro Max / 17 Pro Max = 440 × 956) for large devices, and 375 × 812
  (mini / 11 Pro / X) for small.
- **Home indicator reserved zone**: 21 pt tall at the bottom. **No fixed
  element may sit inside it.** Always respect `env(safe-area-inset-bottom)`.
- Page zones top→bottom: status bar → navigation bar → scrollable content →
  tab bar → home indicator.

## 2. Tab bar (our floating dock)

- **Floating, centered, pill-shaped container.** Inset **21 pt** from left,
  right, and bottom edges.
- Material: **Liquid Glass** (translucent, refractive).
- **2–5 tabs.** A 5th tab may be "More." (We have exactly 5 — at the limit.)
- Label text: **11 pt SF** (11 pt is the minimum text size in the whole system).
- Selected = brand/accent color. Unselected label: `#F5F5F5` (dark mode).
- **Behavior:**
  - Each tab **remembers its own state** — leave a tab, come back, you're where
    you left off. (We do this via `top5k_active_tab` + per-page localStorage.)
  - Tapping the **active** tab returns to that tab's main screen.
  - **⚠️ Hidden when the keyboard is shown, or when a modal is open.** ← this is
    the sanctioned answer to our dock-vs-keyboard conflict.
- **Search island**: a little circular Liquid-Glass island to the *right* of the
  other tab items, positioned for one-handed reach; expands to a full search
  screen when tapped.

## 3. Navigation bar (top)

- **Unscrolled**: Row 1 = back button + small title + page actions; Row 2 =
  large title (optional).
- **Scrolled**: collapses to compact centered small title; back + actions stay.
  A blur + fade "scroll edge effect" rides the bottom edge of the nav bar.
- **Back navigation — four ways:** (1) tap Back top-left, (2) swipe right from
  the left edge, (3) tap ✕/✔︎ (modals only), (4) swipe down (modal/fullscreen).

## 4. Modal sheets

- Slide up from the bottom, cover almost all of the previous page; previous
  page stays visible but darkened.
- Dismiss via ✕ or downward swipe. Use to restrict focus to one critical task.

## 5. Typography

**Principle: emphasize with weight or color, NOT size or case. Body stays 17 pt.**

| Element | Size | Weight | Dark mode color |
|---|---|---|---|
| Page title (large) | 34 pt | Bold | `#FFF` |
| Page title (small) | 17 pt | Semibold | `#FFF` |
| Body / primary | 17 pt | Regular | `#FFF` |
| Input hint | 17 pt | Regular | `#404040` |
| Secondary | 15 pt | Regular | `#EBEBF5` @ 70% |
| Tertiary / caption | 13 pt | Regular | `#EBEBF5` @ 30–70% |
| Button (primary) | 17 pt | Regular | `#FFF` or accent |
| Button (secondary) | 15 pt | Regular | `#FFF`/`#000`/accent |
| Tab bar label | 11 pt | Regular | `#F5F5F5` (sel: accent) |
| Toolbar label | 17 pt | Medium | `#F5F5F5` |

- Minimum text size anywhere: **11 pt**.

## 6. Buttons

- **Fixed buttons**: Liquid-Glass circles with an icon; live in nav bar or tab
  bar; page content scrolls *beneath* them. Used for page-level actions.
- **Inline buttons**: rounded rects or circles; icon/text/both; local actions.
  Three styles: filled (primary), gray-with-accent (secondary), black-on-gray
  (tertiary).

## 7. Lists ("90% of mobile design is list design")

Three decisions per row: (1) text — primary only / primary+secondary /
custom hierarchy; (2) left — optional icon/image; (3) right accessory —
chevron (navigate), text+chevron (pick a value), checkmark (single choice),
switch (toggle), or text button (link / red destructive).

## 8. Inputs

- **Text boxes**: styled like a list item; hint disappears on typing.
- **Switches**: label left, switch right.
- **Pickers**: light-gray button; picker appears directly below on tap. Complex
  choices → push to a separate list page with a checkmark on the chosen row.
- **Pull-down menus**: Liquid-Glass translucent panels floating above content.

## 9. Search

- Primary entry = search button in the **tab bar** (bottom, one-handed reach).
- Secondary = search in action/nav bar.
- Tapping it → dedicated search screen: search box + optional recent/popular
  below. Focus jumps to the box immediately, keyboard shows, with a Cancel and
  a speech-to-text (mic) button beside the field.

## 10. Touch targets

- **Minimum 44 × 44 pt.** Inline text links may be smaller but minimize those.

## 11. Color & dark mode

- Black text → white; dark gray → light gray. Backgrounds shift darker (dark
  gets darker still).
- **Accent colors in dark mode**: bump brightness, drop saturation, nudge hue
  toward yellow (60°) / cyan (180°) / magenta (300°) so they pop on black.
- Dark-mode system defaults:
  - Primary text `#FFF`; secondary `#EBEBF5` @ 70%; tertiary `#EBEBF5` @ 30–70%;
    input hint `#404040`.

## 12. Status bar & scroll edge effects

- Status bar (time / signal / wifi / battery) on basically every page except
  full-screen media. Content fades/blurs under it for legibility.
- **Scroll edge effects**: top = fade + blur (or fade only); bottom (under tab
  bar) = progressive fade, usually *without* blur.

## 13. Liquid Glass (iOS 26 headline material)

- Reflective/refractive glass texture on the **navigation layer only** (nav
  bars, tab bars, fixed buttons, pull-down menus, search island). **Not** on
  content layers like lists.
- Subtle parallax on tilt; picks up system lighting.

## 14. App icons

- Built in Apple's **Icon Composer** (Mac); layered, generates light / dark /
  mono versions; picks up system lighting + parallax.
