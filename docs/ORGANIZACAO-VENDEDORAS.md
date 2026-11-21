# Organização por vendedora e fluxo das lentes

Filtros por ID de vendedora na lista/kanban consultam o banco antes da paginação. Lista desktop separa os registros da página por vendedora mantendo a ordem de prioridade dentro de cada grupo. Bancada e lentes oferecem filtro por nome sobre os registros carregados; nomes idênticos ficam no mesmo filtro. Não transforma nem corrige vendedores automaticamente.

O laboratório existente da OS é usado como laboratório fornecedor das lentes. Pode ser escolhido no cadastro guiado e alterado na própria OS ou na fila de lentes. A alteração atualiza somente laboratory_id, com validação de laboratório ativo e permissões.

A ação individual de chegada reutiliza change_order_status através de quickMoveOrders, preservando autorização e histórico. O destino é aguardando_montagem; não conclui etapas automaticamente. Filas de lentes, bancada e início são revalidadas.

Foto rápida no card: câmera ou galeria, validação de arquivo, envio ao armazenamento privado existente. Durante uma etapa em andamento, vincula ao assembly_steps correspondente; caso contrário, à OS. Resultado e erro aparecem no próprio card. Histórico/fotos continuam na página da OS. Não há alterações de schema nem migrações nesta entrega.

Tema claro/escuro da entrega anterior acompanha esta publicação. Arquivamento e migração 20261121010000_order_archives.sql continuam pendentes, sem aplicação no banco. Os lançamentos reais não foram editados em massa nem apagados. A OS TESTE-LG-2111 permanece separada e identificada como teste; teste operacional completo pendente.
