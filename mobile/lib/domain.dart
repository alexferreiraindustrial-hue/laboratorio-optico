const queueStatuses = [
  'aguardando_lentes',
  'aguardando_montagem',
  'em_montagem',
  'em_correcao',
  'em_conferencia',
  'pronto',
];

const closedStatuses = ['entregue', 'cancelado'];

List<Map<String, dynamic>> onlyQueueStatus(
  List<Map<String, dynamic>> rows, [
  String? status,
]) {
  return rows.where((row) {
    final current = '${row['status']}';
    if (current == 'cancelado' || current == 'entregue') return false;
    if (status != null && status.isNotEmpty) return current == status;
    return queueStatuses.contains(current);
  }).toList();
}

List<Map<String, dynamic>> filterOrderList(
  List<Map<String, dynamic>> rows, {
  String? status,
  String tab = 'andamento',
}) {
  if (status != null && status.isNotEmpty) return onlyQueueStatus(rows, status);
  return rows.where((row) {
    final current = '${row['status']}';
    if (tab == 'andamento') return queueStatuses.contains(current);
    if (tab == 'encerradas') return closedStatuses.contains(current);
    return true;
  }).toList();
}

List<
  (
    String status,
    List<
      (
        String store,
        List<(String seller, List<Map<String, dynamic>> rows)> sellers,
      )
    >
    stores,
  )
>
groupByStatusThenStoreThenSeller(List<Map<String, dynamic>> rows) {
  final order = [...queueStatuses, ...closedStatuses];
  return [
    for (final status in order)
      if (rows.any((row) => '${row['status']}' == status))
        (
          status,
          groupByStoreThenSeller(
            rows.where((row) => '${row['status']}' == status).toList(),
          ),
        ),
  ];
}

const benchStatuses = [
  'aguardando_montagem',
  'em_montagem',
  'em_correcao',
  'em_conferencia',
];

const stepKeys = [
  'conferencia_inicial',
  'lensometria',
  'blocagem',
  'facetadora',
  'conferencia_qualidade',
];

const stepShort = {
  'conferencia_inicial': 'Conferência',
  'lensometria': 'Lensometria',
  'blocagem': 'Blocagem',
  'facetadora': 'Facetadora',
  'conferencia_qualidade': 'Qualidade',
};

const stepLabel = {
  'conferencia_inicial': 'Conferência inicial',
  'lensometria': 'Lensometria',
  'blocagem': 'Blocagem',
  'facetadora': 'Facetadora',
  'conferencia_qualidade': 'Conferência de qualidade',
};

const statusLabel = {
  'aguardando_lentes': 'Aguardando lentes',
  'aguardando_montagem': 'Aguardando montagem',
  'em_montagem': 'Em montagem',
  'em_correcao': 'Em correção',
  'em_conferencia': 'Conferência Médico',
  'pronto': 'Pronto',
  'entregue': 'Entregue',
  'cancelado': 'Cancelado',
};

const movementLabel = {
  'entrada': 'Entrada',
  'saida': 'Saída',
  'ajuste': 'Ajuste de inventário',
  'devolucao': 'Devolução',
  'correcao': 'Correção de divergência',
  'consumo': 'Consumo por OS',
};

bool canWriteOrders(String role) =>
    role == 'admin' || role == 'gestor' || role == 'montador';

bool canAttachPhotos(String role) =>
    role == 'admin' ||
    role == 'gestor' ||
    role == 'montador' ||
    role == 'estoquista';

bool canStatus(String role) =>
    role == 'admin' || role == 'gestor' || role == 'montador';

bool canCancel(String role) => role == 'admin' || role == 'gestor';

bool canDeliver(String role) => role == 'admin' || role == 'gestor';

bool canAssembly(String role) =>
    role == 'admin' || role == 'gestor' || role == 'montador';

bool canStockWrite(String role) =>
    role == 'admin' || role == 'gestor' || role == 'estoquista';

