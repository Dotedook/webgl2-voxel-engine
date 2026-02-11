# Plano de Desenvolvimento TCC II (11/02/2026 a 01/06/2026)

## Resumo

Objetivo deste ciclo: entregar a versao final ate **01/06/2026**, com pre-entrega para orientador em **01/05/2026**, evoluindo a base atual para um pipeline de `chunks + culling + meshing` e produzindo evidencias experimentais reproduziveis em `JSON + CSV + graficos`.

Critetrios principais:

- foco em FPS medio como metrica-guia;
- guardrail de `fpsP50 >= 60`;
- comparacao por cenario (`small`, `medium`, `large`);
- ambiente-alvo: notebook pessoal;
- checkpoints semanais;
- escrita mensal.

## Escopo fechado

### Incluir

- otimizacoes de renderizacao e organizacao espacial via chunks/culling/meshing;
- instrumentacao de benchmark;
- pacote de resultados para monografia.

### Nao incluir

- edicao interativa de blocos;
- SVO completo;
- pipeline de ray casting/ray tracing;
- migracao de stack.

### Stack

- manter sem build (`HTML + ES modules`).

## Marcos (datas absolutas)

1. **M1 - 01/03/2026**: baseline experimental v1 consolidado (metadados + export CSV + protocolo de execucao documentado).
2. **M2 - 01/04/2026**: meshing por faces visiveis + cache por chunk integrado.
3. **M3 - 01/05/2026 (pre-orientador)**: frustum culling por chunk + streaming refinado + resultados parciais e capitulo parcial.
4. **M4 - 01/06/2026 (final)**: pacote final tecnico e academico fechado (codigo estavel + resultados finais + graficos + texto final).

## Plano de implementacao

### Fase 1 (11/02 a 01/03): Base experimental confiavel

1. Padronizar protocolo de benchmark com `warmup=10000`, `collect=60000`, `repetitions=3`, `seed=1337`.
2. Incluir metadados obrigatorios: browser, user agent, resolucao do canvas, DPR, timestamp, commit hash.
3. Adicionar exportacao CSV alem de JSON.
4. Organizar artefatos: `benchmark/v1/raw`, `benchmark/v1/csv`, `benchmark/v1/plots`, `benchmark/v1/report`.
5. Criar script de consolidacao JSON -> CSV agregado por cenario.
6. Entregar relatorio mensal 1 em `docs/tcc`.

### Fase 2 (02/03 a 01/04): Meshing eficiente em chunks

1. Trocar geracao ingenua (6 faces por voxel) por geracao de faces expostas.
2. Introduzir malha por chunk com cache e `dirty flag`, evitando rebuild global.
3. Adaptar cenario para mundo chunkado mantendo compatibilidade com `scenario.voxels`.
4. Medir custo de mesh build por chunk e total por frame.
5. Validar ganho em `triangleCount`, `meshGenerationMs` e `frameCpuMs`.
6. Entregar relatorio mensal 2 com comparacao por cenario M1 vs M2.

### Fase 3 (02/04 a 01/05): Culling + streaming (pre-orientador)

1. Implementar frustum culling por AABB de chunk antes do draw.
2. Refinar janela ativa de chunks no `medium` para reduzir memoria e rebuild.
3. Adicionar metricas de visibilidade: `visibleChunks`, `culledChunks`, `visibleTriangles`.
4. Fechar pre-entrega com codigo estavel, resultados parciais e capitulo parcial.
5. Checkpoint com orientador para validar cobertura de cenarios/metricas.

### Fase 4 (02/05 a 01/06): Consolidacao final

1. Rodada final de benchmark por cenario no ambiente-alvo com protocolo fixo.
2. Gerar pacote final de artefatos (`JSON`, `CSV`, graficos PNG).
3. Congelar versao final e registrar limitacoes/remanescentes.
4. Finalizar texto do TCC II (metodologia, resultados, discussao, ameacas a validade).
5. Entrega final em 01/06/2026.

## Mudancas planejadas de interfaces

1. **Cenarios**: manter `scenario.voxels` (legado) e aceitar `scenario.chunks` com deltas em `updateWorld`.
2. **Engine**: `loadScenario` aceitar mundo chunkado; `getFrameMetrics` incluir visibilidade/chunks.
3. **Renderer**: upload/render por chunk com `upsert/remove`, mantendo fallback legado.
4. **Benchmark**: output com bloco `environment` e campos de visibilidade para analise.

## Casos de teste e validacao

1. Regressao funcional: `small`, `medium`, `large` carregam e renderizam sem erro.
2. Regressao visual: screenshots por cenario para verificar faces/buracos.
3. Regressao de performance: 3 repeticoes por cenario com protocolo fixo.
4. Consistencia de dados: JSON e CSV com mesmo total de runs e metricas-chave.
5. Criterio de aceite final:
   - `fpsP50 >= 60` nos 3 cenarios;
   - sem quebra funcional;
   - artefatos completos para capitulo de resultados.

## Cadencia de acompanhamento

### Semanal

1. Rodar suite e atualizar tabela por cenario.
2. Registrar decisao tecnica e risco aberto.
3. Revisar backlog de risco e ajustar escopo sem mover marcos finais.

### Mensal

1. Consolidar escrita mensal com resultados do ciclo.

## Premissas explicitas

- Inicio considerado: **11/02/2026**.
- Pre-entrega: **01/05/2026**.
- Final: **01/06/2026**.
- Comparacao principal por cenario.
- Em caso de teto de VSync, usar tambem `frameCpuMs` e `meshGenerationMs`.
- Sem normalizacao multi-dispositivo neste ciclo.
