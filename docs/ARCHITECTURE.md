# Arquitetura — Fases 1 e 2A

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

Criação retorna 201; exclusão, 204; consultas e atualizações, 200. PUT recebe os campos editáveis; campos opcionais omitidos voltam aos padrões. IDs, vínculo de projeto e timestamps são controlados pelo servidor. Erros seguem `{error:{message,details?}}`; validação retorna 400, ausência 404 e conflitos 409. JSON limitado a 2 MB para os guias estruturados. Consultas usam parâmetros; nomes de tabela e colunas são internos ou provenientes dos schemas estritos.

## Uso local

API e Vite escutam em 127.0.0.1. O proxy Vite evita necessidade de CORS. API restringe Host e Origin ao loopback para reduzir acesso por páginas externas. Não há autenticação, proteção para uso público ou serviços pagos. Não publicar essa configuração na internet.

Sem fontes, analytics ou recursos visuais externos. Segredos futuros devem ficar fora do banco de preferências e dos logs. Não há logs de corpos de requisição. `storage` e `.env` são ignorados pelo Git.

## Testes

Teste de integração HTTP com servidor real e SQLite temporário cobre CRUD, schemas, duplicidade, totais, origem externa, relacionamentos, migrations e persistência depois de reabrir o arquivo. Build Vite valida compilação do frontend. Validação visual no navegador é uma verificação separada.

## Modelo pedagógico — migration 002

- `roadmap_versions`: projeto, número sequencial, dados pedagógicos JSON, estado e datas. Há um roteiro lógico por projeto, com múltiplas versões.
- `roadmap_items`: sequência de cada versão, número único por versão, título e detalhes JSON. A posição é independente do número. Dependências referenciam números anteriores na sequência e são validadas pelo Zod.
- `lesson_roadmap_links`: associação explícita entre item e aula existente. Uma aula pode ter um vínculo por versão; cada item recebe no máximo uma aula. A API valida o mesmo projeto. Os vínculos podem ser ajustados sem modificar o conteúdo versionado; duplicações de roteiro não os copiam automaticamente.
- `pedagogical_templates`: catálogo com nome, descrição e arquivamento reversível.
- `template_versions`: título, descrição e seções ordenadas em JSON, com IDs estáveis, instruções, opcionalidade e ativação. A migration inclui um modelo inicial aprovado de 17 seções; o conteúdo específico do modelo fica nos dados, sem regras por projeto nos serviços ou componentes.
- `lesson_versions`: guia manual vinculado à aula, versão de template e versão de roteiro. O conteúdo segue exatamente a ordem e os IDs das seções ativas da versão do template. Referências precisam ter sido aprovadas, incluindo versões já substituídas, e o roteiro deve pertencer ao projeto da aula. Cada guia guarda as referências exatas, mesmo quando uma nova versão é aprovada.

Todas as versões usam `draft`, `in_review`, `approved` e `superseded`. Só rascunhos aceitam edição. Revisão pode voltar a rascunho; aprovação exige revisão e confirmação explícita. Alterações em aprovados exigem duplicação para um novo rascunho. Templates e guias seguem o mesmo ciclo do roteiro.

Criação, duplicação, edição de sequência e aprovação usam transações `BEGIN IMMEDIATE`. A edição completa do roteiro grava planejamento e itens juntos, preservando IDs de itens existentes e seus vínculos. A aprovação compara `expected_approved_id` com a vigente; conflito devolve 409 e desfaz a operação. Índices parciais garantem uma única versão aprovada por projeto/template/aula. Ao aprovar outra, a vigente vira `superseded` na mesma transação.

Triggers bloqueiam alteração de dados aprovados e exclusão de qualquer versão, inclusive rascunhos. A única mudança permitida em um aprovado é sua substituição, mantendo conteúdo e referências. Itens de roteiros em revisão ou aprovados também são bloqueados. Chaves estrangeiras `RESTRICT` preservam histórico quando uma exclusão da Fase 1 tenta atingir projetos ou aulas com conteúdo pedagógico. Templates são arquivados em vez de apagados. Aulas e projetos sem essas referências continuam com o CRUD anterior.

O status pedagógico e o status de produção de `lessons` são independentes. A lista de aulas expõe `guide_status` da última versão do guia; aprovar roteiro ou guia não altera `lessons.status`.

## API pedagógica

A migration `003_default_template_sections.sql` acrescenta uma nova versão em rascunho ao template padrão, baseada no modelo original, com 22 seções. As cinco novas opções, ativas e opcionais, ficam entre Encerramento e Materiais de apoio: objetivos pedagógicos, pilares, avaliação informal, pensamento computacional e mensagem final. A versão recebe o próximo número disponível, sem substituir aprovações ou rascunhos personalizados. Guias existentes mantêm suas referências. O rascunho atualizado exige revisão e confirmação de aprovação antes de ser usado em novos guias.

Prefixo `/api`. Schemas em `packages/shared/src/pedagogy.js`; rotas e transações em `apps/api/src/pedagogy.js`.

| Método | Caminho | Operação |
|---|---|---|
| GET, POST | /projects/:id/roadmaps | Histórico e primeiro rascunho ou versão manual |
| GET, PUT | /roadmaps/:id | Consultar e editar metadados de rascunho |
| GET, PUT | /roadmaps/:id/items | Consultar e substituir sequência de rascunho |
| PUT | /roadmaps/:id/editor | Salvar `{metadata,items}` atomicamente |
| GET | /roadmaps/:id/links | Vínculos da versão |
| PUT, DELETE | /roadmap-items/:id/link | Vincular `{lesson_id}` ou desvincular |
| GET, POST | /templates | Catálogo e criação |
| GET, PUT, DELETE | /templates/:id | Consultar, editar catálogo, arquivar |
| POST | /templates/:id/restore | Restaurar catálogo |
| GET, POST | /templates/:id/versions | Histórico e nova versão de template |
| GET, PUT | /template-versions/:id | Consultar e editar rascunho |
| GET, POST | /lessons/:id/guides | Histórico e criação manual |
| GET, PUT | /guides/:id | Consultar e editar guia em rascunho |

Para cada recurso `/roadmaps/:id`, `/template-versions/:id` e `/guides/:id`:

- `POST /duplicate`: cópia para rascunho com próximo número, novo UUID e sem aprovação.
- `POST /transition`: `{status:"in_review"}` ou `{status:"draft"}`, respeitando o ciclo.
- `POST /approve`: `{confirm:true,expected_approved_id:null}` na primeira aprovação; em substituições, informe o UUID vigente recebido no histórico.

Não existem endpoints para apagar versões. A comparação é feita na interface entre duas versões persistidas, mostrando campos alterados e posição dos itens/seções.

## Verificações da Fase 2A

Testes HTTP/SQLite cobrem ciclo de estados, conflitos, imutabilidade, relações, vínculos, templates, guias e migração sobre banco da Fase 1. Testes Vitest/Testing Library usam DOM simulado e a API real com SQLite em memória para exercitar os formulários e sua persistência. Não substituem inspeção de layout e cliques em navegador real. Prettier mantém os arquivos de código legíveis e oferece `npm.cmd run format:check`.