bool canStockConsume(String role) =>
    role == 'admin' ||
    role == 'gestor' ||
    role == 'montador' ||
    role == 'estoquista';

bool canReply(String role) =>
    role == 'admin' || role == 'gestor' || role == 'montador';

bool canPartiesWrite(String role) =>
    role == 'admin' || role == 'gestor' || role == 'montador';

bool canRoutineWrite(String role) => role != 'consulta' && role.isNotEmpty;

bool canQualityWrite(String role) =>
    role == 'admin' || role == 'gestor' || role == 'montador';

bool canManage(String role) =>
    role == 'admin' || role == 'gestor' || role == 'consulta';

bool canUsersManage(String role) => role == 'admin';

bool canSettingsWrite(String role) => role == 'admin' || role == 'gestor';

const roleLabel = {
  'admin': 'Administrador',
  'gestor': 'Gestor',
  'montador': 'Operador de montagem',
  'estoquista': 'Estoquista',
  'consulta': 'Consulta',
};

const staffRoles = ['admin', 'gestor', 'montador', 'estoquista', 'consulta'];

String toLocalDateTimeValue(String? iso) {
  final date = DateTime.tryParse(iso ?? '')?.toLocal();
  if (date == null) return '';
  String two(int n) => n.toString().padLeft(2, '0');
  return '${date.year}-${two(date.month)}-${two(date.day)}T${two(date.hour)}:${two(date.minute)}';
}

String? localDateTimeToIso(String value) {
  if (value.trim().isEmpty) return null;
  return DateTime.tryParse(value.trim())?.toUtc().toIso8601String();
}

DateTime addBusinessDays(int days, [DateTime? from]) {
  var date = from ?? DateTime.now();
  var added = 0;
  while (added < days) {
    date = date.add(const Duration(days: 1));
    if (date.weekday != DateTime.saturday && date.weekday != DateTime.sunday)
      added++;
  }
  return DateTime(date.year, date.month, date.day, 17);
}

const routineOpen = [
  ('abrir_maquinas', 'Ligar facetadora, lensômetro e blocador'),
  ('abrir_5s', 'Bancada limpa e ferramentas no lugar (5S)'),
  ('abrir_radar', 'Ver OS atrasadas e em risco no radar'),
  (
    'abrir_bandejas',
    'Separar bandejas por prazo (as que vencem hoje na frente)',
  ),
  ('abrir_bo', 'Conferir BO pendente e cobrar decisões'),
];

const routineClose = [
  ('fechar_prontas', 'Conferir OS prontas e avisar vendedores'),
  ('fechar_lentes', 'Atualizar previsão das lentes que não chegaram'),
  ('fechar_ocorrencias', 'Registrar ocorrências do dia na etapa certa'),
  ('fechar_5s', 'Limpar facetadora e organizar a bancada (5S)'),
  ('fechar_maquinas', 'Desligar máquinas'),
];

const boDecisions = {
  'nova_lente': 'Pedir nova lente',
  'refazer': 'Refazer a montagem',
  'reparo': 'Reparo no laboratório',
  'cliente_aceita': 'Cliente aceitou',
  'cancelar': 'Cancelar a OS',
};

String saoPauloDay([DateTime? now]) {
  final local = (now ?? DateTime.now()).toUtc().subtract(
    const Duration(hours: 3),
  );
  String two(int n) => n.toString().padLeft(2, '0');
  return '${local.year}-${two(local.month)}-${two(local.day)}';
}

const statusTransitions = {
  'aguardando_lentes': ['aguardando_montagem', 'cancelado'],
  'aguardando_montagem': ['em_montagem', 'aguardando_lentes', 'cancelado'],
  'em_montagem': [
    'pronto',
    'em_correcao',
    'em_conferencia',
    'aguardando_montagem',
    'cancelado',
  ],
  'em_correcao': ['em_montagem', 'cancelado'],
  'em_conferencia': ['pronto', 'em_correcao', 'cancelado'],
  'pronto': ['entregue', 'em_correcao'],
  'entregue': <String>[],
  'cancelado': <String>[],
};

