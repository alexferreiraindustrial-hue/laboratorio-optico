import 'dart:math';
import 'dart:typed_data';

import 'package:supabase_flutter/supabase_flutter.dart';

import 'domain.dart';

final supabase = Supabase.instance.client;

class LabApi {
  Future<void> mergeOperations(List<Map<String, dynamic>> rows) async {
    for (var offset = 0; offset < rows.length; offset += 150) {
      final part = rows.skip(offset).take(150).toList();
      final operations = await supabase
          .from('service_orders')
          .select(
            'id,frame_state,express_minutes,express_started_at,express_finished_at,lens_arrived_at,updated_at,medical_review_required,medical_review_approved_at,medical_review_note,assistance_kind,assistance_origin_order_id',
          )
          .inFilter('id', part.map((row) => row['id'] as String).toList());
      final byId = {for (final row in operations) row['id']: row};
      for (final row in part) {
        final op = byId[row['id']];
        if (op == null)
          throw StateError('Atualize a tela: acompanhamento não carregado.');
        row.addAll(op);
      }
    }
  }

  Future<void> receiveLenses(String id) async {
    await supabase.rpc('receive_order_lenses', params: {'p_order_id': id});
  }

  Future<void> receiveFrame(String id) async {
    await supabase.rpc(
      'receive_order_frame',
      params: {'p_order_id': id, 'p_express_minutes': null},
    );
  }

  Future<void> medicalReview(String id, bool required, String version) async {
    await supabase.rpc(
      'configure_medical_review',
      params: {
        'p_order_id': id,
        'p_required': required,
        'p_expected_updated_at': version,
      },
    );
  }

  Future<void> approveMedical(String id, String note, String version) async {
    await supabase.rpc(
      'approve_medical_review',
      params: {
        'p_order_id': id,
        'p_note': note,
        'p_expected_updated_at': version,
      },
    );
  }

  Future<List<Map<String, dynamic>>> assistanceOrders() async {
    final rows = await supabase
        .from('service_orders')
        .select('id,number,client_name,status,due_at,assistance_kind')
        .not('assistance_kind', 'is', null)
        .not('status', 'in', '(entregue,cancelado)')
        .order('due_at');
    return List<Map<String, dynamic>>.from(rows);
  }

  Future<Map<String, dynamic>> createAssistance({
    required String original,
    required String kind,
    required String description,
    required DateTime due,
    required bool lenses,
    required bool medical,
  }) async {
    final row = await supabase.rpc(
      'create_assistance_order',
      params: {
        'p_original_number': original,
        'p_kind': kind,
        'p_description': description,
        'p_due_at': due.toUtc().toIso8601String(),
        'p_needs_lenses': lenses,
        'p_medical_required': medical,
      },
    );
    return Map<String, dynamic>.from(row as Map);
  }

  Future<Map<String, int>> pipeline() async {
    final rows = await supabase
        .from('orders_enriched')
        .select('status')
        .inFilter('status', queueStatuses);
    final counts = {for (final status in queueStatuses) status: 0};
    for (final row in rows) {
      final status = row['status'] as String;
      counts[status] = (counts[status] ?? 0) + 1;
    }
    return counts;
  }

  Future<List<Map<String, dynamic>>> catalogs({bool activeOnly = true}) async {
    var query = supabase
        .from('laboratories')
        .select('id, name, code, color, notes, active');
    if (activeOnly) query = query.eq('active', true);
    final labs = await query.order('name');
    return List<Map<String, dynamic>>.from(labs);
  }

  Future<List<Map<String, dynamic>>> sellers({bool activeOnly = true}) async {
    var query = supabase
        .from('sellers')
        .select('id, name, active, quick_code, phone, whatsapp, email, notes');
    if (activeOnly) query = query.eq('active', true);
    final rows = await query.order('name');
    return List<Map<String, dynamic>>.from(rows);
  }

  Future<List<Map<String, dynamic>>> sellerLinks() async {
    final rows = await supabase
        .from('seller_stores')
        .select('seller_id, store_id');
    return List<Map<String, dynamic>>.from(rows);
  }

  Future<List<Map<String, dynamic>>> stores({bool activeOnly = true}) async {
    var query = supabase
        .from('stores')
        .select(
          'id, trade_name, legal_name, cnpj, contact_name, phone, whatsapp, email, address, notes, active, quick_code',
        );
    if (activeOnly) query = query.eq('active', true);
    final rows = await query.order('quick_code');
    return List<Map<String, dynamic>>.from(rows);
  }

