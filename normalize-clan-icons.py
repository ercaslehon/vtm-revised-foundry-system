from pathlib import Path
import re

root = Path("assets/clan-icons")

for f in root.glob("*"):
    if not f.is_file():
        continue

    name = f.stem.lower()

    replacements = {
        "logoclan": "",
        "logobloodline": "",
        "symbolclan": "",
        "tile": "",
        "v5": "",
    }

    for old, new in replacements.items():
        name = name.replace(old, new)

    name = re.sub(r"[^a-z0-9]+", "-", name)
    name = re.sub(r"-+", "-", name)
    name = name.strip("-")

    new_name = root / f"{name}{f.suffix.lower()}"

    if new_name != f:
        print(f"{f.name} -> {new_name.name}")
        f.rename(new_name)
