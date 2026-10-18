# Arquitetura — Fases 1, 2A e 2B

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

## Geração com IA — Fase 2B

A migration `004_ai_generation.sql` acrescenta `ai_settings`, `ai_jobs`, `ai_attempts`, `ai_usage` e `ai_worker_lock`. As migrations 001–003 permanecem intactas. Preferências e preços são JSON validado, sem segredos. Cada job fotografa os parâmetros, contexto pedagógico, preços, data dos preços e câmbio; o histórico não muda quando a configuração é editada.

`ai/providers.js` adapta OpenAI Responses e Gemini via AI SDK e provedores diretos, com `generateText`, `Output.object`, timeout/cancelamento e `maxRetries:0`. Nenhum modelo é fixado como opção única. A seleção precisa constar na configuração e no catálogo acessível da API; o suporte aos parâmetros/saída estruturada é validado na chamada. Modelos devem ser cadastrados conforme documentação vigente do provedor. Erros são normalizados sem persistir corpos, cabeçalhos ou mensagens brutas que possam conter chaves. Credenciais são lidas de `OPENAI_API_KEY` e `GEMINI_API_KEY`; não há endpoint para ler ou armazenar suas strings.

`ai/context.js` valida roteiro e template vigentes aprovados, vínculo da aula e correspondência de número, título, objetivos e duração. Congela projeto, roteiro, item, seções ativas, guias aprovados de aulas anteriores na sequência e instruções adicionais. A ausência de histórico anterior é explícita. Contexto maior que 200 KB é rejeitado antes da chamada. Não há ferramentas de execução, acesso a repositórios ou publicação. Exemplos de código são propostas pendentes de validação.

`ai/service.js` reserva orçamento e enfileira em transação. `request_key` único mais hash dos parâmetros impede solicitações duplicadas; chave reutilizada com outro corpo retorna 409. O HTTP retorna 202. O worker reivindica uma tarefa pendente e cria uma única tentativa em transação; não chama o provedor dentro da transação SQLite. Antes do envio revalida o planejamento e o catálogo. Após receber, valida estrutura, ordem e conteúdo obrigatório, reutiliza `guideSchema` e `insertGuideDraft` de `guides.js` e persiste guia, resultado da tarefa e consumo atomicamente. A mesma função de persistência atende criação manual da Fase 2A.

Regeneração referencia guia e seção exatos, pede somente essa seção e combina o resultado com o snapshot do restante do conteúdo salvo. Sempre cria novo rascunho, inclusive quando a origem foi aprovada. A origem permanece imutável. `GET /guides/:id` expõe a proveniência por `ai_jobs.result_guide_id`; revisão, comparação e aprovação continuam usando as APIs existentes. O status de produção da aula é independente.

`server.js` inicia `ai/worker.js` com `fork`, sem modo watch no processo filho. O worker usa uma conexão SQLite própria e trava com proprietário e heartbeat. Outro worker aguarda a trava; após 15 segundos sem heartbeat, pode assumir. O proprietário é conferido antes de reivindicar e concluir tarefas. Perder a trava cancela a execução daquele worker. Ao assumir, tarefas que ficaram `running` viram `failed/INTERRUPTED`, com reserva incerta; nunca voltam automaticamente à fila. Tarefas `pending` continuam normalmente. Desconexão do processo pai ou sinal interrompe chamadas ativas. Não há repetição automática de falhas ou chamadas pagas.

Cancelamento de pendente libera reserva e não chama a API. Em execução, grava intenção e aborta a requisição; o resultado é descartado, mas consumo conhecido é registrado. Se não houver uso suficiente para calcular o custo, `cost_usd` fica NULL e a reserva permanece comprometida. A interface exibe **Custo não determinado**, não zero.

