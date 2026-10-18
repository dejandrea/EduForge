# EduForge — Fase 4: Documentos e apresentações com identidade visual por projeto

## Objetivo

Implementar a geração de materiais didáticos na Central de Produção de Conteúdo, aproveitando os dados já existentes das aulas.

A Fase 4 terá duas entregas:

- **4A — Documentos pedagógicos:** geração a partir de modelos do Google Docs, com cópia no Google Drive.
- **4B — Apresentações:** geração de slides PowerPoint editáveis, com identidade visual, mascote e personalização por prompt.

O objetivo é eliminar a necessidade de copiar manualmente textos, códigos e imagens para montar materiais de aula.

## 1. Preparação obrigatória

Antes de implementar:

1. Identificar a branch mais recente e validada, incluindo a Fase 3D.
2. Inspecionar a estrutura atual de projetos, aulas, referências, templates e Central de Produção.
3. Reutilizar serviços, componentes, autenticação e persistência existentes.
4. Criar a branch `feat/fase-4-materiais-didaticos`.
5. Não modificar dados reais durante os testes.
6. Não executar chamadas pagas de IA sem autorização.
7. Não realizar push, merge ou deploy sem autorização.

Implementar primeiro a Fase 4A, validar e então continuar para a 4B.

## 2. Configurações de materiais por projeto

Adicionar ao cadastro ou edição de cada projeto uma seção:

**Modelos e identidade visual**

Essa seção deverá permitir configurar:

### Documento de referência

- Link do documento-base do Google Docs.
- Nome do modelo.
- Identificação do arquivo no Drive.
- Pasta de destino.
- Padrão de nome para documentos gerados.
- Instruções adicionais de preenchimento.

A configuração pertence ao projeto, não à plataforma inteira.

Projetos diferentes podem utilizar documentos-base e pastas diferentes.

A professora poderá alterar o modelo de um projeto sem afetar documentos gerados anteriormente.

### Identidade visual

- Nome da marca ou instituição.
- Logotipo.
- Mascote.
- Biblioteca de imagens.
- Paleta de cores.
- Instruções visuais.
- Prompt padrão para apresentações.

Permitir configurações específicas por aula, sem sobrescrever os padrões do projeto.

## 3. Integração com Google Drive e Google Docs

Implementar integração autorizada com Google Drive e Google Docs.

O usuário deverá conectar sua conta Google por um fluxo OAuth seguro.

Solicitar somente os escopos necessários.

Não armazenar credenciais em arquivos versionados ou expô-las ao frontend.

### Validação do modelo

Ao informar o link:

1. Validar a URL.
2. Identificar o documento.
3. Confirmar que o usuário autorizado consegue acessá-lo.
4. Identificar a pasta de origem.
5. Verificar as permissões necessárias para criar uma cópia.
6. Exibir nome e informações básicas do documento.

Não presumir que uma URL pública concede permissão de edição.

### Criação do documento

Ao gerar o material:

1. Recuperar o modelo configurado para o projeto.
2. Recuperar a versão selecionada do guia pedagógico.
3. Recuperar código e evidências selecionadas.
4. Criar uma cópia do documento-base.
5. Salvar a cópia na pasta configurada para o projeto.
6. Inserir o conteúdo pedagógico na cópia.
7. Preservar, sempre que tecnicamente possível, cabeçalhos, rodapés, logotipos, tabelas e estilos.
8. Registrar o ID e a URL do documento gerado.
9. Disponibilizar o link na Central de Produção.

**Nunca modificar o documento-base diretamente.**

Quando a pasta de destino não for informada, oferecer a pasta do modelo como sugestão, após verificar que o usuário tem permissão para criar arquivos nela.

Não presumir que todos os arquivos estão no Meu Drive: considerar unidades compartilhadas e restrições de permissão.

### Limitações de formatação

Inspecionar a estrutura real do Google Docs e identificar elementos que não possam ser preservados ou editados com segurança.

Não reconstruir cabeçalhos e rodapés desnecessariamente.

Se o modelo possuir áreas fixas e áreas variáveis, priorizar marcadores explícitos, por exemplo:

`{{TITULO_AULA}}`

`{{OBJETIVOS}}`

`{{CONTEUDO_GUIA}}`

`{{CODIGO}}`

`{{CAPTURAS}}`

Os marcadores devem ser configuráveis e validados.

Não substituir marcadores ausentes silenciosamente.

Para conteúdos ricos, como imagens, tabelas e código, utilizar inserção estruturada; não depender exclusivamente de substituição de texto.

