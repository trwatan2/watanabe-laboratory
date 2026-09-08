import {
  Canvas,
  useFrame,
} from '@react-three/fiber'

import {
  OrbitControls,
  Sparkles,
  Text,
} from '@react-three/drei'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import * as THREE from 'three'

import CameraFocus from './CameraFocus'

import {
  GrowthNodeGlow,
  GrowthBranchGlow,
} from './GrowthGlow'

// ============================================
// 型
// ============================================

type TreeNodeDefinition = {
  id: string
  label: string
  parent: string | null
}

type CountryCounts = Record<
  string,
  Record<string, number>
>

type Paper = {
  doi: string
  title: string
  published: string
  authors: string[]
  url: string

  openAlex?: {
    primaryTopic?: string
    countries?: {
      code: string
      name: string
    }[]
  }

  classification?: {
    branch: string
    branchLabel: string
    topics: {
      id: string
      label: string
    }[]
    confidence: string
  }
}

type ChemTreeData = {
  generatedAt: string

  source: {
    journal: string
    shortName: string
    fetchedAt: string
    papers: number
  }

  treeDefinition: TreeNodeDefinition[]

  counts: Record<string, number>

  countryCounts: CountryCounts

  nodePapers: Record<string, Paper[]>
}

type PositionMap = Record<
  string,
  [number, number, number]
>

// ============================================
// 色
// ============================================

const branchColors: Record<
  string,
  string
> = {
  catalysis: '#72ff9b',
  materials: '#68b7ff',
  synthesis: '#c887ff',
  biochem: '#ffd478',
  analytical: '#67f0e5',
  physical: '#ff8fa8',
  theory: '#ffb86c',
  unclassified: '#718096',
  chemistry: '#8ed8ff',
}

// ============================================
// 主枝の3D位置
// ============================================

const mainPositions: PositionMap = {
  // 木の中心
  chemistry: [0, -1.45, 0],

  // 手前左
  catalysis: [-4.8, 1.45, 1.8],

  // 奥左上
  materials: [-3.1, 2.8, -2.6],

  // 手前中央上
  synthesis: [-0.7, 3.55, 2.5],

  // 奥右上
  biochem: [2.8, 2.9, -2.5],

  // 手前右
  analytical: [4.9, 1.55, 1.6],

  // 奥左下
  physical: [-3.3, 0.0, -3.1],

  // 奥右下
  theory: [3.4, 0.05, -3.0],

  // 木の背後
  unclassified: [0, 0.35, -4.2],
}

const mainBranches = [
  'catalysis',
  'materials',
  'synthesis',
  'biochem',
  'analytical',
  'physical',
  'theory',
]

// ============================================
// 親をたどって主枝を判定
// ============================================

function getMainBranch(
  nodeId: string,
  byId: Record<
    string,
    TreeNodeDefinition
  >,
) {
  if (
    nodeId === 'chemistry'
  ) {
    return 'chemistry'
  }

  if (
    nodeId === 'unclassified'
  ) {
    return 'unclassified'
  }

  let current =
    byId[nodeId]

  const visited = new Set<string>()

  while (
    current &&
    current.parent &&
    !visited.has(current.id)
  ) {
    visited.add(current.id)

    if (
      current.parent ===
      'chemistry'
    ) {
      return current.id
    }

    current =
      byId[current.parent]
  }

  return 'unclassified'
}

// ============================================
// 位置を自動計算
// ============================================

