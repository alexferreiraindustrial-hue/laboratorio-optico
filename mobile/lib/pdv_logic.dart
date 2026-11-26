// PDV da produção: regras puras do bipe, do radar de prazos e dos avisos.
// Cada bipe usa uma ação que o sistema já tinha (mesmas regras do site).
import 'domain.dart';

final _uuid = RegExp(
  r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',
  caseSensitive: false,
);

/// Lê o que o leitor devolveu: número da OS (código de barras) ou link do QR Code.
({String? id, String? ref})? parseScanCode(String raw) {
  final text = raw.replaceAll(RegExp(r'[\r\n\t]+'), '').trim();
  if (text.isEmpty) return null;
  final match = _uuid.firstMatch(text);
  if (match != null &&
      (RegExp(r'/(laboratorio|montagem|lentes|entrega|assistencia)\b|[?&]os=').hasMatch(text) ||
          match.group(0)!.length == text.length)) {
    return (id: match.group(0)!.toLowerCase(), ref: null);
  }
  if (text.length > 60) return null;
  return (id: null, ref: text);
}

enum ScanAction { lente, pronto, medico, voltou, entregue }

const scanLabel = {
  ScanAction.lente: 'Lente chegou',
  ScanAction.pronto: 'Ficou pronto',
  ScanAction.medico: 'Foi para o médico',
  ScanAction.voltou: 'Voltou do médico',
  ScanAction.entregue: 'Entregue ao cliente',
};

const scanHint = {
  ScanAction.lente: 'Vai direto para montagem',
  ScanAction.pronto: 'Montagem concluída',
  ScanAction.medico: 'Conferência médica',
  ScanAction.voltou: 'Liberado, pronto para entregar',
  ScanAction.entregue: 'Começa o pós-venda',
};

const scanDone = {
  ScanAction.lente: 'Lente registrada',
  ScanAction.pronto: 'Marcada como pronta',
  ScanAction.medico: 'Enviada ao médico',
  ScanAction.voltou: 'Liberada pelo médico',
  ScanAction.entregue: 'Entregue ao cliente',
};

const _scanFrom = {
  ScanAction.lente: ['aguardando_lentes'],
  ScanAction.pronto: ['aguardando_montagem', 'em_montagem', 'em_conferencia'],
  ScanAction.medico: ['em_montagem', 'pronto'],
  ScanAction.voltou: ['em_conferencia'],
  ScanAction.entregue: ['pronto', 'entregue'],
};

/// Ações que o perfil pode usar no bipe.
List<ScanAction> allowedScanActions(String role) => ScanAction.values.where((action) {
  return switch (action) {
    ScanAction.entregue => canDeliver(role),
    ScanAction.voltou => canWriteOrders(role),
    ScanAction.lente => canStatus(role) && role != 'montador',
    _ => canStatus(role),
  };
}).toList();

bool awaitingDoctor(Map<String, dynamic> order) =>
    order['status'] == 'em_conferencia' &&
    order['medical_review_required'] == true &&
    order['medical_review_approved_at'] == null;

/// Motivo para não registrar, antes de chamar o servidor (null = pode registrar).
/// A OS já está onde essa ação a deixaria (a mesma etiqueta bipada de novo).
bool scanAlreadyDone(ScanAction action, Map<String, dynamic> order) {
  final status = '${order['status']}';
  return switch (action) {
    ScanAction.lente => status == 'aguardando_montagem' || status == 'em_montagem',
    ScanAction.pronto => status == 'pronto',
    ScanAction.medico => status == 'em_conferencia',
    ScanAction.voltou => status == 'pronto' && order['medical_review_approved_at'] != null,
    ScanAction.entregue => false,
  };
}

String? scanBlockReason(ScanAction action, Map<String, dynamic> order) {
  final status = '${order['status']}';
  final waiting = awaitingDoctor(order);
  if (action == ScanAction.pronto && waiting) return 'Está no médico. Use "Voltou do médico".';
  if (action == ScanAction.voltou && status == 'em_conferencia' && !waiting) {
    return 'Não está aguardando retorno do médico.';
  }
  if (!_scanFrom[action]!.contains(status)) return 'Está em "${statusLabel[status] ?? status}".';
  return null;
}

String visibleNumber(Map<String, dynamic> order) => visibleOrderNumber(order);

enum RadarLane { atrasada, vence24h }

