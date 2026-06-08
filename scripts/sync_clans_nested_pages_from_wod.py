#!/usr/bin/env python3
import json
import os
import re
import time
import html as html_lib
import urllib.request
import urllib.parse
from pathlib import Path
from html.parser import HTMLParser
from collections import Counter, defaultdict
from datetime import datetime

ROOT_URL = "https://wod.su/vampire/clans"
LOCAL_FILE = Path("data/vtm-revised-clans.generated.json")
APPLY = os.environ.get("APPLY") == "1"
USER_AGENT = "Mozilla/5.0 (compatible; vtm-revised-foundry-sync/2.0)"

OUT_SUMMARY = Path("/tmp/sync_clans_nested_pages_from_wod_summary.txt")
OUT_PAGES = Path("/tmp/sync_clans_nested_pages_pages.tsv")
OUT_MATCHED = Path("/tmp/sync_clans_nested_pages_matched.tsv")
OUT_UNMATCHED = Path("/tmp/sync_clans_nested_pages_unmatched.tsv")
OUT_CHANGED = Path("/tmp/sync_clans_nested_pages_changed.tsv")

STOP_HEADINGS = {
    "главное меню",
    "поиск",
    "обратная связь",
    "строка навигации",
}

SKIP_LINK_TEXT = {
    "мир тьмы",
    "вампиры: маскарад",
    "кланы",
    "кланы камарильи",
    "кланы шабаша",
    "независимые кланы",
}

EXCLUDE_PATH_TAILS = {
    "camarilla",
    "sabbat",
    "independents",
    "independent",
    "clans",
}

CUSTOM_ALIASES = {
    "малкавианы": "malkavian",
    "гангрелы": "gangrel",
    "горгульи": "gargoyle",
    "каитиффы": "caitiff",
    "каэсиды": "kiasyd",

    "отступники ассамитов": "assamite-antitribu",
    "отступники бруха": "brujah-antitribu",
    "отступники вентру": "ventrue-antitribu",
    "отступники гангрел": "gangrel-antitribu",
    "отступники малкавианы": "malkavian-antitribu",
    "отступники носферату": "nosferatu-antitribu",
    "отступники равнос": "ravnos-antitribu",
    "отступники тореадор": "toreador-antitribu",
    "отступники тремер": "tremere-antitribu",
    "отступники ласомбра": "lasombra-antitribu",

    "змеи света": "serpents-of-light",
    "дети осириса": "children-of-osiris",
    "дочери какофонии": "daughters-of-cacophony",
    "кровавые братья": "blood-brothers",
    "предвестники черепов": "harbingers-of-skulls",
    "последователи сета": "followers-of-set",
}