const assemblerTargets = {
  'aguardando_montagem',
  'em_montagem',
  'em_correcao',
  'em_conferencia',
  'pronto',
};

List<String> allowedTargets(String from, String role) {
  return (statusTransitions[from] ?? const <String>[]).where((to) {
    if (!canStatus(role)) return false;
    if (to == 'cancelado' && !canCancel(role)) return false;
    if (to == 'entregue' && !canDeliver(role)) return false;
    if (role == 'montador' && !assemblerTargets.contains(to)) return false;
    if (role == 'montador' && from == 'aguardando_lentes') return false;
    return true;
  }).toList();
}

({String kind, int code})? parseTargetCommand(String line) {
  final match = RegExp(
    r'^([vl])\s*[-:.]?\s*(\d{1,3})$',
    caseSensitive: false,
  ).firstMatch(line.trim());
  if (match == null) return null;
  return (
    kind: match.group(1)!.toLowerCase() == 'v' ? 'seller' : 'store',
    code: int.parse(match.group(2)!),
  );
}

String? dueIsoFromHours(int? hours) {
  if (hours == null) return null;
  return DateTime.now().toUtc().add(Duration(hours: hours)).toIso8601String();
}

String? dateToNoonIso(String ymd) {
  if (ymd.isEmpty) return null;
  return DateTime.tryParse('${ymd}T12:00:00')?.toUtc().toIso8601String();
}

String visibleOrderNumber(Map<String, dynamic> order) {
  final external = (order['external_order_id'] ?? order['orderRef'])
      ?.toString()
      .trim();
  if (external != null && external.isNotEmpty) return external;
  return '${order['number'] ?? ''}';
}

const defaultStockGrid = (
  sphereMinCents: -400,
  sphereMaxCents: 400,
  cylinderMinCents: -300,
  cylinderMaxCents: 0,
  stepCents: 25,
);

List<int> powerSeries(int min, int max, int step) {
  if (step <= 0 || min > max) return [];
  return [for (var value = min; value <= max; value += step) value];
}

({
  int sphereMinCents,
  int sphereMaxCents,
  int cylinderMinCents,
  int cylinderMaxCents,
  int stepCents,
})
parseStockGrid(Map<String, dynamic>? raw) {
  if (raw == null || raw.isEmpty) return defaultStockGrid;
  int n(String key, int fallback) {
    final value = raw[key];
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse('$value') ?? fallback;
  }

  return (
    sphereMinCents: n('sphere_min_cents', defaultStockGrid.sphereMinCents),
    sphereMaxCents: n('sphere_max_cents', defaultStockGrid.sphereMaxCents),
    cylinderMinCents: n(
      'cylinder_min_cents',
      defaultStockGrid.cylinderMinCents,
    ),
    cylinderMaxCents: n(
      'cylinder_max_cents',
      defaultStockGrid.cylinderMaxCents,
    ),
    stepCents: n('step_cents', defaultStockGrid.stepCents),
  );
}

String formatDiopter(Object? cents) {
  if (cents == null) return '—';
  final value = cents is int ? cents : int.tryParse('$cents');
  if (value == null) return '—';
  final signed = value > 0 ? '+' : '';
  return '$signed${(value / 100).toStringAsFixed(2).replaceAll('.', ',')}';
}

int? parseDiopterToCents(String value) {
  final normalized = value
      .trim()
      .replaceAll(RegExp(r'\s'), '')
      .replaceAll(',', '.');
  if (normalized.isEmpty) return null;
  if (!RegExp(r'^[+-]?\d+(\.\d+)?$').hasMatch(normalized)) return null;
  final numeric = double.tryParse(normalized);
  if (numeric == null) return null;
  return (numeric * 100).round();
}

