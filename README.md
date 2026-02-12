# Voxel Engine MVP (TCC II)

MVP inicial com:

- Engine WebGL2 com loop de render, camera e input.
- Renderizacao de voxels com meshing por faces expostas.
- Pipeline hibrido de mundo:
  - legado por `voxels` (malha unica),
  - chunkado por `chunks` com atualizacao incremental (`upsert/remove`).
- Frustum culling por AABB de chunk.
- Modulo de cenarios (`small`, `medium`, `large`) com seed fixa.
  - `small`: modelo `.vox` (personagem).
  - `medium` (cenario 2): terreno procedural com streaming incremental por chunks.
  - `large` (cenario 3): catedral a partir de `.bin3` (Sibenik).
- Modulo de benchmark separado com:
  - coletor proprio (frame delta, frame CPU, FPS, update, heap, chunks visiveis/culled),
  - painel de metricas ao vivo interno (sem dependencias externas),
  - progresso de benchmark (fase, tempo decorrido e tempo restante),
  - exportacao JSON e CSV.
- Loader `.vox` nativo (MagicaVoxel) com fallback para loader interno.
- Loader `.bin3` para nuvem de pontos voxelizada.

## Como rodar

Este projeto usa apenas arquivos estaticos (sem build).

```bash
python3 -m http.server 5173
```

Abra:

- Tela inicial (menu): `http://localhost:5173/`
- App normal (executar direto): `http://localhost:5173/?scenario=medium&seed=1337`
- Benchmark: `http://localhost:5173/?benchmark=1`
- Benchmark com autorun: `http://localhost:5173/?benchmark=1&autorun=1&scenario=medium&seed=1337`

Opcional para rastreabilidade de experimento:

- Commit hash no resultado: `http://localhost:5173/?benchmark=1&commit=<hash>`

## Loader .vox (hook)

Para usar sua lib interna, injete uma funcao global antes de `src/main.js`
(ela tem prioridade sobre o parser nativo):

```html
<script>
	window.__VOX_LOADER__ = async function loadVox(voxUrl) {
		// formato recomendado:
		// { voxels: [{ x, y, z, color: [r, g, b] }, ...] }
		//
		// formato legado suportado:
		// {
		//   "VOX ": 150,
		//   PACK: 1,
		//   SIZE: { x, y, z },
		//   XYZI: [{ x, y, z, c }, ...],
		//   RGBA: [{ r, g, b, a }, ...]
		// }
		return { voxels: [] }
	}
</script>
```

E rode:

`http://localhost:5173/?scenario=small&voxUrl=/assets/model.vox`

No painel de benchmark (`?benchmark=1`), o campo `VOX URL (small)` usa o mesmo fluxo.
Por padrao, o projeto tenta carregar `'/assets/chr_old.vox'` no cenario `small`.

## Cenário 3 (.bin3)

O cenario 3 usa por padrao:

- `'/assets/sibenik_sample.bin3'`

Formato esperado:

- 8 bytes iniciais: numero de pontos (`uint64`)
- cada ponto: 10 bytes (`x,y,z` como `uint16`, `r,g,b` como `uint8`, 1 byte padding)

No benchmark (`?benchmark=1`), o campo `BIN3 URL (large)` permite trocar o arquivo.

## API da engine para benchmark

- `engine.loadScenario(scenario)`
- `engine.start()`
- `engine.stop()`
- `engine.getFrameMetrics()`
- `engine.onFrame(listener)`

## Contrato de cenario (hibrido)

Formato legado (continua suportado):

- `scenario.voxels: Voxel[]`

Formato chunkado:

- `scenario.chunks: Array<{ id: string, voxels: Voxel[] }>`
- `scenario.updateWorld()` pode retornar:
  - `{ chunkUpdates: { upserts: Chunk[] } }`
  - ou `{ chunks: Chunk[] }` para substituicao completa
  - ou `{ voxels: Voxel[] }` (legado)

## Benchmark v1 (artefatos)

- Estrutura versionada:
  - `benchmark/v1/raw`
  - `benchmark/v1/csv`
  - `benchmark/v1/plots`
  - `benchmark/v1/report`
- Protocolo: `benchmark/v1/report/protocolo_v1.md`
- Consolidacao JSON -> CSV:

```bash
node scripts/benchmark/aggregate.js benchmark/v0/baseline_v0.json benchmark/v1/csv
```

## Planejamento TCC II

- Plano oficial: `docs/tcc/plano_desenvolvimento_tcc2_2026.md`

## Estrutura

- `index.html`
- `src/main.js`
- `src/engine/*`
- `src/scenarios/*`
- `src/benchmark/*`
- `scripts/benchmark/*`
- `benchmark/v1/*`
- `docs/tcc/*`