function buildPositions(
  definitions: TreeNodeDefinition[],
  counts: Record<string, number>,
) {
  const positions: PositionMap = {
    ...mainPositions,
  }

  const byId =
    Object.fromEntries(
      definitions.map(
        (node) => [
          node.id,
          node,
        ],
      ),
    )

  const childrenMap =
    new Map<
      string,
      TreeNodeDefinition[]
    >()

  for (
    const node of definitions
  ) {
    if (!node.parent) continue

    if (
      !childrenMap.has(
        node.parent,
      )
    ) {
      childrenMap.set(
        node.parent,
        [],
      )
    }

    childrenMap
      .get(node.parent)!
      .push(node)
  }

  function placeChildren(
  parentId: string,
  depth: number,
) {
  const parentPos =
    positions[parentId]

  if (!parentPos) return

  const children =
    (
      childrenMap.get(
        parentId,
      ) ?? []
    )
      .filter(
        (node) =>
          (
            counts[node.id] ??
            0
          ) > 0,
      )
      .sort(
        (a, b) =>
          (
            counts[b.id] ??
            0
          ) -
          (
            counts[a.id] ??
            0
          ),
      )

  if (
    children.length === 0
  ) {
    return
  }

  const parentDefinition =
    byId[parentId]

  const grandParentId =
    parentDefinition?.parent

  const grandParentPos =
    grandParentId
      ? positions[
          grandParentId
        ]
      : mainPositions.chemistry

  const origin =
    grandParentPos ??
    mainPositions.chemistry

  // 親枝が伸びてきた方向
  const outward =
    new THREE.Vector3(
      parentPos[0] -
        origin[0],

      parentPos[1] -
        origin[1],

      parentPos[2] -
        origin[2],
    )

  if (
    outward.lengthSq() <
    0.0001
  ) {
    outward.set(
      parentPos[0],
      1,
      parentPos[2],
    )
  }

  outward.normalize()

  // outward と直交する軸
  let reference =
    new THREE.Vector3(
      0,
      1,
      0,
    )

  if (
    Math.abs(
      outward.dot(
        reference,
      ),
    ) > 0.92
  ) {
    reference =
      new THREE.Vector3(
        0,
        0,
        1,
      )
  }

  const side =
    new THREE.Vector3()
      .crossVectors(
        outward,
        reference,
      )
      .normalize()

  const around =
    new THREE.Vector3()
      .crossVectors(
        side,
        outward,
      )
      .normalize()

  // 親ノードごとに少し違う回転角
  const seed =
    parentId
      .split('')
      .reduce(
        (
          total,
          character,
        ) =>
          total +
          character.charCodeAt(
            0,
          ),
        0,
      )

  const phase =
    (
      seed %
      360
    ) *
    Math.PI /
    180

  // 子枝を親枝の周囲へ立体的に展開
  const totalAngle =
    children.length === 1
      ? 0
      : Math.min(
          Math.PI * 1.55,
          Math.PI *
            0.48 *
            (
              children.length -
              1
            ),
        )

  children.forEach(
    (
      child,
      index,
    ) => {
      const relative =
        children.length === 1
          ? 0
          : index /
              (
                children.length -
                1
              ) -
            0.5

      const angle =
        phase +
        relative *
          totalAngle

      const childCount =
        counts[
          child.id
        ] ?? 0

      const forward =
        1.15 +
        depth *
          0.28 +
        Math.min(
          0.35,
          Math.sqrt(
            childCount,
          ) *
            0.035,
        )

      const radius =
        0.72 +
        depth *
          0.20 +
        Math.min(
          0.28,
          children.length *
            0.035,
        )

      const childPos =
        new THREE.Vector3(
          ...parentPos,
        )

      childPos.add(
        outward
          .clone()
          .multiplyScalar(
            forward,
          ),
      )

      childPos.add(
        side
          .clone()
          .multiplyScalar(
            Math.cos(
              angle,
            ) *
              radius,
          ),
      )

      childPos.add(
        around
          .clone()
          .multiplyScalar(
            Math.sin(
              angle,
            ) *
              radius,
          ),
      )

      childPos.y +=
        0.28 +
        depth *
          0.12

      positions[
        child.id
      ] = [
        childPos.x,
        childPos.y,
        childPos.z,
      ]

      placeChildren(
        child.id,
        depth + 1,
      )
    },
  )
}

  for (
    const branch of
      mainBranches
  ) {
    placeChildren(
      branch,
      1,
    )
  }

  return positions
}

// ============================================
// 曲線状の枝
// ============================================

function Branch({
  start,
  end,
  color,
  thickness,
}: {
  start: [
    number,
    number,
    number,
  ]

  end: [
    number,
    number,
    number,
  ]

  color: string

  thickness: number
}) {
  const curve =
    useMemo(() => {
      const s =
        new THREE.Vector3(
          ...start,
        )

      const e =
        new THREE.Vector3(
          ...end,
        )

      const mid1 =
        new THREE.Vector3(
          s.x * 0.68 +
            e.x * 0.32,

          s.y * 0.68 +
            e.y * 0.32 +
            0.28,

          s.z * 0.68 +
            e.z * 0.32,
        )

      const mid2 =
        new THREE.Vector3(
          s.x * 0.30 +
            e.x * 0.70,

          s.y * 0.30 +
            e.y * 0.70 +
            0.16,

          s.z * 0.30 +
            e.z * 0.70,
        )

      return new THREE
        .CatmullRomCurve3([
          s,
          mid1,
          mid2,
          e,
        ])
    }, [start, end])

  return (
    <mesh>
      <tubeGeometry
        args={[
          curve,
          48,
          thickness,
          10,
          false,
        ]}
      />

      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={1.8}
        transparent
        opacity={0.84}
        roughness={0.25}
      />
    </mesh>
  )
}

// ============================================
// 光るノード
// ============================================

function GlowNode({
  id,
  label,
  position,
  color,
  count,
  maxCount,
  selected,
  onSelect,
  isMain,
}: {
  id: string

  label: string

  position: [
    number,
    number,
    number,
  ]

  color: string

  count: number

  maxCount: number

  selected: boolean

  onSelect: (
    id: string,
  ) => void

  isMain: boolean
}) {
  const meshRef =
    useRef<THREE.Mesh>(
      null,
    )

  const normalized =
    maxCount > 0
      ? Math.sqrt(
          count /
            maxCount,
        )
      : 0

  const size =
    id === 'chemistry'
      ? 0.38
      : isMain
        ? 0.25 +
          normalized * 0.14
        : 0.11 +
          normalized * 0.13

  useFrame(
    (state) => {
      if (
        !meshRef.current
      ) {
        return
      }

      const pulse =
        1 +
        Math.sin(
          state.clock
            .elapsedTime *
            2 +
            position[0],
        ) *
          0.035

      meshRef.current
        .scale
        .setScalar(
          selected
            ? pulse * 1.18
            : pulse,
        )
    },
  )

  return (
    <group
      position={position}
    >
      <mesh
        ref={meshRef}

        onClick={(
          event,
        ) => {
          event.stopPropagation()

          onSelect(id)
        }}

        onPointerOver={() => {
          document.body
            .style.cursor =
            'pointer'
        }}

        onPointerOut={() => {
          document.body
            .style.cursor =
            'default'
        }}
      >
        <sphereGeometry
          args={[
            size,
            32,
            32,
          ]}
        />

        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={
            selected ? 5 : 2.8
          }
          roughness={0.18}
        />
      </mesh>

      <mesh>
        <sphereGeometry
          args={[
            size * 1.55,
            24,
            24,
          ]}
        />

        <meshBasicMaterial
          color={color}
          transparent
          opacity={
            selected
              ? 0.16
              : 0.055
          }
          side={
            THREE.BackSide
          }
        />
      </mesh>

      {selected && (
        <mesh
          rotation={[
            Math.PI / 2,
            0,
            0,
          ]}
        >
          <torusGeometry
            args={[
              size * 1.7,
              0.025,
              12,
              80,
            ]}
          />

          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={4}
          />
        </mesh>
      )}

      <Text
        position={[
          0,
          size + 0.22,
          0,
        ]}

        fontSize={
          id ===
          'chemistry'
            ? 0.3
            : isMain
              ? 0.17
              : 0.12
        }

        color="white"

        anchorX="center"

        anchorY="middle"
      >
        {label}
      </Text>

      {id !==
        'chemistry' && (
        <Text
          position={[
            0,
            -size - 0.13,
            0,
          ]}

          fontSize={
            isMain
              ? 0.115
              : 0.085
          }

          color="#93b1c9"

          anchorX="center"

          anchorY="middle"
        >
          {count}
        </Text>
      )}
    </group>
  )
}

