import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Canvas, useFrame, } from '@react-three/fiber';
import { OrbitControls, Sparkles, Text, } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState, } from 'react';
import * as THREE from 'three';
import { gunzipSync, strFromU8 } from 'fflate';
import CameraFocus from './CameraFocus.js';
import { GrowthNodeGlow, GrowthBranchGlow, } from './GrowthGlow.js';
function getPaperHref(paper) {
    if (paper.url)
        return paper.url;
    if (paper.doi) {
        const doi = paper.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
        return `https://doi.org/${doi}`;
    }
    return '';
}
function useMobileLayout() {
    const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 820);
    useEffect(() => {
        const update = () => setIsMobile(window.innerWidth <= 820);
        update();
        window.addEventListener('resize', update);
        window.addEventListener('orientationchange', update);
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('orientationchange', update);
        };
    }, []);
    return isMobile;
}
// ============================================
// 色
// ============================================
const branchColors = {
    catalysis: '#72ff9b',
    materials: '#68b7ff',
    synthesis: '#c887ff',
    biochem: '#ffd478',
    analytical: '#67f0e5',
    physical: '#ff8fa8',
    theory: '#ffb86c',
    unclassified: '#718096',
    chemistry: '#8ed8ff',
};
// ============================================
// 主枝の3D位置
// ============================================
const mainPositions = {
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
};
const mainBranches = [
    'catalysis',
    'materials',
    'synthesis',
    'biochem',
    'analytical',
    'physical',
    'theory',
];
// ============================================
// 親をたどって主枝を判定
// ============================================
function getMainBranch(nodeId, byId) {
    if (nodeId === 'chemistry') {
        return 'chemistry';
    }
    if (nodeId === 'unclassified') {
        return 'unclassified';
    }
    let current = byId[nodeId];
    const visited = new Set();
    while (current &&
        current.parent &&
        !visited.has(current.id)) {
        visited.add(current.id);
        if (current.parent ===
            'chemistry') {
            return current.id;
        }
        current =
            byId[current.parent];
    }
    return 'unclassified';
}
// ============================================
// 位置を自動計算
// ============================================
function buildPositions(definitions, counts) {
    const positions = {
        ...mainPositions,
    };
    const byId = Object.fromEntries(definitions.map((node) => [
        node.id,
        node,
    ]));
    const childrenMap = new Map();
    for (const node of definitions) {
        if (!node.parent)
            continue;
        if (!childrenMap.has(node.parent)) {
            childrenMap.set(node.parent, []);
        }
        childrenMap
            .get(node.parent)
            .push(node);
    }
    function placeChildren(parentId, depth) {
        const parentPos = positions[parentId];
        if (!parentPos)
            return;
        const children = (childrenMap.get(parentId) ?? [])
            .filter((node) => (counts[node.id] ??
            0) > 0)
            .sort((a, b) => (counts[b.id] ??
            0) -
            (counts[a.id] ??
                0));
        if (children.length === 0) {
            return;
        }
        const parentDefinition = byId[parentId];
        const grandParentId = parentDefinition?.parent;
        const grandParentPos = grandParentId
            ? positions[grandParentId]
            : mainPositions.chemistry;
        const origin = grandParentPos ??
            mainPositions.chemistry;
        // 親枝が伸びてきた方向
        const outward = new THREE.Vector3(parentPos[0] -
            origin[0], parentPos[1] -
            origin[1], parentPos[2] -
            origin[2]);
        if (outward.lengthSq() <
            0.0001) {
            outward.set(parentPos[0], 1, parentPos[2]);
        }
        outward.normalize();
        // outward と直交する軸
        let reference = new THREE.Vector3(0, 1, 0);
        if (Math.abs(outward.dot(reference)) > 0.92) {
            reference =
                new THREE.Vector3(0, 0, 1);
        }
        const side = new THREE.Vector3()
            .crossVectors(outward, reference)
            .normalize();
        const around = new THREE.Vector3()
            .crossVectors(side, outward)
            .normalize();
        // 親ノードごとに少し違う回転角
        const seed = parentId
            .split('')
            .reduce((total, character) => total +
            character.charCodeAt(0), 0);
        const phase = (seed %
            360) *
            Math.PI /
            180;
        // 子枝を親枝の周囲へ立体的に展開
        const totalAngle = children.length === 1
            ? 0
            : Math.min(Math.PI * 1.55, Math.PI *
                0.48 *
                (children.length -
                    1));
        children.forEach((child, index) => {
            const relative = children.length === 1
                ? 0
                : index /
                    (children.length -
                        1) -
                    0.5;
            const angle = phase +
                relative *
                    totalAngle;
            const childCount = counts[child.id] ?? 0;
            const forward = 1.15 +
                depth *
                    0.28 +
                Math.min(0.35, Math.sqrt(childCount) *
                    0.035);
            const radius = 0.72 +
                depth *
                    0.20 +
                Math.min(0.28, children.length *
                    0.035);
            const childPos = new THREE.Vector3(...parentPos);
            childPos.add(outward
                .clone()
                .multiplyScalar(forward));
            childPos.add(side
                .clone()
                .multiplyScalar(Math.cos(angle) *
                radius));
            childPos.add(around
                .clone()
                .multiplyScalar(Math.sin(angle) *
                radius));
            childPos.y +=
                0.28 +
                    depth *
                        0.12;
            positions[child.id] = [
                childPos.x,
                childPos.y,
                childPos.z,
            ];
            placeChildren(child.id, depth + 1);
        });
    }
    for (const branch of mainBranches) {
        placeChildren(branch, 1);
    }
    return positions;
}
// ============================================
// 曲線状の枝
// ============================================
function Branch({ start, end, color, thickness, }) {
    const curve = useMemo(() => {
        const s = new THREE.Vector3(...start);
        const e = new THREE.Vector3(...end);
        const mid1 = new THREE.Vector3(s.x * 0.68 +
            e.x * 0.32, s.y * 0.68 +
            e.y * 0.32 +
            0.28, s.z * 0.68 +
            e.z * 0.32);
        const mid2 = new THREE.Vector3(s.x * 0.30 +
            e.x * 0.70, s.y * 0.30 +
            e.y * 0.70 +
            0.16, s.z * 0.30 +
            e.z * 0.70);
        return new THREE
            .CatmullRomCurve3([
            s,
            mid1,
            mid2,
            e,
        ]);
    }, [start, end]);
    return (_jsxs("mesh", { children: [_jsx("tubeGeometry", { args: [
                    curve,
                    48,
                    thickness,
                    10,
                    false,
                ] }), _jsx("meshStandardMaterial", { color: color, emissive: color, emissiveIntensity: 1.8, transparent: true, opacity: 0.84, roughness: 0.25 })] }));
}
// ============================================
// 光るノード
// ============================================
function GlowNode({ id, label, position, color, count, maxCount, selected, onSelect, isMain, }) {
    const meshRef = useRef(null);
    const normalized = maxCount > 0
        ? Math.sqrt(count /
            maxCount)
        : 0;
    const size = id === 'chemistry'
        ? 0.38
        : isMain
            ? 0.25 +
                normalized * 0.14
            : 0.11 +
                normalized * 0.13;
    useFrame((state) => {
        if (!meshRef.current) {
            return;
        }
        const pulse = 1 +
            Math.sin(state.clock
                .elapsedTime *
                2 +
                position[0]) *
                0.035;
        meshRef.current
            .scale
            .setScalar(selected
            ? pulse * 1.18
            : pulse);
    });
    return (_jsxs("group", { position: position, children: [_jsxs("mesh", { ref: meshRef, onClick: (event) => {
                    event.stopPropagation();
                    onSelect(id);
                }, onPointerOver: () => {
                    document.body
                        .style.cursor =
                        'pointer';
                }, onPointerOut: () => {
                    document.body
                        .style.cursor =
                        'default';
                }, children: [_jsx("sphereGeometry", { args: [
                            size,
                            32,
                            32,
                        ] }), _jsx("meshStandardMaterial", { color: color, emissive: color, emissiveIntensity: selected ? 5 : 2.8, roughness: 0.18 })] }), _jsxs("mesh", { children: [_jsx("sphereGeometry", { args: [
                            size * 1.55,
                            24,
                            24,
                        ] }), _jsx("meshBasicMaterial", { color: color, transparent: true, opacity: selected
                            ? 0.16
                            : 0.055, side: THREE.BackSide })] }), selected && (_jsxs("mesh", { rotation: [
                    Math.PI / 2,
                    0,
                    0,
                ], children: [_jsx("torusGeometry", { args: [
                            size * 1.7,
                            0.025,
                            12,
                            80,
                        ] }), _jsx("meshStandardMaterial", { color: color, emissive: color, emissiveIntensity: 4 })] })), _jsx(Text, { position: [
                    0,
                    size + 0.22,
                    0,
                ], fontSize: id ===
                    'chemistry'
                    ? 0.3
                    : isMain
                        ? 0.17
                        : 0.12, color: "white", anchorX: "center", anchorY: "middle", children: label }), id !==
                'chemistry' && (_jsx(Text, { position: [
                    0,
                    -size - 0.13,
                    0,
                ], fontSize: isMain
                    ? 0.115
                    : 0.085, color: "#93b1c9", anchorX: "center", anchorY: "middle", children: count }))] }));
}
// ============================================
// 木全体
// ============================================
function RealTree({ data, selectedId, onSelect, }) {
    const positions = useMemo(() => buildPositions(data.treeDefinition, data.counts), [
        data.treeDefinition,
        data.counts,
    ]);
    const byId = useMemo(() => Object.fromEntries(data.treeDefinition.map((node) => [
        node.id,
        node,
    ])), [data.treeDefinition]);
    const visibleNodes = useMemo(() => data.treeDefinition.filter((node) => {
        if (node.id ===
            'chemistry') {
            return true;
        }
        if (mainBranches.includes(node.id)) {
            return true;
        }
        return (data.counts[node.id] ?? 0) > 0;
    }), [
        data.treeDefinition,
        data.counts,
    ]);
    const visibleIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);
    const maxCount = Math.max(1, ...Object.values(data.counts));
    return (_jsxs("group", { position: [
            0,
            -0.25,
            0,
        ], children: [_jsx(CameraFocus, { target: selectedId === 'chemistry'
                    ? [0, 1.0, 0]
                    : positions[selectedId]
                        ? [
                            positions[selectedId][0],
                            positions[selectedId][1] - 0.25,
                            positions[selectedId][2],
                        ]
                        : null, distance: selectedId === 'chemistry'
                    ? 16.5
                    : mainBranches.includes(selectedId)
                        ? 9.2
                        : 6.2 }), _jsxs("mesh", { position: [
                    0,
                    -2.15,
                    0,
                ], children: [_jsx("cylinderGeometry", { args: [
                            0.55,
                            0.92,
                            2.75,
                            32,
                        ] }), _jsx("meshStandardMaterial", { color: "#67c4f5", emissive: "#2399da", emissiveIntensity: 1.5, transparent: true, opacity: 0.82, roughness: 0.2 })] }), _jsxs("mesh", { rotation: [
                    -Math.PI / 2,
                    0,
                    0,
                ], position: [
                    0,
                    -3.5,
                    0,
                ], children: [_jsx("torusGeometry", { args: [
                            1.25,
                            0.035,
                            16,
                            100,
                        ] }), _jsx("meshStandardMaterial", { color: "#64d4ff", emissive: "#64d4ff", emissiveIntensity: 3 })] }), _jsxs("mesh", { rotation: [
                    -Math.PI / 2,
                    0,
                    0,
                ], position: [
                    0,
                    -3.5,
                    0,
                ], children: [_jsx("torusGeometry", { args: [
                            1.9,
                            0.018,
                            16,
                            100,
                        ] }), _jsx("meshStandardMaterial", { color: "#258fff", emissive: "#258fff", emissiveIntensity: 2 })] }), visibleNodes.map((node) => {
                if (!node.parent) {
                    return null;
                }
                if (!visibleIds.has(node.parent)) {
                    return null;
                }
                const start = positions[node.parent];
                const end = positions[node.id];
                if (!start ||
                    !end) {
                    return null;
                }
                const mainBranch = getMainBranch(node.id, byId);
                const color = branchColors[mainBranch] ??
                    '#8ed8ff';
                const count = data.counts[node.id] ?? 0;
                const normalized = Math.sqrt(count /
                    maxCount);
                const thickness = node.parent ===
                    'chemistry'
                    ? 0.075 +
                        normalized *
                            0.13
                    : 0.025 +
                        normalized *
                            0.075;
                return (_jsx(Branch, { start: start, end: end, color: color, thickness: thickness }, `${node.parent}-${node.id}`));
            }), visibleNodes.map((node) => {
                if (!node.parent ||
                    !visibleIds.has(node.parent)) {
                    return null;
                }
                const growthInfo = data
                    .growth?.[node.id];
                const recent = Number(growthInfo
                    ?.recent90d ??
                    0);
                const previous = Number(growthInfo
                    ?.previous90d ??
                    0);
                const growthPercent = Number(growthInfo
                    ?.growthPercent ??
                    0);
                // 小標本による
                // 異常な増加率表示を除外
                if (recent < 8 ||
                    previous < 5 ||
                    !Number.isFinite(growthPercent) ||
                    growthPercent < 20) {
                    return null;
                }
                const start = positions[node.parent];
                const end = positions[node.id];
                if (!start ||
                    !end) {
                    return null;
                }
                const mainBranch = getMainBranch(node.id, byId);
                const color = branchColors[mainBranch] ??
                    '#8ed8ff';
                const intensity = Math.min(1, 0.30 +
                    growthPercent /
                        150);
                return (_jsx(GrowthBranchGlow, { start: start, end: end, color: color, intensity: intensity, thickness: mainBranches.includes(node.id)
                        ? 0.18
                        : 0.085 }, 'growth-branch-' +
                    node.id));
            }), visibleNodes.map((node) => {
                const growthInfo = data
                    .growth?.[node.id];
                const recent = Number(growthInfo
                    ?.recent90d ??
                    0);
                const previous = Number(growthInfo
                    ?.previous90d ??
                    0);
                const growthPercent = Number(growthInfo
                    ?.growthPercent ??
                    0);
                if (recent < 8 ||
                    previous < 5 ||
                    !Number.isFinite(growthPercent) ||
                    growthPercent < 20) {
                    return null;
                }
                const position = positions[node.id];
                if (!position) {
                    return null;
                }
                const mainBranch = getMainBranch(node.id, byId);
                const color = branchColors[mainBranch] ??
                    '#8ed8ff';
                const intensity = Math.min(1, 0.30 +
                    growthPercent /
                        150);
                const size = mainBranches.includes(node.id)
                    ? 0.72
                    : 0.38;
                return (_jsx(GrowthNodeGlow, { position: position, color: color, size: size, intensity: intensity }, 'growth-node-' +
                    node.id));
            }), visibleNodes.map((node) => {
                const position = positions[node.id];
                if (!position) {
                    return null;
                }
                const mainBranch = getMainBranch(node.id, byId);
                const color = branchColors[mainBranch] ??
                    '#8ed8ff';
                return (_jsx(GlowNode, { id: node.id, label: node.label, position: position, color: color, count: data.counts[node.id] ?? 0, maxCount: maxCount, selected: selectedId ===
                        node.id, onSelect: onSelect, isMain: mainBranches.includes(node.id) }, node.id));
            })] }));
}
// ============================================
// 右側パネル
// ============================================
function RightPanel({ data, selectedId, isMobile = false, onClose, }) {
    const node = data.treeDefinition.find((item) => item.id ===
        selectedId);
    const count = data.counts[selectedId] ?? 0;
    const papers = data.nodePapers[selectedId] ?? [];
    const countries = Object.entries(data.countryCounts[selectedId] ?? {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);
    const maxCountry = Math.max(1, ...countries.map(([, value]) => value));
    return (_jsxs("div", { style: {
            position: 'absolute',
            top: isMobile ? 154 : 82,
            right: isMobile ? 10 : 14,
            left: isMobile ? 10 : undefined,
            bottom: isMobile ? 62 : 16,
            width: isMobile ? 'auto' : 330,
            zIndex: isMobile ? 55 : 30,
            background: 'rgba(5,14,25,0.84)',
            border: '1px solid rgba(120,190,255,0.18)',
            borderRadius: isMobile ? 14 : 18,
            padding: isMobile ? 16 : 18,
            color: 'white',
            backdropFilter: 'blur(16px)',
            overflowY: 'auto',
            boxSizing: 'border-box',
        }, children: [isMobile && onClose && (_jsx("button", { onClick: onClose, "aria-label": "Close papers panel", style: {
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    border: '1px solid rgba(120,190,255,0.24)',
                    background: 'rgba(4,18,31,0.86)',
                    color: '#d8efff',
                    fontSize: 18,
                    cursor: 'pointer',
                }, children: "\u00D7" })), _jsx("div", { style: {
                    fontSize: 10,
                    color: '#75cfff',
                    letterSpacing: 1.3,
                    fontWeight: 700,
                }, children: "MULTI-JOURNAL DATA" }), _jsx("div", { style: {
                    marginTop: 12,
                    fontSize: 26,
                    fontWeight: 800,
                }, children: node?.label ??
                    selectedId }), _jsx("div", { style: {
                    marginTop: 5,
                    color: '#8ea7bd',
                    fontSize: 12,
                }, children: "Current dataset" }), _jsxs("div", { style: {
                    marginTop: 18,
                    padding: 14,
                    borderRadius: 12,
                    background: 'rgba(25,81,145,0.18)',
                    border: '1px solid rgba(120,190,255,0.12)',
                }, children: [_jsx("div", { style: {
                            fontSize: 31,
                            fontWeight: 800,
                            color: '#ffffff',
                        }, children: count }), _jsx("div", { style: {
                            marginTop: 3,
                            fontSize: isMobile ? 10 : 11,
                            color: '#9bb2c7',
                        }, children: "papers in current view" })] }), _jsx(SectionTitle, { children: "COUNTRY DISTRIBUTION" }), _jsx("div", { style: {
                    marginTop: 12,
                }, children: countries.length ===
                    0 ? (_jsx("div", { style: {
                        color: '#8198ac',
                        fontSize: 12,
                    }, children: "No country data" })) : (countries.map(([country, value,]) => (_jsxs("div", { style: {
                        marginBottom: 12,
                    }, children: [_jsxs("div", { style: {
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontSize: 11,
                                marginBottom: 5,
                            }, children: [_jsx("span", { style: {
                                        color: '#c7d8e6',
                                    }, children: country }), _jsx("strong", { children: value })] }), _jsx("div", { style: {
                                height: 5,
                                borderRadius: 10,
                                background: 'rgba(255,255,255,0.08)',
                            }, children: _jsx("div", { style: {
                                    width: `${(value /
                                        maxCountry) *
                                        100}%`,
                                    height: '100%',
                                    borderRadius: 10,
                                    background: 'linear-gradient(90deg,#27a6ff,#68ffd8)',
                                } }) })] }, country)))) }), _jsx(SectionTitle, { children: "RECENT PAPERS" }), _jsx("div", { style: {
                    marginTop: 12,
                }, children: papers
                    .slice(0, 8)
                    .map((paper, index) => ((() => {
                    const href = getPaperHref(paper);
                    const content = (_jsxs(_Fragment, { children: [_jsx("div", { style: {
                                    fontSize: isMobile ? 13.5 : 12,
                                    lineHeight: 1.5,
                                    color: '#e1edf7',
                                    fontWeight: 600,
                                }, children: paper.title }), _jsxs("div", { style: {
                                    marginTop: 6,
                                    display: 'flex',
                                    gap: 10,
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    fontSize: 10.5,
                                    color: '#7893aa',
                                }, children: [_jsx("span", { children: paper.published }), href && _jsx("span", { style: { color: '#71dfff', fontWeight: 800 }, children: "OPEN PAPER \u2197" })] })] }));
                    return href ? (_jsx("a", { href: href, target: "_blank", rel: "noopener noreferrer", style: {
                            display: 'block',
                            padding: isMobile ? '14px 2px' : '11px 0',
                            borderBottom: '1px solid rgba(255,255,255,0.07)',
                            textDecoration: 'none',
                            WebkitTapHighlightColor: 'transparent',
                        }, children: content }, paper.doi || index)) : (_jsx("div", { style: {
                            padding: isMobile ? '14px 2px' : '11px 0',
                            borderBottom: '1px solid rgba(255,255,255,0.07)',
                        }, children: content }, paper.doi || index));
                })())) })] }));
}
// ============================================
// 左側パネル
// ============================================
function LeftPanel({ data, selectedId, onSelect, isMobile = false, onClose, }) {
    return (_jsxs("div", { style: {
            position: 'absolute',
            top: isMobile ? 154 : 82,
            left: isMobile ? 10 : 14,
            right: isMobile ? 10 : undefined,
            bottom: isMobile ? 62 : 16,
            width: isMobile ? 'auto' : 230,
            zIndex: isMobile ? 55 : 30,
            background: 'rgba(5,14,25,0.84)',
            border: '1px solid rgba(120,190,255,0.18)',
            borderRadius: isMobile ? 14 : 18,
            padding: isMobile ? 16 : 15,
            color: 'white',
            backdropFilter: 'blur(16px)',
            overflowY: 'auto',
            boxSizing: 'border-box',
        }, children: [isMobile && onClose && (_jsx("button", { onClick: onClose, "aria-label": "Close topics panel", style: {
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    border: '1px solid rgba(120,190,255,0.24)',
                    background: 'rgba(4,18,31,0.86)',
                    color: '#d8efff',
                    fontSize: 18,
                    cursor: 'pointer',
                }, children: "\u00D7" })), _jsx("div", { style: {
                    fontSize: 10,
                    color: '#7897b0',
                    fontWeight: 700,
                    letterSpacing: 1.2,
                }, children: "MULTI-JOURNAL" }), _jsx("div", { style: {
                    marginTop: 8,
                    fontSize: 26,
                    fontWeight: 800,
                }, children: data.source.papers }), _jsx("div", { style: {
                    color: '#93a9bd',
                    fontSize: 11,
                }, children: "real papers" }), _jsx("div", { style: {
                    height: 1,
                    background: 'rgba(255,255,255,0.08)',
                    margin: '16px 0',
                } }), _jsx("div", { style: {
                    fontSize: 10,
                    color: '#7897b0',
                    fontWeight: 700,
                    letterSpacing: 1.2,
                    marginBottom: 10,
                }, children: "MAIN BRANCHES" }), mainBranches.map((branchId) => {
                const definition = data.treeDefinition.find((node) => node.id ===
                    branchId);
                const count = data.counts[branchId] ?? 0;
                const color = branchColors[branchId];
                return (_jsxs("button", { onClick: () => onSelect(branchId), style: {
                        width: '100%',
                        marginBottom: 7,
                        padding: '9px 10px',
                        borderRadius: 10,
                        border: selectedId ===
                            branchId
                            ? `1px solid ${color}`
                            : '1px solid rgba(120,190,255,0.10)',
                        background: selectedId ===
                            branchId
                            ? 'rgba(30,100,180,0.24)'
                            : 'rgba(5,20,35,0.45)',
                        color: '#d7e6f3',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        textAlign: 'left',
                    }, children: [_jsxs("span", { style: {
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                fontSize: 11,
                            }, children: [_jsx("span", { style: {
                                        width: 8,
                                        height: 8,
                                        borderRadius: '50%',
                                        background: color,
                                        boxShadow: `0 0 8px ${color}`,
                                    } }), definition?.label] }), _jsx("strong", { style: {
                                color: count > 0
                                    ? '#ffffff'
                                    : '#536678',
                                fontSize: 11,
                            }, children: count })] }, branchId));
            }), _jsx("div", { style: {
                    height: 1,
                    background: 'rgba(255,255,255,0.08)',
                    margin: '16px 0',
                } }), _jsxs("div", { style: {
                    fontSize: 10,
                    color: '#7897b0',
                    lineHeight: 1.5,
                }, children: ["Source:", _jsx("br", {}), "JACS / Nature / Science / Chem", _jsx("br", {}), "Crossref + OpenAlex"] })] }));
}
function SectionTitle({ children, }) {
    return (_jsx("div", { style: {
            marginTop: 24,
            fontSize: 10,
            letterSpacing: 1.2,
            color: '#81a4bf',
            fontWeight: 700,
        }, children: children }));
}
const JOURNAL_FILTERS = [
    'All',
    'JACS',
    'Nature',
    'Science',
    'Chem',
];
function buildJournalView(data, journalFilter) {
    if (journalFilter === 'All') {
        return data;
    }
    const rawData = data;
    const allPapers = (rawData.papers ??
        []);
    const journalCounts = (rawData.journalCounts ??
        {});
    const nodePapers = Object.fromEntries(Object.entries(data.nodePapers).map(([nodeId, papers]) => [
        nodeId,
        papers.filter((paper) => String(paper
            .journal ??
            '') ===
            journalFilter),
    ]));
    // rootだけは全論文配列から作る
    nodePapers.chemistry =
        allPapers.filter((paper) => String(paper
            .journal ??
            '') ===
            journalFilter);
    const counts = Object.fromEntries(data.treeDefinition.map((node) => [
        node.id,
        journalCounts[node.id]?.[journalFilter] ??
            nodePapers[node.id]?.length ??
            0,
    ]));
    const countryCounts = {};
    for (const node of data.treeDefinition) {
        const nodeId = node.id;
        const countries = {};
        for (const paper of nodePapers[nodeId] ?? []) {
            for (const country of paper.openAlex
                ?.countries ??
                []) {
                const name = country.name ||
                    country.code;
                if (!name) {
                    continue;
                }
                countries[name] =
                    (countries[name] ?? 0) + 1;
            }
        }
        countryCounts[nodeId] = countries;
    }
    const paperCount = journalCounts
        .chemistry?.[journalFilter] ??
        nodePapers
            .chemistry
            .length;
    return {
        ...data,
        counts,
        countryCounts,
        nodePapers,
        source: {
            ...data.source,
            papers: paperCount,
        },
    };
}
const PERIOD_FILTERS = [
    '1M',
    '3M',
    '6M',
    '1Y',
];
const PERIOD_DAYS = {
    '1M': 30,
    '3M': 90,
    '6M': 180,
    '1Y': 365,
};
function isPaperInUiPeriod(paper, data, period) {
    if (period === '1Y') {
        return true;
    }
    const rawData = data;
    const endText = rawData.period?.end;
    if (!endText) {
        return true;
    }
    const endMs = Date.parse(String(endText) +
        'T23:59:59Z');
    const published = String(paper.published ??
        '');
    const paperMs = Date.parse(published +
        'T00:00:00Z');
    if (!Number.isFinite(paperMs)) {
        return false;
    }
    const startMs = endMs -
        PERIOD_DAYS[period] *
            24 *
            60 *
            60 *
            1000;
    return (paperMs >=
        startMs &&
        paperMs <=
            endMs);
}
function buildPeriodJournalView(data, period, journal) {
    const rawData = data;
    const aggregate = rawData
        .viewAggregates?.[period]?.[journal];
    if (!aggregate) {
        return buildJournalView(data, journal);
    }
    const allPapers = (rawData.papers ??
        []);
    const matchesView = (paper) => {
        const paperJournal = String(paper
            .journal ??
            '');
        const journalMatches = journal === 'All' ||
            paperJournal ===
                journal;
        return (journalMatches &&
            isPaperInUiPeriod(paper, data, period));
    };
    const nodePapers = Object.fromEntries(Object.entries(data.nodePapers).map(([nodeId, papers]) => [
        nodeId,
        papers.filter(matchesView),
    ]));
    nodePapers.chemistry =
        allPapers
            .filter(matchesView)
            .sort((a, b) => String(b.published).localeCompare(String(a.published)))
            .slice(0, 100);
    return {
        ...data,
        counts: aggregate.counts,
        countryCounts: aggregate.countryCounts,
        nodePapers,
        source: {
            ...data.source,
            papers: aggregate
                .counts
                .chemistry ??
                0,
        },
    };
}
// ============================================
// App
// ============================================
function App() {
    const isMobile = useMobileLayout();
    const [mobilePanel, setMobilePanel] = useState(null);
    const [data, setData] = useState(null);
    const [selectedId, setSelectedId,] = useState('catalysis');
    const [error, setError,] = useState('');
    const [query, setQuery,] = useState('');
    const [journalFilter, setJournalFilter,] = useState('All');
    useEffect(() => {
        let cancelled = false;
        async function loadData() {
            try {
                const response = await fetch('./chemtree-1y.json.gz', { cache: 'no-store' });
                if (!response.ok) {
                    throw new Error(`ChemTree dataset could not be loaded (${response.status})`);
                }
                const compressed = new Uint8Array(await response.arrayBuffer());
                const decoded = strFromU8(gunzipSync(compressed));
                const result = JSON.parse(decoded);
                if (!cancelled)
                    setData(result);
            }
            catch (err) {
                if (!cancelled)
                    setError(String(err));
            }
        }
        loadData();
        return () => {
            cancelled = true;
        };
    }, []);
    const [periodFilter, setPeriodFilter,] = useState('1Y');
    const viewData = useMemo(() => data
        ? buildPeriodJournalView(data, periodFilter, journalFilter)
        : null, [
        data,
        periodFilter,
        journalFilter,
    ]);
    const selectNode = (id, openPapers = false) => {
        setSelectedId(id);
        if (isMobile && openPapers)
            setMobilePanel('papers');
    };
    const runSearch = () => {
        if (!data)
            return;
        const cleaned = query
            .trim()
            .toLowerCase();
        if (!cleaned) {
            return;
        }
        const node = data.treeDefinition.find((item) => item.label
            .toLowerCase()
            .includes(cleaned));
        if (node) {
            selectNode(node.id, true);
            return;
        }
        const paper = data.nodePapers
            .chemistry
            ?.find((item) => item.title
            .toLowerCase()
            .includes(cleaned));
        if (paper?.classification
            ?.branch) {
            selectNode(paper.classification.branch, true);
        }
    };
    if (error) {
        return (_jsxs("div", { style: {
                padding: 30,
                background: '#020711',
                color: 'white',
                minHeight: '100vh',
            }, children: ["\u30A8\u30E9\u30FC\uFF1A", error] }));
    }
    if (!data) {
        return (_jsx("div", { style: {
                position: 'fixed',
                inset: 0,
                display: 'grid',
                placeItems: 'center',
                background: '#020711',
                color: '#80d8ff',
                fontFamily: 'Arial, sans-serif',
                fontSize: 18,
            }, children: "Loading ChemTree data..." }));
    }
    return (_jsxs("div", { style: {
            position: 'fixed',
            inset: 0,
            overflow: 'hidden',
            background: 'radial-gradient(circle at 50% 42%, #0a2239 0%, #040c16 48%, #02050a 100%)',
            color: 'white',
            fontFamily: 'Arial, sans-serif',
        }, children: [_jsxs("div", { style: {
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: isMobile ? 70 : 70,
                    zIndex: 40,
                    display: 'flex',
                    alignItems: 'center',
                    padding: isMobile ? '0 8px' : '0 18px',
                    background: 'rgba(3,10,19,0.76)',
                    backdropFilter: 'blur(14px)',
                    borderBottom: '1px solid rgba(120,190,255,0.12)',
                }, children: [_jsxs("div", { style: {
                            width: isMobile ? 96 : 240,
                        }, children: [_jsx("div", { style: {
                                    fontSize: isMobile ? 18 : 28,
                                    fontWeight: 800,
                                    letterSpacing: '-1px',
                                }, children: "ChemTree" }), _jsx("div", { style: {
                                    fontSize: 10,
                                    color: '#8faac2',
                                    display: isMobile ? 'none' : 'block',
                                }, children: "Real-time Chemistry Intelligence" })] }), _jsx("div", { style: {
                            flex: 1,
                            display: 'flex',
                            justifyContent: 'center',
                        }, children: _jsxs("div", { style: {
                                position: 'relative',
                                width: isMobile ? 'calc(100vw - 112px)' : 'min(600px,44vw)',
                            }, children: [_jsx("input", { value: query, onChange: (event) => setQuery(event.target
                                        .value), onKeyDown: (event) => {
                                        if (event.key ===
                                            'Enter') {
                                            runSearch();
                                        }
                                    }, placeholder: "Search topic or paper...", style: {
                                        width: '100%',
                                        height: isMobile ? 38 : 40,
                                        padding: isMobile ? '0 78px 0 12px' : '0 95px 0 16px',
                                        boxSizing: 'border-box',
                                        borderRadius: 22,
                                        border: '1px solid rgba(120,190,255,0.18)',
                                        background: '#071421',
                                        color: 'white',
                                        outline: 'none',
                                    } }), _jsx("button", { onClick: runSearch, style: {
                                        position: 'absolute',
                                        top: 4,
                                        right: 4,
                                        height: 32,
                                        padding: isMobile ? '0 11px' : '0 15px',
                                        border: 0,
                                        borderRadius: 18,
                                        background: 'linear-gradient(90deg,#178cff,#40dcff)',
                                        color: 'white',
                                        cursor: 'pointer',
                                    }, children: "Search" })] }) }), _jsxs("div", { style: {
                            width: isMobile ? 0 : 240,
                            display: isMobile ? 'none' : 'flex',
                            justifyContent: 'flex-end',
                            alignItems: 'center',
                            gap: 10,
                        }, children: [_jsx("button", { onClick: () => {
                                    setSelectedId('chemistry');
                                }, style: {
                                    height: 34,
                                    padding: '0 14px',
                                    borderRadius: 18,
                                    border: '1px solid rgba(100,200,255,0.28)',
                                    background: 'rgba(20,90,160,0.20)',
                                    color: '#a8e8ff',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                }, children: "Reset View" }), _jsx("div", { style: {
                                    color: '#71dfff',
                                    fontSize: 11,
                                    whiteSpace: 'nowrap',
                                }, children: "MULTI-JOURNAL \u00B7 REAL DATA" })] })] }), _jsx("div", { style: {
                    position: 'absolute',
                    top: isMobile ? 76 : 80,
                    left: isMobile ? 8 : '50%',
                    right: isMobile ? 8 : undefined,
                    transform: isMobile ? 'none' : 'translateX(-50%)',
                    zIndex: 38,
                    display: 'flex',
                    gap: 6,
                    padding: 5,
                    overflowX: isMobile ? 'auto' : 'visible',
                    scrollbarWidth: 'none',
                    borderRadius: 24,
                    background: 'rgba(4,14,25,0.86)',
                    border: '1px solid rgba(120,190,255,0.16)',
                    backdropFilter: 'blur(14px)',
                }, children: JOURNAL_FILTERS.map((journal) => {
                    const active = journalFilter ===
                        journal;
                    return (_jsx("button", { onClick: () => {
                            setJournalFilter(journal);
                            setSelectedId('chemistry');
                        }, style: {
                            height: 30,
                            flex: isMobile ? '0 0 auto' : undefined,
                            padding: '0 13px',
                            borderRadius: 16,
                            border: active
                                ? '1px solid rgba(80,210,255,0.65)'
                                : '1px solid rgba(120,190,255,0.10)',
                            background: active
                                ? 'linear-gradient(90deg,rgba(20,125,220,0.72),rgba(30,190,220,0.55))'
                                : 'rgba(8,24,39,0.65)',
                            color: active
                                ? '#ffffff'
                                : '#8faabd',
                            fontSize: 10,
                            fontWeight: active
                                ? 700
                                : 500,
                            cursor: 'pointer',
                            boxShadow: active
                                ? '0 0 14px rgba(50,190,255,0.22)'
                                : 'none',
                        }, children: journal }, journal));
                }) }), _jsx("div", { style: {
                    position: 'absolute',
                    top: isMobile ? 116 : 120,
                    left: isMobile ? 8 : '50%',
                    right: isMobile ? 8 : undefined,
                    transform: isMobile ? 'none' : 'translateX(-50%)',
                    zIndex: 38,
                    display: 'flex',
                    justifyContent: isMobile ? 'center' : undefined,
                    gap: 6,
                    padding: 5,
                    borderRadius: 24,
                    background: 'rgba(4,14,25,0.86)',
                    border: '1px solid rgba(120,190,255,0.16)',
                    backdropFilter: 'blur(14px)',
                }, children: PERIOD_FILTERS.map((period) => {
                    const active = periodFilter ===
                        period;
                    return (_jsx("button", { onClick: () => {
                            setPeriodFilter(period);
                            setSelectedId('chemistry');
                        }, style: {
                            height: 30,
                            minWidth: 44,
                            padding: '0 13px',
                            borderRadius: 16,
                            border: active
                                ? '1px solid rgba(130,230,180,0.70)'
                                : '1px solid rgba(120,190,255,0.10)',
                            background: active
                                ? 'linear-gradient(90deg,rgba(20,150,115,0.75),rgba(45,205,165,0.55))'
                                : 'rgba(8,24,39,0.65)',
                            color: active
                                ? '#ffffff'
                                : '#8faabd',
                            fontSize: 10,
                            fontWeight: active
                                ? 700
                                : 500,
                            cursor: 'pointer',
                            boxShadow: active
                                ? '0 0 14px rgba(60,220,170,0.22)'
                                : 'none',
                        }, children: period }, period));
                }) }), (!isMobile || mobilePanel === 'topics') && (_jsx(LeftPanel, { data: viewData ?? data, selectedId: selectedId, onSelect: (id) => selectNode(id, isMobile), isMobile: isMobile, onClose: isMobile ? () => setMobilePanel(null) : undefined })), (!isMobile || mobilePanel === 'papers') && (_jsx(RightPanel, { data: viewData ?? data, selectedId: selectedId, isMobile: isMobile, onClose: isMobile ? () => setMobilePanel(null) : undefined })), _jsxs("div", { style: {
                    position: 'absolute',
                    top: isMobile ? 154 : 70,
                    left: isMobile ? 0 : 245,
                    right: isMobile ? 0 : 345,
                    bottom: isMobile ? 56 : 0,
                }, children: [_jsxs(Canvas, { dpr: isMobile ? [1, 1.25] : [1, 2], gl: { antialias: !isMobile, powerPreference: 'high-performance' }, camera: {
                            position: [0, 0.6, isMobile ? 13.5 : 11.8],
                            fov: isMobile ? 58 : 47,
                        }, children: [_jsx("fog", { attach: "fog", args: [
                                    '#020711',
                                    11,
                                    28,
                                ] }), _jsx("ambientLight", { intensity: 0.85 }), _jsx("pointLight", { position: [
                                    5,
                                    7,
                                    8,
                                ], intensity: 80, color: "#79d8ff" }), _jsx("pointLight", { position: [
                                    -6,
                                    4,
                                    4,
                                ], intensity: 55, color: "#a4ffc0" }), _jsx("pointLight", { position: [
                                    0,
                                    -2,
                                    6,
                                ], intensity: 45, color: "#af7eff" }), _jsx(Sparkles, { count: isMobile ? 80 : 240, scale: [
                                    16,
                                    12,
                                    12,
                                ], size: 1.5, speed: 0.3, opacity: 0.65 }), _jsx(RealTree, { data: viewData ?? data, selectedId: selectedId, onSelect: (id) => selectNode(id, isMobile) }), _jsx(OrbitControls, { makeDefault: true, enableRotate: true, enableZoom: true, enablePan: !isMobile, minDistance: 3, maxDistance: 20 })] }), _jsx("div", { style: {
                            position: 'absolute',
                            bottom: isMobile ? 8 : 18,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            padding: '9px 15px',
                            borderRadius: 30,
                            background: 'rgba(5,16,28,0.72)',
                            border: '1px solid rgba(110,190,255,0.22)',
                            color: '#cceaff',
                            fontSize: 11,
                            pointerEvents: 'none',
                        }, children: isMobile ? '1 finger: Rotate  /  Pinch: Zoom  /  Tap: Explore' : 'Drag: Rotate  /  Wheel: Zoom  /  Click: Explore' })] }), isMobile && (_jsxs("div", { style: {
                    position: 'absolute',
                    left: 8,
                    right: 8,
                    bottom: 7,
                    height: 44,
                    zIndex: 60,
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: 7,
                    padding: 4,
                    borderRadius: 16,
                    background: 'rgba(3,12,22,0.92)',
                    border: '1px solid rgba(120,190,255,0.18)',
                    backdropFilter: 'blur(14px)',
                }, children: [_jsx("button", { onClick: () => setMobilePanel(mobilePanel === 'topics' ? null : 'topics'), style: { border: 0, borderRadius: 12, background: mobilePanel === 'topics' ? 'rgba(25,145,210,.55)' : 'rgba(20,45,67,.75)', color: '#d9f3ff', fontWeight: 800 }, children: "Topics" }), _jsx("button", { onClick: () => setMobilePanel(mobilePanel === 'papers' ? null : 'papers'), style: { border: 0, borderRadius: 12, background: mobilePanel === 'papers' ? 'rgba(25,145,210,.55)' : 'rgba(20,45,67,.75)', color: '#d9f3ff', fontWeight: 800 }, children: "Papers" }), _jsx("button", { onClick: () => { selectNode('chemistry'); setMobilePanel(null); }, style: { border: 0, borderRadius: 12, background: 'rgba(20,45,67,.75)', color: '#a8e8ff', fontWeight: 800 }, children: "Reset" })] }))] }));
}
export default App;
