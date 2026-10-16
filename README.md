# EduForge

Da ideia à aula pronta. Aplicação local de gestão de projetos educacionais e aulas. Implementa as Fases 1, 2A e **2B: geração pedagógica com IA**, com revisão humana e histórico. Consulte o [PRD](docs/Documento%201%20%E2%80%94%20PRD%20do%20EduForge%20v0.1.md) e os prompts das [Fases 1](docs/prompts/Fase%201.md), [2A](docs/prompts/Fase%202A.md) e [2B](docs/prompts/Fase%202B.md).

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

1. No menu **Roteiros**, escolha o projeto e clique em **Cadastrar ou abrir roteiro**. O mesmo acesso continua nos detalhes do projeto, em **Roteiro pedagógico**. Crie a primeira versão e preencha público-alvo, faixa etária, objetivos, duração e metodologia.
2. Adicione aulas à sequência. Cada item possui objetivos, conceitos novos e revisados, atividades, resultado esperado, pré-requisitos e dependências. Use as setas para reordenar; números devem ser únicos e dependências apontam para aulas anteriores na sequência.
3. Salve o roteiro e a sequência juntos. Envie para revisão e clique em **Aprovar versão**, confirmando a operação. Uma versão aprovada fica imutável.
4. Use **Duplicar para rascunho** para revisar sem alterar a versão anterior. Uma nova aprovação substitui a vigente e mantém o histórico. Em **Comparar versões salvas**, selecione origem e destino para ver os campos diferentes.
5. Na seção de vínculos, selecione uma aula já cadastrada para cada item. Divergências de número, título, objetivos ou duração padrão exibem um aviso com acesso à edição manual. O vínculo não copia conteúdo nem altera o status da aula. Vínculos não são copiados ao duplicar um roteiro; confirme-os na nova versão.
6. Em **Templates**, use o modelo padrão ou crie outro. A versão original aprovada possui 17 seções; a atualização possui 22 seções e é disponibilizada como rascunho para revisão e aprovação. As cinco novas seções são opcionais e vêm ativas. Duplique versões aprovadas para adaptar títulos, ordem, instruções e seções opcionais. Seções obrigatórias permanecem ativas. Arquivar um template preserva suas versões; é possível restaurá-lo.
7. Na lista de aulas, abra **Guia**. Escolha versões já aprovadas de template e roteiro, crie o rascunho e escreva manualmente cada seção. Rascunhos podem ficar incompletos; a aprovação exige conteúdo nas seções obrigatórias.
8. Envie o guia para revisão, aprove com confirmação e duplique quando precisar de ajustes. O indicador do guia na lista corresponde à versão mais recente, independente do status de produção da aula.

Estados pedagógicos: rascunho → em revisão → aprovado. Revisões podem voltar ao rascunho; aprovados só permitem duplicação. Uma aprovação posterior marca a antiga como substituída. Nenhuma versão é excluída. Se outra aprovação ocorrer enquanto a tela está aberta, atualize o histórico antes de tentar novamente.

## Configurar IA

O uso manual continua disponível sem nenhuma credencial. Para gerar com IA, configure no `.env` da raiz apenas os provedores desejados e reinicie o backend:

```dotenv
OPENAI_API_KEY=sua-chave
GEMINI_API_KEY=sua-chave
```

Nunca use prefixo `VITE_` para esses segredos. Não envie chaves pelo chat ou inclua-as nos documentos do projeto. A interface exibe apenas se a credencial está configurada; não recebe seu valor. Assinaturas ChatGPT/Gemini e créditos das respectivas APIs são serviços separados.

1. Abra **Configurações → Inteligência Artificial** e cadastre um modelo com ID e nome de exibição. Não há ID de modelo fixo: consulte o catálogo oficial do provedor e escolha um compatível com saída estruturada.
2. Informe limite de tokens de saída e, somente se suportada, temperatura. Deixe temperatura vazia para não enviar esse parâmetro.
3. Configure preços de entrada e saída por milhão de tokens em **USD** e a data de atualização. O preço de cache é opcional; na ausência dele, a estimativa usa o preço normal de entrada. Sem preços suficientes, a geração é bloqueada preventivamente.
4. Selecione provedor/modelo padrão, orçamento mensal e tempo limite. Salve antes de clicar em **Testar conexão explicitamente**. Esse botão consulta o catálogo com a credencial, sem gerar conteúdo; não garante suporte a todos os parâmetros do modelo.
5. Câmbio é opcional: preencha taxa BRL por USD e data para apresentar também estimativas em reais. Sem taxa identificada, os valores permanecem em USD.

