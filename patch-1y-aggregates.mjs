import {
  readFile,
  writeFile,
  copyFile,
} from 'node:fs/promises'

const FILE =
  'public/data/chemtree-1y.json'

const BACKUP =
  'public/data/chemtree-1y.before-view-aggregates.json'

// ============================================
// ChemTree View Aggregates
//
// 1M / 3M / 6M / 1Y
// ×
// All / JACS / Nature / Science / Chem
//
// を正確に集計
// ============================================

const PERIODS = {
  '1M': 30,
  '3M': 90,
  '6M': 180,
  '1Y': 365,
}

const JOURNALS = [
  'All',
  'JACS',
  'Nature',
  'Science',
  'Chem',
]

// ============================================
// 日付
// ============================================

function dateToMs(
  dateText,
) {
  const value =
    Date.parse(
      `${dateText}T00:00:00Z`,
    )

  return Number.isFinite(
    value,
  )
    ? value
    : 0
}

function isInPeriod(
  paper,
  period,
  endMs,
) {
  // 1Yは元データ自体が
  // 直近1年間なので全件採用
  if (
    period === '1Y'
  ) {
    return true
  }

  const paperMs =
    dateToMs(
      paper.published,
    )

  if (!paperMs) {
    return false
  }

  const days =
    PERIODS[period]

  const startMs =
    endMs -
    days *
      24 *
      60 *
      60 *
      1000

  return (
    paperMs >=
      startMs &&
    paperMs <=
      endMs
  )
}

// ============================================
// 論文ID
// ============================================

function paperKey(
  paper,
) {
  return (
    paper.doi ||
    `${paper.journal}:${paper.title}`
  )
}

// ============================================
// 1論文が所属する
// ChemTreeノードを復元
// ============================================

function getPaperNodeIds(
  paper,
  nodeById,
) {
  const ids =
    new Set()

  ids.add(
    'chemistry',
  )

  const branch =
    paper
      ?.classification
      ?.branch

  if (!branch) {
    ids.add(
      'unclassified',
    )

    return ids
  }

  if (
    branch ===
    'unclassified'
  ) {
    ids.add(
      'unclassified',
    )

    return ids
  }

  function addWithParents(
    nodeId,
  ) {
    let current =
      nodeId

    const visited =
      new Set()

    while (
      current &&
      !visited.has(
        current,
      )
    ) {
      visited.add(
        current,
      )

      ids.add(
        current,
      )

      current =
        nodeById[
          current
        ]?.parent ??
        null
    }
  }

  addWithParents(
    branch,
  )

  for (
    const topic of
      paper
        ?.classification
        ?.topics ??
      []
  ) {
    if (
      topic?.id
    ) {
      addWithParents(
        topic.id,
      )
    }
  }

  return ids
}

// ============================================
// 国情報
// ============================================

function getPaperCountries(
  paper,
) {
  const result =
    new Set()

  for (
    const country of
      paper
        ?.openAlex
        ?.countries ??
      []
  ) {
    const name =
      typeof country ===
      'string'
        ? country
        : country?.name ||
          country?.code

    if (name) {
      result.add(
        name,
      )
    }
  }

  return [
    ...result,
  ]
}

// ============================================
// 空のViewを作る
// ============================================

function createEmptyView(
  treeDefinition,
) {
  const counts = {}
  const countryCounts = {}
  const journalCounts = {}

  for (
    const node of
      treeDefinition
  ) {
    counts[
      node.id
    ] = 0

    countryCounts[
      node.id
    ] = {}

    journalCounts[
      node.id
    ] = {
      JACS: 0,
      Nature: 0,
      Science: 0,
      Chem: 0,
    }
  }

  return {
    counts,
    countryCounts,
    journalCounts,
  }
}

// ============================================
// 集計
// ============================================

