import {
  readFile,
  writeFile,
  mkdir,
} from 'node:fs/promises'

const INPUT =
  'public/data/journals-chemistry-1y.json'

const OUTPUT =
  'public/data/chemtree-1y.json'

const OPENALEX_CACHE =
  'public/data/openalex-tree-cache-1y.json'

const BATCH_SIZE = 25

// ============================================
// ChemTree 1-Year Builder v1.0
// ============================================

const TREE_NODES = [
  {
    id: 'chemistry',
    label: 'CHEMISTRY',
    parent: null,
  },

  // Catalysis
  {
    id: 'catalysis',
    label: 'Catalysis',
    parent: 'chemistry',
  },
  {
    id: 'thermal-catalysis',
    label: 'Thermal Catalysis',
    parent: 'catalysis',
  },
  {
    id: 'electrocatalysis',
    label: 'Electrocatalysis',
    parent: 'catalysis',
  },
  {
    id: 'orr',
    label: 'ORR',
    parent: 'electrocatalysis',
  },
  {
    id: 'oer',
    label: 'OER',
    parent: 'electrocatalysis',
  },
  {
    id: 'her',
    label: 'HER',
    parent: 'electrocatalysis',
  },
  {
    id: 'water-electrolysis',
    label: 'Water Electrolysis',
    parent: 'electrocatalysis',
  },
  {
    id: 'nitrate-reduction',
    label: 'Nitrate Reduction',
    parent: 'electrocatalysis',
  },
  {
    id: 'co2rr',
    label: 'CO2RR',
    parent: 'electrocatalysis',
  },
  {
    id: 'pfas-electrochemistry',
    label: 'PFAS Electrochemistry',
    parent: 'electrocatalysis',
  },
  {
    id: 'photocatalysis',
    label: 'Photocatalysis',
    parent: 'catalysis',
  },
  {
    id: 'co2-conversion',
    label: 'CO2 Conversion',
    parent: 'catalysis',
  },
  {
    id: 'methanation',
    label: 'Methanation',
    parent: 'co2-conversion',
  },
  {
    id: 'rwgs',
    label: 'RWGS',
    parent: 'co2-conversion',
  },
  {
    id: 'drm',
    label: 'DRM',
    parent: 'co2-conversion',
  },
  {
    id: 'ammonia',
    label: 'Ammonia',
    parent: 'catalysis',
  },

  // Materials
  {
    id: 'materials',
    label: 'Materials',
    parent: 'chemistry',
  },
  {
    id: 'mof',
    label: 'MOF',
    parent: 'materials',
  },
  {
    id: 'battery',
    label: 'Battery',
    parent: 'materials',
  },
  {
    id: 'polymer',
    label: 'Polymer',
    parent: 'materials',
  },
  {
    id: 'nanomaterials',
    label: 'Nanomaterials',
    parent: 'materials',
  },
  {
    id: 'semiconductor',
    label: 'Semiconductor',
    parent: 'materials',
  },
  {
    id: 'magnetic-materials',
    label: 'Magnetic Materials',
    parent: 'materials',
  },
  {
    id: 'supramolecular-materials',
    label: 'Supramolecular Materials',
    parent: 'materials',
  },

  // Synthesis
  {
    id: 'synthesis',
    label: 'Synthesis',
    parent: 'chemistry',
  },
  {
    id: 'ch-functionalization',
    label: 'C-H Functionalization',
    parent: 'synthesis',
  },
  {
    id: 'cross-coupling',
    label: 'Cross Coupling',
    parent: 'synthesis',
  },
  {
    id: 'borylation',
    label: 'Borylation',
    parent: 'synthesis',
  },
  {
    id: 'radical-chemistry',
    label: 'Radical Chemistry',
    parent: 'synthesis',
  },
  {
    id: 'asymmetric-synthesis',
    label: 'Asymmetric Synthesis',
    parent: 'synthesis',
  },
  {
    id: 'total-synthesis',
    label: 'Total Synthesis',
    parent: 'synthesis',
  },
  {
    id: 'flow-chemistry',
    label: 'Flow Chemistry',
    parent: 'synthesis',
  },

  // Chemical Biology
  {
    id: 'biochem',
    label: 'Chemical Biology',
    parent: 'chemistry',
  },
  {
    id: 'protein',
    label: 'Protein',
    parent: 'biochem',
  },
  {
    id: 'peptide',
    label: 'Peptide',
    parent: 'biochem',
  },
  {
    id: 'enzyme',
    label: 'Enzyme',
    parent: 'biochem',
  },
  {
    id: 'bioimaging',
    label: 'Bioimaging',
    parent: 'biochem',
  },
  {
    id: 'natural-products',
    label: 'Natural Products',
    parent: 'biochem',
  },

  // Analytical
  {
    id: 'analytical',
    label: 'Analytical / Spectroscopy',
    parent: 'chemistry',
  },
  {
    id: 'nmr',
    label: 'NMR',
    parent: 'analytical',
  },
  {
    id: 'xafs',
    label: 'XAFS / XAS',
    parent: 'analytical',
  },
  {
    id: 'xps',
    label: 'XPS',
    parent: 'analytical',
  },
  {
    id: 'raman',
    label: 'Raman',
    parent: 'analytical',
  },
  {
    id: 'ir',
    label: 'IR',
    parent: 'analytical',
  },
  {
    id: 'mass-spectrometry',
    label: 'Mass Spectrometry',
    parent: 'analytical',
  },
  {
    id: 'microscopy',
    label: 'Microscopy',
    parent: 'analytical',
  },

  // Physical Chemistry
  {
    id: 'physical',
    label: 'Physical Chemistry',
    parent: 'chemistry',
  },
  {
    id: 'photochemistry',
    label: 'Photochemistry',
    parent: 'physical',
  },
  {
    id: 'excited-states',
    label: 'Excited States',
    parent: 'physical',
  },
  {
    id: 'spin-chemistry',
    label: 'Spin Chemistry',
    parent: 'physical',
  },
  {
    id: 'phonons',
    label: 'Phonons',
    parent: 'physical',
  },
  {
    id: 'interfaces',
    label: 'Interfaces',
    parent: 'physical',
  },

  // Theory / Computation
  {
    id: 'theory',
    label: 'Theory / Computation',
    parent: 'chemistry',
  },
  {
    id: 'dft',
    label: 'DFT',
    parent: 'theory',
  },
  {
    id: 'molecular-dynamics',
    label: 'Molecular Dynamics',
    parent: 'theory',
  },
  {
    id: 'machine-learning',
    label: 'Machine Learning',
    parent: 'theory',
  },
  {
    id: 'reaction-prediction',
    label: 'Reaction Prediction',
    parent: 'theory',
  },

  {
    id: 'unclassified',
    label: 'Unclassified',
    parent: 'chemistry',
  },
]

