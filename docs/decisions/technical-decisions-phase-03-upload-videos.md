# Technical Decisions — Phase 03: Upload e Processamento de Vídeos

> **Phase:** Fase 03 — Upload e Processamento de Vídeos
> **Status:** Decided
> **Date:** 2026-05-10

---

## TD-01: Estratégia de upload de arquivos grandes (até 10GB)

**Context:** A fase exige suporte a arquivos de até 10GB sem impacto na performance. Um `PUT` único via NestJS coloca o binário inteiro no processo da API. Um presigned URL simples tem limite de 5GB no protocolo S3. Tus é um protocolo padronizado de upload resumável.

**Options:**

### Option A: Multipart presigned URL (MinIO SDK)
- O backend inicia o multipart upload no MinIO e devolve ao cliente uma lista de presigned URLs — uma por parte (ex: 100MB cada). O cliente faz upload de cada parte diretamente para o MinIO e ao final notifica o backend para completar o multipart.
- **Pros:** nenhum binário trafega pelo NestJS (zero carga de memória); suporta arquivos de qualquer tamanho; sem dependências extras além do SDK já necessário para o MinIO; compatível com qualquer cliente HTTP.
- **Cons:** o frontend precisa orquestrar as partes (dividir o arquivo, fazer upload sequencial ou paralelo, montar a lista de ETags). Sem suporte nativo a retomada de upload interrompido — se o upload falhar a meio, o usuário precisa recomeçar.

### Option B: Tus protocol (`@tus/server` + MinIO store)
- O protocolo tus define um fluxo padronizado de upload resumável via HTTP PATCH. O backend instala `@tus/server` e configura um store para MinIO. O frontend usa `tus-js-client`. Uploads interrompidos são retomados automaticamente.
- **Pros:** retomada nativa em caso de falha de conexão; protocolo padronizado (RFC em progresso no IETF); bibliotecas cliente para web, mobile e desktop; upload não passa pelo processo NestJS (o store lida com o stream).
- **Cons:** adiciona `@tus/server` como dependência; o servidor tus precisa ser montado no NestJS como middleware raw (fora do ciclo padrão de controllers); a integração com MinIO usa `@tus/s3-store` que depende do AWS SDK v3 (nova dependência).

### Option C: Streaming direto pelo NestJS para MinIO
- O NestJS recebe o arquivo via `multipart/form-data` (usando `busboy` ou Multer com `memoryStorage`) e faz pipe para o MinIO usando `putObject`. Simples de implementar.
- **Pros:** implementação mais simples; sem libs extras além do MinIO SDK.
- **Cons:** todo o binário (até 10GB) trafega pelo processo NestJS — alto consumo de memória e CPU no servidor API; inviável para produção com múltiplos uploads simultâneos; sem suporte a retomada.

**Recommendation:** Option A (Multipart presigned URL) — evita carga no API server sem adicionar a complexidade do protocolo tus. Para o escopo desta fase (MVP), a falta de retomada é aceitável: a UI pode mostrar o progresso e pedir ao usuário para reenviar em caso de falha. Se retomada for prioridade, escolher B.

**Decision:** **C (Streaming direto pelo NestJS para MinIO)** — para o ambiente local de desenvolvimento o limite de 10GB é impraticável de testar; a simplificação é aceitável neste momento. O upload passa pelo NestJS que faz pipe para o MinIO via minio-js.

> **Nota:** com TD-06 = minio-js, o upload usa `putObject` em stream — sem presigned URL, sem AWS SDK.

---

## TD-02: Tecnologia de fila de mensagens

**Context:** O processamento do vídeo (FFmpeg) é pesado e deve ocorrer em background. O project-plan define "Message Queue (TBD)". A escolha impacta o docker-compose (novo serviço), as dependências NestJS e a arquitetura do worker.

**Options:**

### Option A: BullMQ + Redis
- BullMQ é uma biblioteca Node.js de filas de jobs construída sobre Redis. O NestJS tem suporte oficial via `@nestjs/bullmq`. Workers são processos Node.js que consomem jobs da fila Redis.
- **Pros:** integração nativa com NestJS (`@nestjs/bullmq`); Redis é leve e fácil de adicionar ao docker-compose; suporte a retry automático, delayed jobs, prioridades e rate limiting; amplamente usado para processamento de mídia em Node.js.
- **Cons:** adiciona Redis como nova dependência de infraestrutura; BullMQ requer Redis — não funciona com outro broker.

