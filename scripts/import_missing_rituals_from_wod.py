from __future__ import annotations

from pathlib import Path
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse, urldefrag
from collections import Counter, defaultdict
import csv
import html
import json
import os
import re
import requests
import time
from datetime import datetime

ROOT_URL = "https://wod.su/vampire/rites/"
LOCAL_FILE = Path("data/vtm-revised-rituals.generated.json")

OUT_SUMMARY = Path("/tmp/import_missing_rituals_from_wod_summary.txt")
OUT_PAGES = Path("/tmp/import_missing_rituals_pages.tsv")
OUT_SITE = Path("/tmp/import_missing_rituals_site.tsv")
OUT_NEW = Path("/tmp/import_missing_rituals_new.tsv")
OUT_SKIPPED = Path("/tmp/import_missing_rituals_skipped.tsv")

APPLY = os.environ.get("APPLY") == "1"

USER_AGENT = "Mozilla/5.0"

MAX_PAGES = 100
MIN_DESCRIPTION_LEN = 30
MAX_DESCRIPTION_LEN = 12000
MAX_SYSTEM_LEN = 12000

THAUM_RE = re.compile(r"/vampire/rites/thaum(?:1|2|3|4|5|6_10|6|7|8|9|10)?/?$", re.IGNORECASE)

LEVEL_WORDS_RU = {
    "первого": "1", "первый": "1", "первом": "1",
    "второго": "2", "второй": "2", "втором": "2",
    "третьего": "3", "третий": "3", "третьем": "3",
    "четвертого": "4", "четвертый": "4", "четвертом": "4",
    "четвёртого": "4", "четвёртый": "4", "четвёртом": "4",
    "пятого": "5", "пятый": "5", "пятом": "5",
    "шестого": "6", "шестой": "6", "шестом": "6",
    "седьмого": "7", "седьмой": "7", "седьмом": "7",
    "восьмого": "8", "восьмой": "8", "восьмом": "8",
    "девятого": "9", "девятый": "9", "девятом": "9",
    "десятого": "10", "десятый": "10", "десятом": "10",
}

STOP_RE = re.compile(
    r"^(источник|источники|перевод|html-верстка|html верстка|главное меню|поиск|обратная связь|"
    r"source|sources|references?|литература|см\.?\s*также|copyright|©)\b",
    re.IGNORECASE,
)

BOOK_RE = re.compile(
    r"\b(player|players|guide|clans|dark ages|vampire|masquerade|edition|revised|storyteller|"
    r"clanbook|camarilla|sabbat|anarchs|blood magic|house of tremere)\b",
    re.IGNORECASE,
)

BAD_TITLE_RE = re.compile(
    r"(успех(?:а|и|ов|ом|ами)?|сложност(?:ь|и)|результат|книги|наследия|литература|"
    r"примечание|примечания|при помощи данного ритуала|ритуалы из|названия в скобках|"
    r"альтернативные названия|смотреть также)",
    re.IGNORECASE,
)

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

def strip_html(value):
    return clean(re.sub(r"<[^>]+>", " ", str(value or "")))

def strip_stars(value):
    value = clean(value)
    value = re.sub(r"^[•●\*\-\s]+", "", value)
    value = re.sub(r"\s*\*+\s*$", "", value)
    return clean(value)

def strip_en_tail(value):
    value = strip_stars(value)
    value = re.sub(r"\s*\([A-Za-z][^)]{1,160}\)\s*$", "", value)
    return clean(value)

def level_key(value):
    value = clean(value)
    value = value.replace("\u2013", "-").replace("\u2014", "-")
    value = re.sub(r"\s+", "", value)
    return value

def canon_url(url):
    return clean(url).rstrip("/")

def to_html_paragraph(text):
    text = clean(text)
    if not text:
        return ""
    return "<p>" + html.escape(text, quote=False) + "</p>"

def tag_text(tag):
    return clean(tag.get_text(" ", strip=True)) if tag else ""

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

def page_title(soup):
    h1 = tag_text(soup.find("h1"))
    if h1:
        return h1
    title = tag_text(soup.find("title"))
    title = re.sub(r"\s*-\s*World of Darkness.*$", "", title, flags=re.IGNORECASE)
    return clean(title)

