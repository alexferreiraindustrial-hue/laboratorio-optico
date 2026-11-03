import 'package:flutter/material.dart';

import '../domain.dart';
import '../lab_api.dart';
import '../session.dart';
import '../theme.dart';
import '../widgets.dart';

class RoutineScreen extends StatefulWidget {
  const RoutineScreen({super.key, required this.session});
  final Session session;

  @override
  State<RoutineScreen> createState() => _RoutineScreenState();
}

class _RoutineScreenState extends State<RoutineScreen> {
  final api = LabApi();
  final lenses = TextEditingController();
  final motoNote = TextEditingController();
  final note = TextEditingController();
  List<Map<String, dynamic>> logs = [];
  bool loading = true;
  String? error;

  String get role => widget.session.profile?.role ?? '';
  bool get canEdit => canRoutineWrite(role);

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    lenses.dispose();
    motoNote.dispose();
    note.dispose();
    super.dispose();
  }

  Future<void> load() async {
    try {
      final next = await api.routineLogs();
      if (mounted) setState(() { logs = next; loading = false; error = null; });
    } catch (e) {
      if (mounted) setState(() { error = friendlyError(e); loading = false; });
    }
  }

  Set<String> get doneKeys => {
        for (final log in logs)
          if (log['kind'] == 'checklist' && log['item_key'] != null) '${log['item_key']}',
      };

  Future<void> toggle((String key, String label) item) async {
    if (!canEdit) return;
    try {
      await api.toggleRoutineItem(item.$1, item.$2, !doneKeys.contains(item.$1));
      await load();
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Rotina do dia')),
      body: loading
          ? Center(child: error == null ? const CircularProgressIndicator() : LabError(message: error!, onRetry: load))
          : RefreshIndicator(
              onRefresh: load,
              child: ListView(
                padding: const EdgeInsets.all(AppSpace.md),
                children: [
                  if (error != null) LabError(message: error!),
                  Text('Abertura', style: Theme.of(context).textTheme.headlineMedium),
                  for (final item in routineOpen) _check(item),
                  const SizedBox(height: AppSpace.md),
                  Text('Chegada do motoboy', style: Theme.of(context).textTheme.titleMedium),
                  TextField(controller: lenses, decoration: const InputDecoration(labelText: 'Lentes que chegaram'), keyboardType: TextInputType.number),
                  TextField(controller: motoNote, decoration: const InputDecoration(labelText: 'Observação')),
                  if (canEdit)
                    FilledButton(
                      onPressed: () async {
                        try {
                          await api.logMotoboy(lenses: int.tryParse(lenses.text.trim()), notes: motoNote.text.trim().isEmpty ? null : motoNote.text.trim());
                          lenses.clear();
                          motoNote.clear();
                          await load();
                        } catch (e) {
                          if (mounted) setState(() => error = friendlyError(e));
                        }
                      },
                      child: const Text('Registrar motoboy'),
                    ),
                  const SizedBox(height: AppSpace.md),
                  Text('Fechamento', style: Theme.of(context).textTheme.headlineMedium),
                  for (final item in routineClose) _check(item),
                  const SizedBox(height: AppSpace.md),
                  TextField(controller: note, decoration: const InputDecoration(labelText: 'Aviso do dia')),
                  if (canEdit)
                    OutlinedButton(
                      onPressed: () async {
                        if (note.text.trim().length < 2) return;
                        try {
                          await api.addRoutineNote(note.text.trim());
                          note.clear();
                          await load();
                        } catch (e) {
                          if (mounted) setState(() => error = friendlyError(e));
                        }
                      },
                      child: const Text('Registrar aviso'),
                    ),
                  for (final log in logs.where((row) => row['kind'] != 'checklist'))
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text('${log['label'] ?? log['kind']}'),
                      subtitle: Text('${formatWhen(log['done_at'])}${log['lenses_count'] != null ? ' · ${log['lenses_count']} lentes' : ''}'),
                    ),
                ],
              ),
            ),
    );
  }

  Widget _check((String key, String label) item) {
    final done = doneKeys.contains(item.$1);
    return CheckboxListTile(
      value: done,
      title: Text(item.$2, style: TextStyle(decoration: done ? TextDecoration.lineThrough : null)),
      onChanged: canEdit ? (_) => toggle(item) : null,
    );
  }
}
