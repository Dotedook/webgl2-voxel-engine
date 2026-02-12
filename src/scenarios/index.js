import {
	createMediumScenario,
	createSmallFallbackScenario,
} from './procedural.js'

export const scenarioIds = ['small', 'medium', 'large', 'xlarge']
export const DEFAULT_SMALL_VOX_URL = '/assets/chr_old.vox'
export const DEFAULT_CATHEDRAL_BIN3_URL = '/assets/sibenik_sample.bin3'
export const DEFAULT_FULL_CATHEDRAL_BIN3_URL = '/assets/sibenik.bin3'

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
		throw new Error(
			'Saída inválida do loader .vox: esperado { voxels: [] } ou []',
		)
	}
	return voxelsRaw.map((voxel) => ({
		x: Number(voxel.x || 0),
		y: Number(voxel.y || 0),
		z: Number(voxel.z || 0),
		color: normalizeColor(voxel.color),
	}))
}

const CATHEDRAL_BENCH_TRAJECTORY_POINTS = [
	{
		t: 0.0,
		x: -846.8034,
		y: 220.4871,
		z: -8.1987,
		yaw: 0.047864,
		pitch: -0.009949,
	},
	{
		t: 5.4108,
		x: -770.0931,
		y: 220.4871,
		z: 260.1319,
		yaw: -0.369336,
		pitch: 0.037651,
	},
	{
		t: 11.8042,
		x: -1.7398,
		y: 220.4871,
		z: 569.1204,
		yaw: -1.646136,
		pitch: -0.063149,
	},
	{
		t: 17.0291,
		x: 627.2406,
		y: 220.4871,
		z: 333.927,
		yaw: -2.690536,
		pitch: -0.068749,
	},
	{
		t: 20.0736,
		x: 756.0731,
		y: 220.4871,
		z: -54.7345,
		yaw: -3.202936,
		pitch: -0.116349,
	},
	{
		t: 24.6437,
		x: 368.0504,
		y: 220.4871,
		z: -485.3549,
		yaw: -4.420936,
		pitch: -0.060349,
	},
	{
		t: 28.9941,
		x: -199.9814,
		y: 220.4871,
		z: -600.601,
		yaw: -5.028536,
		pitch: -0.037949,
	},
	{
		t: 32.107,
		x: -626.4587,
		y: 220.4871,
		z: -489.8893,
		yaw: -5.445736,
		pitch: 0.004051,
	},
	{
		t: 36.0662,
		x: -771.9174,
		y: 220.4871,
		z: -13.8001,
		yaw: -6.260536,
		pitch: -0.054749,
	},
	{
		t: 38.2881,
		x: -765.4009,
		y: 161.5412,
		z: -12.973,
		yaw: -6.156936,
		pitch: -0.071549,
	},
	{
		t: 40.4934,
		x: -534.2683,
		y: 80.4596,
		z: -2.172,
		yaw: -6.263336,
		pitch: -0.107949,
	},
	{
		t: 43.9435,
		x: -345.5699,
		y: 43.9796,
		z: 2.8916,
		yaw: -6.246536,
		pitch: 0.275651,
	},
	{
		t: 50.5435,
		x: 122.6712,
		y: 43.9796,
		z: 0.9481,
		yaw: -6.154136,
		pitch: 1.4888,
	},
	{
		t: 53.285,
		x: 138.8643,
		y: 43.9796,
		z: -0.9363,
		yaw: -6.350136,
		pitch: -0.0792,
	},
	{
		t: 58.9845,
		x: 251.453,
		y: 85.3077,
		z: 1.9474,
		yaw: -3.160936,
		pitch: -0.1184,
	},
	{
		t: 60.9848,
		x: 201.197,
		y: 132.7316,
		z: -41.7593,
		yaw: -2.824936,
		pitch: -0.4656,
	},
	{
		t: 62.6708,
		x: 168.752,
		y: 152.3095,
		z: -5.8826,
		yaw: -3.846936,
		pitch: -0.6504,
	},
	{
		t: 65.4043,
		x: 14.9023,
		y: 157.0676,
		z: -6.3727,
		yaw: -3.152536,
		pitch: 0.128,
	},
	{
		t: 68.2292,
		x: -322.9503,
		y: 157.0676,
		z: 4.0173,
		yaw: -3.124536,
		pitch: 0.0664,
	},
	{
		t: 72.4294,
		x: -336.8859,
		y: 157.0676,
		z: 3.7796,
		yaw: -0.089336,
		pitch: -0.0904,
	},
]

function lerp(a, b, t) {
	return a + (b - a) * t
}

