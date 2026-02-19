import {
	createMat4,
	mat4Identity,
	mat4LookAt,
	mat4Multiply,
	mat4Perspective,
} from './math.js'

const VERTEX_SOURCE = `#version 300 es
layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_color;
uniform mat4 u_view_proj;
out vec3 v_color;
void main() {
  v_color = a_color;
  gl_Position = u_view_proj * vec4(a_position, 1.0);
}`

const FRAGMENT_SOURCE = `#version 300 es
precision mediump float;
in vec3 v_color;
out vec4 outColor;
void main() {
  outColor = vec4(v_color, 1.0);
}`

// Cada face esta em sentido anti-horario (CCW) quando observada por fora do cubo.
const CUBE_FACES = [
	// +Z
	[0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1],
	// -Z
	[1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0],
	// +X
	[1, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1],
	// -X
	[0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 0, 0],
	// +Y
	[0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 0],
	// -Y
	[0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1],
]

const FACE_TRIANGLE_ORDER = [0, 1, 2, 0, 2, 3]
const FACE_NEIGHBORS = [
	[0, 0, 1],
	[0, 0, -1],
	[1, 0, 0],
	[-1, 0, 0],
	[0, 1, 0],
	[0, -1, 0],
]

function compileShader(gl, type, source) {
	const shader = gl.createShader(type)
	gl.shaderSource(shader, source)
	gl.compileShader(shader)
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const msg = gl.getShaderInfoLog(shader)
		gl.deleteShader(shader)
		throw new Error('Shader compile error: ' + msg)
	}
	return shader
}

function createProgram(gl, vsSource, fsSource) {
	const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource)
	const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource)
	const program = gl.createProgram()
	gl.attachShader(program, vs)
	gl.attachShader(program, fs)
	gl.linkProgram(program)
	gl.deleteShader(vs)
	gl.deleteShader(fs)
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		const msg = gl.getProgramInfoLog(program)
		gl.deleteProgram(program)
		throw new Error('Program link error: ' + msg)
	}
	return program
}

function normalizeColor(color) {
	if (!Array.isArray(color) || color.length < 3) {
		return [0.85, 0.85, 0.85]
	}
	if (color[0] > 1 || color[1] > 1 || color[2] > 1) {
		return [color[0] / 255, color[1] / 255, color[2] / 255]
	}
	return [color[0], color[1], color[2]]
}

function voxelKey(x, y, z) {
	return x + ',' + y + ',' + z
}

function computeBoundsFromVoxels(voxels, voxelSize) {
	if (!Array.isArray(voxels) || voxels.length === 0) {
		return null
	}
	const scale = Math.max(0.2, voxelSize)
	const offset = (1 - scale) * 0.5
	let minX = Number.POSITIVE_INFINITY
	let minY = Number.POSITIVE_INFINITY
	let minZ = Number.POSITIVE_INFINITY
	let maxX = Number.NEGATIVE_INFINITY
	let maxY = Number.NEGATIVE_INFINITY
	let maxZ = Number.NEGATIVE_INFINITY

	for (const voxel of voxels) {
		const x0 = voxel.x + offset
		const y0 = voxel.y + offset
		const z0 = voxel.z + offset
		const x1 = x0 + scale
		const y1 = y0 + scale
		const z1 = z0 + scale
		minX = Math.min(minX, x0)
		minY = Math.min(minY, y0)
		minZ = Math.min(minZ, z0)
		maxX = Math.max(maxX, x1)
		maxY = Math.max(maxY, y1)
		maxZ = Math.max(maxZ, z1)
	}

	return { minX, minY, minZ, maxX, maxY, maxZ }
}

function normalizePlane(planes, offset) {
	const a = planes[offset + 0]
	const b = planes[offset + 1]
	const c = planes[offset + 2]
	const d = planes[offset + 3]
	const invLen = 1 / (Math.hypot(a, b, c) || 1)
	planes[offset + 0] = a * invLen
	planes[offset + 1] = b * invLen
	planes[offset + 2] = c * invLen
	planes[offset + 3] = d * invLen
}

