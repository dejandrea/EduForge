# Fase 2C — Materiais existentes e memória pedagógica

Implementação na branch `feat/fase-2c-importacao`, a partir da Fase 2B. Especificação: [prompt da Fase 2C](prompts/Fase%202C.md). Nenhum commit, push ou merge faz parte desta solicitação.

## Uso

1. Abra um projeto e entre em **Referências**. Cadastre GitHub, Google Docs, pastas do Drive ou outros links. Cadastrar uma URL não importa seu conteúdo.
2. Na lista de aulas, abra **Materiais e memória**. Importe DOCX, PDF textual, Markdown ou TXT; consulte as extrações e baixe o original. Cada registro conserva aula, origem, data, tamanho e SHA-256. Arquivos idênticos na mesma aula não são duplicados.
3. Para aulas já ministradas, importe seu material e use **Marcar como concluída anteriormente**. Não é necessário gerar guia ou chamar IA. Os estados anteriores permanecem disponíveis; a lista distingue conclusão importada de conclusão com guia aprovado.
4. Crie um resumo manual e acrescente informações com campo pedagógico, fonte e citação literal. Salve, revise e aprove explicitamente. Os campos cobrem objetivos, conceitos novos/revisados, tecnologias, componentes/arquivos, atividades, resultado esperado e continuidade. Campos sem evidência podem permanecer ausentes.
5. Opcionalmente, selecione trechos e solicite uma análise com IA. Essa chamada consome créditos, depende de modelo/preços configurados e cria apenas um rascunho. Falhas não modificam resumos aprovados. Não há envio automático dos documentos completos.
6. Consulte **Memória pedagógica** no projeto para revisar o histórico. Novas versões substituem a aprovação vigente sem apagar as anteriores.
7. Ao gerar um guia, selecione resumos aprovados e trechos relevantes. Autorize o envio ao provedor. Divergências textuais de objetivos com o roteiro exigem revisão. O guia registra as fontes utilizadas; a revisão e aprovação continuam no editor existente.

## Extração e armazenamento

Migration incremental `005_imported_materials.sql`; migrations anteriores preservadas. Originais em `storage/materials`, ignorados no Git, com nomes derivados do hash. URLs nunca são usadas como caminhos locais. O download usa anexo e `nosniff`.

Uploads de até 10 MB, um arquivo por solicitação. ZIP do DOCX tem limite de 2.000 entradas e 50 MB descompactados, rejeita criptografia, macros e caminhos inseguros. Apenas XML do corpo e relações do documento são lidos; DTD e entidades declaradas são recusadas. Parágrafos, títulos, texto de código, hyperlinks HTTP(S) e referências de imagens são preservados quando disponíveis. Imagens não são interpretadas; cabeçalhos, notas, tabelas e formatação podem perder informações.

PDF usa extração textual, até 200 páginas, sem OCR. Digitalizações sem texto são identificadas. Texto UTF-8 de Markdown/TXT conserva a estrutura original. Extrações têm limite de 250 mil caracteres, versões imutáveis, status e limitações explícitas. O parser roda em worker thread, sem credenciais, com limite de memória e 20 segundos; a fila local processa um arquivo por vez. Extrações pendentes são retomadas na inicialização do servidor.

## GitHub

Consulta explícita de arquivos selecionados pela API REST oficial, com branch e commit fixo registrado em cada snapshot. Não clona repositório, instala dependências ou executa código. Até dez caminhos por consulta, arquivos textuais de até 100 KB e 200 KB no total. Falhas de acesso e limites de API não geram importações parciais. `GITHUB_TOKEN` é opcional e fica somente no backend. Links do Drive/Docs continuam cadastrados sem importação remota.

Código disponível é referência técnica; sua presença não prova que foi ensinado. Referências: [Contents API](https://docs.github.com/en/rest/repos/contents?apiVersion=2022-11-28) e [Commits API](https://docs.github.com/en/rest/commits/commits?apiVersion=2022-11-28).

## Memória, contexto e custos

Toda afirmação deve referenciar uma extração imutável da própria aula ou snapshot técnico do projeto e conter citação literal existente. A validação garante procedência e correspondência textual; a avaliação da conclusão pedagógica pertence à revisão humana. Aprovação é explícita, detecta versão vigente desatualizada e torna o conteúdo imutável.

Análise reutiliza provedores, fila persistida, worker, cancelamento, idempotência e cálculo de custos da Fase 2B. As duas filas compartilham orçamento e histórico de uso. Não há retries pagos automáticos. O schema de análise aceita somente informações com fontes; citações fora dos trechos enviados são recusadas. Falhas ou cancelamentos não criam memória consolidada.

Seleção de contexto aceita até vinte resumos e vinte trechos de até quatro mil caracteres; pacote adicional limitado a 24 mil caracteres. Análise aceita até 16 mil caracteres. Somente resumos vigentes aprovados da aula atual ou de anteriores podem ser escolhidos. Documentos não selecionados e repositórios inteiros não são enviados. Guias aprovados anteriores continuam sendo tratados conforme a Fase 2B. O snapshot do pedido conserva o manifesto de fontes e divergências para consulta posterior.

## Validação e limites

Verificação executada: 27 testes da API e 9 testes da interface aprovados; build de produção concluído; auditoria das dependências de produção sem vulnerabilidades conhecidas. A interface foi exercitada em DOM simulado com API/SQLite real. Não havia navegador conectado à sessão para inspeção visual.

Testes locais usam bancos e arquivos temporários, provedores de IA e GitHub simulados, sem créditos ou dados reais. Cobrem extração dos quatro formatos, PDF sem texto, formatos inválidos, caminhos inseguros, duplicatas, associação, conclusão sem guia, evidências, aprovação imutável, seleção explícita, análise inválida/falha e GitHub inacessível/limitado. A suíte anterior verifica compatibilidade das fases 1, 2A e 2B.

Não inclui OCR, importação autenticada de Drive/Docs, interpretação de imagens, execução ou validação de código, exportação DOCX, publicação ou ingestão automática do curso. A inspeção em navegador real e a avaliação com documentos pedagógicos reais devem ser realizadas no uso assistido. Backups precisam incluir banco e pasta de materiais, com a aplicação encerrada.
