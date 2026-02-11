export function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value))
}

export function createVec3(x = 0, y = 0, z = 0) {
	return new Float32Array([x, y, z])
}

export function normalize(out, v) {
	const len = Math.hypot(v[0], v[1], v[2]) || 1
	out[0] = v[0] / len
	out[1] = v[1] / len
	out[2] = v[2] / len
	return out
}

export function cross(out, a, b) {
	const ax = a[0]
	const ay = a[1]
	const az = a[2]
	const bx = b[0]
	const by = b[1]
	const bz = b[2]
	out[0] = ay * bz - az * by
	out[1] = az * bx - ax * bz
	out[2] = ax * by - ay * bx
	return out
}

export function addScaled(out, a, b, scale) {
	out[0] = a[0] + b[0] * scale
	out[1] = a[1] + b[1] * scale
	out[2] = a[2] + b[2] * scale
	return out
}

export function createMat4() {
	return new Float32Array(16)
}

export function mat4Identity(out) {
	out.fill(0)
	out[0] = 1
	out[5] = 1
	out[10] = 1
	out[15] = 1
	return out
}

export function mat4Perspective(out, fovy, aspect, near, far) {
	const f = 1 / Math.tan(fovy / 2)
	const nf = 1 / (near - far)

	out.fill(0)
	out[0] = f / aspect
	out[5] = f
	out[10] = (far + near) * nf
	out[11] = -1
	out[14] = 2 * far * near * nf
	return out
}

export function mat4LookAt(out, eye, center, up) {
	const z = createVec3()
	z[0] = eye[0] - center[0]
	z[1] = eye[1] - center[1]
	z[2] = eye[2] - center[2]
	normalize(z, z)

	const x = createVec3()
	cross(x, up, z)
	normalize(x, x)

	const y = createVec3()
	cross(y, z, x)

	out[0] = x[0]
	out[1] = y[0]
	out[2] = z[0]
	out[3] = 0
	out[4] = x[1]
	out[5] = y[1]
	out[6] = z[1]
	out[7] = 0
	out[8] = x[2]
	out[9] = y[2]
	out[10] = z[2]
	out[11] = 0
	out[12] = -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2])
	out[13] = -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2])
	out[14] = -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2])
	out[15] = 1
	return out
}

export function mat4Multiply(out, a, b) {
	const a00 = a[0]
	const a01 = a[1]
	const a02 = a[2]
	const a03 = a[3]
	const a10 = a[4]
	const a11 = a[5]
	const a12 = a[6]
	const a13 = a[7]
	const a20 = a[8]
	const a21 = a[9]
	const a22 = a[10]
	const a23 = a[11]
	const a30 = a[12]
	const a31 = a[13]
	const a32 = a[14]
	const a33 = a[15]

	const b00 = b[0]
	const b01 = b[1]
	const b02 = b[2]
	const b03 = b[3]
	const b10 = b[4]
	const b11 = b[5]
	const b12 = b[6]
	const b13 = b[7]
	const b20 = b[8]
	const b21 = b[9]
	const b22 = b[10]
	const b23 = b[11]
	const b30 = b[12]
	const b31 = b[13]
	const b32 = b[14]
	const b33 = b[15]

	out[0] = a00 * b00 + a10 * b01 + a20 * b02 + a30 * b03
	out[1] = a01 * b00 + a11 * b01 + a21 * b02 + a31 * b03
	out[2] = a02 * b00 + a12 * b01 + a22 * b02 + a32 * b03
	out[3] = a03 * b00 + a13 * b01 + a23 * b02 + a33 * b03
	out[4] = a00 * b10 + a10 * b11 + a20 * b12 + a30 * b13
	out[5] = a01 * b10 + a11 * b11 + a21 * b12 + a31 * b13
	out[6] = a02 * b10 + a12 * b11 + a22 * b12 + a32 * b13
	out[7] = a03 * b10 + a13 * b11 + a23 * b12 + a33 * b13
	out[8] = a00 * b20 + a10 * b21 + a20 * b22 + a30 * b23
	out[9] = a01 * b20 + a11 * b21 + a21 * b22 + a31 * b23
	out[10] = a02 * b20 + a12 * b21 + a22 * b22 + a32 * b23
	out[11] = a03 * b20 + a13 * b21 + a23 * b22 + a33 * b23
	out[12] = a00 * b30 + a10 * b31 + a20 * b32 + a30 * b33
	out[13] = a01 * b30 + a11 * b31 + a21 * b32 + a31 * b33
	out[14] = a02 * b30 + a12 * b31 + a22 * b32 + a32 * b33
	out[15] = a03 * b30 + a13 * b31 + a23 * b32 + a33 * b33
	return out
}
