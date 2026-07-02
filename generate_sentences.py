#!/usr/bin/env python3
"""
Generate example sentences for German vocab words using Gemini API.
Writes progressively to sentences.json (resumable if interrupted).

Usage:
  python generate_sentences.py --demo              # first 25 words, show output
  python generate_sentences.py                     # full run (all 4899 words)
  python generate_sentences.py --start-id 2948     # resume from a specific id
"""

import csv, json, os, sys, time, re, argparse
from google import genai
from google.genai import types

CSV_PATH  = "5k.csv"
JSON_PATH = "sentences.json"
BATCH_SIZE = 5    # words per API call

SYSTEM_PROMPT = """\
You generate German example sentences for a vocabulary flashcard app.

=== SENTENCE RULES ===
- Casual everyday spoken German — natural, not textbook-stiff
- Max 12 words per German sentence (count every token including articles and particles)
- Default tense: Präsens
- Past tense: use Perfekt for lexical/action verbs (bin gegangen, hat gegessen)
- Präteritum ONLY for: sein (war), haben (hatte), modal verbs (wollte, musste, konnte, durfte, sollte)
- Each sentence must use a different topic/scenario — no two should feel like the same situation
- No two sentences for the same word may start with the same first 3 words (case-insensitive)
- The word MUST appear in the sentence (in its exact or inflected form)

=== FIELD RULES ===

"deSent": The German sentence.

"conjugated":
  - null  → only when the sentence uses the EXACT dictionary form of the word, unchanged
  - string → the exact surface form used in the sentence, in all other cases
  Examples:
    dict "gehen",       sentence uses "gehen"         → null
    dict "gehen",       sentence uses "gehe"          → "gehe"
    dict "gehen",       sentence uses "gegangen"      → "gegangen"
    dict "ein",         sentence uses "einen"         → "einen"
    dict "zu",          sentence uses "zum"           → "zum"
    dict "gut",         sentence uses "gut"           → null
    dict "gut",         sentence uses "guten"         → "guten"
  Separable verb with zu-infinitive (zu inserted between prefix and stem):
    dict "herausfinden", sentence uses "herauszufinden" → "herauszufinden"
    dict "mitnehmen",    sentence uses "mitzunehmen"    → "mitzunehmen"
    dict "anrufen",      sentence uses "anzurufen"      → "anzurufen"
  Separable verb split in a main clause (prefix moves to end):
    Use "..." between the stem-part and the prefix to mark the split.
    dict "ausziehen", sentence "Er zieht seine Schuhe aus."     → "zieht... aus"
    dict "anrufen",   sentence "Ich rufe dich morgen an."        → "rufe... an"
    dict "einfallen", sentence "Mir fällt nichts Gutes ein."     → "fällt... ein"
    dict "mitnehmen", sentence "Kannst du das mitnehmen?"        → null  (unsplit infinitive, no ... needed)
    Each part on either side of "..." MUST itself appear verbatim in deSent, in left-to-right order.

"enSent": Natural English translation of the German sentence.

"enInSent": The English word or phrase in enSent that corresponds to the German word.
  - If the English equivalent is a CONTIGUOUS substring of enSent, write it as-is.
    Example: enSent "I bought a book." → enInSent "bought"
  - If the English equivalent is NON-CONTIGUOUS (words interrupted by other words),
    write the parts joined by "..." with a space on each side.
    Example: enSent "What was this cake actually made of?" → enInSent "What was... made of"
    Example: enSent "Should I take anything along from the store?" → enInSent "take... along"
    Example: enSent "I will take this experience with me my whole life." → enInSent "take... with me"
  - Each part on either side of "..." MUST itself be an exact case-insensitive substring of enSent,
    and must appear in left-to-right order in enSent.
  - Prefer contiguous matches when natural. Use "..." only when the translation genuinely splits.

=== OUTPUT FORMAT ===
Return ONLY a valid JSON object — no markdown fences, no explanation, no trailing text.
Keys are the numeric word IDs (as strings). Each value is an array of sentence objects.
{
  "1": [
    {"deSent": "...", "enSent": "...", "conjugated": null, "enInSent": "..."},
    ...
  ]
}
"""