As chamadas vão diretamente às APIs OpenAI/Gemini pelo backend. O SDK é uma dependência local; não utiliza hospedagem ou AI Gateway. Nenhuma chamada externa é feita ao abrir as telas.

## Gerar e revisar

1. Aprove o roteiro e o template desejados. Para utilizar as 22 seções do modelo atualizado, revise e aprove essa versão do template primeiro.
2. No roteiro aprovado, vincule a aula ao item correspondente. Resolva divergências de número, título, objetivos e duração. Aprovar não cria aulas automaticamente.
3. Abra **Aulas → Guia → Gerar guia com IA**. Escolha modelo, versão aprovada do template e roteiro vigente; acrescente instruções e solicite a geração. A operação utiliza créditos da API escolhida.
4. A tarefa é enfileirada e executada em outro processo; acompanhe estado, progresso por etapa, tentativas e erros. O conteúdo só é salvo se atender ao schema e às seções ativas, na ordem. Toda geração cria uma nova versão em rascunho.
5. Revise no editor estruturado já existente, salve ajustes, compare versões, envie para revisão e aprove com confirmação explícita. A origem de IA identifica provedor/modelo. Código sugerido continua pendente de validação técnica.
6. Para regenerar, abra **Regenerar uma seção com IA** no guia e escolha uma seção. O restante do conteúdo salvo e as referências exatas da versão de origem são preservados em um novo rascunho. As referências devem continuar vigentes e aprovadas para uma nova geração oficial.
7. Se uma tarefa terminar enquanto você edita um guia, salve as alterações antes de abrir a nova versão gerada. Não há sobrescrita automática do editor ou aprovação automática.

Pedidos repetidos com a mesma chave retornam a mesma tarefa. Para solicitar outra chamada deliberadamente, use **Preparar nova solicitação**. Não há repetição automática de chamadas pagas. Tarefas pendentes sobrevivem ao reinício; execuções interrompidas ficam falhas ou canceladas e exigem uma nova solicitação explícita.

## Orçamento e solução de problemas

O orçamento mensal usa UTC e reserva uma estimativa conservadora de entrada mais o limite de saída antes de enfileirar. Reservas concorrentes contam para o mesmo limite. O custo registrado é uma estimativa baseada no uso informado pela API e nos preços cadastrados, preservados em cada tarefa; não é uma fatura do provedor.

Sem tokens suficientes, aparece **Custo não determinado**, e a reserva é mantida, inclusive após virada do mês, até haver conferência externa. Cancelamento antes de iniciar libera a reserva. Cancelar depois do envio pode consumir créditos e manter custo incerto. Nesta fase, não há conciliação automática nem botão para liberar reservas incertas. Configure também limites no próprio provedor para controlar a cobrança real.

- **Botão de geração desabilitado:** confira credencial, modelo e aprovação de roteiro; salve alterações manuais pendentes.
- **Vínculo ausente ou divergente:** abra o roteiro, vincule a aula e resolva as diferenças manualmente. Alterações em um roteiro aprovado exigem novo rascunho e aprovação.
- **Modelo indisponível:** confira o ID, acesso da conta e suporte a saída estruturada; remova temperatura se não aceita.
- **Saldo insuficiente:** consulte consumo, reservas e preços. Não há chamadas de geração com orçamento zero ou preços ausentes.
- **Tarefa pendente sem avançar:** reinicie o backend para iniciar o worker. Após uma interrupção abrupta, a recuperação pode aguardar até 15 segundos pela liberação da trava local.
- **Falha, tempo limite ou cancelamento:** confira o consumo na API antes de solicitar novamente. Falhas não alteram guias já salvos.

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

Uso individual no computador local, sem autenticação ou exposição na rede. A geração com IA depende de configuração e créditos de API. Não há DOCX, execução de código, capturas, publicação ou integração com NotebookLM/Canva/Drive nesta fase. Versões pedagógicas são preservadas; exclusões permitidas de registros da Fase 1 são permanentes. Consulte [arquitetura](docs/ARCHITECTURE.md), [roadmap](docs/ROADMAP.md) e relatórios das [Fases 2A](docs/PHASE_2A_REPORT.md) e [2B](docs/PHASE_2B_REPORT.md).
