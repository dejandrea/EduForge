# Fase 3 — Código, inspeção técnica e capturas

Branch `feat/fase-3-codigo-capturas`, criada a partir de `14a90f9`, com a Fase 2C. Especificação: [Fase 3](prompts/Fase%203.md). Implementação local; sem commit, push, merge, deploy, publicação ou chamadas pagas durante o desenvolvimento.

## Entrega e fluxo de uso

1. Em **Aulas → Código e capturas**, selecione uma referência GitHub já cadastrada no projeto. Informe branch e objetivo técnico e autorize a preparação. Não há outro cadastro de repositórios.
2. A preparação fica na fila, pode ser cancelada e registra URL, branch, commit e datas. Falhas mostram uma ação possível. Repositórios privados não são autenticados nesta fase; use uma referência pública autorizada. Se a referência tiver commit fixado, o topo da branch precisa corresponder a ele.
3. Abra o histórico e uma revisão para consultar a árvore virtual, arquivos textuais e hashes. Binários constam do manifesto; seu conteúdo não é executado ou exibido como página. Marque arquivos como referências técnicas daquela revisão.
4. Edite texto, crie ou proponha remoção de arquivos. **Adicionar alteração à proposta** prepara cada mudança; **Gravar nova revisão** salva o conjunto adicionado. A revisão anterior permanece intacta. Compare arquivos criados, alterados e removidos, com conteúdo anterior e atual lado a lado. A comparação é por arquivo, sem algoritmo de diff por linha.
5. Execute a inspeção estática para registrar extensões, dependências e scripts declarados, arquivos esperados e referências relativas não resolvidas. Aliases, importações dinâmicas e a semântica do código exigem avaliação humana. Nenhuma dependência é instalada.
6. Aprove ou rejeite explicitamente a revisão pelo SHA-256 de seu manifesto. A aprovação registra exatamente a revisão avaliada, sem aplicar alterações ao GitHub e sem declarar funcionamento. Conteúdo aprovado só recebe alterações por outra revisão.
7. Registre evidências manuais, erros e relatos de testes/builds externos. Envie capturas PNG e revise-as. A existência de arquivos, relatos ou imagens nunca cria aprovação funcional. Relatos externos de teste/build não podem ser aprovados como execução comprovada pelo EduForge.
8. Associe arquivo e/ou evidência a uma versão exata do guia, seção e etapa da aula. O guia mostra os vínculos técnicos sem mudar seu conteúdo. Revisões e guias posteriores não redirecionam os vínculos antigos.

## Disponibilidade e decisões de segurança

**Nível A implementado. Nível B indisponível. Captura automática indisponível.** Não há executor isolado com limites de processos, memória, rede e acesso a segredos neste ambiente Windows. Uma cópia de diretório não foi tratada como sandbox. Por isso, nenhuma rota aceita executar npm, scripts, testes, builds ou comandos arbitrários do código importado. Os endpoints de execução e captura automática respondem 409 com a explicação, mesmo com confirmação e URL local. Não há comando parcialmente habilitado por uma simples allowlist.

Playwright não é iniciado: acessar uma URL localhost, por si só, não oferece isolamento nem uma política de rede adequada. O fluxo disponível é upload manual PNG, com limite de 5 MB e 4096 × 4096, validação estrutural/CRC e remoção de chunks auxiliares. A imagem é armazenada fora do SQLite e servida somente como PNG, sem cache e com `nosniff`/CSP. A revisão humana precisa conferir o conteúdo visual e eventual informação pessoal nos pixels; remover metadados não anonimiza uma imagem.

A preparação usa Git oficial: repositório bare temporário, fetch raso da branch, `ls-tree` e `cat-file`, sem checkout. Isso evita filtros de checkout, execução de hooks, submódulos e scripts de instalação. Hooks/templates são direcionados a uma pasta controlada, configurações globais/sistema e helpers de credenciais ficam desativados, protocolos são restritos a HTTPS e redirecionamentos HTTP são recusados. O ambiente do processo não herda chaves OpenAI/Gemini/GitHub ou configurações de Git do usuário. Saída bruta externa não é gravada no banco nem devolvida em erros. O cancelamento encerra a árvore de processos Git no Windows com `taskkill /T`; não executa código do repositório.

