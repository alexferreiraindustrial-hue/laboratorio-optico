import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../domain.dart';
import '../lab_api.dart';

class MessagesScreen extends StatefulWidget {
  const MessagesScreen({super.key});

  @override
  State<MessagesScreen> createState() => _MessagesScreenState();
}

class _MessagesScreenState extends State<MessagesScreen> {
  final api = LabApi();
  List<Map<String, dynamic>> rows = [];
  String? error;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final next = await api.messages();
      if (mounted) setState(() { rows = next; error = null; });
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Recados')),
      body: RefreshIndicator(
        onRefresh: load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (error != null) Text(error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            if (rows.isEmpty) const Text('Nenhum recado.'),
            for (final row in rows)
              Card(
                child: ListTile(
                  title: Text('${row['sender_label'] ?? 'Recado'} · ${row['status']}'),
                  subtitle: Text('${row['body'] ?? ''}\n${formatWhen(row['created_at'])}'),
                  isThreeLine: true,
                  onTap: () => context.push('/os/${row['order_id']}'),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
