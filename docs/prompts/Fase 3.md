# EduForge — Fase 3: Código, validação técnica e capturas de tela

## Contexto

Estamos desenvolvendo o **EduForge**, uma plataforma local-first de automação pedagógica, com o lema **“Da ideia à aula pronta.”**

Repositório: https://github.com/dejandrea/EduForge

A aplicação utiliza React, Vite, Node.js, Express, SQLite, Zod e JavaScript ESM, organizada em monorepo npm.

As Fases 1, 2A, 2B e 2C já foram implementadas. A professora também realizou testes reais de geração e regeneração de guias pedagógicos usando a API da OpenAI.

**Objetivo da Fase 3:** permitir que a professora prepare, inspecione, valide e documente tecnicamente o código de uma aula, utilizando cópias isoladas de repositórios, testes autorizados e capturas de tela, sem comprometer os projetos originais.

O projeto piloto é o Frogger Game, atualmente com duas aulas concluídas e quatro planejadas. A professora já cadastrou o projeto, suas aulas, referências, materiais e roteiro pedagógico, além de gerar um guia em rascunho para a Aula 3.

A implementação precisa preservar integralmente esses dados.

## 1. Preparação obrigatória

Antes de modificar qualquer arquivo:

1. Inspecione a estrutura real do repositório.
2. Leia `README.md`, `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/PHASE_2B_REPORT.md` e `docs/PHASE_2C_REPORT.md`.
3. Identifique os contratos, migrations, rotas, componentes e serviços existentes.
4. Verifique o estado do Git e a branch atual.
5. Crie a branch `feat/fase-3-codigo-capturas` a partir da versão mais recente que contenha a Fase 2C.
6. Não descarte alterações locais nem sobrescreva arquivos não versionados.
7. Não execute operações destrutivas sobre o banco de dados real.
8. Não realize merge, push, deploy ou publicação sem autorização.

Aproveite as funcionalidades existentes em vez de duplicá-las.

## 2. Integração com os recursos existentes

A Fase 2C já implementou:

- Referências de repositórios por projeto.
- Consulta de arquivos textuais pela API oficial do GitHub.
- Identificação de branch e commit.
- Snapshots técnicos imutáveis.
- Materiais e memória pedagógica.
- Seleção explícita de contexto.
- Manifesto das fontes utilizadas.

**Não recrie esses recursos.**

A Fase 3 deve acrescentar uma camada de preparação e validação técnica sobre eles.

Os vínculos entre projeto, aula, roteiro, guia, repositório e evidências devem ser rastreáveis.

## 3. Área de trabalho da aula

Criar uma nova seção na interface:

**Aula → Código e capturas**

Ela deverá permitir:

- Selecionar um repositório GitHub previamente associado ao projeto.
- Escolher a branch e identificar o commit de origem.
- Preparar uma cópia local isolada do código.
- Consultar a estrutura de arquivos.
- Visualizar arquivos textuais relevantes.
- Registrar o objetivo técnico da aula.
- Associar a preparação a uma aula específica.
- Consultar preparações anteriores sem sobrescrevê-las.

A cópia deve ser armazenada em uma área local controlada, fora do repositório original e ignorada pelo Git do EduForge.

A interface deve distinguir claramente:

**Código de referência**, **código em preparação**, **código validado** e **código aprovado pela professora**.

Nenhuma dessas classificações deve ser atribuída automaticamente sem evidência adequada.

## 4. Preparação segura de repositórios

Implementar um serviço de preparação de código com isolamento e limites.

Requisitos:

- Utilizar mecanismos oficiais do Git.
- Permitir apenas repositórios explicitamente selecionados.
- Registrar URL, branch, commit e data da preparação.
- Evitar execução automática de hooks.
- Não executar scripts de instalação durante a importação.
- Não copiar credenciais ou arquivos `.env` para artefatos exportáveis.
- Rejeitar caminhos inseguros e tentativas de acesso fora da área de trabalho.
- Impor limites configuráveis de tamanho, quantidade de arquivos, tempo e espaço em disco.
- Tratar symlinks e submódulos de forma segura.
- Não aceitar automaticamente repositórios privados sem autorização e credenciais adequadas.
- Não registrar tokens em logs.
- Nunca modificar a pasta original do projeto.

Não considerar que uma cópia de diretório seja um sandbox de segurança suficiente para executar código não confiável.

**Se não houver isolamento de execução adequado no ambiente Windows, a plataforma deverá limitar-se à inspeção estática e explicar essa restrição.**

## 5. Inspeção e planejamento técnico

A professora deverá conseguir consultar:

- Estrutura do projeto.
- Arquivos relevantes para a aula.
- Linguagens e tecnologias identificadas.
- Dependências declaradas.
- Scripts disponíveis.
- Possíveis pontos de implementação.
- Alterações propostas para a aula.

Criar uma visualização simples da estrutura de arquivos, sem depender de serviços externos.

Permitir selecionar arquivos como referências técnicas da aula.

Não enviar automaticamente o repositório completo à IA.

Qualquer integração com IA deve reutilizar os provedores, limites de orçamento, filas e mecanismos de autorização existentes.

Não implementar uma segunda infraestrutura de IA.

## 6. Alterações de código e revisão humana

Permitir registrar alterações propostas no código preparado.

A interface deve oferecer:

- Visualização de diferenças entre original e modificado.
- Identificação de arquivos criados, alterados e removidos.
- Resumo das mudanças.
- Histórico das preparações.
- Aprovação ou rejeição explícita da professora.

A aprovação deve registrar exatamente qual conjunto de arquivos e qual revisão foram avaliados.

**Aprovar uma alteração no EduForge não significa aplicá-la automaticamente ao GitHub.**

Não implementar push, merge, abertura automática de pull request ou publicação nesta fase.

Se houver edição de código, garantir que ela permaneça confinada à cópia de trabalho.

## 7. Validação técnica e execução controlada

Implementar verificações técnicas com dois níveis distintos.

### Nível A — Inspeção estática

Deve funcionar sem executar código do repositório.

Exemplos:

- Identificação de arquivos e dependências.
- Verificação de arquivos esperados.
- Comparação de alterações.
- Identificação de scripts disponíveis.
- Verificação de referências e caminhos.
- Registro de possíveis inconsistências.

### Nível B — Execução autorizada

Permitir executar testes e builds somente quando:

1. A professora autorizar explicitamente.
2. O ambiente oferecer isolamento apropriado.
3. O comando estiver em uma lista de permissões.
4. O diretório de execução estiver confinado à cópia isolada.
5. Forem aplicados limites de tempo, memória, processos e saída.
6. O processo puder ser cancelado.
7. A execução não tiver acesso desnecessário a segredos, arquivos pessoais ou rede externa.

A lista de permissões deve considerar o comando completo e seus argumentos, não apenas o nome do executável.

Não utilizar `shell: true` com entradas controladas pelo usuário.

Não permitir comandos arbitrários, scripts desconhecidos ou instalações automáticas.

A execução de `npm install`, `npm run`, testes e builds deve depender de uma avaliação explícita dos riscos dos scripts e dependências. Uma allowlist de nomes de comandos, isoladamente, não constitui isolamento.

**Não execute código não confiável diretamente no sistema hospedeiro.** Caso o isolamento necessário não esteja disponível, desabilite o Nível B e apresente uma explicação clara.

Registrar resultados reais de cada execução, sem inventar aprovações.

## 8. Evidências técnicas

Criar um sistema de evidências associado à aula e à preparação do código.

Tipos iniciais:

- Inspeção estática.
- Resultado de teste.
- Resultado de build.
- Registro de erro.
- Captura de tela.
- Evidência manual inserida pela professora.

Cada evidência deverá registrar:

- Aula.
- Preparação de origem.
- Commit e revisão do código.
- Tipo.
- Data e hora.
- Status.
- Descrição.
- Arquivo ou resultado associado.
- Origem manual ou automatizada.

Uma evidência de teste só poderá ser marcada como aprovada quando o teste tiver sido realmente executado e concluído com sucesso.

Não transformar automaticamente a existência de um arquivo em comprovação de funcionamento.

## 9. Capturas de tela

Implementar capturas utilizando Playwright, quando houver ambiente de navegador e execução adequadamente isolados.

O fluxo deverá permitir:

1. Selecionar uma preparação de código.
2. Informar ou selecionar uma URL local permitida.
3. Escolher uma resolução de captura.
4. Autorizar a captura.
5. Executar a captura em um navegador controlado.
6. Visualizar a imagem resultante.
7. Associá-la a uma etapa da aula.
8. Aprovar ou rejeitar a evidência.

Requisitos de segurança:

- Permitir somente destinos locais previamente autorizados.
- Bloquear redirecionamentos para destinos não autorizados.
- Impedir acesso a serviços internos sensíveis e recursos externos.
- Não capturar cookies, tokens ou dados pessoais desnecessários.
- Aplicar limites de tempo, resolução e tamanho.
- Não iniciar automaticamente servidores do projeto sem autorização e isolamento.
- Não tratar uma captura visual como comprovação de testes funcionais.
- Disponibilizar alternativa de upload manual quando a captura automatizada não for segura ou viável.