String stockTone(int quantity, int minQty, int? idealQty) {
  if (quantity <= 0 || quantity < minQty) return 'vermelho';
  if (idealQty != null && idealQty > minQty && quantity < idealQty)
    return 'amarelo';
  if ((idealQty == null || idealQty <= minQty) &&
      minQty > 0 &&
      quantity == minQty)
    return 'amarelo';
  return 'verde';
}

String formatWhen(Object? iso) {
  if (iso == null) return '—';
  final date = DateTime.tryParse('$iso')?.toLocal();
  if (date == null) return '—';
  final d = date.day.toString().padLeft(2, '0');
  final m = date.month.toString().padLeft(2, '0');
  final h = date.hour.toString().padLeft(2, '0');
  final min = date.minute.toString().padLeft(2, '0');
  return '$d/$m ${date.year} $h:$min';
}

String deliveryForecastLabel(Object? dueAt) {
  if (dueAt == null || '$dueAt'.trim().isEmpty)
    return 'Sem previsão de entrega';
  final when = formatWhen(dueAt);
  if (when == '—') return 'Sem previsão de entrega';
  return 'Previsão $when';
}

String friendlyError(Object error) {
  final text = error.toString().replaceFirst(RegExp(r'^.*Exception:\s*'), '');
  if (text.contains('PGRST205') ||
      text.contains('schema cache') ||
      text.contains('kaizen_ideas') ||
      text.contains('five_s_audits')) {
    return 'Este módulo ainda não estava no banco. Atualize a tela; se o aviso continuar, o laboratório precisa aplicar a migração de melhoria contínua.';
  }
  return text
      .replaceFirst(RegExp(r'^.*ERROR:\s*', caseSensitive: false), '')
      .trim();
}

({String kind, String token})? parsePortalLogin(String raw) {
  final value = raw.trim();
  if (value.isEmpty) return null;
  final uri = Uri.tryParse(value);
  if (uri != null && uri.pathSegments.length >= 3) {
    final i = uri.pathSegments.indexOf('acompanhar');
    if (i >= 0 && i + 2 < uri.pathSegments.length) {
      final kind = uri.pathSegments[i + 1];
      final token = uri.pathSegments[i + 2];
      if ((kind == 'vendedor' || kind == 'loja') && token.isNotEmpty)
        return (kind: kind, token: token);
    }
  }
  if (RegExp(r'^[A-Za-z0-9_-]{20,}$').hasMatch(value))
    return (kind: 'vendedor', token: value);
  return null;
}

const portalSite = 'https://lab.oticahub.com';

bool isSellerReady(String status) => status == 'pronto';

bool isSellerClosed(String status) =>
    status == 'entregue' || status == 'cancelado';

bool isSellerProduction(String status) =>
    !isSellerReady(status) && !isSellerClosed(status);

bool sellerNeedsAttention(Map<String, dynamic> row) {
  if (!isSellerProduction('${row['status']}')) return false;
  final tone = orderUrgency(
    status: '${row['status']}',
    priority: row['priority'] as String?,
    dueAt: row['due_at'] as String?,
  );
  return tone == 'vermelho' || tone == 'amarelo';
}

enum SellerFilter { all, production, ready, alerts, closed }

List<Map<String, dynamic>> filterSellerOrders(
  List<Map<String, dynamic>> rows,
  SellerFilter filter,
  String query,
) {
  final needle = query.trim().toLowerCase();
  return [
    for (final row in rows)
      if (_matchesSellerFilter(row, filter) && _matchesSellerQuery(row, needle))
        row,
  ];
}

bool _matchesSellerFilter(Map<String, dynamic> row, SellerFilter filter) {
  final status = '${row['status']}';
  switch (filter) {
    case SellerFilter.all:
      return true;
    case SellerFilter.production:
      return isSellerProduction(status);
    case SellerFilter.ready:
      return isSellerReady(status);
    case SellerFilter.alerts:
      return sellerNeedsAttention(row);
    case SellerFilter.closed:
      return isSellerClosed(status);
  }
}