// ============================================
// 木全体
// ============================================

function RealTree({
  data,
  selectedId,
  onSelect,
}: {
  data: ChemTreeData

  selectedId: string

  onSelect: (
    id: string,
  ) => void
}) {
  const positions =
    useMemo(
      () =>
        buildPositions(
          data.treeDefinition,
          data.counts,
        ),

      [
        data.treeDefinition,
        data.counts,
      ],
    )

  const byId =
    useMemo(
      () =>
        Object.fromEntries(
          data.treeDefinition.map(
            (node) => [
              node.id,
              node,
            ],
          ),
        ),

      [data.treeDefinition],
    )

  const visibleNodes =
    useMemo(
      () =>
        data.treeDefinition.filter(
          (node) => {
            if (
              node.id ===
              'chemistry'
            ) {
              return true
            }

            if (
              mainBranches.includes(
                node.id,
              )
            ) {
              return true
            }

            return (
              data.counts[
                node.id
              ] ?? 0
            ) > 0
          },
        ),

      [
        data.treeDefinition,
        data.counts,
      ],
    )

  const visibleIds =
    useMemo(
      () =>
        new Set(
          visibleNodes.map(
            (node) =>
              node.id,
          ),
        ),

      [visibleNodes],
    )

  const maxCount =
    Math.max(
      1,
      ...Object.values(
        data.counts,
      ),
    )

  return (
    <group
      position={[
        0,
        -0.25,
        0,
      ]}
    >
      <CameraFocus
        target={
          selectedId === 'chemistry'
            ? [0, 1.0, 0]
            : positions[selectedId]
              ? [
                  positions[selectedId][0],
                  positions[selectedId][1] - 0.25,
                  positions[selectedId][2],
                ]
              : null
        }
        distance={
          selectedId === 'chemistry'
            ? 16.5
            : mainBranches.includes(selectedId)
              ? 9.2
              : 6.2
        }
      />
      {/* 幹 */}
      <mesh
        position={[
          0,
          -2.15,
          0,
        ]}
      >
        <cylinderGeometry
          args={[
            0.55,
            0.92,
            2.75,
            32,
          ]}
        />

        <meshStandardMaterial
          color="#67c4f5"
          emissive="#2399da"
          emissiveIntensity={
            1.5
          }
          transparent
          opacity={0.82}
          roughness={0.2}
        />
      </mesh>

      {/* 根元 */}
      <mesh
        rotation={[
          -Math.PI / 2,
          0,
          0,
        ]}

        position={[
          0,
          -3.5,
          0,
        ]}
      >
        <torusGeometry
          args={[
            1.25,
            0.035,
            16,
            100,
          ]}
        />

        <meshStandardMaterial
          color="#64d4ff"
          emissive="#64d4ff"
          emissiveIntensity={3}
        />
      </mesh>

      <mesh
        rotation={[
          -Math.PI / 2,
          0,
          0,
        ]}

        position={[
          0,
          -3.5,
          0,
        ]}
      >
        <torusGeometry
          args={[
            1.9,
            0.018,
            16,
            100,
          ]}
        />

        <meshStandardMaterial
          color="#258fff"
          emissive="#258fff"
          emissiveIntensity={2}
        />
      </mesh>

      {/* 枝 */}
      {visibleNodes.map(
        (node) => {
          if (
            !node.parent
          ) {
            return null
          }

          if (
            !visibleIds.has(
              node.parent,
            )
          ) {
            return null
          }

          const start =
            positions[
              node.parent
            ]

          const end =
            positions[node.id]

          if (
            !start ||
            !end
          ) {
            return null
          }

          const mainBranch =
            getMainBranch(
              node.id,
              byId,
            )

          const color =
            branchColors[
              mainBranch
            ] ??
            '#8ed8ff'

          const count =
            data.counts[
              node.id
            ] ?? 0

          const normalized =
            Math.sqrt(
              count /
                maxCount,
            )

          const thickness =
            node.parent ===
            'chemistry'
              ? 0.075 +
                normalized *
                  0.13
              : 0.025 +
                normalized *
                  0.075

          return (
            <Branch
              key={`${node.parent}-${node.id}`}

              start={start}

              end={end}

              color={color}

              thickness={
                thickness
              }
            />
          )
        },
      )}

      {/* CHEMTREE_GROWTH_GLOW */}

      {/* 急成長している枝を発光 */}
      {visibleNodes.map(
        (node) => {
          if (
            !node.parent ||
            !visibleIds.has(
              node.parent,
            )
          ) {
            return null
          }

          const growthInfo =
            (data as any)
              .growth?.[
                node.id
              ]

          const recent =
            Number(
              growthInfo
                ?.recent90d ??
                0,
            )

          const previous =
            Number(
              growthInfo
                ?.previous90d ??
                0,
            )

          const growthPercent =
            Number(
              growthInfo
                ?.growthPercent ??
                0,
            )

          // 小標本による
          // 異常な増加率表示を除外
          if (
            recent < 8 ||
            previous < 5 ||
            !Number.isFinite(
              growthPercent,
            ) ||
            growthPercent < 20
          ) {
            return null
          }

          const start =
            positions[
              node.parent
            ]

          const end =
            positions[
              node.id
            ]

          if (
            !start ||
            !end
          ) {
            return null
          }

          const mainBranch =
            getMainBranch(
              node.id,
              byId,
            )

          const color =
            branchColors[
              mainBranch
            ] ??
            '#8ed8ff'

          const intensity =
            Math.min(
              1,
              0.30 +
                growthPercent /
                  150,
            )

          return (
            <GrowthBranchGlow
              key={
                'growth-branch-' +
                node.id
              }

              start={start}

              end={end}

              color={color}

              intensity={
                intensity
              }

              thickness={
                mainBranches.includes(
                  node.id,
                )
                  ? 0.18
                  : 0.085
              }
            />
          )
        },
      )}

      {/* 急成長ノードの光のオーラ */}
      {visibleNodes.map(
        (node) => {
          const growthInfo =
            (data as any)
              .growth?.[
                node.id
              ]

          const recent =
            Number(
              growthInfo
                ?.recent90d ??
                0,
            )

          const previous =
            Number(
              growthInfo
                ?.previous90d ??
                0,
            )

          const growthPercent =
            Number(
              growthInfo
                ?.growthPercent ??
                0,
            )

          if (
            recent < 8 ||
            previous < 5 ||
            !Number.isFinite(
              growthPercent,
            ) ||
            growthPercent < 20
          ) {
            return null
          }

          const position =
            positions[
              node.id
            ]

          if (
            !position
          ) {
            return null
          }

          const mainBranch =
            getMainBranch(
              node.id,
              byId,
            )

          const color =
            branchColors[
              mainBranch
            ] ??
            '#8ed8ff'

          const intensity =
            Math.min(
              1,
              0.30 +
                growthPercent /
                  150,
            )

          const size =
            mainBranches.includes(
              node.id,
            )
              ? 0.72
              : 0.38

          return (
            <GrowthNodeGlow
              key={
                'growth-node-' +
                node.id
              }

              position={
                position
              }

              color={color}

              size={size}

              intensity={
                intensity
              }
            />
          )
        },
      )}

      {/* ノード */}
      {visibleNodes.map(
        (node) => {
          const position =
            positions[node.id]

          if (!position) {
            return null
          }

          const mainBranch =
            getMainBranch(
              node.id,
              byId,
            )

          const color =
            branchColors[
              mainBranch
            ] ??
            '#8ed8ff'

          return (
            <GlowNode
              key={node.id}

              id={node.id}

              label={
                node.label
              }

              position={
                position
              }

              color={color}

              count={
                data.counts[
                  node.id
                ] ?? 0
              }

              maxCount={
                maxCount
              }

              selected={
                selectedId ===
                node.id
              }

              onSelect={
                onSelect
              }

              isMain={
                mainBranches.includes(
                  node.id,
                )
              }
            />
          )
        },
      )}
    </group>
  )
}

