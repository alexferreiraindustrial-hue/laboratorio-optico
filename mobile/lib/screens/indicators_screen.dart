import 'package:flutter/material.dart';

import '../domain.dart';
import '../lab_api.dart';
import '../theme.dart';
import '../widgets.dart';

class IndicatorsScreen extends StatefulWidget {
  const IndicatorsScreen({super.key});

  @override
  State<IndicatorsScreen> createState() => _IndicatorsScreenState();
}

class _IndicatorsScreenState extends State<IndicatorsScreen> {
  final api = LabApi();
  Map<String, num> data = {};
  bool loading = true;
  String? error;
  int days = 30;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final next = await api.leanSnapshot(days: days);
      if (mounted) setState(() { data = next; loading = false; error = null; });
    } catch (e) {
      if (mounted) setState(() { error = friendlyError(e); loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    String pct(num? value) => value == null ? '—' : '${((value) * 100).toStringAsFixed(0)}%';
    return Scaffold(
      appBar: AppBar(title: const Text('Indicadores')),
      body: loading
          ? Center(child: error == null ? const CircularProgressIndicator() : LabError(message: error!, onRetry: load))
          : RefreshIndicator(
              onRefresh: load,
              child: ListView(
                padding: const EdgeInsets.all(AppSpace.md),
                children: [
                  if (error != null) LabError(message: error!),
                  Wrap(
                    spacing: 8,
                    children: [
                      for (final period in [7, 30, 90])
                        ChoiceChip(
                          label: Text('$period dias'),
                          selected: days == period,
                          onSelected: (_) {
                            setState(() { days = period; loading = true; });
                            load();
                          },
                        ),
                    ],
                  ),
                  const SizedBox(height: AppSpace.md),
                  _kpi('OS recebidas', '${data['entered'] ?? 0}'),
                  _kpi('OS prontas / entregues', '${data['completed'] ?? 0}'),
                  _kpi('WIP na fila', '${data['wip'] ?? 0}'),
                  _kpi('OTD no prazo', pct(data['otd'])),
                  _kpi('Ocorrências no período', '${data['defects'] ?? 0}'),
                  _kpi('BO em aberto', '${data['openDefects'] ?? 0}'),
                ],
              ),
            ),
    );
  }

  Widget _kpi(String label, String value) {
    return Card(
      child: ListTile(
        title: Text(label),
        trailing: Text(value, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
      ),
    );
  }
}
