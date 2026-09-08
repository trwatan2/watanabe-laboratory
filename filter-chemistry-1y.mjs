import {
  readFile,
  writeFile,
  mkdir,
} from 'node:fs/promises'

const INPUT =
  'public/data/journals-1y.json'

const OUTPUT =
  'public/data/journals-chemistry-1y.json'

const CACHE_FILE =
  'public/data/openalex-filter-cache-1y.json'

// OpenAlexへ一度に問い合わせるDOI数
// URLが長くなりすぎないよう25件
const BATCH_SIZE = 25

// ============================================
// 除外ルール
// ============================================

const EXCLUDE_TITLE_PATTERNS = [
  'obituary',
  'books in brief',
  'briefing chat',
  'career',
  'careers',
  'jobs',
  'employers',
  'podcast',
  'news in brief',
  'news feature',
  'world view',
  'editorial',
  'correction',
  'publisher correction',
  'author correction',
  'retraction',
  'research highlight',
  'seven days',
  'nature briefing',
  'letters to the editor',
  'book review',
  'news & views',
]

// Natureの d41586 系は
// ニュース・解説記事が中心なので除外
function isNatureNewsDoi(paper) {
  return (
    paper.journalId === 'nature' &&
    normalizeDoi(
      paper.doi,
    ).startsWith(
      '10.1038/d41586-',
    )
  )
}

// OpenAlex Primary Field
// 完全一致したとき採用
const ACCEPT_FIELDS = [
  'chemistry',
  'materials science',
  'chemical engineering',
]

// タイトルにあれば
// 化学研究の強い証拠
const STRONG_CHEMISTRY_TERMS = [
  'catalyst',
  'catalysis',
  'catalytic',
  'electrocatal',
  'photocatal',

  'synthesis',
  'synthetic',
  'cyclopropanation',
  'borylation',
  'cross-coupling',
  'cross coupling',

  'organometallic',
  'coordination complex',
  'molecular catalyst',

  'metal-organic framework',
  'metal organic framework',
  'mof',
  'zeolitic imidazolate framework',

  'polymer',
  'polymerization',

  'nanoparticle',
  'nanomaterial',

  'perovskite',
  'ferroelectric',
  'semiconductor',

  'battery',
  'electrolyte',
  'electrode',
  'cathode',
  'anode',

  'spectroscopy',
  'nmr',
  'raman',
  'infrared',
  'x-ray absorption',
  'xafs',
  'xps',
  'mass spectrometry',

  'electrochemistry',
  'electrochemical',

  'carbon dioxide',
  'co2',
  'hydrogen evolution',
  'oxygen reduction',
  'oxygen evolution',
  'ammonia synthesis',
]

// Chemical Biologyとして
// 例外的に残すための強い語
const CHEMICAL_BIOLOGY_TITLE_TERMS = [
  'chemically modified',
  'chemical modification',
  'chemical probe',
  'molecular probe',
  'covalent labeling',
  'covalent modification',
  'bioconjugation',
  'bioorthogonal',
  'protein modification',
  'peptide synthesis',
  'peptide scaffold',
  'enzyme engineering',
  'biocatalysis',
  'biosynthesis',
  'natural product',
]

const CHEMICAL_BIOLOGY_TOPIC_TERMS = [
  'chemical biology',
  'bioconjugation',
  'bioorthogonal chemistry',
  'protein modification',
  'peptide chemistry',
  'enzyme engineering',
  'biocatalysis',
  'natural product chemistry',
  'biosynthesis',
]

// 明らかに生命科学主体
const BIOLOGY_ONLY_TERMS = [
  'zebrafish',
  'neuron',
  'neural circuit',
  'brain',
  'heart',
  'cardiac',
  'hybrid sterility',
  'plant immunity',
  'genetic conflict',
  'developmental biology',
  'ecology',
  'population genetics',
]

// ============================================
// 基本処理
// ============================================

