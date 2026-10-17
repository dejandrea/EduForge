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

## Dados e verificação

Migrations são incrementais ao iniciar a aplicação; não apague o banco para atualizar. Para backup, encerre o EduForge e copie juntos o banco `storage/eduforge.db` e as pastas `storage/materials` e `storage/code`. Arquivos locais e credenciais ficam fora do Git.

```cmd
npm test
npm run build
npm run format:check
```

Os testes usam bancos/repositórios simulados e arquivos temporários, sem usar os dados reais do curso ou consumir créditos de IA.
