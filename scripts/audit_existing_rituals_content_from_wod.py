from __future__ import annotations

from pathlib import Path
from bs4 import BeautifulSoup
from urllib.parse import urlparse
from collections import defaultdict
import csv
import html
import json
import re
import requests
import time

LOCAL_FILE = Path("data/vtm-revised-rituals.generated.json")

OUT_SUMMARY = Path("/tmp/existing_rituals_content_summary.txt")
OUT_REPORT = Path("/tmp/existing_rituals_content_report.tsv")
OUT_SITE_BLOCKS = Path("/tmp/existing_rituals_site_blocks.tsv")
OUT_PROBLEMS = Path("/tmp/existing_rituals_content_problems.tsv")

USER_AGENT = "Mozilla/5.0"

STOP_RE = re.compile(
    r"^(источник|источники|перевод|html-верстка|html верстка|главное меню|поиск|обратная связь|"
    r"source|sources|references?|литература|см\.?\s*также|copyright|©)\b",
    re.IGNORECASE,
)

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

def fetch_url_for_source(source_url, level):
    source_url = canon_url(source_url)
    level = level_key(level)

    if source_url.endswith("/thaum") and level == "1":
        return "https://wod.su/vampire/rites/thaum1"

    if re.search(r"/thaum(?:6|7|8|9|10)$", source_url):
        return "https://wod.su/vampire/rites/thaum6_10"

    return source_url

def split_description_system(blocks):
    blocks = [clean(x) for x in blocks if clean(x)]

    if not blocks:
        return "", "", ""

    desc_blocks = []
    system_blocks = []
    in_system = False

    for block in blocks:
        if re.match(r"^система\s*[:.]", block, re.IGNORECASE):
            in_system = True
            system_blocks.append(re.sub(r"^система\s*[:.]\s*", "", block, flags=re.IGNORECASE).strip())
            continue

        if in_system:
            system_blocks.append(block)
        else:
            desc_blocks.append(block)

    if system_blocks:
        desc = "\n".join(desc_blocks)
        system = "\n".join(system_blocks)
    else:
        desc = desc_blocks[0] if desc_blocks else blocks[0]
        system = "\n".join(desc_blocks[1:]) if len(desc_blocks) > 1 else ""

    return clean(desc), clean(system), clean("\n".join(blocks))

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

    name = clean(obj.get("name"))
    if not name:
        return False

    if "ritual" in norm(path_hint) or "ритуал" in norm(path_hint):
        return True

    type_text = clean(obj.get("type") or obj.get("kind"))
    return "ritual" in norm(type_text) or "ритуал" in norm(type_text)

def local_rituals(data):
    rows = []

    for obj, path_hint in walk(data):
        if not is_ritual(obj, path_hint):
            continue

        rows.append({
            "obj": obj,
            "pathHint": path_hint,
            "name": clean(obj.get("name")),
            "level": level_key(obj.get("level") or obj.get("rating") or obj.get("dots")),
            "sourceUrl": get_source_url(obj),
            "description": strip_html(obj.get("description", "")),
            "system": strip_html(obj.get("system", "")),
        })

    return rows

def request_page(session, url):
    r = session.get(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept-Language": "ru,en;q=0.9",
        },
        timeout=45,
    )
    r.raise_for_status()
    r.encoding = r.apparent_encoding or r.encoding or "utf-8"
    return r.text

def page_lines(html_text):
    soup = BeautifulSoup(html_text, "lxml")
    root = soup.find("main") or soup.find("article") or soup.body or soup

    raw_lines = [clean(x) for x in root.get_text("\n", strip=True).splitlines()]
    raw_lines = [x for x in raw_lines if x]

    lines = []
    i = 0

    while i < len(raw_lines):
        cur = raw_lines[i]

        # wod.su иногда разбивает название на "Г" + "ашение (Extinguish)".
        # Потому что нормальная разметка, видимо, была слишком буржуазной.
        if (
            re.fullmatch(r"[А-ЯЁа-яё]", cur)
            and i + 1 < len(raw_lines)
            and re.match(r"^[а-яё]", raw_lines[i + 1])
        ):
            lines.append(cur + raw_lines[i + 1])
            i += 2
            continue

        lines.append(cur)
        i += 1

    return lines

