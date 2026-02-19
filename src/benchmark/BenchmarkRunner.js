import { summarizeFrameSamples } from './metrics.js'
import {
	DEFAULT_CATHEDRAL_BIN3_URL,
	DEFAULT_SMALL_VOX_URL,
} from '../scenarios/index.js'

function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

function timestamp() {
	return new Date().toISOString()
}

function formatDuration(ms) {
	const totalSeconds = Math.max(0, Math.floor(ms / 1000))
	const minutes = Math.floor(totalSeconds / 60)
	const seconds = totalSeconds % 60
	return String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0')
}

function numberOr(value, fallback) {
	const n = Number(value)
	return Number.isFinite(n) ? n : fallback
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
	const lines = [header.join(',')]
	for (const row of rows) {
		lines.push(header.map((column) => csvEscape(row[column])).join(','))
	}
	return lines.join('\n')
}

function browserLabel() {
	if (navigator.userAgentData && Array.isArray(navigator.userAgentData.brands)) {
		return navigator.userAgentData.brands
			.map((item) => item.brand + ' ' + item.version)
			.join(', ')
	}
	return navigator.appName || 'unknown'
}

function readCommitHash() {
	const params = new URLSearchParams(window.location.search)
	return (
		params.get('commit') ||
		window.__APP_COMMIT__ ||
		window.__COMMIT_HASH__ ||
		'unknown'
	)
}

export class BenchmarkRunner {
	constructor({
		engine,
		scenarioLoader,
		scenarioIds,
		liveElement = null,
		outputElement,
	}) {
		this.engine = engine
		this.scenarioLoader = scenarioLoader
		this.scenarioIds = scenarioIds
		this.liveElement = liveElement
		this.outputElement = outputElement
		this.collecting = false
		this.samples = []
		this.liveSamples = []
		this.maxLiveSamples = 120
		this.lastLiveRenderTs = 0
		this.results = []
		this.progress = {
			active: false,
			phase: 'idle',
			phaseStartTs: 0,
			phaseDurationMs: 0,
			runStartTs: 0,
			scenarioId: '-',
			repetition: 1,
			runNumber: 0,
			totalRuns: 0,
		}
		this.unsubscribe = this.engine.onFrame((frame) => {
			this.handleLiveFrame(frame)
			if (this.collecting) {
				this.samples.push(frame)
			}
		})
		this.renderLivePanel()
	}

	startProgress({
		scenarioId,
		repetition = 1,
		runNumber = 1,
		totalRuns = 1,
	}) {
		const now = performance.now()
		this.progress = {
			active: true,
			phase: 'preparando',
			phaseStartTs: now,
			phaseDurationMs: 0,
			runStartTs: now,
			scenarioId,
			repetition,
			runNumber,
			totalRuns,
		}
		this.renderLivePanel()
	}

	setProgressPhase(phase, durationMs = 0) {
		this.progress.phase = phase
		this.progress.phaseStartTs = performance.now()
		this.progress.phaseDurationMs = Math.max(0, durationMs)
		this.renderLivePanel()
	}

	finishProgress() {
		this.progress.active = false
		this.progress.phase = 'concluido'
		this.progress.phaseDurationMs = 0
		this.progress.phaseStartTs = performance.now()
		this.renderLivePanel()
	}

	renderProgressText() {
		const p = this.progress
		const now = performance.now()
		const runElapsedMs = p.runStartTs ? now - p.runStartTs : 0
		const phaseElapsedMs = p.phaseStartTs ? now - p.phaseStartTs : 0
		const phaseRemainingMs =
			p.phaseDurationMs > 0 ? Math.max(0, p.phaseDurationMs - phaseElapsedMs) : 0
		const runCounter =
			p.totalRuns > 0 ? String(p.runNumber) + '/' + String(p.totalRuns) : '-/-'
		let line =
			'Benchmark: ' +
			p.phase +
			' | execução ' +
			runCounter +
			' | cenário ' +
			p.scenarioId +
			' | repetição ' +
			p.repetition
		if (p.phaseDurationMs > 0) {
			line +=
				'\nfase: ' +
				formatDuration(phaseElapsedMs) +
				' / ' +
				formatDuration(p.phaseDurationMs) +
				' | restante: ' +
				formatDuration(phaseRemainingMs)
		}
		line += '\nexecução (decorrido): ' + formatDuration(runElapsedMs)
		return line
	}

