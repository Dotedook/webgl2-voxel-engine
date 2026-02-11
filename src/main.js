import { Engine } from './engine/Engine.js'
import {
	DEFAULT_CATHEDRAL_BIN3_URL,
	createScenarioLoader,
	DEFAULT_SMALL_VOX_URL,
	scenarioIds,
} from './scenarios/index.js'
import { BenchmarkRunner } from './benchmark/BenchmarkRunner.js'
import { loadVoxModel } from './vox/loader.js'
import { loadBin3PointCloud } from './bin3/loader.js'

function sanitizeSeed(rawValue, fallback = 1337) {
	const value = Number(rawValue)
	return Number.isFinite(value) ? value : fallback
}

function buildRunUrl({ scenarioId, seed, voxUrl, bin3Url, benchmark }) {
	const query = new URLSearchParams()
	if (benchmark) {
		query.set('benchmark', '1')
	}
	if (scenarioId) {
		query.set('scenario', scenarioId)
	}
	if (typeof seed === 'number' && Number.isFinite(seed)) {
		query.set('seed', String(seed))
	}
	if (voxUrl) {
		query.set('voxUrl', voxUrl)
	}
	if (bin3Url) {
		query.set('bin3Url', bin3Url)
	}
	return '?' + query.toString()
}

function openRun(args) {
	window.location.search = buildRunUrl(args)
}

function inputValueOr(input, fallback) {
	if (!input || typeof input.value !== 'string') {
		return fallback
	}
	const value = input.value.trim()
	return value || fallback
}

function inputSeedOr(input, fallback = 1337) {
	if (!input) {
		return fallback
	}
	return sanitizeSeed(input.value, fallback)
}

function setupStartScreen() {
	const startScreen = document.getElementById('start-screen')
	const canvas = document.getElementById('app-canvas')
	const hud = document.getElementById('hud')
	const benchmarkPanel = document.getElementById('benchmark-panel')
	if (!startScreen || !canvas || !hud || !benchmarkPanel) {
		throw new Error('Tela inicial incompleta no HTML')
	}
	startScreen.classList.add('enabled')
	canvas.style.display = 'none'
	hud.style.display = 'none'
	benchmarkPanel.classList.remove('enabled')

	const startVoxUrl = document.getElementById('start-vox-url')
	const startBin3Url = document.getElementById('start-bin3-url')
	const startMediumSeed = document.getElementById('start-medium-seed')
	const startLargeSeed = document.getElementById('start-large-seed')
	const startBenchmarkScenario = document.getElementById('start-benchmark-scenario')
	const startBenchmarkSeed = document.getElementById('start-benchmark-seed')

	document.getElementById('start-small-btn').addEventListener('click', () => {
		openRun({
			scenarioId: 'small',
			seed: 1337,
			voxUrl: inputValueOr(startVoxUrl, DEFAULT_SMALL_VOX_URL),
			bin3Url: inputValueOr(startBin3Url, DEFAULT_CATHEDRAL_BIN3_URL),
			benchmark: false,
		})
	})

	document.getElementById('start-medium-btn').addEventListener('click', () => {
		openRun({
			scenarioId: 'medium',
			seed: inputSeedOr(startMediumSeed, 1337),
			voxUrl: inputValueOr(startVoxUrl, DEFAULT_SMALL_VOX_URL),
			bin3Url: inputValueOr(startBin3Url, DEFAULT_CATHEDRAL_BIN3_URL),
			benchmark: false,
		})
	})

	document.getElementById('start-large-btn').addEventListener('click', () => {
		openRun({
			scenarioId: 'large',
			seed: inputSeedOr(startLargeSeed, 1337),
			voxUrl: inputValueOr(startVoxUrl, DEFAULT_SMALL_VOX_URL),
			bin3Url: inputValueOr(startBin3Url, DEFAULT_CATHEDRAL_BIN3_URL),
			benchmark: false,
		})
	})

	document.getElementById('start-benchmark-btn').addEventListener('click', () => {
		const scenarioId = inputValueOr(startBenchmarkScenario, 'medium')
		openRun({
			scenarioId,
			seed: inputSeedOr(startBenchmarkSeed, 1337),
			voxUrl: inputValueOr(startVoxUrl, DEFAULT_SMALL_VOX_URL),
			bin3Url: inputValueOr(startBin3Url, DEFAULT_CATHEDRAL_BIN3_URL),
			benchmark: true,
		})
	})
}