### Option B: RabbitMQ (AMQP)
- RabbitMQ é um message broker AMQP, independente de linguagem. O NestJS suporta via `@nestjs/microservices` com o transportador AMQP.
- **Pros:** robusto e battle-tested; agnóstico de linguagem (útil se o worker não for Node.js); routing avançado com exchanges.
- **Cons:** mais complexo de configurar e operar; menor integração nativa com o ecossistema NestJS/Node.js; overhead maior para um caso de uso de job queue simples.

**Recommendation:** Option A (BullMQ + Redis) — o stack é inteiramente Node.js/NestJS, o suporte oficial `@nestjs/bullmq` reduz boilerplate, e Redis é uma dependência leve. RabbitMQ agrega valor quando há workers em múltiplas linguagens — não é o caso aqui.

**Decision:** **A (BullMQ + Redis)**

---

## TD-03: Localização do worker de processamento de vídeo

**Context:** O processamento FFmpeg (extração de metadados, geração de thumbnail) é CPU-intensivo. O project-plan descreve um "Video Worker (FFmpeg)" como container separado. Esta decisão confirma ou altera essa separação e define como o worker é estruturado.

**Options:**

### Option A: Container separado (worker dedicado)
- Um segundo container Node.js executa o worker BullMQ/RabbitMQ. Consome jobs da fila, baixa o vídeo do MinIO, processa com FFmpeg, salva resultados de volta no MinIO e atualiza o banco via TypeORM direto ou via API.
- **Pros:** isola carga de CPU — o API server não é afetado por transcodings simultâneos; escala independente (pode ter múltiplas réplicas do worker); alinhado com a arquitetura definida no project-plan.
- **Cons:** adiciona um container ao docker-compose; compartilha acesso ao banco de dados com a API (precisa de cuidado com migrações e tipos); mais setup inicial.

### Option B: Processamento no próprio NestJS (consumer inline)
- Um módulo NestJS registra um consumer BullMQ que processa jobs no mesmo processo da API. Sem container extra.
- **Pros:** mais simples de implementar na fase 3; sem container adicional no docker-compose.
- **Cons:** processamento FFmpeg compete com requests HTTP pelo event loop e memória; não escala independentemente; contradiz a arquitetura do project-plan.

**Recommendation:** Option A (container separado) — alinhado com o project-plan e necessário para não degradar a API durante processamento de vídeos grandes. O custo de setup adicional (um container a mais no compose) é baixo comparado ao ganho de isolamento.

**Decision:** **A (Container separado)**

---

## TD-04: Abordagem de streaming de vídeo

**Context:** A fase exige que o vídeo comece a ser reproduzido sem download completo. Há duas abordagens principais: servir o arquivo via range requests ou segmentar o vídeo em HLS. Ambas são compatíveis com MinIO.

**Options:**

### Option A: HTTP Range Requests (streaming progressivo)
- O NestJS (ou o MinIO diretamente via presigned URL) serve o arquivo de vídeo com suporte ao header `Range`. O player faz requests parciais conforme navega no vídeo. Browsers e todos os players modernos suportam natively.
- **Pros:** zero processamento adicional (o vídeo não precisa ser recodificado); MinIO suporta range requests nativamente via `getObject` com parâmetro de offset; implementação simples no NestJS (206 Partial Content); funciona com qualquer formato de vídeo.
- **Cons:** sem adaptação de qualidade (o usuário sempre recebe a qualidade original); seeking em redes lentas pode ser lento se o container do vídeo não tiver moov atom no início (resolvido com `faststart` no ffmpeg durante o processamento).

### Option B: HLS (HTTP Live Streaming)
- O worker FFmpeg segmenta o vídeo em chunks `.ts` de 6-10 segundos e gera um manifesto `.m3u8`. O player (como `hls.js`) consome o manifesto e carrega segmentos sob demanda.
- **Pros:** streaming adaptativo por qualidade (múltiplos bitrates); latência menor em redes lentas; suporte nativo em Safari/iOS.
- **Cons:** requer que o FFmpeg gere múltiplos renditions (mais tempo de processamento e mais espaço em storage); implementação mais complexa; para um MVP sem múltiplas qualidades, o ganho é marginal.

**Recommendation:** Option A (HTTP Range Requests) — para o escopo desta fase, o arquivo já está no MinIO e range requests são suficientes para streaming funcional. O worker pode aplicar `faststart` para otimizar seeking. HLS agrega valor quando múltiplas qualidades forem um requisito — o que não está no escopo da fase 3.

**Decision:** **A (HTTP Range Requests)**

---

## TD-05: Geração de URL única por vídeo (slug)

**Context:** Cada vídeo precisa de uma URL curta e única (ex: `/watch/V1StGXR8_Z5`). A escolha afeta o comprimento da URL, a necessidade de dependências extras e a probabilidade de colisão.