	handleLiveFrame(frame) {
		if (!this.liveElement) {
			return
		}
		this.liveSamples.push(frame)
		if (this.liveSamples.length > this.maxLiveSamples) {
			this.liveSamples.shift()
		}
		const now = performance.now()
		if (now - this.lastLiveRenderTs < 250) {
			return
		}
		this.lastLiveRenderTs = now
		this.renderLivePanel()
	}

	renderLivePanel() {
		if (!this.liveElement) {
			return
		}
		const progressText = this.renderProgressText()
		if (this.liveSamples.length === 0) {
			this.liveElement.textContent =
				progressText + '\nMétricas ao vivo: aguardando frames...'
			return
		}
		const latest = this.liveSamples[this.liveSamples.length - 1]
		const summary = summarizeFrameSamples(this.liveSamples)
		const heapMb =
			typeof latest.jsHeapBytes === 'number'
				? (latest.jsHeapBytes / (1024 * 1024)).toFixed(2) + ' MB'
				: 'n/d'
		this.liveElement.textContent =
			progressText +
			'\nMétricas ao vivo (janela ~' +
			this.liveSamples.length +
			' frames)\n' +
			'FPS médio: ' +
			summary.fpsAvg.toFixed(1) +
			' | FPS p50: ' +
			summary.fpsP50.toFixed(1) +
			' | FPS p95: ' +
			summary.fpsP95.toFixed(1) +
			'\nframe ms (delta): ' +
			summary.frameMsAvg.toFixed(3) +
			' | frame cpu ms: ' +
			summary.frameCpuMsAvg.toFixed(3) +
			'\nupdate ms médio: ' +
			summary.updateMsAvg.toFixed(3) +
			' | mesh rebuild ms: ' +
			summary.meshGenerationMsAvg.toFixed(3) +
			' | chunk build/reuse/rm: ' +
			summary.chunkMeshBuildCountAvg.toFixed(2) +
			'/' +
			summary.chunkMeshReuseCountAvg.toFixed(2) +
			'/' +
			summary.chunkMeshRemovedCountAvg.toFixed(2) +
			'\nchunks visíveis: ' +
			latest.visibleChunks +
			'/' +
			latest.chunkCount +
			' | culled: ' +
			latest.culledChunks +
			' | tris visíveis: ' +
			latest.visibleTriangles +
			'\ndrawCalls: ' +
			latest.drawCalls +
			' | tris render: ' +
			latest.triangleCount +
			' | tris total: ' +
			latest.totalTriangleCount +
			'\nheap JS: ' +
			heapMb
	}

	mountControls(controls) {
		const {
			scenarioSelect,
			seedInput,
			warmupInput,
			collectInput,
			repeatInput,
			voxUrlInput,
			bin3UrlInput,
			runOnceBtn,
			runSuiteBtn,
			downloadBtn,
			downloadCsvBtn,
		} = controls

		runOnceBtn.addEventListener('click', async () => {
			const opts = this.readOptions({
				scenarioSelect,
				seedInput,
				warmupInput,
				collectInput,
				repeatInput,
				voxUrlInput,
				bin3UrlInput,
			})
			const result = await this.runSingle(opts)
			this.renderOutput(result)
		})

		runSuiteBtn.addEventListener('click', async () => {
			const opts = this.readOptions({
				scenarioSelect,
				seedInput,
				warmupInput,
				collectInput,
				repeatInput,
				voxUrlInput,
				bin3UrlInput,
			})
			const result = await this.runSuite(opts)
			this.renderOutput(result)
		})

		downloadBtn.addEventListener('click', () => this.downloadResultsJson())
		if (downloadCsvBtn) {
			downloadCsvBtn.addEventListener('click', () => this.downloadResultsCsv())
		}
	}

