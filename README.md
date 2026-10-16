# EduForge

Da ideia à aula pronta. Aplicação local de gestão de projetos educacionais e aulas. Esta entrega implementa **somente a Fase 1** descrita nos dois documentos originais da pasta.

## Iniciar no Windows

Requisitos: Node.js 22.13 ou superior (recomendado 22 LTS) com npm. Não é necessário instalar Python ou SQLite nesta fase. O SQLite integrado ao Node pode emitir um aviso experimental na versão 22; o aviso não indica falha.

No PowerShell, dentro desta pasta:

```powershell
npm.cmd install --ignore-scripts
Copy-Item .env.example .env
npm.cmd run dev
```

Abra **http://127.0.0.1:5173**. API: `http://127.0.0.1:3001/api/health`. Encerre com Ctrl+C. O arquivo `.env` é opcional; os valores padrão funcionam sem ele. Não sobrescreva um `.env` existente ao repetir a instalação.

Em terminais separados, também é possível executar `npm.cmd run dev -w @eduforge/api` e `npm.cmd run dev -w @eduforge/web`.

## Usar

1. Em Projetos, clique em Novo projeto e cadastre o React Quest com os dados desejados.
2. Abra o projeto e clique em Nova aula. O formulário usa a duração padrão do projeto.
3. Edite número, título, objetivos, duração e status. Números de aula são únicos em cada projeto.
4. Consulte todas as aulas em Aulas; acompanhe os totais no Dashboard.
5. Edite ou exclua aulas e projetos na página do projeto. Excluir um projeto também exclui suas aulas, após confirmação explícita.
6. Reinicie o processo: os registros permanecem no banco local. Nenhum dado de exemplo é criado na instalação.

Status: planejada, em produção, em revisão e concluída. O indicador Em produção soma aulas em produção e em revisão.

## Dados e configuração

O banco é criado em `storage/eduforge.db`; migrations são aplicadas automaticamente ao iniciar. `DATABASE_PATH` pode ser absoluto ou relativo à raiz do projeto. `PORT` altera a porta da API; reinicie ambos os processos após editar `.env`.

Para backup, encerre a aplicação e copie o banco para um local seguro. Para restaurar, encerre a aplicação antes de substituir o arquivo. Não apague o banco para atualizar o software. Dados e credenciais não devem entrar no controle de versão.

## Verificações

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run check
```

Os testes usam banco temporário, sem alterar `storage/eduforge.db`. `build` gera `apps/web/dist`. Nesta fase, execute localmente com `dev`; o backend ainda não serve o build estático.

## Estrutura

- `apps/web`: interface React, navegação, formulários e CSS por área.
- `apps/api`: API Express, SQLite, migrations e testes de integração.
- `packages/shared`: schemas Zod e estados de produção.
- `docs`: arquitetura, etapas e relatório da implementação.
- `storage`: banco e futuros arquivos locais, ignorados no Git.

## Limites da entrega

Uso individual no computador local, sem autenticação ou exposição na rede. Não há geração de IA, documentos, execução de código, capturas ou integrações externas. A exclusão é permanente; histórico e restauração de versões pertencem às próximas fases. Consulte [arquitetura](docs/ARCHITECTURE.md) e [roadmap](docs/ROADMAP.md).