HUMAN_NAME_INDICATORS = [
    "first name", "given name", "forename", "christian name",
    "surname", "last name", "family name",
    "male name", "female name", "boy's name", "girl's name",
]


def load_csv():
    words = []
    with open(CSV_PATH, encoding="utf-8") as f:
        reader = csv.reader(f, delimiter=";")
        next(reader)  # skip header
        for row in reader:
            if len(row) < 2:
                continue
            wid     = row[0].strip()
            german  = row[1].strip()
            english = row[2].strip() if len(row) > 2 else ""
            de_sent = row[3].strip() if len(row) > 3 else ""
            category= row[5].strip() if len(row) > 5 else ""
            words.append({
                "id":           wid,
                "german":       german,
                "english":      english,
                "has_sentence": bool(de_sent),
                "category":     category,
            })
    return words


def load_existing():
    if os.path.exists(JSON_PATH):
        with open(JSON_PATH, encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_json(data):
    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def is_human_name(w):
    eng = w["english"].lower()
    return any(ind in eng for ind in HUMAN_NAME_INDICATORS)


def build_prompt(batch, n):
    lines = [f"Generate exactly {n} sentences for EACH of the following German words:\n"]
    for w in batch:
        lines.append(f'- ID {w["id"]}: word "{w["german"]}"  (English meaning: "{w["english"]}")')
    return "\n".join(lines)


def call_gemini(client, prompt):
    resp = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            temperature=0.85,
            max_output_tokens=8192,
        ),
    )
    text = resp.text.strip()
    # Strip markdown code fences if model adds them anyway
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text.strip())
    return json.loads(text)


def validate_batch(result, batch, n):
    issues = []
    for w in batch:
        wid   = w["id"]
        sents = result.get(wid, [])
        if not isinstance(sents, list):
            issues.append(f"[{wid}] {w['german']}: not a list")
            continue
        if len(sents) != n:
            issues.append(f"[{wid}] {w['german']}: expected {n}, got {len(sents)}")

        seen_starts = []
        for i, s in enumerate(sents):
            de    = (s.get("deSent")   or "").strip()
            en    = (s.get("enSent")   or "").strip()
            en_in = (s.get("enInSent") or "").strip()
            conj  = s.get("conjugated")
            slot  = i + 1

            def in_sent(needle, haystack):
                if "..." in needle:
                    parts = [p.strip() for p in needle.split("...") if p.strip()]
                    pos = 0
                    for part in parts:
                        idx = haystack.lower().find(part.lower(), pos)
                        if idx == -1:
                            return False
                        pos = idx + len(part)
                    return True
                return needle.lower() in haystack.lower()

            search = conj if conj else w["german"]
            if de and not in_sent(search, de):
                issues.append(f"[{wid}] s{slot}: '{search}' not in deSent: {repr(de)}")

            if en_in and en:
                if "..." in en_in:
                    parts = [p.strip() for p in en_in.split("...") if p.strip()]
                    pos, ok = 0, True
                    for part in parts:
                        idx = en.lower().find(part.lower(), pos)
                        if idx == -1:
                            ok = False
                            break
                        pos = idx + len(part)
                    if not ok:
                        issues.append(f"[{wid}] s{slot}: enInSent parts {repr(en_in)} not in order in enSent {repr(en)}")
                elif en_in.lower() not in en.lower():
                    issues.append(f"[{wid}] s{slot}: enInSent {repr(en_in)} not in enSent {repr(en)}")

            tokens = de.rstrip("?!.,;:").split()
            start3 = tuple(t.lower() for t in tokens[:3])
            if start3 in seen_starts:
                issues.append(f"[{wid}] s{slot}: duplicate first-3-words {start3}")
            seen_starts.append(start3)

            if len(tokens) > 12:
                issues.append(f"[{wid}] s{slot}: {len(tokens)} words > 12")
    return issues


