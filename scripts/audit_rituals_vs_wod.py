from __future__ import annotations

from pathlib import Path
from bs4 import BeautifulSoup, Tag, NavigableString
from urllib.parse import urljoin, urlparse, urldefrag
from collections import defaultdict, deque
import csv
import html
import json
import re
import requests
import time
import os

ROOT_URL = "https://wod.su/vampire/rites/"
LOCAL_RITUALS_FILE = Path(os.environ.get("LOCAL_RITUALS_FILE", "data/vtm-revised-rituals.generated.json"))

OUT_SUMMARY = Path("/tmp/rituals_vs_wod_summary.txt")
OUT_PAGES = Path("/tmp/wod_rites_pages.tsv")
OUT_SITE = Path("/tmp/wod_rites_site_rituals.tsv")
OUT_LOCAL = Path("/tmp/local_rituals.tsv")
OUT_PROBLEMS = Path("/tmp/rituals_vs_wod_problems.tsv")

USER_AGENT = "Mozilla/5.0"

MAX_PAGES = 250

STOP_RE = re.compile(
    r"^(источник|источники|перевод|html-верстка|html верстка|главное меню|поиск|обратная связь|"
    r"source|sources|references?|литература|примечани[ея]|см\.?\s*также|copyright|©)\b",
    re.IGNORECASE,
)

PLACEHOLDER_RE = re.compile(
    r"(см\.\s*источник|описание\s+нужно\s+сверить|todo|заглушк|"
    r"добавлен[ао]\s+автоматически|служебн|точный\s+текст\s+сверяется)",
    re.IGNORECASE,
)