/// Separa as OS abertas: já atrasadas e as que vencem nas próximas 24 horas.
Map<RadarLane, List<Map<String, dynamic>>> radarGroups(List<Map<String, dynamic>> rows, DateTime now) {
  final lanes = {RadarLane.atrasada: <Map<String, dynamic>>[], RadarLane.vence24h: <Map<String, dynamic>>[]};
  for (final row in rows) {
    final status = '${row['status']}';
    if (status == 'pronto' || status == 'entregue' || status == 'cancelado') continue;
    final due = DateTime.tryParse('${row['due_at'] ?? ''}');
    if (due == null) continue;
    if (due.isBefore(now)) {
      lanes[RadarLane.atrasada]!.add(row);
    } else if (due.difference(now) <= const Duration(hours: 24)) {
      lanes[RadarLane.vence24h]!.add(row);
    }
  }
  int byDue(Map<String, dynamic> a, Map<String, dynamic> b) =>
      '${a['due_at']}'.compareTo('${b['due_at']}');
  lanes.forEach((_, list) => list.sort(byDue));
  return lanes;
}

/// "atrasou há 5 h" / "vence em 3 h"
String deadlineText(String? dueAt, DateTime now) {
  final due = DateTime.tryParse(dueAt ?? '');
  if (due == null) return 'sem prazo';
  final diff = due.difference(now);
  final abs = diff.abs();
  final text = abs.inHours >= 48
      ? '${abs.inDays} d'
      : abs.inHours >= 1
      ? '${abs.inHours} h'
      : '${abs.inMinutes.clamp(1, 59)} min';
  return diff.isNegative ? 'atrasou há $text' : 'vence em $text';
}

typedef PdvAlert = ({String key, String tone, int count, String text, String route});

/// Avisos do letreiro, do mais urgente para o menos urgente. Só os que têm OS.
List<PdvAlert> pdvAlerts(List<Map<String, dynamic>> rows, DateTime now, {int unreadMessages = 0}) {
  final lanes = radarGroups(rows, now);
  int count(bool Function(Map<String, dynamic>) test) => rows.where(test).length;
  final lensLate = count((o) {
    final eta = DateTime.tryParse('${o['lens_expected_at'] ?? ''}');
    return o['status'] == 'aguardando_lentes' && eta != null && eta.isBefore(now);
  });
  final noForecast = count((o) {
    final entered = DateTime.tryParse('${o['entered_at'] ?? ''}');
    return o['status'] == 'aguardando_lentes' &&
        (o['lens_expected_at'] == null) &&
        entered != null &&
        now.difference(entered) > const Duration(hours: 24);
  });
  final doctor = count(awaitingDoctor);
  final readyOld = count((o) {
    final since = DateTime.tryParse('${o['completed_at'] ?? o['due_at'] ?? ''}');
    return o['status'] == 'pronto' && since != null && now.difference(since) > const Duration(days: 3);
  });
  String plural(int n, String one, String many) => n == 1 ? one : many;
  final late = lanes[RadarLane.atrasada]!.length;
  final soon = lanes[RadarLane.vence24h]!.length;
  final list = <PdvAlert>[
    (key: 'atrasadas', tone: 'late', count: late, text: plural(late, 'OS atrasada', 'OS atrasadas'), route: '/os?foco=late'),
    (key: 'vence', tone: 'risk', count: soon, text: plural(soon, 'OS vence nas próximas 24 h', 'OS vencem nas próximas 24 h'), route: '/os?foco=today'),
    (key: 'lentes', tone: 'late', count: lensLate, text: plural(lensLate, 'lente passou da previsão do laboratório', 'lentes passaram da previsão do laboratório'), route: '/lentes'),
    (key: 'previsao', tone: 'risk', count: noForecast, text: 'sem previsão do laboratório há mais de 1 dia', route: '/lentes'),
    (key: 'medico', tone: 'info', count: doctor, text: 'esperando retorno do médico', route: '/bancada'),
    (key: 'retirada', tone: 'info', count: readyOld, text: plural(readyOld, 'pronta há mais de 3 dias sem entrega', 'prontas há mais de 3 dias sem entrega'), route: '/entrega'),
    (key: 'recados', tone: 'info', count: unreadMessages, text: plural(unreadMessages, 'recado novo das vendedoras', 'recados novos das vendedoras'), route: '/recados'),
  ];
  return list.where((item) => item.count > 0).toList();
}
