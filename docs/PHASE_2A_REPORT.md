# Relatório — Fase 2A

## Resultado

Implementada na branch `feat/fase-2a-roteiros`, criada a partir de `main` após `git fetch origin main` confirmar ausência de divergência com `origin/main`. Não houve push ou merge. A Fase 2B não foi iniciada.

Entregas:

- Roteiro lógico por projeto com versões de planejamento, público, faixa etária, objetivos, metodologia e duração padrão.
- Editor da sequência com números únicos, ordenação independente do número, conceitos, atividades, resultados, pré-requisitos e dependências de aulas anteriores.
- Salvamento transacional do planejamento e da sequência, preservando IDs e vínculos dos itens mantidos.
- Ciclo rascunho, revisão, aprovação e substituição, confirmação explícita, duplicação para rascunho e comparação básica de conteúdo salvo.
- Vínculos explícitos com aulas existentes e aviso de divergência de número, título, objetivos e duração padrão. Resolução manual, sem copiar dados ou mudar status de produção.
- Catálogo de templates com edição de identificação, arquivamento/restauração e versões de seções reordenáveis, instruções e ativação de seções opcionais.
- Modelo padrão de 17 seções inspirado no React Quest, armazenado como dados da migration e adaptável sem regras específicas por projeto no código.
- Guias estruturados escritos manualmente, com referências exatas de template e roteiro, histórico, revisão e aprovação. Rascunhos incompletos são permitidos; aprovação exige texto nas seções obrigatórias.
- Indicador pedagógico da última versão do guia na lista de aulas, separado do status de produção.

## Decisões de integridade

A migration `002_pedagogy.sql` adiciona seis tabelas sem alterar a migration `001_initial.sql`. Chaves estrangeiras preservam histórico, e índices parciais limitam a uma aprovação vigente por projeto, template ou aula. Triggers impedem alterações em aprovados e a exclusão de versões. Duplicações recebem novos IDs, novo número e estado de rascunho.

Aprovações e versionamento usam `BEGIN IMMEDIATE`. A aprovação exige `confirm:true` e o ID da aprovação vigente esperada; uma tela desatualizada recebe 409, sem substituir silenciosamente a aprovação feita por outra operação. A versão anterior passa a substituída dentro da mesma transação.

Vínculos entre item e aula são independentes do conteúdo imutável e podem ser ajustados explicitamente. Não são copiados ao duplicar um roteiro. Projetos com roteiro e aulas com vínculos/guias não podem ser excluídos pelo CRUD da Fase 1. Templates são arquivados para preservar suas versões e referências.

O template de fábrica é disponibilizado aprovado. Novas versões criadas pela professora passam pelo ciclo de revisão e confirmação. Guias podem utilizar versões aprovadas ou já substituídas para manter referências históricas. A aprovação de um roteiro ou guia não modifica `lessons.status`.

O frontend foi separado em páginas e componentes pedagógicos reutilizáveis. Durante a verificação, foi corrigida uma condição que expunha controles com dados antigos entre a atualização do histórico e o carregamento da versão solicitada. Alterações não salvas bloqueiam ações de revisão/duplicação e operações de vínculo; a troca de versão exige confirmação para descartá-las.

## Arquivos

Novos:

- `apps/api/migrations/002_pedagogy.sql`.
- `apps/api/src/pedagogy.js`.
- `apps/api/test/pedagogy.test.js`.
- `packages/shared/src/pedagogy.js`.
- `apps/web/src/components/Pedagogy.jsx` e `Pedagogy.css`.
- `apps/web/src/pages/Roadmap.jsx`, `Templates.jsx` e `Guides.jsx`.
- `apps/web/test/pedagogy.test.jsx` e `apps/web/vitest.config.js`.
- `.prettierrc.json` e este relatório.

Alterados funcionalmente: `apps/api/src/app.js`, `apps/api/test/api.test.js`, `packages/shared/src/index.js`, `apps/web/src/main.jsx`, `apps/web/src/components/Layout.css`, manifests npm e lockfile. Demais arquivos JavaScript, JSX, CSS e manifests existentes também foram formatados com Prettier, sem mudanças intencionais de comportamento.

Documentação atualizada: `README.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md` e links do relatório histórico `docs/IMPLEMENTATION.md`. A reorganização dos prompts feita pela usuária foi preservada, com referências a `docs/prompts/Fase 1.md` e `docs/prompts/Fase 2A.md`.

