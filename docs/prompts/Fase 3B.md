# EduForge — Fase 3B: Geração assistida de código com IA

## Contexto e objetivo

Estamos desenvolvendo o **EduForge — Da ideia à aula pronta**, uma plataforma local-first para planejamento e produção de aulas de programação.

Repositório: `dejandrea/EduForge`

Branch-base: `feat/fase-3-codigo-capturas`

A Fase 3 já está implementada, testada e versionada:

- `2400dc7` — Requisitos da Fase 3.
- `9f0dfb7` — Implementação, testes e documentação.

**Não reimplementar a Fase 3.**

Durante o teste real, a professora importou com sucesso o repositório `profAndreaFranca/Frogger-Game---pt2`, branch `master`, como ponto de partida para a Aula 3.

O EduForge criou a Revisão 1, registrou o commit de origem, reconheceu `README.md` e `script.js` e disponibilizou a edição manual isolada.

Entretanto, identificamos uma necessidade funcional:

**A plataforma deve utilizar o guia pedagógico da aula e o código existente para gerar, com IA, uma proposta de evolução do projeto.**

O resultado deve ser uma proposta de alterações revisável, nunca uma modificação automática do repositório original.

## 1. Preparação e preservação

Antes de implementar:

1. Inspecione a branch atual e confirme os commits existentes.
2. Leia a documentação e o código real das Fases 2B, 2C e 3.
3. Crie a branch `feat/fase-3b-geracao-codigo-ia` a partir da Fase 3 concluída.
4. Preserve todas as migrations e todos os dados existentes.
5. Não modifique commits anteriores.
6. Não faça merge, push, deploy ou publicação sem autorização.
7. Não consuma créditos reais de IA durante o desenvolvimento ou os testes.

Reutilize os serviços existentes.

## 2. Integração com a Fase 3

A implementação atual contém:

- `apps/api/src/code/service.js`
- `apps/api/src/code/routes.js`
- `apps/api/src/code/storage.js`
- `apps/api/src/code/inspection.js`
- `apps/web/src/pages/CodeWorkspace.jsx`
- `apps/web/src/components/CodeFiles.jsx`
- `apps/web/src/components/CodeEvidence.jsx`
- `apps/web/src/components/CodeGuideLinks.jsx`
- `packages/shared/src/code.js`

O serviço de código já oferece:

- Preparações associadas à aula.
- Revisões imutáveis com manifesto e SHA-256.
- Leitura de arquivos textuais.
- Propostas de alteração.
- Comparação de revisões.
- Aprovação ou rejeição humana.
- Inspeção estática.
- Evidências e vínculos com guias.

**A geração com IA deve produzir propostas compatíveis com esse modelo, sem criar outro sistema paralelo de versionamento.**

## 3. Nova funcionalidade na interface

Adicionar à tela **Código e capturas** uma seção:

### Gerar evolução do código com IA

A professora deverá selecionar:

- Revisão de código de origem.
- Versão do guia pedagógico da mesma aula.
- Arquivos que a IA poderá consultar.
- Arquivos que a IA poderá propor modificar.
- Modelo de IA cadastrado.
- Instruções técnicas adicionais, opcionais.

Apresentar também:

- Objetivo da aula.
- Resumo dos arquivos selecionados.
- Seções do guia que serão utilizadas.
- Estimativa de custo e orçamento disponível.
- Aviso de que a proposta não será executada.
- Confirmação explícita antes da chamada paga.

Botão principal:

**Gerar proposta de código com IA**

A opção deve aparecer somente quando existir uma preparação pronta e uma revisão de código válida.

Se não houver guia, modelo, credencial ou orçamento disponível, explicar exatamente o que falta e oferecer um caminho para resolver.

Não usar botões desabilitados sem justificativa.

## 4. Seleção do guia pedagógico

A IA deverá utilizar uma versão exata do guia da aula.

Permitir selecionar guias em rascunho, revisão ou aprovados, identificando claramente seus estados.

Para guias em rascunho, informar que o conteúdo ainda pode mudar.

O contexto deve incluir apenas as seções necessárias, principalmente:

- Objetivos e propósito da aula.
- Conceitos novos e revisados.
- Estrutura do projeto.
- Condução passo a passo.
- Atividades e resultados esperados.
- Testes e depuração.
- Continuidade pedagógica.

Não assumir IDs ou títulos fixos das seções: utilizar o template real e seus identificadores estáveis.

Registrar o ID exato da versão do guia e um snapshot dos trechos efetivamente enviados.

Não exigir aprovação do guia para iniciar a geração, mas nunca alterar o guia durante esse processo.

## 5. Seleção dos arquivos

A professora deverá escolher explicitamente quais arquivos serão enviados à IA.

Requisitos:

