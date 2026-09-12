# Website translations

The current Japanese pages in this repository are the source for all 60 foreign-language pages (10 pages × English, Chinese, Korean, German, French and Spanish).

`build_full_languages.py` reads the current root HTML files. It never uses a separate, older source directory. It preserves every main-content element, text node, image, video, research topic, member, news item and DOI link. Embedded media are shared as byte-identical assets to avoid duplicating large files across languages. Links within the lab website retain the chosen language; Playground applications retain their existing destinations.

The original translation dictionaries are in `source-text.json`, the six language `.txt` files, and `ui.json`. New or changed source text is translated in `translations-current.json`, keyed by its exact source text, with a value for every language. Names and the original titles of Japanese publications remain identifiable in their original scripts.

After editing Japanese content, add complete translations for new or changed text, then run:

```bash
python -m pip install lxml==6.1.1
python build_full_languages.py
python build_full_languages.py --check
```

Commit the Japanese changes, dictionaries, generated foreign pages and any new assets together. The check command fails on missing translations, missing media, differences in content structure, or generated pages that no longer match current Japanese sources. It also runs in GitHub Actions. This detects drift; it does not translate new prose automatically or modify GitHub Pages deployment settings.

Every translated page records the SHA-256 of its Japanese source in `translation-source-sha256` metadata. `validation.json` records per-page counts and source hashes.
