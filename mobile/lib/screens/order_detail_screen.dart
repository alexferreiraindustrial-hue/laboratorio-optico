import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../design/la_design.dart';
import '../domain.dart';
import '../order_followup.dart';
import '../operational_controls.dart';
import '../floor_format.dart';
import '../lab_api.dart';
import '../os_chat.dart';
import '../session.dart';
import '../theme.dart';
import '../widgets.dart';

class OrderDetailScreen extends StatefulWidget {
  const OrderDetailScreen({super.key, required this.id, required this.session});
  final String id;
  final Session session;

  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  final api = LabApi();
  final note = TextEditingController();
  Map<String, dynamic>? data;
  bool talked = false;
  String? error;
  String? nextStatus;
  bool pending = false;

  String get role => widget.session.profile?.role ?? 'consulta';

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    note.dispose();
    super.dispose();
  }

  Future<void> load() async {
    try {
      final next = await api.orderDetail(widget.id);
      if (!mounted) return;
      setState(() {
        data = next;
        error = null;
        nextStatus = null;
      });
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    }
  }

  Future<void> move() async {
    if (nextStatus == null) return;
    if (nextStatus == 'em_correcao' && note.text.trim().length < 3) {
      setState(() => error = 'Descreva o problema que exige correção.');
      return;
    }
    setState(() => pending = true);
    try {
      await api.changeStatus(
        widget.id,
        nextStatus!,
        note.text.trim().isEmpty ? 'Movimentação pelo app' : note.text.trim(),
      );
      note.clear();
      await load();
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    } finally {
      if (mounted) setState(() => pending = false);
    }
  }

  Future<void> runBench() async {
    final order = data?['order'] as Map<String, dynamic>?;
    if (order == null) return;
    final action = nextBenchAction(
      medicalRequired: order['medical_review_required'] == true,
      status: '${order['status']}',
      role: role,
      steps: List<Map<String, dynamic>>.from(data?['steps'] as List? ?? []),
    );
    if (action.kind == 'none') return;
    setState(() => pending = true);
    try {
      if (action.kind == 'status') {
        await api.changeStatus(widget.id, action.to!, action.note);
      } else {
        await api.advanceStep(widget.id, action.step!, action.action!);
      }
      await load();
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    } finally {
      if (mounted) setState(() => pending = false);
    }
  }

  Future<void> attachPhoto(ImageSource source, {String? stepKey}) async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(
      source: source,
      imageQuality: 78,
      maxWidth: 1600,
    );
    if (picked == null) return;
    setState(() => pending = true);
    try {
      final bytes = await picked.readAsBytes();
      await api.uploadOrderPhoto(
        orderId: widget.id,
        stepKey: stepKey,
        bytes: bytes,
        mime: picked.mimeType ?? 'image/jpeg',
        fileName: picked.name,
      );
      await load();
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    } finally {
      if (mounted) setState(() => pending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final order = data?['order'] as Map<String, dynamic>?;
    final spec = Map<String, dynamic>.from((order?['lens_spec'] as Map?) ?? {});
    final targets = order == null
        ? <String>[]
        : allowedTargets(order['status'] as String, role);
    final steps = List<Map<String, dynamic>>.from(
      data?['steps'] as List? ?? [],
    );
    final occurrences = List<Map<String, dynamic>>.from(
      data?['occurrences'] as List? ?? [],
    );
    final messages = List<Map<String, dynamic>>.from(
      data?['messages'] as List? ?? [],
    );
    final history = List<Map<String, dynamic>>.from(
      data?['history'] as List? ?? [],
    );
    final photos = List<Map<String, dynamic>>.from(
      data?['photos'] as List? ?? [],
    );
    final status = '${order?['status'] ?? ''}';
    return Scaffold(
      backgroundColor: LaColors.adapt(context, LaColors.piso),
      appBar: AppBar(
        title: Text(order == null ? 'OS' : 'Ordem de serviço'),
        actions: [
          if (order != null && order['priority'] == 'critica')
            Padding(
              padding: EdgeInsets.only(right: 8),
              child: Center(child: LaBadge.urgente()),
            ),
          if (order != null && canWriteOrders(role))
            IconButton(
              tooltip: 'Editar OS',
              onPressed: () => context.push('/os/${widget.id}/editar'),
              icon: Icon(Icons.edit_outlined),
            ),
        ],
      ),
      body: LensSafeBody(
        child: data == null
            ? Center(
                child: error == null
                    ? CircularProgressIndicator()
                    : LabError(message: error!, onRetry: load),
              )
            : RefreshIndicator(
                color: colors.accent,
                onRefresh: load,
                child: ListView(
                  padding: EdgeInsets.fromLTRB(AppSpace.md, 8, AppSpace.md, 40),
                  children: [
                    if (error != null) LabError(message: error!),
                    if (order != null)
                      OrderFollowup(
                        order: order,
                        editable: canWriteOrders(role),
                        onChanged: load,
                      ),
                    if (order != null &&
                        canWriteOrders(role) &&
                        !['entregue', 'cancelado'].contains(status))
                      StageNoteControl(
                        key: ValueKey("note-${widget.id}"),
                        id: widget.id,
                        status: status,
                        onChanged: load,
                        photo: (source, step) =>
                            attachPhoto(source, stepKey: step),
                      ),
                    if (order != null &&
                        canManage(role) &&
                        ['pronto', 'entregue'].contains(status))
                      ClientDeliveryControl(
                        key: ValueKey("delivery-${widget.id}"),
                        id: widget.id,
                        delivery:
                            data?['client_delivery'] as Map<String, dynamic>?,
                        onChanged: load,
                      ),
                    LabSheet(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            visibleOrderNumber(order!),
                            style: LaType.numeroOs,
                          ),
                          Text(
                            '${order['client_name']}',
                            style: LaType.corpoForte.copyWith(fontSize: 20),
                          ),
                          if (talked || messages.isNotEmpty) ...[
                            SizedBox(height: 6),
                            Text(
                              'Conversa nesta OS',
                              style: LaType.rotulo.copyWith(
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                          SizedBox(height: LaSpace.secao),
                          LaStageBar(
                            etapaAtual: flowEtapa(status),
                            encerrada: flowEncerrada(status),
                          ),
                          SizedBox(height: 6),
                          Text(
                            '${statusLabel[status] ?? status} · Etapa ${flowEtapa(status)} de 6',
                            style: LaType.corpoForte,
                          ),
                          SizedBox(height: LaSpace.item),
                          LaPrazoTag(
                            status: prazoDe(order),
                            texto: prazoCurto(order),
                          ),
                          SizedBox(height: AppSpace.sm),
                          LabMeta(
                            label: 'Laboratório',
                            value: '${order['laboratory_name'] ?? '—'}',
                          ),
                          LabMeta(
                            label: 'Loja',
                            value: '${order['store_name'] ?? '—'}',
                          ),
                          LabMeta(
                            label: 'Vendedora',
                            value: '${order['seller_name'] ?? '—'}',
                          ),
                          LabMeta(
                            label: 'Sistema',
                            value: '${order['number']}',
                          ),
                          if (order['external_order_id'] != null)
                            LabMeta(
                              label: 'OS da ótica',
                              value: '${order['external_order_id']}',
                            ),
                          LabMeta(
                            label: 'Entrada',
                            value: formatWhen(order['entered_at']),
                          ),
                          LabMeta(
                            label: 'Prazo do cliente',
                            value: formatWhen(order['due_at']),
                          ),
                          LabMeta(
                            label: 'Data do laboratório',
                            value: formatWhen(order['lens_expected_at']),
                          ),
                          LabMeta(
                            label: 'Pedido da lente',
                            value: '${order['lens_supplier_ref'] ?? '—'}',
                          ),
                          if (houseOf(Map<String, dynamic>.from(order)) != null)
                            LabMeta(
                              label: 'Casa da lente',
                              value: houseOf(Map<String, dynamic>.from(order))!,
                            ),
                          LabMeta(
                            label: 'Montagem',
                            value: formatWhen(order['completed_at']),
                          ),
                          LabMeta(
                            label: 'Entrega',
                            value: formatWhen(order['delivered_at']),
                          ),
                          if (order['service_description'] != null)
                            LabMeta(
                              label: 'Serviço',
                              value: '${order['service_description']}',
                            ),
                          if (order['notes'] != null)
                            LabMeta(label: 'Notas', value: '${order['notes']}'),
                          if (order['status'] == 'aguardando_lentes')
                            Padding(
                              padding: EdgeInsets.only(top: 8),
                              child: Text(
                                'Aguarda lentes. A montagem ainda não começou.',
                                style: TextStyle(
                                  color: colors.warn,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                    if (targets.isNotEmpty)
                      LabSection(
                        title: 'Movimentar',
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            DropdownButtonFormField<String>(
                              key: ValueKey('next-$nextStatus'),
                              initialValue: nextStatus,
                              hint: const Text('Escolha o destino do serviço'),
                              dropdownColor: colors.paper,
                              items: [
                                for (final status in targets)
                                  DropdownMenuItem(
                                    value: status,
                                    child: Text(statusLabel[status] ?? status),
                                  ),
                              ],
                              onChanged: (value) =>
                                  setState(() => nextStatus = value),
                            ),
                            SizedBox(height: 8),
                            TextField(
                              controller: note,
                              decoration: InputDecoration(
                                labelText: 'Observação',
                              ),
                            ),
                            SizedBox(height: 12),
                            FilledButton(
                              style: FilledButton.styleFrom(
                                backgroundColor: Theme.of(context).colorScheme.primary,
                                foregroundColor: Theme.of(context).colorScheme.onPrimary,
                              ),
                              onPressed: pending || nextStatus == null
                                  ? null
                                  : move,
                              child: Text(
                                pending ? 'Salvando...' : 'Movimentar',
                              ),
                            ),
                          ],
                        ),
                      ),
                    LabSection(
                      title: 'Receita e armação',
                      child: Column(
                        children: [
                          LabMeta(
                            label: 'OD',
                            value:
                                '${spec['od_sphere'] ?? '—'} ${spec['od_cylinder'] ?? ''} eixo ${spec['od_axis'] ?? '—'}',
                          ),
                          LabMeta(
                            label: 'OE',
                            value:
                                '${spec['oe_sphere'] ?? '—'} ${spec['oe_cylinder'] ?? ''} eixo ${spec['oe_axis'] ?? '—'}',
                          ),
                          LabMeta(
                            label: 'Adição',
                            value: '${spec['addition'] ?? '—'}',
                          ),
                          LabMeta(
                            label: 'Armação',
                            value: '${spec['frame'] ?? '—'}',
                          ),
                          if (spec['lens_notes'] != null)
                            LabMeta(
                              label: 'Lentes',
                              value: '${spec['lens_notes']}',
                            ),
                        ],
                      ),
                    ),
                    LabSection(
                      title: 'Bancada',
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Builder(
                            builder: (context) {
                              final action = nextBenchAction(
                                medicalRequired:
                                    order['medical_review_required'] == true,
                                status: '${order['status']}',
                                role: role,
                                steps: steps,
                              );
                              if (action.kind == 'none') {
                                return Text(
                                  action.label,
                                  style: TextStyle(color: colors.muted),
                                );
                              }
                              return FilledButton(
                                style: FilledButton.styleFrom(
                                  backgroundColor: Theme.of(context).colorScheme.primary,
                                  foregroundColor: Theme.of(context).colorScheme.onPrimary,
                                ),
                                onPressed: pending ? null : runBench,
                                child: Text(
                                  pending ? 'Registrando...' : action.label,
                                ),
                              );
                            },
                          ),
                          SizedBox(height: 8),
                          ExpansionTile(
                            title: const Text('Etapas técnicas · opcionais'),
                            children: [
                              for (final key in stepKeys)
                                Padding(
                                  padding: EdgeInsets.symmetric(vertical: 8),
                                  child: Row(
                                    children: [
                                      Expanded(
                                        child: Text(
                                          stepLabel[key]!,
                                          style: Theme.of(context)
                                              .textTheme
                                              .titleMedium,
                                        ),
                                      ),
                                      Text(
                                        _stepStatus(steps, key),
                                        style: Theme.of(context)
                                            .textTheme
                                            .bodySmall,
                                      ),
                                    ],
                                  ),
                                ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    LabSection(
                      title: 'Fotos do serviço',
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            'Fica no histórico da OS e no relatório do serviço.',
                            style: TextStyle(color: colors.muted, fontSize: 13),
                          ),
                          SizedBox(height: 10),
                          if (photos.isEmpty)
                            Text(
                              'Nenhuma foto nesta OS ainda.',
                              style: TextStyle(color: colors.muted),
                            ),
                          if (photos.isNotEmpty)
                            GridView.count(
                              crossAxisCount: 2,
                              shrinkWrap: true,
                              physics: NeverScrollableScrollPhysics(),
                              mainAxisSpacing: 8,
                              crossAxisSpacing: 8,
                              childAspectRatio: 1,
                              children: [
                                for (final item in photos)
                                  LabPressable(
                                    semanticLabel:
                                        'Foto ${item['file_name'] ?? ''}',
                                    onTap: item['url'] == null
                                        ? null
                                        : () {
                                            showDialog<void>(
                                              context: context,
                                              builder: (context) => Dialog(
                                                backgroundColor: Colors.black,
                                                child: InteractiveViewer(
                                                  child: Image.network(
                                                    '${item['url']}',
                                                    fit: BoxFit.contain,
                                                  ),
                                                ),
                                              ),
                                            );
                                          },
                                    child: ClipRRect(
                                      borderRadius: BorderRadius.circular(14),
                                      child: item['url'] == null
                                          ? ColoredBox(
                                              color: colors.paper,
                                              child: Center(
                                                child: Text(
                                                  '${item['file_name'] ?? 'Foto'}',
                                                  textAlign: TextAlign.center,
                                                ),
                                              ),
                                            )
                                          : Image.network(
                                              '${item['url']}',
                                              fit: BoxFit.cover,
                                            ),
                                    ),
                                  ),
                              ],
                            ),
                          if (canAttachPhotos(role)) ...[
                            SizedBox(height: 12),
                            Row(
                              children: [
                                Expanded(
                                  child: FilledButton.icon(
                                    onPressed: pending
                                        ? null
                                        : () => attachPhoto(ImageSource.camera),
                                    icon: Icon(Icons.photo_camera_outlined),
                                    label: Text('Câmera'),
                                  ),
                                ),
                                SizedBox(width: 8),
                                Expanded(
                                  child: OutlinedButton.icon(
                                    onPressed: pending
                                        ? null
                                        : () =>
                                              attachPhoto(ImageSource.gallery),
                                    icon: Icon(Icons.photo_library_outlined),
                                    label: Text('Galeria'),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ],
                      ),
                    ),
                    LabSection(
                      title: 'Ocorrências',
                      child: occurrences.isEmpty
                          ? Text(
                              'Nenhum BO nesta OS.',
                              style: TextStyle(color: colors.muted),
                            )
                          : Column(
                              children: [
                                for (final item in occurrences)
                                  Padding(
                                    padding: EdgeInsets.only(bottom: 12),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          '${item['quality_categories'] is Map ? (item['quality_categories'] as Map)['name'] : 'Ocorrência'} · ${item['status']}',
                                          style: Theme.of(context)
                                              .textTheme
                                              .titleMedium,
                                        ),
                                        Text(
                                          '${item['description'] ?? ''}',
                                          style: Theme.of(context)
                                              .textTheme
                                              .bodyMedium,
                                        ),
                                        Text(
                                          formatWhen(item['occurred_at']),
                                          style: Theme.of(context)
                                              .textTheme
                                              .bodySmall,
                                        ),
                                      ],
                                    ),
                                  ),
                              ],
                            ),
                    ),
                    LabSheet(
                      child: OsChat(
                        orderId: widget.id,
                        author:
                            widget.session.profile?.fullName ?? 'Laboratório',
                        canWrite: canReply(role),
                        legacy: messages,
                        onTalk: (has) {
                          if (has != talked && mounted) {
                            setState(() => talked = has);
                          }
                        },
                      ),
                    ),
                    LabSection(
                      title: 'Histórico',
                      child: history.isEmpty
                          ? Text(
                              'Sem movimentações.',
                              style: TextStyle(color: colors.muted),
                            )
                          : Column(
                              children: [
                                for (final item in history)
                                  Padding(
                                    padding: EdgeInsets.symmetric(vertical: 8),
                                    child: Row(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Expanded(
                                          child: Text(
                                            '${statusLabel[item['from_status']] ?? item['from_status'] ?? ''} → ${statusLabel[item['to_status']] ?? item['to_status'] ?? ''}',
                                            style: Theme.of(context)
                                                .textTheme
                                                .titleMedium,
                                          ),
                                        ),
                                        SizedBox(width: 8),
                                        Text(
                                          formatWhen(item['created_at']),
                                          style: Theme.of(context)
                                              .textTheme
                                              .bodySmall,
                                        ),
                                      ],
                                    ),
                                  ),
                                for (final item in photos)
                                  Padding(
                                    padding: EdgeInsets.symmetric(vertical: 8),
                                    child: Row(
                                      children: [
                                        Expanded(
                                          child: Text(
                                            'Foto anexada',
                                            style: TextStyle(
                                              fontWeight: FontWeight.w700,
                                            ),
                                          ),
                                        ),
                                        Text(
                                          formatWhen(item['created_at']),
                                          style: Theme.of(context)
                                              .textTheme
                                              .bodySmall,
                                        ),
                                      ],
                                    ),
                                  ),
                              ],
                            ),
                    ),
                  ],
                ),
              ),
      ),
    );
  }

  String _stepStatus(List steps, String key) {
    for (final raw in steps) {
      final step = Map<String, dynamic>.from(raw as Map);
      if (step['step_key'] == key || step['key'] == key) {
        return '${step['status']} · ${formatWhen(step['finished_at'] ?? step['started_at'])}';
      }
    }
    return 'pendente';
  }
}
