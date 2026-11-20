import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../domain.dart';
import '../lab_api.dart';
import '../session.dart';

class PartiesScreen extends StatefulWidget {
  const PartiesScreen({super.key, required this.kind, required this.session});
  final String kind;
  final Session session;

  @override
  State<PartiesScreen> createState() => _PartiesScreenState();
}

class _PartiesScreenState extends State<PartiesScreen> {
  final api = LabApi();
  List<Map<String, dynamic>> rows = [];
  String? error;

  bool get lojas => widget.kind == 'lojas';
  bool get canEdit => canPartiesWrite(widget.session.profile?.role ?? '');

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final next = lojas ? await api.stores(activeOnly: false) : await api.sellers(activeOnly: false);
      if (mounted) setState(() { rows = next; error = null; });
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(lojas ? 'Lojas' : 'Vendedores')),
      floatingActionButton: canEdit
          ? FloatingActionButton.extended(
              onPressed: () async {
                await context.push(lojas ? '/lojas/nova' : '/vendedores/nova');
                await load();
              },
              label: Text(lojas ? 'Nova loja' : 'Novo vendedor'),
              icon: const Icon(Icons.add),
            )
          : null,
      body: RefreshIndicator(
        onRefresh: load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const Text('Toque para editar. Cadastro com OS no histórico é desativado, nunca apagado.'),
            if (error != null) Text(error!, style: const TextStyle(color: Color(0xFFB83A3A))),
            for (final row in rows)
              Card(
                child: ListTile(
                  title: Text('${lojas ? 'l' : 'v'}${row['quick_code']} ${lojas ? row['trade_name'] : row['name']}'),
                  subtitle: Text(row['active'] == true ? 'Ativo no cadastro' : 'Inativo'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: canEdit
                      ? () async {
                          await context.push('${lojas ? '/lojas' : '/vendedores'}/${row['id']}');
                          await load();
                        }
                      : null,
                ),
              ),
          ],
        ),
      ),
    );
  }
}
