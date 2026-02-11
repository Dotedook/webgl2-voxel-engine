import {
	createMediumScenario,
	createSmallFallbackScenario,
} from './procedural.js'

export const scenarioIds = ['small', 'medium', 'large']
export const DEFAULT_SMALL_VOX_URL = '/assets/chr_old.vox'
export const DEFAULT_CATHEDRAL_BIN3_URL = '/assets/sibenik_sample.bin3'

function normalizeColor(color) {
	if (Array.isArray(color) && color.length >= 3) {
		return [color[0], color[1], color[2]]
	}
	if (typeof color === 'object' && color !== null) {
		if (
			typeof color.r === 'number' &&
			typeof color.g === 'number' &&
			typeof color.b === 'number'
		) {
			return [color.r, color.g, color.b]
		}
	}
	return [200, 200, 200]
}

function colorFromPalette(palette, index) {
	if (!Array.isArray(palette) || palette.length === 0) {
		return null
	}
	const idx = Number(index)
	if (!Number.isFinite(idx)) {
		return null
	}
	const candidate = palette[idx] || palette[idx - 1] || palette[0] || null
	if (!candidate) {
		return null
	}
	if (Array.isArray(candidate)) {
		return normalizeColor(candidate)
	}
	return normalizeColor([candidate.r, candidate.g, candidate.b])
}

function convertLegacyMagicaShape(result) {
	const rawVoxels = result && (result.XYZI || result.xyzi)
	const palette = result && (result.RGBA || result.rgba)
	if (!Array.isArray(rawVoxels)) {
		return null
	}
	return rawVoxels.map((voxel) => {
		const c = voxel.c ?? voxel.i ?? voxel.colorIndex ?? 0
		const paletteColor = colorFromPalette(palette, c)
		const color = paletteColor || normalizeColor(voxel.color)
		const x = Number(voxel.x || 0)
		const yFromFile = Number(voxel.y || 0)
		const zFromFile = Number(voxel.z || 0)
		// Conversao de Z-up (MagicaVoxel) para Y-up na engine.
		return {
			x,
			y: zFromFile,
			z: yFromFile,
			color,
		}
	})
}

function convertVoxLoaderOutput(result) {
	const legacy = convertLegacyMagicaShape(result)
	if (legacy) {
		return legacy
	}

	const voxelsRaw = Array.isArray(result) ? result : result && result.voxels
	if (!Array.isArray(voxelsRaw)) {
		throw new Error('Saída inválida do loader .vox: esperado { voxels: [] } ou []')
	}
	return voxelsRaw.map((voxel) => ({
		x: Number(voxel.x || 0),
		y: Number(voxel.y || 0),
		z: Number(voxel.z || 0),
		color: normalizeColor(voxel.color),
	}))
}

function withSmallOrbit(baseScenario) {
	const voxels = baseScenario && Array.isArray(baseScenario.voxels) ? baseScenario.voxels : []
	if (voxels.length === 0) {
		return baseScenario
	}

	let minX = Number.POSITIVE_INFINITY
	let minY = Number.POSITIVE_INFINITY
	let minZ = Number.POSITIVE_INFINITY
	let maxX = Number.NEGATIVE_INFINITY
	let maxY = Number.NEGATIVE_INFINITY
	let maxZ = Number.NEGATIVE_INFINITY

	for (const voxel of voxels) {
		minX = Math.min(minX, voxel.x)
		minY = Math.min(minY, voxel.y)
		minZ = Math.min(minZ, voxel.z)
		maxX = Math.max(maxX, voxel.x)
		maxY = Math.max(maxY, voxel.y)
		maxZ = Math.max(maxZ, voxel.z)
	}

	const centerX = (minX + maxX) * 0.5
	const centerY = (minY + maxY) * 0.5
	const centerZ = (minZ + maxZ) * 0.5
	const spanX = maxX - minX + 1
	const spanY = maxY - minY + 1
	const spanZ = maxZ - minZ + 1
	const radius = Math.max(8, Math.max(spanX, spanZ) * 1.2)
	const orbitHeight = centerY + Math.max(4, spanY * 0.8)
	const orbitSpeed = 0.48

	function lookAtCenter(position) {
		const dx = centerX - position[0]
		const dy = centerY - position[1]
		const dz = centerZ - position[2]
		const horizontal = Math.hypot(dx, dz) || 0.0001
		return {
			yaw: Math.atan2(dz, dx),
			pitch: Math.atan2(dy, horizontal),
		}
	}

	const initialPosition = [
		centerX + radius * 0.92,
		orbitHeight,
		centerZ + radius * 0.35,
	]
	const initialLook = lookAtCenter(initialPosition)

	return {
		...baseScenario,
		cameraStart: {
			position: initialPosition,
			yaw: initialLook.yaw,
			pitch: initialLook.pitch,
		},
		cameraScript: (camera, elapsedSeconds) => {
			camera.position[0] = centerX + Math.cos(elapsedSeconds * orbitSpeed) * radius
			camera.position[1] = orbitHeight + Math.sin(elapsedSeconds * 0.9) * 0.8
			camera.position[2] = centerZ + Math.sin(elapsedSeconds * orbitSpeed) * radius
			const look = lookAtCenter(camera.position)
			camera.yaw = look.yaw
			camera.pitch = look.pitch
		},
	}
}

