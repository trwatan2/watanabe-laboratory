import {
  useMemo,
  useRef,
} from 'react'

import {
  useFrame,
} from '@react-three/fiber'

import * as THREE from 'three'

type Point3 = [
  number,
  number,
  number,
]

export function GrowthNodeGlow({
  position,
  color,
  size,
  intensity,
}: {
  position: Point3
  color: string
  size: number
  intensity: number
}) {
  const meshRef =
    useRef<THREE.Mesh>(
      null,
    )

  const materialRef =
    useRef<THREE.MeshBasicMaterial>(
      null,
    )

  useFrame(
    (state) => {
      const time =
        state.clock.elapsedTime

      const wave =
        0.5 +
        0.5 *
          Math.sin(
            time * 3.0,
          )

      if (
        meshRef.current
      ) {
        const scale =
          1 +
          wave *
            0.22 *
            intensity

        meshRef.current
          .scale
          .setScalar(
            scale,
          )
      }

      if (
        materialRef.current
      ) {
        materialRef.current.opacity =
          0.06 +
          wave *
            0.20 *
            intensity
      }
    },
  )

  return (
    <mesh
      ref={meshRef}
      position={position}
      renderOrder={4}
    >
      <sphereGeometry
        args={[
          size,
          32,
          32,
        ]}
      />

      <meshBasicMaterial
        ref={materialRef}
        color={color}
        transparent
        opacity={0.12}
        blending={
          THREE.AdditiveBlending
        }
        depthWrite={false}
      />
    </mesh>
  )
}

export function GrowthBranchGlow({
  start,
  end,
  color,
  intensity,
  thickness,
}: {
  start: Point3
  end: Point3
  color: string
  intensity: number
  thickness: number
}) {
  const materialRef =
    useRef<THREE.MeshBasicMaterial>(
      null,
    )

  const curve =
    useMemo(
      () => {
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
      },

      [
        start,
        end,
      ],
    )

  useFrame(
    (state) => {
      if (
        !materialRef.current
      ) {
        return
      }

      const wave =
        0.5 +
        0.5 *
          Math.sin(
            state.clock
              .elapsedTime *
              2.7,
          )

      materialRef.current.opacity =
        0.08 +
        wave *
          0.22 *
          intensity
    },
  )

  return (
    <mesh
      renderOrder={3}
    >
      <tubeGeometry
        args={[
          curve,
          48,
          thickness,
          10,
          false,
        ]}
      />

      <meshBasicMaterial
        ref={materialRef}
        color={color}
        transparent
        opacity={0.12}
        blending={
          THREE.AdditiveBlending
        }
        depthWrite={false}
      />
    </mesh>
  )
}
