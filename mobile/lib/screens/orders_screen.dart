import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../domain.dart';
import '../production_summary.dart';
import '../lab_api.dart';
import '../queue_board.dart';
import '../theme.dart';
import '../widgets.dart';

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({
    super.key,
    this.status,
    this.sellerId,
    this.focus = "all",
    this.initialQuery = "",
  });
  final String? status;
  final String? sellerId;
  final String focus;
  final String initialQuery;

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  final api = LabApi();
  final query = TextEditingController();
  List<Map<String, dynamic>> rows = [];
  String? error;
  String tab = 'andamento';
  late String focus;

  bool get bucketView => widget.status != null && widget.status!.isNotEmpty;

  @override
  void initState() {
    super.initState();
    query.text = widget.initialQuery;
    focus = widget.focus;
    load();
  }

  @override
  void didUpdateWidget(covariant OrdersScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.status != widget.status) load();
  }

  @override
  void dispose() {
    query.dispose();
    super.dispose();
  }

  Future<void> load() async {
    try {
      final next = bucketView
          ? await api.queueOrders(widget.status!, sellerId: widget.sellerId)
          : await api.allOrders(tab: tab, sellerId: widget.sellerId);
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

  @override
  Widget build(BuildContext context) {
    final term = query.text.trim().toLowerCase();
    final visible =
        filterOrderList(
          rows,
          status: widget.status,
          tab: bucketView ? 'andamento' : tab,
        ).where((row) {
          if (term.isEmpty) return true;
          return '${row['number']} ${row['external_order_id']} ${row['client_name']} ${row['store_name']} ${row['seller_name']} ${row['laboratory_name']} ${statusLabel[row['status']]}'
              .toLowerCase()
              .contains(term);
        }).toList();
    if (focus != 'all') {
      final now = DateTime.now();
      visible.removeWhere(
        (row) => switch (focus) {
          'late' => productionSignal(row, now).rank != 0,
          'ready' => row['status'] != 'pronto',
          'today' => summarizeProduction([row], now).today == 0,
          _ => false,
        },
      );
    }
    final title = bucketView ? (statusLabel[widget.status] ?? 'OS') : 'Ordens';
    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        title: Text(title),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go('/painel');
            }
          },
        ),
      ),
      body: LensSafeBody(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(AppSpace.md),
              child: TextField(
                controller: query,
                decoration: const InputDecoration(
                  labelText: 'Buscar OS, loja, vendedora, laboratório',
                ),
                onChanged: (_) => setState(() {}),
              ),
            ),
            if (!bucketView)
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpace.md,
                  0,
                  AppSpace.md,
                  AppSpace.sm,
                ),
                child: Wrap(
                  spacing: 8,
                  children: [
                    ChoiceChip(
                      label: const Text('Em andamento'),
                      selected: tab == 'andamento',
                      onSelected: (_) {
                        setState(() {
                          tab = 'andamento';
                          focus = 'all';
                        });
                        load();
                      },
                    ),
                    ChoiceChip(
                      label: const Text('Encerradas'),
                      selected: tab == 'encerradas',
                      onSelected: (_) {
                        setState(() {
                          tab = 'encerradas';
                          focus = 'all';
                        });
                        load();
                      },
                    ),
                    ChoiceChip(
                      label: const Text('Todas'),
                      selected: tab == 'todas',
                      onSelected: (_) {
                        setState(() {
                          tab = 'todas';
                          focus = 'all';
                        });
                        load();
                      },
                    ),
                  ],
                ),
              ),
            if (widget.sellerId != null || focus != 'all')
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: Wrap(
                  spacing: 8,
                  runSpacing: 4,
                  children: [
                    if (widget.sellerId != null)
                      Text(
                        rows.isNotEmpty
                            ? 'Vendedora: ${rows.first['seller_name'] ?? 'Sem vendedora'}'
                            : 'Filtro de vendedora ativo',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    if (focus != 'all')
                      InputChip(
                        label: Text(switch (focus) {
                          'late' => 'Em atraso',
                          'today' => 'Vencem hoje',
                          'ready' => 'Para retirada',
                          _ => 'Prioridades',
                        }),
                        onDeleted: () => setState(() => focus = 'all'),
                      ),
                  ],
                ),
              ),
            if (error != null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppSpace.md),
                child: Text(
                  error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ),
            Expanded(
              child: RefreshIndicator(
                onRefresh: load,
                child: QueueBoard(
                  rows: visible,
                  splitByStatus: !bucketView,
                  expandAll: bucketView || term.isNotEmpty,
                  emptyTitle: 'Nenhuma OS neste filtro.',
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
