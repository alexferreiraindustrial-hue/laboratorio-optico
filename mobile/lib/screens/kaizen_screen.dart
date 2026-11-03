import 'package:flutter/material.dart';

import '../domain.dart';
import '../lab_api.dart';
import '../theme.dart';
import '../widgets.dart';

class KaizenScreen extends StatefulWidget {
  const KaizenScreen({super.key});

  @override
  State<KaizenScreen> createState() => _KaizenScreenState();
}

class _KaizenScreenState extends State<KaizenScreen> {
  final api = LabApi();
  final title = TextEditingController();
  final problem = TextEditingController();
  List<Map<String, dynamic>> rows = [];
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
    title.dispose();
    problem.dispose();
    super.dispose();
  }

  Future<void> load() async {
    try {
      final next = await api.kaizenIdeas();
      if (mounted) setState(() { rows = next; loading = false; error = null; });
    } catch (e) {
      if (mounted) setState(() { error = friendlyError(e); loading = false; });
    }
  }

  Future<void> save() async {
    if (title.text.trim().length < 3 || problem.text.trim().length < 3) {
      setState(() => error = 'Título e problema com pelo menos 3 letras.');
      return;
    }
    setState(() => pending = true);
    try {
      await api.saveKaizen(title: title.text.trim(), problem: problem.text.trim());
      title.clear();
      problem.clear();
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
      appBar: AppBar(title: const Text('Kaizen')),
      body: loading
          ? Center(child: error == null ? const CircularProgressIndicator() : LabError(message: error!, onRetry: load))
          : RefreshIndicator(
              onRefresh: load,
              child: ListView(
                padding: const EdgeInsets.all(AppSpace.md),
                children: [
                  if (error != null) LabError(message: error!),
                  TextField(controller: title, decoration: const InputDecoration(labelText: 'Título da melhoria')),
                  TextField(controller: problem, maxLines: 3, decoration: const InputDecoration(labelText: 'Problema observado')),
                  const SizedBox(height: 8),
                  FilledButton(onPressed: pending ? null : save, child: Text(pending ? 'Salvando...' : 'Registrar ideia')),
                  const SizedBox(height: AppSpace.md),
                  for (final row in rows)
                    Card(
                      child: ListTile(
                        title: Text('${row['title']}'),
                        subtitle: Text('${row['status']} · ${formatWhen(row['created_at'])}'),
                      ),
                    ),
                ],
              ),
            ),
    );
  }
}