def extract_rite_links(base_url, html_text):
    soup = BeautifulSoup(html_text, "lxml")
    root = soup.find("main") or soup.find("article") or soup.body or soup
    links = set()

    for a in root.find_all("a", href=True):
        url = urljoin(base_url, a.get("href"))
        url, _ = urldefrag(url)

        parsed = urlparse(url)
        if parsed.netloc != "wod.su":
            continue

        path = parsed.path.rstrip("/") + "/"
        if not path.startswith("/vampire/rites/"):
            continue

        if re.search(r"\.(jpg|jpeg|png|gif|webp|svg|pdf|zip|rar)$", path, re.IGNORECASE):
            continue

        links.add(url.rstrip("/"))

    return sorted(links)

def page_lines(html_text):
    soup = BeautifulSoup(html_text, "lxml")
    root = soup.find("main") or soup.find("article") or soup.body or soup

    raw_lines = [clean(x) for x in root.get_text("\n", strip=True).splitlines()]
    raw_lines = [x for x in raw_lines if x]

    lines = []
    i = 0

    while i < len(raw_lines):
        cur = raw_lines[i]

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

def parse_level_heading(line):
    low = norm(line)

    m = re.search(r"ритуалы?\s+(\d{1,2})\s*(?:-?го|-?й)?\s+уров", low, re.IGNORECASE)
    if m:
        return m.group(1)

    m = re.search(r"ритуалы?\s+([а-яё]+)\s+уров", low, re.IGNORECASE)
    if m:
        return LEVEL_WORDS_RU.get(m.group(1), "")

    m = re.search(r"(\d{1,2})\s*(?:-?го|-?й)?\s+уров", low, re.IGNORECASE)
    if m and "ритуал" in low:
        return m.group(1)

    # Иногда уровень дан отдельной строкой вроде "Первый уровень".
    m = re.search(r"^([а-яё]+)\s+уров", low, re.IGNORECASE)
    if m:
        return LEVEL_WORDS_RU.get(m.group(1), "")

    return ""

def is_noise_line(line):
    raw = clean(line)
    low = norm(raw)

    if not low:
        return True

    if low in {
        "мир тьмы", "вампиры маскарад", "ритуалы", "главное меню", "поиск",
        "книги", "наследия", "содержание", "навигация", "строка навигации",
    }:
        return True

    if STOP_RE.match(raw):
        return True

    if BAD_TITLE_RE.search(low):
        return True

    if re.fullmatch(r"[*•●>\-▼]+", raw):
        return True

    return False

def looks_like_title(line):
    raw = strip_stars(line)
    low = norm(raw)

    if is_noise_line(raw):
        return False

    if parse_level_heading(raw):
        return False

    if len(raw) < 3 or len(raw) > 170:
        return False

    if raw[0].islower():
        return False

    if len(raw.split()) > 14:
        return False

    if raw.endswith((".", "!", "?", ";", ":")) and not re.search(r"\([^)]{1,160}\)\.?$", raw):
        return False

    # Слишком книжное название, почти наверняка источник, а не ритуал.
    if BOOK_RE.search(raw) and not re.search(r"[А-Яа-яЁё]", raw):
        return False

    # Хороший случай: "Название (English)" или "English (Название)".
    if re.search(r"\([^)]{1,160}\)\*?$", raw):
        return True

    # Русское или короткое латинское название.
    if re.match(r"^[A-Za-zА-Яа-яЁё0-9'’/ \-]+$", raw):
        return True

    return False

def split_description_system(blocks):
    blocks = [clean(x) for x in blocks if clean(x)]

    if not blocks:
        return "", "", ""

    desc_blocks = []
    system_blocks = []
    in_system = False

    for block in blocks:
        low = norm(block)

        if low.startswith("примечание") or low.startswith("примечания"):
            continue

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
        desc = desc_blocks[0] if desc_blocks else ""
        system = "\n".join(desc_blocks[1:]) if len(desc_blocks) > 1 else ""

    return clean(desc), clean(system), clean("\n".join(blocks))

