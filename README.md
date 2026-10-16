# EduForge

Da ideia à aula pronta. Aplicação local de gestão de projetos educacionais e aulas. Implementa a Fase 1 e a **Fase 2A: roteiros, templates e versionamento pedagógico**, sem integração de IA. Consulte o [PRD](docs/Documento%201%20%E2%80%94%20PRD%20do%20EduForge%20v0.1.md), o [prompt da Fase 1](docs/prompts/Fase%201.md) e o [prompt da Fase 2A](docs/prompts/Fase%202A.md).

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
5. Edite ou exclua aulas e projetos na página do projeto. Projetos sem histórico pedagógico podem ser excluídos com suas aulas, após confirmação. Vínculos e guias impedem a exclusão das aulas; roteiros e guias preservam o projeto.
6. Reinicie o processo: os registros permanecem no banco local. Nenhum dado de exemplo é criado na instalação.

Status: planejada, em produção, em revisão e concluída. O indicador Em produção soma aulas em produção e em revisão.

## Roteiros, templates e guias manuais

1. No projeto, abra **Roteiro pedagógico** e crie a primeira versão. Preencha público-alvo, faixa etária, objetivos, duração e metodologia.
2. Adicione aulas à sequência. Cada item possui objetivos, conceitos novos e revisados, atividades, resultado esperado, pré-requisitos e dependências. Use as setas para reordenar; números devem ser únicos e dependências apontam para aulas anteriores na sequência.
3. Salve o roteiro e a sequência juntos. Envie para revisão e clique em **Aprovar versão**, confirmando a operação. Uma versão aprovada fica imutável.
4. Use **Duplicar para rascunho** para revisar sem alterar a versão anterior. Uma nova aprovação substitui a vigente e mantém o histórico. Em **Comparar versões salvas**, selecione origem e destino para ver os campos diferentes.
5. Na seção de vínculos, selecione uma aula já cadastrada para cada item. Divergências de número, título, objetivos ou duração padrão exibem um aviso com acesso à edição manual. O vínculo não copia conteúdo nem altera o status da aula. Vínculos não são copiados ao duplicar um roteiro; confirme-os na nova versão.
6. Em **Templates**, use o modelo padrão ou crie outro. A versão original aprovada possui 17 seções; a atualização possui 22 seções e é disponibilizada como rascunho para revisão e aprovação. As cinco novas seções são opcionais e vêm ativas. Duplique versões aprovadas para adaptar títulos, ordem, instruções e seções opcionais. Seções obrigatórias permanecem ativas. Arquivar um template preserva suas versões; é possível restaurá-lo.
7. Na lista de aulas, abra **Guia**. Escolha versões já aprovadas de template e roteiro, crie o rascunho e escreva manualmente cada seção. Rascunhos podem ficar incompletos; a aprovação exige conteúdo nas seções obrigatórias.
8. Envie o guia para revisão, aprove com confirmação e duplique quando precisar de ajustes. O indicador do guia na lista corresponde à versão mais recente, independente do status de produção da aula.

Estados pedagógicos: rascunho → em revisão → aprovado. Revisões podem voltar ao rascunho; aprovados só permitem duplicação. Uma aprovação posterior marca a antiga como substituída. Nenhuma versão é excluída. Se outra aprovação ocorrer enquanto a tela está aberta, atualize o histórico antes de tentar novamente.

## Dados e configuração

O banco é criado em `storage/eduforge.db`; migrations são aplicadas automaticamente ao iniciar. `DATABASE_PATH` pode ser absoluto ou relativo à raiz do projeto. `PORT` altera a porta da API; reinicie ambos os processos após editar `.env`.

Para backup, encerre a aplicação e copie o banco para um local seguro. Para restaurar, encerre a aplicação antes de substituir o arquivo. Não apague o banco para atualizar o software. Dados e credenciais não devem entrar no controle de versão.

## Verificações

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run check
npm.cmd run format:check
```

Os testes da API usam banco temporário; os testes de interface usam DOM simulado e API/SQLite em memória. Nenhum teste altera `storage/eduforge.db`. `build` gera `apps/web/dist`. Execute localmente com `dev`; o backend ainda não serve o build estático.

## Estrutura

- `apps/web`: interface React, navegação, formulários e CSS por área.
- `apps/api`: API Express, SQLite, migrations e testes de integração.
- `packages/shared`: schemas Zod e estados de produção.
- `docs`: arquitetura, etapas e relatório da implementação.
- `storage`: banco e futuros arquivos locais, ignorados no Git.

## Limites da entrega

Uso individual no computador local, sem autenticação ou exposição na rede. Não há geração de IA, documentos, execução de código, capturas ou integrações externas. Versões pedagógicas são preservadas; exclusões permitidas de registros da Fase 1 são permanentes. Consulte [arquitetura](docs/ARCHITECTURE.md), [roadmap](docs/ROADMAP.md) e [relatório da Fase 2A](docs/PHASE_2A_REPORT.md).