**Options:**

### Option A: nanoid (11 caracteres, URL-safe)
- Gera IDs curtos usando o alfabeto URL-safe (`A-Za-z0-9_-`). Com 11 caracteres e 64 símbolos, gera ~70 bits de entropia — probabilidade de colisão de 1 em 1 bilhão com até 2 milhões de vídeos.
- **Pros:** URLs curtas e legíveis (estilo YouTube); criptograficamente seguro (usa `crypto`); pacote minúsculo (118 bytes); ESM nativo.
- **Cons:** nova dependência (pequena); tamanho menor que UUID significa entropia menor (suficiente para o escopo do projeto).

### Option B: UUID v4
- Gera IDs de 36 caracteres (ex: `550e8400-e29b-41d4-a716-446655440000`). Disponível nativamente via `crypto.randomUUID()` no Node.js 16+ — sem dependência extra.
- **Pros:** sem dependência extra; 122 bits de entropia (virtualmente sem colisão); amplamente reconhecido.
- **Cons:** URLs longas e feias; os hífens ocupam espaço sem adicionar entropia útil.

### Option C: CUID2
- IDs curtos e monotonicamente crescentes, projetados para uso em banco de dados. Comprimento configurável.
- **Pros:** ordenável cronologicamente; baixa colisão.
- **Cons:** mais desconhecido; dependência adicional; a ordenabilidade não é um requisito para slugs de vídeo.

**Recommendation:** Option A (nanoid, 11 chars) — equilibra URLs curtas (UX) com segurança suficiente para o volume esperado de vídeos na plataforma. A dependência é mínima. UUID v4 é aceitável se preferir zero dependências extras.

**Decision:** **A (nanoid, 11 chars)**

---

## TD-06: SDK para integração com MinIO

**Context:** MinIO ainda não está no docker-compose nem no código. Precisa-se de um SDK Node.js para gerar presigned URLs, fazer upload de objetos e baixar objetos para processamento. Duas opções são compatíveis com MinIO (S3-compatible).

**Options:**

### Option A: minio-js (SDK oficial MinIO)
- SDK oficial do MinIO para Node.js. API específica para MinIO com métodos como `presignedPutObject`, `presignedGetObject`, `fPutObject`, `getObject`.
- **Pros:** API direta para MinIO; suporte a presigned URLs para GET e PUT; documentação oficial do MinIO.
- **Cons:** API própria (não padrão S3); multipart presigned requer uso de métodos de baixo nível (menos documentado para casos avançados); migrar para S3 real no futuro exigiria mudar o SDK.

### Option B: AWS SDK v3 (`@aws-sdk/client-s3`)
- O AWS SDK v3 funciona com qualquer storage S3-compatible, incluindo MinIO, configurando o endpoint. Usa `S3Client` com `GetObjectCommand`, `PutObjectCommand`, `CreateMultipartUploadCommand`, etc.
- **Pros:** API S3 padrão — migrar de MinIO para S3 real é só mudar variáveis de ambiente; melhor suporte a multipart upload com presigned URLs; TypeScript types bem definidos; mais documentação e exemplos disponíveis.
- **Cons:** dependência maior (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`); pode parecer "overengineered" para um setup local com MinIO.

**Recommendation:** Option B (AWS SDK v3) — a API S3 é o padrão de mercado e qualquer desenvolvedor conhece. Migrar para S3 real em produção é trivial (só variáveis de ambiente). O suporte nativo a multipart presigned URLs é mais robusto que o minio-js para o caso TD-01 opção A.

**Decision:** **A (minio-js)** — sem AWS neste momento; minio-js é suficiente para o ambiente local com MinIO no Docker.

---

## Decisions Summary

| ID | Decision | Recommendation | Choice |
|----|----------|---------------|--------|
| TD-01 | Estratégia de upload (ambiente local) | A (Multipart presigned URL) | **C (NestJS streaming → MinIO via minio-js)** |
| TD-02 | Tecnologia de fila de mensagens | A (BullMQ + Redis) | **A (BullMQ + Redis)** |
| TD-03 | Localização do worker FFmpeg | A (Container separado) | **A (Container separado)** |
| TD-04 | Abordagem de streaming de vídeo | A (HTTP Range Requests) | **A (HTTP Range Requests)** |
| TD-05 | Geração de URL única por vídeo | A (nanoid 11 chars) | **A (nanoid 11 chars)** |
| TD-06 | SDK de integração com MinIO | B (AWS SDK v3) | **A (minio-js — sem AWS)** |