Orçamento é em USD por mês UTC. Soma custos estimados conhecidos no mês e reservas pendentes/incertas, inclusive de meses anteriores. A reserva usa limite conservador de entrada baseado nos bytes do prompt/schema mais margem e o limite de tokens de saída, valorizados pelos preços configurados. Não é garantia de faturamento máximo externo: preços incorretos, regras do provedor e dados de uso incompletos exigem conferência. Cache sem preço específico é estimado ao preço normal de entrada. Conversão BRL só ocorre com taxa e data fotografadas na tarefa. Não há conciliação/liberação manual de reservas incertas na interface desta fase.

### Endpoints de IA

Todos usam prefixo `/api`, as mesmas restrições de loopback e o padrão de erros existente.

| Método | Caminho | Operação |
|---|---|---|
| GET, PUT | /ai/settings | Preferências, modelos, preços e presença de credenciais |
| POST | /ai/test-connection | Consulta explícita do catálogo e validação do ID configurado |
| GET | /ai/usage | Orçamento e últimas 200 chamadas registradas |
| GET | /ai/jobs | Últimas 100 tarefas |
| GET | /ai/jobs/:id | Estado, progresso, tentativa, reserva e guia resultante |
| POST | /ai/jobs/:id/cancel | Cancelamento idempotente |
| GET, POST | /lessons/:id/ai-jobs | Histórico da aula e solicitação de geração/regeneração |

POST recebe `request_key`, `provider`, `model`, `template_version_id`, `roadmap_version_id`, `instructions`; regeneração acrescenta `source_guide_id` e `section_id`. A resposta não retorna o snapshot interno do prompt ou parâmetros de autenticação. Uma nova solicitação paga exige nova chave.

### Interface e verificação

`Roadmaps.jsx` torna o cadastro acessível pelo menu sem recriar o editor. `AISettings.jsx` gerencia preferências e consumo. `AIGeneration.jsx` oferece seleção, enfileiramento, progresso por marcos e cancelamento. `Guides.jsx` reutiliza o editor estruturado e protege edições pendentes quando uma geração termina. Não há um segundo editor.

Testes adicionais exercitam HTTP, SQLite, provedores falsos, adaptadores com fetch simulado, worker em processo separado e fluxo DOM → API → tarefa → guia. Nenhum teste automatizado depende de credenciais ou consome créditos reais.


## Materiais e memória — Fase 2C

`materials/routes.js` concentra referências, uploads, downloads, extrações, conclusão importada, resumos versionados e análises. `storage.js` usa nomes por hash, valida caminhos e serializa extrações em workers limitados; `extract.js` lê DOCX via ZIP/XML, PDF textual via PDF.js e UTF-8. `github.js` consulta apenas endpoints REST oficiais com caminhos autorizados e commit fixado. Não há execução de código externo.

Migration 005 adiciona referências, materiais, extrações, snapshots, conclusões e memórias, além da fila `memory_analysis_*`. `ai/service.js` reutiliza o mesmo contrato de tarefas com tabelas fixas por tipo; `createAIWorkerService` processa as duas filas sob a trava existente. O orçamento agrega ambas. Análise não exige roteiro/template e gera somente rascunho com citações validadas.

`memory.js` valida procedência, citações e seleção consentida de contexto. `ai/context.js` incorpora apenas os materiais/resumos selecionados, preservando o contexto anterior da Fase 2B. `GET /ai/jobs/:id/sources` expõe o manifesto congelado. `LessonMaterials.jsx`, `ProjectReferences.jsx` e `ProjectMemory.jsx` oferecem os fluxos; `ContextSelection.jsx` é compartilhado com a geração de guias.

Limites e decisões detalhados em [PHASE_2C_REPORT.md](PHASE_2C_REPORT.md). O backup passa a exigir banco e `storage/materials` juntos.


## Código e evidências — Fase 3

