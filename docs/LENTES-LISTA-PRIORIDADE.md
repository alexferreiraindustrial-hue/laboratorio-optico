# Lentes em lista prioritária

Uma lista responsiva única substitui cards no celular e tabela no desktop. Cada linha exibe OS, cliente, vendedora, laboratório, prazo, previsão/pedido e duas etiquetas separadas: urgência do cliente e situação das lentes.

Ordem: entrega do cliente vencida, prioridade crítica manual, prazo imediato/risco de atraso, lente atrasada a cobrar, prazo próximo, prazo confortável, sem prazo. Desempate por prazo, entrada e ID. A ordem é recalculada a cada minuto e ao retornar o foco. Até 500 OS carregadas; aviso explícito ao atingir esse limite.

Edição de previsão e número do pedido exige salvar; não grava por perda de foco. Chegada individual e lote continuam usando as regras existentes. Seleção é limpa ao mudar filtros e as ações de lote só recebem IDs visíveis, até 100. Falhas parciais ficam selecionadas para revisão. Selecionadas também podem gerar as etiquetas de impressão existentes.

Menu lateral: botão Recolher/Menu no cabeçalho desktop libera toda a largura e restaura o menu. Preferência salva por cookie e lida no servidor para não piscar ao navegar. Menu móvel continua usando abrir/fechar.

Sem migrações ou alterações diretas de dados reais nesta implementação.