// ============================================
// 右側パネル
// ============================================

function RightPanel({
  data,
  selectedId,
}: {
  data: ChemTreeData
  selectedId: string
}) {
  const node =
    data.treeDefinition.find(
      (item) =>
        item.id ===
        selectedId,
    )

  const count =
    data.counts[
      selectedId
    ] ?? 0

  const papers =
    data.nodePapers[
      selectedId
    ] ?? []

  const countries =
    Object.entries(
      data.countryCounts[
        selectedId
      ] ?? {},
    )
      .sort(
        (a, b) =>
          b[1] - a[1],
      )
      .slice(0, 6)

  const maxCountry =
    Math.max(
      1,
      ...countries.map(
        (
          [, value],
        ) => value,
      ),
    )

  return (
    <div
      style={{
        position: 'absolute',
        top: 82,
        right: 14,
        bottom: 16,
        width: 330,
        zIndex: 30,
        background:
          'rgba(5,14,25,0.84)',
        border:
          '1px solid rgba(120,190,255,0.18)',
        borderRadius: 18,
        padding: 18,
        color: 'white',
        backdropFilter:
          'blur(16px)',
        overflowY: 'auto',
        boxSizing:
          'border-box',
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: '#75cfff',
          letterSpacing: 1.3,
          fontWeight: 700,
        }}
      >
        MULTI-JOURNAL DATA
      </div>

      <div
        style={{
          marginTop: 12,
          fontSize: 26,
          fontWeight: 800,
        }}
      >
        {node?.label ??
          selectedId}
      </div>

      <div
        style={{
          marginTop: 5,
          color: '#8ea7bd',
          fontSize: 12,
        }}
      >
        Current dataset
      </div>

      <div
        style={{
          marginTop: 18,
          padding: 14,
          borderRadius: 12,
          background:
            'rgba(25,81,145,0.18)',
          border:
            '1px solid rgba(120,190,255,0.12)',
        }}
      >
        <div
          style={{
            fontSize: 31,
            fontWeight: 800,
            color: '#ffffff',
          }}
        >
          {count}
        </div>

        <div
          style={{
            marginTop: 3,
            fontSize: 11,
            color: '#9bb2c7',
          }}
        >
          papers in current view
        </div>
      </div>

      <SectionTitle>
        COUNTRY DISTRIBUTION
      </SectionTitle>

      <div
        style={{
          marginTop: 12,
        }}
      >
        {countries.length ===
        0 ? (
          <div
            style={{
              color:
                '#8198ac',
              fontSize: 12,
            }}
          >
            No country data
          </div>
        ) : (
          countries.map(
            ([
              country,
              value,
            ]) => (
              <div
                key={
                  country
                }
                style={{
                  marginBottom:
                    12,
                }}
              >
                <div
                  style={{
                    display:
                      'flex',
                    justifyContent:
                      'space-between',
                    fontSize: 11,
                    marginBottom: 5,
                  }}
                >
                  <span
                    style={{
                      color:
                        '#c7d8e6',
                    }}
                  >
                    {
                      country
                    }
                  </span>

                  <strong>
                    {value}
                  </strong>
                </div>

                <div
                  style={{
                    height: 5,
                    borderRadius: 10,
                    background:
                      'rgba(255,255,255,0.08)',
                  }}
                >
                  <div
                    style={{
                      width: `${
                        (
                          value /
                          maxCountry
                        ) *
                        100
                      }%`,

                      height:
                        '100%',

                      borderRadius:
                        10,

                      background:
                        'linear-gradient(90deg,#27a6ff,#68ffd8)',
                    }}
                  />
                </div>
              </div>
            ),
          )
        )}
      </div>

      <SectionTitle>
        RECENT PAPERS
      </SectionTitle>

      <div
        style={{
          marginTop: 12,
        }}
      >
        {papers
          .slice(0, 8)
          .map(
            (
              paper,
              index,
            ) => (
              <div
                key={
                  paper.doi ||
                  index
                }

                style={{
                  padding:
                    '11px 0',

                  borderBottom:
                    '1px solid rgba(255,255,255,0.07)',
                }}
              >
                <div
                  style={{
                    fontSize:
                      12,

                    lineHeight:
                      1.45,

                    color:
                      '#e1edf7',
                  }}
                >
                  {paper.title}
                </div>

                <div
                  style={{
                    marginTop:
                      5,

                    fontSize:
                      10,

                    color:
                      '#7893aa',
                  }}
                >
                  {
                    paper.published
                  }
                </div>
              </div>
            ),
          )}
      </div>
    </div>
  )
}