const NODE_BY_ID =
  Object.fromEntries(
    TREE_NODES.map(
      (node) => [
        node.id,
        node,
      ],
    ),
  )

const MAIN_BRANCHES = [
  'catalysis',
  'materials',
  'synthesis',
  'biochem',
  'analytical',
  'physical',
  'theory',
]

// ============================================
// 分類辞書
// ============================================

const BRANCH_RULES = {
  catalysis: [
    'catalyst',
    'catalysis',
    'catalytic',
    'electrocatal',
    'photocatal',
    'active site',
    'turnover',
    'oxygen reduction',
    'oxygen evolution',
    'hydrogen evolution',
    'water electrolysis',
    'nitrate reduction',
    'nitrogen reduction',
    'co2 reduction',
    'carbon dioxide reduction',
    'reforming',
    'hydrogenation',
    'dehydrogenation',
    'ammonia synthesis',
    'ammonia decomposition',
  ],

  materials: [
    'materials science',
    'material',
    'metal-organic framework',
    'metal organic framework',
    'mof',
    'zeolitic imidazolate framework',
    'zif',
    'nanomaterial',
    'nanoparticle',
    'nanostructure',
    'crystal',
    'lattice',
    'thin film',
    'semiconductor',
    'perovskite',
    'ferroelectric',
    'polymer',
    'battery',
    'charge transport',
    'transistor',
    'magnetic material',
    'porous material',
  ],

  synthesis: [
    'organic synthesis',
    'total synthesis',
    'synthesis',
    'syntheses',
    'borylation',
    'arylation',
    'amination',
    'alkylation',
    'cyclization',
    'cyclopropanation',
    'carbocation',
    'cross-coupling',
    'cross coupling',
    'radical',
    'enantioselective',
    'stereoselective',
    'asymmetric synthesis',
    'c-h activation',
    'c-h functionalization',
  ],

  biochem: [
    'chemical biology',
    'chemically modified',
    'protein',
    'peptide',
    'enzyme',
    'enzymatic',
    'biocatalysis',
    'bioimaging',
    'molecular probe',
    'covalent labeling',
    'bioconjugation',
    'biosynthesis',
    'natural product',
    'glycolipid',
  ],

  analytical: [
    'spectroscopy',
    'spectrometry',
    'nmr',
    'nuclear magnetic resonance',
    'xafs',
    'x-ray absorption',
    'xps',
    'photoelectron spectroscopy',
    'raman',
    'infrared spectroscopy',
    'infrared absorption',
    'mass spectrometry',
    'microscopy',
  ],

  physical: [
    'physical chemistry',
    'photophysics',
    'photochemistry',
    'excited state',
    'excited-state',
    'spin polarization',
    'spin dynamics',
    'phonon',
    'carrier scattering',
    'energy transfer',
    'charge transfer',
    'solvation',
    'interfacial',
    'grain boundary',
  ],

  theory: [
    'density functional theory',
    'dft',
    'molecular dynamics',
    'simulation',
    'machine learning',
    'deep learning',
    'artificial intelligence',
    'reaction prediction',
    'computational chemistry',
  ],
}