As imagens devem ser armazenadas localmente, fora do Git, com metadados e associação à aula.

## 10. Integração com os guias pedagógicos

A Fase 3 deverá permitir relacionar evidências técnicas às etapas de um guia.

Exemplos:

- Etapa 2 → arquivo `src/App.jsx`.
- Etapa 3 → alteração em um componente.
- Etapa 4 → resultado de teste.
- Etapa 5 → captura da aplicação.

Preservar o conteúdo e o versionamento dos guias existentes.

Não modificar automaticamente guias aprovados.

Se houver uma sugestão de correção no guia, criar uma proposta para revisão ou uma nova versão em rascunho, reutilizando os mecanismos existentes.

As evidências devem conservar seus vínculos mesmo quando surgir uma nova versão do guia.

## 11. Interface e experiência de uso

Manter a identidade visual escura existente.

Criar componentes pequenos, reutilizáveis e com arquivos CSS separados.

A interface deve apresentar claramente:

- O que está pronto.
- O que precisa de configuração.
- O que exige autorização.
- O que está sendo executado.
- O que falhou.
- O que foi validado.
- O que ainda depende da professora.

Evitar botões desabilitados sem explicação.

Mostrar mensagens específicas e ações possíveis para resolver pendências.

Incluir estados vazios, carregamento, falhas e confirmação de ações sensíveis.

## 12. Persistência e integridade

Criar uma migration incremental, sem alterar as migrations 001–005.

Persistir preparações, revisões, evidências, capturas e estados necessários.

Não armazenar imagens grandes diretamente no SQLite.

Arquivos de trabalho e capturas devem ficar em diretórios locais ignorados pelo Git.

Validar caminhos e impedir acesso fora das pastas autorizadas.

Preservar a integridade referencial com projetos, aulas e guias.

Documentar o backup conjunto do banco e dos arquivos locais.

## 13. Testes obrigatórios

Implementar testes automatizados para:

- Preparação de repositório autorizado.
- Rejeição de caminhos inseguros.
- Proteção do repositório original.
- Limites de arquivos e armazenamento.
- Associação correta de evidências.
- Imutabilidade das aprovações.
- Cancelamento de tarefas.
- Tratamento de falhas.
- Comandos não autorizados.
- Execução indisponível sem isolamento.
- Captura manual.
- Captura automatizada simulada.
- Compatibilidade com guias e roteiros existentes.
- Persistência após reinicialização.
- Regressão das Fases 1, 2A, 2B e 2C.

Utilizar repositórios e servidores simulados nos testes.

Não utilizar credenciais reais, repositórios privados ou chamadas pagas de IA.

Executar os testes, build e verificações de formatação disponíveis.

## 14. Documentação

Atualizar:

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`

Criar:

- `docs/PHASE_3_REPORT.md`

O relatório deverá incluir:

- Funcionalidades implementadas.
- Arquivos criados e modificados.
- Migrations.
- Endpoints.
- Fluxo de utilização.
- Decisões de segurança.
- Limitações do Windows.
- Testes realmente executados.
- Resultados e falhas.
- Pendências e próximos passos.

Não declarar funcionalidades como concluídas quando dependerem de infraestrutura ausente.

## 15. Critérios de aceite

A Fase 3 será considerada concluída quando:

1. A professora conseguir selecionar uma referência GitHub existente.
2. O EduForge preparar uma cópia isolada sem alterar o original.
3. A estrutura do código puder ser consultada.
4. As alterações propostas puderem ser revisadas.
5. A inspeção estática funcionar.
6. A execução de código for segura e autorizada ou estiver explicitamente indisponível.
7. Evidências puderem ser registradas e consultadas.
8. Capturas manuais funcionarem.
9. Capturas automáticas funcionarem somente em ambientes seguros e disponíveis.
10. Evidências puderem ser vinculadas à aula e ao guia.
11. A professora conseguir aprovar ou rejeitar os resultados.
12. Dados e funcionalidades das fases anteriores permanecerem intactos.
13. Testes e documentação refletirem o comportamento real.

## 16. Restrições finais

- Não implementar a exportação DOCX nesta fase.
- Não implementar publicação no GitHub.
- Não implementar automação do NotebookLM ou Canva.
- Não criar infraestrutura de IA duplicada.
- Não consumir créditos pagos durante testes.
- Não alterar dados reais do usuário para testar migrations.
- Não fazer deploy.
- Não realizar commit, push ou merge sem autorização.

**Prioridade:** confiabilidade, segurança, rastreabilidade e simplicidade de uso.

Ao finalizar, apresente um relatório objetivo do que foi implementado, o que foi testado e o que ainda precisa de validação manual.