// ============================================
// 左側パネル
// ============================================

function LeftPanel({
  data,
  selectedId,
  onSelect,
}: {
  data: ChemTreeData
  selectedId: string
  onSelect: (
    id: string,
  ) => void
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 82,
        left: 14,
        bottom: 16,
        width: 230,
        zIndex: 30,
        background:
          'rgba(5,14,25,0.84)',
        border:
          '1px solid rgba(120,190,255,0.18)',
        borderRadius: 18,
        padding: 15,
        color: 'white',
        backdropFilter:
          'blur(16px)',
        overflowY: 'auto',
        boxSizing:
          'border-box',
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: '#7897b0',
          fontWeight: 700,
          letterSpacing: 1.2,
        }}
      >
        MULTI-JOURNAL
      </div>

      <div
        style={{
          marginTop: 8,
          fontSize: 26,
          fontWeight: 800,
        }}
      >
        {data.source.papers}
      </div>

      <div
        style={{
          color: '#93a9bd',
          fontSize: 11,
        }}
      >
        real papers
      </div>

      <div
        style={{
          height: 1,
          background:
            'rgba(255,255,255,0.08)',
          margin:
            '16px 0',
        }}
      />

      <div
        style={{
          fontSize: 10,
          color: '#7897b0',
          fontWeight: 700,
          letterSpacing: 1.2,
          marginBottom: 10,
        }}
      >
        MAIN BRANCHES
      </div>

      {mainBranches.map(
        (branchId) => {
          const definition =
            data.treeDefinition.find(
              (node) =>
                node.id ===
                branchId,
            )

          const count =
            data.counts[
              branchId
            ] ?? 0

          const color =
            branchColors[
              branchId
            ]

          return (
            <button
              key={
                branchId
              }

              onClick={() =>
                onSelect(
                  branchId,
                )
              }

              style={{
                width:
                  '100%',

                marginBottom:
                  7,

                padding:
                  '9px 10px',

                borderRadius:
                  10,

                border:
                  selectedId ===
                  branchId
                    ? `1px solid ${color}`
                    : '1px solid rgba(120,190,255,0.10)',

                background:
                  selectedId ===
                  branchId
                    ? 'rgba(30,100,180,0.24)'
                    : 'rgba(5,20,35,0.45)',

                color:
                  '#d7e6f3',

                display:
                  'flex',

                alignItems:
                  'center',

                justifyContent:
                  'space-between',

                cursor:
                  'pointer',

                textAlign:
                  'left',
              }}
            >
              <span
                style={{
                  display:
                    'flex',
                  alignItems:
                    'center',
                  gap: 8,
                  fontSize: 11,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius:
                      '50%',
                    background:
                      color,
                    boxShadow:
                      `0 0 8px ${color}`,
                  }}
                />

                {
                  definition?.label
                }
              </span>

              <strong
                style={{
                  color:
                    count > 0
                      ? '#ffffff'
                      : '#536678',
                  fontSize: 11,
                }}
              >
                {count}
              </strong>
            </button>
          )
        },
      )}

      <div
        style={{
          height: 1,
          background:
            'rgba(255,255,255,0.08)',
          margin:
            '16px 0',
        }}
      />

      <div
        style={{
          fontSize: 10,
          color: '#7897b0',
          lineHeight: 1.5,
        }}
      >
        Source:
        <br />
        JACS / Nature /
        Science / Chem
        <br />
        Crossref + OpenAlex
      </div>
    </div>
  )
}

