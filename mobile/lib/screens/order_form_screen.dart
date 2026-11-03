import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../domain.dart';
import '../lab_api.dart';
import '../theme.dart';
import '../widgets.dart';

class OrderFormScreen extends StatefulWidget {
  const OrderFormScreen({super.key, this.id});
  final String? id;

  @override
  State<OrderFormScreen> createState() => _OrderFormScreenState();
}

class _OrderFormScreenState extends State<OrderFormScreen> {
  final api = LabApi();
  final client = TextEditingController();
  final orderRef = TextEditingController();
  final service = TextEditingController();
  final notes = TextEditingController();
  final entered = TextEditingController();
  final due = TextEditingController();
  final odSphere = TextEditingController();
  final odCylinder = TextEditingController();
  final odAxis = TextEditingController();
  final oeSphere = TextEditingController();
  final oeCylinder = TextEditingController();
  final oeAxis = TextEditingController();
  final addition = TextEditingController();
  final frame = TextEditingController();
  final lensNotes = TextEditingController();
  List<Map<String, dynamic>> labs = [];
  List<Map<String, dynamic>> sellers = [];
  List<Map<String, dynamic>> stores = [];
  List<Map<String, dynamic>> links = [];
  String? labId;
  String? sellerId;
  String? storeId;
  String status = 'aguardando_lentes';
  String priority = 'normal';
  String lensType = 'simples';
  bool showReceita = false;
  bool loading = true;
  bool pending = false;
  String? error;
  Map<String, dynamic>? order;