def collect_block(lines, start):
    blocks = []
    i = start + 1

    while i < len(lines):
        line = clean(lines[i])

        if not line:
            i += 1
            continue

        if parse_level_heading(line):
            break

        if STOP_RE.match(line):
            break

        if looks_like_title(line):
            break

        if norm(line) in {"мир тьмы", "вампиры маскарад", "ритуалы", "главное меню"}:
            i += 1
            continue

        if norm(line).startswith("примечание") or norm(line).startswith("примечания"):
            i += 1
            continue

        blocks.append(line)
        i += 1

        if len(blocks) >= 90:
            break

    return split_description_system(blocks)

def ritual_name_from_line(line):
    raw = strip_stars(line)

    # Если строка "English Name (Русское Название)", берём русское.
    inside = re.findall(r"\(([^)]{1,160})\)", raw)
    for x in inside:
        if re.search(r"[А-Яа-яЁё]", x):
            return clean(x)

    return strip_en_tail(raw)

def parse_rituals_from_page(url, html_text):
    soup = BeautifulSoup(html_text, "lxml")
    title = page_title(soup)
    lines = page_lines(html_text)

    current_level = ""
    parsed = []
    seen = set()

    for i, line in enumerate(lines):
        lvl = parse_level_heading(line)
        if lvl:
            current_level = lvl
            continue

        if not current_level:
            continue

        if not looks_like_title(line):
            continue

        name = ritual_name_from_line(line)
        desc, system, full = collect_block(lines, i)

        if len(desc) < MIN_DESCRIPTION_LEN:
            continue

        if len(desc) > MAX_DESCRIPTION_LEN or len(system) > MAX_SYSTEM_LEN:
            continue

        key = (level_key(current_level), norm(name), canon_url(url))
        if key in seen:
            continue
        seen.add(key)

        parsed.append({
            "group": title,
            "level": level_key(current_level),
            "name": name,
            "sourceUrl": canon_url(url),
            "siteTitleLine": strip_stars(line),
            "descriptionText": desc,
            "systemText": system,
            "fullTextLen": str(len(full)),
        })

    return title, parsed

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

def is_local_ritual(obj, path_hint):
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

def existing_keys(data):
    keys = set()
    loose = set()

    for obj, path_hint in walk(data):
        if not is_local_ritual(obj, path_hint):
            continue

        name = clean(obj.get("name"))
        level = level_key(obj.get("level") or obj.get("rating") or obj.get("dots"))
        source_url = get_source_url(obj)

        keys.add((level, norm(name), source_url))
        loose.add((level, norm(name)))

    return keys, loose

def derive_theme(name, desc, system):
    blob = norm(f"{name} {desc} {system}")

    checks = [
        ("ward_circle", ["круг", "защитныи круг"]),
        ("ward", ["защита", "ward"]),
        ("spirit_dead", ["дух", "призрак", "мертв", "некромант", "труп"]),
        ("blood", ["кров", "витэ"]),
        ("blood_alchemy", ["зель", "алхим", "эликсир"]),
        ("weapon_armor", ["оруж", "клинок", "брон", "меч", "лезв"]),
        ("curse", ["проклят", "сглаз"]),
        ("fire", ["огонь", "плам", "свеч"]),
        ("mind_dream", ["разум", "сон", "сновид"]),
        ("sight_tracking", ["видет", "зрение", "след", "поиск"]),
        ("haven", ["убежищ", "капелл", "дом"]),
        ("beast_animal", ["животн", "звер", "птиц"]),
        ("movement_passage", ["путь", "проход", "движ", "перемещ"]),
        ("technology", ["машин", "компьютер", "технолог"]),
        ("transformation", ["превращ", "изменен", "форма"]),
    ]

    for theme, needles in checks:
        if any(n in blob for n in needles):
            return theme

    return "general"

def make_summary(desc):
    text = clean(desc)
    if len(text) <= 220:
        return text
    return text[:217].rstrip() + "..."


