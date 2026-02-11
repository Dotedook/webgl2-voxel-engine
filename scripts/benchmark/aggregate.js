#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

function asNumber(value) {
	const n = Number(value)
	return Number.isFinite(n) ? n : null
}

function csvEscape(value) {
	const raw = value == null ? '' : String(value)
	if (!/[",\n]/.test(raw)) {
		return raw
	}
	return '"' + raw.replaceAll('"', '""') + '"'
}

function rowsToCsv(rows) {
	if (rows.length === 0) {
		return ''
	}
	const header = Object.keys(rows[0])
	const out = [header.join(',')]
	for (const row of rows) {
		out.push(header.map((key) => csvEscape(row[key])).join(','))
	}
	return out.join('\n')
}

function extractSingles(results) {
	const singles = []
	for (const item of results) {
		if (!item || typeof item !== 'object') {
			continue
		}
		if (item.kind === 'single') {
			singles.push(item)
			continue
		}
		if (item.kind === 'suite' && Array.isArray(item.runs)) {
			for (const run of item.runs) {
				if (run && run.kind === 'single') {
					singles.push(run)
				}
			}
		}
	}
	const seen = new Set()
	const dedup = []
	for (const item of singles) {
		const key =
			String(item.createdAt) +
			'|' +
			String(item.options?.scenarioId ?? '') +
			'|' +
			String(item.options?.repetition ?? '') +
			'|' +
			String(item.options?.runNumber ?? '')
		if (seen.has(key)) {
			continue
		}
		seen.add(key)
		dedup.push(item)
	}
	return dedup
}

function runRows(singles) {
	return singles.map((item) => ({
		createdAt: item.createdAt,
		scenarioId: item.options?.scenarioId ?? '',
		repetition: item.options?.repetition ?? '',
		runNumber: item.options?.runNumber ?? '',
		totalRuns: item.options?.totalRuns ?? '',
		seed: item.options?.seed ?? '',
		warmupMs: item.options?.warmupMs ?? '',
		collectMs: item.options?.collectMs ?? '',
		fpsAvg: item.summary?.fpsAvg ?? '',
		fpsP50: item.summary?.fpsP50 ?? '',
		fpsP95: item.summary?.fpsP95 ?? '',
		frameMsAvg: item.summary?.frameMsAvg ?? '',
		frameMsP95: item.summary?.frameMsP95 ?? '',
		frameCpuMsAvg: item.summary?.frameCpuMsAvg ?? '',
		updateMsAvg: item.summary?.updateMsAvg ?? '',
		meshGenerationMsAvg: item.summary?.meshGenerationMsAvg ?? '',
		chunkCountAvg: item.summary?.chunkCountAvg ?? '',
		visibleChunksAvg: item.summary?.visibleChunksAvg ?? '',
		culledChunksAvg: item.summary?.culledChunksAvg ?? '',
		visibleTrianglesAvg: item.summary?.visibleTrianglesAvg ?? '',
		totalTriangleCountAvg: item.summary?.totalTriangleCountAvg ?? '',
		jsHeapAvgBytes: item.summary?.jsHeapAvgBytes ?? '',
		loadMeshGenerationMs: item.loadMetrics?.meshGenerationMs ?? '',
		loadTriangleCount: item.loadMetrics?.triangleCount ?? '',
		loadVoxelCount: item.loadMetrics?.voxelCount ?? '',
		loadChunkCount: item.loadMetrics?.chunkCount ?? '',
		browser: item.environment?.browser ?? '',
		userAgent: item.environment?.userAgent ?? '',
		dpr: item.environment?.dpr ?? '',
		canvasWidth: item.environment?.canvasWidth ?? '',
		canvasHeight: item.environment?.canvasHeight ?? '',
		commitHash: item.environment?.commitHash ?? '',
	}))
}

function aggregateByScenario(rows) {
	const numericFields = [
		'fpsAvg',
		'fpsP50',
		'fpsP95',
		'frameMsAvg',
		'frameMsP95',
		'frameCpuMsAvg',
		'updateMsAvg',
		'meshGenerationMsAvg',
		'chunkCountAvg',
		'visibleChunksAvg',
		'culledChunksAvg',
		'visibleTrianglesAvg',
		'totalTriangleCountAvg',
		'jsHeapAvgBytes',
		'loadMeshGenerationMs',
		'loadTriangleCount',
		'loadVoxelCount',
		'loadChunkCount',
	]
	const groups = new Map()
	for (const row of rows) {
		const id = row.scenarioId || 'unknown'
		if (!groups.has(id)) {
			groups.set(id, [])
		}
		groups.get(id).push(row)
	}
	const aggregated = []
	for (const [scenarioId, group] of groups.entries()) {
		const out = {
			scenarioId,
			runCount: group.length,
		}
		for (const field of numericFields) {
			let sum = 0
			let count = 0
			for (const row of group) {
				const value = asNumber(row[field])
				if (value == null) {
					continue
				}
				sum += value
				count += 1
			}
			out[field + 'Mean'] = count > 0 ? sum / count : ''
		}
		aggregated.push(out)
	}
	return aggregated.sort((a, b) => String(a.scenarioId).localeCompare(b.scenarioId))
}

function main() {
	const inputPath = process.argv[2]
	const outputDir = process.argv[3] || path.join('benchmark', 'v1', 'csv')
	if (!inputPath) {
		console.error(
			'Uso: node scripts/benchmark/aggregate.js <input.json> [output_dir]',
		)
		process.exit(1)
	}
	const jsonText = fs.readFileSync(inputPath, 'utf8')
	const parsed = JSON.parse(jsonText)
	const entries = Array.isArray(parsed) ? parsed : [parsed]
	const singles = extractSingles(entries)
	const rows = runRows(singles)
	const aggregate = aggregateByScenario(rows)

	fs.mkdirSync(outputDir, { recursive: true })
	const runsCsvPath = path.join(outputDir, 'benchmark_runs.csv')
	const aggregateCsvPath = path.join(outputDir, 'benchmark_aggregate_by_scenario.csv')
	fs.writeFileSync(runsCsvPath, rowsToCsv(rows) + '\n')
	fs.writeFileSync(aggregateCsvPath, rowsToCsv(aggregate) + '\n')

	console.log('Runs:', rows.length)
	console.log('CSV (runs):', runsCsvPath)
	console.log('CSV (aggregate):', aggregateCsvPath)
}

main()
