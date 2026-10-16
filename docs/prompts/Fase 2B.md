# EduForge — Fase 2B: Geração Pedagógica com IA

Você é um engenheiro de software sênior especializado em React, Node.js, Express, SQLite, Zod, integrações com LLMs e sistemas educacionais.

## Contexto

Repositório: https://github.com/dejandrea/EduForge

O EduForge é uma plataforma local de automação de conteúdos educacionais.

As Fases 1 e 2A foram desenvolvidas. A aplicação já permite cadastrar projetos e aulas.

A professora identificou uma pendência: não encontrou a opção de cadastrar o roteiro pedagógico na interface.

**Antes de implementar a Fase 2B, investigue e resolva essa pendência da Fase 2A.**

Trabalhe sobre o estado atual do repositório local. Preserve as alterações e os dados existentes.

## ETAPA 0 — Auditoria e conclusão da Fase 2A

Trabalhe a partir da branch feat/fase-2a-roteiros, preservando integralmente as funcionalidades implementadas.

Crie uma nova branch feat/fase-2b-ia a partir dela.

Antes de começar, leia:

docs/PHASE_2A_REPORT.md

apps/api/src/pedagogy.js

packages/shared/src/pedagogy.js

apps/web/src/pages/Roadmap.jsx

apps/web/src/pages/Guides.jsx

apps/web/src/pages/Templates.jsx

As migrations 002 e 003.

Regras de integração

Não recriar o cadastro de roteiros, templates, aprovação ou editor de guias.

Reutilizar guideSchema como contrato para persistência do conteúdo gerado, ampliando-o apenas se houver necessidade comprovada.

Manter as referências exatas de versão do roteiro e do template.

Gerar conteúdo apenas para as seções ativas do template selecionado, preservando a ordem.

Respeitar seções obrigatórias e opcionais.

Não modificar versões aprovadas ou substituídas.

Salvar cada geração como nova versão em rascunho, sem sobrescrever conteúdo existente.

Reutilizar as APIs de aprovação e revisão já implementadas.

Implementar regeneração de seções criando uma nova versão, preservando o restante do conteúdo.

Manter a vinculação entre aulas e itens do roteiro, verificando se a aula selecionada corresponde ao planejamento aprovado.

Criar novas migrations para tarefas, execuções e custos, sem alterar as migrations 001, 002 ou 003.

Manter compatibilidade com os testes existentes e acrescentar testes com provedores simulados.

A interface deverá acrescentar a ação Gerar com IA à página de guias já existente, e não criar um segundo editor independente.

Continue com as etapas de provedores, configurações, geração, tarefas assíncronas, revisão, custos, testes e documentação do prompt original da Fase 2B.

Antes de implementar, apresente as alterações arquiteturais necessárias e identifique os pontos de integração com a Fase 2A.

## ETAPA 1 — Arquitetura de provedores de IA

Criar um módulo desacoplado de provedores.

Preparar suporte para:

- OpenAI API.
- Gemini API.

Cada provedor deve implementar uma interface comum para:
- Listar modelos configurados.
- Gerar conteúdo estruturado.
- Retornar dados de uso quando disponíveis.
- Normalizar erros.
- Respeitar limites de tempo e cancelamento.

Não fixar nomes de modelos como única opção. Permitir configuração e validar modelos suportados.

Não usar as assinaturas ChatGPT Plus ou Gemini Plus como se fossem créditos de API.

## ETAPA 2 — Configurações

Adicionar uma seção **Configurações → Inteligência Artificial**.

Permitir:
- Selecionar provedor.
- Configurar modelo.
- Informar credencial de API.
- Testar conexão mediante ação explícita.
- Configurar limite de custo mensal.
- Definir limite de saída e parâmetros suportados pelo modelo.
- Consultar histórico de consumo.

As chaves devem ficar somente no backend, preferencialmente em variáveis de ambiente ou armazenamento seguro do sistema operacional.

Não expor chaves ao frontend, ao banco de preferências, aos logs ou ao Git.

Não realizar chamadas de teste automaticamente ao abrir a página.

## ETAPA 3 — Geração de guias pedagógicos

Adicionar à página de aula a ação **Gerar guia com IA**.

A geração deve utilizar:
1. Projeto e suas configurações.
2. Versão aprovada do roteiro.
3. Item correspondente à aula.
4. Template pedagógico selecionado.
5. Conteúdo aprovado de aulas anteriores, quando disponível.
6. Instruções adicionais da professora.

Não inventar conteúdo de aulas anteriores quando ele não existir.

Se o roteiro não estiver aprovado, impedir a geração oficial e orientar a professora a concluir a aprovação.

