import { clamp } from './math.js'

export class InputController {
	constructor(canvas) {
		this.canvas = canvas
		this.keys = new Set()
		this.mouseDeltaX = 0
		this.mouseDeltaY = 0
		this.lookSpeed = 0.0028
		this.moveSpeed = 8
		this.verticalSpeed = 6
		this.pointerLocked = false
	}

	init() {
		window.addEventListener('keydown', (event) => this.keys.add(event.code))
		window.addEventListener('keyup', (event) => this.keys.delete(event.code))

		this.canvas.addEventListener('click', () => {
			this.canvas.requestPointerLock()
		})

		document.addEventListener('pointerlockchange', () => {
			this.pointerLocked = document.pointerLockElement === this.canvas
		})

		window.addEventListener('mousemove', (event) => {
			if (!this.pointerLocked) {
				return
			}
			this.mouseDeltaX += event.movementX
			this.mouseDeltaY += event.movementY
		})
	}

	consumeMouseDelta() {
		const x = this.mouseDeltaX
		const y = this.mouseDeltaY
		this.mouseDeltaX = 0
		this.mouseDeltaY = 0
		return { x, y }
	}

	updateCamera(camera, dtSeconds) {
		const md = this.consumeMouseDelta()
		camera.yaw += md.x * this.lookSpeed
		camera.pitch += md.y * this.lookSpeed
		camera.pitch = clamp(camera.pitch, -1.5, 1.5)

		const frontX = Math.cos(camera.pitch) * Math.cos(camera.yaw)
		const frontY = Math.sin(camera.pitch)
		const frontZ = Math.cos(camera.pitch) * Math.sin(camera.yaw)

		const len = Math.hypot(frontX, frontY, frontZ) || 1
		const fx = frontX / len
		const fz = frontZ / len

		const rightX = -fz
		const rightZ = fx
		const moveStep = this.moveSpeed * dtSeconds
		const yStep = this.verticalSpeed * dtSeconds

		if (this.keys.has('KeyW')) {
			camera.position[0] += fx * moveStep
			camera.position[2] += fz * moveStep
		}
		if (this.keys.has('KeyS')) {
			camera.position[0] -= fx * moveStep
			camera.position[2] -= fz * moveStep
		}
		if (this.keys.has('KeyA')) {
			camera.position[0] -= rightX * moveStep
			camera.position[2] -= rightZ * moveStep
		}
		if (this.keys.has('KeyD')) {
			camera.position[0] += rightX * moveStep
			camera.position[2] += rightZ * moveStep
		}
		if (this.keys.has('Space')) {
			camera.position[1] += yStep
		}
		if (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) {
			camera.position[1] -= yStep
		}
	}
}
