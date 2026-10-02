# German Trainer — project background

A personal German-learning PWA for one learner (the owner). Plain static
HTML/CSS/JS — no build step, no framework, no backend code. Hosted on
**GitHub Pages from `main`** of `negm320/german-vocab-trainer`; pushing to
`main` deploys in about a minute. Used mainly as an installed PWA on an
**iPhone**, so iOS Safari behaviour is the real target.

**How the owner works:** in **cloud Claude Code chats** (claude.ai/code / the
Claude app). Each chat starts from a fresh clone of GitHub, so this file lives
on GitHub at `.claude/CLAUDE.md` and is read automatically. The owner is not
technical and found the command line confusing — don't ask them to run
commands unless unavoidable, and then give exact copy-paste steps.

The owner also has an old local clone on their Windows PC at
`C:\Users\Negm\Documents\german-vocab-trainer` from earlier CLI sessions. It
is NOT kept in sync and holds the only copies of their old local helper
scripts (`generate_sentences.py`, `validate_sentences.py`, `add_gender.py`) —
never tell them to delete it.

---

## Working with the owner (read first)

- **Ask/report before changing things.** If asked to audit, review or "tell me
  what you think", answer with a report — don't edit code unless asked. When a
  change is approved, implement it fully, test it, then commit and deploy.
- **Deploying** = push the work branch, then fast-forward `main`
  (`git push origin <branch>:main`). The owner tests on the live site, so after
  a deploy remind them to force-refresh the PWA (see "PWA caching").
- **New options must be settings that default to the current behaviour** —
  the owner wants to opt in, never have behaviour change under them.
- **Keep typo tolerance lenient** (Levenshtein ≤ 2 in the vocab cloze; typo
  rules in grammar). The owner types sloppily on a phone; an earlier attempt
  to make it stricter was reverted on request.
- **No read-aloud / text-to-speech** — it doesn't work reliably on their iPhone.
- **Cost-conscious about the Gemini API**: cheapest model that does the job
  well. See "AI models".
- **Keep the repo root clean**: only what the site serves lives at the root
  (HTML/CSS/JS, fonts, icons, manifest, `5k.csv`, `sentences.json`). Every
  extra file — docs, notes, SQL, scripts — goes inside **`.claude/`**
  (`.claude/CLAUDE.md`, `.claude/docs/…`, scripts in `.claude/scripts/`).
  `.gitignore` blocks stray `*.md/*.sql/*.py/*.sh` at the root but allows
  everything under `.claude/`. Never commit test screenshots or scratch files.
- Plain, non-technical explanations in replies; short summaries of what
  changed and what to test.

---

## Files on GitHub (everything the site serves)