Somente URLs HTTPS de repositórios GitHub explicitamente associados à aula/projeto são aceitas. Paths são relativos e validados antes de qualquer leitura/edição; `.env`, áreas de credenciais, chaves conhecidas, nomes reservados Windows e traversal são recusados/omitidos. Symlinks e submódulos recusam a preparação. Também são recusados caminhos duplicados que diferem somente por caixa. Não há exportação de repositório ou cópia de credenciais do ambiente. Segredos eventualmente escritos dentro de um arquivo comum de um repositório público não são detectados semanticamente.

O código é copiado para um armazenamento local de blobs por hash com manifesto versionado, não para a pasta original. O editor modifica essa cópia virtual; não há checkout editável ou execução local dessa árvore. Blobs são conferidos por SHA-256 na leitura. A pasta temporária Git específica da preparação é removida ao concluir ou falhar normalmente. Interrupções abruptas podem deixar temporários, e não há coleta automática de blobs órfãos nesta fase.

## Limites configuráveis

Variáveis do backend; reinicie após alterar. Valores padrão:

| Variável | Padrão | Finalidade |
|---|---:|---|
| `CODE_MAX_FILES` | 2000 | Arquivos por preparação/revisão |
| `CODE_MAX_BYTES` | 31457280 | 30 MiB de arquivos por revisão |
| `CODE_MAX_FILE_BYTES` | 2097152 | 2 MiB por arquivo de código |
| `CODE_MAX_DISK_BYTES` | 524288000 | 500 MiB na área técnica |
| `CODE_MIN_FREE_BYTES` | 52428800 | 50 MiB de espaço livre mínimo |
| `CODE_TIMEOUT_MS` | 120000 | Tempo máximo da preparação Git |
| `CODE_MAX_OUTPUT_BYTES` | 4194304 | 4 MiB por chamada Git, somando stdout/stderr |

As preparações são serializadas. Há conferência de capacidade antes das gravações e monitoramento do espaço durante o fetch a cada 250 ms. Isso é um limite gerenciado pela aplicação, com possível excedente transitório durante o download; não equivale a uma quota de disco imposta pelo sistema operacional. Um repositório muito grande é recusado, não importado parcialmente como revisão válida. Escritas de blobs são serializadas. A quantidade/tamanho do manifesto é verificada novamente no serviço antes da persistência.

## Persistência e recuperação

Migration incremental `006_code_workspaces.sql`, sem modificar 001–005. Tabelas: `code_preparations`, `code_revisions`, `code_file_references`, `code_evidence`, `code_guide_links`. Chaves estrangeiras preservam projeto, aula, referência e guia; triggers preservam revisões, evidências avaliadas e histórico. Evidências registram preparação/revisão, tipo, origem, resultado, descrição, dados, imagem por hash, datas e decisão humana. A API apresenta também aula, commit e hash da revisão.

Uma nova revisão é sempre adicionada, com UUID, número e pai; nenhuma edição sobrescreve um snapshot. Aprovação compara o digest enviado com o salvo. Resultado de inspeção é `observed`; relato manual é `reported`. `passed` e aprovação de teste/build exigem origem automatizada, ainda indisponível nesta entrega.

Pendentes são retomados ao iniciar o servidor. Preparações encontradas em execução após reinício ficam falhas e exigem uma nova preparação explícita. Canceladas não criam revisões. Operações de rede/Git ocorrem fora de transações SQLite. Não foi criada outra infraestrutura de IA; não há novas chamadas de IA nesta fase.

Backup: encerre o EduForge e copie `storage/eduforge.db`, `storage/materials` e **`storage/code` juntos**. Não apague/restaure somente o banco. O armazenamento continua ignorado no Git. Os testes usam apenas bancos e diretórios temporários; dados reais do piloto não foram usados como fixtures.

## Arquivos

- Criados: migration 006; `apps/api/src/code/{storage,git,inspection,png,service,routes}.js`; `apps/api/test/code.test.js`; `packages/shared/src/code.js`.
- Interface: `pages/CodeWorkspace.jsx` e CSS próprio; `components/CodeFiles.jsx`, `CodeEvidence.jsx`, `CodeGuideLinks.jsx` (inclui consulta dos vínculos no guia).
- Integração: `app.js`, `server.js`, schemas compartilhados, `main.jsx`, `Guides.jsx`, testes API/DOM e contagens de migrations.
- Documentação: README, arquitetura, roadmap e este relatório. Prompt fornecido preservado.

