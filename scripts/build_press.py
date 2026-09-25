#!/usr/bin/env python3
"""Merge research files in data/press/*.json into public/press/releases.json.

Each input file has {"verified": [...], "unverified": [...]}; only verified
entries are published. Duplicates (same URL or same title+date) are merged.
"""
import glob, hashlib, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIELDS = ["title", "date", "company", "client", "url", "archive_url", "source",
          "name_as_listed", "role", "summary", "text"]


def norm(s):
    return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()


NAME_RE = re.compile(r"Amy (?:Burke )?Bessette|Amy Burke")
# Research notes the agents left in summaries; keep them off the public page.
NOTE_RE = re.compile(
    r"\s*(?:(?:IMPORTANT|Note):.*$"
    r"|Her name appears as press contact.*$"
    r"|(?:Co-contacts?|Media contacts?|Press contact|Listed under)[: ].*$"
    r"|Sole press contact\.?)", re.S)


def clean(r):
    m = NAME_RE.search(r["name_as_listed"])
    if m:
        r["name_as_listed"] = m.group(0)
    summary = r["summary"]
    note = NOTE_RE.search(summary)
    if note:
        r["note"] = note.group(0).strip()
        r["summary"] = summary[:note.start()].strip()
    else:
        r["note"] = ""
    return r


def main():
    merged = {}
    for path in sorted(glob.glob(os.path.join(ROOT, "data", "press", "*.json"))):
        with open(path) as f:
            data = json.load(f)
        for r in data.get("verified", []):
            r = clean({k: (r.get(k) or "") for k in FIELDS})
            if not r["title"]:
                continue
            key = norm(r["url"]) or f"{norm(r['title'])}|{r['date']}"
            alt = f"{norm(r['title'])}|{r['date'][:7]}"
            existing = merged.get(key) or merged.get(alt)
            if existing:
                for k in FIELDS + ["note"]:  # keep the richer value
                    if len(r[k]) > len(existing[k]):
                        existing[k] = r[k]
                continue
            r["id"] = hashlib.sha1((key).encode()).hexdigest()[:10]
            merged[key] = merged[alt] = r
    releases = sorted({id(r): r for r in merged.values()}.values(),
                      key=lambda r: r["date"], reverse=True)
    out = os.path.join(ROOT, "public", "press", "releases.json")
    with open(out, "w") as f:
        json.dump({"releases": releases}, f, ensure_ascii=False, indent=1)
    print(f"wrote {len(releases)} releases to {os.path.relpath(out, ROOT)}")


if __name__ == "__main__":
    main()