  Future<Map<String, dynamic>> createOrder({
    required String clientName,
    required String laboratoryId,
    String? sellerId,
    String? storeId,
    String? orderRef,
    String? dueAt,
    String? enteredAt,
    String status = 'aguardando_lentes',
    String priority = 'normal',
    String? notes,
    bool medicalRequired = false,
    String serviceDescription = 'Lançamento rápido',
    Map<String, dynamic>? lensSpec,
    String? lensExpectedAt,
    String? lensSupplierRef,
  }) async {
    final payload = {
      'p_client_name': clientName,
      'p_seller_id': sellerId,
      'p_store_id': storeId,
      'p_laboratory_id': laboratoryId,
      'p_entered_at': enteredAt ?? DateTime.now().toUtc().toIso8601String(),
      'p_due_at': dueAt,
      'p_notes':
          notes ??
          (orderRef != null && (clientName == 'OS $orderRef')
              ? 'Lançamento rápido só com o número da OS — completar o nome do cliente.'
              : 'Lançamento rápido.'),
      'p_service_description': serviceDescription,
      'p_external_order_id': orderRef,
      'p_priority': priority,
      'p_status': status,
      'p_lens_spec': lensSpec ?? <String, dynamic>{},
    };
    final data = await supabase.rpc(
      medicalRequired
          ? 'create_service_order_followup'
          : 'create_service_order',
      params: medicalRequired
          ? {
              'p_order': payload,
              'p_frame_state': 'unknown',
              'p_express_minutes': null,
              'p_medical_required': true,
            }
          : payload,
    );
    final order = Map<String, dynamic>.from(data as Map);
    if (lensExpectedAt != null ||
        (lensSupplierRef != null && lensSupplierRef.isNotEmpty)) {
      await supabase
          .from('service_orders')
          .update({
            'lens_expected_at': lensExpectedAt,
            'lens_supplier_ref': lensSupplierRef,
          })
          .eq('id', order['id']);
    }
    return order;
  }

  Future<void> changeStatus(String id, String to, String note) async {
    await supabase.rpc(
      'change_order_status',
      params: {'p_order_id': id, 'p_to': to, 'p_note': note},
    );
  }

  Future<void> advanceStep(String id, String step, String action) async {
    await supabase.rpc(
      'advance_assembly_step',
      params: {
        'p_order_id': id,
        'p_step_key': step,
        'p_action': action,
        'p_notes': '',
        'p_measurements': {'conferido': '', 'divergencia': ''},
        'p_reason': '',
      },
    );
  }

  Future<List<Map<String, dynamic>>> lensQueue() async {
    final rows = await supabase
        .from('orders_enriched')
        .select(
          'id, number, client_name, seller_name, store_name, laboratory_name, external_order_id, due_at, lens_expected_at, lens_supplier_ref, lens_spec, status, priority',
        )
        .eq('status', 'aguardando_lentes')
        .order('due_at', ascending: true);
    final list = List<Map<String, dynamic>>.from(rows);
    await mergeOperations(list);
    return onlyQueueStatus(list, 'aguardando_lentes');
  }

  Future<List<Map<String, dynamic>>> readyQueue() async {
    final rows = await supabase
        .from('orders_enriched')
        .select(
          'id, number, client_name, seller_name, store_name, laboratory_name, external_order_id, due_at, status',
        )
        .eq('status', 'pronto')
        .order('due_at', ascending: true);
    return List<Map<String, dynamic>>.from(rows);
  }

  Future<List<Map<String, dynamic>>> benchOrders() async {
    final orders = await supabase
        .from('orders_enriched')
        .select(
          'id, number, client_name, seller_name, store_name, laboratory_name, external_order_id, due_at, status, priority',
        )
        .inFilter('status', benchStatuses)
        .order('due_at', ascending: true);
    final list = List<Map<String, dynamic>>.from(orders);
    if (list.isEmpty) return list;
    final ids = list.map((row) => row['id'] as String).toList();
    final steps = await supabase
        .from('assembly_steps')
        .select('order_id, step_key, status, started_at')
        .inFilter('order_id', ids);
    final byOrder = <String, List<Map<String, dynamic>>>{};
    for (final step in steps) {
      final id = step['order_id'] as String;
      byOrder.putIfAbsent(id, () => []).add({
        'key': step['step_key'],
        'status': step['status'],
        'started_at': step['started_at'],
      });
    }
    for (final order in list) {
      order['steps'] = byOrder[order['id']] ?? [];
    }
    await mergeOperations(list);
    return list;
  }

