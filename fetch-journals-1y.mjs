import {
  mkdir,
  writeFile,
} from 'node:fs/promises'

// ============================================
// ChemTree 1-Year Journal Fetcher
//
// JACS / Nature / Science / Chem
// 実行日から過去365日を自動取得
// ============================================

const JOURNALS = [
  {
    id: 'jacs',
    shortName: 'JACS',
    name:
      'Journal of the American Chemical Society',
    issn: '0002-7863',
  },

  {
    id: 'nature',
    shortName: 'Nature',
    name: 'Nature',
    issn: '1476-4687',
  },

  {
    id: 'science',
    shortName: 'Science',
    name: 'Science',
    issn: '0036-8075',
  },

  {
    id: 'chem',
    shortName: 'Chem',
    name: 'Chem',
    issn: '2451-9294',
  },
]

// 1回のCrossref取得件数
const ROWS = 500


function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithRetry(url, attempt = 1) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'ChemTree/1.2 (GitHub Pages automatic literature updater)',
      'Accept': 'application/json',
    },
  })

  if (response.ok) return response

  if ((response.status === 429 || response.status >= 500) && attempt <= 5) {
    const retryAfter = Number(response.headers.get('retry-after'))
    const wait = Number.isFinite(retryAfter) && retryAfter > 0
      ? Math.min(30000, retryAfter * 1000)
      : Math.min(30000, 1000 * 2 ** (attempt - 1))

    console.log(`Crossref ${response.status}. ${Math.round(wait / 1000)}秒待って再試行します...`)
    await sleep(wait)
    return fetchWithRetry(url, attempt + 1)
  }

  throw new Error(`Crossref取得失敗 ${response.status}: ${url}`)
}

// ============================================
// 日付
// ============================================

function formatDate(date) {
  return date
    .toISOString()
    .slice(0, 10)
}

function getJapanToday() {
  const parts =
    new Intl.DateTimeFormat(
      'en-CA',
      {
        timeZone:
          'Asia/Tokyo',

        year:
          'numeric',

        month:
          '2-digit',

        day:
          '2-digit',
      },
    ).formatToParts(
      new Date(),
    )

  const values =
    Object.fromEntries(
      parts
        .filter(
          (part) =>
            part.type !==
            'literal',
        )
        .map(
          (part) => [
            part.type,
            part.value,
          ],
        ),
    )

  return (
    values.year +
    '-' +
    values.month +
    '-' +
    values.day
  )
}

function getDateRange() {
  // 日本時間の「今日」
  const end =
    getJapanToday()

  const [
    year,
    month,
    day,
  ] =
    end
      .split('-')
      .map(Number)

  // 日付計算そのものはUTC上で行い、
  // PCのローカル時刻によるズレを防ぐ
  const startDate =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day,
      ),
    )

  startDate.setUTCDate(
    startDate.getUTCDate() -
      365,
  )

  return {
    start:
      formatDate(
        startDate,
      ),

    end,
  }
}

function getPaperDate(item) {
  const candidates = [
    item.published,
    item['published-online'],
    item['published-print'],
    item.issued,
    item.created,
  ]

  for (
    const candidate of
      candidates
  ) {
    const parts =
      candidate?.[
        'date-parts'
      ]?.[0]

    if (
      !parts ||
      parts.length === 0
    ) {
      continue
    }

    const [
      year,
      month = 1,
      day = 1,
    ] = parts

    return [
      year,
      String(month)
        .padStart(
          2,
          '0',
        ),

      String(day)
        .padStart(
          2,
          '0',
        ),
    ].join('-')
  }

  return ''
}

// ============================================
// 文字処理
// ============================================

function cleanText(
  text = '',
) {
  return String(text)
    .replace(
      /<[^>]*>/g,
      ' ',
    )
    .replace(
      /&nbsp;/g,
      ' ',
    )
    .replace(
      /&amp;/g,
      '&',
    )
    .replace(
      /&lt;/g,
      '<',
    )
    .replace(
      /&gt;/g,
      '>',
    )
    .replace(
      /\s+/g,
      ' ',
    )
    .trim()
}

