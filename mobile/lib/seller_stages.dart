// Etapas do laboratório explicadas para a vendedora (igual ao portal do site).

typedef SellerStage = ({String key, String label, String now, String tip});

const sellerStages = <SellerStage>[
  (key: 'lentes', label: 'Esperando a lente', now: 'A lente foi pedida ao fornecedor e ainda não chegou ao laboratório.', tip: 'Se o cliente tiver pressa, mande um recado pela OS.'),
  (key: 'fila', label: 'Na fila da montagem', now: 'A lente chegou. O serviço está na fila da bancada para ser montado.', tip: 'Se a armação é do cliente (VTA), confirme que ela já foi entregue ao laboratório.'),
  (key: 'bancada', label: 'Sendo montado', now: 'O óculos está na bancada: corte, montagem e ajuste.', tip: 'Agora é só aguardar; o prazo aparece no cartão.'),
  (key: 'conferencia', label: 'Conferência / médico', now: 'Montado. Está sendo conferido ou aguardando o retorno do médico.', tip: 'Assim que for liberado, aparece em Prontas para retirar.'),
  (key: 'pronta', label: 'Pronta para retirar', now: 'O óculos está pronto na gaveta do laboratório.', tip: 'Avise o cliente para buscar.'),
  (key: 'entregue', label: 'Entregue', now: 'O óculos já foi entregue.', tip: ''),
  (key: 'cancelada', label: 'Cancelada', now: 'Esta OS foi cancelada.', tip: ''),
];

const sellerProduction = ['lentes', 'fila', 'bancada', 'conferencia'];

String sellerStageKey(String status) => switch (status) {
  'aguardando_lentes' => 'lentes',
  'aguardando_montagem' => 'fila',
  'em_montagem' || 'em_correcao' => 'bancada',
  'em_conferencia' => 'conferencia',
  'pronto' => 'pronta',
  'entregue' => 'entregue',
  _ => 'cancelada',
};

SellerStage sellerStageOf(String status) {
  final key = sellerStageKey(status);
  return sellerStages.firstWhere((stage) => stage.key == key);
}