  Future<Map<String, dynamic>> stockGridSettings() async {
    try {
      final row = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'stock_grid')
          .maybeSingle();
      final value = row?['value'];
      if (value is Map<String, dynamic>) return value;
      if (value is Map) return Map<String, dynamic>.from(value);
    } catch (_) {}
    return {};
  }

  Future<List<Map<String, dynamic>>> stockItems({bool special = false}) async {
    final rows = await supabase
        .from('lens_prescription_stock')
        .select(
          'id, public_code, manufacturer, brand, material, treatment, location, sphere_cents, cylinder_cents, addition_cents, current_qty, min_qty, ideal_qty, is_special, lot_code, lens_type, unit_cost_cents',
        )
        .eq('active', true)
        .eq('is_special', special)
        .order('sphere_cents')
        .order('cylinder_cents');
    return List<Map<String, dynamic>>.from(rows);
  }

  Future<int> lowStockCount() async {
    final rows = await supabase
        .from('lens_prescription_stock')
        .select('id, current_qty, min_qty')
        .eq('active', true);
    var count = 0;
    for (final row in rows) {
      final qty = (row['current_qty'] as num?)?.toInt() ?? 0;
      final min = (row['min_qty'] as num?)?.toInt() ?? 0;
      if (qty <= 0 || qty < min) count += 1;
    }
    return count;
  }

  Future<Map<String, dynamic>> stockItem(String id) async {
    final row = await supabase
        .from('lens_prescription_stock')
        .select('*')
        .eq('id', id)
        .maybeSingle();
    if (row == null) throw StateError('Item de estoque não encontrado.');
    return Map<String, dynamic>.from(row);
  }

  Future<List<Map<String, dynamic>>> stockMovements(String stockId) async {
    final rows = await supabase
        .from('stock_movements')
        .select(
          'id, movement_type, quantity, signed_delta, balance_after, reason, created_at, exceptional, needs_review, order_id',
        )
        .eq('stock_id', stockId)
        .order('created_at', ascending: false)
        .limit(50);
    return List<Map<String, dynamic>>.from(rows);
  }

  Future<void> moveStock({
    required String stockId,
    required String type,
    required int quantity,
    required String reason,
    String? orderId,
    String? lot,
  }) async {
    await supabase.rpc(
      'apply_stock_movement',
      params: {
        'p_stock_id': stockId,
        'p_type': type,
        'p_quantity': quantity,
        'p_reason': reason,
        'p_order_id': orderId,
        'p_lot': lot,
        'p_allow_negative': false,
        'p_idempotency_key': type == 'consumo' && orderId != null
            ? 'consumo:$orderId:$stockId'
            : null,
      },
    );
  }

  Future<Map<String, dynamic>> createStock({
    required int sphereCents,
    required int cylinderCents,
    int? additionCents,
    String? manufacturer,
    String? brand,
    String? material,
    String? treatment,
    String? location,
    String? lensType,
    String? lotCode,
    bool isSpecial = false,
    int minQty = 1,
    int idealQty = 4,
    int initialQty = 0,
  }) async {
    final inserted = await supabase
        .from('lens_prescription_stock')
        .insert({
          'sphere_cents': sphereCents,
          'cylinder_cents': cylinderCents,
          'addition_cents': additionCents,
          'manufacturer': manufacturer,
          'brand': brand,
          'material': material,
          'treatment': treatment,
          'location': location,
          'lens_type': lensType,
          'lot_code': lotCode,
          'is_special': isSpecial,
          'min_qty': minQty,
          'ideal_qty': idealQty,
          'current_qty': 0,
        })
        .select('id, public_code')
        .single();
    final item = Map<String, dynamic>.from(inserted);
    if (initialQty > 0) {
      await moveStock(
        stockId: item['id'] as String,
        type: 'entrada',
        quantity: initialQty,
        reason: 'Entrada inicial do cadastro',
      );
    }
    return item;
  }

  Future<List<Map<String, dynamic>>> queueOrders(String status) async {
    if (!queueStatuses.contains(status)) return [];
    const select =
        'id, number, client_name, seller_id, seller_name, store_id, store_name, due_at, status, priority, laboratory_name, external_order_id';
    final rows = await supabase
        .from('orders_enriched')
        .select(select)
        .eq('status', status)
        .order('due_at', ascending: true)
        .limit(400);
    return onlyQueueStatus(List<Map<String, dynamic>>.from(rows), status);
  }

  Future<List<Map<String, dynamic>>> allOrders({
    String? status,
    String tab = 'andamento',
  }) async {
    final bucket = queueStatuses.contains(status) ? status : null;
    final select =
        'id, number, client_name, seller_id, seller_name, store_id, store_name, due_at, status, priority, laboratory_name, external_order_id';
    final statuses = bucket != null
        ? [bucket]
        : tab == 'encerradas'
        ? closedStatuses
        : tab == 'todas'
        ? [...queueStatuses, ...closedStatuses]
        : queueStatuses;
    final rows = await supabase
        .from('orders_enriched')
        .select(select)
        .inFilter('status', statuses)
        .order('due_at', ascending: true)
        .limit(400);
    return filterOrderList(
      List<Map<String, dynamic>>.from(rows),
      status: bucket,
      tab: tab,
    );
  }

  Future<List<Map<String, dynamic>>> _rowsOrEmpty(
    Future<dynamic> request,
  ) async {
    try {
      return List<Map<String, dynamic>>.from(await request);
    } catch (_) {
      return [];
    }
  }

  Future<Map<String, dynamic>> orderDetail(String id) async {
    final order = await supabase
        .from('orders_enriched')
        .select('*')
        .eq('id', id)
        .maybeSingle();
    if (order == null) throw StateError('OS não encontrada.');
    await mergeOperations([order]);
    final stepsRaw = await _rowsOrEmpty(
      supabase
          .from('assembly_steps')
          .select('step_key, status, started_at, finished_at, notes')
          .eq('order_id', id),
    );
    final steps = [
      for (final step in stepsRaw) {...step, 'key': step['step_key']},
    ];
    final history = await _rowsOrEmpty(
      supabase
          .from('order_status_history')
          .select('from_status, to_status, note, created_at')
          .eq('order_id', id)
          .order('created_at', ascending: false)
          .limit(30),
    );
    var occurrences = await _rowsOrEmpty(
      supabase
          .from('quality_occurrences')
          .select(
            'id, description, status, severity, occurred_at, decision, category_id, quality_categories(name)',
          )
          .eq('order_id', id)
          .order('occurred_at', ascending: false),
    );
    if (occurrences.isEmpty) {
      occurrences = await _rowsOrEmpty(
        supabase
            .from('quality_occurrences')
            .select(
              'id, description, status, severity, occurred_at, decision, category_id',
            )
            .eq('order_id', id)
            .order('occurred_at', ascending: false),
      );
    }
    final messages = await _rowsOrEmpty(
      supabase
          .from('order_messages')
          .select(
            'id, sender_label, body, status, created_at, reply_body, replied_at',
          )
          .eq('order_id', id)
          .order('created_at'),
    );
    Map<String, dynamic>? seller;
    final sellerId = order['seller_id'] as String?;
    if (sellerId != null) {
      try {
        seller = await supabase
            .from('sellers')
            .select('id, name, phone, whatsapp')
            .eq('id', sellerId)
            .maybeSingle();
      } catch (_) {
        seller = null;
      }
    }
    final photos = await _orderPhotos(id);
    return {
      'order': Map<String, dynamic>.from(order),
      'steps': steps,
      'history': history,
      'occurrences': occurrences,
      'messages': messages,
      'seller': seller,
      'photos': photos,
    };
  }

  Future<List<Map<String, dynamic>>> _orderPhotos(String orderId) async {
    final rows = await _rowsOrEmpty(
      supabase
          .from('attachments')
          .select(
            'id, entity_type, entity_id, storage_path, file_name, mime_type, size_bytes, created_at',
          )
          .eq('entity_type', 'order')
          .eq('entity_id', orderId)
          .isFilter('deleted_at', null)
          .order('created_at', ascending: false),
    );
    if (rows.isEmpty) return [];
    final paths = [for (final row in rows) row['storage_path'] as String];
    try {
      final signed = await supabase.storage
          .from('lab-files')
          .createSignedUrlsResult(paths, 60 * 30);
      final urls = <String, String>{
        for (final item in signed)
          if (item is SignedUrlSuccess) item.path: item.signedUrl,
      };
      return [
        for (final row in rows)
          {...row, 'url': urls[row['storage_path'] as String]},
      ];
    } catch (_) {
      return rows;
    }
  }

  Future<void> uploadOrderPhoto({
    required String orderId,
    required Uint8List bytes,
    required String mime,
    required String fileName,
  }) async {
    const allowed = {'image/jpeg', 'image/png', 'image/webp'};
    final type = allowed.contains(mime) ? mime : _mimeFromName(fileName);
    if (!allowed.contains(type)) {
      throw StateError('Envie uma foto JPG, PNG ou WEBP.');
    }
    if (bytes.isEmpty || bytes.length > 8 * 1024 * 1024) {
      throw StateError('A foto deve ter até 8 MB.');
    }
    final id = _uuidV4();
    final ext = type == 'image/png'
        ? 'png'
        : type == 'image/webp'
        ? 'webp'
        : 'jpg';
    final path = 'order/$orderId/$id.$ext';
    await supabase.storage
        .from('lab-files')
        .uploadBinary(
          path,
          bytes,
          fileOptions: FileOptions(contentType: type, upsert: false),
        );
    await supabase.from('attachments').insert({
      'id': id,
      'entity_type': 'order',
      'entity_id': orderId,
      'storage_path': path,
      'file_name': fileName.length > 120
          ? fileName.substring(0, 120)
          : fileName,
      'mime_type': type,
      'size_bytes': bytes.length,
      'uploaded_by': supabase.auth.currentUser?.id,
    });
  }

  String _mimeFromName(String name) {
    final lower = name.toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.webp')) return 'image/webp';
    return 'image/jpeg';
  }

  String _uuidV4() {
    final random = Random.secure();
    final bytes = List<int>.generate(16, (_) => random.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    String hex(int i) => bytes[i].toRadixString(16).padLeft(2, '0');
    return '${hex(0)}${hex(1)}${hex(2)}${hex(3)}-${hex(4)}${hex(5)}-${hex(6)}${hex(7)}-${hex(8)}${hex(9)}-${hex(10)}${hex(11)}${hex(12)}${hex(13)}${hex(14)}${hex(15)}';
  }

  Future<void> updateLensForecast(
    String id, {
    String? expectedAt,
    String? supplierRef,
  }) async {
    await supabase
        .from('service_orders')
        .update({
          'lens_expected_at': expectedAt,
          'lens_supplier_ref': supplierRef,
        })
        .eq('id', id);
  }

  Future<List<Map<String, dynamic>>> findOrders(String query) async {
    final q = query.trim().replaceAll(RegExp(r'[%_,]'), '');
    if (q.length < 2) return [];
    const select =
        'id, number, client_name, seller_name, store_name, status, due_at, priority, lens_supplier_ref, external_order_id';
    final rows = await supabase
        .from('orders_enriched')
        .select(select)
        .or(
          'number.ilike.%$q%,client_name.ilike.%$q%,seller_name.ilike.%$q%,external_order_id.ilike.%$q%,lens_supplier_ref.ilike.%$q%',
        )
        .limit(30);
    return List<Map<String, dynamic>>.from(rows);
  }

  Future<void> saveLensOrder(
    String id, {
    String? expectedAt,
    String? supplierRef,
    String? house,
    Map<String, dynamic>? lensSpec,
  }) async {
    final spec = <String, dynamic>{...?lensSpec};
    final casa = house?.trim() ?? '';
    if (casa.isEmpty) {
      spec.remove('supplier_house');
    } else {
      spec['supplier_house'] = casa;
    }
    final ref = supplierRef?.trim() ?? '';
    await supabase
        .from('service_orders')
        .update({
          'lens_expected_at': (expectedAt == null || expectedAt.isEmpty)
              ? null
              : expectedAt,
          'lens_supplier_ref': ref.isEmpty ? null : ref,
          'lens_spec': spec,
        })
        .eq('id', id);
  }

  Future<
    ({List<Map<String, dynamic>> lateOrders, List<Map<String, dynamic>> notes})
  >
  dayNotices() async {
    final now = DateTime.now().toUtc().toIso8601String();
    final lateRows = await supabase
        .from('orders_enriched')
        .select(
          'id, number, client_name, seller_name, due_at, status, priority, external_order_id',
        )
        .lt('due_at', now)
        .inFilter('status', queueStatuses)
        .order('due_at')
        .limit(40);
    final noteRows = await supabase
        .from('order_messages')
        .select('id, order_id, sender_label, body, status, created_at')
        .inFilter('status', ['novo', 'visualizado'])
        .order('created_at', ascending: false)
        .limit(30);
    return (
      lateOrders: List<Map<String, dynamic>>.from(lateRows),
      notes: List<Map<String, dynamic>>.from(noteRows),
    );
  }

  Future<Set<String>> conversationOrderIds() async {
    final notes = await _rowsOrEmpty(
      supabase.from('order_messages').select('order_id').limit(400),
    );
    final chat = await _rowsOrEmpty(
      supabase.from('order_chat_messages').select('order_id').limit(400),
    );
    return {
      for (final row in [...notes, ...chat]) '${row['order_id']}',
    };
  }

  Future<List<Map<String, dynamic>>> chatMessages(String orderId) async {
    final rows = await _rowsOrEmpty(
      supabase
          .from('order_chat_messages')
          .select('id, author_kind, author_label, body, audio_path, created_at')
          .eq('order_id', orderId)
          .order('created_at'),
    );
    final paths = [
      for (final row in rows)
        if ('${row['audio_path'] ?? ''}'.isNotEmpty)
          row['audio_path'] as String,
    ];
    if (paths.isEmpty) return rows;
    try {
      final signed = await supabase.storage
          .from('lab-files')
          .createSignedUrlsResult(paths, 60 * 30);
      final urls = <String, String>{
        for (final item in signed)
          if (item is SignedUrlSuccess) item.path: item.signedUrl,
      };
      return [
        for (final row in rows)
          {...row, 'audio_url': urls['${row['audio_path']}']},
      ];
    } catch (_) {
      return rows;
    }
  }

  Future<void> sendChatText({
    required String orderId,
    required String body,
    required String label,
  }) async {
    final text = body.trim();
    if (text.isEmpty || text.length > 800) {
      throw StateError('Escreva uma mensagem de até 800 caracteres.');
    }
    await supabase.from('order_chat_messages').insert({
      'order_id': orderId,
      'author_kind': 'lab',
      'author_label': label.length > 80 ? label.substring(0, 80) : label,
      'body': text,
      'created_by': supabase.auth.currentUser?.id,
    });
  }

  Future<void> sendChatAudio({
    required String orderId,
    required Uint8List bytes,
    required String label,
    required String mime,
  }) async {
    if (bytes.isEmpty || bytes.length > 8 * 1024 * 1024) {
      throw StateError('O áudio deve ter até 8 MB.');
    }
    final id = _uuidV4();
    final ext = mime.contains('wav')
        ? 'wav'
        : mime.contains('webm')
        ? 'webm'
        : 'm4a';
    final path = 'chat/$orderId/$id.$ext';
    await supabase.storage
        .from('lab-files')
        .uploadBinary(
          path,
          bytes,
          fileOptions: FileOptions(contentType: mime, upsert: false),
        );
    await supabase.from('order_chat_messages').insert({
      'order_id': orderId,
      'author_kind': 'lab',
      'author_label': label.length > 80 ? label.substring(0, 80) : label,
      'audio_path': path,
      'created_by': supabase.auth.currentUser?.id,
    });
  }

  Future<void> markNoteSeen(String id) async {
    try {
      await supabase.rpc('mark_message_viewed', params: {'p_message_id': id});
    } catch (_) {}
  }

  Future<void> replyMessage(String id, String body) async {
    await supabase
        .from('order_messages')
        .update({
          'reply_body': body,
          'replied_at': DateTime.now().toUtc().toIso8601String(),
          'status': 'respondida',
        })
        .eq('id', id);
  }

  Future<List<Map<String, dynamic>>> openBo() async {
    var list = await _rowsOrEmpty(
      supabase
          .from('quality_occurrences')
          .select(
            'id, order_id, occurred_at, description, severity, status, decision, quality_categories(name)',
          )
          .inFilter('status', ['aberta', 'em_tratamento'])
          .order('occurred_at')
          .limit(100),
    );
    if (list.isEmpty) {
      list = await _rowsOrEmpty(
        supabase
            .from('quality_occurrences')
            .select(
              'id, order_id, occurred_at, description, severity, status, decision',
            )
            .inFilter('status', ['aberta', 'em_tratamento'])
            .order('occurred_at')
            .limit(100),
      );
    }
    if (list.isEmpty) return list;
    final ids = list.map((row) => row['order_id'] as String).toSet().toList();
    final orders = await supabase
        .from('orders_enriched')
        .select(
          'id, number, client_name, seller_name, store_name, laboratory_name, external_order_id, status',
        )
        .inFilter('id', ids);
    final byId = {for (final order in orders) order['id']: order};
    for (final row in list) {
      row['order'] = byId[row['order_id']];
    }
    return list;
  }

  Future<List<Map<String, dynamic>>> messages() async {
    final rows = await supabase
        .from('order_messages')
        .select(
          'id, order_id, sender_label, body, status, created_at, reply_body',
        )
        .order('created_at', ascending: false)
        .limit(80);
    return List<Map<String, dynamic>>.from(rows);
  }

  Future<void> updateOrder({
    required String id,
    required String clientName,
    required String laboratoryId,
    required String serviceDescription,
    String? sellerId,
    String? storeId,
    String? enteredAt,
    String? dueAt,
    String? notes,
    String? orderRef,
    String priority = 'normal',
    Map<String, dynamic>? lensSpec,
  }) async {
    await supabase.rpc(
      'update_service_order',
      params: {
        'p_order_id': id,
        'p_client_name': clientName,
        'p_seller_id': sellerId,
        'p_store_id': storeId,
        'p_laboratory_id': laboratoryId,
        'p_entered_at': enteredAt ?? DateTime.now().toUtc().toIso8601String(),
        'p_due_at': dueAt,
        'p_notes': notes,
        'p_service_description': serviceDescription,
        'p_external_order_id': orderRef,
        'p_priority': priority,
        'p_lens_spec': lensSpec ?? <String, dynamic>{},
      },
    );
  }

  Future<Map<String, dynamic>> saveStore({
    String? id,
    required String tradeName,
    String? legalName,
    String? phone,
    String? whatsapp,
    String? email,
    String? address,
    String? notes,
    int? quickCode,
    bool active = true,
  }) async {
    final payload = {
      'trade_name': tradeName,
      'legal_name': legalName,
      'phone': phone,
      'whatsapp': whatsapp,
      'email': email,
      'address': address,
      'notes': notes,
      'active': active,
      if (quickCode != null) 'quick_code': quickCode,
    };
    final row = id == null
        ? await supabase
              .from('stores')
              .insert(payload)
              .select('id, trade_name, quick_code, active')
              .single()
        : await supabase
              .from('stores')
              .update(payload)
              .eq('id', id)
              .select('id, trade_name, quick_code, active')
              .single();
    return Map<String, dynamic>.from(row);
  }

  Future<Map<String, dynamic>> saveSeller({
    String? id,
    required String name,
    String? phone,
    String? whatsapp,
    String? email,
    String? notes,
    int? quickCode,
    bool active = true,
    List<String>? storeIds,
  }) async {
    final payload = {
      'name': name,
      'phone': phone,
      'whatsapp': whatsapp,
      'email': email,
      'notes': notes,
      'active': active,
      if (quickCode != null) 'quick_code': quickCode,
    };
    final row = id == null
        ? await supabase
              .from('sellers')
              .insert(payload)
              .select('id, name, quick_code, active')
              .single()
        : await supabase
              .from('sellers')
              .update(payload)
              .eq('id', id)
              .select('id, name, quick_code, active')
              .single();
    final saved = Map<String, dynamic>.from(row);
    if (storeIds != null) {
      await supabase
          .from('seller_stores')
          .delete()
          .eq('seller_id', saved['id']);
      if (storeIds.isNotEmpty) {
        await supabase.from('seller_stores').insert([
          for (final storeId in storeIds)
            {'seller_id': saved['id'], 'store_id': storeId},
        ]);
      }
    }
    return saved;
  }

  Future<List<Map<String, dynamic>>> routineLogs() async {
    final rows = await supabase
        .from('routine_logs')
        .select(
          'id, kind, item_key, label, lenses_count, notes, done_at, done_by',
        )
        .eq('day', saoPauloDay())
        .order('done_at');
    return List<Map<String, dynamic>>.from(rows);
  }

  Future<void> toggleRoutineItem(String key, String label, bool done) async {
    if (done) {
      await supabase.from('routine_logs').insert({
        'kind': 'checklist',
        'item_key': key,
        'label': label,
      });
      return;
    }
    await supabase
        .from('routine_logs')
        .delete()
        .eq('kind', 'checklist')
        .eq('item_key', key)
        .eq('day', saoPauloDay());
  }

  Future<void> logMotoboy({int? lenses, String? notes}) async {
    await supabase.from('routine_logs').insert({
      'kind': 'motoboy',
      'label': 'Chegada do motoboy',
      'lenses_count': lenses,
      'notes': notes,
    });
  }

  Future<void> addRoutineNote(String text) async {
    await supabase.from('routine_logs').insert({'kind': 'nota', 'label': text});
  }

  Future<void> decideOccurrence(
    String id,
    String decision,
    String note, {
    String? lensExpectedAt,
  }) async {
    await supabase.rpc(
      'decide_occurrence',
      params: {
        'p_id': id,
        'p_decision': decision,
        'p_note': note,
        'p_lens_expected_at': lensExpectedAt,
      },
    );
  }

  Future<List<(String name, int count)>> rankByCompleted({
    required String field,
  }) async {
    final from = DateTime.now().toUtc().subtract(
      Duration(days: DateTime.now().day - 1),
    );
    final rows = await supabase
        .from('orders_enriched')
        .select('$field, status, completed_at')
        .eq('status', 'pronto')
        .gte('completed_at', from.toIso8601String());
    final counts = <String, int>{};
    for (final row in rows) {
      final name = ('${row[field]}').trim();
      final key = name.isEmpty ? 'Sem cadastro' : name;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    final ranked = counts.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    return [for (final entry in ranked) (entry.key, entry.value)];
  }

  Future<List<Map<String, dynamic>>> kaizenIdeas() async {
    final rows = await supabase
        .from('kaizen_ideas')
        .select('id, title, status, created_at')
        .order('created_at', ascending: false)
        .limit(80);
    return List<Map<String, dynamic>>.from(rows);
  }

  Future<void> saveKaizen({
    required String title,
    required String problem,
  }) async {
    final userId = supabase.auth.currentUser?.id;
    await supabase.from('kaizen_ideas').insert({
      'title': title,
      'problem': problem,
      'proposal': '',
      'area': 'Geral',
      'category': 'fluxo',
      'impact': 2,
      'effort': 2,
      'created_by': userId,
      'owner_id': userId,
    });
  }

  Future<List<String>> sellerStoreIds(String sellerId) async {
    final rows = await supabase
        .from('seller_stores')
        .select('store_id')
        .eq('seller_id', sellerId);
    return [for (final row in rows) row['store_id'] as String];
  }

  Future<String> setSellerAppAccess(String sellerId, String pin) async {
    final data = await supabase.rpc(
      'set_seller_app_access',
      params: {'p_seller_id': sellerId, 'p_pin': pin},
    );
    final row = Map<String, dynamic>.from(data as Map);
    return '${row['login'] ?? ''}';
  }

  Future<({String name, String kind, String token})> sellerAppLogin(
    String login,
    String pin,
    String ipHash,
  ) async {
    final data = await supabase.rpc(
      'seller_app_login',
      params: {'p_login': login.trim(), 'p_pin': pin, 'p_ip_hash': ipHash},
    );
    final row = Map<String, dynamic>.from(data as Map);
    return (
      name: '${row['name'] ?? 'Vendedor'}',
      kind: 'vendedor',
      token: '${row['token']}',
    );
  }

  Future<String> issuePortalLink(String subjectType, String subjectId) async {
    final token = await supabase.rpc(
      'issue_portal_credential',
      params: {'p_subject_type': subjectType, 'p_subject_id': subjectId},
    );
    return '$token';
  }

  Future<({String name, String kind})> portalIdentity(
    String token,
    String ipHash,
  ) async {
    final data = await supabase.rpc(
      'portal_identity',
      params: {'p_token': token, 'p_ip_hash': ipHash},
    );
    final row = Map<String, dynamic>.from(data as Map);
    final type = '${row['kind']}';
    return (
      name: '${row['name'] ?? 'Acompanhamento'}',
      kind: type == 'store' ? 'loja' : 'vendedor',
    );
  }

  Future<List<Map<String, dynamic>>> portalOrders(
    String token,
    String ipHash,
  ) async {
    final data = await supabase.rpc(
      'portal_orders',
      params: {
        'p_token': token,
        'p_ip_hash': ipHash,
        'p_query': '',
        'p_seller_id': null,
        'p_status': '',
        'p_from': null,
        'p_to': null,
        'p_late': false,
        'p_ready': false,
      },
    );
    if (data is List)
      return [for (final row in data) Map<String, dynamic>.from(row as Map)];
    return [];
  }

  Future<Map<String, dynamic>> portalOrderDetail(
    String token,
    String ipHash,
    String orderId,
  ) async {
    final data = await supabase.rpc(
      'portal_order_detail',
      params: {'p_token': token, 'p_ip_hash': ipHash, 'p_order_id': orderId},
    );
    return Map<String, dynamic>.from(data as Map);
  }

  Future<List<Map<String, dynamic>>> staffUsers() async {
    final rows = await supabase
        .from('profiles')
        .select('id, full_name, role, active')
        .order('full_name');
    return List<Map<String, dynamic>>.from(rows);
  }

  Future<void> createStaffUser({
    required String email,
    required String password,
    required String fullName,
    required String role,
  }) async {
    await supabase.rpc(
      'create_staff_user',
      params: {
        'p_email': email,
        'p_password': password,
        'p_full_name': fullName,
        'p_role': role,
      },
    );
  }

  Future<void> updateStaffUser(String id, {String? role, bool? active}) async {
    await supabase
        .from('profiles')
        .update({
          if (role != null) 'role': role,
          if (active != null) 'active': active,
        })
        .eq('id', id);
  }

  Future<void> saveLaboratory({
    String? id,
    required String name,
    required String code,
    String color = '#0e6b62',
    String? notes,
    bool active = true,
  }) async {
    final payload = {
      'name': name,
      'code': code,
      'color': color,
      'notes': notes,
      'active': active,
    };
    if (id == null) {
      await supabase.from('laboratories').insert(payload);
    } else {
      await supabase.from('laboratories').update(payload).eq('id', id);
    }
  }

  Future<List<Map<String, dynamic>>> productionGoals() async {
    final rows = await supabase
        .from('production_goals')
        .select('id, laboratory_id, scope, target, valid_from')
        .order('valid_from', ascending: false);
    return List<Map<String, dynamic>>.from(rows);
  }

  Future<void> saveProductionGoal({
    String? laboratoryId,
    required String scope,
    required int target,
    required String validFrom,
  }) async {
    await supabase.from('production_goals').insert({
      'laboratory_id': laboratoryId,
      'scope': scope,
      'target': target,
      'valid_from': validFrom,
    });
  }

  Future<List<Map<String, dynamic>>> fiveSAudits() async {
    final rows = await supabase
        .from('five_s_audits')
        .select(
          'id, area, audited_at, seiri, seiton, seiso, seiketsu, shitsuke, notes',
        )
        .order('audited_at', ascending: false)
        .limit(40);
    return List<Map<String, dynamic>>.from(rows);
  }

  Future<void> saveFiveSAudit({
    required String area,
    required double seiri,
    required double seiton,
    required double seiso,
    required double seiketsu,
    required double shitsuke,
    String? notes,
  }) async {
    await supabase.from('five_s_audits').insert({
      'area': area,
      'seiri': seiri,
      'seiton': seiton,
      'seiso': seiso,
      'seiketsu': seiketsu,
      'shitsuke': shitsuke,
      'notes': notes,
    });
  }

  Future<Map<String, num>> leanSnapshot({int days = 30}) async {
    final from = DateTime.now()
        .toUtc()
        .subtract(Duration(days: days))
        .toIso8601String();
    final orders = await supabase
        .from('orders_enriched')
        .select('id, status, entered_at, due_at, completed_at, delivered_at')
        .gte('entered_at', from)
        .limit(800);
    final bos = await _rowsOrEmpty(
      supabase
          .from('quality_occurrences')
          .select('id, status, occurred_at')
          .gte('occurred_at', from)
          .limit(400),
    );
    var entered = 0;
    var completed = 0;
    var onTime = 0;
    var wip = 0;
    for (final row in List<Map<String, dynamic>>.from(orders)) {
      entered++;
      final status = '${row['status']}';
      if (queueStatuses.contains(status)) wip++;
      if (status == 'pronto' || status == 'entregue') {
        completed++;
        final due = DateTime.tryParse('${row['due_at'] ?? ''}');
        final done = DateTime.tryParse(
          '${row['completed_at'] ?? row['delivered_at'] ?? ''}',
        );
        if (due == null || done == null || !done.isAfter(due)) onTime++;
      }
    }
    final openDefects = bos
        .where(
          (row) =>
              row['status'] == 'aberta' || row['status'] == 'em_tratamento',
        )
        .length;
    return {
      'entered': entered,
      'completed': completed,
      'wip': wip,
      'otd': completed == 0 ? 0 : onTime / completed,
      'defects': bos.length,
      'openDefects': openDefects,
    };
  }

  Future<void> portalSendMessage(
    String token,
    String ipHash,
    String orderId,
    String body,
  ) async {
    await supabase.rpc(
      'portal_send_message',
      params: {
        'p_token': token,
        'p_ip_hash': ipHash,
        'p_order_id': orderId,
        'p_body': body,
      },
    );
  }
}