- Exibir caminho e tamanho.
- Permitir seleção individual.
- Respeitar limites de contexto.
- Recusar binários.
- Não enviar arquivos não selecionados.
- Não enviar credenciais.
- Não enviar automaticamente todo o repositório.
- Mostrar aviso sobre informações sensíveis que possam existir dentro de arquivos comuns.
- Permitir selecionar arquivos para leitura sem necessariamente autorizar sua modificação.

No projeto Frogger Game, o caso inicial será o arquivo `script.js`.

Os arquivos de referência deverão pertencer à revisão escolhida.

## 6. Instruções de geração

Construir um prompt técnico estruturado com:

1. Contexto do projeto e da aula.
2. Estado atual do código.
3. Objetivos pedagógicos.
4. Etapas de desenvolvimento previstas no guia.
5. Arquivos disponíveis e permissões de alteração.
6. Restrições da tecnologia utilizada.
7. Formato esperado das alterações.
8. Critérios de qualidade.

A IA deverá:

- Preservar funcionalidades existentes que não precisam mudar.
- Implementar apenas o escopo da aula.
- Respeitar a progressão pedagógica.
- Evitar antecipar conteúdos de aulas futuras.
- Produzir código compreensível para alunos.
- Preferir mudanças pequenas e rastreáveis.
- Explicar cada alteração.
- Identificar dúvidas e dependências.
- Não inventar arquivos, bibliotecas ou APIs.
- Não declarar que executou testes.
- Não afirmar que o código funciona sem validação real.

### Atenção ao Code.org Game Lab

O projeto piloto utiliza JavaScript no ambiente Game Lab.

Funções como `createSprite`, `setAnimation`, `drawSprites`, `keyWentDown` e `isTouching` pertencem ao contexto dessa plataforma.

A IA deve preservar essa compatibilidade e não converter automaticamente o projeto para React, Canvas HTML ou Node.js.

O código gerado deve ser utilizável no ambiente original, sujeito à validação manual da professora.

Não presumir que animações e assets estejam presentes no repositório apenas porque aparecem em chamadas `setAnimation`.

## 7. Saída estruturada da IA

Utilizar schema validado com Zod.

A resposta deverá conter:

- Resumo da proposta.
- Lista de arquivos alterados.
- Caminho de cada arquivo.
- Operação: criar, modificar ou remover.
- Conteúdo completo proposto para arquivos criados/modificados.
- Justificativa de cada alteração.
- Etapas do guia relacionadas.
- Observações técnicas.
- Pontos que precisam de verificação manual.

Não utilizar somente um bloco de Markdown como resultado.

A resposta deve ser validada antes de ser disponibilizada como proposta.

Verificar:

- Paths seguros.
- Arquivos autorizados.
- Operações permitidas.
- Limites de tamanho.
- Ausência de duplicações.
- Coerência com a revisão de origem.
- Estrutura JSON.
- Integridade das referências.

Não inventar conteúdo para preencher respostas incompletas.

Caso a resposta seja inválida, registrar uma falha compreensível e não criar revisão parcial.

## 8. Integração com o sistema de IA existente

Reutilizar a infraestrutura das Fases 2B e 2C:

- Provedores OpenAI/Gemini.
- Catálogo de modelos.
- Credenciais exclusivamente no backend.
- Configurações de temperatura e tokens.
- Orçamento mensal.
- Reserva de orçamento.
- Estimativa de custos.
- Histórico de uso.
- Fila persistida.
- Worker.
- Cancelamento.
- Idempotência.
- Tratamento de interrupções.

Inspecione os contratos atuais antes de estendê-los.

Não criar uma segunda fila independente sem necessidade.

A geração de código deve aparecer no histórico de consumo da IA e compartilhar o orçamento existente.

Não realizar retries pagos automáticos.

Em caso de falha após consumo, registrar o custo conhecido e manter o tratamento existente para custos incertos.

A professora deverá autorizar novamente qualquer tentativa paga.

## 9. Persistência das propostas

Criar migration incremental `007`, preservando as anteriores.

Armazenar, conforme necessário:

- ID da aula.
- ID da preparação.
- ID da revisão de origem.
- Digest SHA-256 da revisão.
- ID e estado da versão do guia.
- Snapshot dos trechos selecionados.
- Arquivos enviados.
- Arquivos autorizados para alteração.
- Modelo e provedor.
- Instruções adicionais.
- ID da tarefa de IA.
- Estado da proposta.
- Resposta validada.
- Custo estimado ou registrado.
- Datas e decisões humanas.

As propostas devem ser rastreáveis e preservadas.

Não duplicar grandes conteúdos desnecessariamente quando o armazenamento por hash existente puder ser reutilizado com segurança.

## 10. Fluxo de revisão humana

Quando a geração terminar:

