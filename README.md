# EduForge 🎓

**Da ideia à aula pronta.**

O EduForge é uma plataforma de automação pedagógica desenvolvida para facilitar o planejamento, a criação e a organização de conteúdos educacionais.

Com integração de inteligência artificial, a aplicação auxilia professores na estruturação de roteiros, geração de guias didáticos, revisão de conteúdos e acompanhamento da evolução pedagógica dos projetos.

A plataforma prioriza a continuidade entre as aulas, a reutilização de materiais, o versionamento de conteúdos e a autonomia do professor, mantendo a revisão e a aprovação humana como etapas fundamentais do processo.

**Tecnologias:** React, JavaScript, Vite, Node.js, Express, SQLite, Zod e APIs de Inteligência Artificial.

## Executar localmente

Requisitos: Node.js 22.13 ou superior, npm e Git instalado no PATH para preparar repositórios. No CMD, dentro da pasta do projeto:

```cmd
npm install --ignore-scripts
npm run dev
```

Abra **http://127.0.0.1:5173**. API em `http://127.0.0.1:3001/api/health`. No PowerShell, use `npm.cmd` se a política de scripts bloquear `npm`. Encerre com Ctrl+C. Preserve o `.env` existente; chaves de IA são usadas somente no backend.

## Código e capturas — Fase 3

Em **Aulas → Código e capturas**, selecione uma referência GitHub do projeto, branch e objetivo técnico. Autorize a cópia pública, consulte os arquivos e proponha alterações em novas revisões. A pasta original nunca é editada. Compare e aprove o conjunto de arquivos por hash.

A inspeção estática identifica arquivos, dependências, scripts declarados e possíveis referências ausentes. **Execução de testes/builds e captura automática estão indisponíveis sem um executor realmente isolado.** Uma cópia de arquivos não fornece esse isolamento.

Use o upload manual de capturas PNG (até 5 MB, 4096 × 4096), registre evidências e associe-as à versão e etapa do guia. Aprovar uma captura ou revisão de código não comprova testes funcionais e não publica no GitHub. Nenhum repositório é enviado automaticamente à IA.

Limites, endpoints, fluxo e pendências em [Relatório da Fase 3](docs/PHASE_3_REPORT.md). Documentação anterior: [arquitetura](docs/ARCHITECTURE.md), [roadmap](docs/ROADMAP.md), [Fase 2B](docs/PHASE_2B_REPORT.md) e [Fase 2C](docs/PHASE_2C_REPORT.md).

## Evolução do código com IA — Fase 3B

Em **Aula → Código e capturas**, abra uma preparação pronta, escolha a revisão e abra **Gerar evolução do código com IA**. Selecione o guia da mesma aula, as seções necessárias e os arquivos para leitura. Autorize separadamente alteração, remoção ou criação de caminhos específicos.

A prévia local mostra os trechos enviados, custo estimado e saldo antes de qualquer chamada paga. A geração requer confirmação explícita, usa os provedores/modelos/orçamento já configurados e produz uma proposta, sem executar código. Guias em rascunho também podem ser selecionados; o conteúdo autorizado fica fotografado na tarefa.

Revise a comparação, ajuste e aceite ou rejeite. Aceitar cria outra revisão em rascunho; a origem e o guia permanecem preservados. O histórico mostra modelo, uso e custos. Compatibilidade com Game Lab e assets precisa de verificação manual da professora. Não há execução ou publicação automática.

Fluxo, limites, endpoints e teste da Aula 3 do Frogger: [Relatório da Fase 3B](docs/PHASE_3B_REPORT.md).

## Experiência de código — Fase 3C

Em **Aula → Código e capturas**, a **Visão geral** mostra o progresso e recomenda o próximo passo. Uma única preparação pronta é selecionada automaticamente, com a versão mais recente do código. Se houver mais de uma, escolha o código de partida existente; não é preciso importar outra vez.

Use **Código** para editar, gerar e comparar propostas e aprovar uma versão; **Evidências** para registrar o teste realizado por você, anexar PNG e associar os registros ao guia; **Histórico** para consultar preparações, versões, custos e identificadores técnicos. Trocar de aba preserva formulários e capturas ainda não enviados. A geração continua opcional e depende de prévia e consentimento explícito.

Para código já aprovado, a ação recomendada é **Registrar teste e captura**. O formulário registra ambiente, resultado e observações como relato manual da professora. A aprovação da captura e a associação ao guia são decisões separadas. Sugestões vindas da IA só aparecem para a proposta que criou aquela versão e precisam de confirmação; o guia permanece preservado.

Detalhes e verificação: [Relatório da Fase 3C](docs/PHASE_3C_REPORT.md).

## Dados e verificação

Migrations são incrementais ao iniciar a aplicação; não apague o banco para atualizar. Para backup, encerre o EduForge e copie juntos o banco `storage/eduforge.db` e as pastas `storage/materials` e `storage/code`. Arquivos locais e credenciais ficam fora do Git.

```cmd
npm test
npm run build
npm run format:check
```

Os testes usam bancos/repositórios simulados e arquivos temporários, sem usar os dados reais do curso ou consumir créditos de IA.