function SectionTitle({
  children,
}: {
  children:
    React.ReactNode
}) {
  return (
    <div
      style={{
        marginTop: 24,
        fontSize: 10,
        letterSpacing: 1.2,
        color: '#81a4bf',
        fontWeight: 700,
      }}
    >
      {children}
    </div>
  )
}

// CHEMTREE_MULTIJOURNAL_UI

type JournalFilter =
  | 'All'
  | 'JACS'
  | 'Nature'
  | 'Science'
  | 'Chem'

const JOURNAL_FILTERS: JournalFilter[] = [
  'All',
  'JACS',
  'Nature',
  'Science',
  'Chem',
]

function buildJournalView(
  data: ChemTreeData,
  journalFilter: JournalFilter,
): ChemTreeData {
  if (
    journalFilter === 'All'
  ) {
    return data
  }

  const rawData =
    data as any

  const allPapers =
    (
      rawData.papers ??
      []
    ) as Paper[]

  const journalCounts =
    (
      rawData.journalCounts ??
      {}
    ) as Record<
      string,
      Record<string, number>
    >

  const nodePapers =
    Object.fromEntries(
      Object.entries(
        data.nodePapers,
      ).map(
        ([nodeId, papers]) => [
          nodeId,

          papers.filter(
            (paper) =>
              String(
                (paper as any)
                  .journal ??
                  '',
              ) ===
              journalFilter,
          ),
        ],
      ),
    ) as Record<
      string,
      Paper[]
    >

  // rootだけは全論文配列から作る
  nodePapers.chemistry =
    allPapers.filter(
      (paper) =>
        String(
          (paper as any)
            .journal ??
            '',
        ) ===
        journalFilter,
    )

  const counts =
    Object.fromEntries(
      data.treeDefinition.map(
        (node) => [
          node.id,

          journalCounts[
            node.id
          ]?.[
            journalFilter
          ] ??
          nodePapers[
            node.id
          ]?.length ??
          0,
        ],
      ),
    )

  const countryCounts:
    CountryCounts = {}

  for (
    const node of
      data.treeDefinition
  ) {
    const nodeId =
      node.id

    const countries:
      Record<
        string,
        number
      > = {}

    for (
      const paper of
        nodePapers[
          nodeId
        ] ?? []
    ) {
      for (
        const country of
          paper.openAlex
            ?.countries ??
          []
      ) {
        const name =
          country.name ||
          country.code

        if (!name) {
          continue
        }

        countries[
          name
        ] =
          (
            countries[
              name
            ] ?? 0
          ) + 1
      }
    }

    countryCounts[
      nodeId
    ] = countries
  }

  const paperCount =
    journalCounts
      .chemistry?.[
        journalFilter
      ] ??
    nodePapers
      .chemistry
      .length

  return {
    ...data,

    counts,

    countryCounts,

    nodePapers,

    source: {
      ...data.source,
      papers:
        paperCount,
    },
  }
}


// CHEMTREE_PERIOD_UI_V2

type PeriodFilter =
  | '1M'
  | '3M'
  | '6M'
  | '1Y'

const PERIOD_FILTERS: PeriodFilter[] = [
  '1M',
  '3M',
  '6M',
  '1Y',
]

const PERIOD_DAYS: Record<
  PeriodFilter,
  number
> = {
  '1M': 30,
  '3M': 90,
  '6M': 180,
  '1Y': 365,
}

function isPaperInUiPeriod(
  paper: Paper,
  data: ChemTreeData,
  period: PeriodFilter,
) {
  if (
    period === '1Y'
  ) {
    return true
  }

  const rawData =
    data as any

  const endText =
    rawData.period?.end

  if (!endText) {
    return true
  }

  const endMs =
    Date.parse(
      String(endText) +
        'T23:59:59Z',
    )

  const published =
    String(
      paper.published ??
        '',
    )

  const paperMs =
    Date.parse(
      published +
        'T00:00:00Z',
    )

  if (
    !Number.isFinite(
      paperMs,
    )
  ) {
    return false
  }

  const startMs =
    endMs -
    PERIOD_DAYS[
      period
    ] *
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

function buildPeriodJournalView(
  data: ChemTreeData,
  period: PeriodFilter,
  journal: JournalFilter,
): ChemTreeData {
  const rawData =
    data as any

  const aggregate =
    rawData
      .viewAggregates?.[
        period
      ]?.[
        journal
      ]

  if (!aggregate) {
    return buildJournalView(
      data,
      journal,
    )
  }

  const allPapers =
    (
      rawData.papers ??
      []
    ) as Paper[]

  const matchesView = (
    paper: Paper,
  ) => {
    const paperJournal =
      String(
        (paper as any)
          .journal ??
          '',
      )

    const journalMatches =
      journal === 'All' ||
      paperJournal ===
        journal

    return (
      journalMatches &&
      isPaperInUiPeriod(
        paper,
        data,
        period,
      )
    )
  }

  const nodePapers =
    Object.fromEntries(
      Object.entries(
        data.nodePapers,
      ).map(
        ([nodeId, papers]) => [
          nodeId,
          papers.filter(
            matchesView,
          ),
        ],
      ),
    ) as Record<
      string,
      Paper[]
    >

  nodePapers.chemistry =
    allPapers
      .filter(
        matchesView,
      )
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
      )

  return {
    ...data,

    counts:
      aggregate.counts,

    countryCounts:
      aggregate.countryCounts,

    nodePapers,

    source: {
      ...data.source,

      papers:
        aggregate
          .counts
          .chemistry ??
        0,
    },
  }
}

