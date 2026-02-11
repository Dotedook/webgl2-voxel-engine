function toColor(hex) {
	return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255]
}

function terrainHeight(x, z, seed, heightBias, heightScale) {
	const v0 = Math.sin((x + seed) * 0.11)
	const v1 = Math.cos((z - seed) * 0.09)
	const v2 = Math.sin((x + z) * 0.05)
	return Math.max(1, Math.floor((v0 + v1 + v2 + heightBias) * heightScale))
}

function createPlaneScenario(
	id,
	{ width, depth, seed, heightBias, heightScale, pillarSpacing = 0 },
) {
	const voxels = []
	const halfW = Math.floor(width / 2)
	const halfD = Math.floor(depth / 2)
	const topA = toColor(0x7bd88f)
	const topB = toColor(0x79a8ff)
	const soil = toColor(0x6c4f3d)
	const rock = toColor(0x8d8d8d)
	const accent = toColor(0xf8b36a)
	let maxHeight = 0

	for (let z = -halfD; z < halfD; z += 1) {
		for (let x = -halfW; x < halfW; x += 1) {
			const h = terrainHeight(x, z, seed, heightBias, heightScale)
			maxHeight = Math.max(maxHeight, h)
			for (let y = 0; y < h; y += 1) {
				let color = soil
				if (y === h - 1) {
					color = (x + z) % 2 === 0 ? topA : topB
				} else if (y < h - 3) {
					color = rock
				}
				voxels.push({ x, y, z, color })
			}

			if (pillarSpacing > 0 && x % pillarSpacing === 0 && z % pillarSpacing === 0) {
				const pillarHeight = 2 + ((Math.abs(x * 31 + z * 17 + seed) >> 1) % 5)
				for (let y = h; y < h + pillarHeight; y += 1) {
					voxels.push({ x, y, z, color: accent })
				}
				maxHeight = Math.max(maxHeight, h + pillarHeight)
			}
		}
	}

	return {
		id,
		voxels,
		cameraStart: {
			position: [0, maxHeight * 1.2 + 4, -halfD + 6],
			yaw: Math.PI * 0.5,
			pitch: -0.2,
		},
		cameraScript: (camera, elapsedSeconds) => {
			// Cenario 2 no benchmark: avanco para frente com leve "head bob".
			const pathLen = depth + 12
			const walkSpeed = 9.5
			const progress = (elapsedSeconds * walkSpeed) % pathLen
			camera.position[0] = Math.sin(elapsedSeconds * 0.22) * (width * 0.08)
			camera.position[1] = maxHeight * 1.2 + 4 + Math.sin(elapsedSeconds * 4.2) * 0.25
			camera.position[2] = -halfD + 6 + progress
			camera.yaw = Math.PI * 0.5 + Math.sin(elapsedSeconds * 0.35) * 0.04
			camera.pitch = -0.18
		},
	}
}

function buildTerrainColumnVoxels({ x, z, seed, topA, topB, soil, rock }) {
	const h = terrainHeight(x, z, seed, 3.0, 1.45)
	const voxels = []
	const depthLayers = Math.min(h, 6)
	for (let layer = 0; layer < depthLayers; layer += 1) {
		const y = h - 1 - layer
		let color = soil
		if (layer === 0) {
			color = (x + z) % 2 === 0 ? topA : topB
		} else if (layer >= 3) {
			color = rock
		}
		voxels.push({ x, y, z, color })
	}
	return voxels
}

function createStreamingChunk({ chunkIndex, chunkDepth, width, seed }) {
	const voxels = []
	const halfW = Math.floor(width / 2)
	const zStart = chunkIndex * chunkDepth
	const zEnd = zStart + chunkDepth
	const topA = toColor(0x7bd88f)
	const topB = toColor(0x79a8ff)
	const soil = toColor(0x6c4f3d)
	const rock = toColor(0x8d8d8d)

	for (let z = zStart; z < zEnd; z += 1) {
		for (let x = -halfW; x < halfW; x += 1) {
			const column = buildTerrainColumnVoxels({
				x,
				z,
				seed,
				topA,
				topB,
				soil,
				rock,
			})
			for (const voxel of column) {
				voxels.push(voxel)
			}
		}
	}
	return voxels
}

function flattenChunks(chunkMap) {
	const out = []
	for (const voxels of chunkMap.values()) {
		for (const voxel of voxels) {
			out.push(voxel)
		}
	}
	return out
}

export function createSmallFallbackScenario() {
	const voxels = []
	const palette = [
		toColor(0xff8f6b),
		toColor(0x76b6ff),
		toColor(0xf4d35e),
		toColor(0x9bf6c7),
	]
	for (let y = 0; y < 8; y += 1) {
		for (let x = -2; x <= 2; x += 1) {
			for (let z = -2; z <= 2; z += 1) {
				if (Math.abs(x) + Math.abs(z) + y > 9) {
					continue
				}
				voxels.push({
					x,
					y,
					z,
					color: palette[(x + z + y + 8) % palette.length],
				})
			}
		}
	}
	return {
		id: 'small',
		voxels,
		cameraStart: {
			position: [14, 10, 14],
			yaw: -Math.PI * 0.75,
			pitch: -0.3,
		},
	}
}

export function createMediumScenario(seed) {
	const width = 72
	const chunkDepth = 24
	const behindChunks = 1
	const aheadChunks = 5
	const walkSpeed = 9.5
	let centerChunk = 0
	const activeChunks = new Map()

	function ensureWindow(nextCenterChunk) {
		let changed = false
		const keep = new Set()
		for (
			let chunkIndex = nextCenterChunk - behindChunks;
			chunkIndex <= nextCenterChunk + aheadChunks;
			chunkIndex += 1
		) {
			keep.add(chunkIndex)
			if (!activeChunks.has(chunkIndex)) {
				activeChunks.set(
					chunkIndex,
					createStreamingChunk({
						chunkIndex,
						chunkDepth,
						width,
						seed,
					}),
				)
				changed = true
			}
		}
		for (const chunkIndex of [...activeChunks.keys()]) {
			if (!keep.has(chunkIndex)) {
				activeChunks.delete(chunkIndex)
				changed = true
			}
		}
		return changed
	}

	ensureWindow(centerChunk)
	const initialVoxels = flattenChunks(activeChunks)
	const initialHeight = 15

	return {
		id: 'medium',
		voxels: initialVoxels,
		cameraStart: {
			position: [0, initialHeight, 8],
			yaw: Math.PI * 0.5,
			pitch: -0.18,
		},
		cameraScript: (camera, elapsedSeconds) => {
			camera.position[0] = Math.sin(elapsedSeconds * 0.22) * (width * 0.08)
			camera.position[1] = initialHeight + Math.sin(elapsedSeconds * 4.2) * 0.25
			camera.position[2] = 8 + elapsedSeconds * walkSpeed
			camera.yaw = Math.PI * 0.5 + Math.sin(elapsedSeconds * 0.35) * 0.04
			camera.pitch = -0.18
		},
		updateWorld: ({ camera }) => {
			const nextCenterChunk = Math.floor(camera.position[2] / chunkDepth)
			if (nextCenterChunk !== centerChunk) {
				centerChunk = nextCenterChunk
				if (ensureWindow(centerChunk)) {
					return {
						voxels: flattenChunks(activeChunks),
					}
				}
			}
			return null
		},
	}
}

export function createLargeScenario(seed) {
	return createPlaneScenario('large', {
		width: 128,
		depth: 128,
		seed,
		heightBias: 3.15,
		heightScale: 1.5,
		pillarSpacing: 12,
	})
}
