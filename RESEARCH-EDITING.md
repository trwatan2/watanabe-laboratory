# Researchページの追記

Researchページの本文は `data/research-details.json` にまとめてある。
テーマは `carbon`（炭素循環）、`structured`（構造体触媒）、`ereaction`（電化反応）、`sulfur`（格子硫黄触媒）の4つである。

文章・図・成果の数や文章量に上限は設けていない。内容を追加すると掲載領域が下へ広がる。

| 項目 | 掲載内容 |
| --- | --- |
| `overview` | 「研究のねらい」の段落。文章を配列へ追加できる |
| `topics` | 「主な研究項目」。`title`と`text`を追加できる |
| `additional_sections` | 任意の見出しと長文を追加するための枠 |
| `figures` | 写真・模式図・グラフ・動画と説明文を追加するための枠 |
| `results` | 実験結果や研究成果を追加するための枠 |
| `papers` | 関連論文の題名・掲載誌・DOI |

空の配列 `[]` は追記用として確保してあり、未記入の枠はページに表示しない。
追記する場合は、そのテーマ内の配列へ次のように記入する。既に内容がある場合は項目をカンマで区切って追加する。

```json
"additional_sections": [
  {
    "title": "追加したい見出し",
    "paragraphs": ["最初の段落。", "次の段落。"]
  }
],
"figures": [
  {
    "src": "assets/images/example.png",
    "alt": "図の内容を説明する文章",
    "caption": "図の説明。条件・単位・出典などを記載する。"
  }
],
"results": [
  {
    "title": "成果の見出し",
    "paragraphs": ["公開する結果と実験条件を記載する。"]
  }
]
```

図は対応する画像ファイルを先に追加する。動画は `type` を `video` とし、`src`に動画の相対パスを記載する。
本文は通常の文章として入力する。HTMLを記入する必要はない。

変更後にリポジトリで次を実行し、生成された `research.html`、追記データ、追加画像などを合わせて反映する。

```bash
python scripts/update_research.py
```

この処理はトップページからテーマの順番・番号・英語名・見出し・概要・動画を読み込み、Researchへ反映する。
トップページの見出しや動画を変更した際も同じ処理でResearchへ反映できる。Researchの詳しい本文は保持する。
日本語ページが対象である。外国語ページの本文は別途翻訳する。

旧リンク `research.html#electrified` は「03 / e-REACTION PROCESS」へつながる。
