# EduForge — Fase 2A: Roteiros, Templates e Versionamento Pedagógico

Você é um engenheiro de software sênior especializado em React, Node.js, Express, SQLite, Zod e sistemas de produção de conteúdo educacional.

## Contexto

Estamos desenvolvendo o EduForge, uma plataforma local para automatizar a produção de aulas.

Repositório: https://github.com/dejandrea/EduForge

A Fase 1 já foi implementada na branch `main`, incluindo:
- Monorepo npm em JavaScript ESM.
- Frontend React + Vite + React Router.
- Backend Node.js + Express.
- SQLite nativo do Node.
- Schemas compartilhados com Zod.
- CRUD de projetos e aulas.
- Dashboard, migrations e testes de integração.

Leia o README, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, os schemas e os testes existentes antes de modificar o código.

## Objetivo

Implementar a Fase 2A: planejamento pedagógico estruturado, roteiros versionados, templates reutilizáveis e aprovação de conteúdo.

**Não integrar APIs de IA nesta fase.**

## 1. Controle de versão

Crie uma branch `feat/fase-2a-roteiros` a partir da `main` atualizada.

Não modifique migrations já aplicadas.

Não sobrescreva dados locais existentes.

## 2. Roteiros pedagógicos

Implementar roteiros vinculados a projetos.

Cada roteiro terá versões contendo:
- Identificação do projeto.
- Título e descrição do roteiro.
- Público-alvo e faixa etária.
- Objetivos gerais.
- Duração padrão.
- Metodologia pedagógica.
- Lista ordenada de aulas.
- Status da versão.
- Data de criação, atualização e aprovação.

Cada item do roteiro terá:
- Número e título da aula.
- Objetivos específicos.
- Conceitos novos.
- Conceitos revisados.
- Tecnologias ou disciplinas.
- Atividades práticas.
- Resultado esperado.
- Pré-requisitos e dependências pedagógicas.

Permitir criar, editar, duplicar e consultar versões.

## 3. Aprovação

Implementar os estados:
- `draft` — Rascunho.
- `in_review` — Em revisão.
- `approved` — Aprovado.
- `superseded` — Substituído por nova versão aprovada.

Regras:
- Uma versão aprovada deve ser imutável.
- Alterações em roteiros aprovados devem criar novo rascunho.
- Aprovação deve exigir confirmação explícita.
- Um projeto deve ter no máximo uma versão aprovada vigente.
- Versões anteriores devem continuar consultáveis.
- Rejeitar transições de estado inválidas.
- Não excluir o histórico de versões.

## 4. Integração com aulas existentes

As aulas da Fase 1 devem continuar funcionando.

Permitir vincular uma aula existente a um item do roteiro, sem duplicar nem sobrescrever dados automaticamente.

Se houver divergência entre roteiro e aula cadastrada, exibir um aviso e permitir resolução manual.

Não alterar o status de produção da aula simplesmente porque o roteiro foi aprovado.

## 5. Templates pedagógicos

Criar um sistema de templates versionáveis para guias de aula.

Implementar inicialmente um template padrão inspirado na estrutura pedagógica do React Quest:

- Cabeçalho.
- Propósito da aula.
- O que o aluno precisa sentir ao final.
- Metodologia da aula.
- Base conceitual.
- Novidade da aula.
- Shuhari aplicado.
- O que fazer e o que evitar.
- Experiência CodeMinds: início, meio e fim.
- Preparação antes da aula.
- Fluxo pedagógico.
- Orientações para a professora.
- Estrutura do projeto.
- Passo a passo detalhado.
- Verificações e perguntas para os alunos.
- Encerramento.
- Objetivos pedagógicos da aula.
- Pilares da aula.
- O que observar na avaliação informal.
- Habilidades de pensamento computacional.
- Mensagem final para a professora.
- Materiais de apoio e links.

O template deve permitir:
- Reordenar seções.
- Ativar ou desativar seções opcionais.
- Definir instruções por seção.
- Criar versões sem perder o histórico.

Não codificar regras específicas do React Quest diretamente nos componentes ou serviços.

## 6. Versões de conteúdo das aulas

Preparar o modelo para armazenar versões de guias pedagógicos, inicialmente criadas ou editadas manualmente.

Cada versão deverá registrar:
- Aula vinculada.
- Template e versão utilizados.
- Versão do roteiro de referência.
- Conteúdo estruturado.
- Status de revisão.
- Data de criação e aprovação.

Não gerar conteúdo com IA nesta fase.

## 7. Banco de dados

Adicionar novas migrations SQL numeradas.

Preservar o banco e as tabelas da Fase 1.

Utilizar chaves estrangeiras, constraints e transações para garantir integridade.

Documentar decisões sobre imutabilidade, versionamento e relacionamento entre roteiro, aulas e templates.

## 8. API

Criar endpoints REST para:
- Roteiros e versões.
- Itens do roteiro.
- Aprovação e consulta de histórico.
- Templates pedagógicos.
- Versões do conteúdo das aulas.

Utilizar Zod e o padrão de erros existente.

Aprovações e operações de versionamento devem ser transacionais.

## 9. Interface

Adicionar:
- Página de roteiro dentro do projeto.
- Editor de sequência de aulas.
- Visualização de versões.
- Comparação básica entre versões.
- Aprovação com confirmação.
- Gerenciamento de templates.
- Editor de conteúdo estruturado.
- Indicadores de conteúdo pendente, em revisão e aprovado.

Manter o tema escuro e CSS separado por componente/página.

Evitar dependências de interface desnecessárias.

## 10. Testes obrigatórios

Testar:
- Criação de roteiros e versões.
- Ordenação e unicidade dos números de aulas.
- Aprovação e transições válidas.
- Imutabilidade das versões aprovadas.
- Duplicação de versão aprovada para novo rascunho.
- Preservação do histórico.
- Conflitos de aprovação.
- Integridade das relações.
- Vinculação de aulas existentes.
- CRUD e versionamento de templates.
- Persistência após reinicialização.
- Compatibilidade com a Fase 1.
- Migrations sobre banco já existente.

## 11. Documentação

Atualizar:
- README.md.
- docs/ARCHITECTURE.md.
- docs/ROADMAP.md.

Criar `docs/PHASE_2A_REPORT.md` com decisões, arquivos modificados, testes e pendências.

## 12. Limites

Não implementar nesta fase:
- OpenAI ou Gemini.
- Geração automática de conteúdo.
- GitHub API.
- Execução de código.
- Capturas de tela.
- Exportação DOCX.
- NotebookLM, Canva ou Google Drive.

Não modificar arquivos externos ao repositório.

Não realizar push ou merge sem autorização explícita.

## 13. Critérios de aceite

Devo conseguir:
1. Criar um roteiro para o React Quest.
2. Cadastrar sua sequência de aulas.
3. Aprovar a primeira versão.
4. Criar uma nova versão sem alterar a aprovada.
5. Comparar versões.
6. Vincular aulas já cadastradas.
7. Criar e editar templates pedagógicos.
8. Criar manualmente uma versão de guia.
9. Reiniciar a aplicação sem perder dados.
10. Executar testes, build e verificações sem regressões.

## Forma de trabalho

Primeiro, analise o repositório e apresente o plano técnico, incluindo migrations e endpoints.

Depois implemente somente a Fase 2A.

Ao concluir, execute os testes e forneça um relatório de resultados.

Pare antes de iniciar a Fase 2B.