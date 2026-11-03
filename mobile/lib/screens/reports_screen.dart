import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../domain.dart';
import '../lab_api.dart';
import '../theme.dart';
import '../widgets.dart';

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  final api = LabApi();
  Map<String, int> counts = {};
  int lowStock = 0;
  List<Map<String, dynamic>> bos = [];
  bool loading = true;
  String? error;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final next = await api.pipeline();
      final stock = await api.lowStockCount();
      final open = await api.openBo();
      if (mounted) {
        setState(() {
          counts = next;
          lowStock = stock;
          bos = open;
          loading = false;
          error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() { error = friendlyError(e); loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final open = queueStatuses.fold<int>(0, (sum, status) => sum + (counts[status] ?? 0));
    return Scaffold(
      appBar: AppBar(title: const Text('Relatórios')),
      body: loading
          ? Center(child: error == null ? const CircularProgressIndicator() : LabError(message: error!, onRetry: load))
          : RefreshIndicator(
              onRefresh: load,
              child: ListView(
                padding: const EdgeInsets.all(AppSpace.md),
                children: [
                  if (error != null) LabError(message: error!),
                  Text('$open OS em fila', style: Theme.of(context).textTheme.headlineMedium),
                  Text('$lowStock lentes no mínimo · ${bos.length} BO abertos'),
                  const SizedBox(height: AppSpace.md),
                  for (final status in queueStatuses)
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(statusLabel[status] ?? status),
                      trailing: Text('${counts[status] ?? 0}'),
                      onTap: () => context.push('/fila/$status'),
                    ),
                ],
              ),
            ),
    );
  }
}
