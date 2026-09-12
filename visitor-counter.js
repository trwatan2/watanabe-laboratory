(function () {
  'use strict';
  var language = document.documentElement.lang.split('-')[0];
  var copy = {
    ja: { title: 'Global Visitors', site: '研究室HP全体', total: '合計', japan: '日本', international: '海外', countries: '主な国', loading: '読み込み中', pending: '国別集計の更新待ち', unavailable: '取得待ち', checked: '確認', snapshot: '国別集計', stale: '前回の集計値', retry: '再取得待ち', note: '合計は自動更新されます。集計には最大4時間の遅れがあります。' },
    en: { title: 'Global Visitors', site: 'ENTIRE LAB WEBSITE', total: 'Total', japan: 'Japan', international: 'International', countries: 'Top countries', loading: 'Loading', pending: 'Country statistics awaiting update', unavailable: 'Awaiting data', checked: 'Checked', snapshot: 'Country statistics', stale: 'Last recorded total', retry: 'Awaiting refresh', note: 'Totals update automatically. Counts may take up to 4 hours to appear.' },
    de: { title: 'Besucher weltweit', site: 'GESAMTE LABORWEBSITE', total: 'Gesamt', japan: 'Japan', international: 'International', countries: 'Häufigste Länder', loading: 'Wird geladen', pending: 'Länderstatistik wartet auf Aktualisierung', unavailable: 'Daten ausstehend', checked: 'Geprüft', snapshot: 'Länderstatistik', stale: 'Zuletzt erfasste Gesamtzahl', retry: 'Aktualisierung ausstehend', note: 'Die Gesamtzahl wird automatisch aktualisiert. Neue Besuche erscheinen mit bis zu 4 Stunden Verzögerung.' },
    es: { title: 'Visitantes del mundo', site: 'TODO EL SITIO DEL LABORATORIO', total: 'Total', japan: 'Japón', international: 'Internacional', countries: 'Países principales', loading: 'Cargando', pending: 'Estadísticas por país pendientes de actualización', unavailable: 'Datos pendientes', checked: 'Consultado', snapshot: 'Estadísticas por país', stale: 'Último total registrado', retry: 'Actualización pendiente', note: 'El total se actualiza automáticamente. Las visitas pueden tardar hasta 4 horas en aparecer.' },
    fr: { title: 'Visiteurs du monde', site: 'ENSEMBLE DU SITE DU LABORATOIRE', total: 'Total', japan: 'Japon', international: 'International', countries: 'Principaux pays', loading: 'Chargement', pending: 'Statistiques par pays en attente de mise à jour', unavailable: 'Données en attente', checked: 'Vérifié', snapshot: 'Statistiques par pays', stale: 'Dernier total enregistré', retry: 'Actualisation en attente', note: 'Le total est actualisé automatiquement. Les visites peuvent apparaître avec un délai maximal de 4 heures.' },
    ko: { title: '전 세계 방문자', site: '연구실 홈페이지 전체', total: '합계', japan: '일본', international: '해외', countries: '주요 국가', loading: '불러오는 중', pending: '국가별 통계 업데이트 대기 중', unavailable: '데이터 대기 중', checked: '확인', snapshot: '국가별 통계', stale: '이전 집계값', retry: '새로고침 대기 중', note: '합계는 자동으로 갱신됩니다. 방문 기록이 반영되기까지 최대 4시간이 걸릴 수 있습니다.' },
    zh: { title: '全球访客', site: '研究室网站全站', total: '合计', japan: '日本', international: '海外', countries: '主要国家', loading: '加载中', pending: '各国统计等待更新', unavailable: '等待数据', checked: '查询时间', snapshot: '各国统计', stale: '上次统计值', retry: '等待刷新', note: '合计自动更新。新的访问记录最多可能延迟4小时显示。' }
  };
  var text = copy[language] || copy.en;
  var locale = language === 'zh' ? 'zh-CN' : copy[language] ? language : 'en';
  var section = document.getElementById('visitor-counter');
  if (!section) return;
  section.setAttribute('aria-label', text.title);
  function element(tag, className, content, id) {
    var node = document.createElement(tag);
    node.className = className;
    if (content) node.textContent = content;
    if (id) node.id = id;
    return node;
  }
  var strip = element('div', 'gv-strip');
  var title = element('div', 'gv-title', text.title);
  title.appendChild(element('small', '', text.site));
  strip.appendChild(title);
  ['total', 'japan', 'international'].forEach(function (key) {
    var metric = element('div', 'gv-metric', text[key]);
    metric.appendChild(element('b', '', text.loading, 'gv' + key[0].toUpperCase() + key.slice(1)));
    strip.appendChild(metric);
  });
  var country = element('div', 'gv-countries', text.countries + ': ');
  country.appendChild(element('b', '', text.loading, 'gvCountries'));
  strip.appendChild(country);
  var status = element('small', 'gv-status', text.loading, 'gvUpdated');
  status.setAttribute('role', 'status');
  section.replaceChildren(strip, status, element('small', 'gv-note', text.note));

  var current = null;
  var busy = false;
  var lastAttempt = 0;
  var retryTimer;
  function set(id, value) { document.getElementById(id).textContent = value; }
  function formatDate(value) { return new Date(value).toLocaleString(locale, { timeZone: 'Asia/Tokyo' }) + ' JST'; }
  function validNumber(value) { return Number.isSafeInteger(value) && value >= 0; }
  function summary(data) {
    if (data.status !== 'ready' || !Number.isFinite(Date.parse(data.updatedAt))) throw new Error('Invalid summary');
    if (Date.parse(data.updatedAt) > Date.now() + 300000) throw new Error('Future summary');
    ['japan', 'international', 'unknown'].forEach(function (key) {
      if (!validNumber(data[key])) throw new Error('Invalid count');
    });
    if (!Array.isArray(data.topCountries) || data.topCountries.some(function (c) {
      return !c || typeof c.code !== 'string' || !validNumber(c.count);
    })) throw new Error('Invalid countries');
    return data;
  }
  function publicCount(data) {
    // GoatCounter returns a formatted string such as "1,234".
    var value = String(data.count);
    if (!/^(?:\d+|\d{1,3}(?:[,\s\u00a0\u202f]\d{3})+)$/.test(value)) throw new Error('Invalid public count');
    var count = Number(value.replace(/[,\s\u00a0\u202f]/g, ''));
    if (!validNumber(count)) throw new Error('Invalid public count');
    return count;
  }
  async function get(url, validate) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 12000);
    try {
      var response = await fetch(url, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return validate(await response.json());
    } finally { clearTimeout(timer); }
  }
  function render(direct, data, checkedAt) {
    var totalFromSummary = data ? data.japan + data.international + data.unknown : null;
    if (direct === null && data === null) {
      if (!current) ['gvTotal', 'gvJapan', 'gvInternational', 'gvCountries'].forEach(function (id) { set(id, text.unavailable); });
      status.textContent = text.retry + (current ? ' · ' + current.status : '');
      return false;
    }
    // Both sources cover /site-total from the same start date. The public
    // counter can lag a newer authenticated summary by four hours.
    var total = direct === null ? totalFromSummary : data === null ? direct : Math.max(direct, totalFromSummary);
    if (current && total < current.total) {
      status.textContent = text.retry + ' · ' + current.status;
      return false;
    }
    set('gvTotal', total.toLocaleString(locale));
    var fresh = data && Date.now() - Date.parse(data.updatedAt) <= 6 * 3600000;
    if (fresh && totalFromSummary === total) {
      set('gvJapan', data.japan.toLocaleString(locale));
      set('gvInternational', data.international.toLocaleString(locale));
      var names = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames([locale], { type: 'region' }) : null;
      set('gvCountries', data.topCountries.slice(0, 4).map(function (c) {
        var name = c.name || c.code;
        try { if (names) name = names.of(c.code) || name; } catch (_) {}
        return name + ' ' + c.count.toLocaleString(locale);
      }).join(' / ') || '—');
      status.textContent = text.snapshot + ' · ' + formatDate(data.updatedAt);
    } else {
      set('gvJapan', '—'); set('gvInternational', '—'); set('gvCountries', text.pending);
      status.textContent = (direct !== null && total === direct ? text.checked + ' · ' + formatDate(checkedAt)
        : text.stale + ' · ' + formatDate(data.updatedAt));
    }
    current = { total: total, status: status.textContent };
    return true;
  }
  async function refresh() {
    if (busy) return;
    busy = true;
    lastAttempt = Date.now();
    clearTimeout(retryTimer);
    try {
      var stamp = Date.now();
      var directRequest = get('https://watanabe-lab.goatcounter.com/counter/%2Fsite-total.json?start=2026-08-31', publicCount)
        .then(function (count) { if (!current) render(count, null, new Date().toISOString()); return count; });
      var values = await Promise.all([
        directRequest,
        get('visitor-country-stats.json?v=' + stamp, summary),
        get('https://raw.githubusercontent.com/trwatan2/watanabe-laboratory/main/visitor-country-stats.json?v=' + stamp, summary)
      ].map(function (promise) { return promise.catch(function () { return null; }); }));
      var latest = values.slice(1).filter(Boolean).sort(function (a, b) {
        return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
      })[0] || null;
      if (!render(values[0], latest, new Date().toISOString())) retryTimer = setTimeout(refresh, 30000);
    } finally { busy = false; }
  }
  refresh();
  setInterval(function () { if (!document.hidden) refresh(); }, 300000);
  function resume() { if (!document.hidden && Date.now() - lastAttempt > 60000) refresh(); }
  document.addEventListener('visibilitychange', resume);
  window.addEventListener('focus', resume);
})();