const TOPIC_RULES = {
  electrocatalysis: {
    branch: 'catalysis',
    keywords: [
      'electrocatalysis',
      'electrocatalyst',
      'electrochemical catalysis',
      'electrolysis',
    ],
  },

  orr: {
    branch: 'catalysis',
    keywords: [
      'oxygen reduction reaction',
      'oxygen reduction',
      'orr',
    ],
  },

  oer: {
    branch: 'catalysis',
    keywords: [
      'oxygen evolution reaction',
      'oxygen evolution',
      'oer',
    ],
  },

  her: {
    branch: 'catalysis',
    keywords: [
      'hydrogen evolution reaction',
      'hydrogen evolution',
      'her',
    ],
  },

  'water-electrolysis': {
    branch: 'catalysis',
    keywords: [
      'water electrolysis',
      'water electrolyzer',
      'water electrolyser',
      'aemwe',
      'aemwes',
      'pemwe',
      'pemwes',
    ],
  },

  'nitrate-reduction': {
    branch: 'catalysis',
    keywords: [
      'nitrate reduction',
      'nitrate electroreduction',
    ],
  },

  co2rr: {
    branch: 'catalysis',
    keywords: [
      'co2 reduction reaction',
      'carbon dioxide reduction reaction',
      'co2rr',
      'electrochemical co2 reduction',
    ],
  },

  'pfas-electrochemistry': {
    branch: 'catalysis',
    keywords: [
      'pfas',
      'polyfluoroalkyl',
      'defluorination',
    ],
  },

  photocatalysis: {
    branch: 'catalysis',
    keywords: [
      'photocatalysis',
      'photocatalyst',
      'photocatalytic',
    ],
  },

  'co2-conversion': {
    branch: 'catalysis',
    keywords: [
      'co2 conversion',
      'carbon dioxide conversion',
      'co2 utilization',
    ],
  },

  methanation: {
    branch: 'catalysis',
    keywords: [
      'methanation',
      'sabatier reaction',
    ],
  },

  rwgs: {
    branch: 'catalysis',
    keywords: [
      'reverse water-gas shift',
      'reverse water gas shift',
      'rwgs',
    ],
  },

  drm: {
    branch: 'catalysis',
    keywords: [
      'dry reforming',
      'dry reforming of methane',
      'drm',
    ],
  },

  ammonia: {
    branch: 'catalysis',
    keywords: [
      'ammonia synthesis',
      'ammonia decomposition',
      'ammonia oxidation',
      'nh3',
    ],
  },

  mof: {
    branch: 'materials',
    keywords: [
      'metal-organic framework',
      'metal organic framework',
      'mof',
      'zeolitic imidazolate framework',
      'zif',
    ],
  },

  battery: {
    branch: 'materials',
    keywords: [
      'battery',
      'lithium-ion',
      'lithium ion',
      'sodium-ion',
      'sodium ion',
      'solid-state battery',
    ],
  },

  polymer: {
    branch: 'materials',
    keywords: [
      'polymer',
      'polymeric',
      'polymerization',
      'copolymer',
    ],
  },

  nanomaterials: {
    branch: 'materials',
    keywords: [
      'nanomaterial',
      'nanoparticle',
      'nanostructure',
      'nanocrystal',
    ],
  },

  semiconductor: {
    branch: 'materials',
    keywords: [
      'semiconductor',
      'semiconducting',
      'perovskite',
      'light-emitting diode',
      'light emitting diode',
      'transistor',
      'charge transport',
      'optoelectronic',
    ],
  },

  'magnetic-materials': {
    branch: 'materials',
    keywords: [
      'magnetic material',
      'ferromagnetic',
      'antiferromagnetic',
      'magnetism',
    ],
  },

  'supramolecular-materials': {
    branch: 'materials',
    keywords: [
      'supramolecular',
      'self-assembly',
      'self assembly',
    ],
  },

  'ch-functionalization': {
    branch: 'synthesis',
    keywords: [
      'c-h activation',
      'c-h functionalization',
      'direct arylation',
    ],
  },

  'cross-coupling': {
    branch: 'synthesis',
    keywords: [
      'cross-coupling',
      'cross coupling',
      'suzuki',
      'buchwald',
      'heck reaction',
      'negishi',
      'sonogashira',
    ],
  },

  borylation: {
    branch: 'synthesis',
    keywords: [
      'borylation',
      'boryl',
      'boronate',
      'organoboron',
    ],
  },

  'radical-chemistry': {
    branch: 'synthesis',
    keywords: [
      'radical reaction',
      'radical-mediated',
      'radical relay',
      'radical-organometallic',
    ],
  },

  'asymmetric-synthesis': {
    branch: 'synthesis',
    keywords: [
      'asymmetric synthesis',
      'enantioselective',
      'stereoselective',
      'chiral synthesis',
    ],
  },

  'total-synthesis': {
    branch: 'synthesis',
    keywords: [
      'total synthesis',
      'natural product synthesis',
    ],
  },

  'flow-chemistry': {
    branch: 'synthesis',
    keywords: [
      'flow chemistry',
      'continuous flow',
      'flow reactor',
      'microreactor',
    ],
  },

  protein: {
    branch: 'biochem',
    keywords: [
      'protein',
      'protein design',
      'protein engineering',
      'protein modification',
    ],
  },

  peptide: {
    branch: 'biochem',
    keywords: [
      'peptide',
      'peptide scaffold',
      'peptide synthesis',
    ],
  },

  enzyme: {
    branch: 'biochem',
    keywords: [
      'enzyme',
      'enzymatic',
      'biocatalysis',
      'enzyme engineering',
    ],
  },

  bioimaging: {
    branch: 'biochem',
    keywords: [
      'bioimaging',
      'tumor imaging',
      'cell imaging',
      'molecular imaging',
    ],
  },

  'natural-products': {
    branch: 'biochem',
    keywords: [
      'natural product',
      'biosynthesis',
      'terpene',
      'terpenoid',
      'alkaloid',
      'polyketide',
    ],
  },

  nmr: {
    branch: 'analytical',
    keywords: [
      'nmr',
      'nuclear magnetic resonance',
      'magic-angle spinning',
      'magic angle spinning',
    ],
  },

  xafs: {
    branch: 'analytical',
    keywords: [
      'xafs',
      'xas',
      'x-ray absorption',
      'xanes',
      'exafs',
    ],
  },

  xps: {
    branch: 'analytical',
    keywords: [
      'xps',
      'x-ray photoelectron spectroscopy',
    ],
  },

  raman: {
    branch: 'analytical',
    keywords: [
      'raman',
      'raman spectroscopy',
    ],
  },

  ir: {
    branch: 'analytical',
    keywords: [
      'infrared spectroscopy',
      'infrared absorption',
      'ftir',
    ],
  },

  'mass-spectrometry': {
    branch: 'analytical',
    keywords: [
      'mass spectrometry',
      'mass spectrometric',
      'maldi',
      'esi-ms',
    ],
  },

  microscopy: {
    branch: 'analytical',
    keywords: [
      'electron microscopy',
      'transmission electron microscopy',
      'scanning electron microscopy',
      'microscopy',
    ],
  },

  photochemistry: {
    branch: 'physical',
    keywords: [
      'photochemistry',
      'photochemical',
      'photoexcitation',
    ],
  },

  'excited-states': {
    branch: 'physical',
    keywords: [
      'excited state',
      'excited-state',
      'exciton',
      'energy transfer',
      'charge transfer',
    ],
  },

  'spin-chemistry': {
    branch: 'physical',
    keywords: [
      'spin chemistry',
      'spin polarization',
      'spin dynamics',
    ],
  },

  phonons: {
    branch: 'physical',
    keywords: [
      'phonon',
      'phonons',
      'lattice vibration',
      'carrier scattering',
    ],
  },

  interfaces: {
    branch: 'physical',
    keywords: [
      'interface dynamics',
      'interfacial dynamics',
      'surface and interface',
      'interfacial solvation',
      'solvation',
      'grain boundary',
    ],
  },

  dft: {
    branch: 'theory',
    keywords: [
      'density functional theory',
      'dft calculation',
      'dft calculations',
    ],
  },

  'molecular-dynamics': {
    branch: 'theory',
    keywords: [
      'molecular dynamics',
      'md simulation',
    ],
  },

  'machine-learning': {
    branch: 'theory',
    keywords: [
      'machine learning',
      'deep learning',
      'artificial intelligence',
      'neural network',
    ],
  },

  'reaction-prediction': {
    branch: 'theory',
    keywords: [
      'reaction prediction',
      'retrosynthesis',
      'reaction pathway prediction',
    ],
  },
}

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