Migration 006 cria `code_preparations`, `code_revisions`, `code_file_references`, `code_evidence` e `code_guide_links`, sem alterar 001–005. Preparar um repositório reutiliza `project_references`, mantendo o vínculo com aula/projeto. Revisões guardam manifesto por arquivo, digest SHA-256, resumo, pai e revisão humana. Os bytes ficam em `storage/code/blobs`, identificados por hash e conferidos na leitura; nenhuma imagem grande entra no SQLite. A árvore editada é uma cópia virtual local, sem checkout ou modificação do original.

`code/git.js` usa Git oficial com fetch raso em repositório bare temporário, hooks/templates/configurações de credenciais desativados, sem submódulos/checkout. Apenas GitHub HTTPS público selecionado explicitamente; branch e commit são registrados. Symlinks, paths inseguros e credenciais conhecidas são recusados ou omitidos. Há limites de arquivos, bytes, tempo, saída e monitoramento de disco, configuráveis no backend. O monitoramento é limite de aplicação, sem quota de sistema operacional.

`code/service.js` serializa preparações assíncronas persistidas, preserva falhas/cancelamentos e retoma pendentes no reinício. Em execução interrompida, marca falha em vez de repetir automaticamente. Mudanças criam revisões novas; aprovação/rejeição compara o digest. Triggers impedem sobrescrita de snapshots e evidências avaliadas. `inspection.js` observa declarações e referências sem executar código. `png.js` valida e remove metadados auxiliares de PNGs manuais.

Execução e captura automática respondem 409: não existe executor/navegador isolado com política de rede disponível. Não há shell arbitrário, npm ou scripts importados executados no hospedeiro. Resultados de inspeção são `observed`, relatos manuais `reported`, sem afirmar teste aprovado. Interfaces distinguem revisão humana de validação funcional.

`CodeWorkspace` e os componentes `CodeFiles`, `CodeEvidence`, `CodeGuideLinks` apresentam histórico, propostas, comparação por arquivo, evidências e associações. Os vínculos apontam para guia/seção/etapa e revisão exatos, independentemente de novas versões. `Guides.jsx` consulta os vínculos sem alterar o conteúdo do guia. Nenhuma infraestrutura adicional de IA foi criada.

Detalhes, endpoints e limites: [PHASE_3_REPORT.md](PHASE_3_REPORT.md). Backup passa a incluir `storage/code` junto do banco e materiais. Não há coleta automática de blobs órfãos ou limpeza de temporários deixados por queda abrupta.


## Propostas de código com IA — Fase 3B

Migration 007 acrescenta `code_proposals` e persistência do tipo `code_generation_*`, compatível com o contrato de tarefas existente. `ai/service.js` atende guia, memória e código; `createAIWorkerService` processa todos sob a mesma trava/heartbeat. Reservas, uso, cancelamento e recuperação são compartilhados, com soma dos tipos no orçamento. Não há outro executor, integração paga independente ou retry automático.

`code/ai-context.js` valida a seleção, snapshot de guia, arquivos por hash, permissões e schema de resposta. O prompt é reconstruído pelo worker a partir dos blobs autorizados, sem repetir código e prompt no SQLite. A prévia calcula uma reserva local e seu digest protege contra mudanças entre revisão e envio. Somente os trechos/arquivos selecionados são enviados, sujeitos a limites de contexto e detecção de padrões conhecidos de credenciais.

`code/proposals.js` oferece consulta, rejeição e aceitação. O serviço da Fase 3 compartilha `stageChange`/`commitChange`; assim a criação de uma revisão e a aceitação da proposta ocorrem na mesma transação após revalidar digest, revisão mais recente e estado pendente. A revisão resultante é sempre rascunho, sem substituir origem ou alterar guia. Revisão posterior exige confirmação explícita para ramificar a origem; não há merge automático.

`CodeGeneration`, `CodeAIHistory` e `CodeProposalReview` integram a tela existente e preservam edições manuais durante o acompanhamento. Consumo global distingue propostas de código. Execução, testes do código gerado e captura automática continuam indisponíveis conforme a Fase 3. Detalhes e endpoints em [PHASE_3B_REPORT.md](PHASE_3B_REPORT.md).