def build_page_index(local_rows):
    by_fetch = defaultdict(list)

    for r in local_rows:
        if not r["sourceUrl"]:
            continue
        by_fetch[fetch_url_for_source(r["sourceUrl"], r["level"])].append(r)

    return by_fetch

def possible_title_norms(name):
    result = {norm(name)}

    aliases = {
        "Задерживание Трупных Мух": ["Задержание Трупных Мух"],
        "Очищение Крови": ['"Очищение Плоти"', "Очищение Плоти"],
        "Вечерняя бодрость": ["Проснуться с Вечерней Свежестью"],
        "Исцеление Родной Землей": ["Исцеление Родной Земли"],
        "Защита от Гулей": ['"Защиты от Гулей"', "Защиты от Гулей"],
        "Горькая Роза": ["Ритуал Горькой Розы"],
    }

    for alias in aliases.get(name, []):
        result.add(norm(alias))

    return result

def is_title_line(line, expected_names):
    low = norm(line)

    candidates = {low}

    # Название может быть вида "Название (English Name)" или "English Name (Название)".
    candidates.add(norm(re.sub(r"\([^)]{1,160}\)", "", line)))

    for inside in re.findall(r"\(([^)]{1,160})\)", line):
        candidates.add(norm(inside))

    if expected_names.intersection(candidates):
        return True

    # Для коротких строк допускаем вхождение: "Summon Guardian Spirit (Призвание Духа-Охранника)".
    if len(clean(line).split()) <= 12:
        return any(e and e in low for e in expected_names)

    return False

def collect_block(lines, start, all_title_norms):
    blocks = []
    i = start + 1

    while i < len(lines):
        line = clean(lines[i])

        if not line:
            i += 1
            continue

        if norm(line).startswith("примечание") or norm(line).startswith("примечания"):
            i += 1
            continue

        if norm(line).startswith("примечание") or norm(line).startswith("примечания"):
            i += 1
            continue

        if STOP_RE.match(line):
            break

        if is_title_line(line, all_title_norms):
            break

        if norm(line) in {"мир тьмы", "вампиры маскарад", "ритуалы", "главное меню"}:
            i += 1
            continue

        blocks.append(line)
        i += 1

        if len(blocks) >= 80:
            break

    return split_description_system(blocks)

