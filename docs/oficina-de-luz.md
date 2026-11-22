# LabGold — Oficina de Luz

Visual fornecido pelo usuário na pasta `LabGold-novo-visual`, adaptado ao sistema existente. O arquivo `src/app/labgold-dark.css` preserva a paleta, o dourado, o tratamento de superfícies e os raios do pacote; as imagens de óculos e lentes foram copiadas para `public/design`.

| Before | After | Why |
| --- | --- | --- |
| Interface bronze e grafite, tipografia Manrope | Escuro e dourado, Plus Jakarta Sans e JetBrains Mono | Aplicar a identidade visual enviada |
| Colunas neutras de Kanban | Colunas tingidas pela etapa e trilho de cinco processos | Facilitar o acompanhamento sem mudar os estados reais |
| Dashboard com indicadores e seções verticais | Indicadores por etapa, mini-Kanban/lista/por prazo, meta em anel e atalhos | Aproximar o layout do desenho usando os dados já carregados |
| Modo rápido sem desenho correspondente no pacote | Mesmo tema nos fluxos de lentes, expressa, manutenção, lotes e entrega | Preservar a operação completa |
| Lentes sem visão da semana | Resumo recolhível das previsões dos próximos sete dias | Organizar a chegada sem ocupar espaço permanente na lista |

## Preservação funcional

- Mantidos banco, consultas, APIs, permissões, rotas e registros existentes.
- Mantidos modo simples, modo rápido, lançamento sem OS, expressos 20/40/60, VTA, fornecedor, histórico, fotos, recebimento, liberação e retirada.
- Mantidos arraste por dnd-kit, validações de transição e regras de capacidade.
- Kanbans preservam os estados reais; não foi criado o estado fictício de acabamento mostrado na referência.
- O dashboard usa os dados existentes; nenhum número, tendência ou status online simulado foi publicado.
- A área decorativa da assistente foi adaptada para atalhos funcionais. Não foi criada uma IA, rota de API ou integração adicional.
- O escuro é o padrão quando não há preferência salva. A escolha explícita por claro continua respeitada. Impressão permanece clara.

## Acessibilidade e validação

Superfícies semânticas de sucesso, atenção e erro usam fundos opacos equivalentes aos tons do pacote para medir contraste de maneira previsível. Campos têm contorno mais visível, textos seguem os temas e o trilho da bancada mantém rótulo acessível. A prioridade continua visível além da cor.

Typecheck, lint dos arquivos alterados e 167 testes locais passaram na preparação (164 versionados e 3 locais preexistentes de arquivamento). O build final e os checks remotos são registrados na publicação. A conferência visual no navegador foi interrompida pelo controle de segurança do Computer Use ao não confirmar a URL; não declarar uma validação visual completa de todas as telas.

Os arquivos temporários de demonstração e os arquivos de arquivamento preexistentes não fazem parte desta entrega. Não houve operação no banco de produção. O aviso de segurança do Next instalado permanece; o framework não foi atualizado neste trabalho visual.
