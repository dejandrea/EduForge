# EduForge — Implementação da Fase 1

Você é um engenheiro de software sênior especializado em React, Node.js, Express, SQLite e arquitetura de aplicações locais.

Vamos iniciar o desenvolvimento do **EduForge**, uma plataforma web local para automação da criação de conteúdos educacionais.

## Contexto

A aplicação será utilizada inicialmente por uma única professora em Windows.

O sistema deverá futuramente automatizar planejamento pedagógico, geração de documentos, validação de código, capturas de tela, apresentações e organização de materiais.

Nesta tarefa, implemente **somente a Fase 1 — Fundação**.

## Stack

- React + Vite no frontend.
- Node.js + Express no backend.
- SQLite como banco local.
- Zod para validação.
- CSS separado por componente e por página.
- JavaScript inicialmente.
- Estrutura modular preparada para futuras integrações.

## Funcionalidades desta fase

### 1. Dashboard
Criar uma página inicial com:
- Total de projetos.
- Total de aulas.
- Aulas em produção.
- Aulas concluídas.
- Lista de projetos recentes.

### 2. Gestão de projetos
Implementar CRUD de projetos com:
- Nome.
- Descrição.
- Área ou disciplina.
- Tecnologias utilizadas.
- URL opcional do repositório.
- Duração padrão das aulas.
- Data de criação e atualização.

### 3. Gestão de aulas
Implementar CRUD de aulas vinculadas a projetos com:
- Número da aula.
- Título.
- Objetivos.
- Duração.
- Status de produção.
- Data de criação e atualização.

### 4. Banco de dados
Configurar SQLite com migrations versionadas.

Criar inicialmente as tabelas `projects` e `lessons`.

Usar chaves primárias estáveis e relacionamentos adequados.

### 5. API REST
Criar endpoints para listar, cadastrar, consultar, atualizar e excluir projetos e aulas.

Adicionar validação de entradas e tratamento consistente de erros.

### 6. Interface
Criar um layout com:
- Menu lateral.
- Cabeçalho.
- Dashboard.
- Página de projetos.
- Página de detalhes do projeto.
- Listagem de aulas.
- Formulários de cadastro e edição.

Utilizar tema escuro, visual profissional e responsivo.

### 7. Organização
Estruturar o repositório como monorepo com `apps/web`, `apps/api`, `packages/shared`, `docs` e `storage`.

Criar scripts para instalar dependências, iniciar o frontend e o backend e executar verificações.

Criar `.gitignore` adequado para banco local, arquivos gerados, credenciais e dependências.

### 8. Documentação
Criar:
- README.md com instruções para Windows.
- docs/ARCHITECTURE.md.
- docs/ROADMAP.md.
- .env.example sem credenciais reais.

## Regras importantes

- Não integrar APIs de IA nesta fase.
- Não configurar serviços pagos.
- Não implementar autenticação complexa para uso local individual.
- Não adicionar Supabase, Vercel ou n8n.
- Não criar funcionalidades fictícias que aparentem estar funcionando.
- Não executar código de terceiros.
- Não acessar ou modificar outros repositórios.
- Não criar dados reais da professora sem autorização.
- Priorizar código legível e manutenção simples.
- Evitar abstrações e dependências desnecessárias.
- Manter o frontend desacoplado da persistência.

## Critérios de aceite

Ao concluir, devo conseguir:

1. Instalar e iniciar o projeto localmente.
2. Abrir o dashboard no navegador.
3. Cadastrar o React Quest como projeto.
4. Cadastrar aulas vinculadas a esse projeto.
5. Editar e excluir registros.
6. Reiniciar a aplicação sem perder os dados.
7. Consultar a documentação de instalação.
8. Executar os testes e verificações disponíveis sem erros introduzidos pela implementação.

## Forma de trabalho

Antes de implementar, apresente brevemente a arquitetura e o plano de execução.

Depois implemente a Fase 1, execute os testes disponíveis e apresente um relatório final contendo:
- Arquivos criados.
- Funcionalidades implementadas.
- Comandos para executar.
- Testes realizados e resultados.
- Pendências.
- Próxima fase recomendada.

Não avance automaticamente para a Fase 2.