function normalize(text = '') {
  return String(text)
    .toLowerCase()
    .replace(/<[^>]*>/g, ' ')
    .replace(/[₂]/g, '2')
    .replace(/[₃]/g, '3')
    .replace(/[–—−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeDoi(doi = '') {
  return String(doi)
    .toLowerCase()
    .replace(
      /^https?:\/\/(dx\.)?doi\.org\//,
      '',
    )
    .trim()
}

function containsAny(
  text,
  terms,
) {
  const target =
    normalize(text)

  return terms.some(
    (term) =>
      target.includes(
        normalize(term),
      ),
  )
}

function matchingTerms(
  text,
  terms,
) {
  const target =
    normalize(text)

  return terms.filter(
    (term) =>
      target.includes(
        normalize(term),
      ),
  )
}

function chunks(
  array,
  size,
) {
  const result = []

  for (
    let i = 0;
    i < array.length;
    i += size
  ) {
    result.push(
      array.slice(
        i,
        i + size,
      ),
    )
  }

  return result
}

function sleep(ms) {
  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        ms,
      ),
  )
}

// ============================================
// JSONがあれば読む
// ============================================

async function readJsonIfExists(
  path,
  fallback,
) {
  try {
    const raw =
      await readFile(
        path,
        'utf8',
      )

    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

// ============================================
// OpenAlex
// ============================================

function compactOpenAlex(work) {
  return {
    id:
      work?.id ?? '',

    doi:
      normalizeDoi(
        work?.doi ?? '',
      ),

    type:
      work?.type ?? '',

    primaryTopic:
      work
        ?.primary_topic
        ?.display_name ?? '',

    primarySubfield:
      work
        ?.primary_topic
        ?.subfield
        ?.display_name ?? '',

    primaryField:
      work
        ?.primary_topic
        ?.field
        ?.display_name ?? '',

    topics:
      (
        work?.topics ?? []
      ).map(
        (topic) => ({
          name:
            topic
              ?.display_name ??
            '',

          subfield:
            topic
              ?.subfield
              ?.display_name ??
            '',

          field:
            topic
              ?.field
              ?.display_name ??
            '',

          domain:
            topic
              ?.domain
              ?.display_name ??
            '',
        }),
      ),

    keywords:
      (
        work?.keywords ?? []
      ).map(
        (keyword) =>
          keyword
            ?.display_name ??
          '',
      ),
  }
}

function buildOpenAlexText(work) {
  if (!work) {
    return ''
  }

  const parts = [
    work.primaryTopic ??
      '',

    work.primarySubfield ??
      '',

    work.primaryField ??
      '',
  ]

  for (
    const topic of
      work.topics ?? []
  ) {
    parts.push(
      topic.name ?? '',
    )

    parts.push(
      topic.subfield ?? '',
    )

    parts.push(
      topic.field ?? '',
    )

    parts.push(
      topic.domain ?? '',
    )
  }

  for (
    const keyword of
      work.keywords ?? []
  ) {
    parts.push(keyword)
  }

  return normalize(
    parts.join(' '),
  )
}

// 429や一時的なエラー時に再試行
async function fetchWithRetry(
  url,
  attempt = 1,
) {
  const response =
    await fetch(
      url,
      {
        headers: {
          'User-Agent':
            'ChemTree/1.0',
        },
      },
    )

  if (
    response.ok
  ) {
    return response
  }

  if (
    (
      response.status ===
        429 ||
      response.status >=
        500
    ) &&
    attempt <= 5
  ) {
    const wait =
      Math.min(
        15000,
        1000 *
          2 ** (
            attempt - 1
          ),
      )

    console.log(
      `OpenAlex ${response.status}。${wait / 1000}秒待って再試行します...`,
    )

    await sleep(wait)

    return fetchWithRetry(
      url,
      attempt + 1,
    )
  }

  throw new Error(
    `OpenAlex取得失敗: ${response.status}`,
  )
}

async function fetchOpenAlexMissing(
  papers,
) {
  console.log('')
  console.log(
    'OpenAlexキャッシュを確認しています...',
  )

  const cache =
    await readJsonIfExists(
      CACHE_FILE,
      {},
    )

  const cacheMap =
    new Map(
      Object.entries(
        cache,
      ),
    )

  const candidates =
    papers.filter(
      (paper) =>
        paper.doi,
    )

  const missing =
    candidates.filter(
      (paper) =>
        !cacheMap.has(
          normalizeDoi(
            paper.doi,
          ),
        ),
    )

  console.log(
    `判定対象: ${candidates.length} 報`,
  )

  console.log(
    `キャッシュ済み: ${
      candidates.length -
      missing.length
    } 報`,
  )

  console.log(
    `今回OpenAlex取得: ${missing.length} 報`,
  )

  if (
    missing.length === 0
  ) {
    return cacheMap
  }

  const batches =
    chunks(
      missing,
      BATCH_SIZE,
    )

  let completed = 0

  for (
    let index = 0;
    index <
      batches.length;
    index++
  ) {
    const batch =
      batches[index]

    const doiFilter =
      batch
        .map(
          (paper) =>
            `https://doi.org/${normalizeDoi(
              paper.doi,
            )}`,
        )
        .join('|')

    const params =
      new URLSearchParams({
        filter:
          `doi:${doiFilter}`,

        per_page: '100',

        select: [
          'id',
          'doi',
          'type',
          'primary_topic',
          'topics',
          'keywords',
        ].join(','),
      })

    const url =
      `https://api.openalex.org/works?` +
      params.toString()

    const response =
      await fetchWithRetry(
        url,
      )

    const data =
      await response.json()

    for (
      const work of
        data.results ?? []
    ) {
      if (!work.doi) {
        continue
      }

      cacheMap.set(
        normalizeDoi(
          work.doi,
        ),
        compactOpenAlex(
          work,
        ),
      )
    }

    completed +=
      batch.length

    console.log(
      `OpenAlex: ${completed} / ${missing.length}`,
    )

    // 5バッチごとに途中保存
    if (
      (
        index + 1
      ) %
        5 ===
      0
    ) {
      await writeFile(
        CACHE_FILE,

        JSON.stringify(
          Object.fromEntries(
            cacheMap,
          ),
          null,
          2,
        ),

        'utf8',
      )
    }

    await sleep(150)
  }

  // 最終保存
  await writeFile(
    CACHE_FILE,

    JSON.stringify(
      Object.fromEntries(
        cacheMap,
      ),
      null,
      2,
    ),

    'utf8',
  )

  console.log('')
  console.log(
    `OpenAlexキャッシュ保存: ${CACHE_FILE}`,
  )

  return cacheMap
}

// ============================================
// 事前除外
// ============================================

function preRejectReason(
  paper,
) {
  if (
    containsAny(
      paper.title,
      EXCLUDE_TITLE_PATTERNS,
    )
  ) {
    return 'non-research-content'
  }

  if (
    isNatureNewsDoi(
      paper,
    )
  ) {
    return 'nature-news-doi'
  }

  return null
}

// ============================================
// Nature / Science 厳密判定
// ============================================

function evaluateNatureScience(
  paper,
  work,
) {
  const title =
    normalize(
      paper.title,
    )

  const openAlexText =
    buildOpenAlexText(
      work,
    )

  const primaryField =
    normalize(
      work?.primaryField ??
        '',
    )

  const primarySubfield =
    normalize(
      work?.primarySubfield ??
        '',
    )

  const primaryTopic =
    normalize(
      work?.primaryTopic ??
        '',
    )

  const evidence = []

  const strongTitleHits =
    matchingTerms(
      title,
      STRONG_CHEMISTRY_TERMS,
    )

  const chemBioTitleHits =
    matchingTerms(
      title,
      CHEMICAL_BIOLOGY_TITLE_TERMS,
    )

  const biologyOnlyHits =
    matchingTerms(
      title,
      BIOLOGY_ONLY_TERMS,
    )

  // 生物主体が明確なら、
  // 強いchemical biology根拠がない限り除外
  if (
    biologyOnlyHits.length >
      0 &&
    chemBioTitleHits.length ===
      0 &&
    strongTitleHits.length ===
      0
  ) {
    return {
      keep: false,

      reason:
        'biology-not-chemistry',

      score: 0,

      evidence:
        biologyOnlyHits,
    }
  }

  // Primary Field 完全一致
  const acceptedField =
    ACCEPT_FIELDS.find(
      (field) =>
        primaryField ===
        normalize(field),
    )

  if (acceptedField) {
    return {
      keep: true,

      reason:
        'chemistry-primary-field',

      score: 100,

      evidence: [
        `field:${acceptedField}`,
      ],
    }
  }

  // 強い化学タイトル
  // ＋OpenAlexにも化学根拠
  const openAlexChemHits =
    matchingTerms(
      openAlexText,
      STRONG_CHEMISTRY_TERMS,
    )

  if (
    strongTitleHits.length >
      0 &&
    openAlexChemHits.length >
      0
  ) {
    evidence.push(
      ...strongTitleHits.map(
        (term) =>
          `title:${term}`,
      ),
    )

    evidence.push(
      ...openAlexChemHits
        .slice(0, 5)
        .map(
          (term) =>
            `topic:${term}`,
        ),
    )

    return {
      keep: true,

      reason:
        'strong-chemistry-evidence',

      score:
        60 +
        strongTitleHits.length *
          5,

      evidence,
    }
  }

  // Chemical Biology
  const chemBioTopicHits =
    matchingTerms(
      openAlexText,
      CHEMICAL_BIOLOGY_TOPIC_TERMS,
    )

  if (
    chemBioTitleHits.length >
      0 &&
    chemBioTopicHits.length >
      0
  ) {
    return {
      keep: true,

      reason:
        'chemical-biology',

      score: 55,

      evidence: [
        ...chemBioTitleHits,
        ...chemBioTopicHits.slice(
          0,
          5,
        ),
      ],
    }
  }

  // 非常に強いタイトルだけでも残す
  if (
    title.includes(
      'chemically modified',
    ) ||
    title.includes(
      'covalent labeling',
    ) ||
    title.includes(
      'bioorthogonal',
    )
  ) {
    return {
      keep: true,

      reason:
        'strong-chemical-biology-title',

      score: 50,

      evidence: [
        'strong-chemical-biology-title',
      ],
    }
  }

  return {
    keep: false,

    reason:
      work
        ? 'primary-field-not-chemistry'
        : 'no-openalex-evidence',

    score: 0,

    evidence: [
      primaryField
        ? `field:${primaryField}`
        : '',

      primarySubfield
        ? `subfield:${primarySubfield}`
        : '',

      primaryTopic
        ? `topic:${primaryTopic}`
        : '',
    ].filter(Boolean),
  }
}

// ============================================
// メイン
// ============================================

async function main() {
  console.log('')
  console.log(
    '=====================================',
  )

  console.log(
    ' ChemTree 1-Year Chemistry Filter',
  )

  console.log(
    '=====================================',
  )

  const raw =
    await readFile(
      INPUT,
      'utf8',
    )

  const source =
    JSON.parse(raw)

  console.log('')
  console.log(
    `入力論文: ${source.papers.length} 報`,
  )

  // ------------------------------------------
  // まず明らかな記事を除外
  // ------------------------------------------

  const preRejected = []
  const remaining = []

  for (
    const paper of
      source.papers
  ) {
    const reason =
      preRejectReason(
        paper,
      )

    if (reason) {
      preRejected.push({
        paper,
        reason,
      })
    } else {
      remaining.push(
        paper,
      )
    }
  }

  console.log(
    `事前除外: ${preRejected.length} 報`,
  )

  // ------------------------------------------
  // OpenAlexが必要なのは
  // Nature / Scienceのみ
  // ------------------------------------------

  const openAlexCandidates =
    remaining.filter(
      (paper) =>
        (
          paper.journalId ===
            'nature' ||
          paper.journalId ===
            'science'
        ) &&
        paper.doi,
    )

  const openAlexMap =
    await fetchOpenAlexMissing(
      openAlexCandidates,
    )

  // ------------------------------------------
  // 判定
  // ------------------------------------------

  const accepted = []
  const rejected = []

  for (
    const paper of
      remaining
  ) {
    // JACS / Chemは原則採用
    if (
      paper.journalId ===
        'jacs' ||
      paper.journalId ===
        'chem'
    ) {
      accepted.push({
        ...paper,

        chemistryFilter: {
          keep: true,
          reason:
            'chemistry-journal',
          score: 100,
        },
      })

      continue
    }

    const doi =
      normalizeDoi(
        paper.doi,
      )

    const work =
      openAlexMap.get(doi)

    const evaluation =
      evaluateNatureScience(
        paper,
        work,
      )

    const enriched = {
      ...paper,

      openAlexFilter:
        work ?? null,

      chemistryFilter: {
        keep:
          evaluation.keep,

        reason:
          evaluation.reason,

        score:
          evaluation.score,

        evidence:
          evaluation.evidence,
      },
    }

    if (
      evaluation.keep
    ) {
      accepted.push(
        enriched,
      )
    } else {
      rejected.push(
        enriched,
      )
    }
  }

  for (
    const item of
      preRejected
  ) {
    rejected.push({
      ...item.paper,

      chemistryFilter: {
        keep: false,
        reason:
          item.reason,
        score: 0,
        evidence: [],
      },
    })
  }

  // ------------------------------------------
  // 雑誌別集計
  // ------------------------------------------

  const summary = {}

  for (
    const journal of
      source.journals
  ) {
    const id =
      journal.id

    const input =
      source.papers.filter(
        (paper) =>
          paper.journalId ===
          id,
      ).length

    const kept =
      accepted.filter(
        (paper) =>
          paper.journalId ===
          id,
      ).length

    summary[id] = {
      shortName:
        journal.shortName,

      input,

      accepted: kept,

      rejected:
        input - kept,
    }
  }

  const output = {
    generatedAt:
      new Date()
        .toISOString(),

    period:
      source.period,

    method:
      'Strict Chemistry Filter 1Y + OpenAlex cache',

    inputPapers:
      source.papers.length,

    acceptedPapers:
      accepted.length,

    rejectedPapers:
      rejected.length,

    journals:
      summary,

    papers:
      accepted,

    // 全件ではなく簡潔な除外情報だけ保存
    rejected:
      rejected.map(
        (paper) => ({
          journal:
            paper.journal,

          doi:
            paper.doi,

          title:
            paper.title,

          published:
            paper.published,

          reason:
            paper
              .chemistryFilter
              .reason,
        }),
      ),
  }

  await mkdir(
    'public/data',
    {
      recursive: true,
    },
  )

  await writeFile(
    OUTPUT,

    JSON.stringify(
      output,
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
    ' 1年間・化学論文抽出完了',
  )

  console.log(
    '=====================================',
  )

  console.log('')

  for (
    const journal of
      Object.values(
        summary,
      )
  ) {
    console.log(
      `${journal.shortName.padEnd(
        10,
      )}: ` +
      `${journal.accepted} / ` +
      `${journal.input} 報`,
    )
  }

  console.log('')

  console.log(
    `ChemTree採用: ${accepted.length} 報`,
  )

  console.log(
    `除外         : ${rejected.length} 報`,
  )

  console.log('')
  console.log(
    `保存先: ${OUTPUT}`,
  )

  console.log('')
  console.log(
    'OpenAlexキャッシュも保存されています。',
  )

  console.log(
    '次回実行時は新着論文だけ追加取得します。',
  )

  console.log('')
}

main().catch(
  (error) => {
    console.error('')
    console.error(
      'エラーが発生しました。',
    )

    console.error(error)

    process.exit(1)
  },
)