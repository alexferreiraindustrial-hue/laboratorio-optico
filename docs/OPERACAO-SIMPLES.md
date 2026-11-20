# Operação simples do laboratório

## O que mudou

| Antes | Depois | Motivo |
|---|---|---|
| Início com indicadores e várias escolhas | Pergunta “O que você precisa fazer?” e quatro tarefas | Orientar quem está começando |
| Menu com muitos grupos | Menu Dia a dia com tarefas numeradas | Reduzir procura e memorização |
| Cadastro por comandos e lote | Formulário com vendedor, OS e prazo | Evitar exigir atalhos ou sintaxe |
| Salvamento instantâneo disponível | Cadastro guiado salva somente pelo botão | Dar tempo para conferir |
| Todas as colunas e controles na bancada | Uma fila por vez, checklist recolhido e próxima ação destacada | Reduzir escolhas por cartão |
| Mudança de status pode fazer o cartão desaparecer da fila | Acompanhar a fila de destino após iniciar/retomar/conferir | Explicar para onde o serviço foi |

O modo Dia a dia é o padrão. A pessoa pode escolher Completo no menu; a preferência fica neste navegador. Os recursos anteriores continuam no modo Completo e em Outros recursos. A troca do modo mantém os campos já preenchidos enquanto a página continua aberta. A preferência não altera permissões nem registros da organização.

## Roteiro para treinar a equipe

1. **Novo serviço:** escolha Cadastrar uma OS. Informe quem vendeu, copie o número do papel e marque o prazo prometido. Cliente e loja são complementares. Clique em Salvar OS e aguarde a confirmação. Depois coloque o material na gaveta do vendedor.
2. **Pedido de lentes:** em Lentes e pedidos, complete o pedido e a previsão de chegada. Use a previsão real do fornecedor.
3. **Lentes recebidas:** escolha As lentes chegaram, procure a OS, confira o cliente e confirme o recebimento.
4. **Montagem:** escolha Fazer a montagem, selecione a fila e use a próxima ação do cartão. A sequência e o responsável continuam registrados. As cinco etapas podem ser consultadas em Ver etapas da montagem.
5. **Problemas:** abra Detalhes, fotos e histórico da OS para registrar e acompanhar a ocorrência. Não pule a conferência final.
6. **Retirada:** escolha Entregar um serviço, confira a OS e registre quem retirou. Apenas serviços prontos podem ser entregues.

Se houver dúvida após uma falha de conexão no cadastro, consulte a fila antes de tentar novamente. A tela não repete o envio automaticamente.

## Regras e limites

- Cadastro guiado exige vendedor, número, laboratório e prazo futuro. Data interpretada no horário de Brasília. O fluxo completo continua disponível para cadastros especiais e históricos.
- Novo cadastro guiado começa aguardando lentes e com prioridade normal. Outros dados são completados no painel lateral.
- Botão bloqueado durante o envio e guarda contra cliques repetidos; duplicidade também continua sujeita à validação do banco.
- A tela inicial consulta contagens exatas, sem herdar o laboratório/período selecionado no painel de gestão. Falhas de contagem são avisadas, sem apresentar zeros como resultado confirmado.
- Bancada continua limitada à consulta existente de até 200 OS. Filtros e ordenação locais não são uma busca global.
- Não há nova tabela, migração, alteração de acesso ou mudança nos dados existentes. As ações usam as RPCs atuais com autenticação e RLS.
- Esta entrega é web. O APK Flutter permanece na versão anterior.

## Verificação

Testes de validação do cadastro verificam campos obrigatórios, prazo e fuso horário. Conferidos no navegador o início, alternância e persistência do modo, formulário, escolha de filas e adaptação móvel com dados fictícios. Não foi criado nem movimentado serviço real para testar a interface.