def write_tsv(path, rows, columns):
    with path.open("w", encoding="utf-8", newline="\n") as f:
        w = csv.DictWriter(f, delimiter="\t", fieldnames=columns, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow({c: clean(r.get(c, "")) for c in columns})

data = json.loads(LOCAL_FILE.read_text(encoding="utf-8-sig"))
rituals = local_rituals(data)

session = requests.Session()
by_fetch = build_page_index(rituals)

report = []
site_blocks = []
problems = []

for fetch_url, rows in sorted(by_fetch.items()):
    print("fetch:", fetch_url, "local:", len(rows))
    try:
        lines = page_lines(request_page(session, fetch_url))
    except Exception as e:
        for r in rows:
            problems.append({
                "severity": "error",
                "code": "fetch_failed",
                "level": r["level"],
                "name": r["name"],
                "sourceUrl": r["sourceUrl"],
                "detail": str(e),
            })
        continue

    all_title_norms = set()
    row_title_norms = {}

    for r in rows:
        norms = set(possible_title_norms(r["name"]))
        row_title_norms[(r["sourceUrl"], r["level"], r["name"])] = norms
        all_title_norms.update(norms)

    def line_matches_row(line, r):
        expected = row_title_norms[(r["sourceUrl"], r["level"], r["name"])]

        candidates = set(possible_title_norms(line))

        # Название может быть "Название (English Name)" или "English Name (Название)".
        candidates.add(norm(re.sub(r"\([^)]{1,160}\)", "", line)))

        for inside in re.findall(r"\(([^)]{1,160})\)", line):
            candidates.add(norm(inside))

        if expected.intersection(candidates):
            return True

        low = norm(line)

        # Для коротких title-like строк допускаем вхождение.
        if len(clean(line).split()) <= 12:
            return any(e and e in low for e in expected)

        return False

    found_keys = set()

    for r in rows:
        row_key = (r["sourceUrl"], r["level"], r["name"])
        best = None

        for i, line in enumerate(lines):
            if not line_matches_row(line, r):
                continue

            desc, system, full = collect_block(lines, i, all_title_norms)

            # Верхнее оглавление даёт 0-2 символа текста.
            # Реальный блок даёт нормальную массу текста. Выбираем не первый труп, а самый мясной.
            score = len(full) + len(desc) + (len(system) * 2)

            candidate = {
                "index": i,
                "line": line,
                "desc": desc,
                "system": system,
                "full": full,
                "score": score,
            }

            if best is None or candidate["score"] > best["score"]:
                best = candidate

        if best is None:
            report.append({
                "level": r["level"],
                "name": r["name"],
                "sourceUrl": r["sourceUrl"],
                "fetchUrl": fetch_url,
                "beforeDescriptionLen": str(len(r["description"])),
                "beforeSystemLen": str(len(r["system"])),
                "siteDescriptionLen": "0",
                "siteSystemLen": "0",
                "status": "not-found-on-site",
            })
            problems.append({
                "severity": "error",
                "code": "not_found_on_site",
                "level": r["level"],
                "name": r["name"],
                "sourceUrl": r["sourceUrl"],
                "detail": f"Не найдено название на странице {fetch_url}",
            })
            continue

        found_keys.add(row_key)

        desc = best["desc"]
        system = best["system"]
        full = best["full"]

        site_blocks.append({
            "level": r["level"],
            "name": r["name"],
            "sourceUrl": r["sourceUrl"],
            "fetchUrl": fetch_url,
            "siteTitleLine": best["line"],
            "descriptionText": desc,
            "systemText": system,
            "fullTextLen": str(len(full)),
        })

        status = "ok"
        if not desc:
            status = "missing-site-description"
        elif len(desc) < 20:
            status = "short-site-description"

        report.append({
            "level": r["level"],
            "name": r["name"],
            "sourceUrl": r["sourceUrl"],
            "fetchUrl": fetch_url,
            "beforeDescriptionLen": str(len(r["description"])),
            "beforeSystemLen": str(len(r["system"])),
            "siteDescriptionLen": str(len(desc)),
            "siteSystemLen": str(len(system)),
            "status": status,
        })

        if status != "ok":
            problems.append({
                "severity": "warning",
                "code": status,
                "level": r["level"],
                "name": r["name"],
                "sourceUrl": r["sourceUrl"],
                "detail": f"siteDescriptionLen={len(desc)}, siteSystemLen={len(system)}",
            })

    time.sleep(0.08)

write_tsv(
    OUT_REPORT,
    report,
    [
        "level",
        "name",
        "sourceUrl",
        "fetchUrl",
        "beforeDescriptionLen",
        "beforeSystemLen",
        "siteDescriptionLen",
        "siteSystemLen",
        "status",
    ],
)

write_tsv(
    OUT_SITE_BLOCKS,
    site_blocks,
    [
        "level",
        "name",
        "sourceUrl",
        "fetchUrl",
        "siteTitleLine",
        "descriptionText",
        "systemText",
        "fullTextLen",
    ],
)

write_tsv(
    OUT_PROBLEMS,
    problems,
    ["severity", "code", "level", "name", "sourceUrl", "detail"],
)

errors = [p for p in problems if p["severity"] == "error"]
warnings = [p for p in problems if p["severity"] == "warning"]

summary = [
    "Existing local rituals content audit",
    "",
    f"local file: {LOCAL_FILE}",
    f"local rituals: {len(rituals)}",
    f"site blocks found: {len(site_blocks)}",
    f"errors: {len(errors)}",
    f"warnings: {len(warnings)}",
    "",
    f"summary: {OUT_SUMMARY}",
    f"report: {OUT_REPORT}",
    f"site blocks: {OUT_SITE_BLOCKS}",
    f"problems: {OUT_PROBLEMS}",
]

OUT_SUMMARY.write_text("\n".join(summary) + "\n", encoding="utf-8", newline="\n")

print()
print("\n".join(summary))
print()
print("First 60 problems:")
for p in problems[:60]:
    print(f'- {p["severity"]}: {p["code"]}: {p["level"]} · {p["name"]} :: {p["detail"]}')