Dependências de execução permanecem as mesmas. Foram acrescentadas ferramentas de desenvolvimento: Vitest, jsdom, Testing Library e Prettier. A instalação com `--ignore-scripts` reportou zero vulnerabilidades.

## Testes e resultados

`npm.cmd run check`: **aprovado**.

| Verificação | Resultado |
|---|---|
| API — compatibilidade com CRUD e persistência da Fase 1 | Passou |
| API — roteiros, ordenação, unicidade, dependências, transições e imutabilidade | Passou |
| API — aprovações concorrentes e conflito de versão vigente | Passou |
| API — vínculo de aulas, projetos distintos e rollback do editor | Passou |
| API — templates, seções, versões, arquivamento e restauração | Passou |
| API — guias manuais, referências, aprovação e persistência após reiniciar API/banco | Passou |
| API — migration sobre banco da Fase 1, preservação e reaplicação | Passou |
| Interface — roteiro, confirmação cancelada/aceita, duplicação e comparação | Passou |
| Interface — reordenação e desativação de seção opcional | Passou |
| Interface — guia incompleto, revisão e aprovação de conteúdo obrigatório | Passou |
| Interface — aviso de divergência sem sobrescrever aula existente | Passou |
| Build Vite | Passou |
| `npm.cmd run format:check` | Passou |
| `git diff --check` | Passou |

Total: **7 testes de integração da API e 4 testes de interface**, todos aprovados. Os testes da interface executam React em DOM simulado e usam HTTP real para uma API local com SQLite em memória. Os testes de persistência usam arquivos temporários; não escrevem dados de teste no banco da aplicação.

Também foram confirmados por HTTP: `/api/health` retornou `status:ok`, `/api/templates` retornou o modelo de fábrica e `/templates` respondeu 200 através do Vite na porta 5173. Nenhum projeto ou dado pessoal de exemplo foi criado.

Avisos não bloqueantes: SQLite experimental no Node 22 e diretivas/comentários de dependências ignorados pelo Rollup durante o build.

## Executar e conferir

```powershell
npm.cmd install --ignore-scripts
npm.cmd run dev
```

Abra `http://127.0.0.1:5173`. Entre em um projeto e use **Roteiro pedagógico**. O catálogo está em **Templates** e cada aula possui o acesso **Guia**.

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run format:check
```

## Pendências e limites

- Inspeção visual e responsiva em navegador real: o inventário de automação retornou `apps: []` e `browsers: []`. Os testes DOM não verificam aparência, dimensões ou renderização de CSS.
- Validação pedagógica do modelo padrão com os conteúdos reais do React Quest pela professora. Não foram inventados roteiros ou guias reais para a base local.
- Comparação básica exibe campos e posições diferentes; não implementa mesclagem automática.
- Navegar para outra página ou fechar a aplicação antes de salvar descarta alterações locais do editor. O salvamento é explícito.
- Sem IA, geração automática, GitHub API, execução de código, capturas, DOCX, NotebookLM, Canva ou Drive.

A próxima etapa é definir o prompt da Fase 2B. Sua implementação depende de nova solicitação.

## Atualização do modelo padrão

Conforme o ajuste em `docs/prompts/Fase 2A.md`, a migration `003_default_template_sections.sql` acrescenta cinco seções antes de Materiais de apoio e links:

- Objetivos pedagógicos da aula.
- Pilares da aula.
- O que observar na avaliação informal.
- Habilidades de pensamento computacional.
- Mensagem final para a professora.

O modelo atualizado possui 22 seções. As novas opções são opcionais e vêm ativas, com instruções editáveis. Uma nova versão em rascunho é criada com o próximo número disponível, mantendo a versão original aprovada, personalizações e guias existentes. No banco local, foi disponibilizada a versão 2; a versão 1 continua aprovada até a professora revisar e aprovar a atualização pela interface.

Acrescentado teste de atualização de um banco da Fase 2A com rascunho personalizado: preserva as versões anteriores, cria a atualização com o número seguinte e não duplica a versão ao reiniciar. Os demais testes foram ajustados para distinguir a atualização em rascunho da versão original aprovada.

Validação desta atualização: **8 testes da API e 4 testes de interface aprovados**, build Vite e checagem de formatação aprovados. A API local confirmou a versão 2 em rascunho com 22 seções e a versão 1 aprovada com 17 seções. O teste de interface aguarda a versão selecionada no histórico antes de editar e usa uma espera compatível com as respostas HTTP do ambiente de teste.
