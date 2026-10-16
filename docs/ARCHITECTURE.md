# Arquitetura — Fase 1

Monorepo npm em JavaScript ESM. Frontend React + Vite separado da persistência por uma API REST Express. React Router organiza dashboard, projetos, detalhes, aulas e formulários. CSS de layout e de páginas fica separado do JavaScript. Schemas Zod e rótulos de status são compartilhados em `packages/shared`.

## Persistência

SQLite nativo de Node 22.13+, com UUIDs, chaves estrangeiras ativas, exclusão em cascata, unicidade de número por projeto e timestamps UTC ISO 8601. A interface apresenta datas em horário local. Migrations SQL são ordenadas pelo nome e registradas em `migrations`, cada uma em transação. Migrations aplicadas não devem ser alteradas; acrescente um novo arquivo numerado.

Conexão WAL com busy timeout. Operações síncronas são curtas e adequadas ao uso individual desta fase. Futuras tarefas de IA, documentos e testes devem usar workers e persistir estados; não devem executar dentro do ciclo de requisição HTTP.

## Contrato REST

| Método | Caminho | Operação |
|---|---|---|
| GET | /api/health | Saúde |
| GET | /api/dashboard | Contagens e cinco projetos recentemente atualizados |
| GET, POST | /api/projects | Listar, criar |
| GET, PUT, DELETE | /api/projects/:id | Consultar, substituir campos editáveis, excluir |
| GET, POST | /api/projects/:id/lessons | Listar aulas, criar aula |
| GET | /api/lessons | Listar todas com nome do projeto |
| GET, PUT, DELETE | /api/lessons/:id | Consultar, substituir campos editáveis, excluir |

Criação retorna 201; exclusão, 204; consultas e atualizações, 200. PUT recebe os campos editáveis; campos opcionais omitidos voltam aos padrões. IDs, vínculo de projeto e timestamps são controlados pelo servidor. Erros seguem `{error:{message,details?}}`; validação retorna 400, ausência 404 e número duplicado 409. JSON limitado a 100 KB. Consultas usam parâmetros; nomes de tabela e colunas são internos ou provenientes dos schemas estritos.

## Uso local

API e Vite escutam em 127.0.0.1. O proxy Vite evita necessidade de CORS. API restringe Host e Origin ao loopback para reduzir acesso por páginas externas. Não há autenticação, proteção para uso público ou serviços pagos. Não publicar essa configuração na internet.

Sem fontes, analytics ou recursos visuais externos. Segredos futuros devem ficar fora do banco de preferências e dos logs. Não há logs de corpos de requisição. `storage` e `.env` são ignorados pelo Git.

## Testes

Teste de integração HTTP com servidor real e SQLite temporário cobre CRUD, schemas, duplicidade, totais, origem externa, relacionamentos, migrations e persistência depois de reabrir o arquivo. Build Vite valida compilação do frontend. Validação visual no navegador é uma verificação separada.
