#!/usr/bin/env python3
"""Dağıtım zip dosyasını oluşturur: dist/Proje-Takip-Uygulamasi.zip

Yalnızca izin listesindeki dosyalar eklenir; proje verisi, yedek, test ve
ajan dosyaları asla pakete girmez.
"""
import sys
import zipfile
from pathlib import Path

ROOT_FILES = ["index.html", "start.bat", "serve.py", "README.md", "README.en.md", "LICENSE", "THIRD_PARTY_NOTICES.md", "CHANGELOG.md", "SECURITY.md", "CONTRIBUTING.md"]
ROOT_DIRS = ["vendor", "assets", "docs"]
SKIP_NAMES = {"__pycache__", "Thumbs.db", "desktop.ini"}
SKIP_EXT = {".bak", ".pyc", ".map"}


def collect(root):
    root = Path(root)
    files = []
    for name in ROOT_FILES:
        p = root / name
        if not p.is_file():
            raise FileNotFoundError(f"Gerekli dosya eksik: {name}")
        files.append((p, name))
    for d in ROOT_DIRS:
        base = root / d
        if not base.is_dir():
            continue
        for p in sorted(base.rglob("*")):
            rel = p.relative_to(root)
            if not p.is_file() or p.is_symlink():
                continue
            if any(part.startswith(".") or part in SKIP_NAMES for part in rel.parts):
                continue
            if p.suffix.lower() in SKIP_EXT:
                continue
            files.append((p, rel.as_posix()))
    return files


def build(root, out):
    root, out = Path(root), Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_suffix(".tmp")
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as z:
        for p, arc in collect(root):
            z.write(p, arc)
    tmp.replace(out)
    return out


if __name__ == "__main__":
    # Keep Turkish messages readable in redirected Windows/CI consoles.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")
    root = Path(__file__).resolve().parent.parent
    out = build(root, root / "dist" / "Proje-Takip-Uygulamasi.zip")
    with zipfile.ZipFile(out) as z:
        for i in z.infolist():
            print(f"{i.file_size:>9}  {i.filename}")
    print("Oluşturuldu:", out)
