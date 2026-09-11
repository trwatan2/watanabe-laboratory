#!/usr/bin/env python3
"""Sync the Japanese Research page with the homepage, using only Python's stdlib.

The homepage supplies order, labels, titles, summary text and videos.
data/research-details.json supplies longer copy and optional content modules.
Run from any directory: python scripts/update_research.py
"""
import base64
import hashlib
import html
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def plain(value):
    return html.unescape(re.sub(r"<[^>]*>", "", value)).strip()


def escape(value):
    return html.escape(str(value), quote=True)


def paragraphs(items):
    return "\n".join(f"<p>{escape(item)}</p>" for item in items)


def module(title, content, extra=""):
    return f'<div class="detail-module {extra}"><h3>{escape(title)}</h3><div class="detail-module-body">{content}</div></div>'


def extract_asset(match, theme):
    attribute, mime, encoded = match.groups()
    payload = base64.b64decode(encoded, validate=True)
    extension = {"video/mp4": "mp4", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}[mime]
    folder = "videos" if mime.startswith("video/") else "images"
    digest = hashlib.sha256(payload).hexdigest()[:12]
    path = Path("assets") / folder / f"research-{theme}-{digest}.{extension}"
    (ROOT / path).parent.mkdir(parents=True, exist_ok=True)
    (ROOT / path).write_bytes(payload)
    return f'{attribute}="{path.as_posix()}"'


