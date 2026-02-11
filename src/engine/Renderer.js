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

function buildVoxelVertices(voxels, voxelSize = 1) {
	const stride = 6
	const triangleVerticesPerVoxel =
		CUBE_FACES.length * FACE_TRIANGLE_ORDER.length
	const output = new Float32Array(
		voxels.length * triangleVerticesPerVoxel * stride,
	)
	let ptr = 0
	const scale = Math.max(0.2, voxelSize)
	const offset = (1 - scale) * 0.5

	for (let i = 0; i < voxels.length; i += 1) {
		const voxel = voxels[i]
		const [cr, cg, cb] = normalizeColor(voxel.color)
		for (let face = 0; face < CUBE_FACES.length; face += 1) {
			const corners = CUBE_FACES[face]
			for (let tri = 0; tri < FACE_TRIANGLE_ORDER.length; tri += 1) {
				const cornerIndex = FACE_TRIANGLE_ORDER[tri] * 3
				output[ptr++] = voxel.x + corners[cornerIndex + 0] * scale + offset
				output[ptr++] = voxel.y + corners[cornerIndex + 1] * scale + offset
				output[ptr++] = voxel.z + corners[cornerIndex + 2] * scale + offset
				output[ptr++] = cr
				output[ptr++] = cg
				output[ptr++] = cb
			}
		}
	}
	return output
}

export class Renderer {
	constructor(gl) {
		this.gl = gl
		this.program = null
		this.vao = null
		this.vbo = null
		this.vertexCount = 0
		this.triangleCount = 0
		this.drawCalls = 0
		this.viewProj = createMat4()
		this.view = createMat4()
		this.proj = createMat4()
		this.model = createMat4()
		this.uViewProj = null
	}

	init() {
		const gl = this.gl
		this.program = createProgram(gl, VERTEX_SOURCE, FRAGMENT_SOURCE)
		this.uViewProj = gl.getUniformLocation(this.program, 'u_view_proj')
		this.vao = gl.createVertexArray()
		this.vbo = gl.createBuffer()
		mat4Identity(this.model)

		gl.bindVertexArray(this.vao)
		gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo)
		gl.enableVertexAttribArray(0)
		gl.enableVertexAttribArray(1)
		gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0)
		gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12)
		gl.bindVertexArray(null)

		gl.enable(gl.DEPTH_TEST)
		gl.enable(gl.CULL_FACE)
		gl.cullFace(gl.BACK)
		gl.frontFace(gl.CCW)
		gl.clearColor(0.05, 0.08, 0.1, 1.0)
	}

	uploadVoxels(voxels, { voxelSize = 1 } = {}) {
		const gl = this.gl
		const meshStart = performance.now()
		const vertices = buildVoxelVertices(voxels, voxelSize)
		const meshGenerationMs = performance.now() - meshStart

		gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo)
		gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)
		gl.bindBuffer(gl.ARRAY_BUFFER, null)

		this.vertexCount = vertices.length / 6
		this.triangleCount = this.vertexCount / 3
		return {
			meshGenerationMs,
			vertexCount: this.vertexCount,
			triangleCount: this.triangleCount,
		}
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
		gl.bindVertexArray(this.vao)
		gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount)
		gl.bindVertexArray(null)
		this.drawCalls = this.vertexCount > 0 ? 1 : 0
	}
}
