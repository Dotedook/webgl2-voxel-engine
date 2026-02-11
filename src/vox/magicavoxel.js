function readChunkId(view, offset) {
	return String.fromCharCode(
		view.getUint8(offset),
		view.getUint8(offset + 1),
		view.getUint8(offset + 2),
		view.getUint8(offset + 3),
	)
}

function buildDefaultPalette() {
	// Paleta fallback (1-based) para arquivos sem chunk RGBA.
	// Mantem cores estaveis e evita o fallback senoidal "neon".
	const levels = [255, 204, 153, 102, 51, 0]
	const palette = new Array(257)
	palette[0] = [0, 0, 0, 0]
	let ptr = 1

	for (let r = 0; r < levels.length; r += 1) {
		for (let g = 0; g < levels.length; g += 1) {
			for (let b = 0; b < levels.length; b += 1) {
				if (ptr >= 257) {
					return palette
				}
				palette[ptr++] = [levels[r], levels[g], levels[b], 255]
			}
		}
	}

	for (let i = 0; ptr < 257; i += 1) {
		const t = i / 39
		const v = Math.max(0, Math.min(255, Math.round((1 - t) * 255)))
		palette[ptr++] = [v, v, v, 255]
	}
	return palette
}

const DEFAULT_PALETTE = buildDefaultPalette()

function colorFromPalette(palette, colorIndex) {
	const idx = Number(colorIndex)
	if (!Number.isFinite(idx) || idx <= 0) {
		return null
	}
	const candidate =
		(palette && (palette[idx] || palette[idx - 1] || null)) ||
		DEFAULT_PALETTE[idx] ||
		DEFAULT_PALETTE[idx - 1] ||
		null
	if (!candidate) {
		return null
	}
	return [candidate[0], candidate[1], candidate[2]]
}

function parseVoxBuffer(buffer) {
	const view = new DataView(buffer)
	if (view.byteLength < 20) {
		throw new Error('Arquivo .vox inválido: muito pequeno')
	}

	const magic = readChunkId(view, 0)
	if (magic !== 'VOX ') {
		throw new Error('Arquivo inválido: assinatura VOX não encontrada')
	}

	const version = view.getInt32(4, true)
	if (version < 150) {
		throw new Error('Versão .vox não suportada: ' + version)
	}

	let offset = 8
	const mainId = readChunkId(view, offset)
	if (mainId !== 'MAIN') {
		throw new Error('Chunk MAIN não encontrado no arquivo .vox')
	}

	const mainContentSize = view.getUint32(offset + 4, true)
	const mainChildrenSize = view.getUint32(offset + 8, true)
	offset += 12 + mainContentSize

	const endOffset = Math.min(view.byteLength, offset + mainChildrenSize)
	let palette = [...DEFAULT_PALETTE]
	const models = []
	let lastSize = null

	while (offset + 12 <= endOffset) {
		const chunkId = readChunkId(view, offset)
		const chunkContentSize = view.getUint32(offset + 4, true)
		const chunkChildrenSize = view.getUint32(offset + 8, true)
		const contentOffset = offset + 12

		if (chunkId === 'SIZE' && chunkContentSize >= 12) {
			lastSize = {
				x: view.getInt32(contentOffset + 0, true),
				y: view.getInt32(contentOffset + 4, true),
				z: view.getInt32(contentOffset + 8, true),
			}
		} else if (chunkId === 'XYZI' && chunkContentSize >= 4) {
			const voxelCount = view.getUint32(contentOffset, true)
			const voxels = new Array(voxelCount)
			let voxelPtr = contentOffset + 4
			for (let i = 0; i < voxelCount; i += 1) {
				voxels[i] = {
					x: view.getUint8(voxelPtr + 0),
					y: view.getUint8(voxelPtr + 1),
					z: view.getUint8(voxelPtr + 2),
					colorIndex: view.getUint8(voxelPtr + 3),
				}
				voxelPtr += 4
			}
			models.push({
				size: lastSize,
				voxels,
			})
		} else if (chunkId === 'RGBA' && chunkContentSize >= 1024) {
			palette = new Array(257)
			palette[0] = [0, 0, 0, 0]
			for (let i = 0; i < 256; i += 1) {
				const base = contentOffset + i * 4
				palette[i + 1] = [
					view.getUint8(base + 0),
					view.getUint8(base + 1),
					view.getUint8(base + 2),
					view.getUint8(base + 3),
				]
			}
		}

		offset += 12 + chunkContentSize + chunkChildrenSize
	}

	if (models.length === 0) {
		throw new Error('Nenhum chunk XYZI encontrado no arquivo .vox')
	}

	const model = models[0]
	const normalized = []
	let minX = Number.POSITIVE_INFINITY
	let minY = Number.POSITIVE_INFINITY
	let minZ = Number.POSITIVE_INFINITY
	let maxX = Number.NEGATIVE_INFINITY
	let maxY = Number.NEGATIVE_INFINITY
	let maxZ = Number.NEGATIVE_INFINITY

	for (const voxel of model.voxels) {
		// MagicaVoxel usa Z como "up". Aqui convertemos para Y-up.
		const wx = voxel.x
		const wy = voxel.z
		const wz = voxel.y

		minX = Math.min(minX, wx)
		minY = Math.min(minY, wy)
		minZ = Math.min(minZ, wz)
		maxX = Math.max(maxX, wx)
		maxY = Math.max(maxY, wy)
		maxZ = Math.max(maxZ, wz)

		const color = colorFromPalette(palette, voxel.colorIndex) || [180, 180, 180]

		normalized.push({ x: wx, y: wy, z: wz, color })
	}

	const centerX = Math.floor((minX + maxX) * 0.5)
	const centerZ = Math.floor((minZ + maxZ) * 0.5)

	for (const voxel of normalized) {
		voxel.x -= centerX
		voxel.y -= minY
		voxel.z -= centerZ
	}

	return {
		voxels: normalized,
		meta: {
			version,
			modelCount: models.length,
			size: model.size || null,
		},
	}
}

export async function loadMagicaVoxel(voxUrl) {
	if (!voxUrl) {
		throw new Error('voxUrl é obrigatório para carregar um .vox')
	}
	const response = await fetch(voxUrl)
	if (!response.ok) {
		throw new Error('Falha ao baixar .vox: HTTP ' + response.status)
	}
	const buffer = await response.arrayBuffer()
	return parseVoxBuffer(buffer)
}

export { parseVoxBuffer as parseMagicaVoxelBuffer }
