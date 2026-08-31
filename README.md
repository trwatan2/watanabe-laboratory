# Watanabe Laboratory Website

GitHub Pages用の静的サイト第1版です。

## ファイル
- `index.html` — トップページ
- `research.html` — Researchページの骨格
- `css/style.css` — 全体デザイン
- `js/main.js` — メニュー、スクロール表示、動画のフォールバック
- `assets/videos/` — 研究動画の保存場所
- `assets/images/` — 写真・図の保存場所

## 動画の差し替え
以下のファイル名でMP4を配置すると、トップページの仮表示が自動的に動画へ切り替わります。

- `assets/videos/electrified-catalysis.mp4`
- `assets/videos/carbon-circulation.mp4`
- `assets/videos/structured-catalyst.mp4`

短い無音ループ動画を推奨します。長い動画はYouTube等の埋め込みへ変更できます。

## GitHub Pages
1. GitHubで新規repositoryを作成
2. このフォルダ内のファイルをアップロード
3. Settings → Pages
4. Deploy from a branch
5. Branch: `main` / Folder: `/ (root)`
6. Save

## 次に入れるもの
- 所属表記
- 研究室住所・連絡先
- 教員・学生写真
- Researchの実動画
- Publications
- News
- 日英切り替え

## Research v3
Research is organized into five major themes:
1. Electrified Catalysis
2. Carbon Conversion & Solid Carbon Fixation
3. Structured & Spiral Catalysts
4. e-Reaction Process
5. Lattice Sulfur Catalysis

The lattice-sulfur section currently uses an HTML/CSS animated concept visual and can later be replaced or supplemented with experimental video or a reaction-scheme animation.
