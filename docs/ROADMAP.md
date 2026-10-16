# Roadmap

## Fase 1 — Fundação

Implementada: monorepo; API local; migrations SQLite; CRUD de projetos e aulas; dashboard; layout escuro responsivo; validações; confirmação de exclusão; testes de integração; documentação Windows.

Validação funcional: cadastrar projeto e aulas, editar, excluir e reabrir banco sem perda de registros. Dados de teste ficam restritos a bancos temporários.

## Fase 2A — Roteiros, templates e versionamento pedagógico

Implementada: versões de roteiro e sequência ordenada, dependências pedagógicas, aprovação explícita, comparação básica, vínculo com aulas existentes, templates com seções configuráveis, guias criados manualmente e histórico imutável de aprovações. Migration incremental preserva a Fase 1. Sem IA.

## Fase 2B — Geração pedagógica com IA

Não iniciada. Antes de implementar, definir o escopo em prompt próprio: provedores, credenciais, custos, contexto pedagógico, tarefas retomáveis e revisão humana. A geração deverá partir das referências versionadas da Fase 2A. Iniciar somente mediante solicitação.

## Fase 3 — Código e capturas

Associação de repositórios, cópias isoladas, comandos permitidos, evidências de testes e capturas. Revisão obrigatória antes de aplicar alterações.

## Fase 4 — Documentos

Worker Python com python-docx, templates, imagens vinculadas e revisão visual dos documentos exportados.

## Fase 5 — Materiais e integrações

Prompts de apresentações, materiais complementares, histórico de tarefas e custos e organização no Drive. Publicações e sobrescritas exigem aprovação. Sem automação não oficial do NotebookLM.