function smoothstep(t) {
	return t * t * (3 - 2 * t)
}

function computeBounds(points, keys) {
	const [kx, ky, kz] = keys
	let minX = Number.POSITIVE_INFINITY
	let minY = Number.POSITIVE_INFINITY
	let minZ = Number.POSITIVE_INFINITY
	let maxX = Number.NEGATIVE_INFINITY
	let maxY = Number.NEGATIVE_INFINITY
	let maxZ = Number.NEGATIVE_INFINITY
	for (const point of points) {
		minX = Math.min(minX, point[kx])
		minY = Math.min(minY, point[ky])
		minZ = Math.min(minZ, point[kz])
		maxX = Math.max(maxX, point[kx])
		maxY = Math.max(maxY, point[ky])
		maxZ = Math.max(maxZ, point[kz])
	}
	return {
		minX,
		minY,
		minZ,
		maxX,
		maxY,
		maxZ,
		centerX: (minX + maxX) * 0.5,
		centerY: (minY + maxY) * 0.5,
		centerZ: (minZ + maxZ) * 0.5,
		spanX: Math.max(1, maxX - minX),
		spanY: Math.max(1, maxY - minY),
		spanZ: Math.max(1, maxZ - minZ),
	}
}

function unwrapAngles(values) {
	if (values.length === 0) {
		return []
	}
	const out = [values[0]]
	for (let i = 1; i < values.length; i += 1) {
		let angle = values[i]
		const prev = out[i - 1]
		while (angle - prev > Math.PI) angle -= Math.PI * 2
		while (angle - prev < -Math.PI) angle += Math.PI * 2
		out.push(angle)
	}
	return out
}

function smoothSeries(values, windowRadius = 1) {
	if (!Array.isArray(values) || values.length === 0) {
		return []
	}
	const radius = Math.max(0, Math.floor(windowRadius))
	if (radius === 0) {
		return values.slice()
	}
	const out = new Array(values.length)
	for (let i = 0; i < values.length; i += 1) {
		let sum = 0
		let count = 0
		for (
			let j = Math.max(0, i - radius);
			j <= Math.min(values.length - 1, i + radius);
			j += 1
		) {
			sum += values[j]
			count += 1
		}
		out[i] = sum / Math.max(1, count)
	}
	return out
}

function clamp01(v) {
	return Math.max(0, Math.min(1, v))
}

function windowWeight(t, start, end, feather = 1.5) {
	if (t <= start || t >= end) {
		return 0
	}
	const f = Math.max(0.0001, feather)
	const inW = smoothstep(clamp01((t - start) / f))
	const outW = 1 - smoothstep(clamp01((t - (end - f)) / f))
	return inW * outW
}

function closestAngle(from, to) {
	let a = to
	while (a - from > Math.PI) a -= Math.PI * 2
	while (a - from < -Math.PI) a += Math.PI * 2
	return a
}

function appendLoopClosure(
	points,
	closureDurationSeconds = 7,
	closureSteps = 7,
) {
	if (!Array.isArray(points) || points.length < 2) {
		return points
	}
	const duration = Math.max(0.001, closureDurationSeconds)
	const steps = Math.max(2, Math.floor(closureSteps))
	const out = points.slice()
	const first = out[0]
	const last = out[out.length - 1]
	const yawTarget = closestAngle(last.yaw, first.yaw)
	const pitchTarget = first.pitch

	for (let i = 1; i <= steps; i += 1) {
		const u = i / steps
		const s = smoothstep(u)
		out.push({
			t: last.t + duration * u,
			x: lerp(last.x, first.x, s),
			y: lerp(last.y, first.y, s),
			z: lerp(last.z, first.z, s),
			yaw: lerp(last.yaw, yawTarget, s),
			pitch: lerp(last.pitch, pitchTarget, s),
		})
	}
	return out
}

