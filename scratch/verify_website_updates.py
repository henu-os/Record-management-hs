from pathlib import Path

base = Path('g:/Astro/WEBSITE')
target = 'https://drive.google.com/file/d/1sFNloeLWyK4sn6a-jwXYmpdlE8x00CoQ/view?usp=sharing'
index = (base / 'index.html').read_text(encoding='utf-8')
download = (base / 'download.html').read_text(encoding='utf-8')
contact = (base / 'contact.html').read_text(encoding='utf-8')
chatbot = (base / 'js' / 'chatbot.js').read_text(encoding='utf-8')

checks = {
    'index.html': target in index,
    'download.html': target in download,
    'contact.html': 'info.henuos@gmail.com' in contact and '+91 8094100513' in contact and 'sitemap.html' in contact,
    'chatbot.js': 'HENU OS software' in chatbot,
}

for name, ok in checks.items():
    print(f'{name}: {"OK" if ok else "MISSING"}')
    if not ok:
        raise SystemExit(1)

print('All website checks passed.')
