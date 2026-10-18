# Fase 4A — documentos pedagógicos

Branch: `feat/fase-4-materiais-didaticos`, a partir de `2c45686` (Fase 3D). A implementação local da 4A está disponível para validação assistida. **A Fase 4 não está concluída: OAuth real, piloto e revisão visual estão pendentes. A 4B não foi iniciada.**

## Entrega local

- Edição do projeto: **Modelos e identidade visual**, com modelo Google Docs, nome, pasta, padrão de nome, notas de preparação, marcadores e modo de preenchimento. Marca, paleta e instruções visuais ficam registradas; biblioteca de imagens, logotipo, mascote e apresentações ficam para 4B. A aparência do documento nesta entrega vem do modelo.
- Configurações append-only por projeto e ajustes por aula, sem sobrescrever o padrão do projeto. Cada trabalho fotografa as configurações efetivas e seus identificadores.
- OAuth próprio do EduForge com `drive.file`, PKCE, estado com validade de dez minutos, uso único e vínculo ao navegador. Tokens e verificadores cifrados com AES-256-GCM no backend; nenhuma chave Google é enviada ao frontend. Conexão/revogação explícitas.
- Validação de link, documento nativo, permissão de cópia, quantidade de abas, estrutura DOCX e permissão de adicionar arquivos à pasta. A pasta pai só é sugerida quando sua capacidade pode ser conferida; não é selecionada automaticamente.
- Central, etapa **Documento final**: seleção explícita do guia aprovado, arquivos da revisão aprovada e registros aprovados, preparação de prévia, consentimento para envio ao Google/conversão, criação de versão e acompanhamento do trabalho.
- Cópia nativa no Drive; somente o ID dessa cópia pode receber o preenchimento. Texto estruturado, títulos, código em fonte monoespaçada e capturas PNG incorporadas ao DOCX, com legendas. Relatos manuais conservam a origem; nenhum código é executado.
- Exportação da cópia para DOCX, conferência do texto e da quantidade de desenhos, arquivo local identificado por hash, download, link Google Docs, revisão humana e histórico. Exportar não aprova o documento nem conclui a aula. O progresso considera a versão do guia e do código selecionados.
- Solicitações idempotentes, estados persistidos antes de mutações externas, histórico de eventos e recuperação explícita. Reiniciar não repete mutações automaticamente. Uma falha só na exportação retoma a leitura, sem copiar/preencher de novo.

Notas de preparação são preservadas para revisão humana, **não interpretadas por IA**. O custo registrado de IA é zero porque a 4A não chama modelos; esse campo não é uma estimativa de armazenamento ou serviços Google.

## Preenchimento e limites

O padrão exige `{{TITULO_AULA}}`, `{{OBJETIVOS}}`, `{{CONTEUDO_GUIA}}`, `{{CODIGO}}` e `{{CAPTURAS}}`, configuráveis no projeto. Guia, código e capturas ocupam parágrafos exclusivos, inclusive dentro de células. Marcadores ausentes, desconhecidos ou duplicados são bloqueados. Não se cria cópia antes dessa validação. Código/capturas selecionados exigem seus respectivos marcadores.

O modo **Substituir todo o corpo da cópia** precisa ser escolhido explicitamente na configuração. Ele remove o conteúdo antigo do corpo da cópia e conserva as partes de estilos/cabeçalhos/rodapés no pacote DOCX preparado. Tabelas, logos e imagens que estavam no corpo antigo serão removidos nesse modo. O original no Google permanece intacto.

A implementação usa Google Docs → DOCX → preenchimento OOXML → atualização/conversão da cópia → exportação DOCX. A conversão pode alterar a aparência e recursos nativos; não há garantia de identidade visual perfeita. Cabeçalhos, rodapés, tabelas, fontes, imagens e paginação precisam de revisão humana. Múltiplas abas, controles de conteúdo, alterações rastreadas e alguns elementos incompatíveis são bloqueados; não há fallback silencioso para texto puro.

Não é necessário publicar capturas privadas em uma URL: elas são incorporadas ao DOCX enviado ao Google. Exportação limitada a 10 MB; ZIP limitado a 2.000 entradas e 50 MB descomprimidos. XML com DTD/entidades, caminhos inseguros, macros e arquivos corrompidos são recusados. O armazenamento usa os limites e a verificação de integridade já empregados no módulo de código.

Há leitura de versão antes de preencher/exportar e controle condicional quando o Google fornece ETag. Sem ETag não há garantia atômica contra uma edição externa concorrente. Confira a cópia antes de retomar; se houver divergência, preserve-a e gere uma nova versão. Não edite uma cópia enquanto seu trabalho estiver em andamento.

Em resposta incerta à cópia, o sistema procura seu identificador privado no Drive e exige uma única cópia, na pasta correta, ainda correspondente ao modelo exportado. Diferenças de conversão podem impedir essa reconciliação conservadora. Em resposta incerta ao preenchimento, exige confirmação do identificador do conteúdo e confere o DOCX exportado. Falta de confirmação **não autoriza repetir a escrita**. Arquivos anteriores não são apagados para resolver falhas.

O download representa a exportação daquela geração. Edições posteriores no Google Docs não atualizam automaticamente o arquivo local.

## Preparar a conexão real