bool _matchesSellerQuery(Map<String, dynamic> row, String needle) {
  if (needle.isEmpty) return true;
  final hay =
      '${visibleOrderNumber(row)} ${row['client_name'] ?? ''} ${row['store_name'] ?? ''} ${row['external_order_id'] ?? ''}'
          .toLowerCase();
  return hay.contains(needle);
}

class QuickEntry {
  const QuickEntry({required this.raw, this.orderRef, this.clientName});
  final String raw;
  final String? orderRef;
  final String? clientName;
}

final _refPrefix = RegExp(
  r'^(?:os|n[ºo°]?|#)[\s:.-]*(?=[0-9A-Za-z])',
  caseSensitive: false,
);
final _refBody = RegExp(r'^[0-9A-Za-z][0-9A-Za-z./-]{0,24}$');

String? _cleanRef(String token) {
  var value = token.trim().replaceFirst(RegExp(r'[.,;:\s]+$'), '');
  final withoutPrefix = value.replaceFirst(_refPrefix, '');
  if (withoutPrefix != value && RegExp(r'^\d').hasMatch(withoutPrefix)) {
    value = withoutPrefix;
  } else if (value.startsWith('#')) {
    value = value.substring(1);
  }
  if (!_refBody.hasMatch(value) || !RegExp(r'\d').hasMatch(value)) return null;
  return value;
}

String? _cleanName(String text) {
  final name = text
      .replaceAll(RegExp(r'\s+'), ' ')
      .replaceFirst(RegExp(r'^[\s,;:-]+'), '')
      .replaceFirst(RegExp(r'[\s,;:-]+$'), '')
      .trim();
  return name.length >= 2 ? name : null;
}

QuickEntry? parseQuickEntry(String line) {
  final raw = line.replaceAll(RegExp(r'\s+'), ' ').trim();
  if (raw.isEmpty) return null;
  if (RegExp(r'^OS-\d{4}-\d{1,6}$', caseSensitive: false).hasMatch(raw)) {
    return QuickEntry(raw: raw, orderRef: raw.toUpperCase());
  }
  final parts = raw.split(' ');
  if (parts.length == 1) {
    final ref = _cleanRef(parts[0]);
    return ref != null
        ? QuickEntry(raw: raw, orderRef: ref)
        : QuickEntry(raw: raw, clientName: _cleanName(raw));
  }
  if (RegExp(r'^(os|n[ºo°]?|#)$', caseSensitive: false).hasMatch(parts[0]) &&
      _cleanRef(parts[1]) != null) {
    return QuickEntry(
      raw: raw,
      orderRef: _cleanRef(parts[1]),
      clientName: _cleanName(parts.skip(2).join(' ')),
    );
  }
  final firstRef = _cleanRef(parts[0]);
  if (firstRef != null) {
    return QuickEntry(
      raw: raw,
      orderRef: firstRef,
      clientName: _cleanName(parts.skip(1).join(' ')),
    );
  }
  final lastRef = _cleanRef(parts.last);
  if (lastRef != null) {
    return QuickEntry(
      raw: raw,
      orderRef: lastRef,
      clientName: _cleanName(parts.sublist(0, parts.length - 1).join(' ')),
    );
  }
  return QuickEntry(raw: raw, clientName: _cleanName(raw));
}

List<QuickEntry> parseQuickBatch(String text) {
  return text
      .split(RegExp(r'\r?\n|;'))
      .map(parseQuickEntry)
      .whereType<QuickEntry>()
      .where((entry) => entry.orderRef != null || entry.clientName != null)
      .toList();
}

String quickClientName(QuickEntry entry) =>
    entry.clientName ?? 'OS ${entry.orderRef}';

List<(String lab, List<Map<String, dynamic>> rows)> groupByLaboratory(
  List<Map<String, dynamic>> rows,
) {
  final labs = <String>[];
  final map = <String, List<Map<String, dynamic>>>{};
  for (final row in rows) {
    final name = (row['laboratory_name'] as String?)?.trim();
    final key = (name == null || name.isEmpty) ? 'Sem laboratório' : name;
    if (!map.containsKey(key)) {
      labs.add(key);
      map[key] = [];
    }
    map[key]!.add(row);
  }
  return [for (final lab in labs) (lab, map[lab]!)];
}

