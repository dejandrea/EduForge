# EduForge — Documento de Requisitos do Produto (PRD)

**Versão:** 0.1 — MVP  
**Status:** Planejamento inicial  
**Tipo:** Plataforma web local de automação de conteúdos educacionais  
**Primeiro projeto de validação:** React Quest

## 1. Visão do produto

O EduForge é uma plataforma que centraliza e automatiza o processo de criação de materiais educacionais, desde a definição do roteiro de um curso até a produção de documentos, códigos, capturas, apresentações e organização dos arquivos.

**Proposta de valor:** transformar ideias e projetos em aulas completas, reduzindo tarefas repetitivas sem comprometer a qualidade pedagógica.

**Slogan provisório:** Da ideia à aula pronta.

## 2. Problema

O processo atual de produção de aulas envolve diversas ferramentas e etapas manuais:

- Planejamento e geração do conteúdo no ChatGPT.
- Cópia, formatação e revisão dos documentos.
- Implementação e validação dos códigos.
- Capturas e posicionamento de imagens.
- Geração de apresentações no NotebookLM.
- Edição visual no Canva.
- Organização dos materiais no Google Drive.

O processo exige trabalho repetitivo, alternância entre ferramentas e acompanhamento manual das entregas.

## 3. Objetivos do MVP

1. Centralizar projetos, roteiros e aulas.
2. Preservar o histórico pedagógico e técnico de cada projeto.
3. Gerar planos de aula com IA a partir de templates.
4. Criar documentos DOCX formatados automaticamente.
5. Associar trechos de código e capturas às etapas do documento.
6. Executar testes e gerar evidências de funcionamento.
7. Registrar links do GitHub e dos materiais complementares.
8. Permitir revisão e aprovação antes de finalizar.
9. Registrar duração e custo das operações.

## 4. Público-alvo

**MVP:** uma professora, utilizando a aplicação localmente.

**Expansão futura:** professores, criadores de cursos e instituições educacionais de diferentes áreas.

## 5. Funcionalidades

### RF01 — Gestão de projetos
Cadastrar, editar, arquivar e consultar projetos educacionais.

Cada projeto terá nome, descrição, tecnologias ou disciplinas, repositório opcional, duração prevista das aulas e template pedagógico.

### RF02 — Roteiro geral
Criar um roteiro com a sequência de aulas, objetivos, competências, pré-requisitos e conteúdos previstos.

O roteiro terá versões e exigirá aprovação antes de orientar a geração de aulas.

### RF03 — Gestão de aulas
Cadastrar aulas manualmente ou a partir do roteiro, visualizar estados de produção e acessar os arquivos relacionados.

### RF04 — Geração de conteúdo com IA
Gerar um guia pedagógico seguindo um modelo configurável.

A geração deverá considerar o roteiro aprovado, os conceitos já ensinados e as regras pedagógicas do projeto.

### RF05 — Editor e revisão
Permitir revisar, ajustar e aprovar o conteúdo antes da criação do documento final.

### RF06 — Geração de documentos
Criar arquivos DOCX utilizando templates com estilos definidos para títulos, subtítulos, textos, códigos, tabelas e imagens.

### RF07 — Código e validação
Associar repositórios, preparar cópias de trabalho, executar verificações permitidas e registrar resultados.

A implementação automática de código será introduzida progressivamente, com revisão obrigatória das alterações.

### RF08 — Capturas
Gerar imagens de trechos de código e, quando aplicável, da interface da aplicação.

As imagens serão vinculadas a posições específicas no guia.

### RF09 — Artefatos e versões
Armazenar documentos, capturas, relatórios, arquivos e links com identificação da aula e versão.

### RF10 — Materiais complementares
Gerar os três prompts de apresentações e disponibilizar um fluxo assistido para NotebookLM e Canva.

Registrar os arquivos e links finais.

### RF11 — Histórico e custos
Registrar início, conclusão, duração, estado e eventuais erros de cada tarefa.

Registrar o consumo de APIs quando informado pelo provedor.

## 6. Requisitos não funcionais