Se uma operação não puder preservar a formatação, informar a limitação e oferecer revisão.

## 4. Geração do guia pedagógico

Utilizar o conteúdo existente da aula.

Preservar:

- Identificação.
- Objetivos.
- Propósito.
- Metodologia.
- Preparação.
- Condução passo a passo.
- Explicações técnicas.
- Código.
- Capturas.
- Testes.
- Avaliação.
- Encerramento.

Respeitar a ordem do guia.

Não reescrever automaticamente conteúdo aprovado.

Permitir selecionar a versão do guia e as evidências que entrarão no documento.

Não exigir novos uploads de capturas já existentes.

Disponibilizar também exportação DOCX, quando suportada, preservando o documento editável no Google Drive.

## 5. Fase 4B — Geração de apresentações

Adicionar à Central de Produção a opção:

**Criar apresentação da aula**

A apresentação deverá ser baseada no guia pedagógico, no código e nas capturas da aula.

Permitir escolher:

- Template visual.
- Prompt personalizado.
- Quantidade aproximada de slides.
- Faixa etária.
- Duração.
- Imagens.
- Mascote.
- Estilo de linguagem.
- Modo de geração.

A apresentação deverá ser editável em PowerPoint.

## 6. Identidade visual dos slides

Criar um template inicial divertido, moderno e relacionado à programação.

Direção visual:

- Fundo escuro, azul-marinho ou grafite.
- Circuitos eletrônicos sutis.
- Elementos de computadores e programação.
- Detalhes em ciano, roxo e verde.
- Blocos de código semelhantes a editores.
- Alto contraste.
- Tipografia legível.
- Composições variadas, mantendo identidade consistente.

Criar layouts reutilizáveis para:

- Abertura.
- Objetivos.
- Explicações.
- Código.
- Demonstrações.
- Perguntas.
- Desafios.
- Resultados.
- Encerramento.

Não gerar uma imagem diferente para cada slide.

Priorizar layouts locais e imagens reutilizáveis.

## 7. Biblioteca de mascotes e imagens

Permitir que cada projeto possua sua própria biblioteca visual.

Aceitar:

- Upload de imagens.
- Logotipos.
- Mascotes.
- Imagens PNG, JPEG, WebP e SVG seguro.
- Referências a arquivos ou pastas do Google Drive.
- Imagens específicas de uma aula.

Para pastas do Drive, usar a integração autorizada para listar e importar arquivos selecionados.

Não depender de links públicos quando o usuário já autorizou o acesso.

Registrar a origem e evitar importações duplicadas.

Permitir categorizar imagens como:

- Mascote principal.
- Mascote explicando.
- Mascote curioso.
- Mascote comemorando.
- Mascote apresentando desafios.
- Logotipo.
- Fundo.
- Ilustração.
- Captura da aula.

## 8. Geração opcional de poses do mascote

Permitir gerar novas poses e expressões com IA.

A professora poderá selecionar uma imagem existente como referência e descrever a nova pose.

Exemplos:

- Explicando um conceito.
- Apontando para um código.
- Fazendo uma pergunta.
- Comemorando uma conquista.
- Demonstrando dúvida.
- Apresentando um desafio.

Requisitos:

- Preservar a identidade visual do mascote tanto quanto o modelo permitir.
- Exibir a imagem de referência selecionada.
- Exigir autorização antes de chamar a API.
- Mostrar estimativa de custo quando houver preços disponíveis.
- Identificar quando a estimativa não puder ser calculada com confiança.
- Permitir revisar o resultado.
- Salvar imagens aprovadas na biblioteca do projeto.
- Reutilizar imagens geradas em outras aulas.
- Nunca gerar imagens automaticamente para todos os slides.

Se o provedor ou modelo configurado não suportar geração ou edição de imagens, informar a limitação.

Não simular a funcionalidade usando um modelo somente de texto.

## 9. Prompt personalizado

Criar um campo:

**Instruções para gerar a apresentação**

Permitir:

- Escrever ou colar um prompt.
- Salvar como padrão do projeto.
- Criar variações por aula.
- Restaurar o padrão.
- Consultar o prompt utilizado em uma geração anterior.

O prompt poderá definir:

- Estilo visual.
- Linguagem.
- Uso do mascote.
- Quantidade de texto.
- Organização dos slides.
- Tipos de exemplos.
- Interatividade.
- Uso de código e capturas.

As instruções personalizadas não poderão desativar controles de segurança, autorização de custos ou validação dos materiais.

## 10. Modos de geração

Implementar três possibilidades:

### Modo econômico

