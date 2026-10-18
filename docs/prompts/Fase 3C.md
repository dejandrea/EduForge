# EduForge — Fase 3C: Simplificação da experiência de código e IA

## Objetivo

Redesenhar a experiência de **Aula → Código e capturas** para que uma professora consiga preparar, gerar, revisar, aprovar e documentar o código de uma aula sem orientação externa.

**Princípio central: facilitar, não complicar.**

A Fase 3 e a Fase 3B já foram implementadas. Não reimplementar serviços, geração de IA, versionamento, orçamento, evidências ou aprovações.

Branch-base: `feat/fase-3b-geracao-codigo-ia`.

Criar uma branch específica para a melhoria de UX, preservando dados e histórico.

## 1. Diagnóstico antes de alterar

Inspecione os componentes atuais, principalmente:

- `CodeWorkspace.jsx`
- `CodeFiles.jsx`
- `CodeEvidence.jsx`
- `CodeGuideLinks.jsx`
- `CodeGeneration.jsx`
- `CodeAIHistory.jsx`
- `CodeProposalReview.jsx`

Identifique todos os fluxos, ações, estados e dependências.

Não remova funcionalidades para simplificar a interface. Reorganize-as.

## 2. Nova organização da página

Substituir a página longa por quatro áreas:

**Visão geral**
- Estado atual da aula.
- Progresso das etapas.
- Próxima ação recomendada.
- Acesso rápido ao guia.
- Resumo do código aprovado.

**Código**
- Arquivos da revisão atual.
- Geração com IA.
- Comparação de alterações.
- Aprovação humana.

**Evidências**
- Registro de testes manuais.
- Envio de capturas.
- Inspeção estática.
- Associação ao guia.

**Histórico**
- Preparações anteriores.
- Revisões.
- Gerações de IA.
- Custos e detalhes técnicos.

Usar abas ou navegação equivalente, com indicação clara da área ativa.

Evitar esconder a ação principal dentro de componentes recolhidos.

## 3. Fluxo guiado

Criar uma sequência visual simples:

1. **Preparar código**
2. **Gerar com IA**
3. **Revisar código**
4. **Registrar testes**
5. **Concluir**

Cada etapa deve indicar se está pendente, em andamento ou concluída.

O estado deve ser calculado a partir dos registros existentes, sem criar uma segunda fonte de verdade.

A interface deve destacar uma ação principal por vez.

Permitir voltar a etapas anteriores sem perder dados.

Não obrigar a professora a seguir uma sequência rígida quando já existirem dados válidos.

## 4. Aproveitamento automático dos dados

Quando existir uma preparação pronta:

- Selecioná-la automaticamente quando não houver ambiguidade.
- Selecionar a revisão mais recente por padrão, preservando a possibilidade de escolher outra.
- Não exigir nova importação.

Quando existir um guia da mesma aula:

- Sugerir a versão mais recente.
- Identificar claramente se é rascunho ou aprovado.
- Sugerir as seções relevantes para geração.

Quando uma proposta de IA for aceita:

- Abrir a revisão recém-criada.
- Mostrar a comparação e o botão de aprovação.
- Após aprovação, indicar a próxima ação.

Quando uma evidência for criada:

- Sugerir sua associação à seção adequada do guia.
- Aproveitar as referências de seções produzidas pela IA, quando disponíveis.
- Solicitar confirmação antes de gravar vínculos.
- Evitar vínculos duplicados.

Não associar automaticamente evidências a etapas incertas.

## 5. Linguagem acessível

No fluxo principal, usar termos compreensíveis:

| Termo atual | Apresentação sugerida |
|---|---|
| Preparação | Código de partida |
| Revisão | Versão do código |
| Digest | Identificador técnico |
| Inspeção estática | Verificar estrutura do código |
| Evidência | Registro do teste |
| Aplicar proposta | Criar nova versão com este código |

Preservar os nomes técnicos internamente e disponibilizá-los em detalhes avançados.

Não ocultar avisos de segurança ou limitações importantes.

## 6. Registro de testes simplificado

Criar um formulário principal:

**Como foi o teste do código?**

Campos:

- Ambiente utilizado, com sugestão de Code.org Game Lab quando aplicável.
- Resultado: funcionou, funcionou parcialmente ou apresentou problemas.
- Observações opcionais.
- Captura PNG opcional.

Permitir registrar o teste em poucos passos.

Internamente, reutilizar os registros manuais e capturas da Fase 3.

**Não transformar um relato manual em teste automatizado ou comprovação técnica.**

Se a professora informar que testou no Code.org, registrar explicitamente que foi uma validação manual realizada por ela.

## 7. Aprovação e conclusão

Manter a aprovação humana existente.

Diferenciar claramente:

- Código gerado.
- Código revisado.
- Código aprovado.
- Teste manual registrado.
- Evidência aprovada.

Não confundir aprovação de código com validação funcional.

Não exigir que a professora aprove novamente uma revisão já aprovada.

Não modificar automaticamente guias aprovados.

## 8. Área avançada

Mover para uma área secundária:

- SHA-256.
- Commit completo.
- Manifests.
- Detalhes de armazenamento.
- Métricas completas de tokens.
- Configurações técnicas.
- Comparações históricas avançadas.

Essas informações devem continuar acessíveis.

Mostrar custos resumidos junto à geração e detalhes completos no histórico.

## 9. Usabilidade

Implementar:

- Navegação clara.
- Menos rolagem.
- Estados vazios orientativos.
- Mensagens de erro específicas.
- Confirmações apenas quando necessárias.
- Feedback imediato após salvar.
- Acesso fácil à próxima etapa.
- Layout responsivo.
- Preservação de formulários não salvos ao trocar de área.
- Acessibilidade por teclado.
- Rótulos e mensagens em português claro.

Não introduzir bibliotecas pesadas de UI sem necessidade.

Manter o tema escuro e os CSS separados por componente.

## 10. Testes

Cobrir:

- Fluxo completo com preparação existente.
- Geração e aceitação de proposta.
- Aprovação de revisão.
- Registro manual de teste.
- Envio de captura.
- Associação ao guia.
- Navegação entre abas.
- Preservação de alterações não salvas.
- Estados de erro.
- Ausência de referências ou modelos.
- Compatibilidade com dados existentes.
- Regressão das Fases 3 e 3B.

Usar dados e provedores simulados.

Não consumir créditos pagos.

## 11. Critério principal de aceite

Uma professora deve conseguir abrir a Aula 3 do Frogger Game, identificar imediatamente o estado do trabalho e concluir o fluxo sem precisar procurar botões pela página inteira.

O teste deve incluir o cenário real já alcançado:

- Revisão 1 importada.
- Proposta de IA gerada.
- Revisão 2 aprovada.
- Teste manual realizado no Code.org.
- Evidências ainda não registradas.

Nesse cenário, a plataforma deve destacar **Registrar teste e captura**, sem pedir nova geração ou nova aprovação.

## 12. Documentação

Criar `docs/PHASE_3C_REPORT.md` com:

- Diagnóstico da interface anterior.
- Alterações realizadas.
- Componentes afetados.
- Fluxos simplificados.
- Testes executados.
- Limitações e pendências.

Atualizar README e roadmap.

Não alterar migrations nem contratos de API, salvo necessidade comprovada e documentada.

Não fazer commit, push, merge ou deploy sem autorização.

**Resultado esperado: uma interface mais simples, objetiva e intuitiva, mantendo toda a segurança e rastreabilidade já implementadas.**