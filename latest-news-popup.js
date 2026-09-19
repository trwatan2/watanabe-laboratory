/* Read the current language's News page so future articles appear automatically. */
(() => {
  'use strict';
  const root = document.getElementById('news-update');
  if (!root || root.dataset.ready) return;
  root.dataset.ready = 'true';
  root.hidden = true;
  const labels = {
    ja: {title: '研究室の最新情報', all: 'News一覧を見る', close: '最新情報を閉じる', open: '最新情報を開く'},
    en: {title: 'Latest from the lab', all: 'View all news', close: 'Close latest news', open: 'Open latest news'},
    zh: {title: '研究室最新动态', all: '查看全部动态', close: '关闭最新动态', open: '打开最新动态'},
    ko: {title: '연구실 최신 소식', all: '모든 소식 보기', close: '최신 소식 닫기', open: '최신 소식 열기'},
    de: {title: 'Neues aus dem Labor', all: 'Alle Meldungen ansehen', close: 'Neuigkeiten schließen', open: 'Neuigkeiten öffnen'},
    fr: {title: 'Actualités du laboratoire', all: 'Voir toutes les actualités', close: 'Fermer les actualités', open: 'Ouvrir les actualités'},
    es: {title: 'Novedades del laboratorio', all: 'Ver todas las noticias', close: 'Cerrar las noticias', open: 'Abrir las noticias'}
  };
  const language = document.documentElement.lang.toLowerCase().split('-')[0];
  const lang = labels[language] ? language : 'ja';
  const ui = labels[lang];
  const newsPage = lang === 'ja' ? 'news.html' : `news-${lang}.html`;
  const storageKey = 'watanabe-lab-dismissed-news-v1';
  const hero = document.querySelector('.hero');
  const nav = document.querySelector('.global-nav');
  let version = '';
  let renderedItems = '';
  let dismissed = '';
  let hasItems = false;
  let manuallyOpened = false;
  let dismissedThisVisit = false;
  let heroVisible = !hero || hero.getBoundingClientRect().bottom > 92;
  try { dismissed = localStorage.getItem(storageKey) || ''; } catch (_) { /* Storage is optional. */ }

  const make = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  };
  const panel = make('aside', 'news-update-panel');
  panel.id = 'news-update-panel';
  panel.setAttribute('aria-labelledby', 'news-update-title');
  const header = make('div', 'news-update-header');
  const heading = make('div');
  const eyebrow = make('p', 'news-update-eyebrow');
  eyebrow.lang = 'en';
  const dot = make('span', 'news-update-dot');
  dot.setAttribute('aria-hidden', 'true');
  eyebrow.append(dot, document.createTextNode('LATEST NEWS'));
  const title = make('h2', 'news-update-title', ui.title);
  title.id = 'news-update-title';
  heading.append(eyebrow, title);
  const close = make('button', 'news-update-close');
  close.type = 'button';
  close.setAttribute('aria-label', ui.close);
  // Static icon only; article content is always inserted with textContent.
  close.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="m3 3 10 10M13 3 3 13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  header.append(heading, close);
  const list = make('ul', 'news-update-list');
  const footer = make('div', 'news-update-footer');
  const all = make('a', 'news-update-all');
  all.href = newsPage;
  const arrow = make('span', '', '→');
  arrow.setAttribute('aria-hidden', 'true');
  all.append(make('span', '', ui.all), arrow);
  footer.append(all);
  panel.append(header, list, footer);
  const launcher = make('button', 'news-update-launcher');
  launcher.type = 'button';
  launcher.setAttribute('aria-label', ui.open);
  launcher.setAttribute('aria-controls', panel.id);
  launcher.append(dot.cloneNode(), make('span', '', 'News'));
  root.append(panel, launcher);

  function renderVisibility() {
    root.hidden = !hasItems || !!nav?.classList.contains('open');
    const automatic = !dismissedThisVisit && dismissed !== version && heroVisible;
    const open = manuallyOpened || automatic;
    panel.hidden = !open;
    launcher.hidden = open;
    launcher.setAttribute('aria-expanded', String(open));
  }
  function dismiss(returnFocus) {
    manuallyOpened = false;
    dismissedThisVisit = true;
    dismissed = version;
    try { localStorage.setItem(storageKey, version); } catch (_) { /* Keep working without storage. */ }
    renderVisibility();
    if (returnFocus && !root.hidden) launcher.focus({preventScroll: true});
  }
  close.addEventListener('click', () => dismiss(true));
  launcher.addEventListener('click', () => {
    manuallyOpened = true;
    renderVisibility();
    close.focus({preventScroll: true});
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || panel.hidden || root.hidden || nav?.classList.contains('open')) return;
    const returnFocus = root.contains(document.activeElement);
    dismiss(returnFocus);
  }, true); // Check the menu before its own Escape handler closes it.
  // Reading an article also acknowledges this set of updates.
  root.addEventListener('click', event => {
    if (event.target.closest('a')) dismiss(false);
  });
  if (hero && 'IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      heroVisible = entries[0].isIntersecting;
      // Never hide the control a keyboard user is currently operating.
      if (!heroVisible && panel.contains(document.activeElement)) manuallyOpened = true;
      renderVisibility();
    }, {rootMargin: '-92px 0px 0px 0px'}).observe(hero);
  }
  if (nav) new MutationObserver(renderVisibility).observe(nav, {attributes: true, attributeFilter: ['class']});

  function extract(documentNode, fallback = false) {
    const selector = fallback ? '.news > article, .news .news-list > a' : '.news-index > article';
    const seen = new Set();
    return [...documentNode.querySelectorAll(selector)].map((article, order) => {
      const time = article.querySelector('time');
      const rawDate = time?.getAttribute('datetime') || time?.textContent || '';
      const match = rawDate.match(/(\d{4})[.\/-](\d{2})[.\/-](\d{2})/);
      const titleNode = article.querySelector('h2, h3, b');
      if (!match || !titleNode) return null;
      const date = `${match[1]}-${match[2]}-${match[3]}`;
      const title = titleNode.textContent.trim().replace(/\s+/g, ' ');
      if (!title) return null;
      const category = article.querySelector('.conference-meta span, .paper-meta span, .award-meta span, .tag')?.textContent.trim() || '';
      const id = article.id;
      const key = `${date}:${id || title}`;
      if (seen.has(key)) return null;
      seen.add(key);
      return {id, date, title, category, order};
    }).filter(Boolean).sort((a, b) => b.date.localeCompare(a.date) || a.order - b.order).slice(0, 3);
  }
  function show(items) {
    if (!items.length) return;
    const signature = JSON.stringify(items);
    if (signature === renderedItems) return;
    renderedItems = signature;
    const nextVersion = items.map(item => `${item.date}:${item.id}`).join('|');
    version = nextVersion;
    list.replaceChildren();
    items.forEach(item => {
      const li = make('li');
      const link = make('a', 'news-update-item');
      link.href = newsPage + (item.id ? `#${encodeURIComponent(item.id)}` : '');
      const meta = make('span', 'news-update-meta');
      const time = make('time', '', item.date.replace(/-/g, '.'));
      time.dateTime = item.date;
      meta.append(time);
      if (item.category) meta.append(make('span', 'news-update-category', item.category));
      link.append(meta, make('span', 'news-update-item-title', item.title));
      li.append(link);
      list.append(li);
    });
    hasItems = true;
    renderVisibility();
  }

  // A local fallback keeps the panel useful offline and when previewing downloaded HTML.
  const fallback = extract(document, true);
  const fallbackTimer = setTimeout(() => show(fallback), 700);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  fetch(newsPage, {cache: 'no-cache', signal: controller.signal})
    .then(response => {
      if (!response.ok) throw new Error('News unavailable');
      return response.text();
    })
    .then(source => {
      const newsDocument = new DOMParser().parseFromString(source, 'text/html');
      const current = extract(newsDocument);
      show(current.length ? current : fallback);
    })
    .catch(() => show(fallback))
    .finally(() => { clearTimeout(fallbackTimer); clearTimeout(timeout); });
})();
