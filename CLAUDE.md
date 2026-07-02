# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

No build system — this is a zero-dependency static HTML+JS app.

Open `top5k.html` directly in a browser, or serve via:
```
python -m http.server 8000
```

`top5k.html` is the current main app. `index.html` is a legacy, simpler version.

## Architecture

Everything lives in `top5k.html` — inline CSS, HTML, and ~1200 lines of vanilla JS. No npm, no frameworks, no backend. All state persists to `localStorage`.

**Key JS sections within top5k.html:**

- **Helpers** — DOM selectors, text normalization (handles ß↔ss, ä↔ae, etc.)
- **CSV Parser** — Auto-detects delimiter (`;` for 5k.csv, `,` for vocab.csv), handles quoted fields
- **Storage** — localStorage with v1→v2 migration, rolling 15-snapshot backups
- **Core module** — Learning logic: `load()`, `levelPool()`, `requiredFor()`, `pick()`, `render()`, `check()`, `rebuildData()`
- **UI module** — Level selector, import/export, backup reminder banner
- **Word tools** — Edit, Hide, 1-Streak, Super-review, Typo (undo wrong answer)

## State Shape

```javascript
{
  level: 1,
  streaks: { [id]: count },
  penalty: { [id]: { target, untilLevel } },
  reqSeen: { [id]: req },
  overrides: {
    [id]: {
      deleted?,
      german?, english?, deSent?, enSent?, category?, masri?,
      super?, superEvery?, superNext?,
      easy1?
    }
  },
  sentenceMode: boolean,
  currentId: string,
  lastReview: { ... }
}
```

**localStorage keys:**
- `top5k_state_v2` — Current progress
- `top5k_backups_v1` — Rolling 15-snapshot array
- `top5k_last_cloud_backup_v1` — Timestamp of last export
- `top5k_backup_dismissed_v1` — Session flag to suppress banner

## Learning Algorithm

- 25 words per level, assigned by CSV row position
- To advance: master all unlocked words at current level
- Streak requirements vary by distance from current level:
  - Current/previous level: 3-streak
  - 2 levels back: 2-streak
  - 3+ levels back: 1-streak
- Wrong answers trigger a penalty (temporarily higher streak requirement until next level)
- Super-review: mastered words can be scheduled for periodic "visitor" review every N levels (don't block progression)

## CSV Format

**5k.csv** (semicolon-delimited):
```
ID;German;English;German sentence;English sentence;Category;Masri
1;ich;I;Ich bin heute müde.;I am tired today.;pronoun;أنا
```

Word edits made via the in-app "Edit" tool are stored as `overrides` in localStorage — they do not modify the CSV.

## PWA

Configured via `manifest.webmanifest`. Installable on iOS/Android via browser "Add to Home Screen". Icons are in `icons/`. Vocabulary images are in `img/`.