  bool get editing => widget.id != null;

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    for (final c in [
      client, orderRef, service, notes, entered, due,
      odSphere, odCylinder, odAxis, oeSphere, oeCylinder, oeAxis, addition, frame, lensNotes,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  void applyDue(String type) {
    final date = addBusinessDays(type == 'multifocal' ? 5 : 3);
    due.text = toLocalDateTimeValue(date.toIso8601String());
  }

  Future<void> load() async {
    try {
      final nextLabs = await api.catalogs();
      final nextSellers = await api.sellers(activeOnly: false);
      final nextStores = await api.stores(activeOnly: false);
      final nextLinks = await api.sellerLinks();
      Map<String, dynamic>? current;
      if (widget.id != null) {
        final detail = await api.orderDetail(widget.id!);
        current = detail['order'] as Map<String, dynamic>;
      }
      if (!mounted) return;
      final spec = Map<String, dynamic>.from((current?['lens_spec'] as Map?) ?? {});
      setState(() {
        labs = nextLabs;
        sellers = nextSellers;
        stores = nextStores;
        links = nextLinks;
        order = current;
        labId = current?['laboratory_id'] as String? ?? (nextLabs.isEmpty ? null : nextLabs.first['id'] as String);
        sellerId = current?['seller_id'] as String?;
        storeId = current?['store_id'] as String?;
        priority = '${current?['priority'] ?? 'normal'}';
        status = '${current?['status'] ?? 'aguardando_lentes'}';
        client.text = '${current?['client_name'] ?? ''}';
        orderRef.text = '${current?['external_order_id'] ?? ''}';
        service.text = '${current?['service_description'] ?? ''}';
        notes.text = '${current?['notes'] ?? ''}';
        entered.text = toLocalDateTimeValue('${current?['entered_at'] ?? DateTime.now().toIso8601String()}');
        due.text = toLocalDateTimeValue(current?['due_at'] as String?);
        if (!editing && due.text.isEmpty) applyDue(lensType);
        odSphere.text = '${spec['od_sphere'] ?? ''}';
        odCylinder.text = '${spec['od_cylinder'] ?? ''}';
        odAxis.text = '${spec['od_axis'] ?? ''}';
        oeSphere.text = '${spec['oe_sphere'] ?? ''}';
        oeCylinder.text = '${spec['oe_cylinder'] ?? ''}';
        oeAxis.text = '${spec['oe_axis'] ?? ''}';
        addition.text = '${spec['addition'] ?? ''}';
        frame.text = '${spec['frame'] ?? ''}';
        lensNotes.text = '${spec['lens_notes'] ?? ''}';
        loading = false;
        error = null;
      });
    } catch (e) {
      if (mounted) setState(() { error = friendlyError(e); loading = false; });
    }
  }

  List<Map<String, dynamic>> get visibleSellers {
    final storeSellers = {
      for (final link in links)
        if (link['store_id'] == storeId) link['seller_id'] as String,
    };
    return sellers.where((seller) {
      if (seller['id'] == sellerId) return true;
      if (seller['active'] != true) return false;
      if (storeId == null || storeSellers.isEmpty) return true;
      return storeSellers.contains(seller['id']);
    }).toList();
  }

  Map<String, dynamic> spec() => {
        if (odSphere.text.trim().isNotEmpty) 'od_sphere': odSphere.text.trim(),
        if (odCylinder.text.trim().isNotEmpty) 'od_cylinder': odCylinder.text.trim(),
        if (odAxis.text.trim().isNotEmpty) 'od_axis': odAxis.text.trim(),
        if (oeSphere.text.trim().isNotEmpty) 'oe_sphere': oeSphere.text.trim(),
        if (oeCylinder.text.trim().isNotEmpty) 'oe_cylinder': oeCylinder.text.trim(),
        if (oeAxis.text.trim().isNotEmpty) 'oe_axis': oeAxis.text.trim(),
        if (addition.text.trim().isNotEmpty) 'addition': addition.text.trim(),
        if (frame.text.trim().isNotEmpty) 'frame': frame.text.trim(),
        if (lensNotes.text.trim().isNotEmpty) 'lens_notes': lensNotes.text.trim(),
      };

  Future<void> save() async {
    if (client.text.trim().length < 2) {
      setState(() => error = 'Informe o nome do cliente.');
      return;
    }
    if (labId == null) {
      setState(() => error = 'Escolha o laboratório.');
      return;
    }
    if (service.text.trim().length < 3) {
      setState(() => error = 'Descreva o serviço.');
      return;
    }
    setState(() => pending = true);
    try {
      if (editing) {
        await api.updateOrder(
          id: widget.id!,
          clientName: client.text.trim(),
          laboratoryId: labId!,
          serviceDescription: service.text.trim(),
          sellerId: sellerId,
          storeId: storeId,
          enteredAt: localDateTimeToIso(entered.text),
          dueAt: localDateTimeToIso(due.text),
          notes: notes.text.trim().isEmpty ? null : notes.text.trim(),
          orderRef: orderRef.text.trim().isEmpty ? null : orderRef.text.trim(),
          priority: priority,
          lensSpec: spec(),
        );
        if (!mounted) return;
        context.go('/os/${widget.id}');
      } else {
        final created = await api.createOrder(
          clientName: client.text.trim(),
          laboratoryId: labId!,
          sellerId: sellerId,
          storeId: storeId,
          orderRef: orderRef.text.trim().isEmpty ? null : orderRef.text.trim(),
          dueAt: localDateTimeToIso(due.text),
          enteredAt: localDateTimeToIso(entered.text),
          status: status,
          priority: priority,
          notes: notes.text.trim().isEmpty ? null : notes.text.trim(),
          serviceDescription: service.text.trim(),
          lensSpec: spec(),
        );
        if (!mounted) return;
        context.go('/os/${created['id']}');
      }
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    } finally {
      if (mounted) setState(() => pending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(title: Text(editing ? 'Editar OS' : 'Nova OS completa')),
      body: LensSafeBody(
        child: loading
          ? Center(child: error == null ? const CircularProgressIndicator() : LabError(message: error!, onRetry: load))
          : ListView(
              padding: const EdgeInsets.all(AppSpace.md),
              children: [
                if (error != null) LabError(message: error!),
                if (!editing) ...[
                  Text('Tipo de lente', style: Theme.of(context).textTheme.titleMedium),
                  Wrap(
                    spacing: 8,
                    children: [
                      for (final type in ['simples', 'multifocal'])
                        ChoiceChip(
                          label: Text(type == 'simples' ? 'Simples · 3 dias' : 'Multifocal · 5 dias'),
                          selected: lensType == type,
                          onSelected: (_) => setState(() {
                            lensType = type;
                            applyDue(type);
                          }),
                        ),
                    ],
                  ),
                  const SizedBox(height: AppSpace.md),
                ],
                TextField(controller: client, decoration: const InputDecoration(labelText: 'Nome do cliente')),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  key: ValueKey('store-$storeId'),
                  initialValue: storeId,
                  decoration: const InputDecoration(labelText: 'Loja'),
                  items: [
                    const DropdownMenuItem(value: null, child: Text('Não informada')),
                    for (final store in stores.where((row) => row['active'] == true || row['id'] == storeId))
                      DropdownMenuItem(value: store['id'] as String, child: Text('${store['trade_name']}')),
                  ],
                  onChanged: (value) => setState(() {
                    storeId = value;
                    sellerId = null;
                  }),
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  key: ValueKey('seller-$sellerId-$storeId'),
                  initialValue: sellerId,
                  decoration: const InputDecoration(labelText: 'Vendedor'),
                  items: [
                    const DropdownMenuItem(value: null, child: Text('Não informado')),
                    for (final seller in visibleSellers)
                      DropdownMenuItem(value: seller['id'] as String, child: Text('${seller['name']}')),
                  ],
                  onChanged: (value) => setState(() => sellerId = value),
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  key: ValueKey('lab-$labId'),
                  initialValue: labId,
                  decoration: const InputDecoration(labelText: 'Laboratório'),
                  items: [
                    for (final lab in labs)
                      DropdownMenuItem(value: lab['id'] as String, child: Text('${lab['name']}')),
                  ],
                  onChanged: (value) => setState(() => labId = value),
                ),
                const SizedBox(height: 8),
                TextField(controller: entered, decoration: const InputDecoration(labelText: 'Entrada (AAAA-MM-DDTHH:MM)')),
                const SizedBox(height: 8),
                TextField(controller: due, decoration: const InputDecoration(labelText: 'Previsão de entrega')),
                const SizedBox(height: 8),
                if (!editing)
                  DropdownButtonFormField<String>(
                    initialValue: status,
                    decoration: const InputDecoration(labelText: 'Situação inicial'),
                    items: const [
                      DropdownMenuItem(value: 'aguardando_lentes', child: Text('Aguardando lentes')),
                      DropdownMenuItem(value: 'aguardando_montagem', child: Text('Aguardando montagem')),
                    ],
                    onChanged: (value) => setState(() => status = value ?? status),
                  ),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  initialValue: priority,
                  decoration: const InputDecoration(labelText: 'Prioridade'),
                  items: const [
                    DropdownMenuItem(value: 'normal', child: Text('Normal')),
                    DropdownMenuItem(value: 'critica', child: Text('Crítica')),
                  ],
                  onChanged: (value) => setState(() => priority = value ?? priority),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: orderRef,
                  decoration: InputDecoration(
                    labelText: editing ? 'Número da OS da ótica' : 'Número da OS',
                    helperText: editing ? null : 'Em branco, o sistema gera. Se a ótica já tem OS, use esse número.',
                  ),
                ),
                const SizedBox(height: 8),
                TextField(controller: service, maxLines: 3, decoration: const InputDecoration(labelText: 'Descrição do serviço')),
                const SizedBox(height: AppSpace.md),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Dados da receita (opcional)'),
                  trailing: Icon(showReceita ? Icons.expand_less : Icons.expand_more),
                  onTap: () => setState(() => showReceita = !showReceita),
                ),
                if (showReceita) ...[
                  TextField(controller: odSphere, decoration: const InputDecoration(labelText: 'Esférico OD')),
                  TextField(controller: odCylinder, decoration: const InputDecoration(labelText: 'Cilíndrico OD')),
                  TextField(controller: odAxis, decoration: const InputDecoration(labelText: 'Eixo OD')),
                  TextField(controller: addition, decoration: const InputDecoration(labelText: 'Adição')),
                  TextField(controller: oeSphere, decoration: const InputDecoration(labelText: 'Esférico OE')),
                  TextField(controller: oeCylinder, decoration: const InputDecoration(labelText: 'Cilíndrico OE')),
                  TextField(controller: oeAxis, decoration: const InputDecoration(labelText: 'Eixo OE')),
                  TextField(controller: frame, decoration: const InputDecoration(labelText: 'Armação')),
                  TextField(controller: lensNotes, decoration: const InputDecoration(labelText: 'Observação das lentes')),
                ],
                const SizedBox(height: 8),
                TextField(controller: notes, maxLines: 3, decoration: const InputDecoration(labelText: 'Observações gerais')),
                const SizedBox(height: AppSpace.md),
                FilledButton(onPressed: pending ? null : save, child: Text(pending ? 'Salvando...' : editing ? 'Salvar alterações' : 'Abrir OS')),
                const SizedBox(height: 8),
                OutlinedButton(onPressed: () => context.push('/lojas/nova'), child: const Text('+ Loja')),
                OutlinedButton(onPressed: () => context.push('/vendedores/nova'), child: const Text('+ Vendedor')),
                const SizedBox(height: 48),
              ],
            ),
      ),
    );
  }
}
