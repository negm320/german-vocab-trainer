"""Validate sentences.json against two hard rules:
  1. conjugated (when not null) must be a case-insensitive substring of deSent
  2. enInSent must be a case-insensitive substring of enSent
  3. When conjugated is null, german (dict form) must appear in deSent
"""
import json, sys, csv, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

CSV_PATH = "5k.csv"
JSON_PATH = "sentences.json"

def load_words():
    words = {}
    with open(CSV_PATH, encoding="utf-8") as f:
        reader = csv.reader(f, delimiter=";")
        next(reader)
        for row in reader:
            if len(row) >= 2:
                wid = row[0].strip()
                german = row[1].strip()
                words[wid] = german
    return words

def check(wid, german, sentences):
    errors = []
    seen_starts = []
    seen_topics = []

    for i, s in enumerate(sentences):
        de = (s.get("deSent") or "").strip()
        en = (s.get("enSent") or "").strip()
        conj = s.get("conjugated")
        en_in = (s.get("enInSent") or "").strip()
        slot = i + 1

        if not de:
            errors.append(f"slot {slot}: deSent is empty")
            continue
        if not en:
            errors.append(f"slot {slot}: enSent is empty")
            continue
        if not en_in:
            errors.append(f"slot {slot}: enInSent is empty")
            continue

        # Rule 1: enInSent must appear in enSent (case-insensitive)
        # Supports "..." format for non-contiguous matches: each part must appear in order
        if "..." in en_in:
            parts = [p.strip() for p in en_in.split("...") if p.strip()]
            pos, all_found = 0, True
            for part in parts:
                idx = en.lower().find(part.lower(), pos)
                if idx == -1:
                    all_found = False
                    break
                pos = idx + len(part)
            if not all_found:
                errors.append(f"slot {slot}: enInSent parts {repr(en_in)} NOT found in order in enSent {repr(en)}")
        elif en_in.lower() not in en.lower():
            errors.append(f"slot {slot}: enInSent {repr(en_in)} NOT in enSent {repr(en)}")

        # Rule 2 & 3: conjugated (or german) must appear in deSent.
        # Supports "..." for split separable verbs: each part must appear in order.
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

        search = conj if conj else german
        label  = f"conjugated {repr(conj)}" if conj else f"german {repr(german)}"
        if not in_sent(search, de):
            errors.append(f"slot {slot}: {label} NOT in deSent {repr(de)}")

        # Check first-3-words uniqueness
        words_de = de.rstrip("?!.,").split()
        start3 = tuple(w.lower() for w in words_de[:3])
        if start3 in seen_starts:
            errors.append(f"slot {slot}: first-3-words {start3} duplicated")
        seen_starts.append(start3)

        # Word count check
        if len(words_de) > 12:
            errors.append(f"slot {slot}: deSent has {len(words_de)} words (>12): {repr(de)}")

    return errors

def main():
    words = load_words()
    with open(JSON_PATH, encoding="utf-8") as f:
        data = json.load(f)

    total_errors = 0
    total_words = 0
    for wid, sentences in data.items():
        german = words.get(wid, f"[id:{wid}]")
        errs = check(wid, german, sentences)
        if errs:
            print(f"\n[{wid}] {german}:")
            for e in errs:
                print(f"  ERROR: {e}")
            total_errors += len(errs)
        total_words += 1

    print(f"\n{'='*50}")
    print(f"Validated {total_words} words. Total errors: {total_errors}")
    if total_errors == 0:
        print("All checks passed.")

if __name__ == "__main__":
    main()
