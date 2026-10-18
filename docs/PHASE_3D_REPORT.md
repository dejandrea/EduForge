# Fase 3D — Central de Produção de Conteúdo

## Base e acesso

A branch validada com a Fase 3C era `feat/fase-3c-experiencia-codigo`, commit `df78141`, também sincronizado com a origem. A branch `feat/fase-3d-central-producao` foi criada diretamente dessa implementação, sem presumir incorporação à `main`.

Acesso: menu lateral **Produção de Conteúdo**, rota `/production`. As demais entradas administrativas e rotas anteriores continuam funcionando. A central solicita projeto e aula, permite seleção automática quando há somente uma opção e lembra a última seleção em `sessionStorage` durante a sessão.

## Linha do tempo e reutilização

1. **Planejamento**: aula, roteiro efetivamente vinculado, versão/estado e conteúdo previsto; consulta e complementação do cadastro, roteiro, referências e materiais dentro da central.
2. **Guia pedagógico**: componente `Guides` existente, incluindo criação manual, geração com IA, regeneração de seção, editor, versões, transições e aprovação humana.
3. **Código da aula**: `CodeWorkspace` da Fase 3C, preservando preparação, fontes, permissões, prévia/custos, propostas de IA, comparação, alterações e aprovação. A decisão de código não aplicável é explícita, justificada e persistida; não remove materiais nem cria aprovações.
4. **Testes e capturas**: galeria com miniaturas ampliáveis, descrição/tipo/status/data/versão, seleção individual ou todas, filtro sem vínculo, consulta das etapas do guia e associação em lote. `CodeEvidence` e `CodeManualTest` mantêm cadastro, inspeção, revisão humana e upload existentes. A lista detalhada de revisão é secundária para evitar repetir todos os cartões de captura na área principal.
5. **Documento final**: identifica guia, código, capturas/vínculos, referências, materiais e pendências. Não há exportador DOCX, arquivo final, publicação ou estado de documento exportado.

Cada etapa mostra número, status, descrição, resumo, ação e controle de expansão. A próxima ação abre a etapa correspondente; outras etapas continuam acessíveis. Os painéis visitados permanecem montados mesmo recolhidos. As aulas visitadas também são mantidas ao trocar aula/projeto, preservando textos e arquivos ainda não enviados durante a visita à central.

Componentes novos: `Production`, `ProductionPlanning`, `ProductionEvidence`, `ProductionDocument`, com CSS separado. `RecordForm` foi extraído do cadastro existente, com callback de salvamento embutido e IDs únicos. As páginas reutilizadas aceitam IDs fornecidos por props, mantendo o uso por parâmetros das rotas administrativas. `VersionWorkspace` pode informar a versão em consulta à central. A central é um módulo carregado sob demanda.

Conforme o ajuste solicitado durante a implementação, a galeria fica em **uma coluna** e o painel das etapas ocupa aproximadamente **dois terços** da largura em desktop. Os painéis se empilham abaixo de 900 px e têm rolagem própria para evitar uma página excessivamente longa.

## Cálculo de progresso e próxima ação

`productionProgress` deriva estados do roteiro vinculado, guia exato em consulta, código selecionado, tarefas de IA, evidências, vínculos ativos e decisão persistida de aplicabilidade. Não há checkboxes de conclusão ou cópia paralela de conteúdo para alimentar o progresso.

- Planejamento requer roteiro relacionado aprovado.
- Guia em rascunho ou revisão não é considerado aprovado.
- Código aprovado é tratado separadamente de testes ou execução.
- Relatos manuais são identificados pelo tipo `test` ou pela indicação explícita de teste/validação manual, preservando sua origem e limitações. Uma observação automática da importação não equivale a teste manual.
- Evidências enviadas e aprovadas permanecem distintas. Relatos externos `test/build`, que não podem receber aprovação de execução pelo serviço anterior, não são convertidos em testes executados.
- Cobertura usa IDs distintos de evidências, somente nos vínculos ativos da versão exata do guia. Dois vínculos para uma mesma evidência cobrem uma evidência.
- Preparação documental depende do planejamento/guia/código aplicável e registros organizados/revisados. A etapa de documento permanece bloqueada pela ausência real do exportador/arquivo DOCX, mesmo com materiais organizados.

A recomendação é determinística e considera organização de evidências já registradas antes de pedir novos registros. Sem planejamento válido, orienta revisá-lo; sem guia, criar/gerar; com guia em rascunho, revisar; com código ausente ou pendente, preparar/revisar; com código aprovado e testes ainda não registrados, registrar o teste; com registros já existentes sem vínculo, organizá-los; depois, revisar registros e consultar os materiais finais. Todas as etapas podem ser abertas manualmente para trabalhos paralelos.

Mutações bem-sucedidas atualizam o resumo com um evento local do cliente; tarefas pendentes são acompanhadas por polling. Reabrir a central/reiniciar o app recupera progresso dos dados gravados.

## Etapas reais e operação em lote

O guia traz seus títulos de seção a partir da versão de template correspondente. A extração determinística reconhece cabeçalhos Markdown e linhas numeradas, sem chamadas à IA. O conteúdo original fica disponível para consulta; sem marcadores confiáveis, a professora escolhe o título real da seção ou nomeia explicitamente a atividade. Não são inventadas etapas ou feitos vínculos por inferência automática.