function withOrbitForModel(baseScenario, { radiusMul = 1.2, minRadius = 14 } = {}) {
	const voxels = baseScenario && Array.isArray(baseScenario.voxels) ? baseScenario.voxels : []
	if (voxels.length === 0) {
		return baseScenario
	}

	let minX = Number.POSITIVE_INFINITY
	let minY = Number.POSITIVE_INFINITY
	let minZ = Number.POSITIVE_INFINITY
	let maxX = Number.NEGATIVE_INFINITY
	let maxY = Number.NEGATIVE_INFINITY
	let maxZ = Number.NEGATIVE_INFINITY

	for (const voxel of voxels) {
		minX = Math.min(minX, voxel.x)
		minY = Math.min(minY, voxel.y)
		minZ = Math.min(minZ, voxel.z)
		maxX = Math.max(maxX, voxel.x)
		maxY = Math.max(maxY, voxel.y)
		maxZ = Math.max(maxZ, voxel.z)
	}

	const centerX = (minX + maxX) * 0.5
	const centerY = (minY + maxY) * 0.5
	const centerZ = (minZ + maxZ) * 0.5
	const spanX = maxX - minX + 1
	const spanY = maxY - minY + 1
	const spanZ = maxZ - minZ + 1
	const radius = Math.max(minRadius, Math.max(spanX, spanZ) * radiusMul)
	const orbitHeight = centerY + Math.max(6, spanY * 0.65)
	const orbitSpeed = 0.18

	function lookAtCenter(position) {
		const dx = centerX - position[0]
		const dy = centerY - position[1]
		const dz = centerZ - position[2]
		const horizontal = Math.hypot(dx, dz) || 0.0001
		return {
			yaw: Math.atan2(dz, dx),
			pitch: Math.atan2(dy, horizontal),
		}
	}

	const initialPosition = [centerX + radius, orbitHeight, centerZ + radius * 0.3]
	const initialLook = lookAtCenter(initialPosition)

	return {
		...baseScenario,
		cameraStart: {
			position: initialPosition,
			yaw: initialLook.yaw,
			pitch: initialLook.pitch,
		},
		cameraScript: (camera, elapsedSeconds) => {
			camera.position[0] = centerX + Math.cos(elapsedSeconds * orbitSpeed) * radius
			camera.position[1] = orbitHeight + Math.sin(elapsedSeconds * 0.7) * 0.9
			camera.position[2] = centerZ + Math.sin(elapsedSeconds * orbitSpeed) * radius
			const look = lookAtCenter(camera.position)
			camera.yaw = look.yaw
			camera.pitch = look.pitch
		},
	}
}

async function createSmallScenario(options, voxLoader) {
	if (voxLoader) {
		const voxUrl = options.voxUrl || DEFAULT_SMALL_VOX_URL
		try {
			const voxResult = await voxLoader(voxUrl)
			const voxels = convertVoxLoaderOutput(voxResult)
			return withSmallOrbit({
				id: 'small',
				voxels,
			})
		} catch (error) {
			console.warn(
				'Falha ao carregar .vox no cenário small, usando fallback:',
				error.message,
			)
		}
	}
	return withSmallOrbit(createSmallFallbackScenario())
}

async function createCathedralScenario(options, bin3Loader) {
	if (!bin3Loader) {
		throw new Error('bin3Loader não configurado')
	}
	const bin3Url = options.bin3Url || DEFAULT_CATHEDRAL_BIN3_URL
	const result = await bin3Loader(bin3Url, {
		sampleTargetPoints: Number(options.sampleTargetPoints || 140_000),
		voxelScale: Number(options.bin3VoxelScale || 10),
		maxVoxels: Number(options.bin3MaxVoxels || 120_000),
	})
	return withOrbitForModel(
		{
			id: 'large',
			voxels: result.voxels,
			voxelSize: 1.14,
		},
		{ radiusMul: 1.12, minRadius: 20 },
	)
}

export function createScenarioLoader({ voxLoader = null, bin3Loader = null } = {}) {
	return {
		async loadScenario(id, options = {}) {
			const seed = Number(options.seed || 1337)
			if (id === 'small') {
				return createSmallScenario(options, voxLoader)
			}
			if (id === 'large') {
				try {
					return await createCathedralScenario(options, bin3Loader)
				} catch (error) {
					console.warn('Falha ao carregar cenário 3 (catedral):', error.message)
				}
				return createMediumScenario(seed)
			}
			return createMediumScenario(seed)
		},
	}
}