- Montagem local.
- Templates existentes.
- Imagens existentes.
- Sem chamadas de IA.
- Custo de API zero.

### Modo assistido

- IA para organizar o roteiro dos slides.
- Layout e exportação locais.
- Reutilização de imagens.
- Prévia de custo e autorização.

### Modo visual

- IA para roteiro, quando autorizada.
- Geração opcional de novas poses ou ilustrações.
- Custos separados por operação.
- Revisão humana antes de utilizar as imagens.

O usuário deverá conseguir gerar apresentações úteis sem depender do modo mais caro.

## 11. Editor e prévia

Permitir revisar a sequência antes de exportar.

Funcionalidades:

- Visualizar slides.
- Editar textos.
- Reordenar.
- Excluir.
- Adicionar.
- Escolher imagens.
- Trocar poses do mascote.
- Ajustar conteúdo de código.
- Exportar PPTX.

Não permitir que blocos extensos de código sejam reduzidos a fontes ilegíveis.

Dividir o conteúdo quando necessário.

Implementar verificações de sobreposição, cortes e imagens distorcidas.

## 12. Persistência

Registrar para cada documento ou apresentação:

- Projeto.
- Aula.
- Versão do guia.
- Revisão de código.
- Evidências.
- Template.
- Prompt.
- Imagens utilizadas.
- Modelo de IA.
- Custo estimado e consumo, quando aplicável.
- Data.
- Versão.
- Estado de revisão.
- ID ou caminho do arquivo final.

Preservar versões anteriores.

Não sobrescrever arquivos sem confirmação.

## 13. Segurança e controle de custos

- Credenciais apenas no backend.
- OAuth seguro para Google.
- Escopos mínimos.
- Verificação de permissões.
- Sem chamadas pagas automáticas.
- Sem geração de imagens em lote sem autorização.
- Sem modificar documentos-base.
- Sem execução de código importado.
- Sem alterar dados reais nos testes.
- Sem assumir que o usuário possui créditos gratuitos de API.

## 14. Testes obrigatórios

Testar:

- Projetos com modelos diferentes.
- Alteração de modelo.
- Pasta de destino diferente.
- Google Docs sem permissão.
- Google Docs com marcadores ausentes.
- Preservação do original.
- Criação de cópia.
- Inserção de texto, código e imagens.
- Falhas parciais e recuperação.
- Exportação DOCX.
- Exportação PPTX.
- Prompts personalizados.
- Biblioteca de imagens.
- Mascote reutilizado.
- Modo econômico sem IA.
- Autorização e custo dos modos pagos.
- Regeneração sem perda das versões anteriores.
- Integração com a Central de Produção.

Utilizar mocks e fixtures para testes automatizados.

Não consumir créditos reais.

## 15. Piloto — Frogger Game, Aula 3

Utilizar os dados já existentes da Aula 3.

Fluxo esperado:

1. Abrir o projeto Frogger Game.
2. Configurar seu documento-base do Google Docs.
3. Configurar biblioteca visual e prompt.
4. Abrir a Central de Produção.
5. Selecionar Aula 3.
6. Criar uma cópia do documento-base na pasta configurada.
7. Inserir o guia, código e capturas.
8. Revisar o Google Docs gerado.
9. Gerar a apresentação.
10. Revisar slides, mascote e imagens.
11. Exportar PPTX.

Não recriar o guia nem gerar código novamente.

## 16. Entregáveis

- Integração Google Drive/Docs.
- Configuração de modelos por projeto.
- Geração de cópias.
- Exportação DOCX.
- Biblioteca visual.
- Prompt de apresentação.
- Gerador de slides.
- Geração opcional de poses do mascote.
- Editor básico de slides.
- Exportação PPTX.
- Integração com a Central de Produção.
- Testes.
- Documentação.

Criar `docs/PHASE_4_REPORT.md`.

Atualizar README, roadmap e arquitetura.

## 17. Critério de sucesso

A professora deve conseguir produzir materiais de uma aula sem recriar informações já cadastradas.

O documento deve respeitar o modelo institucional do projeto.

Os slides devem ser visualmente interessantes, editáveis e adequados à faixa etária.

O sistema deve priorizar economia, reutilização de recursos e revisão humana.

**A Fase 4 só estará concluída quando os arquivos produzidos forem realmente utilizáveis em aula, e não apenas tecnicamente exportáveis.**

Implemente primeiro a Fase 4A e apresente os resultados e testes antes de iniciar a Fase 4B.

Não faça push, merge, deploy ou publicação sem autorização.