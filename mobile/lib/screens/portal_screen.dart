import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../design/la_design.dart';
import '../domain.dart';
import '../floor_format.dart';
import '../lab_api.dart';
import '../session.dart';
import '../theme.dart';
import '../widgets.dart';

class PortalHomeScreen extends StatefulWidget {
  const PortalHomeScreen({super.key, required this.session});
  final Session session;

  @override
  State<PortalHomeScreen> createState() => _PortalHomeScreenState();
}

class _PortalHomeScreenState extends State<PortalHomeScreen> {
  final api = LabApi();
  final search = TextEditingController();
  List<Map<String, dynamic>> rows = [];
  SellerFilter filter = SellerFilter.all;
  bool loading = true;
  String? error;

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    search.dispose();
    super.dispose();
  }

  Future<void> load() async {
    try {
      final next = await api.portalOrders(
        widget.session.portalToken!,
        widget.session.deviceHash,
      );
      if (mounted)
        setState(() {
          rows = next;
          loading = false;
          error = null;
        });
    } catch (e) {
      if (mounted)
        setState(() {
          error = friendlyError(e);
          loading = false;
        });
    }
  }

  @override
  Widget build(BuildContext context) {
    final production = rows
        .where((row) => isSellerProduction('${row['status']}'))
        .length;
    final ready = rows.where((row) => isSellerReady('${row['status']}')).length;
    final alerts = rows.where(sellerNeedsAttention).length;
    final closed = rows
        .where((row) => isSellerClosed('${row['status']}'))
        .length;
    final visible = filterSellerOrders(rows, filter, search.text);
    final readyRows = visible
        .where((row) => isSellerReady('${row['status']}'))
        .toList();
    final productionRows = visible
        .where((row) => isSellerProduction('${row['status']}'))
        .toList();
    final closedRows = visible
        .where((row) => isSellerClosed('${row['status']}'))
        .toList();
    final storeGroups = groupByStoreThenSeller(productionRows);

    return Scaffold(
      backgroundColor: LaColors.piso,
      body: SafeArea(
        child: loading
            ? Center(
                child: error == null
                    ? const CircularProgressIndicator()
                    : LabError(message: error!, onRetry: load),
              )
            : RefreshIndicator(
                onRefresh: load,
                child: CustomScrollView(
                  slivers: [
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(
                          AppSpace.md,
                          AppSpace.sm,
                          AppSpace.md,
                          0,
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      const LaMonogram(size: 44),
                                      const SizedBox(height: 8),
                                      Text(
                                        widget.session.portalName ?? 'Vendedor',
                                        style: LaType.tituloSecao,
                                      ),
                                      Text(
                                        'Suas OS no Laboratório ALEX',
                                        style: LaType.apoio,
                                      ),
                                    ],
                                  ),
                                ),
                                IconButton(
                                  tooltip: 'Sair',
                                  onPressed: () => widget.session.signOut(),
                                  icon: const Icon(Icons.logout),
                                ),
                              ],
                            ),
                            const SizedBox(height: AppSpace.md),
                            Row(
                              children: [
                                _SummaryChip(
                                  label: 'Produção',
                                  value: production,
                                  selected: filter == SellerFilter.production,
                                  onTap: () => setState(
                                    () => filter = SellerFilter.production,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                _SummaryChip(
                                  label: 'Prontas',
                                  value: ready,
                                  tone: LaColors.noPrazo,
                                  selected: filter == SellerFilter.ready,
                                  onTap: () => setState(
                                    () => filter = SellerFilter.ready,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                _SummaryChip(
                                  label: 'Atenção',
                                  value: alerts,
                                  tone: LaColors.perigo,
                                  selected: filter == SellerFilter.alerts,
                                  onTap: () => setState(
                                    () => filter = SellerFilter.alerts,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                _SummaryChip(
                                  label: 'Encerradas',
                                  value: closed,
                                  tone: LaColors.regua,
                                  selected: filter == SellerFilter.closed,
                                  onTap: () => setState(
                                    () => filter = SellerFilter.closed,
                                  ),
                                ),
                              ],
                            ),
                            if (alerts > 0 && filter != SellerFilter.closed)
                              Container(
                                margin: const EdgeInsets.only(top: AppSpace.sm),
                                padding: const EdgeInsets.all(AppSpace.md),
                                decoration: BoxDecoration(
                                  color: LaColors.perigoFundo,
                                  borderRadius: BorderRadius.circular(
                                    AppRadius.control,
                                  ),
                                ),
                                child: Text(
                                  '$alerts serviço${alerts == 1 ? '' : 's'} no prazo apertado. O laboratório já prioriza. Abra a OS para mandar recado.',
                                  style: LaType.rotulo.copyWith(
                                    color: LaColors.perigo,
                                    height: 1.35,
                                  ),
                                ),
                              ),
                            const SizedBox(height: AppSpace.md),
                            TextField(
                              controller: search,
                              onChanged: (_) => setState(() {}),
                              decoration: const InputDecoration(
                                labelText: 'Buscar OS, pedido ou cliente',
                                prefixIcon: Icon(Icons.search),
                              ),
                            ),
                            const SizedBox(height: AppSpace.sm),
                            Align(
                              alignment: Alignment.centerLeft,
                              child: TextButton(
                                onPressed:
                                    filter == SellerFilter.all &&
                                        search.text.isEmpty
                                    ? null
                                    : () => setState(() {
                                        filter = SellerFilter.all;
                                        search.clear();
                                      }),
                                child: const Text('Ver todas'),
                              ),
                            ),
                            if (error != null) LabError(message: error!),
                          ],
                        ),
                      ),
                    ),
                    if (visible.isEmpty)
                      const SliverToBoxAdapter(
                        child: LabEmpty(title: 'Nenhum serviço neste filtro.'),
                      ),
                    if (filter != SellerFilter.closed && readyRows.isNotEmpty)
                      ..._section(
                        context,
                        'Prontas para retirar',
                        readyRows,
                        LaColors.branco,
                      ),
                    if (filter != SellerFilter.ready &&
                        filter != SellerFilter.closed)
                      for (final store in storeGroups) ...[
                        SliverToBoxAdapter(
                          child: Padding(
                            padding: const EdgeInsets.fromLTRB(
                              AppSpace.md,
                              AppSpace.md,
                              AppSpace.md,
                              AppSpace.xs,
                            ),
                            child: Text(store.$1, style: LaType.tituloSecao),
                          ),
                        ),
                        SliverPadding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: AppSpace.md,
                          ),
                          sliver: SliverList.separated(
                            itemCount: store.$2.fold<int>(
                              0,
                              (sum, seller) => sum + seller.$2.length,
                            ),
                            separatorBuilder: (_, _) =>
                                const SizedBox(height: 8),
                            itemBuilder: (context, index) {
                              final flat = [
                                for (final seller in store.$2) ...seller.$2,
                              ];
                              return _SellerOrderCard(row: flat[index]);
                            },
                          ),
                        ),
                      ],
                    if (filter != SellerFilter.production &&
                        filter != SellerFilter.ready &&
                        filter != SellerFilter.alerts &&
                        closedRows.isNotEmpty)
                      ..._section(
                        context,
                        'Encerradas',
                        closedRows.take(40).toList(),
                        LaColors.branco,
                      ),
                    const SliverToBoxAdapter(child: SizedBox(height: 32)),
                  ],
                ),
              ),
      ),
    );
  }

  List<Widget> _section(
    BuildContext context,
    String title,
    List<Map<String, dynamic>> items,
    Color fill,
  ) {
    return [
      SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpace.md,
            AppSpace.md,
            AppSpace.md,
            AppSpace.xs,
          ),
          child: Text(title, style: Theme.of(context).textTheme.titleMedium),
        ),
      ),
      SliverPadding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpace.md),
        sliver: SliverList.separated(
          itemCount: items.length,
          separatorBuilder: (_, _) => const SizedBox(height: 8),
          itemBuilder: (context, index) => ColoredBox(
            color: Colors.transparent,
            child: _SellerOrderCard(row: items[index], fill: fill),
          ),
        ),
      ),
    ];
  }
}