- Execução local em Windows.
- Interface responsiva.
- Arquitetura modular.
- Banco SQLite.
- Armazenamento local dos arquivos.
- Segredos e credenciais protegidos.
- Logs sem exposição de chaves ou dados sensíveis.
- Tarefas demoradas executadas sem bloquear a interface.
- Possibilidade de retomar tarefas interrompidas.
- Operações repetidas não devem duplicar arquivos ou publicações indevidamente.
- Execução de código em ambiente isolado.
- Publicação e sobrescrita somente mediante aprovação.

## 7. Tecnologias

**Frontend:** React, Vite e CSS por componente/página.  
**Backend:** Node.js e Express.  
**Banco de dados:** SQLite.  
**Validação de dados:** Zod.  
**Automação de navegador:** Playwright.  
**Documentos:** python-docx em worker Python local.  
**Integrações futuras:** OpenAI, Gemini, GitHub, Google Docs, Google Drive e Canva.

## 8. Telas

1. **Dashboard:** projetos, aulas em produção, tarefas e métricas.
2. **Projetos:** cadastro, edição e consulta.
3. **Roteiro:** sequência das aulas e controle de versões.
4. **Aulas:** conteúdo, status e histórico.
5. **Produção:** etapas da automação, resultados e erros.
6. **Revisão:** conteúdo e artefatos aguardando aprovação.
7. **Configurações:** templates, diretórios, integrações e orçamento.

## 9. Modelo inicial de dados

- `projects`: projetos educacionais.
- `roadmap_versions`: versões do roteiro.
- `lessons`: aulas de cada projeto.
- `lesson_versions`: versões do conteúdo pedagógico.
- `jobs`: tarefas de automação.
- `artifacts`: documentos, imagens e links.
- `approvals`: aprovações da professora.
- `settings`: preferências locais e configurações não secretas.
- `usage_records`: consumo de IA, duração e custos estimados.

## 10. Fluxo principal

1. Criar projeto.
2. Definir ou importar roteiro.
3. Aprovar roteiro.
4. Selecionar aula.
5. Gerar conteúdo.
6. Revisar e aprovar.
7. Preparar código e capturas.
8. Gerar documento formatado.
9. Conferir documento.
10. Preparar apresentações.
11. Registrar materiais finais.
12. Finalizar aula.

Cada etapa deve poder ser repetida sem descartar automaticamente resultados anteriores.

## 11. Fora do escopo inicial

- Cadastro de múltiplos usuários.
- Assinaturas e pagamentos.
- Hospedagem pública.
- Aplicativo mobile.
- Publicação automática sem confirmação.
- Controle integral do editor Canva.
- Automação não oficial do NotebookLM.
- Execução irrestrita de código gerado por IA.

## 12. Critérios de aceite do MVP

O MVP estará validado quando for possível:

- Cadastrar o projeto React Quest.
- Registrar e aprovar seu roteiro.
- Criar uma aula a partir da sequência.
- Gerar e revisar o guia.
- Associar código e capturas verificadas.
- Exportar um DOCX formatado.
- Registrar links e materiais complementares.
- Consultar o histórico e os tempos de produção.
- Recuperar uma versão anterior sem perda de dados.

**Caso de teste principal:** produzir e revisar a Aula 12 do React Quest.

## 13. Indicadores de sucesso

- Tempo ativo gasto por aula.
- Tempo total de execução.
- Quantidade de correções manuais.
- Percentual de etapas automatizadas.
- Custo de IA por aula.
- Quantidade de falhas e tentativas.
- Qualidade do documento final após revisão.

**Referência inicial:** 227 minutos de trabalho ativo na Aula 11.

## 14. Estratégia de implementação

**Fase 1:** fundação, banco e gestão de projetos/aulas.  
**Fase 2:** roteiro, templates e geração pedagógica.  
**Fase 3:** código, testes e capturas.  
**Fase 4:** montagem de documentos.  
**Fase 5:** materiais complementares, histórico e integração com Drive.

A implementação será incremental. Cada fase terá testes e critérios de aceite antes da próxima.