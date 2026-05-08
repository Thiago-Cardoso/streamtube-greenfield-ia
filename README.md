# StreamTube

Plataforma de compartilhamento de vídeos (YouTube-like) construída como projeto de MBA em IA Generativa — greenfield com assistência de IA.

Usuários podem fazer upload, gerenciar e publicar vídeos. Visitantes anônimos assistem livremente; funcionalidades sociais (comentários, inscrições, likes) exigem autenticação.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| API | NestJS 11, TypeScript, Express |
| Banco de dados | PostgreSQL 17 + TypeORM |
| Fila | TBD (BullMQ / RabbitMQ) |
| Armazenamento de objetos | MinIO (S3-compatible) |
| Worker de vídeo | FFmpeg |
| E-mail | Mailpit (dev) / SMTP (prod) |
| Frontend | Next.js (não iniciado) |

## Estrutura do repositório

```
streamtube-greenfield-ia/
├── nestjs-project/   # API backend (NestJS)
└── docs/             # Documentação, diagramas e planos de fase
```

## Pré-requisitos

- Docker e Docker Compose
- Node.js 22+ (apenas para tooling fora do container)

## Início rápido

```bash
# Clone o repositório
git clone https://github.com/Thiago-Cardoso/streamtube-greenfield-ia.git
cd streamtube-greenfield-ia/nestjs-project

# Copie as variáveis de ambiente
cp .env.example .env

# Suba os containers (infra + API)
docker compose up -d

# Verifique se a API está respondendo
curl http://localhost:3003
# → Hello World!
```

## Desenvolvimento

Todos os comandos de desenvolvimento rodam **dentro do container**:

```bash
# Dev server com hot-reload
docker compose exec nestjs-api npm run start:dev

# Testes unitários
docker compose exec nestjs-api npm test -- --runInBand

# Testes E2E
docker compose exec nestjs-api npm run test:e2e

# Migrations
docker compose exec nestjs-api npm run migration:run
docker compose exec nestjs-api npm run migration:generate -- src/database/migrations/NomeDaMigration

# Seed
docker compose exec nestjs-api npm run seed
```

## Documentação

- [`docs/project-plan.md`](docs/project-plan.md) — Visão geral e roadmap
- [`docs/diagrams/`](docs/diagrams/) — Diagramas de arquitetura (C4)
- [`docs/phases/`](docs/phases/) — Planos de implementação por fase

## Licença

MIT