	readOptions({
		scenarioSelect,
		seedInput,
		warmupInput,
		collectInput,
		repeatInput,
		voxUrlInput,
		bin3UrlInput,
	}) {
		return {
			scenarioId: scenarioSelect.value,
			seed: numberOr(seedInput.value, 1337),
			warmupMs: numberOr(warmupInput.value, 10_000),
			collectMs: numberOr(collectInput.value, 60_000),
			repetitions: Math.max(1, Math.floor(numberOr(repeatInput.value, 3))),
			voxUrl:
				voxUrlInput && voxUrlInput.value
					? voxUrlInput.value.trim()
					: DEFAULT_SMALL_VOX_URL,
			bin3Url:
				bin3UrlInput && bin3UrlInput.value
					? bin3UrlInput.value.trim()
					: DEFAULT_CATHEDRAL_BIN3_URL,
		}
	}

	collectEnvironment() {
		const canvas = this.engine.canvas
		const gl = this.engine.gl
		const chunkFrustumCulling =
			typeof this.engine.isChunkFrustumCullingEnabled === 'function'
				? this.engine.isChunkFrustumCullingEnabled()
				: null
		return {
			timestamp: timestamp(),
			browser: browserLabel(),
			userAgent: navigator.userAgent || 'unknown',
			language: navigator.language || 'unknown',
			platform: navigator.platform || 'unknown',
			hardwareConcurrency: navigator.hardwareConcurrency || null,
			deviceMemoryGiB:
				typeof navigator.deviceMemory === 'number'
					? navigator.deviceMemory
					: null,
			dpr: window.devicePixelRatio || 1,
			canvasWidth: canvas ? canvas.width : null,
			canvasHeight: canvas ? canvas.height : null,
			canvasClientWidth: canvas ? canvas.clientWidth : null,
			canvasClientHeight: canvas ? canvas.clientHeight : null,
			glVersion: gl ? gl.getParameter(gl.VERSION) : 'unknown',
			chunkFrustumCulling,
			commitHash: readCommitHash(),
		}
	}

	async runSingle(options) {
		this.startProgress({
			scenarioId: options.scenarioId,
			repetition: options.repetition ?? 1,
			runNumber: options.runNumber ?? 1,
			totalRuns: options.totalRuns ?? 1,
		})
		this.log(
			'Rodando cenário ' +
				options.scenarioId +
				' | seed=' +
				options.seed +
				' | warmup=' +
				options.warmupMs +
				'ms | coleta=' +
				options.collectMs +
				'ms',
		)

		const environment = this.collectEnvironment()
		const protocol = {
			seed: options.seed,
			warmupMs: options.warmupMs,
			collectMs: options.collectMs,
			repetitions: options.repetitions,
			scenarioOrder: this.scenarioIds.join(','),
		}

		this.setProgressPhase('carregando cenário')
		const scenario = await this.scenarioLoader.loadScenario(
			options.scenarioId,
			{
				seed: options.seed,
				voxUrl: options.voxUrl || '',
				bin3Url: options.bin3Url || DEFAULT_CATHEDRAL_BIN3_URL,
			},
		)
		const loadMetrics = await this.engine.loadScenario(scenario)

		this.setProgressPhase('warmup', options.warmupMs)
		await delay(options.warmupMs)
		this.samples = []
		this.collecting = true
		this.setProgressPhase('coleta', options.collectMs)
		await delay(options.collectMs)
		this.collecting = false

		this.setProgressPhase('finalizando')
		const summary = summarizeFrameSamples(this.samples)
		const finalFrame = this.engine.getFrameMetrics()
		const result = {
			kind: 'single',
			createdAt: timestamp(),
			options,
			protocol,
			environment,
			loadMetrics,
			finalFrame,
			summary,
		}
		this.results.push(result)
		this.finishProgress()
		return result
	}

	async runSuite(options) {
		const uniqueScenarioList = this.scenarioIds
		const repetitions = Math.max(1, options.repetitions)
		const suiteResults = []
		const totalRuns = uniqueScenarioList.length * repetitions
		let runNumber = 0

		for (const scenarioId of uniqueScenarioList) {
			for (let repetition = 1; repetition <= repetitions; repetition += 1) {
				runNumber += 1
				const single = await this.runSingle({
					...options,
					scenarioId,
					repetition,
					runNumber,
					totalRuns,
				})
				suiteResults.push({
					scenarioId,
					repetition,
					...single,
				})
			}
		}

		const result = {
			kind: 'suite',
			createdAt: timestamp(),
			options,
			runs: suiteResults,
		}
		this.results.push(result)
		return result
	}