class _SummaryChip extends StatelessWidget {
  const _SummaryChip({
    required this.label,
    required this.value,
    required this.onTap,
    this.tone = LaColors.grafite,
    this.selected = false,
  });
  final String label;
  final int value;
  final VoidCallback onTap;
  final Color tone;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final bg = selected ? LaColors.grafite : LaColors.branco;
    final fg = selected ? LaColors.branco : LaColors.grafite;
    final number = selected ? LaColors.branco : tone;
    return Expanded(
      child: Semantics(
        button: true,
        selected: selected,
        label: '$label $value',
        child: Material(
          color: bg,
          borderRadius: LaRadius.rCartao,
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: onTap,
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 76),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 8,
                  vertical: 10,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '$value',
                      style: LaType.numeroLista.copyWith(
                        color: number,
                        fontSize: 28,
                        height: 1,
                      ),
                    ),
                    Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: LaType.apoio.copyWith(
                        color: fg,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SellerOrderCard extends StatelessWidget {
  const _SellerOrderCard({required this.row, this.fill});
  final Map<String, dynamic> row;
  final Color? fill;

  @override
  Widget build(BuildContext context) {
    final status = '${row['status']}';
    return Material(
      color: fill ?? LaColors.branco,
      borderRadius: LaRadius.rCartao,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push('/portal/os/${row['id']}'),
        child: Padding(
          padding: const EdgeInsets.all(LaSpace.interno),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(visibleOrderNumber(row), style: LaType.numeroLista),
                  const SizedBox(width: LaSpace.m),
                  Expanded(
                    child: Text(
                      '${row['client_name'] ?? ''}',
                      style: LaType.corpoForte,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(statusLabel[status] ?? status, style: LaType.apoio),
              const SizedBox(height: 6),
              LaPrazoTag(status: prazoDe(row), texto: prazoCurto(row)),
              const SizedBox(height: 8),
              LaStageBar(
                etapaAtual: flowEtapa(status),
                encerrada: flowEncerrada(status),
                altura: 5,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class PortalOrderScreen extends StatefulWidget {
  const PortalOrderScreen({super.key, required this.session, required this.id});
  final Session session;
  final String id;

  @override
  State<PortalOrderScreen> createState() => _PortalOrderScreenState();
}

class _PortalOrderScreenState extends State<PortalOrderScreen> {
  final api = LabApi();
  final message = TextEditingController();
  Map<String, dynamic>? detail;
  String? error;
  bool pending = false;

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    message.dispose();
    super.dispose();
  }

  Future<void> load() async {
    try {
      final next = await api.portalOrderDetail(
        widget.session.portalToken!,
        widget.session.deviceHash,
        widget.id,
      );
      if (mounted)
        setState(() {
          detail = next;
          error = null;
        });
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    }
  }

  Future<void> send() async {
    if (message.text.trim().length < 5) {
      setState(() => error = 'Escreva um recado com pelo menos 5 letras.');
      return;
    }
    setState(() => pending = true);
    try {
      await api.portalSendMessage(
        widget.session.portalToken!,
        widget.session.deviceHash,
        widget.id,
        message.text.trim(),
      );
      message.clear();
      await load();
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    } finally {
      if (mounted) setState(() => pending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final row = detail;
    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(title: Text(row == null ? 'OS' : visibleOrderNumber(row))),
      body: LensSafeBody(
        child: row == null
            ? Center(
                child: error == null
                    ? const CircularProgressIndicator()
                    : LabError(message: error!, onRetry: load),
              )
            : ListView(
                padding: const EdgeInsets.all(AppSpace.md),
                children: [
                  if (error != null) LabError(message: error!),
                  Container(
                    padding: const EdgeInsets.all(AppSpace.md),
                    decoration: const BoxDecoration(
                      color: LaColors.branco,
                      borderRadius: LaRadius.rCartao,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${row['client_name']}',
                          style: LaType.corpoForte.copyWith(fontSize: 22),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          statusLabel['${row['status']}'] ?? '${row['status']}',
                          style: LaType.rotulo,
                        ),
                        const SizedBox(height: 8),
                        LaStageBar(
                          etapaAtual: flowEtapa('${row['status']}'),
                          encerrada: flowEncerrada('${row['status']}'),
                          altura: 5,
                        ),
                        const SizedBox(height: 8),
                        LaPrazoTag(
                          status: prazoDe(row),
                          texto: prazoCurto(row),
                        ),
                        Text('Loja: ${row['store_name'] ?? '—'}'),
                        Text('Prazo ${formatWhen(row['due_at'])}'),
                        if (row['service_description'] != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 8),
                            child: Text('${row['service_description']}'),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpace.lg),
                  Text(
                    'Recado para o laboratório',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: AppSpace.sm),
                  TextField(
                    controller: message,
                    maxLines: 3,
                    decoration: const InputDecoration(labelText: 'Mensagem'),
                  ),
                  const SizedBox(height: AppSpace.sm),
                  FilledButton(
                    onPressed: pending ? null : send,
                    child: Text(pending ? 'Enviando...' : 'Enviar recado'),
                  ),
                  const SizedBox(height: AppSpace.lg),
                  Text(
                    'Histórico',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  for (final item in List<Map<String, dynamic>>.from(
                    row['history'] as List? ?? [],
                  ))
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(
                        '${statusLabel[item['to_status']] ?? item['to_status']}',
                      ),
                      subtitle: Text(formatWhen(item['created_at'])),
                    ),
                ],
              ),
      ),
    );
  }
}