function normalizeDoi(
  doi = '',
) {
  return String(doi)
    .toLowerCase()
    .replace(
      /^https?:\/\/(dx\.)?doi\.org\//,
      '',
    )
    .trim()
}

function getAuthors(item) {
  return (
    item.author ?? []
  )
    .map(
      (author) =>
        [
          author.given,
          author.family,
        ]
          .filter(Boolean)
          .join(' '),
    )
    .filter(Boolean)
}

// ============================================
// Crossrefの1件をChemTree形式へ変換
// ============================================

function convertPaper(
  item,
  journal,
) {
  const doi =
    normalizeDoi(
      item.DOI ?? '',
    )

  return {
    journalId:
      journal.id,

    journal:
      journal.shortName,

    fullJournal:
      item[
        'container-title'
      ]?.[0] ??
      journal.name,

    issn:
      journal.issn,

    doi,

    title:
      cleanText(
        item.title?.[0] ??
          '',
      ),

    abstract:
      cleanText(
        item.abstract ??
          '',
      ),

    published:
      getPaperDate(
        item,
      ),

    volume:
      item.volume ?? '',

    issue:
      item.issue ?? '',

    page:
      item.page ?? '',

    articleNumber:
      item[
        'article-number'
      ] ?? '',

    authors:
      getAuthors(item),

    publisher:
      item.publisher ??
      '',

    type:
      item.type ?? '',

    subjects:
      item.subject ?? [],

    citations:
      item[
        'is-referenced-by-count'
      ] ?? 0,

    url:
      item.URL ??
      (
        doi
          ? `https://doi.org/${doi}`
          : ''
      ),
  }
}

// ============================================
// 重複除去
// ============================================

function deduplicate(
  papers,
) {
  const map =
    new Map()

  for (
    const paper of
      papers
  ) {
    const key =
      paper.doi ||
      `${paper.journal}:${paper.title}`

    if (
      !map.has(key)
    ) {
      map.set(
        key,
        paper,
      )
    }
  }

  return [
    ...map.values(),
  ]
}

// ============================================
// 新しい順
// ============================================

function sortNewest(
  papers,
) {
  return [
    ...papers,
  ].sort(
    (a, b) =>
      String(
        b.published,
      ).localeCompare(
        String(
          a.published,
        ),
      ),
  )
}

// ============================================
// 1誌をカーソル方式で全件取得
// ============================================

async function fetchJournal(
  journal,
  startDate,
  endDate,
) {
  console.log('')
  console.log(
    '-------------------------------------',
  )

  console.log(
    `${journal.shortName}`,
  )

  console.log(
    `${startDate} ～ ${endDate}`,
  )

  console.log(
    '-------------------------------------',
  )

  const allPapers = []

  let cursor = '*'
  let page = 1

  while (true) {
    const params =
      new URLSearchParams({
        filter: [
          `from-pub-date:${startDate}`,
          `until-pub-date:${endDate}`,
          'type:journal-article',
        ].join(','),

        rows:
          String(ROWS),

        cursor,
      })

    const url =
      `https://api.crossref.org/journals/` +
      `${journal.issn}/works?` +
      params.toString()

    console.log(
      `取得中... page ${page}`,
    )

    const response =
      await fetchWithRetry(
        url,
      )

    const data =
      await response.json()

    const items =
      data?.message
        ?.items ?? []

    if (
      items.length === 0
    ) {
      break
    }

    for (
      const item of items
    ) {
      const paper =
        convertPaper(
          item,
          journal,
        )

      if (
        paper.title
      ) {
        allPapers.push(
          paper,
        )
      }
    }

    console.log(
      `現在 ${allPapers.length} 報`,
    )

    // 最終ページ
    if (
      items.length <
      ROWS
    ) {
      break
    }

    const nextCursor =
      data?.message?.[
        'next-cursor'
      ]

    if (
      !nextCursor ||
      nextCursor ===
        cursor
    ) {
      break
    }

    cursor =
      nextCursor

    page++

    // Crossrefへの負荷軽減
    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          400,
        ),
    )
  }

  const papers =
    sortNewest(
      deduplicate(
        allPapers,
      ),
    )

  console.log('')
  console.log(
    `${journal.shortName}: 合計 ${papers.length} 報`,
  )

  return papers
}

