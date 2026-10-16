# Relatório — Fase 2B: geração pedagógica com IA

## Diagnóstico e correção da Fase 2A

O cadastro de roteiros, sua API, versões e aprovação já existiam. O caminho estava apenas dentro dos detalhes de um projeto, em **Roteiro pedagógico**, o que tornava o cadastro pouco visível. Foi acrescentada a entrada **Roteiros** no menu, com seleção de projeto e botão **Cadastrar ou abrir roteiro**. O editor existente foi reutilizado. Um teste de interface percorre esse acesso até o formulário de planejamento.

Trabalho na branch `feat/fase-2b-ia`, criada a partir de `feat/fase-2a-roteiros` no commit `135773d`. Alterações e dados anteriores foram preservados. Não houve push ou merge; a Fase 3 não foi iniciada.

## Funcionalidades

- Adaptadores OpenAI e Gemini com geração estruturada, catálogo de modelos, dados de uso, normalização de erros, tempo limite e cancelamento.
- Configurações de provedor/modelo, limite de saída, temperatura opcional, preços por milhão de tokens, data dos preços, orçamento mensal e câmbio identificado.
- Credenciais somente em variáveis do backend; a tela exibe presença, sem retornar os valores ou guardá-los no banco de preferências.
- Teste de conexão somente por ação explícita; consulta o catálogo sem gerar conteúdo.
- Ação **Gerar guia com IA** na página de guias existente, com referências exatas de template/roteiro e instruções adicionais.
- Contexto composto de projeto, planejamento aprovado, item vinculado, seções ativas e guias aprovados de aulas anteriores, sem inventar histórico inexistente.
- Geração e regeneração de seção criam novas versões em rascunho. A regeneração preserva as demais seções salvas e suas referências.
- Editor, comparação, revisão e aprovação da Fase 2A reutilizados. Guias aprovados/substituídos permanecem imutáveis, e o status de produção da aula não é alterado.
- Fila persistida, worker em processo separado, progresso por etapas, uma tentativa por tarefa, cancelamento e recuperação sem repetição automática de chamadas pagas.
- Registro de tokens, custos estimados, preços/câmbio da execução, provedor/modelo e vínculo com o guia produzido.
- Reserva preventiva de orçamento e indicação **Custo não determinado** quando o uso não basta para estimar custos.

## Arquitetura e decisões

A migration `004_ai_generation.sql` cria cinco tabelas: preferências, tarefas, tentativas, uso e trava de worker. Não altera as migrations 001–003 nem apaga registros existentes.

O backend utiliza AI SDK e adaptadores diretos `@ai-sdk/openai` e `@ai-sdk/google`; não depende de AI Gateway ou hospedagem Vercel. Não há modelo fixo, pois disponibilidade e capacidades mudam. IDs são cadastrados pela professora, verificados no catálogo do provedor e validados pela chamada estruturada. Temperatura só é enviada quando configurada. OpenAI usa Responses com `store:false`. A saída é validada antes da persistência.

O contrato `guideSchema` foi preservado. `guides.js` centraliza a validação de referências e a inserção de rascunhos para a criação manual e o worker. Cada resultado é gravado atomicamente com a conclusão da tarefa e seu consumo. Não existe editor paralelo ou nova API de aprovação.

A geração exige roteiro/template vigentes aprovados e vínculo da aula sem divergência de número, título, objetivos ou duração. O worker revalida antes do envio. O contexto e o conteúdo de origem da regeneração são fotografados ao solicitar; alterações posteriores não modificam a tarefa. O limite local de contexto é 200 KB, com bloqueio explícito se excedido.

`request_key` e hash dos parâmetros evitam enfileiramento duplicado. O worker usa transação para reivindicar a tarefa e garantir uma tentativa. O envio externo acontece fora da transação. Uma trava com proprietário e heartbeat evita trabalhadores concorrentes; outro worker aguarda liberação ou expiração em 15 segundos. O proprietário é conferido antes de reivindicar e concluir uma tarefa.

Execuções que ficaram `running` após uma interrupção tornam-se `failed/INTERRUPTED`, sem nova chamada. Pendentes continuam após reinício. Cancelamento antes de começar libera a reserva; depois do envio aborta a chamada, descarta o resultado e registra uso se disponível. O SDK usa `maxRetries:0`.

Orçamento é em USD e mês UTC. Reservas incertas de meses anteriores continuam comprometidas. Custos são estimativas baseadas nos preços cadastrados e no uso reportado, não valores de fatura. Falta de preços bloqueia a geração; falta de tokens mantém custo NULL e reserva retida. Conversão para BRL só usa taxa e data registradas na tarefa.

## Credenciais e segurança

`OPENAI_API_KEY` e `GEMINI_API_KEY` são informadas no `.env` da raiz ou no ambiente do processo e exigem reinício do backend. A configuração por ambiente foi escolhida para cumprir a preferência do prompt e evitar armazenar ou devolver segredos pela interface. Não há formulário que leia/revele chaves nem endpoint para persistir chaves no SQLite.

As rotas expõem apenas presença de credencial. Schemas estritos rejeitam campos de chave nas preferências. Erros externos brutos, corpos de resposta, cabeçalhos e credenciais não são registrados em tarefas ou logs. A aplicação continua limitada ao loopback, para uso individual.

Os testes injetam provedores ou `fetch` simulados. Não utilizam credenciais reais, não consultam catálogos externos e não consomem créditos. Código sugerido pela IA não é executado; o prompt o marca como proposta pendente de validação. Não há publicação automática.