const storePalette = [
  0xFF1A6B5C,
  0xFF2F7DFF,
  0xFF7B4DFF,
  0xFFC45C26,
  0xFF0E7A8B,
  0xFFB23A6B,
];

const sellerPalette = [
  0xFFD97706,
  0xFFDB2777,
  0xFF4F46E5,
  0xFF0D9488,
  0xFF7C3AED,
  0xFFEA580C,
];

int partyColorValue(String key, {required bool store}) {
  final palette = store ? storePalette : sellerPalette;
  var hash = 0;
  for (final code in key.codeUnits) {
    hash = 0x1fffffff & (hash * 31 + code);
  }
  return palette[hash.abs() % palette.length];
}

String orderUrgency({
  required String status,
  String? priority,
  String? dueAt,
  DateTime? now,
  int alertHours = 24,
}) {
  if (status == 'cancelado' || status == 'entregue') return 'cinza';
  if (dueAt == null || dueAt.isEmpty) return 'cinza';
  final due = DateTime.tryParse(dueAt);
  if (due == null) return 'cinza';
  final current = now ?? DateTime.now();
  if (priority == 'critica' || due.isBefore(current)) return 'vermelho';
  if (due.difference(current) <= Duration(hours: alertHours)) return 'amarelo';
  return 'verde';
}

String dueDeltaLabel(String? dueAt, {String? status, DateTime? now}) {
  if (status == 'cancelado' ||
      status == 'entregue' ||
      dueAt == null ||
      dueAt.isEmpty)
    return 'Sem prazo';
  final due = DateTime.tryParse(dueAt);
  if (due == null) return 'Sem prazo';
  final diff = due.difference(now ?? DateTime.now());
  final late = diff.isNegative;
  final abs = diff.abs();
  final days = abs.inDays;
  final hours = abs.inHours % 24;
  final text = days > 0
      ? '${days}d ${hours}h'
      : abs.inHours > 0
      ? '${abs.inHours}h'
      : '${abs.inMinutes}min';
  return late ? 'Atrasada $text' : 'Faltam $text';
}

String storeNameOf(Map<String, dynamic> row) {
  final name = (row['store_name'] as String?)?.trim();
  return (name == null || name.isEmpty) ? 'Sem loja' : name;
}

String sellerNameOf(Map<String, dynamic> row) {
  final name = (row['seller_name'] as String?)?.trim();
  return (name == null || name.isEmpty) ? 'Sem vendedora' : name;
}

int _urgencyRank(Map<String, dynamic> row) {
  switch (orderUrgency(
    status: '${row['status']}',
    priority: row['priority'] as String?,
    dueAt: row['due_at'] as String?,
  )) {
    case 'vermelho':
      return 0;
    case 'amarelo':
      return 1;
    case 'verde':
      return 2;
    default:
      return 3;
  }
}

List<
  (String store, List<(String seller, List<Map<String, dynamic>> rows)> sellers)
>
groupByStoreThenSeller(List<Map<String, dynamic>> rows) {
  final sorted = [...rows]
    ..sort((a, b) {
      final store = storeNameOf(a).compareTo(storeNameOf(b));
      if (store != 0) return store;
      final seller = sellerNameOf(a).compareTo(sellerNameOf(b));
      if (seller != 0) return seller;
      final urgency = _urgencyRank(a).compareTo(_urgencyRank(b));
      if (urgency != 0) return urgency;
      return '${a['due_at'] ?? '9'}'.compareTo('${b['due_at'] ?? '9'}');
    });
  final stores = <String>[];
  final byStore = <String, List<Map<String, dynamic>>>{};
  for (final row in sorted) {
    final store = storeNameOf(row);
    if (!byStore.containsKey(store)) {
      stores.add(store);
      byStore[store] = [];
    }
    byStore[store]!.add(row);
  }
  return [
    for (final store in stores)
      (
        store,
        [
          for (final labGroup in _groupByKey(byStore[store]!, sellerNameOf))
            labGroup,
        ],
      ),
  ];
}

