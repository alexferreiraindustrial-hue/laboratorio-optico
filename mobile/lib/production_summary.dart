import 'domain.dart';
import 'production_scope.dart';

typedef OrderData = Map<String, dynamic>;
String normalizedSearch(String value) {
  var text = value.toLowerCase();
  for (final entry in {
    'áàâãä': 'a',
    'éèêë': 'e',
    'íìîï': 'i',
    'óòôõö': 'o',
    'úùûü': 'u',
    'ç': 'c',
  }.entries) {
    for (final char in entry.key.split('')) {
      text = text.replaceAll(char, entry.value);
    }
  }
  return text;
}

({int rank, String label}) productionSignal(OrderData row, DateTime now) {
  if (row['status'] == 'pronto')
    return (rank: 6, label: 'Pronto para retirada');
  final due = DateTime.tryParse('${row['due_at'] ?? ''}');
  final minutes = due?.difference(now).inMinutes;
  if (due != null && due.isBefore(now)) return (rank: 0, label: 'Em atraso');
  if (row['priority'] == 'critica')
    return (rank: 1, label: 'Prioridade crítica');
  if (minutes != null && minutes <= 240)
    return (rank: 1, label: 'Vence em até 4h');
  if (minutes != null && minutes <= 1440)
    return (rank: 2, label: 'Vence em até 24h');
  if (minutes != null && minutes <= 2880)
    return (rank: 3, label: 'Prazo próximo');
  return due == null
      ? (rank: 5, label: 'Sem prazo')
      : (rank: 4, label: 'No prazo');
}

List<OrderData> selectProduction(
  List<OrderData> rows, {
  String? sellerId,
  String query = '',
  bool attention = false,
  DateTime? now,
}) {
  final clock = now ?? DateTime.now();
  final term = normalizedSearch(query.trim());
  final result = rows.where((row) {
    if (!queueStatuses.contains(row['status'])) return false;
    if (sellerId != null &&
        (sellerId == unassignedSeller
            ? (row['seller_id'] != null && row['seller_id'] != '')
            : row['seller_id'] != sellerId))
      return false;
    if (attention && productionSignal(row, clock).rank > 2) return false;
    return term.isEmpty ||
        normalizedSearch(
          [
            row['number'],
            row['external_order_id'],
            row['client_name'],
            row['seller_name'],
            row['store_name'],
            row['laboratory_name'],
            row['lens_supplier_ref'],
          ].whereType<String>().join(' '),
        ).contains(term);
  }).toList();
  result.sort((a, b) {
    final rank = productionSignal(
      a,
      clock,
    ).rank.compareTo(productionSignal(b, clock).rank);
    if (rank != 0) return rank;
    final dueA = DateTime.tryParse('${a['due_at'] ?? ''}');
    final dueB = DateTime.tryParse('${b['due_at'] ?? ''}');
    final due = (dueA?.millisecondsSinceEpoch ?? 8640000000000000).compareTo(
      dueB?.millisecondsSinceEpoch ?? 8640000000000000,
    );
    return due != 0 ? due : '${a['id']}'.compareTo('${b['id']}');
  });
  return result;
}

({int total, int late, int today, int ready}) summarizeProduction(
  List<OrderData> rows,
  DateTime now,
) {
  final open = rows
      .where((row) => queueStatuses.contains(row['status']))
      .toList();
  return (
    total: open.length,
    late: open.where((r) => productionSignal(r, now).rank == 0).length,
    today: open.where((r) {
      if (r['status'] == 'pronto') return false;
      final due = DateTime.tryParse('${r['due_at'] ?? ''}')?.toLocal();
      return due != null &&
          due.year == now.year &&
          due.month == now.month &&
          due.day == now.day;
    }).length,
    ready: open.where((r) => r['status'] == 'pronto').length,
  );
}

List<({String id, String name, int count, int late, int ready})>
summarizeSellers(
  List<OrderData> orders,
  List<OrderData> sellers,
  DateTime now,
) {
  final all = orders.where((r) => queueStatuses.contains(r['status'])).toList();
  final names = <String, String>{
    for (final seller in sellers)
      if (seller['active'] == true ||
          all.any((r) => r['seller_id'] == seller['id']))
        '${seller['id']}': '${seller['name']}',
  };
  for (final row in all) {
    final id = row['seller_id'] as String? ?? unassignedSeller;
    names.putIfAbsent(
      id,
      () => row['seller_name'] as String? ?? 'Sem vendedora',
    );
  }
  final result = [
    for (final entry in names.entries)
      (
        id: entry.key,
        name: entry.value,
        count: all
            .where((r) => (r['seller_id'] ?? unassignedSeller) == entry.key)
            .length,
        late: all
            .where(
              (r) =>
                  (r['seller_id'] ?? unassignedSeller) == entry.key &&
                  productionSignal(r, now).rank == 0,
            )
            .length,
        ready: all
            .where(
              (r) =>
                  (r['seller_id'] ?? unassignedSeller) == entry.key &&
                  r['status'] == 'pronto',
            )
            .length,
      ),
  ];
  result.sort((a, b) {
    final late = b.late.compareTo(a.late);
    if (late != 0) return late;
    final count = b.count.compareTo(a.count);
    return count != 0 ? count : a.name.compareTo(b.name);
  });
  return result;
}
