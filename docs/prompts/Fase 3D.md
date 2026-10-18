# EduForge — Fase 3D: Central de Produção de Conteúdo

## 1. Contexto

Estamos desenvolvendo o **EduForge — Da ideia à aula pronta**, plataforma local-first de produção de materiais pedagógicos com auxílio de inteligência artificial.

Repositório: `dejandrea/EduForge`.

As Fases 1, 2A, 2B, 2C, 3 e 3B já foram implementadas. A Fase 3C foi dedicada à simplificação da experiência de código e IA.

**Antes de iniciar, identifique a branch mais recente que contém efetivamente a Fase 3C.** Não presuma que ela foi incorporada à `main` ou à branch da Fase 3B.

Criar a branch:

`feat/fase-3d-central-producao`

a partir da implementação mais recente e validada.

Não reimplementar serviços existentes.

## 2. Objetivo central

Criar uma nova área chamada **Produção de Conteúdo**, acessível pelo menu lateral.

A professora deve conseguir produzir uma aula completa em uma única página, acompanhando uma linha do tempo que mostre:

- O que já foi concluído.
- O que está em andamento.
- O que falta realizar.
- Qual é a próxima ação recomendada.
- Onde realizar essa ação, sem precisar navegar por diversas páginas.

**Princípio: a complexidade fica na arquitetura; a simplicidade fica na interface.**

## 3. Preservar a navegação administrativa

Manter as áreas atuais do menu lateral para:

- Projetos.
- Aulas.
- Roteiros pedagógicos.
- Templates.
- Referências e materiais.
- Configurações e modelos de IA.

Não redesenhar essas telas nesta fase.

Adicionar somente a nova entrada:

**Produção de Conteúdo**

As telas antigas devem continuar funcionando, inclusive seus links existentes.

A Central de Produção será o caminho principal para criar o conteúdo das aulas, não uma substituição dos cadastros administrativos.

## 4. Seleção de projeto e aula

Ao abrir Produção de Conteúdo:

1. Selecionar o projeto.
2. Selecionar a aula.
3. Carregar automaticamente os dados existentes.
4. Mostrar o título, número, objetivos e estado da aula.
5. Recuperar o progresso real.

Quando houver somente um projeto ou aula elegível, permitir pré-seleção.

Preservar a última seleção durante a navegação, quando apropriado.

A troca de projeto ou aula não pode descartar edições não salvas.

Não criar cópias dos dados apenas para alimentar a central.

## 5. Linha do tempo

Implementar uma linha do tempo vertical com etapas expansíveis:

### Etapa 1 — Planejamento

Exibir:

- Aula cadastrada.
- Roteiro pedagógico relacionado.
- Versão e estado do roteiro.
- Objetivos e conteúdos previstos.
- Referências e materiais disponíveis.

Permitir consultar e complementar informações necessárias sem sair da central.

A aprovação do roteiro continua seguindo as regras existentes.

### Etapa 2 — Guia pedagógico

Exibir:

- Versões do guia.
- Estado atual.
- Geração com IA.
- Regeneração de seções.
- Edição manual.
- Revisão.
- Aprovação.

Permitir executar essas ações na própria etapa, reutilizando componentes e serviços existentes.

Não criar uma segunda implementação de geração de guias.

### Etapa 3 — Código da aula

Exibir:

- Código de partida.
- Repositório e preparação.
- Revisão selecionada.
- Geração de código com IA.
- Comparação de alterações.
- Revisão humana.
- Aprovação.

Reutilizar integralmente os serviços das Fases 3 e 3B.

Quando a aula não exigir código, permitir marcar a etapa como não aplicável, com justificativa e sem falsificar aprovações.

### Etapa 4 — Testes e capturas

Exibir:

- Testes registrados.
- Capturas existentes.
- Estado de revisão das evidências.
- Vínculos com o guia.
- Evidências ainda não vinculadas.

Permitir registrar testes e capturas na própria etapa.

Criar uma interface visual para organizar evidências por etapa do guia, incluindo seleção múltipla.

### Etapa 5 — Documento final

Preparar a etapa para a futura Fase 4:

- Visualizar materiais que comporão o documento.
- Identificar guia, código e capturas selecionados.
- Mostrar pendências.
- Indicar que a exportação DOCX ainda não está disponível.

Não implementar a exportação DOCX nesta fase.

Não declarar a aula exportada ou o documento finalizado enquanto não existir um arquivo real.

## 6. Comportamento visual da linha do tempo

Cada etapa deve ter:

- Número.
- Título.
- Descrição curta.
- Ícone de status.
- Resumo do conteúdo existente.
- Ação principal.
- Botão de expandir/recolher.

Estados:

- Não iniciada.
- Em andamento.
- Aguardando revisão.
- Concluída.
- Não aplicável.
- Bloqueada por pendência real.

Abrir por padrão a etapa que exige a próxima ação.

Permitir abrir qualquer etapa manualmente.