function contains(
  text,
  term,
) {
  return normalize(text)
    .includes(
      normalize(term),
    )
}

function hasAny(
  text,
  terms,
) {
  return terms.some(
    (term) =>
      contains(
        text,
        term,
      ),
  )
}

function scoreTerms(
  title,
  openAlexText,
  abstract,
  terms,
) {
  let score = 0

  for (
    const term of terms
  ) {
    if (
      contains(
        title,
        term,
      )
    ) {
      score += 12
    }

    if (
      contains(
        openAlexText,
        term,
      )
    ) {
      score += 7
    }

    if (
      contains(
        abstract,
        term,
      )
    ) {
      score += 1
    }
  }

  return score
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
// 全5,751報の国・Topic取得
// ============================================

function compactOpenAlex(
  work,
) {
  const countries =
    new Map()

  const institutions =
    new Map()

  for (
    const authorship of
      work?.authorships ??
      []
  ) {
    for (
      const institution of
        authorship
          ?.institutions ??
        []
    ) {
      if (
        institution
          ?.country_code
      ) {
        countries.set(
          institution
            .country_code,
          {
            code:
              institution
                .country_code,

            name:
              countryName(
                institution
                  .country_code,
              ),
          },
        )
      }

      if (
        institution?.id
      ) {
        institutions.set(
          institution.id,
          {
            id:
              institution.id,

            name:
              institution
                .display_name ??
              '',

            countryCode:
              institution
                .country_code ??
              '',
          },
        )
      }
    }
  }

  return {
    id:
      work?.id ?? '',

    doi:
      normalizeDoi(
        work?.doi ?? '',
      ),

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

    countries:
      [
        ...countries.values(),
      ],

    institutions:
      [
        ...institutions.values(),
      ],

    citations:
      work
        ?.cited_by_count ??
      0,
  }
}

function countryName(code) {
  const names = {
    JP: 'Japan',
    CN: 'China',
    US: 'USA',
    DE: 'Germany',
    KR: 'Korea',
    GB: 'UK',
    FR: 'France',
    CH: 'Switzerland',
    CA: 'Canada',
    AU: 'Australia',
    IN: 'India',
    IT: 'Italy',
    ES: 'Spain',
    NL: 'Netherlands',
    SE: 'Sweden',
    SG: 'Singapore',
    TW: 'Taiwan',
    BE: 'Belgium',
    AT: 'Austria',
    DK: 'Denmark',
    NO: 'Norway',
    FI: 'Finland',
    PL: 'Poland',
    BR: 'Brazil',
    IL: 'Israel',
  }

  return names[code] ??
    code
}

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
            'ChemTree/1.1',
        },
      },
    )

  if (response.ok) {
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
      `OpenAlex ${response.status}。${wait / 1000}秒待ちます...`,
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

async function loadOpenAlex(
  papers,
) {
  console.log('')
  console.log(
    'OpenAlexデータを準備しています...',
  )

  const cache =
    await readJsonIfExists(
      OPENALEX_CACHE,
      {},
    )

  const cacheMap =
    new Map(
      Object.entries(
        cache,
      ),
    )

  const withDoi =
    papers.filter(
      (paper) =>
        paper.doi,
    )

  const missing =
    withDoi.filter(
      (paper) =>
        !cacheMap.has(
          normalizeDoi(
            paper.doi,
          ),
        ),
    )

  console.log(
    `対象: ${withDoi.length} 報`,
  )

  console.log(
    `キャッシュ済み: ${
      withDoi.length -
      missing.length
    } 報`,
  )

  console.log(
    `今回取得: ${missing.length} 報`,
  )

  const batches =
    chunks(
      missing,
      BATCH_SIZE,
    )

  let completed = 0

  for (
    let i = 0;
    i < batches.length;
    i++
  ) {
    const batch =
      batches[i]

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
          'primary_topic',
          'topics',
          'keywords',
          'authorships',
          'cited_by_count',
        ].join(','),
      })

    const response =
      await fetchWithRetry(
        `https://api.openalex.org/works?${params.toString()}`,
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

    if (
      (
        i + 1
      ) %
        5 ===
      0
    ) {
      await writeFile(
        OPENALEX_CACHE,

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

  await writeFile(
    OPENALEX_CACHE,

    JSON.stringify(
      Object.fromEntries(
        cacheMap,
      ),
      null,
      2,
    ),

    'utf8',
  )

  console.log(
    `OpenAlexキャッシュ: ${OPENALEX_CACHE}`,
  )

  return cacheMap
}

// ============================================
// OpenAlex文字列
// ============================================

function buildOpenAlexText(
  work,
) {
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
      topic.subfield ??
        '',
    )

    parts.push(
      topic.field ?? '',
    )
  }

  for (
    const keyword of
      work.keywords ?? []
  ) {
    parts.push(
      keyword,
    )
  }

  return normalize(
    parts.join(' '),
  )
}