// ============================================
// 1誌ずつ保存
// ============================================

async function saveJournal(
  journal,
  papers,
  startDate,
  endDate,
) {
  const output = {
    journal:
      journal.name,

    shortName:
      journal.shortName,

    journalId:
      journal.id,

    issn:
      journal.issn,

    period: {
      start:
        startDate,

      end:
        endDate,

      days: 365,
    },

    fetchedAt:
      new Date()
        .toISOString(),

    count:
      papers.length,

    papers,
  }

  const path =
    `public/data/` +
    `${journal.id}-1y.json`

  await writeFile(
    path,

    JSON.stringify(
      output,
      null,
      2,
    ),

    'utf8',
  )

  console.log(
    `保存: ${path}`,
  )
}

// ============================================
// メイン
// ============================================

async function main() {
  const {
    start,
    end,
  } =
    getDateRange()

  console.log('')
  console.log(
    '=====================================',
  )

  console.log(
    ' ChemTree 1-Year Journal Fetcher',
  )

  console.log(
    '=====================================',
  )

  console.log('')
  console.log(
    `取得期間: ${start} ～ ${end}`,
  )

  console.log(
    '直近365日を自動取得します。',
  )

  await mkdir(
    'public/data',
    {
      recursive: true,
    },
  )

  const allPapers = []
  const summary = []

  for (
    const journal of
      JOURNALS
  ) {
    try {
      const papers =
        await fetchJournal(
          journal,
          start,
          end,
        )

      await saveJournal(
        journal,
        papers,
        start,
        end,
      )

      allPapers.push(
        ...papers,
      )

      summary.push({
        id:
          journal.id,

        name:
          journal.name,

        shortName:
          journal.shortName,

        issn:
          journal.issn,

        count:
          papers.length,

        status: 'ok',
      })
    } catch (error) {
      console.error('')
      console.error(
        `${journal.shortName} の取得に失敗しました。`,
      )

      console.error(
        error.message,
      )

      summary.push({
        id:
          journal.id,

        name:
          journal.name,

        shortName:
          journal.shortName,

        issn:
          journal.issn,

        count: 0,

        status: 'error',

        error:
          error.message,
      })
    }

    // 次の雑誌まで少し待つ
    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          700,
        ),
    )
  }

  const uniquePapers =
    sortNewest(
      deduplicate(
        allPapers,
      ),
    )

  const combined = {
    generatedAt:
      new Date()
        .toISOString(),

    source:
      'Crossref',

    period: {
      start,
      end,
      days: 365,
    },

    journals:
      summary,

    totalPapers:
      uniquePapers.length,

    papers:
      uniquePapers,
  }

  await writeFile(
    'public/data/journals-1y.json',

    JSON.stringify(
      combined,
      null,
      2,
    ),

    'utf8',
  )

  console.log('')
  console.log(
    '=====================================',
  )

  console.log(
    ' 1年間の取得完了',
  )

  console.log(
    '=====================================',
  )

  console.log('')

  for (
    const journal of
      summary
  ) {
    console.log(
      `${journal.shortName.padEnd(
        10,
      )}: ${journal.count} 報`,
    )
  }

  console.log('')
  console.log(
    `総論文数: ${uniquePapers.length} 報`,
  )

  console.log('')
  console.log(
    '保存先:',
  )

  console.log(
    'public/data/journals-1y.json',
  )

  console.log('')
  console.log(
    'このファイルは実行するたびに',
  )

  console.log(
    '「その日から過去365日」に自動更新されます。',
  )

  console.log('')
}

main().catch(
  (error) => {
    console.error('')
    console.error(
      '予期しないエラーが発生しました。',
    )

    console.error(
      error,
    )

    process.exit(1)
  },
)