import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../design/la_design.dart';
import '../domain.dart';
import '../lab_api.dart';
import '../notice_bell.dart';
import '../overview_content.dart';
import '../production_scope.dart';
import '../production_widgets.dart';
import '../session.dart';
import 'bench_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({
    super.key,
    required this.session,
    required this.scope,
    this.active = true,
  });
  final Session session;
  final ProductionScope scope;
  final bool active;
  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final api = LabApi();
  List<Map<String, dynamic>> orders = [];
  String? error;
  int? lowStock;
  int? feedbackCount;
  DateTime? updated;
  bool busy = false;
  Timer? timer;
  @override
  void initState() {
    super.initState();
    load();
    timer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (widget.active) load();
    });
  }

  @override
  void didUpdateWidget(covariant DashboardScreen old) {
    super.didUpdateWidget(old);
    if (widget.active && !old.active) load();
  }

  @override
  void dispose() {
    timer?.cancel();
    super.dispose();
  }

  Future<void> load() async {
    if (busy) return;
    setState(() => busy = true);
    unawaited(loadStock());
    if (canManage(widget.session.profile?.role ?? ''))
      unawaited(loadFeedback());
    try {
      final request = api.overviewOrders();
      final catalog = widget.scope.refreshSellers();
      final next = await request;
      await catalog;
      if (!mounted) return;
      setState(() {
        orders = next;
        updated = DateTime.now();
        error = null;
      });
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> loadFeedback() async {
    try {
      final count = await api.clientFeedbackCount();
      if (mounted) setState(() => feedbackCount = count);
    } catch (_) {
      if (mounted) setState(() => feedbackCount = null);
    }
  }

  Future<void> loadStock() async {
    try {
      final count = await api.lowStockCount();
      if (mounted) setState(() => lowStock = count);
    } catch (_) {
      if (mounted) setState(() => lowStock = null);
    }
  }

  void openStage(String status) {
    if (status == 'aguardando_lentes') {
      context.go('/lentes');
    } else if (benchStatuses.contains(status)) {
      BenchScreen.station.value = status;
      context.go('/bancada');
    } else {
      context.push(
        Uri(
          path: '/fila/$status',
          queryParameters: {
            if (widget.scope.sellerId != null)
              'vendedora': widget.scope.sellerId!,
          },
        ).toString(),
      );
    }
  }

  Future<void> openOrder(String id) async {
    await context.push('/os/$id');
    if (mounted) await load();
  }

  @override
  Widget build(BuildContext context) => SafeArea(
    bottom: false,
    child: RefreshIndicator(
      onRefresh: load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
        children: [
          Row(
            children: [
              LaMonogram(size: 34),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'LABGOLD · PRODUÇÃO',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        letterSpacing: 1.2,
                        color: Theme.of(context).colorScheme.primary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Visão geral',
                      style: TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -.6,
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                tooltip: 'Atualizar visão geral',
                onPressed: busy ? null : load,
                icon: busy
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.refresh),
              ),
              NoticeBell(),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            updated == null
                ? 'A operação do laboratório em uma tela.'
                : 'Atualizado às ${updated!.hour.toString().padLeft(2, '0')}:${updated!.minute.toString().padLeft(2, '0')} · serviços em andamento',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: [
              if (canWriteOrders(widget.session.profile?.role ?? ''))
                FilledButton.icon(
                  onPressed: () => context.go('/lancar'),
                  icon: const Icon(Icons.add, size: 18),
                  label: const Text('Lançar serviço'),
                ),
              OutlinedButton.icon(
                onPressed: () => context.push('/assistencia'),
                icon: const Icon(Icons.handyman_outlined, size: 18),
                label: const Text('Assistência'),
              ),
            ],
          ),
          if (canManage(widget.session.profile?.role ?? ''))
            TextButton.icon(
              onPressed: () => context.push('/pos-venda'),
              icon: const Icon(Icons.chat_bubble_outline, size: 18),
              label: Text(
                feedbackCount != null && feedbackCount! > 0
                    ? '$feedbackCount cliente(s) com acompanhamento pendente'
                    : 'Entrega ao cliente e pós-venda',
              ),
            ),
          const SizedBox(height: 18),
          if (error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: LaErrorBanner(
                titulo: updated == null
                    ? 'Não foi possível carregar'
                    : 'Dados da última consulta',
                mensagem: error!,
                onTentarDeNovo: load,
              ),
            ),
          if (updated == null && error == null)
            const Padding(
              padding: EdgeInsets.all(36),
              child: Center(child: CircularProgressIndicator()),
            ),
          if (updated != null)
            OverviewContent(
              orders: orders,
              scope: widget.scope,
              now: DateTime.now(),
              onOrder: openOrder,
              onStage: openStage,
              onAll: (seller, focus) => context.push(
                Uri(
                  path: '/os',
                  queryParameters: {
                    if (seller != null) 'vendedora': seller,
                    'foco': focus,
                  },
                ).toString(),
              ),
            ),
          const SizedBox(height: 18),
          if (lowStock != null && lowStock! > 0)
            ProductionPanel(
              child: ListTile(
                leading: Icon(
                  Icons.inventory_2_outlined,
                  color: LaColors.adapt(context, LaColors.alerta),
                ),
                title: Text('$lowStock itens abaixo do mínimo'),
                subtitle: const Text('Conferir o estoque de lentes'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => context.push('/estoque'),
              ),
            ),
          const Divider(),
          Wrap(
            spacing: 8,
            runSpacing: 4,
            children: [
              TextButton.icon(
                onPressed: () => context.push('/estoque'),
                icon: const Icon(Icons.inventory_2_outlined, size: 17),
                label: const Text('Estoque'),
              ),
              TextButton.icon(
                onPressed: () => context.push('/rotina'),
                icon: const Icon(Icons.checklist, size: 17),
                label: const Text('Rotina'),
              ),
              TextButton.icon(
                onPressed: () => context.go('/mais'),
                icon: const Icon(Icons.apps, size: 17),
                label: const Text('Todas as áreas'),
              ),
            ],
          ),
        ],
      ),
    ),
  );
}