function buildViewAggregates(
  data,
) {
  const treeDefinition =
    data.treeDefinition

  const nodeById =
    Object.fromEntries(
      treeDefinition.map(
        (node) => [
          node.id,
          node,
        ],
      ),
    )

  const endDate =
    data.period?.end ??
    new Date()
      .toISOString()
      .slice(0, 10)

  const endMs =
    dateToMs(
      endDate,
    )

  const views = {}

  for (
    const period of
      Object.keys(
        PERIODS,
      )
  ) {
    views[period] = {}

    for (
      const journal of
        JOURNALS
    ) {
      views[
        period
      ][
        journal
      ] =
        createEmptyView(
          treeDefinition,
        )
    }
  }

  const paperNodeCache =
    new Map()

  let processed = 0

  for (
    const paper of
      data.papers
  ) {
    const key =
      paperKey(
        paper,
      )

    let nodeIds =
      paperNodeCache.get(
        key,
      )

    if (!nodeIds) {
      nodeIds =
        getPaperNodeIds(
          paper,
          nodeById,
        )

      paperNodeCache.set(
        key,
        nodeIds,
      )
    }

    const countries =
      getPaperCountries(
        paper,
      )

    const paperJournal =
      String(
        paper.journal ??
        '',
      )

    for (
      const period of
        Object.keys(
          PERIODS,
        )
    ) {
      if (
        !isInPeriod(
          paper,
          period,
          endMs,
        )
      ) {
        continue
      }

      // この論文が更新するView
      // All + 自分の雑誌
      const targetViews = [
        'All',
      ]

      if (
        JOURNALS.includes(
          paperJournal,
        ) &&
        paperJournal !==
          'All'
      ) {
        targetViews.push(
          paperJournal,
        )
      }

      for (
        const journalView of
          targetViews
      ) {
        const view =
          views[
            period
          ][
            journalView
          ]

        for (
          const nodeId of
            nodeIds
        ) {
          if (
            view.counts[
              nodeId
            ] === undefined
          ) {
            continue
          }

          // --------------------------
          // 論文数
          // --------------------------

          view.counts[
            nodeId
          ] += 1

          // --------------------------
          // 雑誌別
          // --------------------------

          if (
            view
              .journalCounts[
                nodeId
              ][
                paperJournal
              ] !== undefined
          ) {
            view
              .journalCounts[
                nodeId
              ][
                paperJournal
              ] += 1
          }

          // --------------------------
          // 国別
          // 1論文につき同じ国は1回
          // --------------------------

          for (
            const country of
              countries
          ) {
            const current =
              view
                .countryCounts[
                  nodeId
                ][
                  country
                ] ??
              0

            view
              .countryCounts[
                nodeId
              ][
                country
              ] =
              current + 1
          }
        }
      }
    }

    processed++

    if (
      processed %
        1000 ===
      0
    ) {
      console.log(
        `集計中: ${processed} / ${data.papers.length}`,
      )
    }
  }

  return views
}

// ============================================
// 簡単な確認表示
// ============================================

function printSummary(
  views,
) {
  console.log('')
  console.log(
    '===== View確認 =====',
  )

  for (
    const period of
      Object.keys(
        PERIODS,
      )
  ) {
    console.log('')
    console.log(
      `[${period}]`,
    )

    for (
      const journal of
        JOURNALS
    ) {
      const count =
        views[
          period
        ][
          journal
        ]
          .counts
          .chemistry ??
        0

      console.log(
        `${journal.padEnd(
          8,
        )}: ${count} 報`,
      )
    }
  }
}

// ============================================
// 実行
// ============================================

async function main() {
  console.log('')
  console.log(
    '=====================================',
  )

  console.log(
    ' ChemTree 1Y View Aggregates',
  )

  console.log(
    '=====================================',
  )

  const raw =
    await readFile(
      FILE,
      'utf8',
    )

  const data =
    JSON.parse(raw)

  if (
    !Array.isArray(
      data.papers,
    ) ||
    !Array.isArray(
      data.treeDefinition,
    )
  ) {
    throw new Error(
      'chemtree-1y.json の形式が想定と異なります。',
    )
  }

  console.log('')
  console.log(
    `論文数: ${data.papers.length} 報`,
  )

  console.log(
    '1M / 3M / 6M / 1Y × 5誌表示を集計します...',
  )

  const viewAggregates =
    buildViewAggregates(
      data,
    )

  printSummary(
    viewAggregates,
  )

  const updated = {
    ...data,

    aggregateGeneratedAt:
      new Date()
        .toISOString(),

    availablePeriods: [
      '1M',
      '3M',
      '6M',
      '1Y',
    ],

    availableJournals:
      JOURNALS,

    viewAggregates,
  }

  // 全部成功してから
  // バックアップを作成
  await copyFile(
    FILE,
    BACKUP,
  )

  await writeFile(
    FILE,

    JSON.stringify(
      updated,
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
    ' 集計追加完了',
  )

  console.log(
    '=====================================',
  )

  console.log('')
  console.log(
    `バックアップ: ${BACKUP}`,
  )

  console.log(
    `更新ファイル: ${FILE}`,
  )

  console.log('')
  console.log(
    '追加された組み合わせ:',
  )

  console.log(
    '・1M × All/JACS/Nature/Science/Chem',
  )

  console.log(
    '・3M × All/JACS/Nature/Science/Chem',
  )

  console.log(
    '・6M × All/JACS/Nature/Science/Chem',
  )

  console.log(
    '・1Y × All/JACS/Nature/Science/Chem',
  )

  console.log('')
}

main().catch(
  (error) => {
    console.error('')
    console.error(
      'エラーが発生しました。',
    )

    console.error(
      error,
    )

    console.error('')
    console.error(
      'chemtree-1y.json は変更していません。',
    )

    process.exit(1)
  },
)