function withTrajectoryForModel(baseScenario, trajectoryPoints, options = {}) {
	const voxels =
		baseScenario && Array.isArray(baseScenario.voxels)
			? baseScenario.voxels
			: []
	if (
		voxels.length === 0 ||
		!Array.isArray(trajectoryPoints) ||
		trajectoryPoints.length < 2
	) {
		return baseScenario
	}

	const yCompression = Number.isFinite(options.yCompression)
		? options.yCompression
		: 0.38
	const ySmoothWindow = Number.isFinite(options.ySmoothWindow)
		? options.ySmoothWindow
		: 2
	const yBias = Number.isFinite(options.yBias) ? options.yBias : 0
	const firstLapEndT = Number.isFinite(options.firstLapEndT)
		? options.firstLapEndT
		: 36.5
	const firstLapRadiusBoost = Number.isFinite(options.firstLapRadiusBoost)
		? options.firstLapRadiusBoost
		: 0.16
	const firstLapYOffset = Number.isFinite(options.firstLapYOffset)
		? options.firstLapYOffset
		: -0.03
	const entryStartT = Number.isFinite(options.entryStartT)
		? options.entryStartT
		: 38.0
	const entryEndT = Number.isFinite(options.entryEndT)
		? options.entryEndT
		: 63.0
	const entryYOffset = Number.isFinite(options.entryYOffset)
		? options.entryYOffset
		: -0.018
	const loopClosureSeconds = Number.isFinite(options.loopClosureSeconds)
		? options.loopClosureSeconds
		: 7
	const loopClosureSteps = Number.isFinite(options.loopClosureSteps)
		? options.loopClosureSteps
		: 7

	const modelBounds = computeBounds(voxels, ['x', 'y', 'z'])
	const templateBounds = computeBounds(trajectoryPoints, ['x', 'y', 'z'])
	const mappedPointsRaw = trajectoryPoints.map((point) => {
		const nx = (point.x - templateBounds.centerX) / templateBounds.spanX
		const ny = (point.y - templateBounds.centerY) / templateBounds.spanY
		const nz = (point.z - templateBounds.centerZ) / templateBounds.spanZ
		return {
			t: point.t,
			x: modelBounds.centerX + nx * modelBounds.spanX,
			y: modelBounds.centerY + ny * modelBounds.spanY,
			z: modelBounds.centerZ + nz * modelBounds.spanZ,
			yaw: point.yaw,
			pitch: point.pitch,
		}
	})

	const yCenter = modelBounds.centerY + yBias
	const yValues = mappedPointsRaw.map((point) => point.y)
	const yCompressed = yValues.map((y) => yCenter + (y - yCenter) * yCompression)
	const ySmoothed = smoothSeries(yCompressed, ySmoothWindow)
	const mappedPoints = mappedPointsRaw.map((point, index) => {
		const t = point.t
		const firstLapW = windowWeight(t, 0, firstLapEndT, 3.5)
		const entryW = windowWeight(t, entryStartT, entryEndT, 3)
		const dx = point.x - modelBounds.centerX
		const dz = point.z - modelBounds.centerZ
		const radialScale = 1 + firstLapRadiusBoost * firstLapW
		const yOffset =
			modelBounds.spanY * firstLapYOffset * firstLapW +
			modelBounds.spanY * entryYOffset * entryW
		return {
			...point,
			x: modelBounds.centerX + dx * radialScale,
			y: ySmoothed[index] + yOffset,
			z: modelBounds.centerZ + dz * radialScale,
		}
	})

	const yawUnwrapped = unwrapAngles(mappedPoints.map((point) => point.yaw))
	const pitchUnwrapped = unwrapAngles(mappedPoints.map((point) => point.pitch))
	const basePoints = mappedPoints.map((point, index) => ({
		...point,
		yaw: yawUnwrapped[index],
		pitch: pitchUnwrapped[index],
	}))
	const points = appendLoopClosure(
		basePoints,
		loopClosureSeconds,
		loopClosureSteps,
	)
	const first = points[0]
	const duration = Math.max(0.001, points[points.length - 1].t - first.t)
	let lastSegmentIndex = 0

	return {
		...baseScenario,
		cameraStart: {
			position: [first.x, first.y, first.z],
			yaw: first.yaw,
			pitch: first.pitch,
		},
		cameraScript: (camera, elapsedSeconds) => {
			const localTime =
				(((elapsedSeconds % duration) + duration) % duration) + first.t
			let i = lastSegmentIndex
			if (
				localTime < points[i].t ||
				localTime > points[Math.min(points.length - 1, i + 1)].t
			) {
				i = 0
				while (i < points.length - 2 && localTime > points[i + 1].t) {
					i += 1
				}
			}
			lastSegmentIndex = i

			const a = points[i]
			const b = points[Math.min(points.length - 1, i + 1)]
			const segmentDuration = Math.max(0.0001, b.t - a.t)
			const rawT = (localTime - a.t) / segmentDuration
			const t = smoothstep(Math.min(1, Math.max(0, rawT)))

			camera.position[0] = lerp(a.x, b.x, t)
			camera.position[1] = lerp(a.y, b.y, t)
			camera.position[2] = lerp(a.z, b.z, t)
			camera.yaw = lerp(a.yaw, b.yaw, t)
			camera.pitch = lerp(a.pitch, b.pitch, t)
		},
	}
}