1. Em um projeto dedicado no Google Cloud, habilitar Google Drive API e Google Docs API; configurar consentimento OAuth e, se estiver em teste, incluir a conta da professora entre os usuários de teste.
2. Criar cliente OAuth apropriado para o app local. Para cliente Web, registrar exatamente `http://127.0.0.1:3001/api/google/callback` e preencher também o segredo do cliente no backend.
3. Preencher no `.env` local as variáveis documentadas em `.env.example`: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` quando aplicável, `GOOGLE_TOKEN_KEY`, `GOOGLE_REDIRECT_URI` e `EDUFORGE_PUBLIC_URL`. A chave de proteção deve ser aleatória, de 32 bytes, em base64, persistente e incluída no backup seguro. Não usar prefixo `VITE_`, não enviar esses valores no chat e não versionar `.env`.
4. Reiniciar a API para carregar as variáveis. Abrir **http://127.0.0.1:5173**, editar o projeto e clicar em **Conectar Google e autorizar arquivos/pastas**. Selecionar modelo e pasta no seletor OAuth. Somente colar links não concede ao app acesso com `drive.file`.
5. Salvar/validar a configuração, preparar a prévia na Central, conferir fontes/pasta/avisos e consentir na geração.
6. Abrir a cópia e o DOCX no Google Docs/Word, revisar todas as páginas e aprovar somente após essa conferência.

A conexão Google do ChatGPT é independente da conexão OAuth do EduForge. A API local informou `configured: false`, `connected: false` durante esta implementação; nenhum token foi copiado entre os dois ambientes.

## Piloto Frogger informado pela professora

- Modelo: [Guia da professora - Modelo](https://docs.google.com/document/d/1JGuavR3sHJXZr8WSR4mrOqE5VHQsbRANOSYpXpLfRw0/edit).
- Destino: [Resumo](https://drive.google.com/drive/folders/169_1axeUG5wEL21KCtk_anNBQ_NH77xr).
- Os dois links foram salvos como configuração v1 do projeto local **Frogger Game**, que ainda não tinha configuração de materiais. Isso foi uma configuração solicitada pela professora, não inserção de fixtures de teste. As demais aulas, guias e evidências reais foram preservados.
- Leitura pelo conector identificou um guia preenchido de Aula 38, sem os marcadores padrão no texto consultado. O preenchimento ficou no modo seguro de marcadores; antes de gerar, é necessário preparar marcadores em um modelo adequado ou escolher conscientemente substituir o corpo da cópia. Não alteramos o modelo original para adicionar marcadores.
- A pasta foi identificada como pasta nativa pelo conector. A permissão de escrita da conta OAuth **do app** ainda precisa ser verificada. O conector não comprova essa autorização.
- Nenhuma cópia real, preenchimento, upload, exportação real ou chamada paga de IA foi executada. O piloto ponta a ponta com as capturas reais e a preservação visual desse modelo **não foi validado**.

## Verificação

Os testes usam SQLite isolado, pastas temporárias e adaptadores simulados, sem dados fictícios no banco real e sem chamadas de IA/Google reais. Cobrem isolamento/versionamento das configurações e overrides; marcadores divididos em runs e em tabelas; preservação das partes originais do pacote; código, imagem e legenda incorporados; cópia e geração idempotentes; histórico, download e revisão; fontes de outra aula; falta de permissão; abas múltiplas; marcadores ausentes; falha parcial e reconciliação sem duplicar cópias ou preenchimentos; PKCE, estado de uso único, vínculo ao navegador e cifragem. A interface é exercitada em JSDOM, incluindo o formulário de configurações e a etapa final da Central.

O renderizador de DOCX empacotado foi localizado, mas `render_docx.py --help` falhou com `ModuleNotFoundError: pdf2image`; LibreOffice também não está disponível no PATH. Portanto os testes estruturais **não substituem revisão de páginas renderizadas**. Nenhum DOCX final é entregue como visualmente validado. O controle de navegador disponibilizado nesta sessão não apresentou superfícies ativas; não foi feita inspeção visual real das telas.

Resultados: **58 testes da API e 24 testes da interface passaram**; build de produção e Prettier passaram. O build informa avisos de dependências e de tamanho do bundle, sem impedir a geração. `git diff --check` não encontrou erros de whitespace. Comandos: `npm test`, `npm run build`, `npm run format:check`.

## Referências técnicas oficiais

- [Escopo drive.file](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).
- [Seletor via fluxo OAuth](https://developers.google.com/workspace/drive/picker/guides/desktop-mobile-picker).
- [OAuth de aplicação Web](https://developers.google.com/identity/protocols/oauth2/web-server).
- [Upload, conversão e atualização de arquivos](https://developers.google.com/workspace/drive/api/guides/manage-uploads).
- [Imagens inline no Docs: URLs públicas exigidas](https://developers.google.com/workspace/docs/api/reference/rest/v1/documents/request#insertinlineimagerequest).

## Próxima etapa

Concluir configuração OAuth, adaptar/escolher o modo de preenchimento e realizar o piloto visual com o modelo e a pasta acima. Corrigir eventuais diferenças de conversão antes de considerar a 4A aceita e iniciar a 4B. Não houve commit, push, merge ou deploy nesta entrega.