// ============================================
// 分類
// ============================================

function classifyPaper(
  paper,
  openAlex,
) {
  const title =
    normalize(
      paper.title,
    )

  const abstract =
    normalize(
      paper.abstract,
    )

  const oaText =
    buildOpenAlexText(
      openAlex,
    )

  const primaryField =
    normalize(
      openAlex
        ?.primaryField ??
        '',
    )

  const primarySubfield =
    normalize(
      openAlex
        ?.primarySubfield ??
        '',
    )

  const primaryTopic =
    normalize(
      openAlex
        ?.primaryTopic ??
        '',
    )

  const scores =
    Object.fromEntries(
      MAIN_BRANCHES.map(
        (branch) => [
          branch,

          scoreTerms(
            title,
            oaText,
            abstract,
            BRANCH_RULES[
              branch
            ],
          ),
        ],
      ),
    )

  // ------------------------------------------
  // OpenAlex Field補正
  // ------------------------------------------

  if (
    primaryField ===
    'materials science'
  ) {
    scores.materials +=
      35
  }

  if (
    primarySubfield ===
    'organic chemistry'
  ) {
    scores.synthesis +=
      30
  }

  if (
    primarySubfield ===
    'physical chemistry'
  ) {
    scores.physical +=
      30
  }

  if (
    primarySubfield ===
    'analytical chemistry'
  ) {
    scores.analytical +=
      35
  }

  // ------------------------------------------
  // 強いタイトル補正
  // ------------------------------------------

  if (
    hasAny(
      title,
      [
        'zeolitic imidazolate framework',
        'zif',
        'charge transport',
        'transistor',
        'perovskite',
        'ferroelectric',
        'semiconductor',
      ],
    )
  ) {
    scores.materials +=
      50
  }

  if (
    hasAny(
      title,
      [
        'interfacial solvation',
        'solvation',
        'grain boundary',
        'phonon',
        'spin polarization',
        'excited state',
      ],
    )
  ) {
    scores.physical +=
      50
  }

  if (
    hasAny(
      title,
      [
        'nmr',
        'infrared absorption',
        'infrared spectroscopy',
        'raman spectroscopy',
        'x-ray absorption',
        'xps',
        'mass spectrometry',
      ],
    )
  ) {
    scores.analytical +=
      55
  }

  if (
    hasAny(
      title,
      [
        'chemically modified',
        'peptide scaffold',
        'covalent labeling',
        'enzyme engineering',
        'with enzymes',
        'key enzyme',
        'glycolipid',
      ],
    )
  ) {
    scores.biochem +=
      60
  }

  if (
    hasAny(
      title,
      [
        'borylation',
        'cyclopropanation',
        'cross-coupling',
        'carbocation cascade',
        'total synthesis',
        'enantioselective',
      ],
    )
  ) {
    scores.synthesis +=
      55
  }

  if (
    hasAny(
      title,
      [
        'machine learning',
        'deep learning',
        'density functional theory',
        'molecular dynamics',
      ],
    )
  ) {
    scores.theory +=
      60
  }

  if (
    primaryTopic.includes(
      'electrocatal',
    )
  ) {
    scores.catalysis +=
      30
  }

  if (
    primaryTopic.includes(
      'spectroscopy',
    )
  ) {
    scores.analytical +=
      30
  }

  if (
    primaryTopic.includes(
      'enzyme',
    ) ||
    primaryTopic.includes(
      'biosynthesis',
    )
  ) {
    scores.biochem +=
      30
  }

  if (
    primaryTopic.includes(
      'semiconductor',
    ) ||
    primaryTopic.includes(
      'perovskite',
    ) ||
    primaryTopic.includes(
      'materials',
    )
  ) {
    scores.materials +=
      25
  }

  const sorted =
    Object.entries(
      scores,
    ).sort(
      (a, b) =>
        b[1] - a[1],
    )

  const [
    branch,
    branchScore,
  ] =
    sorted[0] ?? [
      'unclassified',
      0,
    ]

  const finalBranch =
    branchScore >= 8
      ? branch
      : 'unclassified'

  const topics = []

  if (
    finalBranch !==
    'unclassified'
  ) {
    for (
      const [
        id,
        rule,
      ] of Object.entries(
        TOPIC_RULES,
      )
    ) {
      if (
        rule.branch !==
        finalBranch
      ) {
        continue
      }

      const score =
        scoreTerms(
          title,
          oaText,
          abstract,
          rule.keywords,
        )

      if (
        score >= 8
      ) {
        topics.push({
          id,

          label:
            NODE_BY_ID[
              id
            ]?.label ??
            id,

          score,
        })
      }
    }
  }

  topics.sort(
    (a, b) =>
      b.score - a.score,
  )

  return {
    ...paper,

    openAlex:
      openAlex ?? null,

    classification: {
      branch:
        finalBranch,

      branchLabel:
        NODE_BY_ID[
          finalBranch
        ]?.label ??
        'Unclassified',

      topics:
        topics.slice(
          0,
          3,
        ),

      branchScore,
    },
  }
}

