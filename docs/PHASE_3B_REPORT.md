# Fase 3B — Evolução assistida de código com IA

Branch `feat/fase-3b-geracao-codigo-ia`, baseada na Fase 3 concluída (`9f0dfb7`). Requisitos: [Fase 3B](prompts/Fase%203B.md). A preparação, a edição manual, a comparação, as evidências e a aprovação de código da Fase 3 foram reutilizadas. O [relatório original da Fase 3](PHASE_3_REPORT.md) foi preservado.

## Funcionalidades e fluxo

Em **Aula → Código e capturas**, abra uma preparação pronta e escolha a revisão de origem no seletor existente. A seção **Gerar evolução do código com IA** permite selecionar uma versão do guia da mesma aula, suas seções, arquivos para leitura, permissões por arquivo/operação, provedor/modelo cadastrado e instruções técnicas adicionais.

Guias em rascunho, em revisão ou aprovados são aceitos. O template real fornece títulos e IDs estáveis; não há dependência de nomes ou IDs fixos. Seções vazias não são enviadas. A interface identifica rascunhos e explica que podem mudar. Nenhum guia é editado pela geração.

Arquivos têm seleção individual e tamanho visível. Leitura e alteração são permissões distintas. Modificação/remoção exige selecionar o arquivo textual para leitura; criação exige caminho novo explicitamente autorizado. Binários, paths inseguros, arquivos conhecidos de credenciais, colisões de caixa e conflitos entre arquivo/pasta são recusados. Somente as seções e arquivos selecionados entram no prompt; nem o repositório inteiro nem um package.json não selecionado são enviados.

**Revisar envio e estimar custo sem chamar IA** mostra objetivo pedagógico/técnico, arquivos, conteúdo exato das seções, reserva estimada e saldo. A prévia não consulta provedores nem cobra créditos. Ela é vinculada a um digest do contexto e da configuração. Se o guia, a seleção ou a configuração mudar antes de solicitar, uma nova prévia é necessária. O envio pago exige checkbox e confirmação explícita. Alterações de seleção invalidam a autorização anterior.

A tarefa conserva o snapshot autorizado mesmo se o guia em rascunho for editado depois. O histórico mostra origem, guia/estado, modelo, tentativas, duração concluída, tokens, reserva/custo estimado e erros. Conclusão de geração não abre outra revisão nem sobrescreve o editor. A professora abre a proposta deliberadamente para comparar original e resultado, consultar justificativas/seções relacionadas e ajustar conteúdo.

Aceitar exige confirmação e cria **uma nova revisão em rascunho**. A origem permanece intacta, inclusive quando já aprovada. Rejeição preserva o histórico sem criar revisão. O fluxo da Fase 3 continua responsável por inspecionar, registrar evidências e aprovar o código. Aceitação de proposta não publica nada nem altera o GitHub.

## Integração com IA e custos

`ai/service.js` passou a atender o tipo `code`, além de guias e memória. Usa os mesmos adaptadores OpenAI/Gemini, catálogo, configurações, schema estruturado, reserva de orçamento, normalização de uso/erros, cancelamento, idempotência e recuperação. A execução é feita pelo **mesmo worker e a mesma trava/heartbeat**, sem outro executor ou loop independente.

O contrato existente usa tabelas por tipo devido às restrições de estado e referências obrigatórias das migrations antigas. A migration 007 acrescenta `code_generation_jobs`, `code_generation_attempts` e `code_generation_usage`, compatíveis com esse contrato, preservando 001–006 sem reconstruir tabelas com dados reais. O orçamento soma os três tipos; `/ai/usage` inclui propostas de código. Essa separação de persistência não cria outro serviço de geração ou orçamento.

Custos continuam estimados em USD a partir dos preços cadastrados. Antes de enfileirar, a reserva considera o tamanho do prompt/schema e o limite de saída do modelo. Não é cotação de faturamento máximo. Tokens conhecidos geram custo estimado registrado mesmo quando a resposta é inválida; uso desconhecido mantém reserva incerta. Cancelamento em execução pode consumir créditos. Não há retries pagos automáticos; **Preparar nova solicitação paga** exige nova prévia/autorização. Reenvio com a mesma chave retorna a mesma tarefa.

