function readUint64LE(view, offset) {
	const low = view.getUint32(offset, true)
	const high = view.getUint32(offset + 4, true)
	return high * 0x1_0000_0000 + low
}

function computeBounds(voxels) {
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
	return { minX, minY, minZ, maxX, maxY, maxZ }
}

export async function loadBin3PointCloud(
	url,
	{ sampleTargetPoints = 140_000, voxelScale = 10, maxVoxels = 120_000 } = {},
) {
	if (!url) {
		throw new Error('URL .bin3 obrigatoria')
	}

	const response = await fetch(url)
	if (!response.ok) {
		throw new Error('Falha ao carregar .bin3: HTTP ' + response.status)
	}

	const buffer = await response.arrayBuffer()
	const view = new DataView(buffer)
	if (view.byteLength < 8) {
		throw new Error('Arquivo .bin3 invalido: cabecalho ausente')
	}

	const declaredPoints = readUint64LE(view, 0)
	const availableRecords = Math.floor((view.byteLength - 8) / 10)
	const pointCount = Math.min(declaredPoints, availableRecords)
	if (!Number.isFinite(pointCount) || pointCount <= 0) {
		throw new Error('Arquivo .bin3 sem pontos validos')
	}

	const stride = Math.max(1, Math.floor(pointCount / sampleTargetPoints))
	let minX = Number.POSITIVE_INFINITY
	let minY = Number.POSITIVE_INFINITY
	let minZ = Number.POSITIVE_INFINITY
	const sampled = []

	for (let i = 0; i < pointCount; i += stride) {
		const base = 8 + i * 10
		const x = view.getUint16(base + 0, true)
		const y = view.getUint16(base + 2, true)
		const z = view.getUint16(base + 4, true)
		const r = view.getUint8(base + 6)
		const g = view.getUint8(base + 7)
		const b = view.getUint8(base + 8)

		minX = Math.min(minX, x)
		minY = Math.min(minY, y)
		minZ = Math.min(minZ, z)
		sampled.push({ x, y, z, r, g, b })
	}

	const seen = new Set()
	const voxels = []
	for (const point of sampled) {
		// Dataset: x,y,z. Mantemos y como altura (Y-up) para evitar modelo "deitado".
		const vx = Math.floor((point.x - minX) / voxelScale)
		const vy = Math.floor((point.y - minY) / voxelScale)
		const vz = Math.floor((point.z - minZ) / voxelScale)
		const key = vx + ',' + vy + ',' + vz
		if (seen.has(key)) {
			continue
		}
		seen.add(key)
		voxels.push({
			x: vx,
			y: vy,
			z: vz,
			color: [point.r, point.g, point.b],
		})
		if (voxels.length >= maxVoxels) {
			break
		}
	}

	if (voxels.length === 0) {
		throw new Error('Nenhum voxel gerado a partir do .bin3')
	}

	const bounds = computeBounds(voxels)
	const centerX = Math.floor((bounds.minX + bounds.maxX) * 0.5)
	const centerZ = Math.floor((bounds.minZ + bounds.maxZ) * 0.5)
	for (const voxel of voxels) {
		voxel.x -= centerX
		voxel.z -= centerZ
	}

	return {
		voxels,
		meta: {
			declaredPoints,
			pointCount,
			sampledPoints: sampled.length,
			stride,
			voxelScale,
		},
	}
}
