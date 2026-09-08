import {
  useEffect,
  useRef,
} from 'react'

import {
  useFrame,
  useThree,
} from '@react-three/fiber'

import * as THREE from 'three'

type CameraFocusProps = {
  target:
    | [
        number,
        number,
        number,
      ]
    | null

  distance?: number
}

type OrbitLikeControls = {
  target: THREE.Vector3
  update: () => void
}

function CameraFocus({
  target,
  distance = 4.8,
}: CameraFocusProps) {
  const camera =
    useThree(
      (state) =>
        state.camera,
    )

  const controls =
    useThree(
      (state) =>
        state.controls,
    ) as unknown as OrbitLikeControls | null

  const destination =
    useRef(
      new THREE.Vector3(),
    )

  const lookTarget =
    useRef(
      new THREE.Vector3(),
    )

  const moving =
    useRef(false)

  useEffect(() => {
    if (!target) {
      return
    }

    const nextTarget =
      new THREE.Vector3(
        ...target,
      )

    lookTarget.current.copy(
      nextTarget,
    )

    const currentTarget =
      controls?.target
        ? controls.target.clone()
        : new THREE.Vector3(
            0,
            0,
            0,
          )

    const direction =
      camera.position
        .clone()
        .sub(
          currentTarget,
        )

    if (
      direction.lengthSq() <
      0.001
    ) {
      direction.set(
        0,
        0.3,
        1,
      )
    }

    direction.normalize()

    destination.current
      .copy(
        nextTarget,
      )
      .add(
        direction.multiplyScalar(
          distance,
        ),
      )

    moving.current = true
  }, [
    target,
    distance,
    camera,
    controls,
  ])

  useFrame(
    (
      _state,
      delta,
    ) => {
      if (
        !moving.current
      ) {
        return
      }

      const speed =
        1 -
        Math.exp(
          -5 * delta,
        )

      camera.position.lerp(
        destination.current,
        speed,
      )

      if (controls) {
        controls.target.lerp(
          lookTarget.current,
          speed,
        )

        controls.update()
      } else {
        camera.lookAt(
          lookTarget.current,
        )
      }

      const cameraDone =
        camera.position.distanceTo(
          destination.current,
        ) < 0.03

      const targetDone =
        !controls ||
        controls.target.distanceTo(
          lookTarget.current,
        ) < 0.02

      if (
        cameraDone &&
        targetDone
      ) {
        camera.position.copy(
          destination.current,
        )

        if (controls) {
          controls.target.copy(
            lookTarget.current,
          )

          controls.update()
        }

        moving.current = false
      }
    },
  )

  return null
}

export default CameraFocus