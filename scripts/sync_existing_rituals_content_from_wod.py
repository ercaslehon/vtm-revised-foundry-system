from __future__ import annotations

from pathlib import Path
import csv
import html
import json
import os
import re
from datetime import datetime

LOCAL_FILE = Path("data/vtm-revised-rituals.generated.json")

SITE_BLOCKS = Path("/tmp/existing_rituals_site_blocks.tsv")
AUDIT_REPORT = Path("/tmp/existing_rituals_content_report.tsv")

OUT_REPORT = Path("/tmp/sync_existing_rituals_content_from_wod_report.tsv")
OUT_SUMMARY = Path("/tmp/sync_existing_rituals_content_from_wod_summary.txt")

APPLY = os.environ.get("APPLY") == "1"

MIN_DESCRIPTION_LEN = 30
MIN_SYSTEM_LEN = 40
MAX_TEXT_LEN = 10000

def clean(value):
    value = html.unescape(str(value or ""))
    value = value.replace("\xa0", " ")
    value = value.replace("`", "'").replace("’", "'").replace("´", "'")
    value = re.sub(r"\s+", " ", value)
    return value.strip()

def strip_html(value):
    return clean(re.sub(r"<[^>]+>", " ", str(value or "")))

def norm(value):
    value = clean(value).lower()
    value = value.replace("ё", "е")
    value = value.replace("й", "и")
    value = re.sub(r"\([a-z][^)]*\)", "", value, flags=re.IGNORECASE)
    value = re.sub(r"[«»\"“”„'`*]", "", value)
    value = re.sub(r"[^a-zа-я0-9]+", " ", value, flags=re.IGNORECASE)
    value = re.sub(r"\s+", " ", value)
    return value.strip()

def level_key(value):
    value = clean(value)
    value = value.replace("\u2013", "-").replace("\u2014", "-")
    value = re.sub(r"\s+", "", value)
    return value

def canon_url(url):
    return clean(url).rstrip("/")

def key_for(level, name, source_url):
    return (level_key(level), norm(name), canon_url(source_url))

def to_html_paragraph(text):
    text = clean(text)
    if not text:
        return ""
    return "<p>" + html.escape(text, quote=False) + "</p>"