O prompt exige preservar tecnologia, funcionalidades fora do escopo e progressão da aula; mudanças pequenas, explicações e verificações manuais. Para Game Lab, exige preservar APIs como createSprite/setAnimation/drawSprites/keyWentDown/isTouching, sem conversão automática para React/Canvas/Node. Assets citados em setAnimation não são tratados como existentes. Isso orienta a geração; não é uma garantia de compatibilidade funcional.

## Schema, persistência e segurança

Migration **`007_code_ai_proposals.sql`**: tarefas, tentativas, consumo e `code_proposals`. Cada proposta registra tarefa, aula/preparação, revisão/digest de origem, guia/estado, trechos selecionados, arquivos por hash, permissões, resultado validado, revisão resultante, ajustes aceitos e datas/decisão humana. Triggers impedem editar propostas avaliadas ou apagar seu histórico.

A resposta Zod contém resumo, mudanças com path/operação/conteúdo completo, justificativa, IDs das seções relacionadas, observações e verificações manuais. A validação posterior confere permissões, caminhos, duplicatas, referências e limites. Respostas incompletas ou inválidas falham sem proposta/revisão parcial; o sistema não inventa conteúdo ausente.

Limites iniciais: até 20 arquivos de leitura, 20 permissões e 30 seções; arquivos de entrada somando até 100 KB; contexto total até 120 KB; resposta com até 20 mudanças e 500 KB de conteúdo. Também valem os limites de arquivo/revisão/armazenamento da Fase 3. A revisão resultante deve conservar ao menos um arquivo. Respostas grandes podem ultrapassar os tokens configurados e falhar; ajuste o escopo e o limite do modelo após conferir o consumo.

Código de origem e resposta usam os blobs SHA-256 da Fase 3. Os snapshots das tarefas guardam hashes/metadados e trechos do guia, sem duplicar o corpo dos arquivos e do prompt no SQLite. O worker reconstrói o prompt usando somente esses blobs autorizados e confere sua integridade. Código proposto e ajustes humanos também ficam por hash; nada é executado.

Credenciais permanecem exclusivamente no backend. A seleção é verificada contra padrões conhecidos de tokens/chaves privadas antes do envio; essa verificação não identifica todo segredo possível em arquivos comuns. A professora precisa revisar dados sensíveis. Mensagens de erro não persistem exceções brutas, tokens ou prompts completos. Nenhum recurso de execução ou captura automática foi habilitado.

## Concorrência e aplicação

Antes de aceitar, o serviço verifica estado pendente, digest da origem e identidade da revisão mais recente. A preparação do conteúdo ocorre fora da transação; as verificações são repetidas dentro de `BEGIN IMMEDIATE`, junto da criação da revisão e aceitação da proposta. Duas aplicações concorrentes produzem somente uma revisão.

Uma revisão posterior exige confirmação adicional e correspondência do ID mais recente. A aceitação nesse caso cria uma ramificação da origem escolhida; **não incorpora nem mescla automaticamente alterações posteriores**. Se o histórico mudar outra vez, a aplicação é recusada. A interface oferece atualizar esse estado sem descartar os ajustes da proposta. Edições não gravadas no editor manual impedem aceitar a proposta pela interface.

Os ajustes humanos conservam o conjunto e as operações dos arquivos gerados, dentro das permissões concedidas. Mudanças adicionais pertencem ao editor da Fase 3 ou a outra geração explicitamente autorizada. Propostas rejeitadas/aceitas não podem ser reaplicadas. O vínculo com o guia conserva seu snapshot; não modifica conteúdo, aprovações ou vínculos técnicos anteriores.

## Endpoints e arquivos

Prefixo `/api`, com regras existentes de loopback e erros:

| Método | Endpoint | Operação |
|---|---|---|
| POST | `/code/revisions/:id/ai/estimate` | Prévia local e reserva estimada, sem chamada paga |
| POST | `/code/revisions/:id/ai-jobs` | Enfileirar solicitação autorizada, HTTP 202 |
| GET | `/code/preparations/:id/ai-jobs` | Histórico com consumo, origem e proposta |
| GET | `/code/ai-jobs/:id` | Estado e métricas |
| POST | `/code/ai-jobs/:id/cancel` | Cancelamento existente |
| GET | `/code/proposals/:id` | Resultado, comparação, snapshot e estado |
| POST | `/code/proposals/:id/apply` | Aceitação e criação atômica de revisão em rascunho |
| POST | `/code/proposals/:id/reject` | Rejeição humana |

