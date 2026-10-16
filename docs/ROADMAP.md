# Roadmap

## Fase 1 — Fundação

Implementada: monorepo; API local; migrations SQLite; CRUD de projetos e aulas; dashboard; layout escuro responsivo; validações; confirmação de exclusão; testes de integração; documentação Windows.

Validação funcional: cadastrar projeto e aulas, editar, excluir e reabrir banco sem perda de registros. Dados de teste ficam restritos a bancos temporários.

## Fase 2A — Roteiros, templates e versionamento pedagógico

Implementada: versões de roteiro e sequência ordenada, dependências pedagógicas, aprovação explícita, comparação básica, vínculo com aulas existentes, templates com seções configuráveis, guias criados manualmente e histórico imutável de aprovações. Migration incremental preserva a Fase 1. Sem IA.

## Fase 2B — Geração pedagógica com IA

Implementada conforme `docs/prompts/Fase 2B.md`: acesso direto a Roteiros no menu; OpenAI/Gemini com modelos e preços configuráveis; credenciais somente no backend; geração estruturada e regeneração de uma seção; worker separado com tarefas persistidas, cancelamento e prevenção de repetição; orçamento, uso e custos estimados. Editor, histórico e aprovação reutilizam a Fase 2A. Testes usam provedores simulados, sem créditos reais. Validação com credenciais e avaliação pedagógica reais ficam para uso assistido da professora; ver `PHASE_2B_REPORT.md`.

## Fase 3 — Código e capturas

Associação de repositórios, cópias isoladas, comandos permitidos, evidências de testes e capturas. Revisão obrigatória antes de aplicar alterações.

## Fase 4 — Documentos

Worker Python com python-docx, templates, imagens vinculadas e revisão visual dos documentos exportados.

## Fase 5 — Materiais e integrações

Prompts de apresentações, materiais complementares, histórico de tarefas e custos e organização no Drive. Publicações e sobrescritas exigem aprovação. Sem automação não oficial do NotebookLM.