function extractFrustumPlanes(out, m) {
	// Matriz em formato column-major.
	// rows: r0=[m0,m4,m8,m12], r1=[m1,m5,m9,m13], r2=[m2,m6,m10,m14], r3=[m3,m7,m11,m15]
	// left = r3 + r0
	out[0] = m[3] + m[0]
	out[1] = m[7] + m[4]
	out[2] = m[11] + m[8]
	out[3] = m[15] + m[12]
	// right = r3 - r0
	out[4] = m[3] - m[0]
	out[5] = m[7] - m[4]
	out[6] = m[11] - m[8]
	out[7] = m[15] - m[12]
	// bottom = r3 + r1
	out[8] = m[3] + m[1]
	out[9] = m[7] + m[5]
	out[10] = m[11] + m[9]
	out[11] = m[15] + m[13]
	// top = r3 - r1
	out[12] = m[3] - m[1]
	out[13] = m[7] - m[5]
	out[14] = m[11] - m[9]
	out[15] = m[15] - m[13]
	// near = r3 + r2
	out[16] = m[3] + m[2]
	out[17] = m[7] + m[6]
	out[18] = m[11] + m[10]
	out[19] = m[15] + m[14]
	// far = r3 - r2
	out[20] = m[3] - m[2]
	out[21] = m[7] - m[6]
	out[22] = m[11] - m[10]
	out[23] = m[15] - m[14]

	for (let i = 0; i < 24; i += 4) {
		normalizePlane(out, i)
	}
}

function aabbIntersectsFrustum(bounds, planes) {
	if (!bounds) {
		return true
	}
	for (let i = 0; i < 24; i += 4) {
		const nx = planes[i + 0]
		const ny = planes[i + 1]
		const nz = planes[i + 2]
		const d = planes[i + 3]
		const px = nx >= 0 ? bounds.maxX : bounds.minX
		const py = ny >= 0 ? bounds.maxY : bounds.minY
		const pz = nz >= 0 ? bounds.maxZ : bounds.minZ
		if (nx * px + ny * py + nz * pz + d < 0) {
			return false
		}
	}
	return true
}

function toColorByte(value) {
	if (!Number.isFinite(value)) {
		return 0
	}
	if (value <= 1) {
		return Math.max(0, Math.min(255, Math.round(value * 255)))
	}
	return Math.max(0, Math.min(255, Math.round(value)))
}

function fnv1aMix(hash, value) {
	let h = hash ^ (value & 0xff)
	h = Math.imul(h, 16777619)
	h = h >>> 0
	h ^= (value >>> 8) & 0xff
	h = Math.imul(h, 16777619) >>> 0
	h ^= (value >>> 16) & 0xff
	h = Math.imul(h, 16777619) >>> 0
	return h
}

function computeChunkSignature(voxels) {
	const count = Array.isArray(voxels) ? voxels.length : 0
	if (count === 0) {
		return '0:0'
	}
	let hash = 2166136261
	for (let i = 0; i < voxels.length; i += 1) {
		const voxel = voxels[i]
		hash = fnv1aMix(hash, (Number(voxel.x) | 0) >>> 0)
		hash = fnv1aMix(hash, (Number(voxel.y) | 0) >>> 0)
		hash = fnv1aMix(hash, (Number(voxel.z) | 0) >>> 0)
		const color = Array.isArray(voxel.color) ? voxel.color : [0, 0, 0]
		hash = fnv1aMix(hash, toColorByte(color[0]))
		hash = fnv1aMix(hash, toColorByte(color[1]))
		hash = fnv1aMix(hash, toColorByte(color[2]))
	}
	return String(count) + ':' + hash.toString(16)
}