def process_batch(client, batch, n, existing, dry_run=False):
    label = ", ".join(f"{w['id']}:{w['german']}" for w in batch)
    print(f"  [{label}]")

    if dry_run:
        print("  [DRY RUN — skipping API call]")
        return

    prompt = build_prompt(batch, n)
    for attempt in range(1, 4):
        try:
            raw = call_gemini(client, prompt)
            # Normalize keys to strings
            result = {str(k): v for k, v in raw.items()}
            issues = validate_batch(result, batch, n)

            if issues:
                print(f"  Attempt {attempt} — {len(issues)} issue(s):")
                for iss in issues[:4]:
                    print(f"    {iss}")
                if attempt < 3:
                    print("  Retrying...")
                    time.sleep(3)
                    continue
                print("  Saving anyway after 3 attempts.")

            # Merge whichever IDs came back correctly
            for w in batch:
                if w["id"] in result and isinstance(result[w["id"]], list):
                    existing[w["id"]] = result[w["id"]]

            save_json(existing)
            print(f"  Saved — {len(existing)} total words in sentences.json")
            return

        except json.JSONDecodeError as e:
            print(f"  Attempt {attempt}: JSON parse error — {e}")
            time.sleep(4)
        except Exception as e:
            print(f"  Attempt {attempt}: {type(e).__name__}: {e}")
            time.sleep(6)

    print("  FAILED after 3 attempts — skipping batch")


def run(client, todo, existing, label, dry_run=False):
    if not todo:
        print(f"  (nothing to do for {label})")
        return
    print(f"\n=== {label}: {len(todo)} words ===")
    n = 9 if "existing" in label.lower() else 10
    total_batches = (len(todo) + BATCH_SIZE - 1) // BATCH_SIZE
    for i in range(0, len(todo), BATCH_SIZE):
        batch = todo[i : i + BATCH_SIZE]
        b_num = i // BATCH_SIZE + 1
        print(f"\nBatch {b_num}/{total_batches} (n={n}):")
        process_batch(client, batch, n, existing, dry_run=dry_run)
        if not dry_run:
            time.sleep(1.5)


def main():
    parser = argparse.ArgumentParser(description="Generate German sentences via Gemini API")
    parser.add_argument("--api-key",  help="Gemini API key (or set GEMINI_API_KEY env var)")
    parser.add_argument("--demo",     action="store_true", help="Process first 25 words only")
    parser.add_argument("--start-id", type=int, default=1,    help="Start from this word ID")
    parser.add_argument("--end-id",   type=int, default=4899, help="End at this word ID (inclusive)")
    parser.add_argument("--dry-run",  action="store_true",    help="Show plan without calling API")
    args = parser.parse_args()

    api_key = args.api_key or os.environ.get("GEMINI_API_KEY")
    if not api_key and not args.dry_run:
        api_key = input("Enter your Gemini API key: ").strip()

    client = None
    if not args.dry_run:
        client = genai.Client(api_key=api_key)
        print("Model: gemini-2.5-flash  |  Output: sentences.json")

    all_words = load_csv()
    existing  = load_existing()
    print(f"CSV loaded: {len(all_words)} words  |  Already in JSON: {len(existing)}")

    # Filter by ID range (skip rows with empty/non-numeric IDs)
    in_range = []
    for w in all_words:
        try:
            wid_int = int(w["id"])
        except ValueError:
            continue
        if args.start_id <= wid_int <= args.end_id:
            in_range.append(w)

    # Skip human names (only for words without existing sentences)
    words, skipped = [], []
    for w in in_range:
        if not w["has_sentence"] and is_human_name(w):
            skipped.append(f"{w['id']}:{w['german']}")
        else:
            words.append(w)

    if skipped:
        preview = ", ".join(skipped[:8]) + ("..." if len(skipped) > 8 else "")
        print(f"Skipping {len(skipped)} human names: {preview}")

    # Remove already-done words
    todo = [w for w in words if w["id"] not in existing]

    if args.demo:
        todo = todo[:25]
        print(f"DEMO MODE — {len(todo)} words")

    # Split into two groups
    has_sent = [w for w in todo if w["has_sentence"]]     # need 9 more
    no_sent  = [w for w in todo if not w["has_sentence"]] # need 10

    run(client, has_sent, existing, "Words WITH existing sentences (9 new each)", dry_run=args.dry_run)
    run(client, no_sent,  existing, "Words WITHOUT sentences (10 new each)",      dry_run=args.dry_run)

    print(f"\nDone — sentences.json contains {len(existing)} words total.")
    if not args.dry_run:
        print("Run:  python validate_sentences.py  to check all rules.")


if __name__ == "__main__":
    main()