A IA deve produzir conteúdo estruturado e validável, não apenas uma string Markdown gigante.

Utilizar schemas Zod e validar se todas as seções obrigatórias foram retornadas.

### Regras pedagógicas

O guia deve ser suficientemente detalhado para que uma professora substituta consiga conduzir a aula.

Deve conter:
- Explicações conceituais.
- Passo a passo de execução.
- Falas e orientações para a professora.
- Perguntas para os alunos.
- Pontos de verificação.
- Possíveis dificuldades.
- Critérios de avaliação informal.
- Objetivos pedagógicos.
- Pilares da aula.
- Habilidades de pensamento computacional.
- Encerramento e mensagem final.

Respeitar a duração e a progressão pedagógica do projeto.

Distinguir conceitos novos dos conteúdos que estão sendo revisados.

Não inventar códigos, arquivos, capturas, resultados de testes ou links.

Quando não houver implementação técnica verificada, marcar os trechos de código como propostas pendentes de validação.

## ETAPA 4 — Execução assíncrona

A geração não deve bloquear uma requisição HTTP longa.

Criar um sistema local de tarefas persistidas com:
- ID.
- Tipo.
- Status.
- Data de início e término.
- Progresso.
- Erros.
- Tentativas.
- Referência aos artefatos.
- Dados de consumo.

Estados mínimos:
- pending.
- running.
- completed.
- failed.
- cancelled.

Executar tarefas em worker separado do servidor HTTP.

Evitar executar duas vezes a mesma geração após reinicialização ou falha.

Não repetir automaticamente chamadas pagas sem limites.

## ETAPA 5 — Revisão do conteúdo

Após a geração, apresentar o guia em um editor estruturado.

Permitir:
- Revisar cada seção.
- Editar manualmente.
- Salvar rascunho.
- Solicitar regeneração de uma seção específica.
- Comparar versões.
- Aprovar o conteúdo.

Uma regeneração não deve sobrescrever uma versão aprovada.

Preservar o histórico e registrar qual provedor e modelo produziram cada versão.

## ETAPA 6 — Custos

Registrar, quando disponibilizados pela API:
- Provedor.
- Modelo.
- Tokens de entrada.
- Tokens de saída.
- Tokens em cache, se aplicável.
- Custo estimado.
- Data e tarefa correspondente.

Manter uma tabela configurável de preços por modelo, com data de atualização.

Quando não houver dados suficientes para calcular o custo, exibir **Custo não determinado**, em vez de apresentar R$ 0.

Converter moedas apenas quando houver taxa de câmbio configurada e identificada.

Implementar limite mensal de orçamento com bloqueio preventivo de novas gerações quando o custo estimado ultrapassar o saldo permitido.

## ETAPA 7 — Testes

Criar testes para:
- Cadastro e aprovação de roteiro.
- Vinculação de aulas existentes.
- Estrutura dos templates.
- Geração com provedor simulado (mock).
- Falha de API.
- Resposta incompleta.
- JSON inválido.
- Credenciais ausentes.
- Limites de orçamento.
- Cancelamento e reinício de tarefas.
- Persistência de versões.
- Imutabilidade do conteúdo aprovado.
- Regeneração de uma única seção.
- Proteção de credenciais.

Os testes automatizados não devem consumir créditos reais.

## ETAPA 8 — Interface

Manter o tema escuro e o padrão visual existente.

Adicionar:
- Acesso ao roteiro pela página do projeto.
- Configurações de IA.
- Seleção de provedor e modelo.
- Botão Gerar guia com IA.
- Indicador de execução.
- Visualização e edição das seções.
- Histórico de versões.
- Aprovação.
- Histórico de consumo.

Usar CSS separado por página/componente.

## ETAPA 9 — Documentação

Atualizar README, arquitetura e roadmap.

Criar `docs/PHASE_2B_REPORT.md`.

Documentar configuração das APIs, limites de custos, fluxo de geração, aprovação e solução de problemas.

## Restrições

- Não implementar exportação DOCX nesta fase.
- Não automatizar NotebookLM ou Canva.
- Não executar código gerado pela IA.
- Não publicar conteúdos automaticamente.
- Não usar chamadas pagas durante os testes sem autorização explícita.
- Não modificar o banco apagando dados existentes.
- Não fazer push ou merge sem autorização.

## Entrega esperada

Primeiro apresente o diagnóstico da Fase 2A e o plano de implementação.

Resolva a ausência do cadastro de roteiro.

Depois implemente a Fase 2B.

Execute os testes e o build.

Entregue relatório com funcionalidades, arquivos modificados, testes, pendências e instruções de uso.

Pare antes da Fase 3.