// ============================================
// App
// ============================================

function App() {
  const [data, setData] =
    useState<
      ChemTreeData | null
    >(null)

  const [
    selectedId,
    setSelectedId,
  ] =
    useState('catalysis')

  const [
    error,
    setError,
  ] =
    useState('')

  const [
    query,
    setQuery,
  ] =
    useState('')

  const [
    journalFilter,
    setJournalFilter,
  ] =
    useState<JournalFilter>(
      'All',
    )

  useEffect(() => {
    fetch(
      new URL(
        'data/chemtree-1y.json',
        document.baseURI,
      ).toString(),
    )
      .then((response) => {
        if (
          !response.ok
        ) {
          throw new Error(
            'chemtree-real.json を読み込めませんでした',
          )
        }

        return response.json()
      })

      .then(
        (
          result: ChemTreeData,
        ) => {
          setData(
            result,
          )
        },
      )

      .catch(
        (err) => {
          setError(
            String(err),
          )
        },
      )
  }, [])

  const [
    periodFilter,
    setPeriodFilter,
  ] =
    useState<PeriodFilter>(
      '1Y',
    )

  const viewData =
    useMemo(
      () =>
        data
          ? buildPeriodJournalView(
              data,
              periodFilter,
              journalFilter,
            )
          : null,

      [
        data,
        periodFilter,
        journalFilter,
      ],
    )

  const runSearch = () => {
    if (!data) return

    const cleaned =
      query
        .trim()
        .toLowerCase()

    if (!cleaned) {
      return
    }

    const node =
      data.treeDefinition.find(
        (item) =>
          item.label
            .toLowerCase()
            .includes(
              cleaned,
            ),
      )

    if (node) {
      setSelectedId(
        node.id,
      )

      return
    }

    const paper =
      data.nodePapers
        .chemistry
        ?.find(
          (item) =>
            item.title
              .toLowerCase()
              .includes(
                cleaned,
              ),
        )

    if (
      paper?.classification
        ?.branch
    ) {
      setSelectedId(
        paper.classification
          .branch,
      )
    }
  }

  if (error) {
    return (
      <div
        style={{
          padding: 30,
          background:
            '#020711',
          color: 'white',
          minHeight:
            '100vh',
        }}
      >
        エラー：
        {error}
      </div>
    )
  }

  if (!data) {
    return (
      <div
        style={{
          position:
            'fixed',
          inset: 0,
          display:
            'grid',
          placeItems:
            'center',
          background:
            '#020711',
          color:
            '#80d8ff',
          fontFamily:
            'Arial, sans-serif',
          fontSize: 18,
        }}
      >
        Loading real
        JACS data...
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        overflow:
          'hidden',

        background:
          'radial-gradient(circle at 50% 42%, #0a2239 0%, #040c16 48%, #02050a 100%)',

        color: 'white',

        fontFamily:
          'Arial, sans-serif',
      }}
    >
      {/* TOP */}
      <div
        style={{
          position:
            'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 70,
          zIndex: 40,

          display:
            'flex',

          alignItems:
            'center',

          padding:
            '0 18px',

          background:
            'rgba(3,10,19,0.76)',

          backdropFilter:
            'blur(14px)',

          borderBottom:
            '1px solid rgba(120,190,255,0.12)',
        }}
      >
        <div
          style={{
            width: 240,
          }}
        >
          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
              letterSpacing:
                '-1px',
            }}
          >
            ChemTree
          </div>

          <div
            style={{
              fontSize: 10,
              color:
                '#8faac2',
            }}
          >
            Real-time
            Chemistry
            Intelligence
          </div>
        </div>

        <div
          style={{
            flex: 1,
            display:
              'flex',
            justifyContent:
              'center',
          }}
        >
          <div
            style={{
              position:
                'relative',
              width:
                'min(600px,44vw)',
            }}
          >
            <input
              value={query}

              onChange={(
                event,
              ) =>
                setQuery(
                  event.target
                    .value,
                )
              }

              onKeyDown={(
                event,
              ) => {
                if (
                  event.key ===
                  'Enter'
                ) {
                  runSearch()
                }
              }}

              placeholder="Search topic or paper..."

              style={{
                width:
                  '100%',
                height: 40,
                padding:
                  '0 95px 0 16px',
                boxSizing:
                  'border-box',
                borderRadius:
                  22,
                border:
                  '1px solid rgba(120,190,255,0.18)',
                background:
                  '#071421',
                color:
                  'white',
                outline:
                  'none',
              }}
            />

            <button
              onClick={
                runSearch
              }

              style={{
                position:
                  'absolute',
                top: 4,
                right: 4,
                height: 32,
                padding:
                  '0 15px',
                border: 0,
                borderRadius:
                  18,
                background:
                  'linear-gradient(90deg,#178cff,#40dcff)',
                color:
                  'white',
                cursor:
                  'pointer',
              }}
            >
              Search
            </button>
          </div>
        </div>

        <div
          style={{
            width: 240,
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <button
            onClick={() => {
              setSelectedId('chemistry')
            }}
            style={{
              height: 34,
              padding: '0 14px',
              borderRadius: 18,
              border:
                '1px solid rgba(100,200,255,0.28)',
              background:
                'rgba(20,90,160,0.20)',
              color: '#a8e8ff',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Reset View
          </button>

          <div
            style={{
              color: '#71dfff',
              fontSize: 11,
              whiteSpace: 'nowrap',
            }}
          >
            MULTI-JOURNAL · REAL DATA
          </div>
        </div>
      </div>

      <div
        style={{
          position:
            'absolute',
          top: 80,
          left: '50%',
          transform:
            'translateX(-50%)',
          zIndex: 38,
          display: 'flex',
          gap: 6,
          padding: 5,
          borderRadius: 24,
          background:
            'rgba(4,14,25,0.86)',
          border:
            '1px solid rgba(120,190,255,0.16)',
          backdropFilter:
            'blur(14px)',
        }}
      >
        {JOURNAL_FILTERS.map(
          (journal) => {
            const active =
              journalFilter ===
              journal

            return (
              <button
                key={journal}
                onClick={() => {
                  setJournalFilter(
                    journal,
                  )

                  setSelectedId(
                    'chemistry',
                  )
                }}
                style={{
                  height: 30,
                  padding:
                    '0 13px',
                  borderRadius:
                    16,
                  border:
                    active
                      ? '1px solid rgba(80,210,255,0.65)'
                      : '1px solid rgba(120,190,255,0.10)',
                  background:
                    active
                      ? 'linear-gradient(90deg,rgba(20,125,220,0.72),rgba(30,190,220,0.55))'
                      : 'rgba(8,24,39,0.65)',
                  color:
                    active
                      ? '#ffffff'
                      : '#8faabd',
                  fontSize: 10,
                  fontWeight:
                    active
                      ? 700
                      : 500,
                  cursor:
                    'pointer',
                  boxShadow:
                    active
                      ? '0 0 14px rgba(50,190,255,0.22)'
                      : 'none',
                }}
              >
                {journal}
              </button>
            )
          },
        )}
      </div>

      <div
        style={{
          position:
            'absolute',
          top: 120,
          left: '50%',
          transform:
            'translateX(-50%)',
          zIndex: 38,
          display: 'flex',
          gap: 6,
          padding: 5,
          borderRadius: 24,
          background:
            'rgba(4,14,25,0.86)',
          border:
            '1px solid rgba(120,190,255,0.16)',
          backdropFilter:
            'blur(14px)',
        }}
      >
        {PERIOD_FILTERS.map(
          (period) => {
            const active =
              periodFilter ===
              period

            return (
              <button
                key={period}

                onClick={() => {
                  setPeriodFilter(
                    period,
                  )

                  setSelectedId(
                    'chemistry',
                  )
                }}

                style={{
                  height: 30,
                  minWidth: 44,
                  padding:
                    '0 13px',
                  borderRadius:
                    16,

                  border:
                    active
                      ? '1px solid rgba(130,230,180,0.70)'
                      : '1px solid rgba(120,190,255,0.10)',

                  background:
                    active
                      ? 'linear-gradient(90deg,rgba(20,150,115,0.75),rgba(45,205,165,0.55))'
                      : 'rgba(8,24,39,0.65)',

                  color:
                    active
                      ? '#ffffff'
                      : '#8faabd',

                  fontSize: 10,

                  fontWeight:
                    active
                      ? 700
                      : 500,

                  cursor:
                    'pointer',

                  boxShadow:
                    active
                      ? '0 0 14px rgba(60,220,170,0.22)'
                      : 'none',
                }}
              >
                {period}
              </button>
            )
          },
        )}
      </div>

      <LeftPanel
        data={viewData ?? data}
        selectedId={
          selectedId
        }
        onSelect={
          setSelectedId
        }
      />

      <RightPanel
        data={viewData ?? data}
        selectedId={
          selectedId
        }
      />

      {/* 3D SPACE */}
      <div
        style={{
          position:
            'absolute',
          top: 70,
          left: 245,
          right: 345,
          bottom: 0,
        }}
      >
        <Canvas
          camera={{
            position: [
              0,
              0.6,
              11.8,
            ],
            fov: 47,
          }}
        >
          <fog
            attach="fog"
            args={[
              '#020711',
              11,
              28,
            ]}
          />

          <ambientLight
            intensity={0.85}
          />

          <pointLight
            position={[
              5,
              7,
              8,
            ]}
            intensity={80}
            color="#79d8ff"
          />

          <pointLight
            position={[
              -6,
              4,
              4,
            ]}
            intensity={55}
            color="#a4ffc0"
          />

          <pointLight
            position={[
              0,
              -2,
              6,
            ]}
            intensity={45}
            color="#af7eff"
          />

          <Sparkles
            count={240}
            scale={[
              16,
              12,
              12,
            ]}
            size={1.5}
            speed={0.3}
            opacity={0.65}
          />

          <RealTree
            data={viewData ?? data}
            selectedId={
              selectedId
            }
            onSelect={
              setSelectedId
            }
          />

          <OrbitControls
            makeDefault
            enableRotate
            enableZoom
            enablePan
            minDistance={3}
            maxDistance={20}
          />
        </Canvas>

        <div
          style={{
            position:
              'absolute',
            bottom: 18,
            left: '50%',
            transform:
              'translateX(-50%)',
            padding:
              '9px 15px',
            borderRadius:
              30,
            background:
              'rgba(5,16,28,0.72)',
            border:
              '1px solid rgba(110,190,255,0.22)',
            color:
              '#cceaff',
            fontSize: 11,
            pointerEvents:
              'none',
          }}
        >
          Drag: Rotate　/　
          Wheel: Zoom　/　
          Click: Explore
        </div>
      </div>
    </div>
  )
}

export default App