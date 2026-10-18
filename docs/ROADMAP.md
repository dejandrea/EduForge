# Roadmap

## Fase 1 — Fundação

Implementada: monorepo; API local; migrations SQLite; CRUD de projetos e aulas; dashboard; layout escuro responsivo; validações; confirmação de exclusão; testes de integração; documentação Windows.

Validação funcional: cadastrar projeto e aulas, editar, excluir e reabrir banco sem perda de registros. Dados de teste ficam restritos a bancos temporários.

## Fase 2A — Roteiros, templates e versionamento pedagógico

Implementada: versões de roteiro e sequência ordenada, dependências pedagógicas, aprovação explícita, comparação básica, vínculo com aulas existentes, templates com seções configuráveis, guias criados manualmente e histórico imutável de aprovações. Migration incremental preserva a Fase 1. Sem IA.

## Fase 2B — Geração pedagógica com IA

Implementada conforme `docs/prompts/Fase 2B.md`: acesso direto a Roteiros no menu; OpenAI/Gemini com modelos e preços configuráveis; credenciais somente no backend; geração estruturada e regeneração de uma seção; worker separado com tarefas persistidas, cancelamento e prevenção de repetição; orçamento, uso e custos estimados. Editor, histórico e aprovação reutilizam a Fase 2A. Testes usam provedores simulados, sem créditos reais. Validação com credenciais e avaliação pedagógica reais ficam para uso assistido da professora; ver `PHASE_2B_REPORT.md`.

## Fase 2C — Materiais existentes e memória pedagógica

Implementada: referências por projeto; arquivos locais por aula e extração textual versionada; conclusão de aulas importadas sem guia; resumos com evidências e aprovação humana; análise opcional reutilizando a infraestrutura de IA; consulta explícita de arquivos GitHub por commit; seleção limitada de contexto e manifesto das fontes usadas. Sem OCR, execução de código ou importação remota do Drive. Ver `PHASE_2C_REPORT.md`.

## Fase 3 — Código e capturas

Implementada a camada de inspeção estática: preparações Git por aula usando referências existentes, cópias versionadas por hash, propostas e comparação de arquivos, aprovação humana, evidências, capturas PNG manuais e vínculos com etapas/versionamento de guias. Execução e capturas automáticas explicitamente indisponíveis sem isolamento adequado; não há publicação no GitHub. Validação assistida com o repositório real e inspeção visual pendentes. Ver `PHASE_3_REPORT.md`.

## Fase 3B — Geração assistida de código com IA

Implementada: seleção de guia/seções e arquivos com permissões explícitas; prévia/custo antes da autorização paga; proposta estruturada, comparação, ajustes e decisão humana; criação única de revisão em rascunho com proteção contra conflitos. Reutiliza worker, provedores e orçamento existentes. Sem execução do código, aprovação automática ou publicação. Teste real com a conta/modelo da professora e validação no Game Lab pendentes. Ver `PHASE_3B_REPORT.md`.

## Fase 3C — Experiência de código e IA

Implementada a organização em Visão geral, Código, Evidências e Histórico, com próxima ação derivada dos registros existentes, seleção de código já preparado e versão mais recente, formulário de teste manual com captura opcional e sugestões confirmadas de vínculo ao guia. Formulários preservados entre abas, navegação por teclado e detalhes técnicos secundários. Serviços, migrations e contratos de API preservados. Inspeção visual assistida com a professora pendente; ver `PHASE_3C_REPORT.md`.

## Fase 3D — Central de Produção de Conteúdo

Implementada a central `/production`, com projeto/aula, linha do tempo e próxima ação derivadas de dados existentes. Reutiliza planejamento, guias, código, geração de IA e testes; acrescenta organização de evidências por etapas reais do guia, seleção múltipla e vínculos transacionais em lote, prevenção de duplicatas e revogação auditada. Código não aplicável é uma decisão persistida com justificativa. Prévia dos materiais finais sem gerar DOCX. Galeria em uma coluna e guia com área ampliada. Validação automatizada e pendências de inspeção visual descritas em `PHASE_3D_REPORT.md`.

## Fase 4A — Documentos pedagógicos

Implementação local com configurações versionadas por projeto/aula, OAuth Google, validação de modelo/pasta, cópia nativa, preenchimento OOXML com textos/código/capturas, exportação DOCX, snapshots e retomada conservadora. Reutiliza Express/SQLite/armazenamento existentes; não acrescenta worker Python. Aceitação pendente de conexão OAuth real e piloto visual. Ver `PHASE_4_REPORT.md`.

## Fase 4B — Apresentações

Não iniciada. Após validar 4A: apresentações PowerPoint editáveis, biblioteca de imagens, logo, mascote, identidade por projeto e personalização por prompt, conforme `prompts/Fase 4.md`.

## Fase 5 — Materiais e integrações

Prompts de apresentações, materiais complementares, histórico de tarefas e custos e organização no Drive. Publicações e sobrescritas exigem aprovação. Sem automação não oficial do NotebookLM.
