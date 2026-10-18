# Fase 3C — Simplificação da experiência de código e IA

Branch: `feat/fase-3c-experiencia-codigo`, baseada em `feat/fase-3b-geracao-codigo-ia`.

## Diagnóstico anterior

A página reunia a autorização de importação, limites técnicos, preparações anteriores, aprovação, geração de IA, histórico de tarefas, edição/comparação de arquivos, evidências e vínculos ao guia em uma coluna longa. Preparações prontas não eram selecionadas ao abrir a aula. A professora precisava localizar a preparação antes de trabalhar; a importação permanecia em destaque mesmo quando já existia código aprovado. SHA-256 e commit completo ocupavam o fluxo principal. O aviso fixo de ausência de validação não distinguia relato manual já registrado de teste automatizado. O cadastro de evidências exigia escolher tipos técnicos e preencher formulários separados de relato e captura. Vínculos exigiam selecionar novamente guia e seção pelos identificadores internos.

Os serviços existentes já ofereciam cópias imutáveis, alterações e comparação, aprovação humana, proposta de IA com orçamento e consentimento, registros manuais, upload PNG, inspeção estática e vínculos por versão exata. A fase reorganiza essa experiência sem substituir esses mecanismos.

## Alterações e componentes

- `CodeWorkspace.jsx` / `CodeWorkspace.css`: quatro abas, navegação por setas/Home/End, área ativa acessível, progresso e próxima ação; seleção automática somente quando há uma única preparação pronta; maior número de versão como padrão; histórico com acesso a todas as preparações e versões, manifests, commit e SHA-256; importação secundária quando existe código. A troca de aula reinicializa o workspace, enquanto a troca de aba mantém os componentes montados e seus formulários preservados.
- `CodeFiles.jsx`: edição e referências técnicas mantidas; nomes principais usam versão do código; primeira comparação textual disponível é aberta ao carregar uma versão posterior. Os demais arquivos continuam disponíveis para comparação individual.
- `CodeGeneration.jsx`: guia mais recente elegível sugerido, com estado explícito; sugestão de seções com conteúdo por títulos relacionados a código/etapas/prática, revisável pela professora. Leitura de arquivos e permissões continuam exigindo seleção explícita. Geração expandida no código inicial em rascunho; em versões posteriores/aprovadas fica como ação secundária. Prévia, custos e autorização paga preservados.
- `CodeAIHistory.jsx`: tarefas e propostas pendentes na área Código; métricas completas em detalhes e histórico. Histórico abre a mesma proposta para revisão, preservando os ajustes ao navegar entre abas.
- `CodeProposalReview.jsx`: identificadores em detalhes técnicos; ação principal “Criar nova versão com este código”. Aceitar seleciona a versão recém-criada e mantém a aprovação humana separada.
- `CodeManualTest.jsx` / `CodeManualTest.css` (novos): formulário único de ambiente, resultado, observações e PNG opcional. Sugestão editável de Game Lab para arquivos com indicação de jogo. Relato gravado como `manual / manual / reported`, atribuído explicitamente à professora. Usa as rotas de evidência e captura existentes, em sequência. Se o PNG falhar após gravar o relato, a tentativa seguinte envia só a imagem, sem repetir o relato.
- `CodeEvidence.jsx`: formulário principal simplificado; inspeção de estrutura, registros anteriores, aprovação/rejeição, procedência e formulários de tipos técnicos/envio avulso continuam acessíveis.
- `CodeGuideLinks.jsx`: guia mais recente sugerido, títulos de seções do template e estados em português; associação explícita de registro/arquivo com confirmação. Consulta os vínculos atuais antes de salvar e evita duplicar a mesma combinação de guia, seção, arquivo e registro. Sugestões da IA usam somente proposta aceita cujo `result_revision_id` coincide com a versão atual; outras versões não herdam inferências incertas. Nenhuma sugestão é gravada automaticamente.
- `pedagogy.test.jsx`: regressões atualizadas para a navegação e novos testes integrados com banco temporário, provedores simulados e upload PNG até o backend. O adaptador multipart do teste converte os arquivos JSDOM para o fetch nativo do Node; não altera a aplicação.
- README e roadmap atualizados.

## Progresso e segurança

O progresso é calculado das preparações, versões, tarefas, evidências e vínculos já existentes. Não há tabela, migration ou contrato de API novo. A geração com IA é opcional e não bloqueia revisão manual. Uma versão aprovada não pede outra aprovação.

O cenário Aula 3/Frogger com código importado, versão 2 aprovada e sem registros de teste destaca **Registrar teste e captura**. Um teste realizado fora do app só aparece como registrado após relato explícito; o app não presume o que aconteceu no Code.org. A conclusão documental considera código aprovado, relato manual não rejeitado, aprovação humana de um relato de teste ou captura e vínculo de registro ao guia. A captura é opcional: um relato manual aprovado também atende à revisão documental. Não representa teste automatizado, publicação ou certificação funcional.

Os guias, inclusive aprovados, são apenas referenciados. Origem, histórico, aprovações por hash e limites existentes permanecem preservados. Nenhuma chamada paga ou execução de código gerado foi usada na implementação.

## Verificação

- Regressão API: 47 testes aprovados.
- Interface: 17 testes aprovados, incluindo seis novos cenários da fase 3C.
- Build de produção e `format:check` aprovados; `git diff --check` sem erros. Avisos conhecidos de diretivas do React Router e comentários do Zod não impedem o build.
- Aplicação local: interface HTTP 200 e `/api/health` via proxy retornando `status: ok`.
- Cenários cobertos: preparação existente e versão mais recente, aprovação, geração com consentimento/aceitação/rascunho, relato manual, PNG, aprovação do registro, associação confirmada e prevenção de duplicatas, preservação de texto/instruções/arquivo entre abas, teclado, falta de guia/modelo/referência, erro de gravação, envio inválido e nova tentativa sem duplicação.

## Limitações e validação assistida

O inventário da ferramenta de interface retornou `apps: []` e `browsers: []`; não foi possível realizar inspeção visual em navegador real nesta sessão. A validação de interação usa DOM/JSDOM e requisições reais ao servidor de teste. Permanecem pendentes a inspeção visual de desktop/celular e o aceite assistido pela professora no Frogger real. Não foram alterados dados reais para criar registros artificiais de teste.

A sugestão de ambiente/seções é revisável, baseada em nomes; não representa análise semântica ou execução. Uma proposta aceita pode sugerir várias seções, mas a professora escolhe a associação adequada. Sem proposta correspondente, não se inventa uma seção.

Relatos antigos do tipo `test` são reconhecidos como manuais; registros genéricos `manual` precisam identificar teste/validação manual na descrição ou no resultado para contar na etapa de testes. Uma simples anotação de arquivo ou a observação automatizada da importação não são consideradas testes realizados.

A prevenção de vínculo duplicado é feita no cliente, com consulta imediatamente antes de gravar; duas sessões concorrentes ainda podem gerar duplicação, pois o contrato e o banco anteriores não impõem unicidade. Relato e captura usam duas operações existentes, sem transação conjunta; sucesso parcial é informado e permite completar o envio sem duplicar o relato na mesma sessão. Recarregar a página perde formulários ainda não enviados; navegar entre abas não perde os dados.

Para aceite manual: abrir Aula 3 → confirmar versão aprovada e ação recomendada → registrar o teste do Code.org com PNG → revisar/aprovar o registro de captura → confirmar seção do guia → voltar à visão geral e verificar a conclusão documental. Conferir o histórico e repetir a navegação entre abas com texto e captura ainda não enviados.

Sem commit, push, merge ou deploy nesta fase de implementação.