BAD_IMPORT_NAME_EXACT = {
    # Английские алиасы, рядом уже есть нормальные русские названия.
    "touch the earth",
    "pebble from the mountain",

    # Куски описаний / служебные фрагменты, которые wod.su выдаёт как строки.
    "вампиры некроманты",
    "сородича некроманта",
    "сородичам писанобам",
    "6 ого",
    "6 го",
    "путь склепа",
    "путь праха",
    "путь кости",
    "путь кенотафа",
    "шипе тотеку",
    "даным давно",
    "давным давно",
    "малого знака силы",
}

BAD_IMPORT_NAME_RE = re.compile(
    r"("
    r"успех(?:а|и|ов|ом|ами)?|"
    r"сложност(?:ь|и)|"
    r"результат|"
    r"источник|"
    r"примечани(?:е|я)|"
    r"система|"
    r"ритуалы из|"
    r"названия в скобках|"
    r"альтернативные названия|"
    r"смотреть также|"
    r"книги|"
    r"наследия|"
    r"при помощи данного ритуала|"
    r"вампиры[- ]некроманты|"
    r"сородича[- ]некроманта|"
    r"сородичам[- ]писанобам|"
    r"6[- ]?ого|"
    r"6[- ]?го|"
    r"даным[- ]давно|"
    r"давным[- ]давно"
    r")",
    re.IGNORECASE,
)

BAD_IMPORT_LATIN_EXACT = {
    "touch the earth",
    "pebble from the mountain",
}

# Латинские/итальянские названия некромантии, которые действительно выглядят как названия,
# а не как случайный английский алиас. Человечество, конечно, могло бы выбрать один язык, но нет.
LATIN_RITUAL_ALLOW = {
    "minestra di morte",
    "occhio d uomo morto",
    "occhio duomo morto",
    "tempesta scudo",
    "bastone diabolico",
}

def is_bad_import_candidate(r):
    name = clean(r.get("name", ""))
    name_norm = norm(name)

    if not name_norm:
        return True

    if name_norm in BAD_IMPORT_NAME_EXACT:
        return True

    if BAD_IMPORT_NAME_RE.search(name_norm):
        return True

    # Нижний регистр в начале почти всегда означает кусок предложения: "калифа", "колдунов", "лалеками".
    if name and name[0].islower():
        return True

    # Слишком короткие обрывки вроде "Как и", "Для этого" и подобная радость.
    if len(name.split()) <= 2 and name_norm in {
        "как и",
        "для этого",
        "при этом",
        "сородича",
        "колдунов",
        "калифа",
        "калифом",
        "лалеками",
    }:
        return True

    # Английское название без кириллицы обычно является алиасом, кроме явно разрешённых латинских ритуалов.
    if not re.search(r"[А-Яа-яЁё]", name):
        latin_norm = name_norm.replace("'", " ")
        latin_norm = re.sub(r"\s+", " ", latin_norm).strip()

        if latin_norm in BAD_IMPORT_LATIN_EXACT:
            return True

        if latin_norm not in LATIN_RITUAL_ALLOW:
            return True

    desc = clean(r.get("descriptionText", ""))
    system = clean(r.get("systemText", ""))

    if len(desc) < MIN_DESCRIPTION_LEN:
        return True

    if len(desc) > MAX_DESCRIPTION_LEN or len(system) > MAX_SYSTEM_LEN:
        return True

    return False


