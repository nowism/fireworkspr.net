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


def main():
    merged = {}
    for path in sorted(glob.glob(os.path.join(ROOT, "data", "press", "*.json"))):
        with open(path) as f:
            data = json.load(f)
        for r in data.get("verified", []):
            r = {k: (r.get(k) or "") for k in FIELDS}
            if not r["title"]:
                continue
            key = norm(r["url"]) or f"{norm(r['title'])}|{r['date']}"
            alt = f"{norm(r['title'])}|{r['date'][:7]}"
            existing = merged.get(key) or merged.get(alt)
            if existing:
                for k in FIELDS:  # keep the richer value
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
