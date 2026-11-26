import 'package:flutter/material.dart';

import '../domain.dart';
import '../lab_api.dart';
import '../queue_board.dart';
import '../session.dart';

class DeliveryScreen extends StatefulWidget {
  const DeliveryScreen({super.key, required this.session});
  final Session session;

  @override
  State<DeliveryScreen> createState() => _DeliveryScreenState();
}

class _DeliveryScreenState extends State<DeliveryScreen> {
  final api = LabApi();
  final selected = <String>{};
  List<Map<String, dynamic>> rows = [];
  String? error;
  bool pending = false;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final next = await api.readyQueue();
      if (mounted) {
        setState(() {
          rows = next;
          error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    }
  }

  Future<void> deliver() async {
    if (!canDeliver(widget.session.profile?.role ?? '')) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Apenas gestor ou administrador registra a saída.')));
      return;
    }
    setState(() => pending = true);
    try {
      for (final id in selected.toList()) {
        await api.changeStatus(id, 'entregue', 'Saída pelo app');
      }
      selected.clear();
      await load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(friendlyError(e))));
    } finally {
      if (mounted) setState(() => pending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        if (error != null) Padding(padding: const EdgeInsets.all(12), child: Text(error!, style: TextStyle(color: Theme.of(context).colorScheme.error))),
        Expanded(
          child: RefreshIndicator(
            onRefresh: load,
            child: QueueBoard(
              rows: rows,
              selected: selected,
              onToggle: (id) => setState(() {
                if (selected.contains(id)) {
                  selected.remove(id);
                } else {
                  selected.add(id);
                }
              }),
              emptyTitle: 'Nada pronto para saída.',
            ),
          ),
        ),
        if (selected.isNotEmpty)
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: FilledButton(
                onPressed: pending ? null : deliver,
                child: Text(pending ? 'Registrando...' : 'Registrar saída (${selected.length})'),
              ),
            ),
          ),
      ],
    );
  }
}
