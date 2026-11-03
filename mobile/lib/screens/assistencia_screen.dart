import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../domain.dart';
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
      final next = await api.openBo();
      if (mounted) setState(() { rows = next; error = null; });
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
            TextField(controller: note, decoration: const InputDecoration(labelText: 'Nota da decisão')),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancelar')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Registrar')),
        ],
      ),
    );
    if (ok != true) return;
    setState(() => pending = true);
    try {
      await api.decideOccurrence(row['id'] as String, decision, note.text.trim().isEmpty ? 'Decisão pelo app' : note.text.trim());
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
      appBar: AppBar(title: const Text('Assistência · BO')),
      body: RefreshIndicator(
        onRefresh: load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const Text('Óculos barrados na bancada. Abra a OS ou registre a decisão.'),
            if (error != null) Text(error!, style: const TextStyle(color: Color(0xFFB42318))),
            if (rows.isEmpty) const Padding(padding: EdgeInsets.only(top: 24), child: Text('Nenhum BO aberto agora.')),
            for (final row in rows)
              Card(
                child: ListTile(
                  title: Text('${row['order'] == null ? 'OS' : visibleOrderNumber(Map<String, dynamic>.from(row['order'] as Map))} · ${row['order']?['client_name'] ?? ''}'),
                  subtitle: Text('${row['order']?['laboratory_name'] ?? ''}\n${row['description'] ?? ''}\n${row['status']} · ${formatWhen(row['occurred_at'])}'),
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