IGNORE_HEADING_RE = re.compile(
    r"^(описание|система|источники?|литература|примечани[ея]|см\.?\s*также|"
    r"ритуалы|rites?|ритуал|содержание|главное меню|навигация)$",
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

def strip_en_tail(value):
    value = clean(value)
    value = re.sub(r"\s*\*+\s*$", "", value).strip()
    value = re.sub(r"\s*\([A-Za-z][^)]*\)\s*$", "", value).strip()
    return value

def strip_bullets(value):
    value = clean(value)
    value = re.sub(r"^[•●\*\s]+", "", value).strip()
    value = re.sub(r"\s+\*+\s*$", "", value).strip()
    return value

def norm(value):
    value = strip_en_tail(strip_bullets(value))
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

def tag_text(tag):
    if not tag:
        return ""
    return clean(tag.get_text(" ", strip=True))

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
    return re.sub(r"\s*-\s*World of Darkness.*$", "", title, flags=re.IGNORECASE).strip()

def extract_links(base_url, html_text):
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

def parse_level_from_text(text):
    text = clean(text)

    patterns = [
        r"(?:уровень|ур\.|level)\s*(\d{1,2})",
        r"(\d{1,2})\s*(?:уровень|ур\.|level)",
        r"(?:ритуал|rite)\s*(\d{1,2})",
        r"(\d{1,2})\s*(?:-й|-го)?\s*уров",
    ]

    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            return m.group(1)

    return ""

def dot_count_prefix(text):
    raw = clean(text)
    m = re.match(r"^(?P<dots>(?:[•●]\s*)+)\s*(?P<name>.+?)\s*$", raw)
    if not m:
        return 0, raw
    return len(re.findall(r"[•●]", m.group("dots"))), strip_bullets(m.group("name"))

def trim_inline_name(text):
    text = strip_bullets(clean(text))
    text = re.split(r"\s*(?:[\u2013\u2014-]|:)\s+", text, 1)[0].strip()
    return strip_en_tail(text)

def parse_ritual_heading(text):
    text = clean(text)

    if not text:
        return None, None

    if IGNORE_HEADING_RE.match(norm(text)):
        return None, None

    dots, rest = dot_count_prefix(text)
    if dots:
        return str(dots), trim_inline_name(rest)

    m = re.match(
        r"^(?P<name>.+?)\s*\((?P<meta>[^)]*(?:ритуал|rite|level|уровень|ур\.|\d)[^)]*)\)\s*\.?$",
        text,
        re.IGNORECASE,
    )
    if m:
        level = parse_level_from_text(m.group("meta"))
        if not level:
            nums = re.findall(r"\d{1,2}", m.group("meta"))
            if nums:
                level = nums[-1]
        if level:
            return level, strip_en_tail(strip_bullets(m.group("name")))

    m = re.match(r"^(?:уровень\s*)?(?P<level>\d{1,2})\s*[\.\):·\-]\s*(?P<name>.+?)\s*$", text, re.IGNORECASE)
    if m:
        return m.group("level"), strip_en_tail(strip_bullets(m.group("name")))

    return None, None

def html_block(tag):
    if tag.name in {"ul", "ol"}:
        items = [clean(li.get_text(" ", strip=True)) for li in tag.find_all("li")]
        return " ".join(x for x in items if x)

    if tag.name in {"table", "tbody", "tr"}:
        rows = []
        for tr in tag.find_all("tr"):
            cells = [clean(c.get_text(" ", strip=True)) for c in tr.find_all(["td", "th"])]
            cells = [x for x in cells if x]
            if cells:
                rows.append(" | ".join(cells))
        return " ".join(rows)

    return tag_text(tag)

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

def collect_blocks_after_heading(heading):
    blocks = []
    seen = set()

    def add(raw):
        raw = clean(raw)

        if not raw:
            return False

        raw_norm = norm(raw)

        if not raw_norm:
            return False

        if STOP_RE.match(raw):
            return "stop"

        if re.search(r"\b(источник|sources?|литература|references?|copyright|©|главное меню)\b", raw_norm, re.IGNORECASE):
            return "stop"

        sig = raw_norm[:260]
        if sig in seen:
            return False

        seen.add(sig)
        blocks.append(raw)

        return True

    for el in heading.next_elements:
        if el is heading:
            continue

        if isinstance(el, Tag) and el.name in {"h1", "h2", "h3", "h4", "h5", "h6"}:
            level, name = parse_ritual_heading(tag_text(el))
            if level and name:
                break
            if STOP_RE.match(tag_text(el)):
                break
            continue

        if isinstance(el, NavigableString):
            if el.parent is heading:
                continue
            raw = clean(str(el))
            if len(raw) < 8:
                continue
            res = add(raw)
            if res == "stop":
                break

        elif isinstance(el, Tag):
            if el.name in {"script", "style", "nav", "header", "footer", "aside"}:
                continue
            if el.name in {"h1", "h2", "h3", "h4", "h5", "h6"}:
                continue

            raw = html_block(el)

            if not raw:
                continue

            if el.name in {"div", "section", "article"} and len(raw) > 1800:
                continue

            inner_heading = el.find(["h1", "h2", "h3", "h4", "h5", "h6"])
            if inner_heading and inner_heading is not heading:
                lvl, nm = parse_ritual_heading(tag_text(inner_heading))
                if lvl and nm:
                    continue

            res = add(raw)
            if res == "stop":
                break

        if len(blocks) >= 18:
            break

    return blocks


LEVEL_WORDS_RU = {
    "первого": "1",
    "первый": "1",
    "первом": "1",
    "второго": "2",
    "второй": "2",
    "втором": "2",
    "третьего": "3",
    "третий": "3",
    "третьем": "3",
    "четвертого": "4",
    "четвертый": "4",
    "четвертом": "4",
    "четвёртого": "4",
    "четвёртый": "4",
    "четвёртом": "4",
    "пятого": "5",
    "пятый": "5",
    "пятом": "5",
    "шестого": "6",
    "шестой": "6",
    "шестом": "6",
    "седьмого": "7",
    "седьмой": "7",
    "седьмом": "7",
    "восьмого": "8",
    "восьмой": "8",
    "восьмом": "8",
    "девятого": "9",
    "девятый": "9",
    "девятом": "9",
    "десятого": "10",
    "десятый": "10",
    "десятом": "10",
}

def parse_ritual_level_heading_line(line):
    raw = clean(line)
    low = norm(raw)

    m = re.search(r"ритуалы?\s+(\d{1,2})\s*(?:-?го|-?й)?\s+уров", low, re.IGNORECASE)
    if m:
        return m.group(1)

    m = re.search(r"ритуалы?\s+([а-яё]+)\s+уров", low, re.IGNORECASE)
    if m:
        return LEVEL_WORDS_RU.get(m.group(1), "")

    m = re.search(r"(\d{1,2})\s*(?:-?го|-?й)?\s+уров", low, re.IGNORECASE)
    if m and "ритуал" in low:
        return m.group(1)

    return ""

def infer_default_level_from_url(url, title):
    url = canon_url(url)
    title_low = norm(title)

    m = re.search(r"/thaum([1-5])$", url)
    if m:
        return m.group(1)

    if url.endswith("/thaum"):
        return ""

    if "первого уровня" in title_low:
        return "1"
    if "второго уровня" in title_low:
        return "2"
    if "третьего уровня" in title_low:
        return "3"
    if "четвертого уровня" in title_low or "четвертого уровня" in title_low:
        return "4"
    if "пятого уровня" in title_low:
        return "5"

    return ""


def should_parse_ritual_page(url):
    path = urlparse(canon_url(url)).path.rstrip("/")

    # Эти страницы нужны как индекс ссылок, но не как источник ритуалов.
    # Иначе получаем "Книги" и "Наследия" как ритуалы. Шикарная магия, но нет.
    if path in {
        "/vampire/rites",
        "/vampire/rites/thaum",
    }:
        return False

    return True

def effective_ritual_url(page_url, level):
    page_url = canon_url(page_url)
    level = level_key(level)

    # На wod.su первый уровень тауматургии открыт как /thaum1,
    # но в локальном файле исторически sourceUrl стоит /thaum.
    # Да, прекрасно, теперь URL тоже играют в маскарад.
    if page_url.endswith("/thaum1") and level == "1":
        return "https://wod.su/vampire/rites/thaum"

    if page_url.endswith("/thaum6_10") and level in {"6", "7", "8", "9", "10"}:
        return f"https://wod.su/vampire/rites/thaum{level}"

    return page_url

def clean_ritual_title_line(line):
    raw = clean(line)
    raw = re.sub(r"^[•●\*\-\s]+", "", raw).strip()
    raw = re.sub(r"\s*\*{1,5}\s*$", "", raw).strip()
    raw = re.sub(r"\s+", " ", raw).strip()

    # Убираем точку у некоторых пунктов списка, но не у обычных предложений.
    if re.search(r"\([A-Za-z][^)]{1,120}\)\.?$", raw):
        raw = raw.rstrip(".").strip()

    return raw

def is_noise_line(line):
    low = norm(line)

    if not low:
        return True

    blocked_exact = {
        "мир тьмы",
        "вампиры маскарад",
        "ритуалы",
        "строка навигации",
        "главное меню",
        "поиск",
        "skip to main navigation",
        "все оттенки тьмы",
    }

    if low in blocked_exact:
        return True

    if STOP_RE.match(clean(line)):
        return True

    if low.startswith(("источник", "источники", "перевод", "примечание", "примечания")):
        return True

    if low.startswith(("система", "один успех", "два успеха", "три успеха", "четыре успеха", "пять успехов")):
        return True

    # Табличные результаты, источники и названия книг не являются ритуалами.
    if re.search(r"\b(успех|успехов|сложность|результат)\b", low, re.IGNORECASE):
        return True

    if re.search(r"\b(player|players|guide|clans|dark ages|vampire|masquerade|edition|revised|storyteller)\b", clean(line), re.IGNORECASE):
        return True

    if low in {"книги", "наследия", "смотреть также", "литература"}:
        return True

    if re.match(r"^[>*▼]+$", clean(line)):
        return True

    if re.match(r"^\*+\s*-", clean(line)):
        return True

    return False


BAD_RITUAL_TITLE_RE = re.compile(
    r"("
    r"успех(?:а|и|ов|ом|ами)?|"
    r"сложност(?:ь|и)|результат|"
    r"при помощи данного ритуала|"
    r"вампиры[- ]некроманты|сородича[- ]некроманта|"
    r"путь склепа|путь праха|путь кости|путь кенотафа|"
    r"6-ого|6-го|"
    r"книги|наследия|литература|смотреть также"
    r")",
    re.IGNORECASE,
)

BAD_RITUAL_TITLE_EXACT = {
    "лалек",
    "лалеки",
    "touch the earth",
    "pebble from the mountain",
}

def is_bad_ritual_title(value):
    raw = clean(value)
    low = norm(raw)

    if not low:
        return True

    if low in BAD_RITUAL_TITLE_EXACT:
        return True

    if BAD_RITUAL_TITLE_RE.search(low):
        return True

    # Одиночные родовые/служебные слова из середины описания.
    if low in {
        "книги",
        "наследия",
        "вампиры некроманты",
        "сородича некроманта",
        "при помощи данного ритуала",
        "путь склепа",
    }:
        return True

    # Английские алиасы без кириллицы часто всплывают как отдельный фантом,
    # когда рядом есть нормальная русская строка. Латинские названия некромантии оставляем ниже по allowlist.
    latin_allow = {
        "minestra di morte",
        "occhio d uomo morto",
        "occhio d uomo morto",
        "certamen",
    }

    if not re.search(r"[А-Яа-яЁё]", raw):
        latin_norm = low.replace("'", " ")
        latin_norm = re.sub(r"\s+", " ", latin_norm).strip()
        if latin_norm not in latin_allow:
            return True

    return False


def looks_like_ritual_title(line):
    raw = clean_ritual_title_line(line)
    low = norm(raw)

    if is_noise_line(raw):
        return False

    if is_bad_ritual_title(raw):
        return False

    if parse_ritual_level_heading_line(raw):
        return False

    if len(raw) < 3 or len(raw) > 150:
        return False

    # Обрывки из середины описания часто начинаются с маленькой буквы:
    # "калифа", "лалеками", "колдунов". Это не названия, это парсер опять грызёт стену.
    if raw and raw[0].islower():
        return False

    if re.search(r"\b(успех|успехов|сложность|результат)\b", norm(raw), re.IGNORECASE):
        return False

    if re.search(r"\b(player|players|guide|clans|dark ages|vampire|masquerade|edition|revised|storyteller)\b", raw, re.IGNORECASE):
        return False

    if norm(raw) in {"книги", "наследия", "смотреть также", "литература"}:
        return False

    # Обычные предложения почти всегда заканчиваются точкой.
    # Названия ритуалов обычно нет.
    if raw.endswith((".", "!", "?", ";", ":")) and not re.search(r"\([A-Za-z][^)]{1,120}\)\.?$", raw):
        return False

    # Слишком длинная фраза, скорее всего, текст описания.
    if len(raw.split()) > 12:
        return False

    # Явный хороший случай: название с английским вариантом в скобках.
    if re.search(r"\([A-Za-z][^)]{1,120}\)\*?$", raw):
        return True

    # Латинские и короткие русские названия вроде Certamen, Дар, Доминион.
    if re.match(r"^[A-Za-zА-Яа-яЁё0-9'’/ \-]+$", raw):
        return True

    return False

def title_name_for_match(line):
    raw = clean_ritual_title_line(line)
    return strip_en_tail(raw)

def collect_ritual_blocks_from_lines(lines, start_index):
    blocks = []
    saw_source = False

    i = start_index + 1

    while i < len(lines):
        line = clean(lines[i])

        if not line:
            i += 1
            continue

        if parse_ritual_level_heading_line(line):
            break

        if looks_like_ritual_title(line):
            break

        if STOP_RE.match(line):
            break

        if norm(line).startswith("источник"):
            saw_source = True
            break

        if is_noise_line(line) and not norm(line).startswith("система"):
            i += 1
            continue

        blocks.append(line)
        i += 1

        if len(blocks) >= 40:
            break

    desc, system, full = split_description_system(blocks)

    return desc, system, full, saw_source

def parse_rituals_from_page(url, html_text):
    soup = BeautifulSoup(html_text, "lxml")
    title = page_title(soup)

    if not should_parse_ritual_page(url):
        return title, []

    root = soup.find("main") or soup.find("article") or soup.body or soup

    raw_lines = root.get_text("\n", strip=True).splitlines()
    lines = [clean(x) for x in raw_lines]
    lines = [x for x in lines if x]

    rituals = []
    seen = set()

    default_level = infer_default_level_from_url(url, title)
    current_level = default_level

    for i, line in enumerate(lines):
        level_from_heading = parse_ritual_level_heading_line(line)
        if level_from_heading:
            current_level = level_from_heading
            continue

        if not current_level:
            continue

        if not looks_like_ritual_title(line):
            continue

        name = title_name_for_match(line)

        if not name:
            continue

        desc, system, full, saw_source = collect_ritual_blocks_from_lines(lines, i)

        full_norm = norm(full)
        desc_norm = norm(desc)
        system_norm = norm(system)

        # Верхние легенды списков на wod.su могут идти сразу после "названия".
        # Это не описание конкретного ритуала.
        if (
            "ритуалы из первои или второи редакции" in full_norm
            or "ритуалы из vampire dark ages" in full_norm
            or "названия в скобках" in full_norm
            or "альтернативные названия ритуалов" in full_norm
        ):
            continue

        # Не берём строки, которые очевидно были вырваны из середины описания.
        if name and name[0].islower():
            continue

        if is_bad_ritual_title(name):
            continue

        if norm(name) in {"книги", "наследия", "смотреть также", "литература"}:
            continue

        if re.search(r"\b(успех|успехов|сложность|результат)\b", norm(name), re.IGNORECASE):
            continue

        if re.search(r"\b(player|players|guide|clans|dark ages|vampire|masquerade|edition|revised|storyteller)\b", name, re.IGNORECASE):
            continue

        # Навигационные списки сверху страницы выглядят как названия,
        # но после них нет описания и системы. Их не берём, хватит кормить парсер мусором.
        if not desc and not system:
            continue

        # Если блок совсем короткий и не дошёл до источника, это подозрительно.
        # Но не режем жестко, потому что некоторые ритуалы реально короткие.
        if len(full) < 30 and not saw_source:
            continue

        key = (level_key(current_level), norm(name), canon_url(url))

        if key in seen:
            continue

        seen.add(key)

        rituals.append({
            "pageTitle": title,
            "level": level_key(current_level),
            "name": name,
            "sourceUrl": effective_ritual_url(url, current_level),
            "rawTitle": clean_ritual_title_line(line),
            "descriptionText": desc,
            "systemText": system,
            "fullText": full,
        })

    return title, rituals

def walk(obj, path_hint=""):
    if isinstance(obj, dict):
        yield obj, path_hint
        for k, v in obj.items():
            yield from walk(v, f"{path_hint}/{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from walk(v, f"{path_hint}[{i}]")

def is_local_ritual(obj, path_hint):
    if not isinstance(obj, dict):
        return False

    name = clean(obj.get("name") or obj.get("label") or obj.get("title"))
    level = clean(obj.get("level") or obj.get("rating") or obj.get("dots"))
    type_text = clean(obj.get("type") or obj.get("kind") or obj.get("itemType"))

    if "ritual" in norm(type_text) or "ритуал" in norm(type_text):
        return bool(name)

    if "ritual" in norm(path_hint) or "ритуал" in norm(path_hint):
        return bool(name and level)

    return False

def get_url(obj):
    if clean(obj.get("sourceUrl")):
        return canon_url(obj.get("sourceUrl"))

    audit = obj.get("audit")
    if isinstance(audit, dict) and clean(audit.get("sourceUrl")):
        return canon_url(audit.get("sourceUrl"))

    automation = obj.get("automation")
    if isinstance(automation, dict):
        source = automation.get("source")
        if isinstance(source, dict) and clean(source.get("url")):
            return canon_url(source.get("url"))

    return ""

def local_ritual_row(obj, file_path, path_hint):
    name = strip_en_tail(clean(obj.get("name") or obj.get("label") or obj.get("title")))
    level = level_key(obj.get("level") or obj.get("rating") or obj.get("dots"))
    group = clean(obj.get("group") or obj.get("category") or obj.get("parent") or obj.get("parentDiscipline") or obj.get("path"))

    return {
        "file": str(file_path),
        "pathHint": path_hint,
        "group": group,
        "level": level,
        "name": name,
        "sourceUrl": get_url(obj),
        "descriptionText": strip_html(obj.get("description", "")),
        "systemText": strip_html(obj.get("system", "")),
        "summaryText": strip_html(obj.get("summary", "")),
        "auditStatus": clean((obj.get("audit") or {}).get("status")) if isinstance(obj.get("audit"), dict) else "",
    }

def write_tsv(path, rows, columns):
    with path.open("w", encoding="utf-8", newline="\n") as f:
        w = csv.DictWriter(f, delimiter="\t", fieldnames=columns, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow({c: clean(r.get(c, "")) for c in columns})

def add_problem(rows, severity, code, level, name, url, detail):
    rows.append({
        "severity": severity,
        "code": code,
        "level": level,
        "name": name,
        "sourceUrl": url,
        "detail": detail,
    })

if not LOCAL_RITUALS_FILE.exists():
    raise SystemExit(f"Не найден локальный файл ритуалов: {LOCAL_RITUALS_FILE}")

session = requests.Session()

print("fetch root:", ROOT_URL)
root_html = request_page(session, ROOT_URL)

links = set(extract_links(ROOT_URL, root_html))
links.add(ROOT_URL.rstrip("/"))

queue = deque(sorted(links))
seen_pages = set()
pages = []
site_rituals = []

while queue and len(seen_pages) < MAX_PAGES:
    url = queue.popleft().rstrip("/")

    if url in seen_pages:
        continue

    seen_pages.add(url)

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

    title, rituals = parse_rituals_from_page(url, html_text)

    pages.append({
        "url": url,
        "title": title,
        "status": "ok",
        "ritualCount": str(len(rituals)),
        "error": "",
    })

    site_rituals.extend(rituals)

    for link in extract_links(url, html_text):
        if link not in seen_pages and len(seen_pages) + len(queue) < MAX_PAGES:
            queue.append(link)

    time.sleep(0.08)

local_data = json.loads(LOCAL_RITUALS_FILE.read_text(encoding="utf-8-sig"))

local_rituals = []

for obj, path_hint in walk(local_data):
    if is_local_ritual(obj, path_hint):
        local_rituals.append(local_ritual_row(obj, LOCAL_RITUALS_FILE, path_hint))

site_by_strict = {
    (canon_url(r["sourceUrl"]), level_key(r["level"]), norm(r["name"]))
    for r in site_rituals
}

local_by_strict = {
    (canon_url(r["sourceUrl"]), level_key(r["level"]), norm(r["name"]))
    for r in local_rituals
}

local_by_url_level = defaultdict(list)
for r in local_rituals:
    local_by_url_level[(canon_url(r["sourceUrl"]), level_key(r["level"]))].append(r)

site_url_level_set = {
    (canon_url(r["sourceUrl"]), level_key(r["level"]))
    for r in site_rituals
}

problems = []

for r in site_rituals:
    strict = (canon_url(r["sourceUrl"]), level_key(r["level"]), norm(r["name"]))

    if strict in local_by_strict:
        continue

    same_level = local_by_url_level.get((canon_url(r["sourceUrl"]), level_key(r["level"])), [])

    if same_level:
        add_problem(
            problems,
            "error",
            "ritual_name_mismatch_same_url_level",
            r["level"],
            r["name"],
            r["sourceUrl"],
            "На том же sourceUrl+level есть локальные ритуалы, но с другим именем: " + "; ".join(x["name"] for x in same_level),
        )
    else:
        add_problem(
            problems,
            "error",
            "ritual_missing_local",
            r["level"],
            r["name"],
            r["sourceUrl"],
            "Ритуал есть на wod.su, но не найден локально",
        )

for r in local_rituals:
    strict = (canon_url(r["sourceUrl"]), level_key(r["level"]), norm(r["name"]))

    if not r["sourceUrl"]:
        add_problem(problems, "warning", "local_ritual_missing_source_url", r["level"], r["name"], r["sourceUrl"], "У локального ритуала нет sourceUrl")
        continue

    if strict in site_by_strict:
        text_blob = f'{r["descriptionText"]} {r["systemText"]} {r["summaryText"]}'

        if not r["descriptionText"]:
            add_problem(problems, "warning", "local_ritual_empty_description", r["level"], r["name"], r["sourceUrl"], "Пустое description")

        if not r["systemText"]:
            add_problem(problems, "warning", "local_ritual_empty_system", r["level"], r["name"], r["sourceUrl"], "Пустое system")

        if PLACEHOLDER_RE.search(text_blob):
            add_problem(problems, "warning", "local_ritual_placeholder_text", r["level"], r["name"], r["sourceUrl"], "Описание/system/summary похожи на заглушку")

        continue

    if (canon_url(r["sourceUrl"]), level_key(r["level"])) in site_url_level_set:
        add_problem(
            problems,
            "warning",
            "local_ritual_extra_same_url_level",
            r["level"],
            r["name"],
            r["sourceUrl"],
            "Локальный ритуал имеет тот же sourceUrl+level, но имя не совпадает с сайтом",
        )

write_tsv(OUT_PAGES, pages, ["url", "title", "status", "ritualCount", "error"])
write_tsv(OUT_SITE, site_rituals, ["pageTitle", "level", "name", "sourceUrl", "rawTitle", "descriptionText", "systemText"])
write_tsv(OUT_LOCAL, local_rituals, ["file", "pathHint", "group", "level", "name", "sourceUrl", "auditStatus", "descriptionText", "systemText", "summaryText"])
write_tsv(OUT_PROBLEMS, problems, ["severity", "code", "level", "name", "sourceUrl", "detail"])

errors = [p for p in problems if p["severity"] == "error"]
warnings = [p for p in problems if p["severity"] == "warning"]

summary = [
    "Rituals vs wod.su audit",
    "",
    f"root: {ROOT_URL}",
    f"local file: {LOCAL_RITUALS_FILE}",
    f"pages crawled: {len(pages)}",
    f"site rituals parsed: {len(site_rituals)}",
    f"local rituals parsed: {len(local_rituals)}",
    "",
    f"errors: {len(errors)}",
    f"warnings: {len(warnings)}",
    "",
    f"summary: {OUT_SUMMARY}",
    f"pages: {OUT_PAGES}",
    f"site rituals: {OUT_SITE}",
    f"local rituals: {OUT_LOCAL}",
    f"problems: {OUT_PROBLEMS}",
]

OUT_SUMMARY.write_text("\n".join(summary) + "\n", encoding="utf-8", newline="\n")

print()
print("\n".join(summary))

print()
print("First 80 problems:")
for p in problems[:80]:
    print(f'- {p["severity"]}: {p["code"]}: {p["level"]} · {p["name"]} · {p["sourceUrl"]} :: {p["detail"]}')