function buildExposedVoxelVertices(voxels, voxelSize = 1) {
	const scale = Math.max(0.2, voxelSize)
	const offset = (1 - scale) * 0.5
	const occupancy = new Set()

	for (const voxel of voxels) {
		occupancy.add(voxelKey(voxel.x, voxel.y, voxel.z))
	}

	let exposedFaceCount = 0
	for (const voxel of voxels) {
		for (let face = 0; face < CUBE_FACES.length; face += 1) {
			const dir = FACE_NEIGHBORS[face]
			const neighborKey = voxelKey(
				voxel.x + dir[0],
				voxel.y + dir[1],
				voxel.z + dir[2],
			)
			if (occupancy.has(neighborKey)) {
				continue
			}
			exposedFaceCount += 1
		}
	}

	// Cada face exposta gera 6 vertices; cada vertice tem 6 floats (posicao + cor).
	const floatsPerFace = 36
	const totalFloats = exposedFaceCount * floatsPerFace
	// Evita alocacoes impraticaveis e erro obscuro de "Invalid array length".
	const maxReasonableFloats = 1_600_000_000
	if (totalFloats > maxReasonableFloats) {
		throw new Error(
			'Cena grande demais para meshing atual (' +
				totalFloats +
				' floats). Reduza densidade (voxelScale/limites).',
		)
	}
	const values = new Float32Array(totalFloats)
	let ptr = 0
	let triangleCount = 0

	for (const voxel of voxels) {
		const [cr, cg, cb] = normalizeColor(voxel.color)
		for (let face = 0; face < CUBE_FACES.length; face += 1) {
			const dir = FACE_NEIGHBORS[face]
			const neighborKey = voxelKey(
				voxel.x + dir[0],
				voxel.y + dir[1],
				voxel.z + dir[2],
			)
			if (occupancy.has(neighborKey)) {
				continue
			}
			const corners = CUBE_FACES[face]
			for (let tri = 0; tri < FACE_TRIANGLE_ORDER.length; tri += 1) {
				const cornerIndex = FACE_TRIANGLE_ORDER[tri] * 3
				values[ptr++] = voxel.x + corners[cornerIndex + 0] * scale + offset
				values[ptr++] = voxel.y + corners[cornerIndex + 1] * scale + offset
				values[ptr++] = voxel.z + corners[cornerIndex + 2] * scale + offset
				values[ptr++] = cr
				values[ptr++] = cg
				values[ptr++] = cb
			}
			triangleCount += 2
		}
	}

	return {
		vertices: values,
		triangleCount,
		bounds: computeBoundsFromVoxels(voxels, voxelSize),
	}
}

export class Renderer {
	constructor(gl, { enableChunkFrustumCulling = true } = {}) {
		this.gl = gl
		this.program = null
		this.singleMesh = null
		this.chunkMeshes = new Map()
		this.chunkFrustumCullingEnabled = enableChunkFrustumCulling !== false
		this.totalVertexCount = 0
		this.totalTriangleCount = 0
		this.totalVoxelCount = 0
		this.vertexCount = 0
		this.triangleCount = 0
		this.drawCalls = 0
		this.visibility = {
			totalChunks: 0,
			visibleChunks: 0,
			culledChunks: 0,
			visibleTriangles: 0,
		}
		this.viewProj = createMat4()
		this.view = createMat4()
		this.proj = createMat4()
		this.model = createMat4()
		this.frustumPlanes = new Float32Array(24)
		this.uViewProj = null
	}

	init() {
		const gl = this.gl
		this.program = createProgram(gl, VERTEX_SOURCE, FRAGMENT_SOURCE)
		this.uViewProj = gl.getUniformLocation(this.program, 'u_view_proj')
		mat4Identity(this.model)

		gl.enable(gl.DEPTH_TEST)
		gl.enable(gl.CULL_FACE)
		gl.cullFace(gl.BACK)
		gl.frontFace(gl.CCW)
		gl.clearColor(0.05, 0.08, 0.1, 1.0)
	}