def build():
    homepage = (ROOT / "index.html").read_text()
    details = json.loads((ROOT / "data/research-details.json").read_text())
    page_path = ROOT / "research.html"
    page = page_path.read_text()
    themes = []
    for article in re.findall(r'<article\b[^>]*class="[^"]*research-feature[^"]*"[^>]*>.*?</article>', homepage, re.S):
        target = re.search(r'href="research\.html#([a-z]+)"', article).group(1)
        copy = article.split('<div class="research-copy">', 1)[1]
        number = plain(re.search(r'<span class="research-no">(.*?)</span>', copy, re.S).group(1))
        label = plain(re.search(r'<p class="kicker">(.*?)</p>', copy, re.S).group(1))
        heading = plain(re.search(r'<h3>(.*?)</h3>', copy, re.S).group(1))
        summary = plain(re.search(r'</h3>\s*<p>(.*?)</p>', copy, re.S).group(1))
        video = re.search(r'<video\b.*?</video>', article, re.S).group(0)
        # Reuse the exact homepage bytes, served as cacheable local files.
        video = re.sub(r'(poster|src)="data:([^;]+);base64,([^"]+)"', lambda m: extract_asset(m, target), video)
        video = re.sub(r'preload="[^"]+"', 'preload="metadata"', video)
        video = video.replace('<video ', '<video controls ', 1)
        if 'aria-label=' not in video:
            video = video.replace('<video ', f'<video aria-label="{escape(heading)}" ', 1)
        themes.append(dict(id=target, number=number, label=label, heading=heading, summary=summary, video=video, **details[target]))
    if len(themes) != 4 or {t['id'] for t in themes} != set(details):
        raise ValueError("Homepage themes and research detail entries must match before publishing.")

    navigation = ''.join(f'<a href="#{t["id"]}"><b>{escape(t["number"])}</b><span><strong>{escape(t["nav"])}</strong><small>{escape(t["label"])}</small></span></a>' for t in themes)
    sections = [f'''<section class="page-hero research-hero" id="research-top">
      <p class="eyebrow">WATANABE LABORATORY / RESEARCH</p>
      <h1>Research<br>in motion.</h1>
      <p>材料、構造、反応器、エネルギー供給を横断する4つの研究テーマ。触媒化学と反応工学をつなぎ、分子変換をプロセスへ展開します。</p>
      <nav class="research-jump" aria-label="研究テーマ">{navigation}</nav>
    </section>''']
    for i, t in enumerate(themes):
        theme = t['id']
        classes = 'research-detail'
        if i % 2:
            classes += ' alt'
        if theme == 'sulfur':
            classes = 'research-detail sulfur-detail'
        alias = '<span id="electrified" class="legacy-anchor" aria-hidden="true"></span>' if theme == 'ereaction' else ''
        introduction = f'''<div class="detail-intro">
          <figure class="detail-media"><div class="detail-video">{t['video']}</div><figcaption>{escape(t['caption'])}</figcaption></figure>
          <div class="detail-copy">
            <p class="kicker">{escape(t['number'])} / {escape(t['label'])}</p>
            <h2 id="{theme}-title">{escape(t['heading'])}</h2>
            <p>{escape(t['summary'])}</p>
            <dl class="research-facts"><div><dt>KEYWORDS</dt><dd>{escape(t['keywords'])}</dd></div><div><dt>FOCUS</dt><dd>{escape(t['focus'])}</dd></div></dl>
          </div>
        </div>'''
        topics = ''.join(f'<article class="research-topic"><h4>{escape(x["title"])}</h4><p>{escape(x["text"])}</p></article>' for x in t['topics'])
        body = introduction + module('研究のねらい', paragraphs(t['overview'])) + module('主な研究項目', topics)
        # These modules have no fixed height or item limit; empty modules are hidden.
        body += f'\n<!-- {theme}: additional_sections / figures / results in data/research-details.json -->\n'
        for item in t['additional_sections']:
            body += module(item['title'], paragraphs(item['paragraphs']))
        if t['figures']:
            figures = []
            for item in t['figures']:
                src = item['src']
                if not (ROOT / src).is_file():
                    raise FileNotFoundError(src)
                media = f'<video controls playsinline preload="metadata" src="{escape(src)}" aria-label="{escape(item["alt"])}"></video>' if item.get('type') == 'video' else f'<img src="{escape(src)}" alt="{escape(item["alt"])}" loading="lazy">'
                figures.append(f'<figure class="research-figure">{media}<figcaption>{escape(item["caption"])}</figcaption></figure>')
            body += module('研究図・動画', ''.join(figures))
        if t['results']:
            body += module('研究成果', ''.join(f'<article class="research-topic"><h4>{escape(x["title"])}</h4>{paragraphs(x["paragraphs"])}</article>' for x in t['results']))
        papers = ''.join(f'<li><a href="https://doi.org/{escape(p["doi"])}" target="_blank" rel="noopener noreferrer">{escape(p["title"])} ↗</a><small>{escape(p["journal"])}</small></li>' for p in t['papers'])
        body += module('関連論文', f'<ul class="research-paper-list">{papers}</ul><a class="text-link" href="publications.html">研究室の論文一覧を見る <span aria-hidden="true">↗</span></a>')
        body += '<a class="research-back" href="#research-top">研究テーマ一覧へ ↑</a>'
        sections.append(f'<section class="{classes}" id="{theme}" aria-labelledby="{theme}-title">{alias}{body}</section>')

    outro = re.search(r'<section class="research-outro">.*?</section>', page, re.S).group(0)
    main = '<main>\n' + '\n\n'.join(sections) + '\n\n' + outro + '\n</main>'
    page = re.sub(r'<main>.*?</main>', lambda _: main, page, count=1, flags=re.S)
    css = '<link rel="stylesheet" href="css/research-details.css?v=20260911">'
    if 'css/research-details.css' not in page:
        page = page.replace('</head>', css + '\n</head>')
    page = re.sub(r'<meta name="description" content="[^"]*"\s*/>', '<meta name="description" content="渡部研究室の4つの研究テーマ。炭素循環、構造体触媒、電化反応、格子硫黄触媒の研究内容と関連論文を紹介します。" />', page)
    for lang in ['en','zh','ko','de','fr','es']:
        page = page.replace(f'href="{lang}.html"', f'href="research-{lang}.html"')
    page = page.replace('href="index.html" lang="ja"', 'href="research.html" lang="ja"')
    page_path.write_text(page)
    # The only homepage change is its stale theme count; its media and layout stay intact.
    homepage = homepage.replace('材料、構造、反応器、エネルギー供給を横断する5つの研究テーマ。', '材料、構造、反応器、エネルギー供給を横断する4つの研究テーマ。')
    (ROOT / 'index.html').write_text(homepage)
    print('Updated Research: ' + ', '.join(t['number'] + ' ' + t['id'] for t in themes))


if __name__ == '__main__':
    build()
