from pathlib import Path
from bs4 import BeautifulSoup
import csv
import html
import re
import requests

PROBLEM_REPORT = Path("/tmp/existing_rituals_content_report.tsv")
SITE_BLOCKS = Path("/tmp/existing_rituals_site_blocks.tsv")

USER_AGENT = "Mozilla/5.0"

TARGETS = [
    ("2", "Гашение"),
    ("2", "Изучение Спящего Разума"),
    ("2", "Открытие Происхождения Крови"),
    ("2", "Призвание Духа-Охранника"),
    ("2", "Защитный Круг против Гулей"),
    ("3", "Руки-Лезвия"),
    ("3", "Гнилое Дерево"),
    ("4", "Дух-Преследователь"),
    ("4", "Защита от Витэ"),
    ("4", "Спор Крови"),
    ("5", "Court of Hallowed Truth"),
    ("5", "Дух-Мучитель"),
]

def clean(value):
    value = html.unescape(str(value or ""))
    value = value.replace("\xa0", " ")
    value = value.replace("`", "'").replace("’", "'").replace("´", "'")
    value = re.sub(r"\s+", " ", value)
    return value.strip()

def norm(value):
    value = clean(value).lower()
    value = value.replace("ё", "е")
    value = value.replace("й", "и")
    value = re.sub(r"\([a-z][^)]*\)", "", value, flags=re.IGNORECASE)
    value = re.sub(r"[«»\"“”„'`*]", "", value)
    value = re.sub(r"[^a-zа-я0-9]+", " ", value, flags=re.IGNORECASE)
    value = re.sub(r"\s+", " ", value)
    return value.strip()

def page_lines(url):
    r = requests.get(
        url,
        headers={"User-Agent": USER_AGENT, "Accept-Language": "ru,en;q=0.9"},
        timeout=45,
    )
    r.raise_for_status()
    r.encoding = r.apparent_encoding or r.encoding or "utf-8"
    soup = BeautifulSoup(r.text, "lxml")
    root = soup.find("main") or soup.find("article") or soup.body or soup
    return [clean(x) for x in root.get_text("\n", strip=True).splitlines() if clean(x)]

def tokens(name):
    parts = [x for x in norm(name).split() if len(x) >= 4]
    return parts[:4]

report = list(csv.DictReader(PROBLEM_REPORT.open(encoding="utf-8"), delimiter="\t"))
blocks = list(csv.DictReader(SITE_BLOCKS.open(encoding="utf-8"), delimiter="\t"))

by_target_report = {(r["level"], r["name"]): r for r in report}
by_target_block = {(r["level"], r["name"]): r for r in blocks}

print("===== SELECTED SITE BLOCKS =====")
for target in TARGETS:
    r = by_target_report.get(target)
    b = by_target_block.get(target)

    print()
    print("###", target[0], target[1])
    if r:
        print("status:", r["status"])
        print("fetchUrl:", r["fetchUrl"])
        print("beforeDescriptionLen:", r["beforeDescriptionLen"])
        print("beforeSystemLen:", r["beforeSystemLen"])
        print("siteDescriptionLen:", r["siteDescriptionLen"])
        print("siteSystemLen:", r["siteSystemLen"])
    else:
        print("NO REPORT ROW")

    if b:
        print("siteTitleLine:", b["siteTitleLine"])
        print("fullTextLen:", b["fullTextLen"])
        print()
        print("DESCRIPTION PREVIEW:")
        print((b["descriptionText"] or "")[:1200])
        print()
        print("SYSTEM PREVIEW:")
        print((b["systemText"] or "")[:1200])
    else:
        print("NO SITE BLOCK")

print()
print("===== RAW PAGE SEARCH AROUND TARGETS =====")
urls = sorted({r["fetchUrl"] for r in report if r.get("fetchUrl")})

cache = {}
for url in urls:
    try:
        cache[url] = page_lines(url)
    except Exception as e:
        print("FETCH ERROR", url, e)

for level, name in TARGETS:
    r = by_target_report.get((level, name))
    if not r:
        continue

    url = r["fetchUrl"]
    lines = cache.get(url, [])
    needle_tokens = tokens(name)

    print()
    print("### SEARCH", level, name, "on", url)
    print("tokens:", ", ".join(needle_tokens) or "(none)")

    hits = []
    for i, line in enumerate(lines):
        low = norm(line)
        if norm(name) in low or any(t in low for t in needle_tokens):
            hits.append(i)

    if not hits:
        print("NO HITS")
        continue

    for hit in hits[:12]:
        start = max(0, hit - 4)
        end = min(len(lines), hit + 12)
        print()
        print(f"-- around line {hit + 1} --")
        for j in range(start, end):
            mark = ">>" if j == hit else "  "
            print(f"{mark} {j + 1:04d}: {lines[j]}")