def clean(value=""):
    text = html_lib.unescape(str(value or "")).replace("\xa0", " ")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def normalize(value=""):
    text = clean(value).lower().replace("ё", "е")
    text = re.sub(r"\([^)]*\)", " ", text)
    text = re.sub(r"[^a-zа-я0-9]+", " ", text, flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", text).strip()


def strip_title_parentheses(value=""):
    return clean(re.sub(r"\s*\([^)]*\)\s*", " ", value))


def split_title_names(title=""):
    title = clean(title)
    result = [title, strip_title_parentheses(title)]
    result.extend(re.findall(r"\(([^)]+)\)", title))
    return [x for x in dict.fromkeys(clean(x) for x in result) if x]


def slug_from_url(url=""):
    path = urllib.parse.urlparse(url).path.strip("/")
    return path.split("/")[-1] if path else ""


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        return response.read().decode(charset, errors="replace")


class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links = []
        self._href_stack = []
        self._text_stack = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() == "a":
            attrs = dict(attrs)
            self._href_stack.append(attrs.get("href", ""))
            self._text_stack.append("")

    def handle_data(self, data):
        if self._text_stack:
            self._text_stack[-1] += data

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href_stack:
            href = self._href_stack.pop()
            text = clean(self._text_stack.pop())
            self.links.append((href, text))


class TextLineParser(HTMLParser):
    BREAK_TAGS = {
        "br", "p", "div", "li", "ul", "ol", "h1", "h2", "h3", "h4",
        "section", "article", "main", "blockquote", "tr", "td"
    }

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self._skip_depth = 0

    def _break(self):
        if self.parts and self.parts[-1] != "\n":
            self.parts.append("\n")

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag in {"script", "style", "noscript", "svg"}:
            self._skip_depth += 1
            return
        if self._skip_depth:
            return
        if tag in self.BREAK_TAGS:
            self._break()

    def handle_data(self, data):
        if self._skip_depth:
            return
        if data:
            self.parts.append(data)

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in {"script", "style", "noscript", "svg"} and self._skip_depth:
            self._skip_depth -= 1
            return
        if self._skip_depth:
            return
        if tag in self.BREAK_TAGS:
            self._break()

    def lines(self):
        raw = "".join(self.parts)
        lines = [clean(line) for line in raw.splitlines()]
        return [line for line in lines if line]


def extract_links(root_html):
    parser = LinkParser()
    parser.feed(root_html)

    urls = []
    seen = set()

    for href, text in parser.links:
        if not href:
            continue

        text_norm = normalize(text)
        if text_norm in SKIP_LINK_TEXT:
            continue

        url = urllib.parse.urljoin(ROOT_URL, href)
        parsed = urllib.parse.urlparse(url)
        if parsed.netloc != "wod.su":
            continue

        path = parsed.path.strip("/")
        parts = path.split("/")

        if len(parts) < 4:
            continue

        # Только страницы /vampire/clans/<section>/<clan>.
        # Касты Ассамитов и вложенные исторические страницы не трогаем.
        if len(parts) > 4:
            continue

        if parts[0] != "vampire" or parts[1] != "clans":
            continue

        tail = parts[-1].lower()
        if tail in EXCLUDE_PATH_TAILS:
            continue

        if "/books" in parsed.path or "/sects" in parsed.path:
            continue

        canon = urllib.parse.urlunparse((parsed.scheme, parsed.netloc, parsed.path.rstrip("/"), "", "", ""))
        if canon in seen:
            continue

        seen.add(canon)
        urls.append({"url": canon, "text": text})

    return urls


def is_noise_line(line, title=""):
    value = clean(line)
    norm = normalize(value)
    title_norm = normalize(title)

    if not norm:
        return True

    if norm in STOP_HEADINGS:
        return True

    if title_norm and norm == title_norm:
        return True

    if norm in {
        "мир тьмы",
        "вампиры маскарад",
        "кланы",
        "кланы камарильи",
        "кланы шабаша",
        "независимые кланы",
        "строка навигации",
    }:
        return True

    if norm.startswith("skip to"):
        return True

    if norm.startswith("vampire the masquerade"):
        return True

    if norm.startswith("image"):
        return True

    if norm.startswith("источник"):
        return True

    if norm.startswith("перевод"):
        return True

    if re.match(r"^\d+\.?$", value):
        return True

    if norm in {
        "секты", "дисциплины", "достоинства и недостатки", "пути просветления",
        "ритуалы", "книги", "общая информация", "переводы", "творчество",
        "персонажи", "география", "о нас", "форум"
    }:
        return True

    return False


def line_to_blocks(line):
    value = clean(line)
    if not value:
        return []

    m = re.match(
        r"^(Прозвище|Секта|Внешность|Убежище|Происхождение|Создание персонажа|"
        r"Клановые Дисциплины|Слабости|Организация|Линии крови|Цитата|История)\s*:\s*(.+)$",
        value,
        re.IGNORECASE,
    )

    if m:
        return [
            {"tag": "h3", "text": clean(m.group(1))},
            {"tag": "p", "text": clean(m.group(2))}
        ]

    if normalize(value) == "стереотипы":
        return [{"tag": "h2", "text": value}]

    return [{"tag": "p", "text": value}]


def extract_blocks(page_html):
    text_parser = TextLineParser()
    text_parser.feed(page_html)
    lines = text_parser.lines()

    # Первый нормальный H1 из HTML через грубый regex, потому что сайт хранит текст как попало.
    title = ""
    m = re.search(r"<h1[^>]*>(.*?)</h1>", page_html, re.IGNORECASE | re.DOTALL)
    if m:
        title = clean(re.sub(r"<[^>]+>", " ", m.group(1)))

    title_norm = normalize(title)

    start_index = 0
    if title_norm:
        for i, line in enumerate(lines):
            if normalize(line) == title_norm:
                start_index = i + 1
                break

    blocks = []
    if title:
        blocks.append({"tag": "h1", "text": title})

    for line in lines[start_index:]:
        norm = normalize(line)

        if norm in {"главное меню", "поиск", "обратная связь"}:
            break

        if is_noise_line(line, title):
            continue

        blocks.extend(line_to_blocks(line))

        if len(blocks) > 220:
            break

    return blocks


def page_title(blocks, fallback=""):
    for block in blocks:
        if block["tag"] == "h1":
            return clean(block["text"])
    return clean(fallback)


def render_html_blocks(blocks):
    out = []

    for block in blocks:
        tag = block["tag"]
        text = clean(block["text"])
        if not text:
            continue

        escaped = html_lib.escape(text)

        if tag in {"h2", "h3", "h4"}:
            out.append(f"<h3>{escaped}</h3>")
        elif tag == "li":
            out.append(f"<p>• {escaped}</p>")
        else:
            out.append(f"<p>{escaped}</p>")

    return "".join(out)


def first_paragraphs_html(blocks, limit=2):
    paragraphs = [b for b in blocks if b["tag"] in {"p", "blockquote"}]
    return render_html_blocks(paragraphs[:limit])


def section_blocks(blocks):
    sections = defaultdict(list)
    current = "overview"

    for block in blocks:
        tag = block["tag"]
        text = clean(block["text"])

        if tag == "h1":
            continue

        if tag in {"h2", "h3", "h4"}:
            current = normalize(text) or "section"
            continue

        sections[current].append(block)

    return sections


def pick_section(sections, patterns):
    for name, blocks in sections.items():
        if any(re.search(pattern, name, re.IGNORECASE) for pattern in patterns):
            return render_html_blocks(blocks)
    return ""


def build_clan_index(clans):
    index = {}

    def add(key, idx):
        key = normalize(key)
        if key:
            index.setdefault(key, idx)

    for idx, clan in enumerate(clans):
        add(clan.get("name"), idx)
        add(clan.get("nameEn"), idx)
        add(clan.get("slug"), idx)
        add(clan.get("rawName"), idx)

        aliases = clan.get("aliases", [])
        if isinstance(aliases, str):
            aliases = re.split(r"[,;]+", aliases)

        for alias in aliases or []:
            add(alias, idx)

    for alias, slug in CUSTOM_ALIASES.items():
        for idx, clan in enumerate(clans):
            if normalize(clan.get("slug")) == normalize(slug):
                add(alias, idx)
                break

    return index


def match_clan(index, title, url):
    candidates = split_title_names(title)
    candidates.append(slug_from_url(url))

    for name in candidates:
        key = normalize(name)
        if key in index:
            return index[key], name

    return None, ""


def update_clan_entry(entry, page, blocks):
    sections = section_blocks(blocks)

    content_blocks = [
        b for b in blocks
        if b["tag"] != "h1"
        and normalize(b["text"]) not in STOP_HEADINGS
    ]

    description = render_html_blocks(content_blocks)
    short = first_paragraphs_html(content_blocks, limit=2)

    weakness = pick_section(sections, [
        r"слаб",
        r"недостат",
        r"проклят",
        r"weakness",
        r"curse",
    ])

    organization = pick_section(sections, [
        r"организац",
        r"структур",
        r"общество",
        r"внутри клана",
        r"organization",
    ])

    opinion = pick_section(sections, [
        r"стереотип",
        r"отношен",
        r"мнение",
        r"видят",
        r"reputation",
        r"stereotype",
    ])

    if description:
        entry["description"] = description
    if short:
        entry["shortDescription"] = short

    if weakness:
        entry["weakness"] = weakness
    if organization:
        entry["organization"] = organization
    if opinion:
        entry["clanOpinion"] = opinion
        entry["stereotypes"] = opinion

    entry["sourceUrl"] = page["url"]
    entry["sourceBook"] = entry.get("sourceBook") or "wod.su"
    entry["sourcePage"] = entry.get("sourcePage") or ""

    audit = entry.get("audit") if isinstance(entry.get("audit"), dict) else {}
    audit.update({
        "status": "synced-from-wod",
        "sourceUrl": page["url"],
        "checkedBy": "sync_clans_nested_pages_from_wod.py",
        "checkedAt": datetime.now().isoformat(timespec="seconds"),
        "notes": "Описание клана обновлено из вложенной страницы wod.su; вложенные страницы каст и исторических вариантов не перетирают основной клан."
    })
    entry["audit"] = audit

    return entry


def write_tsv(path, rows, fields):
    with path.open("w", encoding="utf-8", newline="\n") as f:
        f.write("\t".join(fields) + "\n")
        for row in rows:
            f.write("\t".join(clean(row.get(field, "")) for field in fields) + "\n")


def main():
    if not LOCAL_FILE.exists():
        raise SystemExit(f"Не найден {LOCAL_FILE}")

    data = json.loads(LOCAL_FILE.read_text(encoding="utf-8-sig"))
    clans = data.get("clans", [])
    if not isinstance(clans, list):
        raise SystemExit("В JSON нет массива clans")

    print(f"fetch root: {ROOT_URL}")
    root_html = fetch(ROOT_URL)
    pages = extract_links(root_html)

    index = build_clan_index(clans)
    matched = []
    unmatched = []
    changed = []

    before_by_status = Counter((c.get("audit") or {}).get("status", "") for c in clans)

    for page in pages:
        url = page["url"]
        print(f"fetch: {url}")

        try:
            page_html = fetch(url)
            blocks = extract_blocks(page_html)
            title = page_title(blocks, page["text"])
            idx, matched_by = match_clan(index, title, url)
            desc_len = sum(len(b["text"]) for b in blocks if b["tag"] not in {"h1", "h2", "h3", "h4"})

            page_row = {
                **page,
                "title": title,
                "blocks": len(blocks),
                "descLen": desc_len,
                "matchedIndex": idx,
                "matchedBy": matched_by
            }

            if idx is None:
                unmatched.append(page_row)
                continue

            old = json.dumps(clans[idx], ensure_ascii=False, sort_keys=True)
            clans[idx] = update_clan_entry(clans[idx], page_row, blocks)
            new = json.dumps(clans[idx], ensure_ascii=False, sort_keys=True)

            matched.append({
                **page_row,
                "clanName": clans[idx].get("name", ""),
                "changed": old != new,
            })

            if old != new:
                changed.append({
                    **page_row,
                    "clanName": clans[idx].get("name", ""),
                })

            time.sleep(0.15)

        except Exception as err:
            unmatched.append({
                **page,
                "title": "",
                "blocks": 0,
                "descLen": 0,
                "matchedIndex": None,
                "matchedBy": "",
                "error": str(err)
            })

    data.setdefault("auditSummary", {})
    if isinstance(data["auditSummary"], dict):
        data["auditSummary"]["clanNestedPagesSyncedAt"] = datetime.now().isoformat(timespec="seconds")
        data["auditSummary"]["clanNestedPagesRoot"] = ROOT_URL
        data["auditSummary"]["clanNestedPagesParsed"] = len(pages)
        data["auditSummary"]["clanNestedPagesMatched"] = len(matched)
        data["auditSummary"]["clanNestedPagesChanged"] = len(changed)
        data["auditSummary"]["clanNestedPagesUnmatched"] = len(unmatched)

    if APPLY:
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        backup = LOCAL_FILE.with_suffix(LOCAL_FILE.suffix + f".backup-before-clan-nested-sync-{stamp}")
        backup.write_text(LOCAL_FILE.read_text(encoding="utf-8-sig"), encoding="utf-8", newline="\n")
        LOCAL_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")

    write_tsv(OUT_PAGES, pages, ["url", "text"])
    write_tsv(OUT_MATCHED, matched, ["url", "title", "clanName", "descLen", "blocks", "matchedBy", "changed"])
    write_tsv(OUT_UNMATCHED, unmatched, ["url", "text", "title", "descLen", "blocks", "matchedBy", "error"])
    write_tsv(OUT_CHANGED, changed, ["url", "title", "clanName", "descLen", "blocks", "matchedBy"])

    summary = []
    summary.append("Clan nested pages sync from wod.su")
    summary.append("")
    summary.append(f"mode: {'APPLY' if APPLY else 'DRY RUN'}")
    summary.append(f"local file: {LOCAL_FILE}")
    summary.append(f"root: {ROOT_URL}")
    summary.append(f"local clans: {len(clans)}")
    summary.append(f"pages discovered: {len(pages)}")
    summary.append(f"matched pages: {len(matched)}")
    summary.append(f"changed clans: {len(changed)}")
    summary.append(f"unmatched pages: {len(unmatched)}")
    summary.append("")
    summary.append("audit statuses before:")
    for key, value in before_by_status.most_common():
        summary.append(f"  {value} {key or '(empty)'}")
    summary.append("")
    summary.append(f"pages: {OUT_PAGES}")
    summary.append(f"matched: {OUT_MATCHED}")
    summary.append(f"unmatched: {OUT_UNMATCHED}")
    summary.append(f"changed: {OUT_CHANGED}")

    if not APPLY:
        summary.append("")
        summary.append("To apply:")
        summary.append("APPLY=1 python3 scripts/sync_clans_nested_pages_from_wod.py")

    text = "\n".join(summary)
    OUT_SUMMARY.write_text(text + "\n", encoding="utf-8", newline="\n")
    print()
    print(text)


if __name__ == "__main__":
    main()
