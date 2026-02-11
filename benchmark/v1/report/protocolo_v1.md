# Protocolo de Benchmark v1 (M1)

Data-base do protocolo: 11/02/2026

## Configuracao padrao

- Cenarios: `small`, `medium`, `large`
- Seed fixa: `1337`
- Warmup: `10000 ms`
- Coleta: `60000 ms`
- Repeticoes: `3`
- Ordem da suite: `small -> medium -> large`

## Metadados obrigatorios por execucao

- `browser`
- `userAgent`
- `canvasWidth`, `canvasHeight`
- `dpr`
- `timestamp`
- `commitHash` (via `?commit=<hash>` ou `window.__APP_COMMIT__`)

## Saidas obrigatorias

- JSON bruto por execucao/suite
- CSV por execucao (linha por run)
- CSV agregado por cenario
- Graficos PNG em `benchmark/v1/plots`

## Como consolidar JSON em CSV

```bash
node scripts/benchmark/aggregate.js benchmark/v0/baseline_v0.json benchmark/v1/csv
```