Manter preferencialmente uma etapa aberta por vez, sem impedir consulta a etapas anteriores.

Evitar páginas excessivamente longas.

Em telas pequenas, utilizar um layout responsivo.

## 7. Progresso real, não artificial

Calcular os estados a partir dos registros existentes:

- Aula e roteiro.
- Guia e versões.
- Revisões de código.
- Aprovações.
- Evidências.
- Vínculos.
- Arquivos disponíveis.

Não usar checkboxes locais como fonte de verdade.

Não exigir que a professora marque manualmente algo que o sistema já consegue identificar.

Não confundir:

- Código aprovado com código executado.
- Teste manual relatado com teste automatizado.
- Evidência enviada com evidência aprovada.
- Guia em rascunho com guia aprovado.
- Vínculo existente com todas as evidências vinculadas.

O progresso deve continuar correto após recarregar a página ou reiniciar o EduForge.

## 8. Próxima ação recomendada

Criar uma lógica determinística que identifique a próxima ação útil.

Exemplos:

- Sem roteiro: revisar planejamento.
- Guia inexistente: gerar guia.
- Guia em rascunho: revisar guia.
- Código necessário e inexistente: preparar código.
- Proposta de IA disponível: revisar proposta.
- Revisão de código em rascunho: revisar código.
- Código aprovado e sem testes: registrar teste.
- Capturas registradas e não vinculadas: organizar evidências.
- Guia e materiais prontos: preparar documento final.

As recomendações devem considerar tarefas paralelas e não impor uma sequência rígida quando ela não for necessária.

**Não recomendar novamente ações já concluídas.**

No caso real do Frogger Game, se existem cinco capturas e um teste, a central não deve continuar dizendo apenas “Registrar teste e captura”.

Deve indicar as evidências existentes e apontar a organização dos vínculos pendentes.

## 9. Etapas reais do guia

Resolver o problema identificado no piloto:

Atualmente, a professora precisa lembrar e digitar manualmente o nome da etapa do guia.

Isso deve ser eliminado.

Carregar a versão exata do guia e apresentar:

- Título da seção.
- Conteúdo resumido.
- Etapas internas identificadas.
- Descrição da atividade.
- Arquivos e evidências já vinculados.

Utilizar os identificadores estáveis existentes.

Como os guias podem conter texto livre, não presumir que toda etapa tenha estrutura formal.

Implementar extração determinística quando houver marcadores confiáveis.

Quando a identificação automática for ambígua, apresentar o trecho do guia e permitir que a professora selecione ou nomeie a etapa.

Não inventar títulos ou etapas.

Não realizar chamadas pagas à IA para identificar etapas automaticamente.

## 10. Organização visual de capturas

Criar uma galeria de evidências:

- Miniatura.
- Nome ou descrição.
- Tipo.
- Status.
- Data.
- Revisão associada.
- Indicação de vínculo existente ou pendente.

Permitir abrir a imagem ampliada.

Oferecer seleção individual e **Selecionar todas**.

A professora deve conseguir escolher várias evidências e associá-las a uma etapa com uma única confirmação.

Também deve ser possível:

- Distribuir evidências entre etapas diferentes.
- Associar uma evidência a mais de uma etapa.
- Visualizar os vínculos existentes.
- Evitar duplicações.
- Corrigir um vínculo incorreto.
- Consultar as evidências ainda não vinculadas.

A interface deve mostrar as etapas do guia ao lado ou acima da galeria, conforme a largura disponível.

## 11. Vínculos em lote no backend

Inspecionar o contrato atual de vínculos.

Se necessário, implementar um endpoint de operação em lote que:

- Receba versão do guia, revisão de código, etapa e IDs das evidências.
- Valide a pertença de todos os registros à aula e à revisão correta.
- Valide a seção do guia.
- Rejeite IDs inválidos.
- Evite vínculos duplicados.
- Preserve vínculos anteriores.
- Utilize transação para garantir consistência.
- Retorne o resultado por evidência ou erro compreensível.

Não simular operação em lote apenas disparando várias requisições sem controle.

Se implementar remoção ou correção de vínculos, preservar rastreabilidade e impedir exclusão acidental de evidências ou versões do guia.

A professora deve confirmar os vínculos sugeridos antes de gravá-los.

## 12. Integração com as ferramentas existentes

A Central deve reutilizar:

- Geração e regeneração de guias.
- Revisão e aprovação de guias.
- Preparação de código.
- Geração de código com IA.
- Revisões e aprovação de código.
- Inspeção estática.
- Registro de testes.
- Capturas.
- Vínculos técnicos.

Não implementar telas duplicadas com regras diferentes.

Preferir extrair componentes reutilizáveis e adaptar os componentes existentes para uso embutido.

Preservar as rotas antigas.

Evitar colocar toda a lógica em um componente gigante.

Manter CSS separado por componente ou página.

## 13. Feedback e linguagem

Utilizar português claro.

Exemplos de mensagens:

- “Guia salvo. Próximo passo: revisar o conteúdo.”
- “Código aprovado. Agora registre como foi o teste.”
- “Você já tem 5 capturas e 1 teste.”
- “Existem 4 evidências ainda não vinculadas.”
- “Todos os materiais disponíveis estão organizados.”
- “A exportação para Word estará disponível na próxima fase.”

Exibir informações técnicas, como SHA-256, tokens, IDs internos e detalhes de commit, em áreas avançadas.

Não esconder mensagens de segurança, autorização de custos ou limitações funcionais.

Evitar botões desabilitados sem explicação.

## 14. Segurança e custos

Preservar:

- Credenciais somente no backend.
- Autorização explícita de chamadas pagas.
- Prévia de custo.
- Orçamento compartilhado.
- Histórico de consumo.
- Revisões imutáveis.
- Aprovações humanas.
- Isolamento do código.
- Ausência de execução automática insegura.

A Central não deve chamar a IA apenas para calcular progresso, sugerir próximos passos ou listar evidências.

Não executar código nem gerar capturas automáticas sem infraestrutura segura.

## 15. Cenário obrigatório de teste: Frogger Game — Aula 3

Utilizar fixtures que representem o seguinte estado, sem acessar ou modificar o banco real:

- Projeto Frogger Game.
- Aula 3 cadastrada.
- Roteiro pedagógico existente.
- Guia pedagógico v3 em rascunho.
- Código da Aula 2 importado de um repositório GitHub.
- Revisão 1 como código de partida.
- Proposta de código gerada com IA.
- Revisão 2 aprovada pela professora.
- Código testado manualmente no Code.org.
- Cinco capturas e um registro de teste.
- Dois vínculos técnicos já registrados.

Ao abrir a Central, a professora deve visualizar imediatamente:

1. Quais etapas já estão concluídas.
2. Que o código foi aprovado.
3. Que existem seis evidências registradas.
4. Quantas evidências ainda precisam de vínculo.
5. Que o guia v3 permanece em rascunho.
6. Qual é a próxima ação recomendada.

Não presumir que os dois vínculos correspondem a duas evidências diferentes; calcular a cobertura usando IDs distintos.

A professora deve conseguir organizar as evidências restantes e abrir a revisão do guia sem sair da Central.

## 16. Testes automatizados

Implementar testes para:

- Seleção de projeto e aula.
- Carregamento de dados existentes.
- Cálculo de progresso.
- Próxima ação.
- Estados concluídos, pendentes e não aplicáveis.
- Recarregamento da página.
- Expansão e recolhimento de etapas.
- Troca de aula com alterações não salvas.
- Abertura do guia.
- Reutilização de geração com IA.
- Revisão e aprovação.
- Listagem de capturas.
- Seleção múltipla.
- Selecionar todas.
- Vínculos em lote.
- Vínculos duplicados.
- Evidências de revisões diferentes.
- Etapas ambíguas.
- Preservação de vínculos antigos.
- Erros de API.
- Acessibilidade por teclado.
- Layout responsivo, quando houver ambiente de navegador disponível.
- Regressão das fases anteriores.

Não consumir créditos de API nos testes.

Não alterar dados reais do piloto.

## 17. Documentação

Criar:

`docs/PHASE_3D_REPORT.md`

Atualizar:

- `README.md`
- `docs/ROADMAP.md`
- `docs/ARCHITECTURE.md`

O relatório deve explicar:

- Como acessar a Central.
- Como funciona a linha do tempo.
- Como o progresso é calculado.
- Como são identificadas as próximas ações.
- Como vincular várias capturas.
- Quais componentes foram reutilizados.
- Quais endpoints foram criados.
- Quais testes foram executados.
- Limitações conhecidas.

## 18. Critérios de aceite

A Fase 3D estará concluída quando:

1. Existir a nova aba Produção de Conteúdo.
2. O menu administrativo permanecer funcional.
3. Projeto e aula puderem ser selecionados.
4. A linha do tempo refletir dados reais.
5. A próxima ação for evidente.
6. O guia puder ser gerado, consultado, editado e revisado na Central.
7. O código puder ser preparado, gerado e revisado na Central.
8. As capturas existentes aparecerem em uma galeria.
9. Múltiplas evidências puderem ser vinculadas em uma operação.
10. As etapas do guia puderem ser consultadas sem memorização.
11. Não houver perda de dados nem duplicação de registros.
12. As aprovações e o controle de custos continuarem intactos.
13. O fluxo funcionar após recarregar a aplicação.
14. A interface não exigir navegação constante entre páginas para produzir uma aula.

## 19. Restrições finais

- Não redesenhar as telas administrativas nesta fase.
- Não reimplementar a Fase 3 ou 3B.
- Não remover funcionalidades existentes.
- Não implementar DOCX antecipadamente.
- Não fazer chamadas pagas durante testes.
- Não executar código sem isolamento.
- Não alterar dados reais.
- Não fazer merge, push, deploy ou publicação sem autorização.
- Não declarar