	renderOutput(data) {
		this.outputElement.textContent = JSON.stringify(data, null, 2)
	}

	log(message) {
		this.outputElement.textContent = `[${new Date().toLocaleTimeString()}] ${message}\n`
	}

	collectSingleResults() {
		const singles = []
		for (const result of this.results) {
			if (result.kind === 'single') {
				singles.push(result)
				continue
			}
			if (result.kind === 'suite' && Array.isArray(result.runs)) {
				for (const run of result.runs) {
					if (run.kind === 'single') {
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
				String(item.options?.scenarioId) +
				'|' +
				String(item.options?.repetition ?? 0) +
				'|' +
				String(item.options?.runNumber ?? 0)
			if (seen.has(key)) {
				continue
			}
			seen.add(key)
			dedup.push(item)
		}
		return dedup
	}

	buildCsvRows() {
		const singles = this.collectSingleResults()
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
			chunkMeshBuildCountAvg: item.summary?.chunkMeshBuildCountAvg ?? '',
			chunkMeshBuildCountP95: item.summary?.chunkMeshBuildCountP95 ?? '',
			chunkMeshReuseCountAvg: item.summary?.chunkMeshReuseCountAvg ?? '',
			chunkMeshReuseCountP95: item.summary?.chunkMeshReuseCountP95 ?? '',
			chunkMeshRemovedCountAvg: item.summary?.chunkMeshRemovedCountAvg ?? '',
			chunkMeshRemovedCountP95: item.summary?.chunkMeshRemovedCountP95 ?? '',
			chunkCountAvg: item.summary?.chunkCountAvg ?? '',
			visibleChunksAvg: item.summary?.visibleChunksAvg ?? '',
			culledChunksAvg: item.summary?.culledChunksAvg ?? '',
			visibleTrianglesAvg: item.summary?.visibleTrianglesAvg ?? '',
			totalTriangleCountAvg: item.summary?.totalTriangleCountAvg ?? '',
			jsHeapAvgBytes: item.summary?.jsHeapAvgBytes ?? '',
			loadMeshGenerationMs: item.loadMetrics?.meshGenerationMs ?? '',
			loadChunkMeshBuildCount: item.loadMetrics?.chunkMeshBuildCount ?? '',
			loadChunkMeshReuseCount: item.loadMetrics?.chunkMeshReuseCount ?? '',
			loadChunkMeshRemovedCount: item.loadMetrics?.chunkMeshRemovedCount ?? '',
			loadTriangleCount: item.loadMetrics?.triangleCount ?? '',
			loadVoxelCount: item.loadMetrics?.voxelCount ?? '',
			loadChunkCount: item.loadMetrics?.chunkCount ?? '',
			browser: item.environment?.browser ?? '',
			userAgent: item.environment?.userAgent ?? '',
			dpr: item.environment?.dpr ?? '',
			canvasWidth: item.environment?.canvasWidth ?? '',
			canvasHeight: item.environment?.canvasHeight ?? '',
			chunkFrustumCulling: item.environment?.chunkFrustumCulling ?? '',
			commitHash: item.environment?.commitHash ?? '',
		}))
	}

	downloadResultsJson() {
		const payload = JSON.stringify(this.results, null, 2)
		const blob = new Blob([payload], { type: 'application/json' })
		const url = URL.createObjectURL(blob)
		const anchor = document.createElement('a')
		anchor.href = url
		anchor.download = 'benchmark-results-' + Date.now() + '.json'
		anchor.click()
		URL.revokeObjectURL(url)
	}

	downloadResultsCsv() {
		const rows = this.buildCsvRows()
		const csv = rowsToCsv(rows)
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
		const url = URL.createObjectURL(blob)
		const anchor = document.createElement('a')
		anchor.href = url
		anchor.download = 'benchmark-results-' + Date.now() + '.csv'
		anchor.click()
		URL.revokeObjectURL(url)
	}
}
