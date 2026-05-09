# StreamTube

Plataforma de compartilhamento de vídeos (YouTube-like) construída como projeto de MBA em IA Generativa — greenfield desenvolvido inteiramente com assistência de IA usando **Claude Code**.

Usuários podem fazer upload, gerenciar e publicar vídeos. Visitantes anônimos assistem livremente; funcionalidades sociais (comentários, inscrições, likes) exigem autenticação.

---

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

---

## Estrutura do repositório

```
streamtube-greenfield-ia/
├── nestjs-project/        # API backend (NestJS)
├── docs/                  # Documentação, diagramas e planos de fase
│   ├── phases/            # Especificações detalhadas por fase
│   ├── decisions/         # Registros de decisões técnicas (ADRs)
│   └── diagrams/          # Diagramas de arquitetura (C4)
└── .claude/               # Infraestrutura de IA (skills, rules, memory)
    ├── skills/            # Agentes especializados por domínio
    ├── rules/             # Convenções de código aplicadas pelo agente
    └── memory/            # Memória persistente entre sessões
```

---

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

---

## Fluxo de desenvolvimento com IA

Este projeto explora o desenvolvimento greenfield guiado por IA generativa. O agente principal é o **Claude Code** (Sonnet 4.6), que atua como co-desenvolvedor em todas as fases — desde o planejamento de arquitetura até a implementação, testes e revisão de código.

O fluxo segue o modelo **RPI (Research → Plan → Implement)**: para cada funcionalidade, o agente primeiro pesquisa o contexto técnico (documentação oficial, convenções do projeto, estado do banco), depois planeja a abordagem com critérios de aceite explícitos e só então implementa — garantindo que as decisões sejam baseadas em informação atual e precisa, não apenas em conhecimento de treinamento.

### Skills — Agentes especializados

As **skills** são módulos de conhecimento especializado carregados sob demanda pelo agente. Cada skill é ativada automaticamente quando o agente detecta que o contexto da tarefa corresponde ao seu domínio (`TRIGGER when:` / `DO NOT TRIGGER when:`).

Cada skill funciona como um **sub-agente especializado**: quando ativada, injeta no contexto do agente principal um guia completo com regras, padrões de código, anti-padrões e exemplos para aquele domínio específico.

```
.claude/skills/
├── typeorm/                     # Padrões TypeORM: entidades, migrations, queries, transações
├── nestjs-best-practices/       # Arquitetura NestJS: DI, módulos, guards, pipes, interceptors
├── testing-guide-nestjs-project/# Pirâmide de testes: quais testes criar, em qual camada
├── plan-phase/                  # Planejamento de fases de implementação
├── implement-phase/             # Execução de fases com checklist de critérios de aceite
├── research/                    # Pesquisa técnica e avaliação de alternativas
└── generate-test-guide/         # Geração de guias de teste por tipo de artefato
```

**Exemplo de ativação automática:** ao implementar uma feature com banco de dados, o agente ativa simultaneamente as skills `typeorm`, `nestjs-best-practices` e `testing-guide-nestjs-project` — cada uma contribuindo com seu conhecimento especializado para a implementação.

### Rules — Convenções aplicadas automaticamente

As **rules** são carregadas automaticamente quando o agente edita arquivos que correspondem ao seu padrão (ex: `*.entity.ts`, `*.module.ts`, `*.controller.ts`). Funcionam como um linter de arquitetura aplicado em tempo real:

```
.claude/rules/
├── nestjs-common-conventions.md  # Nomenclatura, DI, async/await
├── nestjs-modules.md             # Estrutura de módulos, imports/exports
├── nestjs-services.md            # Tratamento de erros, separação de responsabilidades
├── nestjs-controllers.md         # REST conventions, status codes, DTOs
├── nestjs-entities.md            # Estrutura de entidades TypeORM
├── nestjs-layer-separation.md    # Separação controller/service/repository
├── nestjs-testing.md             # Sufixos de teste, setup de módulos, mocking
├── nestjs-dtos.md                # Validação, transformação, serialização
└── typeorm-migrations.md         # Imutabilidade e segurança de migrations
```

### MCP Context7 — Documentação oficial em tempo real

O **MCP Context7** é um servidor MCP (Model Context Protocol) que fornece ao agente acesso à documentação oficial atualizada das bibliotecas instaladas no projeto.

Antes de implementar qualquer feature que envolva uma biblioteca, o agente consulta o Context7 para obter a documentação da versão exata instalada (`@nestjs/typeorm@11.0.1`, `typeorm@0.3.29`, etc.), evitando o uso de APIs deprecadas ou padrões incompatíveis com a versão em uso.

```bash
# Configuração em nestjs-project/.claude/settings.json
# Requer a variável de ambiente CONTEXT7_API_KEY
```

**Exemplo de uso:** ao implementar `TypeOrmModule.forRootAsync()`, o agente consultou o Context7 para confirmar a API correta do NestJS 11 antes de escrever o código — garantindo compatibilidade com a versão instalada.

### MCP PostgreSQL — Acesso direto ao banco de dados

O **MCP PostgreSQL** permite que o agente execute queries SQL diretamente no banco de dados do ambiente de desenvolvimento, sem precisar de comandos intermediários.

Isso é usado para:
- Inspecionar o schema atual antes de criar migrations
- Verificar o estado das tabelas após execução de migrations
- Validar constraints e índices criados
- Diagnosticar problemas de conectividade

```bash
# Configuração em .mcp.json (gitignored — contém credenciais)
# Conexão: postgresql://streamtube:streamtube@localhost/streamtube
```

### Memory — Contexto persistente entre sessões

O sistema de **memória** persiste aprendizados entre sessões de trabalho. O agente salva automaticamente:

```
memory/
├── MEMORY.md                        # Índice de todas as memórias
├── feedback_conventional_commits.md # Commits seguem Conventional Commits
├── feedback_git_identity.md         # user.name e user.email para cada commit
└── feedback_pr_workflow.md          # Nunca mergear sem revisão do usuário
```

Isso garante que preferências e convenções aprendidas em uma sessão sejam respeitadas automaticamente em todas as sessões futuras — sem precisar repetir instruções.

### Fluxo RPI por feature

O ciclo completo para cada feature segue o padrão **RPI**:

```
1. RESEARCH   → Skill `research` ativada: Context7 consultado para
                documentação oficial, MCP PostgreSQL para estado do
                banco, skills de domínio carregadas, rules ativas
       ↓
2. PLAN       → Skill `plan-phase` ativada: arquitetura definida,
                critérios de aceite especificados, dependências
                mapeadas, abordagem validada antes de qualquer código
       ↓
3. IMPLEMENT  → Skill `implement-phase` ativada: código gerado
                seguindo as convenções das rules e os padrões
                das skills de domínio (typeorm, nestjs-best-practices,
                testing-guide-nestjs-project)
       ↓
4. VALIDATE   → tsc + lint + testes (unit + integration + e2e)
       ↓
5. COMMIT     → Conventional commits + PR para revisão humana
```

---

## Documentação

- [`docs/project-plan.md`](docs/project-plan.md) — Visão geral e roadmap
- [`docs/diagrams/`](docs/diagrams/) — Diagramas de arquitetura (C4)
- [`docs/phases/`](docs/phases/) — Planos de implementação por fase
- [`docs/decisions/`](docs/decisions/) — Registros de decisões técnicas

---

## Licença

MIT