def walk(obj, path_hint=""):
    if isinstance(obj, dict):
        yield obj, path_hint
        for k, v in obj.items():
            yield from walk(v, f"{path_hint}/{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from walk(v, f"{path_hint}[{i}]")

def get_source_url(obj):
    audit = obj.get("audit")
    if isinstance(audit, dict) and clean(audit.get("sourceUrl")):
        return canon_url(audit.get("sourceUrl"))

    automation = obj.get("automation")
    if isinstance(automation, dict):
        source = automation.get("source")
        if isinstance(source, dict) and clean(source.get("url")):
            return canon_url(source.get("url"))

    return canon_url(obj.get("sourceUrl", ""))

def is_ritual(obj, path_hint):
    if not isinstance(obj, dict):
        return False

    if not clean(obj.get("name")):
        return False

    type_text = clean(obj.get("type") or obj.get("kind"))

    return (
        "ritual" in norm(path_hint)
        or "ритуал" in norm(path_hint)
        or "ritual" in norm(type_text)
        or "ритуал" in norm(type_text)
    )

def read_tsv(path):
    with path.open(encoding="utf-8") as f:
        return list(csv.DictReader(f, delimiter="\t"))

def write_tsv(path, rows, columns):
    with path.open("w", encoding="utf-8", newline="\n") as f:
        w = csv.DictWriter(f, delimiter="\t", fieldnames=columns, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow({c: clean(r.get(c, "")) for c in columns})

if not LOCAL_FILE.exists():
    raise SystemExit(f"Не найден файл: {LOCAL_FILE}")

if not SITE_BLOCKS.exists():
    raise SystemExit(f"Не найден файл блоков сайта: {SITE_BLOCKS}. Сначала запусти audit_existing_rituals_content_from_wod.py")

if not AUDIT_REPORT.exists():
    raise SystemExit(f"Не найден audit report: {AUDIT_REPORT}. Сначала запусти audit_existing_rituals_content_from_wod.py")

data = json.loads(LOCAL_FILE.read_text(encoding="utf-8-sig"))

site_rows = read_tsv(SITE_BLOCKS)
audit_rows = read_tsv(AUDIT_REPORT)

site_by_key = {
    key_for(r["level"], r["name"], r["sourceUrl"]): r
    for r in site_rows
}

audit_by_key = {
    key_for(r["level"], r["name"], r["sourceUrl"]): r
    for r in audit_rows
}

rows = []
updated = 0
skipped = 0
seen = 0

for obj, path_hint in walk(data):
    if not is_ritual(obj, path_hint):
        continue

    seen += 1

    name = clean(obj.get("name"))
    level = level_key(obj.get("level") or obj.get("rating") or obj.get("dots"))
    source_url = get_source_url(obj)
    k = key_for(level, name, source_url)

    audit = audit_by_key.get(k)
    site = site_by_key.get(k)

    before_desc = strip_html(obj.get("description", ""))
    before_sys = strip_html(obj.get("system", ""))

    if not audit or not site:
        skipped += 1
        rows.append({
            "level": level,
            "name": name,
            "sourceUrl": source_url,
            "beforeDescriptionLen": len(before_desc),
            "beforeSystemLen": len(before_sys),
            "newDescriptionLen": 0,
            "newSystemLen": 0,
            "status": "skip-no-site-block",
        })
        continue

    status = clean(audit.get("status"))

    new_desc = clean(site.get("descriptionText"))
    new_sys = clean(site.get("systemText"))

    new_desc_len = len(new_desc)
    new_sys_len = len(new_sys)

    changes = []

    if status != "ok":
        skipped += 1
        rows.append({
            "level": level,
            "name": name,
            "sourceUrl": source_url,
            "beforeDescriptionLen": len(before_desc),
            "beforeSystemLen": len(before_sys),
            "newDescriptionLen": new_desc_len,
            "newSystemLen": new_sys_len,
            "status": f"skip-audit-status-{status}",
        })
        continue

    if MIN_DESCRIPTION_LEN <= new_desc_len <= MAX_TEXT_LEN:
        if clean(before_desc) != new_desc:
            changes.append("description")
            if APPLY:
                obj["description"] = to_html_paragraph(new_desc)

    if MIN_SYSTEM_LEN <= new_sys_len <= MAX_TEXT_LEN:
        if clean(before_sys) != new_sys:
            changes.append("system")
            if APPLY:
                obj["system"] = to_html_paragraph(new_sys)

    if changes:
        updated += 1

        if APPLY:
            audit_obj = obj.setdefault("audit", {})
            if isinstance(audit_obj, dict):
                audit_obj["status"] = "verified"
                audit_obj["sourceUrl"] = source_url
                audit_obj["checkedAt"] = datetime.now().strftime("%Y-%m-%d")
                audit_obj["checkedBy"] = "wod.su sync script"
                audit_obj["notes"] = "<p>Описание и системный текст сверены с wod.su для существующего локального ритуала.</p>"

        final_status = "updated" if APPLY else "would-update"
    else:
        skipped += 1
        final_status = "no-change-or-no-safe-text"

    rows.append({
        "level": level,
        "name": name,
        "sourceUrl": source_url,
        "beforeDescriptionLen": len(before_desc),
        "beforeSystemLen": len(before_sys),
        "newDescriptionLen": new_desc_len,
        "newSystemLen": new_sys_len,
        "status": final_status,
        "changes": ",".join(changes),
    })

if APPLY:
    backup = LOCAL_FILE.with_name(
        LOCAL_FILE.name + ".backup-before-existing-rituals-content-sync-" + datetime.now().strftime("%Y%m%d-%H%M%S")
    )
    backup.write_text(LOCAL_FILE.read_text(encoding="utf-8-sig"), encoding="utf-8", newline="\n")

    data.setdefault("auditSummary", {})
    if isinstance(data["auditSummary"], dict):
        data["auditSummary"]["existingRitualsContentSyncedAt"] = datetime.now().isoformat(timespec="seconds")
        data["auditSummary"]["existingRitualsContentSyncedFrom"] = "https://wod.su/vampire/rites/"
        data["auditSummary"]["existingRitualsContentSyncedCount"] = updated

    LOCAL_FILE.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )

write_tsv(
    OUT_REPORT,
    rows,
    [
        "level",
        "name",
        "sourceUrl",
        "beforeDescriptionLen",
        "beforeSystemLen",
        "newDescriptionLen",
        "newSystemLen",
        "status",
        "changes",
    ],
)

summary = [
    "Existing rituals content sync",
    "",
    f"mode: {'APPLY' if APPLY else 'DRY RUN'}",
    f"local file: {LOCAL_FILE}",
    f"rituals seen: {seen}",
    f"updated: {updated}",
    f"skipped: {skipped}",
    "",
    f"report: {OUT_REPORT}",
]

OUT_SUMMARY.write_text("\n".join(summary) + "\n", encoding="utf-8", newline="\n")

print("\n".join(summary))

if not APPLY:
    print()
    print("To apply:")
    print("APPLY=1 python3 scripts/sync_existing_rituals_content_from_wod.py")