function withSmallOrbit(baseScenario) {
	const voxels =
		baseScenario && Array.isArray(baseScenario.voxels)
			? baseScenario.voxels
			: []
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
			camera.position[0] =
				centerX + Math.cos(elapsedSeconds * orbitSpeed) * radius
			camera.position[1] = orbitHeight + Math.sin(elapsedSeconds * 0.9) * 0.8
			camera.position[2] =
				centerZ + Math.sin(elapsedSeconds * orbitSpeed) * radius
			const look = lookAtCenter(camera.position)
			camera.yaw = look.yaw
			camera.pitch = look.pitch
		},
	}
}

function withOrbitForModel(
	baseScenario,
	{ radiusMul = 1.2, minRadius = 14 } = {},
) {
	const voxels =
		baseScenario && Array.isArray(baseScenario.voxels)
			? baseScenario.voxels
			: []
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

	const initialPosition = [
		centerX + radius,
		orbitHeight,
		centerZ + radius * 0.3,
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
			camera.position[0] =
				centerX + Math.cos(elapsedSeconds * orbitSpeed) * radius
			camera.position[1] = orbitHeight + Math.sin(elapsedSeconds * 0.7) * 0.9
			camera.position[2] =
				centerZ + Math.sin(elapsedSeconds * orbitSpeed) * radius
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

async function createCathedralScenario(id, options, bin3Loader) {
	if (!bin3Loader) {
		throw new Error('bin3Loader não configurado')
	}
	const isXLarge = id === 'xlarge'
	const rawBin3Url = String(options.bin3Url || '').trim()
	const defaultUrl = isXLarge
		? DEFAULT_FULL_CATHEDRAL_BIN3_URL
		: DEFAULT_CATHEDRAL_BIN3_URL
	const bin3Url =
		isXLarge && (!rawBin3Url || rawBin3Url === DEFAULT_CATHEDRAL_BIN3_URL)
			? defaultUrl
			: rawBin3Url || defaultUrl
	const sampleTargetPoints = Number(
		options.sampleTargetPoints || (isXLarge ? 1_200_000 : 140_000),
	)
	const voxelScale = Number(options.bin3VoxelScale || (isXLarge ? 5 : 10))
	const maxVoxels = Number(
		options.bin3MaxVoxels || (isXLarge ? 900_000 : 120_000),
	)

	let result
	try {
		result = await bin3Loader(bin3Url, {
			sampleTargetPoints,
			voxelScale,
			maxVoxels,
			fillGaps: isXLarge,
			fillRadius: Number(options.bin3FillRadius || 1),
			fillMaxExtraVoxels: Number(options.bin3FillMaxExtraVoxels || 220_000),
		})
	} catch (error) {
		if (bin3Url === DEFAULT_CATHEDRAL_BIN3_URL) {
			throw error
		}
		console.warn(
			'Falha ao carregar BIN3 principal, tentando sample:',
			error.message,
		)
		result = await bin3Loader(DEFAULT_CATHEDRAL_BIN3_URL, {
			sampleTargetPoints: 140_000,
			voxelScale: 10,
			maxVoxels: 120_000,
			fillGaps: false,
		})
	}

	return withTrajectoryForModel(
		{
			id,
			voxels: result.voxels,
			voxelSize: 1.14,
			cameraMoveSpeed: isXLarge ? 42 : 30,
			cameraVerticalSpeed: isXLarge ? 30 : 20,
		},
		CATHEDRAL_BENCH_TRAJECTORY_POINTS,
		{
			yCompression: 0.34,
			ySmoothWindow: 2,
			firstLapEndT: 36.5,
			firstLapRadiusBoost: 2,
			firstLapYOffset: -0.03,
			entryStartT: 38.0,
			entryEndT: 63.0,
			entryYOffset: -0.3,
			loopClosureSeconds: 7,
			loopClosureSteps: 7,
		},
	)
}

export function createScenarioLoader({
	voxLoader = null,
	bin3Loader = null,
} = {}) {
	return {
		async loadScenario(id, options = {}) {
			const seed = Number(options.seed || 1337)
			if (id === 'small') {
				return createSmallScenario(options, voxLoader)
			}
			if (id === 'large' || id === 'xlarge') {
				try {
					return await createCathedralScenario(id, options, bin3Loader)
				} catch (error) {
					console.warn('Falha ao carregar catedral (.bin3):', error.message)
				}
				return createMediumScenario(seed)
			}
			return createMediumScenario(seed)
		},
	}
}