Para organizar capturas: escolher guia/versão de código → selecionar seção → consultar trecho e escolher ou confirmar etapa → selecionar evidências ou **Selecionar todas** → **Confirmar vínculos selecionados**. Uma confirmação abrange todo o lote. É possível repetir o processo para outra etapa ou associar a mesma evidência a mais de uma etapa.

O backend valida aula, guia, seção, revisão e todas as evidências, dentro de uma transação. Se algum ID for inválido ou pertencer a outra revisão, nada do lote é gravado. Repetições da mesma combinação ativa de revisão, guia, seção, etapa, arquivo e evidência retornam o vínculo existente. Vínculos anteriores e duplicatas legadas não são apagados.

Para corrigir: **Corrigir vínculo** → informar motivo → confirmar revogação → associar novamente à etapa correta. O vínculo original fica no histórico e a correção não apaga a evidência nem modifica o guia. Uma associação revogada pode ser feita novamente, criando uma nova entrada rastreável.

## Persistência e endpoints

A migration aditiva `008_production_center.sql` é necessária para persistir decisões de não aplicabilidade e revogações auditadas. Cria `lesson_code_decisions` e `code_guide_link_revocations`, índices e triggers de imutabilidade. Não modifica o conteúdo das migrations anteriores ou reseta dados. As consultas usuais de vínculos deixam de apresentar revogados, enquanto o histórico os preserva.

Novas rotas sob `/api`:

| Método | Rota | Finalidade |
|---|---|---|
| GET | `/lessons/:id/production` | Agregado de leitura, progresso e próxima ação; permite consultar `guide_id`/`revision_id` da mesma aula |
| POST | `/lessons/:id/code-decision` | Registrar decisão justificada e confirmada sobre aplicabilidade |
| POST | `/code/revisions/:id/guide-links/batch` | Lote atômico confirmado com resultado por evidência |
| POST | `/code/guide-links/:id/revoke` | Revogar vínculo com motivo, preservando a trilha |
| GET | `/code/revisions/:id/guide-link-history` | Consultar vínculos originais e revogações |

As rotas de geração, orçamento, arquivos, revisão, evidências e aprovações anteriores continuam sendo usadas. Credenciais ficam no backend, e a central não chama IA para calcular progresso, listar registros ou extrair etapas. Código não é executado e capturas não são produzidas automaticamente.

## Verificação e cenário Frogger

Fixtures isoladas reproduzem: Frogger Game/Aula 3, roteiro relacionado, guia v3 em rascunho, código da Aula 2 importado, revisão 1, proposta de código por provedor simulado, revisão 2 aprovada, teste manual no Code.org, cinco capturas e dois vínculos para o mesmo teste. Ao abrir a central, são exibidos seis registros, uma evidência coberta, cinco pendentes de vínculo, código aprovado e guia em rascunho; a ação é **Organizar evidências**.

Testes da API cobrem esse agregado, ausência de chamadas adicionais à IA, extração de etapas ambíguas, transação/rollback do lote, IDs inválidos, seção inválida, revisão/aula divergentes, normalização de IDs repetidos, associação a várias etapas, preservação de vínculos antigos, revogação auditada e reaplicação da migration/reabertura do banco com decisão persistida.

Testes DOM usam o servidor de teste e provedores simulados: seleção de projeto/aula, dados existentes, galeria, seleção múltipla/todas, confirmação cancelada/confirmada, cobertura, abrir guia dentro da central, preservação de guia e PNG ao trocar aula/projeto, remontagem com seleção/progresso/decisão persistidos, etapa ambígua nomeada, correção com motivo, edição/revisão/aprovação/regeneração do guia, erro e nova tentativa de carregamento, expansão/recolhimento e foco de teclado. Regressões das fases anteriores também são executadas.

Resultados finais: **51 testes da API aprovados** (quatro novos da Fase 3D) e **23 testes da interface aprovados** (seis novos da Fase 3D), incluindo a regressão anterior. `npm run build`, `npm run format:check` e `git diff --check` aprovados. O build carrega a central em um chunk próprio; permanecem apenas os avisos já conhecidos do React Router/Zod. Nenhum crédito pago ou dado do banco real do piloto foi usado nas fixtures.

## Limitações e pendências

O inventário de automação retornou `apps: []` e `browsers: []`; não houve navegador controlável para revisão visual automatizada de desktop/mobile. O ajuste de colunas atende à referência enviada pela usuária, mas a inspeção visual assistida final permanece pendente. CSS responsivo e interação por DOM foram implementados e verificados no escopo disponível.

Somente a seleção é lembrada na sessão. Rascunhos ainda não enviados permanecem em memória durante a visita à central; recarregar a página, fechar a aba ou sair da central não grava esses rascunhos automaticamente. O progresso salvo permanece correto. O agregado usa registros de arquivos já armazenados; a verificação de corrupção/ausência física de blobs continua sendo feita ao acessá-los pelos serviços existentes.

A extração de etapas não interpreta semanticamente texto livre. A professora deve confirmar a atividade em casos ambíguos. O lote limita-se a 100 IDs por requisição, com resposta por evidência. Revogações não limpam evidências ou blobs. Legados duplicados são preservados; novos lotes não multiplicam vínculos idênticos.

Não houve commit, push, merge, deploy ou publicação nesta implementação. DOCX permanece para a Fase 4.
