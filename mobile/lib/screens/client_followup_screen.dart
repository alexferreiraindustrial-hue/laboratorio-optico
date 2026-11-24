import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../domain.dart';
import '../lab_api.dart';
import '../session.dart';
import '../operational_controls.dart';

class ClientFollowupScreen extends StatefulWidget {
  const ClientFollowupScreen({super.key, required this.session});
  final Session session;
  @override
  State<ClientFollowupScreen> createState() => _ClientFollowupScreenState();
}

class _ClientFollowupScreenState extends State<ClientFollowupScreen> {
  final api = LabApi();
  final query = TextEditingController();
  List<Map<String, dynamic>> rows = [], found = [];
  String mode = 'pending';
  String? seller, error;
  bool busy = false;
  @override
  void initState() {
    super.initState();
    if (canManage(widget.session.profile?.role ?? '')) load();
  }

  @override
  void dispose() {
    query.dispose();
    super.dispose();
  }

  bool due(Map<String, dynamic> r) =>
      r['contacted_at'] == null &&
      !(DateTime.tryParse('${r['followup_due_at']}') ??
              DateTime.now().add(const Duration(days: 1)))
          .isAfter(DateTime.now());
  Future<void> load() async {
    try {
      final next = await api.clientFollowups();
      if (mounted)
        setState(() {
          rows = next;
          error = null;
        });
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    }
  }