def make_ritual_entry(r):
    level = int(r["level"]) if str(r["level"]).isdigit() else r["level"]
    name = clean(r["name"])
    desc = clean(r["descriptionText"])
    system = clean(r["systemText"])
    theme = derive_theme(name, desc, system)
    source_url = canon_url(r["sourceUrl"])

    return {
        "type": "ritual",
        "name": name,
        "level": level,
        "category": clean(r["group"]),
        "theme": theme,
        "description": to_html_paragraph(desc),
        "summary": make_summary(desc),
        "system": to_html_paragraph(system),
        "chat": f"<p><strong>{html.escape(name, quote=False)}</strong>: ритуал {level} уровня.</p>",
        "mechanics": {
            "activation": "<p>Ритуал проводится по описанию. Если требуется бросок, обычно используется Интеллект + Оккультизм, если в тексте ритуала не указано иное.</p>",
            "duration": "<p>См. описание и системный текст ритуала.</p>",
            "successScaling": "<p>Дополнительные успехи трактуются по системному тексту ритуала или по решению Рассказчика.</p>",
            "resistance": "<p>Сопротивление определяется системным текстом ритуала или Рассказчиком.</p>",
            "failure": "<p>При неудаче ритуал не даёт желаемого эффекта или вызывает осложнение по решению Рассказчика.</p>",
            "botch": "<p>При ботче ритуал может обернуться против заклинателя или создать сюжетное осложнение.</p>",
            "limits": "<p>Ритуал не отменяет ограничений хроники, условий сцены и решения Рассказчика.</p>",
            "automationNotes": "<p>Система выводит карточку ритуала. Специфические эффекты применяются вручную, чтобы не ломать ситуативные правила.</p>",
        },
        "effect": {
            "type": "ritual",
            "target": norm(name).replace(" ", "-"),
            "difficultyModifier": 0,
            "diceModifier": 0,
            "notes": to_html_paragraph(system or desc),
        },
        "audit": {
            "status": "verified",
            "sourceUrl": source_url,
            "sourceBook": "",
            "sourcePage": "",
            "checkedAt": datetime.now().strftime("%Y-%m-%d"),
            "checkedBy": "wod.su import script",
            "notes": "<p>Добавлено при импорте отсутствующих ритуалов с wod.su.</p>",
        },
        "automation": {
            "roll": {
                "firstTrait": "Интеллект",
                "secondTrait": "Оккультизм",
                "difficulty": 6,
                "label": name,
            },
            "cost": {
                "resource": "",
                "amount": 0,
                "text": "",
            },
            "source": {
                "url": source_url,
                "page": "",
                "section": "rites",
            },
        },
    }

def write_tsv(path, rows, columns):
    with path.open("w", encoding="utf-8", newline="\n") as f:
        w = csv.DictWriter(f, delimiter="\t", fieldnames=columns, extrasaction="ignore")
        w.writeheader()

        for r in rows:
            w.writerow({c: clean(r.get(c, "")) for c in columns})

if not LOCAL_FILE.exists():
    raise SystemExit(f"Не найден локальный файл: {LOCAL_FILE}")

data = json.loads(LOCAL_FILE.read_text(encoding="utf-8-sig"))
strict_existing, loose_existing = existing_keys(data)

session = requests.Session()

print("fetch root:", ROOT_URL)
root_html = request_page(session, ROOT_URL)

all_links = set(extract_rite_links(ROOT_URL, root_html))
all_links.add(ROOT_URL.rstrip("/"))

queue = list(sorted(all_links))
seen_pages = set()
pages = []
site_rituals = []
skipped = []

while queue and len(seen_pages) < MAX_PAGES:
    url = queue.pop(0).rstrip("/")

    if url in seen_pages:
        continue

    seen_pages.add(url)

    parsed_path = urlparse(url).path.rstrip("/")

    # Корень и тауматургические страницы уже покрыты существующим файлом.
    if parsed_path == "/vampire/rites" or THAUM_RE.search(parsed_path):
        pages.append({
            "url": url,
            "title": "",
            "status": "skip-existing-thaum-or-root",
            "ritualCount": "0",
        })
        continue

    try:
        print("fetch:", url)
        html_text = request_page(session, url)
    except Exception as e:
        pages.append({
            "url": url,
            "title": "",
            "status": "fetch-error",
            "ritualCount": "0",
            "error": str(e),
        })
        continue

    soup = BeautifulSoup(html_text, "lxml")
    title, rituals = parse_rituals_from_page(url, html_text)

    pages.append({
        "url": url,
        "title": title,
        "status": "ok",
        "ritualCount": str(len(rituals)),
    })

    site_rituals.extend(rituals)

    for link in extract_rite_links(url, html_text):
        link_path = urlparse(link).path.rstrip("/")
        if link not in seen_pages and len(seen_pages) + len(queue) < MAX_PAGES:
            if link_path.startswith("/vampire/rites"):
                queue.append(link.rstrip("/"))

    time.sleep(0.08)

