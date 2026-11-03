import 'design/la_design.dart';
import 'domain.dart';

int flowEtapa(String status) {
  final index = queueStatuses.indexOf(status);
  if (index >= 0) return index + 1;
  return 6;
}

bool flowEncerrada(String status) => closedStatuses.contains(status);

LaPrazo prazoDe(Map<String, dynamic> row) {
  switch (orderUrgency(
    status: '${row['status']}',
    priority: row['priority'] as String?,
    dueAt: row['due_at'] as String?,
  )) {
    case 'vermelho':
      return LaPrazo.atrasada;
    case 'amarelo':
      return LaPrazo.proximo;
    default:
      return LaPrazo.noPrazo;
  }
}

String prazoCurto(Map<String, dynamic> row) {
  final status = '${row['status']}';
  final due = DateTime.tryParse('${row['due_at'] ?? ''}')?.toLocal();
  if (due == null) return 'Sem prazo';
  final stamp =
      '${due.day.toString().padLeft(2, '0')}/${due.month.toString().padLeft(2, '0')}';
  if (flowEncerrada(status)) return stamp;
  return due.isBefore(DateTime.now()) ? 'Venceu $stamp' : 'Vence $stamp';
}

String dataPorExtenso(DateTime date) {
  const dias = [
    'Segunda',
    'Terça',
    'Quarta',
    'Quinta',
    'Sexta',
    'Sábado',
    'Domingo',
  ];
  const meses = [
    'janeiro',
    'fevereiro',
    'março',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
  ];
  return '${dias[date.weekday - 1]}, ${date.day} de ${meses[date.month - 1]}';
}

/// Casas de lente que dividem a gaveta da loja. "Roya" no chão é a Hoya.
/// O que não é dessas três fica em Outros.
const lensHouses = ['Zeiss', 'Essilor', 'Hoya', 'Outros'];

bool pedidoFeito(Map<String, dynamic> row) =>
    '${row['lens_supplier_ref'] ?? ''}'.trim().isNotEmpty;

String? houseOf(Map<String, dynamic> row) {
  final spec = row['lens_spec'];
  if (spec is! Map) return null;
  final raw = '${spec['supplier_house'] ?? ''}'.trim();
  if (raw.isEmpty) return null;
  switch (raw.toLowerCase()) {
    case 'zeis':
    case 'zeiss':
      return 'Zeiss';
    case 'essilor':
      return 'Essilor';
    case 'hoya':
    case 'roya':
      return 'Hoya';
    case 'outro':
    case 'outros':
    case 'outra':
      return 'Outros';
    default:
      return raw;
  }
}

Map<String, dynamic> lensSpecOf(Map<String, dynamic> row) {
  final spec = row['lens_spec'];
  if (spec is! Map) return {};
  return spec.map((key, value) => MapEntry('$key', value));
}

String diaCurto(Object? iso) {
  final date = DateTime.tryParse('${iso ?? ''}')?.toLocal();
  if (date == null) return '';
  return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}';
}

enum LensWatch { atrasada, estoura, apertado, semPrevisao, noPrazo, semPrazo }

/// Compara a data do laboratório externo com o prazo do cliente.
/// O prazo do cliente é o que manda; a data da lente só diz se dá tempo de montar.
({LensWatch watch, String label}) acompanharLente({
  String? dueAt,
  String? lensExpectedAt,
  DateTime? now,
}) {
  final clock = now ?? DateTime.now();
  final due = DateTime.tryParse(dueAt ?? '')?.toLocal();
  final latest = due?.subtract(const Duration(hours: 24));
  final eta = DateTime.tryParse(lensExpectedAt ?? '')?.toLocal();

  if (eta != null && eta.isBefore(clock.subtract(const Duration(hours: 1)))) {
    return (watch: LensWatch.atrasada, label: 'Lente atrasada');
  }
  if (eta == null) {
    if (latest != null && latest.isBefore(clock)) {
      return (watch: LensWatch.estoura, label: 'Vai estourar o prazo');
    }
    if (due == null) {
      return (watch: LensWatch.semPrazo, label: 'Sem prazo com o cliente');
    }
    return (watch: LensWatch.semPrevisao, label: 'Sem data do laboratório');
  }
  if (latest == null) {
    return (watch: LensWatch.semPrazo, label: 'Sem prazo com o cliente');
  }
  final slackHours = latest.difference(eta).inMinutes / 60;
  if (slackHours < 0) {
    return (watch: LensWatch.estoura, label: 'Vai estourar o prazo');
  }
  if (slackHours < 12) {
    return (watch: LensWatch.apertado, label: 'Prazo apertado');
  }
  return (watch: LensWatch.noPrazo, label: 'Chega antes do prazo');
}

String ondeEsta(Map<String, dynamic> row) {
  final status = '${row['status']}';
  if (status == 'aguardando_lentes') {
    return pedidoFeito(row) ? 'Aguardando lente' : 'Aguardando pedido';
  }
  if (status == 'entregue') return 'Já saiu. Entregue';
  if (status == 'cancelado') return 'Cancelada';
  if (status == 'pronto') return 'Pronta, ainda no laboratório';
  final label = statusLabel[status];
  if (label == null) return status;
  return 'No laboratório. $label';
}

String iniciaisDe(String name) {
  final parts = name
      .trim()
      .split(RegExp(r'\s+'))
      .where((part) => part.isNotEmpty)
      .toList();
  if (parts.isEmpty) return 'A';
  if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
  return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
}
