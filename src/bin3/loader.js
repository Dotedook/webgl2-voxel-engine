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

function voxelHash(x, y, z) {
	let h = 2166136261 >>> 0
	h = Math.imul(h ^ (x >>> 0), 16777619) >>> 0
	h = Math.imul(h ^ (y >>> 0), 16777619) >>> 0
	h = Math.imul(h ^ (z >>> 0), 16777619) >>> 0
	return h >>> 0
}

function downsampleVoxelsByHash(voxels, targetCount) {
	if (voxels.length <= targetCount) {
		return voxels
	}
	const ranked = voxels.map((voxel, index) => ({
		index,
		hash: voxelHash(voxel.x, voxel.y, voxel.z),
	}))
	ranked.sort((a, b) => a.hash - b.hash || a.index - b.index)
	const out = new Array(targetCount)
	for (let i = 0; i < targetCount; i += 1) {
		out[i] = voxels[ranked[i].index]
	}
	return out
}

export async function loadBin3PointCloud(
	url,
	{
		sampleTargetPoints = 140_000,
		voxelScale = 10,
		maxVoxels = 120_000,
		fillGaps = false,
		fillRadius = 1,
		fillMaxExtraVoxels = 0,
	} = {},
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
	let sampledPoints = 0

	// Primeira passada: minimos para normalizacao.
	for (let i = 0; i < pointCount; i += stride) {
		const base = 8 + i * 10
		const x = view.getUint16(base + 0, true)
		const y = view.getUint16(base + 2, true)
		const z = view.getUint16(base + 4, true)
		minX = Math.min(minX, x)
		minY = Math.min(minY, y)
		minZ = Math.min(minZ, z)
		sampledPoints += 1
	}

	// Segunda passada: voxelizacao e deduplicacao.
	let dedupKeys = new Set()
	let voxels = []
	for (let i = 0; i < pointCount; i += stride) {
		const base = 8 + i * 10
		const x = view.getUint16(base + 0, true)
		const y = view.getUint16(base + 2, true)
		const z = view.getUint16(base + 4, true)
		const r = view.getUint8(base + 6)
		const g = view.getUint8(base + 7)
		const b = view.getUint8(base + 8)
		// Dataset: x,y,z. Mantemos y como altura (Y-up) para evitar modelo "deitado".
		const vx = Math.floor((x - minX) / voxelScale)
		const vy = Math.floor((y - minY) / voxelScale)
		const vz = Math.floor((z - minZ) / voxelScale)
		const key = vx + ',' + vy + ',' + vz
		if (dedupKeys.has(key)) {
			continue
		}
		dedupKeys.add(key)
		voxels.push({
			x: vx,
			y: vy,
			z: vz,
			color: [r, g, b],
		})
	}

	const dedupedVoxelCount = voxels.length
	let capApplied = false
	if (dedupedVoxelCount > maxVoxels) {
		// Em vez de truncar por ordem do arquivo (gera "recorte"), seleciona
		// uma amostra espacial deterministica e mais uniforme.
		voxels = downsampleVoxelsByHash(voxels, maxVoxels)
		capApplied = true
		dedupKeys = new Set(voxels.map((v) => v.x + ',' + v.y + ',' + v.z))
	}

	let fillAddedVoxels = 0
	if (fillGaps && fillMaxExtraVoxels > 0 && fillRadius > 0) {
		const extraLimit = Math.max(0, Math.floor(fillMaxExtraVoxels))
		const source = [...voxels]
		const neighbors = [
			[1, 0, 0],
			[-1, 0, 0],
			[0, 1, 0],
			[0, -1, 0],
			[0, 0, 1],
			[0, 0, -1],
		]
		const radius = Math.max(1, Math.floor(fillRadius))

		for (const voxel of source) {
			if (fillAddedVoxels >= extraLimit) {
				break
			}
			for (const n of neighbors) {
				for (let step = 1; step <= radius; step += 1) {
					if (fillAddedVoxels >= extraLimit) {
						break
					}
					const vx = voxel.x + n[0] * step
					const vy = voxel.y + n[1] * step
					const vz = voxel.z + n[2] * step
					const key = vx + ',' + vy + ',' + vz
					if (dedupKeys.has(key)) {
						continue
					}
					dedupKeys.add(key)
					voxels.push({
						x: vx,
						y: vy,
						z: vz,
						color: voxel.color,
					})
					fillAddedVoxels += 1
				}
			}
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
				sampledPoints,
				stride,
				voxelScale,
				dedupedVoxelCount,
				capApplied,
				fillAddedVoxels,
			},
		}
	}
