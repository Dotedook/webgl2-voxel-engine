import { InputController } from './InputController.js'
import { Renderer } from './Renderer.js'
import { createVec3 } from './math.js'

function getHeapBytes() {
	if (
		!performance.memory ||
		typeof performance.memory.usedJSHeapSize !== 'number'
	) {
		return null
	}
	return performance.memory.usedJSHeapSize
}

function normalizeChunks(chunks) {
	if (!Array.isArray(chunks)) {
		return []
	}
	return chunks.map((chunk, index) => {
		const normalized = {
			id: String(
				chunk && (chunk.id ?? chunk.chunkId ?? chunk.key ?? 'chunk-' + index),
			),
			voxels:
				chunk && Array.isArray(chunk.voxels)
					? chunk.voxels
					: Array.isArray(chunk)
						? chunk
						: [],
		}
		if (chunk && typeof chunk.dirty === 'boolean') {
			normalized.dirty = chunk.dirty
		}
		return normalized
	})
}

export class Engine {
	constructor({ canvas, enableChunkFrustumCulling = true }) {
		this.canvas = canvas
		this.gl = null
		this.renderer = null
		this.enableChunkFrustumCulling = enableChunkFrustumCulling !== false
		this.input = new InputController(canvas)
		this.running = false
		this.rafId = 0
		this.lastFrameTime = 0
		this.elapsedSeconds = 0
		this.currentScenario = null
		this.frameHooks = []
		this.frameListeners = []
		this.cameraScript = null
		this.scenarioUpdateFn = null
		this.scenarioVoxelSize = 1

		this.camera = {
			position: createVec3(24, 22, 24),
			target: createVec3(0, 0, 0),
			up: createVec3(0, 1, 0),
			yaw: -Math.PI * 0.75,
			pitch: -0.3,
		}

		this.lastFrameMetrics = {
			frameMs: 0,
			frameDeltaMs: 0,
			frameCpuMs: 0,
			updateMs: 0,
			meshGenerationMs: 0,
			chunkMeshBuildCount: 0,
			chunkMeshReuseCount: 0,
			chunkMeshRemovedCount: 0,
			drawCalls: 0,
			triangleCount: 0,
			totalTriangleCount: 0,
			voxelCount: 0,
			chunkCount: 0,
			visibleChunks: 0,
			culledChunks: 0,
			visibleTriangles: 0,
			chunkFrustumCullingEnabled: this.enableChunkFrustumCulling,
			jsHeapBytes: null,
			elapsedSeconds: 0,
		}
	}

	init() {
		this.gl =
			this.canvas.getContext('webgl2', { antialias: false }) ||
			this.canvas.getContext('webgl', { antialias: false })
		if (!this.gl) {
			throw new Error('WebGL não disponível neste navegador')
		}

		this.renderer = new Renderer(this.gl, {
			enableChunkFrustumCulling: this.enableChunkFrustumCulling,
		})
		this.renderer.init()
		this.input.init()
		this.resizeCanvasToDisplaySize()
		window.addEventListener('resize', () => this.resizeCanvasToDisplaySize())
	}

	addFrameHook(hook) {
		this.frameHooks.push(hook)
	}

	onFrame(listener) {
		this.frameListeners.push(listener)
		return () => {
			this.frameListeners = this.frameListeners.filter(
				(item) => item !== listener,
			)
		}
	}

	setCameraScript(scriptFnOrNull) {
		this.cameraScript = scriptFnOrNull
	}

	setChunkFrustumCullingEnabled(enabled) {
		this.enableChunkFrustumCulling = Boolean(enabled)
		if (this.renderer) {
			this.renderer.setChunkFrustumCullingEnabled(
				this.enableChunkFrustumCulling,
			)
		}
	}

	isChunkFrustumCullingEnabled() {
		if (this.renderer) {
			return this.renderer.isChunkFrustumCullingEnabled()
		}
		return this.enableChunkFrustumCulling
	}

	resizeCanvasToDisplaySize() {
		const dpr = Math.max(1, window.devicePixelRatio || 1)
		const width = Math.floor(this.canvas.clientWidth * dpr)
		const height = Math.floor(this.canvas.clientHeight * dpr)
		if (this.canvas.width !== width || this.canvas.height !== height) {
			this.canvas.width = width
			this.canvas.height = height
			this.renderer.resize(width, height)
		}
	}

	async loadScenario(scenario) {
		this.currentScenario = scenario
		this.scenarioUpdateFn =
			typeof scenario.updateWorld === 'function' ? scenario.updateWorld : null
		this.scenarioVoxelSize =
			typeof scenario.voxelSize === 'number' ? scenario.voxelSize : 1
		this.input.setMovementSpeeds({
			moveSpeed: scenario.cameraMoveSpeed,
			verticalSpeed: scenario.cameraVerticalSpeed,
		})
		if (scenario.cameraStart) {
			this.camera.position[0] = scenario.cameraStart.position[0]
			this.camera.position[1] = scenario.cameraStart.position[1]
			this.camera.position[2] = scenario.cameraStart.position[2]
			this.camera.yaw = scenario.cameraStart.yaw
			this.camera.pitch = scenario.cameraStart.pitch
		}

		this.setCameraScript(scenario.cameraScript || null)
		let mesh
		const chunks = normalizeChunks(scenario.chunks)
		if (chunks.length > 0) {
			mesh = this.renderer.replaceChunks(chunks, {
				voxelSize: this.scenarioVoxelSize,
			})
			scenario.chunks = chunks
		} else {
			const voxels = Array.isArray(scenario.voxels) ? scenario.voxels : []
			mesh = this.renderer.uploadVoxels(voxels, {
				voxelSize: this.scenarioVoxelSize,
			})
			scenario.voxels = voxels
		}
		const worldStats = this.renderer.getWorldStats()
		return {
			meshGenerationMs: mesh.meshGenerationMs,
			chunkMeshBuildCount: mesh.builtChunkCount || 0,
			chunkMeshReuseCount: mesh.reusedChunkCount || 0,
			chunkMeshRemovedCount: mesh.removedChunkCount || 0,
			vertexCount: worldStats.vertexCount,
			triangleCount: worldStats.triangleCount,
			voxelCount: worldStats.voxelCount,
			chunkCount: worldStats.chunkCount,
			scenarioId: scenario.id,
		}
	}

