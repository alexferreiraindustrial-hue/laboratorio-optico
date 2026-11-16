# Bancada de montagem em Kanban

## Organização operacional

| Antes | Depois | Por quê |
|---|---|---|
| Montagem e correção reunidas | Quatro colunas: aguardando montagem, montagem, correção e conferência | Tornar retrabalho e fila de entrada visíveis |
| Colunas em grade que mudam de linha | Quadro horizontal com navegação por toque | Preservar a sequência em computador e celular |
| Busca simples | Busca sem acentos por OS, cliente, laboratório, loja, vendedor e responsável em execução | Localizar a OS com menos cliques |
| Sem filtros operacionais | Risco, prioridade crítica, minhas etapas e serviços sem execução atribuída | Concentrar o trabalho da bancada |
| Pequenas barras das etapas | Checklist textual das cinco etapas com estado e contagem | Distinguir concluída, em execução, reprovada e não cadastrada |
| Detalhes em outra página | Painel lateral com produção, ocorrências, fotos e histórico | Consultar contexto mantendo a posição no quadro |
| Próxima ação sem tratamento específico para correção | Retomar montagem antes de executar etapas | Explicitar o retorno do retrabalho |

O filtro de responsável considera a etapa em andamento, não o vendedor nem o histórico de operadores. A ordenação padrão prioriza atraso, risco, atenção, ausência de prazo e serviços no prazo; prioridade crítica desempata o mesmo nível de risco. Também há ordenação por prazo e entrada mais antiga.

## Segurança do fluxo

Arrastar e selecionar status usam `changeOrderStatus`, com as mesmas permissões e RPC. Iniciar/concluir uma etapa usa `advanceStep`; movimentar a OS não conclui nenhuma etapa. A liberação continua no botão específico e na validação de servidor. O cartão não oferece liberação quando há etapas ausentes ou ocorrência aberta; falha ao consultar ocorrências também impede oferecer a liberação rápida.

Falhas nas consultas de etapas e ocorrências são mostradas. Os dados continuam sujeitos às políticas RLS existentes. Nenhuma tabela, registro ou migração foi alterado. A lista e a página completa continuam disponíveis.

## Escopo e verificação

Esta entrega altera a bancada web. O APK Flutter não é reconstruído por esta alteração. Busca, contagens e ordenação usam a consulta existente de até 200 OS; não são uma pesquisa global no banco. Colunas recolhidas e filtros persistem enquanto o componente permanece montado, inclusive na abertura do painel lateral.

Regras verificadas com testes de sequência, permissões, correção, etapas ausentes, ocorrências e filtros de responsável. A interface foi conferida com dados fictícios; nenhuma etapa de serviço real foi movimentada para testar a tela.
