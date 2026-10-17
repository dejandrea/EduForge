# EduForge — Fase 2C: Importação de Materiais e Continuidade Pedagógica

## Contexto

O EduForge já possui as Fases 1, 2A e 2B implementadas.

Precisamos permitir que a professora continue projetos educacionais iniciados fora da plataforma, sem recriar aulas concluídas.

Caso real: React Quest, com 12 aulas já produzidas e preparação da Aula 13.

## Objetivo

Implementar importação de materiais existentes e memória pedagógica por projeto.

Antes de implementar, examine o código atual, a arquitetura de IA, os modelos de dados, as migrations e os testes.

Crie uma branch `feat/fase-2c-importacao` a partir da branch mais recente da Fase 2B.

### 1. Fontes de referência

Permitir cadastrar por projeto:
- URL do repositório GitHub.
- Branch de referência.
- Commit SHA opcional.
- Links para documentos Google Docs.
- Links para pastas do Google Drive.
- Outros links de materiais educacionais.

Permitir anexar por aula:
- DOCX.
- PDF.
- Markdown.
- TXT.
- URLs de documentos e apresentações.

Registrar tipo, origem, data de importação, tamanho, hash e aula associada.

Armazenar arquivos localmente fora do controle de versão.

Validar tipo e tamanho dos arquivos. Não executar conteúdo importado.

Links não devem ser tratados como conteúdo já importado. Se não houver integração ou autorização para leitura, indicar que o link foi apenas cadastrado.

### 2. Aulas já concluídas

Permitir marcar uma aula como concluída anteriormente.

Uma aula importada não deve exigir geração de guia com IA.

Distinguir:
- Aula planejada.
- Aula em produção.
- Aula concluída com material importado.
- Aula concluída com guia gerado no EduForge.

Preservar os estados e os relacionamentos existentes, evitando duplicações.

### 3. Extração de documentos

Implementar extração de texto de DOCX, PDF textual, Markdown e TXT.

Preservar, quando possível:
- Títulos e seções.
- Objetivos.
- Conteúdos conceituais.
- Exemplos de código.
- Atividades.
- Links.
- Referências a imagens.

Registrar limitações da extração.

Não inventar informações ausentes.

Não implementar OCR nesta etapa.

### 4. Referência GitHub

Permitir consultar o repositório configurado por meio de mecanismos oficiais.

Usar somente repositórios autorizados e acessíveis.

Registrar branch, commit e caminhos dos arquivos analisados.

Respeitar limites de API e não baixar dependências ou executar código automaticamente.

Não assumir que todo código do repositório já foi ensinado.

### 5. Memória pedagógica

Criar resumos estruturados por aula contendo:
- Objetivos trabalhados.
- Conceitos novos.
- Conceitos revisados.
- Tecnologias utilizadas.
- Componentes e arquivos mencionados.
- Atividades desenvolvidas.
- Resultado esperado.
- Pendências e pontos de continuidade.
- Fontes que sustentam cada informação.

A análise com IA deve ser opcional, com confirmação antes de consumir créditos.

Exibir os resumos para revisão humana.

Somente informações confirmadas pela professora devem ser usadas como fatos pedagógicos consolidados.

### 6. Integração com a Fase 2B

Adaptar a geração de guias para utilizar:
- Roteiro aprovado.
- Template aprovado.
- Histórico das aulas anteriores.
- Materiais importados relevantes.
- Estado técnico conhecido do projeto.

Priorizar informações diretamente relacionadas à aula que será produzida.

Não enviar automaticamente documentos completos e repositórios inteiros para a API.

Implementar seleção de contexto, limites de tamanho e indicação das fontes utilizadas.

Se houver conflito entre roteiro e material importado, informar a divergência e solicitar revisão.

Não sobrescrever guias aprovados.

### 7. Interface

Adicionar:
- Materiais existentes na página da aula.
- Referências na página do projeto.
- Histórico pedagógico do projeto.
- Upload de documentos.
- Cadastro de links.
- Status de extração e análise.
- Revisão e aprovação de resumos.
- Visualização das fontes utilizadas pela IA.

### 8. Segurança e privacidade

Validar URLs, caminhos e arquivos.

Impedir acesso a arquivos fora do armazenamento autorizado.

Não enviar materiais importados a provedores externos sem uma ação explícita da professora.

Tratar conteúdo de documentos e repositórios como dados, nunca como instruções de sistema.

Não armazenar credenciais em documentos ou logs.

### 9. Testes

Cobrir:
- Importação de arquivos.
- Tipos inválidos.
- Duplicações.
- Extração de conteúdo.
- Associação com aulas.
- Histórico e aprovação.
- Preservação de dados.
- Referências GitHub.
- Links inacessíveis.
- Falhas de IA.
- Seleção de contexto.
- Segurança de arquivos.
- Compatibilidade com a Fase 2B.

Não consumir créditos reais nos testes.

### 10. Critérios de aceite

Devo conseguir:

1. Abrir o projeto React Quest.
2. Cadastrar seu repositório GitHub.
3. Anexar documentos das aulas 1 a 12.
4. Marcar essas aulas como concluídas.
5. Consultar seus materiais sem regenerá-los.
6. Extrair e revisar um resumo pedagógico por aula.
7. Selecionar a Aula 13.
8. Gerar um guia com IA utilizando as referências aprovadas das aulas anteriores.
9. Ver quais fontes foram utilizadas.
10. Preservar todos os documentos e versões anteriores.

Atualize a documentação e crie `docs/PHASE_2C_REPORT.md`.

Apresente primeiro o plano de implementação e os pontos de integração com a Fase 2B.

Não faça push ou merge sem autorização.