List<(String key, List<Map<String, dynamic>> rows)> _groupByKey(
  List<Map<String, dynamic>> rows,
  String Function(Map<String, dynamic>) keyOf,
) {
  final keys = <String>[];
  final map = <String, List<Map<String, dynamic>>>{};
  for (final row in rows) {
    final key = keyOf(row);
    if (!map.containsKey(key)) {
      keys.add(key);
      map[key] = [];
    }
    map[key]!.add(row);
  }
  return [for (final key in keys) (key, map[key]!)];
}

({
  String kind,
  String? to,
  String? action,
  String? step,
  String label,
  String note,
})
nextBenchAction({
  required String status,
  required String role,
  required List<Map<String, dynamic>> steps,
  bool medicalRequired = false,
}) {
  if (!canAssembly(role))
    return (
      kind: 'none',
      to: null,
      action: null,
      step: null,
      label: 'Somente consulta',
      note: '',
    );
  if (status == 'em_correcao')
    return (
      kind: 'status',
      to: 'em_montagem',
      action: null,
      step: null,
      label: 'Retomar montagem',
      note: 'Retomada após correção',
    );
  if (status == 'aguardando_montagem') {
    return (
      kind: 'status',
      to: 'em_montagem',
      action: null,
      step: null,
      label: 'Começar montagem',
      note: 'Início pela bancada',
    );
  }
  if (!canAssembly(role)) {
    return (
      kind: 'none',
      to: null,
      action: null,
      step: null,
      label: 'Somente consulta',
      note: '',
    );
  }
  for (final key in stepKeys) {
    Map<String, dynamic>? step;
    for (final item in steps) {
      if (item['key'] == key || item['step_key'] == key) {
        step = item;
        break;
      }
    }
    final st = step?['status'] as String? ?? 'pendente';
    if (st == 'concluida') continue;
    if (st == 'em_andamento') {
      return (
        kind: 'step',
        to: null,
        action: 'concluir',
        step: key,
        label: 'Concluir ${stepLabel[key]!.toLowerCase()}',
        note: '',
      );
    }
    final index = stepKeys.indexOf(key);
    if (index == 0 ||
        steps.any(
          (item) =>
              (item['key'] == stepKeys[index - 1] ||
                  item['step_key'] == stepKeys[index - 1]) &&
              item['status'] == 'concluida',
        )) {
      return (
        kind: 'step',
        to: null,
        action: 'iniciar',
        step: key,
        label: 'Iniciar ${stepLabel[key]!.toLowerCase()}',
        note: '',
      );
    }
    return (
      kind: 'none',
      to: null,
      action: null,
      step: null,
      label: '${stepLabel[key]} bloqueada',
      note: '',
    );
  }
  if (status == 'em_conferencia' && medicalRequired)
    return (
      kind: 'none',
      to: null,
      action: null,
      step: null,
      label: 'Aguardando retorno médico · abrir detalhes',
      note: '',
    );
  if (status == 'em_conferencia') {
    return (
      kind: 'status',
      to: 'pronto',
      action: null,
      step: null,
      label: 'Marcar como pronta',
      note: 'Conferida na bancada',
    );
  }
  if (status == 'em_montagem') {
    return (
      kind: 'status',
      to: medicalRequired ? 'em_conferencia' : 'pronto',
      action: null,
      step: null,
      label: medicalRequired
          ? 'Enviar para conferência médica'
          : 'Marcar como pronta',
      note: 'Etapas concluídas',
    );
  }
  return (
    kind: 'none',
    to: null,
    action: null,
    step: null,
    label: 'Sem ação pendente',
    note: '',
  );
}