	start() {
		if (this.running) {
			return
		}
		this.running = true
		this.lastFrameTime = performance.now()
		this.loop()
	}

	stop() {
		this.running = false
		cancelAnimationFrame(this.rafId)
	}

	getFrameMetrics() {
		return { ...this.lastFrameMetrics }
	}

	updateCameraTarget() {
		const fx = Math.cos(this.camera.pitch) * Math.cos(this.camera.yaw)
		const fy = Math.sin(this.camera.pitch)
		const fz = Math.cos(this.camera.pitch) * Math.sin(this.camera.yaw)
		this.camera.target[0] = this.camera.position[0] + fx
		this.camera.target[1] = this.camera.position[1] + fy
		this.camera.target[2] = this.camera.position[2] + fz
	}

	loop() {
		if (!this.running) {
			return
		}

		for (const hook of this.frameHooks) {
			if (hook.beforeFrame) {
				hook.beforeFrame()
			}
		}

		const frameStart = performance.now()
		const frameDeltaMs = frameStart - this.lastFrameTime
		const dtSeconds = Math.min(frameDeltaMs / 1000, 0.1)
		this.lastFrameTime = frameStart
		this.elapsedSeconds += dtSeconds

		const updateStart = performance.now()
		let meshGenerationMs = 0
		let chunkMeshBuildCount = 0
		let chunkMeshReuseCount = 0
		let chunkMeshRemovedCount = 0
		if (this.cameraScript) {
			this.cameraScript(this.camera, this.elapsedSeconds, dtSeconds)
		} else {
			this.input.updateCamera(this.camera, dtSeconds)
		}
		this.updateCameraTarget()

		if (this.scenarioUpdateFn && this.currentScenario) {
			const worldUpdate = this.scenarioUpdateFn({
				camera: this.camera,
				elapsedSeconds: this.elapsedSeconds,
				dtSeconds,
			})
			if (worldUpdate && Array.isArray(worldUpdate.voxels)) {
				this.currentScenario.voxels = worldUpdate.voxels
				const mesh = this.renderer.uploadVoxels(worldUpdate.voxels, {
					voxelSize: this.scenarioVoxelSize,
				})
				meshGenerationMs = mesh.meshGenerationMs
			} else if (worldUpdate && Array.isArray(worldUpdate.chunks)) {
				const chunks = normalizeChunks(worldUpdate.chunks)
				this.currentScenario.chunks = chunks
				const mesh = this.renderer.replaceChunks(chunks, {
					voxelSize: this.scenarioVoxelSize,
				})
				meshGenerationMs = mesh.meshGenerationMs
				chunkMeshBuildCount += mesh.builtChunkCount || 0
				chunkMeshReuseCount += mesh.reusedChunkCount || 0
				chunkMeshRemovedCount += mesh.removedChunkCount || 0
			} else if (worldUpdate && worldUpdate.chunkUpdates) {
				const upserts = normalizeChunks(worldUpdate.chunkUpdates.upserts || [])
				let totalMeshGenerationMs = 0
				if (upserts.length > 0) {
					const upsertResult = this.renderer.upsertChunks(upserts, {
						voxelSize: this.scenarioVoxelSize,
					})
					totalMeshGenerationMs += upsertResult.meshGenerationMs
					chunkMeshBuildCount += upsertResult.builtChunkCount || 0
					chunkMeshReuseCount += upsertResult.reusedChunkCount || 0
				}
				meshGenerationMs = totalMeshGenerationMs
			}
		}
		const updateMs = performance.now() - updateStart

		this.resizeCanvasToDisplaySize()
		this.renderer.render(this.camera, this.canvas.width, this.canvas.height)
		const worldStats = this.renderer.getWorldStats()
		const visibility = this.renderer.visibility

		const frameCpuMs = performance.now() - frameStart
		this.lastFrameMetrics = {
			frameMs: frameDeltaMs,
			frameDeltaMs,
			frameCpuMs,
			updateMs,
			meshGenerationMs,
			chunkMeshBuildCount,
			chunkMeshReuseCount,
			chunkMeshRemovedCount,
			drawCalls: this.renderer.drawCalls,
			triangleCount: this.renderer.triangleCount,
			totalTriangleCount: worldStats.triangleCount,
			voxelCount: worldStats.voxelCount,
			chunkCount: visibility.totalChunks,
			visibleChunks: visibility.visibleChunks,
			culledChunks: visibility.culledChunks,
			visibleTriangles: visibility.visibleTriangles,
			chunkFrustumCullingEnabled: this.isChunkFrustumCullingEnabled(),
			jsHeapBytes: getHeapBytes(),
			elapsedSeconds: this.elapsedSeconds,
		}

		for (const hook of this.frameHooks) {
			if (hook.afterFrame) {
				hook.afterFrame(this.lastFrameMetrics)
			}
		}

		for (const listener of this.frameListeners) {
			listener(this.lastFrameMetrics)
		}

		this.rafId = requestAnimationFrame(() => this.loop())
	}
}