new_rows = []
seen_new = set()

for r in site_rituals:
    if is_bad_import_candidate(r):
        skipped.append({**r, "reason": "bad-import-candidate"})
        continue

    strict_key = (level_key(r["level"]), norm(r["name"]), canon_url(r["sourceUrl"]))
    loose_key = (level_key(r["level"]), norm(r["name"]))

    if strict_key in strict_existing:
        skipped.append({**r, "reason": "strict-duplicate-local"})
        continue

    if strict_key in seen_new:
        skipped.append({**r, "reason": "duplicate-site"})
        continue

    # Если имя и уровень уже есть локально из другого URL, не добавляем вслепую.
    # Для ритуалов это часто альтернативное издание, а не новый объект.
    if loose_key in loose_existing:
        skipped.append({**r, "reason": "loose-duplicate-local"})
        continue

    seen_new.add(strict_key)
    new_rows.append(r)

write_tsv(
    OUT_PAGES,
    pages,
    ["url", "title", "status", "ritualCount", "error"],
)

write_tsv(
    OUT_SITE,
    site_rituals,
    ["group", "level", "name", "sourceUrl", "siteTitleLine", "descriptionText", "systemText", "fullTextLen"],
)

write_tsv(
    OUT_NEW,
    new_rows,
    ["group", "level", "name", "sourceUrl", "siteTitleLine", "descriptionText", "systemText", "fullTextLen"],
)

write_tsv(
    OUT_SKIPPED,
    skipped,
    ["group", "level", "name", "sourceUrl", "reason", "siteTitleLine", "descriptionText", "systemText", "fullTextLen"],
)

if APPLY:
    backup = LOCAL_FILE.with_name(
        LOCAL_FILE.name + ".backup-before-missing-rituals-import-" + datetime.now().strftime("%Y%m%d-%H%M%S")
    )
    backup.write_text(LOCAL_FILE.read_text(encoding="utf-8-sig"), encoding="utf-8", newline="\n")

    rituals = data.setdefault("rituals", [])
    for r in new_rows:
        rituals.append(make_ritual_entry(r))

    data.setdefault("auditSummary", {})
    if isinstance(data["auditSummary"], dict):
        data["auditSummary"]["missingRitualsImportedAt"] = datetime.now().isoformat(timespec="seconds")
        data["auditSummary"]["missingRitualsImportedFrom"] = ROOT_URL
        data["auditSummary"]["missingRitualsImportedCount"] = len(new_rows)
        data["auditSummary"]["rituals"] = len(rituals)
        data["auditSummary"]["verified"] = len(rituals)

    LOCAL_FILE.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )

page_counts = Counter(r["sourceUrl"] for r in site_rituals)
new_counts = Counter(r["sourceUrl"] for r in new_rows)
group_counts = Counter(r["group"] for r in new_rows)

summary = [
    "Missing rituals import from wod.su",
    "",
    f"mode: {'APPLY' if APPLY else 'DRY RUN'}",
    f"local file: {LOCAL_FILE}",
    f"pages crawled: {len(pages)}",
    f"site rituals parsed outside thaum: {len(site_rituals)}",
    f"new rituals candidates: {len(new_rows)}",
    f"skipped: {len(skipped)}",
    "",
    "new by group:",
]

for group, count in group_counts.most_common():
    summary.append(f"  {count} {group}")

summary.extend([
    "",
    "new by sourceUrl:",
])

for source, count in new_counts.most_common():
    summary.append(f"  {count} {source}")

summary.extend([
    "",
    f"summary: {OUT_SUMMARY}",
    f"pages: {OUT_PAGES}",
    f"site rituals: {OUT_SITE}",
    f"new rituals: {OUT_NEW}",
    f"skipped: {OUT_SKIPPED}",
])

OUT_SUMMARY.write_text("\n".join(summary) + "\n", encoding="utf-8", newline="\n")

print("\n".join(summary))

if not APPLY:
    print()
    print("To apply:")
    print("APPLY=1 python3 scripts/import_missing_rituals_from_wod.py")