| File | What it is |
|---|---|
| `top5k.html` | **Vocab** — the main trainer over the 5k frequency list (PWA start page) |
| `grammar.html` | **Grammar** — word-order drill (the owner's favourite, most actively developed) |
| `preps.html` | **Präpositionen** — pick the right preposition in a collocation |
| `ausdruck.html` | **Ausdruck** — free speaking/writing on a topic, AI-graded |
| `chat.html` | **Chat** — role-play conversation with an AI character, graded at the end |
| `ios-theme.css` | Shared design system (tokens, sheets, segments, dock, icon buttons…) |
| `ios-sheet.js` | `IOSSheet.open/close/confirm` — spring-animated bottom sheets |
| `ios-motion.js` | Spring physics used by the sheets |
| `demo-mode.js` | `IOSDemo` — run every screen with no API key using invented content |
| `5k.csv` | The 5k word list (`;`-separated, CRLF). Columns: `#;German;English;German example;English translation;Category;Masri;Gender;Conjugation;English in sentence` |
| `sentences.json` | `{ "<word id>": [ {deSent, enSent, conjugated, enInSent}, … ] }` — extra example sentences per word for cloze rotation |
| `manifest.webmanifest`, `icons/`, `fonts/` | PWA manifest (start_url `./top5k.html`), icons, self-hosted Poppins + Lora |
| `.nojekyll` | Tells GitHub Pages to serve files as-is |

Each screen is one self-contained HTML file (inline `<style>` + `<script>`).
A floating dock at the bottom links the five screens; the last-used tab is
remembered in `localStorage.top5k_active_tab` and each page redirects to it on
load.

Removed in the Oct 2026 cleanup (still in git history; restore with
`git checkout 9aae7f7 -- <path>`): `img/` (358 noun pictures, never used by any
screen — idea: picture cards) and `vocab.csv`, `verbs.csv`, `prepositions.csv`,
`adjadv.csv` (used only by the old `index.html`, deleted Aug 2026).
`ios26-design-guidelines.md` and the grammar-bank SQL now live in
`.claude/docs/`.

---

## Shared conventions

- **API key**: Gemini key in `localStorage.top5k_gemini_key`; every screen
  shows an API-key setup screen if missing (with a "test without API" demo
  button). Calls go straight from the browser to
  `generativelanguage.googleapis.com/v1beta/models/<model>:generateContent?key=…`
  with `responseMimeType: application/json`.
- Gemini 3.x thinking is configured with `thinkingConfig.thinkingLevel`
  (`minimal`/`low`/`medium`); thinking tokens count against `maxOutputTokens`
  and are billed as output.
- Helpers duplicated per page: `extractGeminiText` (drops `thought` parts),
  `parseFirstJSON` (parses the first balanced `{…}` only), retry loop
  (3 attempts, 0.8/1.6/3.2 s backoff on 429/5xx/network).
- **Buttons** use `pointerdown` + `preventDefault` + a 400 ms lock (so taps
  don't steal focus from the input / double-fire on iOS).
- **Cloud sync (optional)**: Supabase URL + publishable key in
  `localStorage.top5k_supabase_url` / `top5k_supabase_key` (entered in the
  Vocab screen's menu). Requests use only the `apikey` header (publishable
  keys are not JWTs). Generic table `kv_state(key, value jsonb, updated_at)`
  holds one JSON blob per screen; on load, if the cloud copy is newer, the
  page offers to restore it. App works fully offline without it.
- **PWA caching**: there is no service worker; iOS serves cached files until
  the HTTP cache expires. The Chat screen's Settings has a "force refresh"
  button (`hardRefresh()` re-fetches every asset with `cache:'reload'`).
  `APP_VERSION` in `chat.html` is a manual deploy marker.
- **Demo mode**: `localStorage.top5k_demo_mode = '1'` (or the button on the
  key screen). Each fetch function short-circuits with
  `if (IOSDemo.on) return IOSDemo.<thing>()`. `IOSDemo.grammarDrill()` must
  return the finished drill shape (`english, correct, pieces, _hasWords`).

### localStorage keys

| Key | Owner | Contents |
|---|---|---|
| `top5k_state_v2` (+`_v1`, `top5k_backup_v2`, `top5k_state_premigration_v2`) | Vocab | progress: level, scores, schedule, overrides, seen… |
| `top5k_profile_v1` | Vocab → read by Grammar & Chat | `{v:1, level, words:[{id, german, english, gender, score, bucket:'training'|'weak'|'random'}]}` — written on every save |
| `top5k_log_v1` | Vocab | daily answer log |
| `top5k_flagged_v1` | Vocab | flagged sentences.json slots per word (by index — clear via Tools → "Clear flagged" whenever sentences.json is replaced) |
| `top5k_last_cloud_backup_v1`, `top5k_backup_dismissed_v1` | Vocab | backup banner |
| `top5k_gemini_key`, `top5k_supabase_url`, `top5k_supabase_key`, `top5k_demo_mode`, `top5k_active_tab` | all | shared config |
| `grammar_settings_v1` | Grammar | settings object (see Grammar) |
| `grammar_daily_v1` | Grammar | `{ "YYYY-MM-DD": count }`, last 120 days |
| `grammar_flagged_v1` | Grammar | last 40 flagged sentences `{german, english, ts}` |
| `grammar_recent_conn_v1` | Grammar | last connector used |
| `preps_stats_v1`, `preps_saved_at_v1`, `preps_highlight_gov_v1` | Preps | per-pair stats `{aggregate:{"gov|prep":{attempts,misses,lastSeen}}, log:[…]}` |
| `ausdruck_entries_v1`, `ausdruck_saved_at_v1` | Ausdruck | graded entries |
| `chat_scenes_v1`, `chat_scenes_saved_at_v1`, `chat_settings_v1` | Chat | scenes (cap 40), end-mode/turn-cap settings |

Synced to `kv_state`: `top5k_state_v2`, `top5k_log_v1`, `chat_scenes_v1`,
`preps_stats_v1`, `ausdruck_entries_v1`.

---

## Screens

### Vocab (`top5k.html`)
- Data from `5k.csv` (+ `sentences.json`). 25 words per level; the pool for
  level N is the first N×25 words (cumulative).
- Modes: **Word** (English → type German), **Cloze** (German sentence with a
  blank; rotates through `sentences.json` slots, flaggable), **Sentence**
  (type the whole German sentence — exact match, does not affect scores).
- Scoring: each word has a score 0–5 (default 3). Per level it's scheduled
  `floor(score)` appearances (+1 with probability = fractional part). Correct
  → score −0.4 (−0.2 below 1); wrong → score moves halfway to 5 and is
  rescheduled. Level advances when all scheduled appearances are done. Not
  time-based (a long break changes nothing).
- Word tools: Edit (overrides stored in state; editing only the meaning does
  NOT pin the sentence), Hide, Super (show every N levels), 1-Streak, Set
  score, Typo (count last wrong answer as right), Back.
- All 4,899 rows have English + an example sentence (the 1,982 words from
  id 2948 on were filled in on 2 Oct 2026). Rows without English would be
  skipped, as a safety net.
- Loading: `5k.csv` and `sentences.json` are fetched with `cache:'no-cache'`
  (revalidate → 304, not a re-download). Only the CSV blocks the first card;
  `sentences.json` (~7.5 MB, one word per line) arrives in the background and
  re-renders the card if it's still untouched.
- Cloud restore prompt compares the cloud copy's `value.savedAt` (not the
  row's `updated_at`) and is skipped when the progress is identical
  (`sameProgress`) — the old check asked on every reopen.
- Cloze blank prefers a whole-word match (so "Freund" isn't blanked inside
  "Freundin").
- `sentences.json` was replaced on 2 Oct 2026 (4,894 words × 9–10 sentences)
  and checked: every slot's blank lands on a whole word (inflected forms are
  in `conjugated`; separable verbs as `"gibt... vor"`). Re-check any new
  version the same way before committing — the owner's generator once wrote
  the text `"None"` instead of `null`.
- Tools (bottom of the card): Recalibrate, Export/Clear flagged, Restore
  latest backup, Storage usage, Clean legacy keys (only deletes keys of
  removed features or not starting with `top5k_/grammar_/preps_/ausdruck_/chat_`),
  Push now. The old streak/penalty system, v1-state migration and v1 tools
  were removed in the Oct 2026 cleanup (saved state now holds only `level,
  overrides, activeMode, settings, scores, currentBatchIds, scheduledThisLevel,
  completedThisRun, currentId, sentenceIndex, seen, savedAt`).

### Grammar (`grammar.html`) — main focus
**Drill**: English sentence shown; the German words are shuffled chips;
rebuild the German order by tapping chips, typing or dictating. Check / Next
/ mic in a pill bar; Undo word; flag button.

**Generation** (`fetchDrill`):
- Model `DRILL_MODEL = 'gemini-3.8-flash'` (thinking `low`). On 400/403/404
  it falls back to `GEMINI_MODEL = 'gemini-3.5-flash-lite'` for the session;
  on 429 for 10 minutes.
- One focus per drill: a vocab word from `top5k_profile_v1` (weak 50% /
  training 35% / random 15%) with probability per the *vocab* setting, else a
  connector. Connector picked in code from `CONNECTOR_WEIGHTS` (spoken
  frequency: weil/dass/wenn highest), avoiding only the previous one.
  Fronting the subordinate clause is a soft 40% request for frontable ones.
  Theme from 15 broad `THEMES`. No forced subject.
- The model writes **3 candidates** `{german, english, verbs, prefixes}` and
  `pick`s the most natural; chips are built in code (`buildPairs`: splits on
  spaces, tags verbs, separated prefixes matched from the end, marks the
  first word).
- Register rules: Perfekt for past (Präteritum only sein/haben/modals), no
  Futur with werden, everyday Konjunktiv II allowed, full forms (no "hab'").
- The last 8 flagged sentences are sent as "don't write like this" examples.
- These choices fixed the owner's main complaint ("sentences are stupid or
  unnatural"): the old version stacked a niche English topic + forced
  subject + forced clause order + connector ban + 2 vocab words on the lite
  model.

**Checking** (`evaluateAnswer`): punctuation/case-insensitive alignment;
small word typos (Levenshtein ≤ 2 or same Kölner Phonetik) → "Typo — close
enough"; one dropped ≤3-letter word → typo. If an answer is wrong but uses
exactly the drill's words in another order → `verifyAlternative` asks the
lite model whether it's also correct German. Valid → "Also correct ✓", saved
to the drill and the bank row's `alternatives`; invalid → shows the one-line
rule that was broken. Only the first Check of a drill is recorded.

**Sentence bank** (Supabase table `grammar_bank`, SQL below):
- Every generation saves all 3 candidates (`source` 'picked' / 'alt') unless
  a near-duplicate: content words (stopwords dropped, crude stemming)
  overlapping ≥ 60% (Jaccard) with any stored sentence. The duplicate index
  is loaded into memory once per session (paged 1000 rows).
- Answers update `seen`, `correct`, `last_seen`, `last_correct`; flag sets
  `flagged`. Rows are keyed by the unique `german` text.
- `BANK_TARGET = 10000`. Below it: API generates, bank fills. At/above it:
  **no API calls** — drills come from the bank (unseen first, ~20% re-tests of
  wrong answers, flagged never; prefers rows matching the length setting).
  If the bank errors, it falls back to the API.
- Status line: "N / 10,000 saved" (on page or only in settings). A missing
  table shows "table missing" and the page works as before.

**Settings** (⚙️ sheet, `grammar_settings_v1`; defaults = original behaviour):
| Setting | Values (default first) |
|---|---|
| `showDaily` daily counter | Show / Hide |
| `goal` daily goal | None(0) / 20 / 40 / 60 / custom |
| `showStreak` day streak | Show / Hide |
| `hideEnglish` | Show / Hidden (blurred, tap to peek; revealed after Check) |
| `colors` word colour hints | All / No verb colour / None |
| `hideCapital` first-word capital | Keep / Hide (lowercases only function words) |
| `length` | Medium (8–16) / Short (6–10) / Long (14–22) |
| `vocab` vocab words in sentences | Often 60% / Sometimes 30% / Never |
| `autoNext` after a correct answer | Quick (0.8 s) / Slow (2.5 s) / Smart (slow, but waits when there's a typo or "also correct" note) / Wait (Next or Enter) |
| `bankOnPage` bank count | Show on page / Only in settings |

**Motivation UI**: header pills — streak (🔥 flame SVG; days in a row
meeting the goal, or ≥1 sentence with no goal; unlit until today counts) and
daily counter (count, or a progress ring "n/goal" that turns green with a
pop). Compact header layout below 360 px width.

**Dictation**: Web Speech API (`de-DE`, continuous, interim, 4 alternatives;
tokens snapped to the drill's words via exact/umlaut/Kölner/Levenshtein).
iOS re-sends the whole session's speech in every result, so the field is
rebuilt as `micBase + sessionWords[micSkip…]`; any edit while listening
(undo, chip tap, typing) calls `micSyncToField()` which commits the field
and consumes everything heard so far. Check / Next / mic button call
`stopMic()` (abort + ignore late results).

**Debug panel**: tap the English sentence 5 times → last 10 drills with
model, connector, theme, injected word, rejected candidates and chip roles.

### Präpositionen (`preps.html`)
Model `gemini-3-flash-preview` (thinking medium) — old preview, should move
to `gemini-3.8-flash`. Drill: sentence with `___`, 4 options, governing word
highlighted (toggle). Prompt bans contracted forms in the blank and asks for
real distractors; ~35% of drills re-test a pair the learner misses ≥ 1/3 of
the time (`pickReviewPair` over `preps_stats_v1.aggregate`). Flag button logs
a bad drill. Prefetch queue of 3.

### Ausdruck (`ausdruck.html`)
Lite model. Generates a concrete personal speaking topic + 2–3 guiding
W-questions; the learner dictates/writes ~10 sentences; grading returns
scores 0–5 (naturalness = headline, task, range, accuracy, coherence — with
anchors in the prompt), errors with categories (highlighted in the text),
a corrected version and one "stretch" suggestion.

### Chat (`chat.html`)
Lite model. Generates a scenario (situation with a goal, character with
du/Sie implied, opening line ending in a question) avoiding the last 8
situations; up to 3 training/weak words from the vocab profile are woven
into the scene. Character replies 1–3 sentences, stays in role, invites
longer answers, never corrects. Scene ends when the AI says so / the learner
ends it / after N turns. Grading highlights corrections (red, solid) and
naturalness notes (amber, dashed) on the learner's bubbles, with minimal
spans and the rule named. iMessage-style UI with heavy iOS keyboard handling.

---

## AI models (prices checked Sept 2026, per 1M tokens in/out)
- `gemini-3.5-flash-lite` — $0.30 / $2.50. Used for chat replies, Ausdruck,
  grammar alternative-order checks, fallback.
- `gemini-3.6/3.7/3.8-flash` — $0.75 / $3.75 intro until 31 Dec 2026, then
  $1.50 / $7.50. `gemini-3.8-flash` generates grammar drills (naturalness
  needs a full Flash model).
- `gemini-3.5-flash` — $1.50 / $9.00; no reason to use.
- Rough cost: a grammar drill ≈ $0.004 on 3.8 Flash. Recommended next: move
  Preps and the Chat/Ausdruck *graders* to 3.8 Flash; keep Lite for chat
  replies and topics.

---

## Supabase SQL

Also saved as `.claude/docs/grammar_bank.sql`.

`kv_state` already exists (created by the owner earlier). Grammar bank —
run once in Supabase → SQL Editor (safe to re-run):

```sql
create table if not exists grammar_bank (
  id           bigint generated always as identity primary key,
  german       text not null unique,
  english      text not null,
  verbs        jsonb not null default '[]',
  prefixes     jsonb not null default '[]',
  connector    text,
  word         text,
  theme        text,
  model        text,
  source       text not null default 'picked',   -- 'picked' | 'alt'
  created_at   timestamptz not null default now(),
  seen         int not null default 0,
  correct      int not null default 0,
  last_seen    timestamptz,
  last_correct boolean,
  flagged      boolean not null default false,
  alternatives jsonb not null default '[]'
);
alter table grammar_bank add column if not exists alternatives jsonb not null default '[]';
create index if not exists grammar_bank_serve_idx on grammar_bank (flagged, seen, last_seen);
alter table grammar_bank enable row level security;
drop policy if exists "app access" on grammar_bank;
create policy "app access" on grammar_bank for all to anon using (true) with check (true);
grant select, insert, update on grammar_bank to anon;
```
The owner has run this (including the `alternatives` column) — verify with
the "N / 10,000 saved" line if unsure.

---

## Testing

No test suite. What has worked well:
- `python3 -m http.server` in the repo + **Playwright** with Chromium at
  `/opt/pw-browsers/chromium` (cloud sessions; `NODE_PATH=$(npm root -g)`).
- Mock Gemini with `page.route('https://generativelanguage.googleapis.com/**')`
  and Supabase with a fake host (`localStorage.top5k_supabase_url =
  'https://fake.supabase.co'`) + an in-memory table; HEAD must return
  `content-range` and `access-control-expose-headers: Content-Range`.
- Fake speech recognition by overriding BOTH `window.SpeechRecognition` and
  `window.webkitSpeechRecognition` in an init script.
- Syntax-check inline scripts: extract `<script>` bodies → `node --check`.
- Check layouts at 390 px and 320 px width.
- Real iPhone behaviour (keyboard, mic, PWA cache) can't be tested in the
  cloud — ask the owner to verify.

---

## Open ideas / known issues (not done yet)
- **Grammar Phase 3**: structure picker (Relativsatz, zu-Infinitiv, indirect
  questions, Modalverben, trennbare Verben, nicht-position…), A2/B1/B2
  difficulty, stats per connector/structure from the bank data.
- Vocab: review isn't time-based; Sentence mode needs AI grading; Reset
  doesn't clear `seen`.
- Preps model upgrade (see AI models). Preps stats screen.
- Root URL has no `index.html` (404) — a redirect to `top5k.html` would fix
  old bookmarks.
- Gemini key is sent as a URL query parameter; the `x-goog-api-key` header
  would be cleaner.
- History still contains the removed 84 MB `img/` folder; only a history
  rewrite (force-push) would shrink the repo — not done, owner's call.