// ============================================
// ノード集計
// ============================================

function paperKey(
  paper,
) {
  return (
    paper.doi ||
    `${paper.journal}:${paper.title}`
  )
}

function createNodeMaps() {
  return Object.fromEntries(
    TREE_NODES.map(
      (node) => [
        node.id,
        new Map(),
      ],
    ),
  )
}

function addToNode(
  maps,
  nodeId,
  paper,
) {
  maps[nodeId]?.set(
    paperKey(paper),
    paper,
  )
}

function addWithAncestors(
  maps,
  nodeId,
  paper,
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

    addToNode(
      maps,
      current,
      paper,
    )

    current =
      NODE_BY_ID[
        current
      ]?.parent ??
      null
  }
}

// ============================================
// 期間
// ============================================

function dateToMs(
  dateText,
) {
  const ms =
    Date.parse(
      `${dateText}T00:00:00Z`,
    )

  return Number.isFinite(
    ms,
  )
    ? ms
    : 0
}

function withinDays(
  paper,
  endMs,
  days,
) {
  const paperMs =
    dateToMs(
      paper.published,
    )

  if (!paperMs) {
    return false
  }

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
// 月別集計
// ============================================

function monthKey(
  dateText,
) {
  return String(
    dateText,
  ).slice(0, 7)
}

function getMonthKeys(
  endDate,
  count = 12,
) {
  const end =
    new Date(
      `${endDate}T00:00:00Z`,
    )

  const result = []

  for (
    let i =
      count - 1;
    i >= 0;
    i--
  ) {
    const d =
      new Date(end)

    d.setUTCMonth(
      d.getUTCMonth() -
        i,
    )

    result.push(
      `${d.getUTCFullYear()}-${String(
        d.getUTCMonth() +
          1,
      ).padStart(
        2,
        '0',
      )}`,
    )
  }

  return result
}

function buildMonthlyCounts(
  nodePapers,
  months,
) {
  const result = {}

  for (
    const [
      nodeId,
      papers,
    ] of Object.entries(
      nodePapers,
    )
  ) {
    const counts =
      Object.fromEntries(
        months.map(
          (month) => [
            month,
            0,
          ],
        ),
      )

    for (
      const paper of papers
    ) {
      const month =
        monthKey(
          paper.published,
        )

      if (
        counts[
          month
        ] !== undefined
      ) {
        counts[
          month
        ] += 1
      }
    }

    result[nodeId] =
      counts
  }

  return result
}

// ============================================
// 1M/3M/6M/1Y
// ============================================

function buildPeriodCounts(
  nodePapers,
  endDate,
) {
  const endMs =
    dateToMs(
      endDate,
    )

  const result = {}

  for (
    const [
      nodeId,
      papers,
    ] of Object.entries(
      nodePapers,
    )
  ) {
    result[nodeId] = {
      '1M':
        papers.filter(
          (paper) =>
            withinDays(
              paper,
              endMs,
              30,
            ),
        ).length,

      '3M':
        papers.filter(
          (paper) =>
            withinDays(
              paper,
              endMs,
              90,
            ),
        ).length,

      '6M':
        papers.filter(
          (paper) =>
            withinDays(
              paper,
              endMs,
              180,
            ),
        ).length,

      '1Y':
        papers.length,
    }
  }

  return result
}

// ============================================
// 成長率
// 直近90日 vs その前90日
// 日数補正した成長率
// ============================================

function buildGrowth(
  nodePapers,
  endDate,
) {
  const endMs =
    dateToMs(
      endDate,
    )

  const day =
    24 *
    60 *
    60 *
    1000

  const recentStart =
    endMs -
    90 * day

  const previousStart =
    endMs -
    180 * day

  const result = {}

  for (
    const [
      nodeId,
      papers,
    ] of Object.entries(
      nodePapers,
    )
  ) {
    let recent = 0
    let previous = 0

    for (
      const paper of papers
    ) {
      const time =
        dateToMs(
          paper.published,
        )

      if (!time) {
        continue
      }

      if (
        time >=
          recentStart &&
        time <=
          endMs
      ) {
        recent++
      } else if (
        time >=
          previousStart &&
        time <
          recentStart
      ) {
        previous++
      }
    }

    let growthPercent =
      null

    if (
      previous > 0
    ) {
      growthPercent =
        (
          (
            recent -
            previous
          ) /
          previous
        ) *
        100
    }

    result[nodeId] = {
      recent90d:
        recent,

      previous90d:
        previous,

      growthPercent:
        growthPercent ===
        null
          ? null
          : Math.round(
              growthPercent *
                10,
            ) /
            10,

      trend:
        growthPercent ===
        null
          ? 'new'
          : growthPercent >=
              25
            ? 'surging'
            : growthPercent >=
                10
              ? 'growing'
              : growthPercent <=
                  -15
                ? 'declining'
                : 'stable',
    }
  }

  return result
}

// ============================================
// Journal Counts
// ============================================

function buildJournalCounts(
  nodePapers,
) {
  const result = {}

  for (
    const [
      nodeId,
      papers,
    ] of Object.entries(
      nodePapers,
    )
  ) {
    const counts = {
      JACS: 0,
      Nature: 0,
      Science: 0,
      Chem: 0,
    }

    for (
      const paper of papers
    ) {
      if (
        counts[
          paper.journal
        ] !== undefined
      ) {
        counts[
          paper.journal
        ]++
      }
    }

    result[nodeId] =
      counts
  }

  return result
}

// ============================================
// Country Counts
// ============================================

function buildCountryCounts(
  nodePapers,
) {
  const result = {}

  for (
    const [
      nodeId,
      papers,
    ] of Object.entries(
      nodePapers,
    )
  ) {
    const counts = {}

    for (
      const paper of papers
    ) {
      const seen =
        new Set()

      for (
        const country of
          paper.openAlex
            ?.countries ??
          []
      ) {
        const name =
          country.name ??
          country.code

        if (
          !name ||
          seen.has(name)
        ) {
          continue
        }

        seen.add(name)

        counts[name] =
          (
            counts[
              name
            ] ?? 0
          ) + 1
      }
    }

    result[nodeId] =
      counts
  }

  return result
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
    ' ChemTree 1-Year Builder',
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
    `入力: ${source.papers.length} 報`,
  )

  const openAlexMap =
    await loadOpenAlex(
      source.papers,
    )

  console.log('')
  console.log(
    '論文をChemTreeへ分類しています...',
  )

  const papers =
    source.papers.map(
      (paper) => {
        const doi =
          normalizeDoi(
            paper.doi,
          )

        return classifyPaper(
          paper,
          openAlexMap.get(
            doi,
          ),
        )
      },
    )

  const nodeMaps =
    createNodeMaps()

  for (
    const paper of papers
  ) {
    addToNode(
      nodeMaps,
      'chemistry',
      paper,
    )

    const branch =
      paper
        .classification
        .branch

    if (
      branch ===
      'unclassified'
    ) {
      addToNode(
        nodeMaps,
        'unclassified',
        paper,
      )

      continue
    }

    addWithAncestors(
      nodeMaps,
      branch,
      paper,
    )

    for (
      const topic of
        paper
          .classification
          .topics
    ) {
      addWithAncestors(
        nodeMaps,
        topic.id,
        paper,
      )
    }
  }

  const nodePapers =
    Object.fromEntries(
      Object.entries(
        nodeMaps,
      ).map(
        ([id, map]) => [
          id,
          [
            ...map.values(),
          ],
        ],
      ),
    )

  const counts =
    Object.fromEntries(
      Object.entries(
        nodePapers,
      ).map(
        ([id, list]) => [
          id,
          list.length,
        ],
      ),
    )

  const endDate =
    source.period?.end ??
    new Date()
      .toISOString()
      .slice(0, 10)

  const months =
    getMonthKeys(
      endDate,
      12,
    )

  console.log(
    '月別・国別・成長率を集計しています...',
  )

  const journalCounts =
    buildJournalCounts(
      nodePapers,
    )

  const countryCounts =
    buildCountryCounts(
      nodePapers,
    )

  const monthlyCounts =
    buildMonthlyCounts(
      nodePapers,
      months,
    )

  const periodCounts =
    buildPeriodCounts(
      nodePapers,
      endDate,
    )

  const growth =
    buildGrowth(
      nodePapers,
      endDate,
    )

  // 急成長ノード
  const emerging =
    TREE_NODES
      .filter(
        (node) =>
          node.id !==
            'chemistry' &&
          node.id !==
            'unclassified',
      )
      .map(
        (node) => ({
          id:
            node.id,

          label:
            node.label,

          count:
            counts[
              node.id
            ] ?? 0,

          ...growth[
            node.id
          ],
        }),
      )
      .filter(
        (item) =>
          item.count >= 5,
      )
      .sort(
        (a, b) =>
          (
            b.growthPercent ??
            -9999
          ) -
          (
            a.growthPercent ??
            -9999
          ),
      )
      .slice(0, 15)

  const output = {
    generatedAt:
      new Date()
        .toISOString(),

    period:
      source.period,

    source: {
      journals: [
        'JACS',
        'Nature',
        'Science',
        'Chem',
      ],

      papers:
        papers.length,
    },

    treeDefinition:
      TREE_NODES,

    months,

    counts,

    periodCounts,

    journalCounts,

    countryCounts,

    monthlyCounts,

    growth,

    emerging,

    // 検索用全論文
    papers,

    // 各ノードの右パネル用
    // 最大100報まで保持
    nodePapers:
      Object.fromEntries(
        Object.entries(
          nodePapers,
        ).map(
          ([id, list]) => [
            id,

            [
              ...list,
            ]
              .sort(
                (a, b) =>
                  String(
                    b.published,
                  ).localeCompare(
                    String(
                      a.published,
                    ),
                  ),
              )
              .slice(
                0,
                100,
              ),
          ],
        ),
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
    ' 1年間ChemTreeデータ完成',
  )

  console.log(
    '=====================================',
  )

  console.log('')

  for (
    const branch of
      MAIN_BRANCHES
  ) {
    console.log(
      `${NODE_BY_ID[
        branch
      ].label.padEnd(
        26,
      )}: ${
        counts[
          branch
        ] ?? 0
      }`,
    )
  }

  console.log(
    `${'Unclassified'.padEnd(
      26,
    )}: ${
      counts
        .unclassified ??
      0
    }`,
  )

  console.log('')
  console.log(
    '===== 急成長トピック =====',
  )

  emerging
    .slice(0, 10)
    .forEach(
      (
        item,
        index,
      ) => {
        console.log(
          `${index + 1}. ${item.label.padEnd(
            24,
          )} ` +
          `${item.growthPercent ?? 'new'}% ` +
          `(90d ${item.recent90d} vs ${item.previous90d})`,
        )
      },
    )

  console.log('')
  console.log(
    `保存先: ${OUTPUT}`,
  )

  console.log('')
  console.log(
    'このファイルには以下が入っています:',
  )

  console.log(
    '・1M / 3M / 6M / 1Y',
  )

  console.log(
    '・12か月の月別論文数',
  )

  console.log(
    '・国別件数',
  )

  console.log(
    '・雑誌別件数',
  )

  console.log(
    '・90日成長率',
  )

  console.log(
    '・急成長トピック',
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

    process.exit(1)
  },
)