Criados: migration 007; `packages/shared/src/code-ai.js`; `code/ai-context.js`, `ai-routes.js`, `proposals.js`; `apps/api/test/code-ai.test.js`; componentes `CodeGeneration`, `CodeAIHistory`, `CodeProposalReview`.

Alterados: serviço/rotas compartilhados de IA e agregação de consumo; montagem do app; serviço de código (preparação/persistência de mudanças compartilhadas); CodeWorkspace/CSS e identificação do tipo em AISettings; exports compartilhados; testes/contagens de migrations; README, roadmap e arquitetura. Dependências de SDK foram mantidas e os adaptadores existentes reutilizados.

## Teste real da Aula 3 do Frogger Game

1. Reinicie com `npm run dev` no CMD (ou `npm.cmd run dev` no PowerShell), preservando banco, `.env` e arquivos em storage.
2. Abra **Frogger Game → Aula 3 → Código e capturas**. Use a preparação já importada de `profAndreaFranca/Frogger-Game---pt2`, branch `master`; selecione sua Revisão 1. Não precisa importar outra cópia se ela já está pronta.
3. Abra **Gerar evolução do código com IA**, escolha a versão exata do guia da Aula 3 (pode ser rascunho) e selecione somente as seções necessárias para a atividade.
4. Selecione `script.js` para leitura e autorize sua alteração. Não autorize remoção/criação se não forem necessárias. Confira o conteúdo e os nomes das animações; assets do Game Lab podem estar fora do repositório.
5. Escolha o modelo cadastrado, confira preços, limite de saída e orçamento em Configurações. Nas instruções, explicite preservar Code.org Game Lab e o escopo da aula.
6. Revise a prévia e o custo. Somente então autorize o envio e clique **Gerar proposta de código com IA**. Essa é uma chamada real paga da conta configurada.
7. Acompanhe o histórico. Abra **Revisar proposta**, compare arquivos e justificativas, ajuste código se necessário e aceite ou rejeite. Salve/descarte edições manuais pendentes antes de aceitar.
8. A nova revisão fica em rascunho. Consulte a comparação/inspeção da Fase 3 e valide manualmente no Game Lab, incluindo animações, colisões e progressão pedagógica, antes de aprovar a revisão. A aplicação não executa o código nem certifica funcionamento.

## Verificação e limitações

Verificação executada: **47 testes da API e 11 testes da interface aprovados (58 no total)**; build Vite, `format:check` e `git diff --check` aprovados. Os avisos de build são de dependências existentes e não bloqueiam a compilação. Foram corrigidas duas fixtures: o caminho do arquivo de credencial simulada (que era recusado antes de testar seu conteúdo) e a espera das opções de guia no teste DOM. Migrations 001–006 e o relatório original da Fase 3 permaneceram sem alterações.

Testes usam bancos/diretórios temporários, repositório e provedores simulados, sem ler dados reais do piloto, consultar APIs pagas ou consumir créditos. Cobrem seleção explícita, binários/credenciais, contexto, schema/paths/autorizações, falhas/custos, orçamento compartilhado, idempotência, cancelamento/reinício, preservação da origem, concorrência/aplicação única, rejeição, guia, operações de arquivo e Game Lab. O teste DOM percorre prévia/autorização → proposta simulada → ajustes humanos → revisão em rascunho, preservando o editor manual até decisão explícita.

Continuam pendentes a geração real com o modelo da professora, avaliação pedagógica/compatibilidade no Game Lab e inspeção visual em navegador real. O inventário de automação retornou `apps: []`, `browsers: []`; DOM simulado não verifica layout ou renderização no navegador. O código gerado não foi executado. Os limites da Fase 3 para execução e Playwright permanecem.

Backup continua exigindo aplicação encerrada e cópia conjunta do banco e `storage/materials`/`storage/code`, que agora também contém blobs de propostas e ajustes. Não há limpeza automática do histórico ou de blobs órfãos por falhas/interrupções. Não houve commit, push, merge, deploy ou publicação nesta solicitação.

Referências: [Structured Outputs da OpenAI](https://developers.openai.com/api/docs/guides/structured-outputs) e documentação/source do AI SDK instalados em `node_modules/ai`. A validação do provedor não substitui as verificações de permissões e referências do backend.