## Endpoints

Prefixo `/api`, contratos de erro/loopback existentes:

| Método | Caminho | Uso |
|---|---|---|
| GET | `/code/capabilities` | Disponibilidade, motivos e limites |
| GET, POST | `/lessons/:id/code-preparations` | Histórico e preparação autorizada, HTTP 202 |
| GET | `/code/preparations/:id` | Estado e revisões |
| POST | `/code/preparations/:id/cancel` | Cancelamento |
| GET | `/code/revisions/:id` | Manifesto exato |
| GET | `/code/revisions/:id/file?path=...` | Texto de um arquivo daquela revisão |
| GET | `/code/revisions/:id/diff?base=...` | Arquivos criados, alterados e removidos |
| POST | `/code/revisions/:id/changes` | Nova revisão com alterações propostas |
| POST | `/code/revisions/:id/review` | Aprovar/rejeitar pelo digest |
| GET, POST | `/code/revisions/:id/references` | Referências técnicas selecionadas |
| POST | `/code/revisions/:id/inspect` | Inspeção estática, sem execução |
| GET, POST | `/code/revisions/:id/evidence` | Consulta e relato manual |
| POST | `/code/revisions/:id/captures` | Upload manual PNG e descrição |
| POST | `/code/evidence/:id/review` | Revisão humana da evidência |
| GET | `/code/evidence/:id/asset` | Imagem local |
| GET, POST | `/code/revisions/:id/guide-links` | Vínculos imutáveis com etapas do guia |
| GET | `/guides/:id/code-links` | Evidências da versão do guia |
| POST | `/code/revisions/:id/execute` | Indisponível, HTTP 409 |
| POST | `/code/revisions/:id/capture-automatic` | Indisponível, HTTP 409 |

## Verificações e pendências

Resultado final da suíte: **36 testes da API e 10 da interface aprovados (46 no total)**. Build Vite aprovado, com avisos não bloqueantes de dependências já existentes; `format:check` e `git diff --check` aprovados. As primeiras execuções revelaram uma fixture PNG com CRC incorreto e um guia de teste sem o conteúdo obrigatório; ambas foram corrigidas, mantendo a validação de produção. Migrations 001–005 permaneceram sem alterações.

Os testes incluem transporte Git simulado e chamada local `git --version`, sem buscar repositórios reais. Exercitam autorização, cópia, original preservado, traversal/credenciais, symlinks/submódulos no manifesto Git simulado, limites, alterações, hashes, aprovação imutável, cancelamento, erro sanitizado, PNG manual, relatos sem execução comprovada, vínculos de guia, persistência e reinício. Tentativas de captura automática com destinos locais, externos e sensíveis são simuladas e devem ser recusadas antes de qualquer navegação. **Isso testa a indisponibilidade segura, não implementa uma captura Playwright com sucesso.**

O teste de interface percorre seleção de referência, preparação simulada, abertura de arquivo, proposta, nova revisão, inspeção estática e aprovação por hash usando React/DOM com API e SQLite reais em memória. Os testes anteriores permanecem na suíte.

Pendências: inspeção visual em navegador real, preparação assistida do repositório público escolhido pela professora e avaliação pedagógica das evidências. Sem navegador conectado nesta sessão (`apps: []`, `browsers: []`), não foi feita inspeção visual. Não houve execução do Frogger ou alterações em seus dados reais para testar o fluxo.

Próxima infraestrutura necessária: executor realmente isolado com allowlist completa de argumentos, revisão dos scripts/dependências, limites de recursos/processos, cancelamento e política de rede; depois, navegador Playwright sujeito à mesma política para capturas autorizadas. Não há backend de execução ou captura automática configurável somente por habilitar uma variável nesta fase.

Referências consultadas: [Git fetch](https://git-scm.com/docs/git-fetch), [ls-tree](https://git-scm.com/docs/git-ls-tree) e [cat-file](https://git-scm.com/docs/git-cat-file).
