function sortNumbers(values) {
	return [...values].sort((a, b) => a - b)
}

function percentile(values, p) {
	if (values.length === 0) {
		return 0
	}
	const sorted = sortNumbers(values)
	const index = Math.min(
		sorted.length - 1,
		Math.floor((p / 100) * sorted.length),
	)
	return sorted[index]
}

function average(values) {
	if (values.length === 0) {
		return 0
	}
	return values.reduce((sum, n) => sum + n, 0) / values.length
}

export function summarizeFrameSamples(samples) {
	const frameDeltaMs = samples.map((s) => s.frameDeltaMs ?? s.frameMs)
	const frameCpuMs = samples.map((s) => s.frameCpuMs ?? s.frameMs)
	const updateMs = samples.map((s) => s.updateMs)
	const meshGenerationMs = samples.map((s) => s.meshGenerationMs || 0)
	const chunkMeshBuildCount = samples.map((s) => s.chunkMeshBuildCount || 0)
	const chunkMeshReuseCount = samples.map((s) => s.chunkMeshReuseCount || 0)
	const chunkMeshRemovedCount = samples.map((s) => s.chunkMeshRemovedCount || 0)
	const chunkCount = samples.map((s) => s.chunkCount || 0)
	const visibleChunks = samples.map((s) => s.visibleChunks || 0)
	const culledChunks = samples.map((s) => s.culledChunks || 0)
	const visibleTriangles = samples.map((s) => s.visibleTriangles || 0)
	const totalTriangleCount = samples.map((s) => s.totalTriangleCount || 0)
	const fps = frameDeltaMs.map((ms) => (ms > 0 ? 1000 / ms : 0))
	const heap = samples
		.map((s) => s.jsHeapBytes)
		.filter((v) => typeof v === 'number')

	return {
		sampleCount: samples.length,
		frameMsAvg: average(frameDeltaMs),
		frameMsP95: percentile(frameDeltaMs, 95),
		frameMsP99: percentile(frameDeltaMs, 99),
		frameCpuMsAvg: average(frameCpuMs),
		frameCpuMsP95: percentile(frameCpuMs, 95),
		fpsAvg: average(fps),
		fpsP50: percentile(fps, 50),
		fpsP95: percentile(fps, 95),
		updateMsAvg: average(updateMs),
		updateMsP95: percentile(updateMs, 95),
		meshGenerationMsAvg: average(meshGenerationMs),
		meshGenerationMsP95: percentile(meshGenerationMs, 95),
		chunkMeshBuildCountAvg: average(chunkMeshBuildCount),
		chunkMeshBuildCountP95: percentile(chunkMeshBuildCount, 95),
		chunkMeshReuseCountAvg: average(chunkMeshReuseCount),
		chunkMeshReuseCountP95: percentile(chunkMeshReuseCount, 95),
		chunkMeshRemovedCountAvg: average(chunkMeshRemovedCount),
		chunkMeshRemovedCountP95: percentile(chunkMeshRemovedCount, 95),
		chunkCountAvg: average(chunkCount),
		visibleChunksAvg: average(visibleChunks),
		culledChunksAvg: average(culledChunks),
		visibleTrianglesAvg: average(visibleTriangles),
		totalTriangleCountAvg: average(totalTriangleCount),
		jsHeapAvgBytes: heap.length ? average(heap) : null,
	}
}
