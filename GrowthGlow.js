import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useRef, } from 'react';
import { useFrame, } from '@react-three/fiber';
import * as THREE from 'three';
export function GrowthNodeGlow({ position, color, size, intensity, }) {
    const meshRef = useRef(null);
    const materialRef = useRef(null);
    useFrame((state) => {
        const time = state.clock.elapsedTime;
        const wave = 0.5 +
            0.5 *
                Math.sin(time * 3.0);
        if (meshRef.current) {
            const scale = 1 +
                wave *
                    0.22 *
                    intensity;
            meshRef.current
                .scale
                .setScalar(scale);
        }
        if (materialRef.current) {
            materialRef.current.opacity =
                0.06 +
                    wave *
                        0.20 *
                        intensity;
        }
    });
    return (_jsxs("mesh", { ref: meshRef, position: position, renderOrder: 4, children: [_jsx("sphereGeometry", { args: [
                    size,
                    32,
                    32,
                ] }), _jsx("meshBasicMaterial", { ref: materialRef, color: color, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false })] }));
}
export function GrowthBranchGlow({ start, end, color, intensity, thickness, }) {
    const materialRef = useRef(null);
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
    }, [
        start,
        end,
    ]);
    useFrame((state) => {
        if (!materialRef.current) {
            return;
        }
        const wave = 0.5 +
            0.5 *
                Math.sin(state.clock
                    .elapsedTime *
                    2.7);
        materialRef.current.opacity =
            0.08 +
                wave *
                    0.22 *
                    intensity;
    });
    return (_jsxs("mesh", { renderOrder: 3, children: [_jsx("tubeGeometry", { args: [
                    curve,
                    48,
                    thickness,
                    10,
                    false,
                ] }), _jsx("meshBasicMaterial", { ref: materialRef, color: color, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false })] }));
}