async function main() {
	const canvas = document.getElementById('app-canvas')
	const statusLine = document.getElementById('status-line')
	const params = new URLSearchParams(window.location.search)
	const hasLaunchRoute =
		params.get('benchmark') === '1' || params.has('scenario')
	if (!hasLaunchRoute) {
		setupStartScreen()
		return
	}

	const startScreen = document.getElementById('start-screen')
	startScreen.classList.remove('enabled')
	canvas.style.display = 'block'
	document.getElementById('hud').style.display = 'block'

	const benchmarkMode = params.get('benchmark') === '1'
	const scenarioId = params.get('scenario') || 'medium'
	const seed = Number(params.get('seed') || '1337')
	const voxUrl = params.get('voxUrl') || DEFAULT_SMALL_VOX_URL
	const bin3Url = params.get('bin3Url') || DEFAULT_CATHEDRAL_BIN3_URL

	const engine = new Engine({ canvas })
	engine.init()

	const scenarioLoader = createScenarioLoader({
		voxLoader: loadVoxModel,
		bin3Loader: loadBin3PointCloud,
	})

	const initialScenario = await scenarioLoader.loadScenario(scenarioId, {
		seed,
		voxUrl,
		bin3Url,
	})
	const loadMetrics = await engine.loadScenario(initialScenario)
	if (!benchmarkMode) {
		engine.setCameraScript(null)
	}
	engine.start()

	statusLine.textContent =
		'Cenário: ' +
		scenarioId +
		' | voxels: ' +
		loadMetrics.voxelCount +
		' | tris: ' +
		loadMetrics.triangleCount

	if (!benchmarkMode) {
		return
	}

	const panel = document.getElementById('benchmark-panel')
	panel.classList.add('enabled')

	const scenarioSelect = document.getElementById('scenario-select')
	const seedInput = document.getElementById('seed-input')
	const voxUrlInput = document.getElementById('vox-url-input')
	const bin3UrlInput = document.getElementById('bin3-url-input')
	scenarioSelect.value = scenarioIds.includes(scenarioId) ? scenarioId : 'medium'
	seedInput.value = String(seed)
	voxUrlInput.value = voxUrl
	if (bin3UrlInput) {
		bin3UrlInput.value = bin3Url
	}

	const runner = new BenchmarkRunner({
		engine,
		scenarioLoader,
		scenarioIds,
		liveElement: document.getElementById('benchmark-live'),
		outputElement: document.getElementById('benchmark-output'),
	})
	runner.mountControls({
		scenarioSelect,
		seedInput,
		warmupInput: document.getElementById('warmup-input'),
		collectInput: document.getElementById('collect-input'),
		repeatInput: document.getElementById('repeat-input'),
		voxUrlInput,
		bin3UrlInput,
		runOnceBtn: document.getElementById('run-once-btn'),
		runSuiteBtn: document.getElementById('run-suite-btn'),
		downloadBtn: document.getElementById('download-btn'),
	})

	if (params.get('autorun') === '1') {
		await runner.runSuite({
			scenarioId,
			seed,
			warmupMs: 10_000,
			collectMs: 60_000,
			repetitions: 3,
		})
	}
}

main().catch((error) => {
	console.error(error)
	const statusLine = document.getElementById('status-line')
	if (statusLine) {
		statusLine.textContent = 'Erro ao inicializar: ' + error.message
	}
})
