import 'package:flutter/material.dart';

import '../domain.dart';
import '../lab_api.dart';
import '../theme.dart';
import '../widgets.dart';

class FiveSScreen extends StatefulWidget {
  const FiveSScreen({super.key});

  @override
  State<FiveSScreen> createState() => _FiveSScreenState();
}

class _FiveSScreenState extends State<FiveSScreen> {
  final api = LabApi();
  final area = TextEditingController(text: 'Bancada de montagem');
  final notes = TextEditingController();
  List<Map<String, dynamic>> rows = [];
  double seiri = 4;
  double seiton = 4;
  double seiso = 4;
  double seiketsu = 4;
  double shitsuke = 4;
  bool loading = true;
  bool pending = false;
  String? error;

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    area.dispose();
    notes.dispose();
    super.dispose();
  }

  Future<void> load() async {
    try {
      final next = await api.fiveSAudits();
      if (mounted) setState(() { rows = next; loading = false; error = null; });
    } catch (e) {
      if (mounted) setState(() { error = friendlyError(e); loading = false; });
    }
  }

  Future<void> save() async {
    if (area.text.trim().length < 2) {
      setState(() => error = 'Informe a área auditada.');
      return;
    }
    setState(() => pending = true);
    try {
      await api.saveFiveSAudit(
        area: area.text.trim(),
        seiri: seiri,
        seiton: seiton,
        seiso: seiso,
        seiketsu: seiketsu,
        shitsuke: shitsuke,
        notes: notes.text.trim().isEmpty ? null : notes.text.trim(),
      );
      notes.clear();
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
      appBar: AppBar(title: const Text('Auditoria 5S')),
      body: loading
          ? Center(child: error == null ? const CircularProgressIndicator() : LabError(message: error!, onRetry: load))
          : RefreshIndicator(
              onRefresh: load,
              child: ListView(
                padding: const EdgeInsets.all(AppSpace.md),
                children: [
                  if (error != null) LabError(message: error!),
                  TextField(controller: area, decoration: const InputDecoration(labelText: 'Área')),
                  _slider('Seiri · utilidade', seiri, (value) => setState(() => seiri = value)),
                  _slider('Seiton · organização', seiton, (value) => setState(() => seiton = value)),
                  _slider('Seiso · limpeza', seiso, (value) => setState(() => seiso = value)),
                  _slider('Seiketsu · padronização', seiketsu, (value) => setState(() => seiketsu = value)),
                  _slider('Shitsuke · disciplina', shitsuke, (value) => setState(() => shitsuke = value)),
                  TextField(controller: notes, maxLines: 2, decoration: const InputDecoration(labelText: 'Observação')),
                  const SizedBox(height: 8),
                  FilledButton(onPressed: pending ? null : save, child: Text(pending ? 'Salvando...' : 'Registrar auditoria')),
                  const SizedBox(height: AppSpace.lg),
                  Text('Histórico', style: Theme.of(context).textTheme.titleMedium),
                  if (rows.isEmpty) const Text('Nenhuma auditoria ainda.'),
                  for (final row in rows)
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text('${row['area']}'),
                      subtitle: Text(
                        'S${row['seiri']} O${row['seiton']} L${row['seiso']} P${row['seiketsu']} D${row['shitsuke']}\n${formatWhen(row['audited_at'])}',
                      ),
                      isThreeLine: true,
                    ),
                ],
              ),
            ),
    );
  }

  Widget _slider(String label, double value, ValueChanged<double> onChanged) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('$label · ${value.toStringAsFixed(1)}'),
        Slider(value: value, min: 0, max: 5, divisions: 10, onChanged: onChanged),
      ],
    );
  }
}
