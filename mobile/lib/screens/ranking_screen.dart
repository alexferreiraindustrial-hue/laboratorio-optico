import 'package:flutter/material.dart';

import '../domain.dart';
import '../lab_api.dart';
import '../theme.dart';
import '../widgets.dart';

class RankingScreen extends StatefulWidget {
  const RankingScreen({super.key});

  @override
  State<RankingScreen> createState() => _RankingScreenState();
}

class _RankingScreenState extends State<RankingScreen> {
  final api = LabApi();
  List<(String, int)> sellers = [];
  List<(String, int)> stores = [];
  List<(String, int)> labs = [];
  bool loading = true;
  String? error;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final nextSellers = await api.rankByCompleted(field: 'seller_name');
      final nextStores = await api.rankByCompleted(field: 'store_name');
      final nextLabs = await api.rankByCompleted(field: 'laboratory_name');
      if (mounted) {
        setState(() {
          sellers = nextSellers;
          stores = nextStores;
          labs = nextLabs;
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
    return Scaffold(
      appBar: AppBar(title: const Text('Ranking do mês')),
      body: loading
          ? Center(child: error == null ? const CircularProgressIndicator() : LabError(message: error!, onRetry: load))
          : RefreshIndicator(
              onRefresh: load,
              child: ListView(
                padding: const EdgeInsets.all(AppSpace.md),
                children: [
                  if (error != null) LabError(message: error!),
                  const Text('OS prontas neste mês, no mesmo banco do site.'),
                  _block('Vendedores', sellers),
                  _block('Lojas', stores),
                  _block('Laboratórios', labs),
                ],
              ),
            ),
    );
  }

  Widget _block(String title, List<(String, int)> rows) {
    return Padding(
      padding: const EdgeInsets.only(top: AppSpace.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.headlineMedium),
          if (rows.isEmpty) const Text('Nenhuma OS pronta neste mês.'),
          for (var i = 0; i < rows.length; i++)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Text('${i + 1}', style: Theme.of(context).textTheme.headlineMedium),
              title: Text(rows[i].$1),
              trailing: Text('${rows[i].$2}'),
            ),
        ],
      ),
    );
  }
}