## Arquivos

Criados:

- `apps/api/migrations/004_ai_generation.sql`.
- `apps/api/src/ai/providers.js`, `context.js`, `service.js`, `routes.js` e `worker.js`.
- `apps/api/src/guides.js`.
- `apps/api/test/ai.test.js` e `apps/api/testing/ai-worker.mjs`.
- `packages/shared/src/ai.js`.
- `apps/web/src/pages/Roadmaps.jsx`, `AISettings.jsx` e `AISettings.css`.
- `apps/web/src/components/AIGeneration.jsx`.
- Este relatório. O prompt fornecido em `docs/prompts/Fase 2B.md` foi preservado.

Alterados:

- `apps/api/src/app.js`, `server.js` e `pedagogy.js`: rotas, inicialização do worker, persistência compartilhada e proveniência do guia.
- `packages/shared/src/index.js`: exportação de schemas de IA.
- `apps/web/src/main.jsx`, `pages/Guides.jsx` e `components/Pedagogy.jsx`: navegação, geração e acompanhamento do estado de edição.
- Testes existentes: atualização da contagem de migrations e verificações da interface.
- `apps/api/package.json`, lockfile e `.env.example`: dependências e configuração sem segredos reais.
- `README.md`, `docs/ARCHITECTURE.md` e `docs/ROADMAP.md`: instalação, fluxo, orçamento e diagnóstico de falhas.

## Verificação

Testes da API: **21 aprovados**, cobrindo também regressões das Fases 1 e 2A. Casos novos: geração simulada, idempotência, contrato de guia, aprovação, regeneração de uma seção, falha da API, resposta incompleta, vazia e JSON inválido, credencial ausente, modelos/preços/orçamento, proteção de segredos, cancelamento, retomada de pendentes, interrupção sem repetição, snapshots de preços/câmbio, custo desconhecido, planejamento divergente, contexto anterior, seção desativada, worker real em outro processo e adaptadores com respostas HTTP falsas para ambos os provedores.

Os testes DOM exercitam os quatro fluxos da Fase 2A e três fluxos novos: acesso ao cadastro de roteiro, configuração com conexão explícita e geração até o editor existente. A validação final desses testes, build e formatação está registrada na conclusão abaixo.

Por HTTP local, `/api/health` retornou `status:ok`; `/api/ai/settings` apresentou zero modelos e credenciais ausentes, conforme ambiente sem configuração; `/roadmaps` respondeu 200 pelo Vite. Nenhuma geração real foi solicitada no banco local.

## Instruções de uso

1. Execute `npm.cmd install --ignore-scripts` e `npm.cmd run dev` na raiz.
2. Abra `http://127.0.0.1:5173/roadmaps` para cadastrar e aprovar o roteiro do projeto.
3. Vincule a aula ao item do roteiro e resolva divergências.
4. Informe a credencial no backend, reinicie e abra **Configurações** para cadastrar modelo, preços e orçamento. Salve antes de testar conexão.
5. Em **Aulas → Guia → Gerar guia com IA**, escolha versões vigentes aprovadas e solicite a tarefa.
6. Acompanhe a fila, revise o rascunho, salve ajustes e aprove explicitamente. Use o painel de regeneração no mesmo guia quando necessário.

## Pendências e limites de validação

- Teste real com a conta e o modelo escolhidos pela professora não foi executado, pois consumiria uma integração real e potencialmente créditos. Credenciais não foram solicitadas pelo chat.
- Inspeção visual em navegador real indisponível: inventário de automação retornou `apps: []`, `browsers: []`. Testes DOM não verificam aparência ou layout responsivo.
- Qualidade pedagógica do conteúdo deve ser avaliada pela professora, com revisão humana obrigatória antes de aprovar.
- O teste de conexão confirma autenticação/catálogo, não garante suporte a todos os parâmetros. Capacidades, preços e limites devem corresponder ao modelo configurado.
- O orçamento local é preventivo e estimado; não substitui limites e faturamento do provedor. Reservas incertas não têm conciliação automática ou botão de liberação nesta fase.
- Caso o processo de worker pare, reinicie o backend. Tarefas já enviadas não são repetidas automaticamente.
- Sem DOCX, execução de código, capturas, GitHub API, NotebookLM, Canva, Drive ou publicação.

## Referências consultadas

- [OpenAI — Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).
- [Google — Structured outputs](https://ai.google.dev/gemini-api/docs/structured-output) e [catálogo de modelos](https://ai.google.dev/api/models).
- Documentação e tipos distribuídos com as versões instaladas do AI SDK, `@ai-sdk/openai` e `@ai-sdk/google`.

## Conclusão da verificação

- **21 testes da API aprovados** e **7 testes de interface aprovados**: 28 no total, sem chamadas pagas.
- Build Vite aprovado; avisos não bloqueantes de diretivas/comentários de dependências ignorados pelo Rollup.
- `npm.cmd run format:check` e `git diff --check` aprovados.
- Migrations 001, 002 e 003 sem alterações.
- Durante a verificação foram corrigidos o desaparecimento da confirmação ao salvar configurações e o encaminhamento do estado de edição no componente de versões.

A implementação da Fase 2B está concluída e disponível para configuração local. Permanecem as verificações externas descritas acima: integração real com a conta/modelo escolhidos, avaliação pedagógica e inspeção visual no navegador. Não foi iniciada a Fase 3.
