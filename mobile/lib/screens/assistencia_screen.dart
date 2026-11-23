import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../domain.dart';
import '../assistance_entry.dart';
import '../lab_api.dart';
import '../session.dart';

class AssistenciaScreen extends StatefulWidget {
  const AssistenciaScreen({super.key, required this.session});
  final Session session;

  @override
  State<AssistenciaScreen> createState() => _AssistenciaScreenState();
}

class _AssistenciaScreenState extends State<AssistenciaScreen> {
  final api = LabApi();
  List<Map<String, dynamic>> rows = [];
  List<Map<String, dynamic>> assistance = [];
  String? error;
  bool pending = false;

  String get role => widget.session.profile?.role ?? '';

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final result = await Future.wait([api.openBo(), api.assistanceOrders()]);
      final next = result[0];
      if (mounted)
        setState(() {
          rows = next;
          assistance = result[1];
          error = null;
        });
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    }
  }

  Future<void> decide(Map<String, dynamic> row) async {
    if (!canQualityWrite(role)) return;
    final note = TextEditingController();
    String decision = 'refazer';
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Decidir BO'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            DropdownButtonFormField<String>(
              initialValue: decision,
              items: [
                for (final entry in boDecisions.entries)
                  DropdownMenuItem(value: entry.key, child: Text(entry.value)),
              ],
              onChanged: (value) => decision = value ?? decision,
            ),
            TextField(
              controller: note,
              decoration: const InputDecoration(labelText: 'Nota da decisão'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Registrar'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    setState(() => pending = true);
    try {
      await api.decideOccurrence(
        row['id'] as String,
        decision,
        note.text.trim().isEmpty ? 'Decisão pelo app' : note.text.trim(),
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
    return Scaffold(
      appBar: AppBar(title: const Text('Assistência e garantias')),
      body: RefreshIndicator(
        onRefresh: load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (canWriteOrders(role)) AssistanceEntry(onChanged: load),
            const SizedBox(height: 12),
            Text(
              'Assistências em andamento · ${assistance.length}',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            for (final order in assistance)
              Card(
                child: ListTile(
                  title: Text('${order['client_name']}'),
                  subtitle: Text(
                    '${order['number']} · ${statusLabel[order['status']] ?? order['status']}\n${formatWhen(order['due_at'])}',
                  ),
                  onTap: () => context.push('/os/${order['id']}'),
                ),
              ),
            const SizedBox(height: 18),
            const Text('Ocorrências da montagem · BO'),
            if (error != null)
              Text(error!, style: const TextStyle(color: Color(0xFFB83A3A))),
            if (rows.isEmpty)
              const Padding(
                padding: EdgeInsets.only(top: 24),
                child: Text('Nenhum BO aberto agora.'),
              ),
            for (final row in rows)
              Card(
                child: ListTile(
                  title: Text(
                    '${row['order'] == null ? 'OS' : visibleOrderNumber(Map<String, dynamic>.from(row['order'] as Map))} · ${row['order']?['client_name'] ?? ''}',
                  ),
                  subtitle: Text(
                    '${row['order']?['laboratory_name'] ?? ''}\n${row['description'] ?? ''}\n${row['status']} · ${formatWhen(row['occurred_at'])}',
                  ),
                  isThreeLine: true,
                  trailing: canQualityWrite(role)
                      ? IconButton(
                          icon: const Icon(Icons.gavel),
                          onPressed: pending ? null : () => decide(row),
                        )
                      : null,
                  onTap: () => context.push('/os/${row['order_id']}'),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