  Future<void> find() async {
    if (busy) return;
    setState(() => busy = true);
    try {
      final next = await api.findOrders(query.text);
      if (mounted)
        setState(
          () => found = next
              .where((r) => ['pronto', 'entregue'].contains(r['status']))
              .toList(),
        );
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> record(Map<String, dynamic> row) async {
    final phone = TextEditingController(text: '${row['client_phone'] ?? ''}');
    final note = TextEditingController(text: '${row['feedback_note'] ?? ''}');
    String? outcome;
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Contato e retorno do cliente'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: phone,
                keyboardType: TextInputType.phone,
                maxLength: 24,
                decoration: const InputDecoration(
                  labelText: 'Telefone do cliente',
                ),
              ),
              DropdownButtonFormField<String>(
                isExpanded: true,
                initialValue: outcome,
                items: const [
                  DropdownMenuItem<String>(
                    value: null,
                    child: Text('Só atualizar contato'),
                  ),
                  DropdownMenuItem(
                    value: 'contato_realizado',
                    child: Text('Enviado · aguardando resposta'),
                  ),
                  DropdownMenuItem(
                    value: 'adaptacao_ok',
                    child: Text('Cliente: está tudo bem'),
                  ),
                  DropdownMenuItem(
                    value: 'precisa_ajuda',
                    child: Text('Cliente precisa de atenção'),
                  ),
                  DropdownMenuItem(
                    value: 'sem_resposta',
                    child: Text('Contato feito · sem resposta'),
                  ),
                ],
                onChanged: (v) => outcome = v,
              ),
              TextField(
                controller: note,
                maxLines: 3,
                maxLength: 2000,
                decoration: const InputDecoration(
                  labelText: 'Retorno do cliente',
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Salvar'),
          ),
        ],
      ),
    );
    if (ok == true && mounted) {
      setState(() => busy = true);
      try {
        await api.updateClientFeedback(row, outcome, note.text, phone.text);
        await load();
      } catch (e) {
        if (mounted) setState(() => error = friendlyError(e));
      } finally {
        if (mounted) setState(() => busy = false);
      }
    }
    phone.dispose();
    note.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!canManage(widget.session.profile?.role ?? ''))
      return const Scaffold(
        body: Center(child: Text('Acesso restrito à gestão de entregas.')),
      );
    final sellers = {
      for (final r in rows)
        if (r['order']?['seller_id'] != null)
          '${r['order']['seller_id']}':
              '${r['order']['seller_name'] ?? 'Vendedora'}',
    };
    final visible = rows
        .where(
          (r) =>
              (seller == null || r['order']?['seller_id'] == seller) &&
              (mode == 'all' ||
                  mode == 'pending' && due(r) ||
                  mode == 'await' && r['contacted_at'] == null && !due(r) ||
                  mode == 'contacted' && r['contacted_at'] != null ||
                  mode == 'help' && r['outcome'] == 'precisa_ajuda'),
        )
        .toList();
    return Scaffold(
      appBar: AppBar(title: const Text('Entrega ao cliente e pós-venda')),
      body: RefreshIndicator(
        onRefresh: load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const Text(
              'Só a entrega efetiva ao cliente inicia os cinco dias. Saídas antigas do laboratório não foram convertidas.',
            ),
            const SizedBox(height: 12),
            TextField(
              controller: query,
              decoration: const InputDecoration(
                labelText: 'Bipe ou informe a OS para dar baixa',
              ),
              onSubmitted: (_) => find(),
            ),
            FilledButton(
              onPressed: busy ? null : find,
              child: const Text(
                'Localizar OS pronta ou que saiu do laboratório',
              ),
            ),
            for (final order in found) ...[
              Text('${order['number']} · ${order['client_name']}'),
              ClientDeliveryControl(
                id: order['id'] as String,
                delivery: rows
                    .where((r) => r['order_id'] == order['id'])
                    .firstOrNull,
                onChanged: load,
              ),
            ],
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              initialValue: seller,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Vendedora'),
              items: [
                const DropdownMenuItem<String>(
                  value: null,
                  child: Text('Todas'),
                ),
                for (final s in sellers.entries)
                  DropdownMenuItem(value: s.key, child: Text(s.value)),
              ],
              onChanged: (v) => setState(() => seller = v),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: mode,
              isExpanded: true,
              items: const [
                DropdownMenuItem(
                  value: 'pending',
                  child: Text('Cinco dias vencidos · falta contato'),
                ),
                DropdownMenuItem(
                  value: 'await',
                  child: Text('Aguardando cinco dias'),
                ),
                DropdownMenuItem(
                  value: 'contacted',
                  child: Text('Contatos registrados'),
                ),
                DropdownMenuItem(
                  value: 'help',
                  child: Text('Cliente precisa de atenção'),
                ),
                DropdownMenuItem(value: 'all', child: Text('Todos')),
              ],
              onChanged: (v) => setState(() => mode = v ?? 'pending'),
            ),
            const SizedBox(height: 12),
            if (error != null)
              Text(
                error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            Text('${visible.length} acompanhamento(s)'),
            for (final row in visible)
              Card(
                child: ExpansionTile(
                  title: Text(
                    '${row['order']?['client_name'] ?? 'Confira a OS'}',
                  ),
                  subtitle: Text(
                    'OS ${row['order']?['number'] ?? ''} · ${row['order']?['seller_name'] ?? 'Sem vendedora'}\nContato a partir de ${formatWhen(row['followup_due_at'])}${row['client_phone'] == null ? ' · falta telefone' : ''}',
                  ),
                  childrenPadding: const EdgeInsets.all(14),
                  children: [
                    Text(
                      'Cliente recebeu em ${formatWhen(row['client_delivered_at'])}',
                    ),
                    Text('${row['client_phone'] ?? 'Complete o telefone'}'),
                    Text(
                      'Olá, ${row['order']?['client_name'] ?? ''}! Queremos saber como você está se adaptando aos óculos. Está conseguindo enxergar bem? Está tudo confortável? Se precisar, avise a gente.',
                    ),
                    TextButton.icon(
                      onPressed: row['client_phone'] == null
                          ? null
                          : () async {
                              await Clipboard.setData(
                                ClipboardData(
                                  text:
                                      'Olá, ${row['order']?['client_name'] ?? ''}! Queremos saber como você está se adaptando aos óculos. Está conseguindo enxergar bem? Está tudo confortável? Se precisar, avise a gente.',
                                ),
                              );
                              if (context.mounted)
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text(
                                      'Copiado. O contato só será marcado após sua confirmação.',
                                    ),
                                  ),
                                );
                            },
                      icon: const Icon(Icons.copy),
                      label: const Text('Copiar mensagem · envio manual'),
                    ),
                    FilledButton(
                      onPressed: busy ? null : () => record(row),
                      child: const Text('Telefone e retorno do cliente'),
                    ),
                    TextButton(
                      onPressed: () => context.push('/os/${row['order_id']}'),
                      child: const Text('Abrir OS'),
                    ),
                  ],
                ),
              ),
            if (visible.isEmpty)
              const Padding(
                padding: EdgeInsets.all(20),
                child: Text('Nenhum acompanhamento neste filtro.'),
              ),
          ],
        ),
      ),
    );
  }
}