	createMeshFromVoxels(voxels, voxelSize = 1) {
		const gl = this.gl
		const meshStart = performance.now()
		const { vertices, triangleCount, bounds } = buildExposedVoxelVertices(
			voxels,
			voxelSize,
		)
		const meshGenerationMs = performance.now() - meshStart

		const vao = gl.createVertexArray()
		const vbo = gl.createBuffer()
		gl.bindVertexArray(vao)
		gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
		gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)
		gl.enableVertexAttribArray(0)
		gl.enableVertexAttribArray(1)
		gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0)
		gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12)
		gl.bindVertexArray(null)
		gl.bindBuffer(gl.ARRAY_BUFFER, null)

		const vertexCount = vertices.length / 6
		return {
			vao,
			vbo,
			vertexCount,
			triangleCount,
			voxelCount: voxels.length,
			bounds,
			meshGenerationMs,
		}
	}

	disposeMesh(mesh) {
		if (!mesh) {
			return
		}
		this.gl.deleteBuffer(mesh.vbo)
		this.gl.deleteVertexArray(mesh.vao)
	}

	disposeAllChunkMeshes() {
		for (const mesh of this.chunkMeshes.values()) {
			this.disposeMesh(mesh)
		}
		this.chunkMeshes.clear()
	}

	shouldRebuildChunk(existingMesh, chunk, signature, { forceDirty = false } = {}) {
		if (!existingMesh) {
			return true
		}
		if (chunk && chunk.dirty === false) {
			return false
		}
		if (chunk && chunk.dirty === true) {
			return true
		}
		if (forceDirty) {
			return true
		}
		return existingMesh.signature !== signature
	}

	recomputeTotals() {
		let vertices = 0
		let triangles = 0
		let voxels = 0
		if (this.singleMesh) {
			vertices += this.singleMesh.vertexCount
			triangles += this.singleMesh.triangleCount
			voxels += this.singleMesh.voxelCount
		}
		for (const mesh of this.chunkMeshes.values()) {
			vertices += mesh.vertexCount
			triangles += mesh.triangleCount
			voxels += mesh.voxelCount
		}
		this.totalVertexCount = vertices
		this.totalTriangleCount = triangles
		this.totalVoxelCount = voxels
	}

	uploadVoxels(voxels, { voxelSize = 1 } = {}) {
		if (this.singleMesh) {
			this.disposeMesh(this.singleMesh)
			this.singleMesh = null
		}
		this.disposeAllChunkMeshes()
		this.singleMesh = this.createMeshFromVoxels(voxels, voxelSize)
		this.recomputeTotals()
		return {
			meshGenerationMs: this.singleMesh.meshGenerationMs,
			vertexCount: this.singleMesh.vertexCount,
			triangleCount: this.singleMesh.triangleCount,
			voxelCount: this.singleMesh.voxelCount,
			chunkCount: 0,
		}
	}

	replaceChunks(chunks, { voxelSize = 1 } = {}) {
		if (this.singleMesh) {
			this.disposeMesh(this.singleMesh)
			this.singleMesh = null
		}
		let meshGenerationMs = 0
		let builtChunkCount = 0
		let reusedChunkCount = 0
		let removedChunkCount = 0
		const nextIds = new Set()
		for (const chunk of chunks) {
			const id = String(chunk.id)
			const voxels = Array.isArray(chunk.voxels) ? chunk.voxels : []
			nextIds.add(id)
			const signature = computeChunkSignature(voxels)
			const existing = this.chunkMeshes.get(id)
			const shouldRebuild = this.shouldRebuildChunk(existing, chunk, signature)
			if (shouldRebuild) {
				if (existing) {
					this.disposeMesh(existing)
				}
				const mesh = this.createMeshFromVoxels(voxels, voxelSize)
				meshGenerationMs += mesh.meshGenerationMs
				mesh.signature = signature
				this.chunkMeshes.set(id, mesh)
				builtChunkCount += 1
			} else {
				reusedChunkCount += 1
			}
		}
		for (const [id, mesh] of this.chunkMeshes.entries()) {
			if (nextIds.has(id)) {
				continue
			}
			this.disposeMesh(mesh)
			this.chunkMeshes.delete(id)
			removedChunkCount += 1
		}
		this.recomputeTotals()
		return {
			meshGenerationMs,
			builtChunkCount,
			reusedChunkCount,
			removedChunkCount,
			vertexCount: this.totalVertexCount,
			triangleCount: this.totalTriangleCount,
			voxelCount: this.totalVoxelCount,
			chunkCount: this.chunkMeshes.size,
		}
	}

	upsertChunks(chunks, { voxelSize = 1 } = {}) {
		let meshGenerationMs = 0
		let builtChunkCount = 0
		let reusedChunkCount = 0
		for (const chunk of chunks) {
			const id = String(chunk.id)
			const voxels = Array.isArray(chunk.voxels) ? chunk.voxels : []
			const signature = computeChunkSignature(voxels)
			const existing = this.chunkMeshes.get(id)
			const shouldRebuild = this.shouldRebuildChunk(existing, chunk, signature)
			if (shouldRebuild) {
				if (existing) {
					this.disposeMesh(existing)
				}
				const mesh = this.createMeshFromVoxels(voxels, voxelSize)
				meshGenerationMs += mesh.meshGenerationMs
				mesh.signature = signature
				this.chunkMeshes.set(id, mesh)
				builtChunkCount += 1
			} else {
				reusedChunkCount += 1
			}
		}
		this.recomputeTotals()
		return {
			meshGenerationMs,
			builtChunkCount,
			reusedChunkCount,
			chunkCount: this.chunkMeshes.size,
			vertexCount: this.totalVertexCount,
			triangleCount: this.totalTriangleCount,
			voxelCount: this.totalVoxelCount,
		}
	}

	getWorldStats() {
		return {
			vertexCount: this.totalVertexCount,
			triangleCount: this.totalTriangleCount,
			voxelCount: this.totalVoxelCount,
			chunkCount: this.chunkMeshes.size,
		}
	}

	setChunkFrustumCullingEnabled(enabled) {
		this.chunkFrustumCullingEnabled = Boolean(enabled)
	}

	isChunkFrustumCullingEnabled() {
		return this.chunkFrustumCullingEnabled
	}

	resize(width, height) {
		this.gl.viewport(0, 0, width, height)
	}

	render(camera, width, height) {
		const gl = this.gl
		this.drawCalls = 0

		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

		const aspect = width / Math.max(1, height)
		// Far plane maior para cenas grandes (ex.: catedral .bin3) sem clipping visivel.
		mat4Perspective(this.proj, (55 * Math.PI) / 180, aspect, 0.1, 5000.0)
		mat4LookAt(this.view, camera.position, camera.target, camera.up)
		mat4Multiply(this.viewProj, this.proj, this.view)

		gl.useProgram(this.program)
		gl.uniformMatrix4fv(this.uViewProj, false, this.viewProj)

		if (this.chunkMeshes.size > 0) {
			if (this.chunkFrustumCullingEnabled) {
				extractFrustumPlanes(this.frustumPlanes, this.viewProj)
			}
			let visibleChunks = 0
			let culledChunks = 0
			let visibleTriangles = 0
			for (const mesh of this.chunkMeshes.values()) {
				if (
					this.chunkFrustumCullingEnabled &&
					!aabbIntersectsFrustum(mesh.bounds, this.frustumPlanes)
				) {
					culledChunks += 1
					continue
				}
				visibleChunks += 1
				visibleTriangles += mesh.triangleCount
				if (mesh.vertexCount <= 0) {
					continue
				}
				gl.bindVertexArray(mesh.vao)
				gl.drawArrays(gl.TRIANGLES, 0, mesh.vertexCount)
				this.drawCalls += 1
			}
			gl.bindVertexArray(null)
			this.vertexCount = this.totalVertexCount
			this.triangleCount = visibleTriangles
			this.visibility = {
				totalChunks: this.chunkMeshes.size,
				visibleChunks,
				culledChunks,
				visibleTriangles,
			}
			return
		}

		if (this.singleMesh && this.singleMesh.vertexCount > 0) {
			gl.bindVertexArray(this.singleMesh.vao)
			gl.drawArrays(gl.TRIANGLES, 0, this.singleMesh.vertexCount)
			gl.bindVertexArray(null)
			this.drawCalls = 1
			this.vertexCount = this.singleMesh.vertexCount
			this.triangleCount = this.singleMesh.triangleCount
			this.visibility = {
				totalChunks: 0,
				visibleChunks: 0,
				culledChunks: 0,
				visibleTriangles: this.singleMesh.triangleCount,
			}
			return
		}

		this.vertexCount = 0
		this.triangleCount = 0
		this.visibility = {
			totalChunks: 0,
			visibleChunks: 0,
			culledChunks: 0,
			visibleTriangles: 0,
		}
	}
}