1. Exibir resumo da proposta.
2. Apresentar cada arquivo afetado.
3. Mostrar código original e código proposto.
4. Exibir justificativa e vínculo pedagógico.
5. Permitir aceitar ou rejeitar a proposta.
6. Permitir ajustes manuais antes de gravar a revisão.
7. Exigir confirmação para criar uma nova revisão.

**A IA nunca deve aprovar uma revisão.**

A aceitação da proposta deve criar uma nova revisão em rascunho, reutilizando o mecanismo da Fase 3.

A revisão original permanece intacta.

Não sobrescrever uma revisão já aprovada.

A professora poderá então utilizar o fluxo existente para inspecionar, registrar evidências e aprovar a nova revisão.

## 11. Proteção contra alterações concorrentes

A proposta deve ficar vinculada ao digest da revisão de origem.

Antes de aplicá-la:

- Conferir se a revisão de origem ainda existe.
- Verificar seu digest.
- Conferir se a proposta já foi aplicada.
- Impedir aplicação duplicada.
- Não substituir alterações manuais não salvas.
- Exigir confirmação se outra revisão tiver sido criada posteriormente.

Se houver divergência, explicar o conflito e oferecer a possibilidade de gerar uma nova proposta.

Não fazer merge automático de alterações conflitantes.

## 12. Interface de acompanhamento

Mostrar os estados:

- Aguardando autorização.
- Na fila.
- Gerando.
- Proposta disponível.
- Falhou.
- Cancelada.
- Proposta aceita.
- Proposta rejeitada.
- Revisão criada.

Quando disponível, apresentar:

- Modelo utilizado.
- Tempo de geração.
- Tentativas.
- Tokens.
- Custo estimado.
- Arquivos afetados.
- Guia e revisão de origem.

Não mostrar mensagens genéricas quando for possível identificar a causa da falha.

Não expor prompts internos completos contendo código sensível, credenciais ou dados privados nos logs.

## 13. Testes automatizados

Criar testes para:

- Geração com provedor simulado.
- Seleção explícita de arquivos.
- Recusa de binários.
- Proteção de credenciais.
- Limites de contexto.
- Validação do schema.
- Paths inválidos.
- Arquivos não autorizados.
- Resposta incompleta.
- Cancelamento.
- Falha do provedor.
- Controle de orçamento.
- Registro de consumo.
- Idempotência.
- Recuperação após reinício.
- Preservação da revisão original.
- Aplicação única da proposta.
- Rejeição humana.
- Conflitos de revisão.
- Associação correta ao guia.
- Compatibilidade com o código do Game Lab.
- Regressão das Fases 1, 2A, 2B, 2C e 3.

Todos os testes devem usar provedores simulados.

Não chamar APIs pagas nos testes.

## 14. Documentação

Atualizar:

- `README.md`
- `docs/ROADMAP.md`
- `docs/ARCHITECTURE.md`

Criar:

- `docs/PHASE_3B_REPORT.md`

Documentar:

- Funcionalidades implementadas.
- Arquitetura.
- Migrations.
- Endpoints.
- Fluxo de utilização.
- Integração com IA.
- Custos e segurança.
- Testes executados.
- Limitações.
- Pendências.
- Instruções para testar com Frogger Game.

Preservar o relatório original da Fase 3.

## 15. Critérios de aceite

A implementação será considerada concluída quando a professora conseguir:

1. Abrir a Aula 3 do Frogger Game.
2. Selecionar a Revisão 1 importada da Aula 2.
3. Selecionar o guia pedagógico da Aula 3.
4. Selecionar `script.js` para leitura e alteração.
5. Escolher um modelo de IA.
6. Visualizar e autorizar a chamada paga.
7. Receber uma proposta estruturada de evolução do código.
8. Comparar o código original com o código gerado.
9. Revisar e aceitar ou rejeitar a proposta.
10. Criar uma nova revisão sem alterar a anterior.
11. Consultar o histórico da geração e seu custo.
12. Continuar utilizando as evidências e aprovações da Fase 3.

A geração não deverá modificar automaticamente o GitHub nem declarar validação funcional.

## 16. Restrições finais

- Não reimplementar a Fase 3.
- Não implementar exportação DOCX.
- Não implementar push automático para GitHub.
- Não executar código gerado.
- Não habilitar Playwright sem isolamento seguro.
- Não adicionar chamadas pagas automáticas.
- Não aprovar código sem intervenção humana.
- Não alterar dados reais do piloto durante testes.
- Não fazer commit, push ou merge sem autorização.

**Prioridade:** produzir código pedagogicamente coerente, com controle de custos, rastreabilidade e revisão humana.

Ao concluir, apresente um relatório com os arquivos alterados, migrations, endpoints, testes executados, limitações e instruções para o teste real da Aula 3 do Frogger Game.