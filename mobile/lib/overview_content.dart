import 'package:flutter/material.dart';

import 'design/la_design.dart';
import 'domain.dart';
import 'production_scope.dart';
import 'production_summary.dart';
import 'production_widgets.dart';

class OverviewContent extends StatefulWidget {
  const OverviewContent({
    super.key,
    required this.orders,
    required this.scope,
    required this.now,
    required this.onOrder,
    required this.onStage,
    required this.onAll,
  });
  final List<OrderData> orders;
  final ProductionScope scope;
  final DateTime now;
  final ValueChanged<String> onOrder;
  final ValueChanged<String> onStage;
  final void Function(String? sellerId, String focus) onAll;
  @override
  State<OverviewContent> createState() => _OverviewContentState();
}

class _OverviewContentState extends State<OverviewContent> {
  String focus = 'all';
  String view = 'priority';
  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: widget.scope,
    builder: (context, _) {
      final orders = selectProduction(
        widget.orders,
        sellerId: widget.scope.sellerId,
        now: widget.now,
      );
      final summary = summarizeProduction(orders, widget.now);
      final priorities = orders
          .where(
            (row) => switch (focus) {
              'late' => productionSignal(row, widget.now).rank == 0,
              'today' => _today(row),
              'ready' => row['status'] == 'pronto',
              _ => true,
            },
          )
          .toList();
      final sellers = summarizeSellers(
        widget.orders,
        widget.scope.sellers,
        widget.now,
      );
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SellerPicker(scope: widget.scope, orders: widget.orders),
          const SizedBox(height: 14),
          LaAdaptiveGrid(
            minWidth: 135,
            spacing: 8,
            children: [
              ProductionMetric(
                label: 'Em acompanhamento',
                value: summary.total,
                icon: Icons.layers_outlined,
                selected: focus == 'all',
                onTap: () => setState(() {
                  focus = 'all';
                  view = 'priority';
                }),
              ),
              ProductionMetric(
                label: 'Em atraso',
                value: summary.late,
                icon: Icons.warning_amber_rounded,
                color: productionTone(context, 0),
                selected: focus == 'late',
                onTap: () => setState(() {
                  focus = 'late';
                  view = 'priority';
                }),
              ),
              ProductionMetric(
                label: 'Vencem hoje',
                value: summary.today,
                icon: Icons.schedule_outlined,
                color: productionTone(context, 2),
                selected: focus == 'today',
                onTap: () => setState(() {
                  focus = 'today';
                  view = 'priority';
                }),
              ),
              ProductionMetric(
                label: 'Para retirada',
                value: summary.ready,
                icon: Icons.check_circle_outline,
                color: productionTone(context, 6),
                selected: focus == 'ready',
                onTap: () => setState(() {
                  focus = 'ready';
                  view = 'priority';
                }),
              ),
            ],
          ),
          const SizedBox(height: 20),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                for (final item in [
                  ('priority', 'Prioridades', Icons.format_list_bulleted),
                  ('sellers', 'Vendedoras', Icons.people_outline),
                  ('stages', 'Etapas', Icons.view_kanban_outlined),
                ])
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      selected: view == item.$1,
                      avatar: Icon(
                        item.$3,
                        size: 16,
                        color: view == item.$1
                            ? Theme.of(context).colorScheme.onPrimary
                            : Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                      label: Text(item.$2),
                      onSelected: (_) => setState(() => view = item.$1),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          if (view == 'priority') ...[
            Text(switch (focus) {
              'late' => 'Serviços em atraso',
              'today' => 'Prazos de hoje',
              'ready' => 'Prontos para retirada',
              _ => 'Atenção na ordem certa',
            }, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 4),
            Text(
              widget.scope.sellerId == null
                  ? 'Todas as vendedoras · atraso e prazo mais próximo primeiro'
                  : widget.scope.label,
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 12),
            if (priorities.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 24),
                child: Text(
                  focus == 'all' ? 'Nenhum serviço em andamento neste filtro.' : 'Nenhum serviço neste recorte. Toque em Em acompanhamento para ver todos.',
                ),
              )
            else
              ProductionPanel(
                child: Column(
                  children: [
                    for (
                      var index = 0;
                      index < priorities.take(8).length;
                      index++
                    ) ...[
                      if (index > 0) const Divider(height: 1),
                      OperationalOrderLine(
                        order: priorities[index],
                        now: widget.now,
                        onTap: () =>
                            widget.onOrder('${priorities[index]['id']}'),
                      ),
                    ],
                  ],
                ),
              ),
            if (priorities.isNotEmpty)
              TextButton.icon(
                onPressed: () => widget.onAll(widget.scope.sellerId, focus),
                icon: const Icon(Icons.arrow_forward, size: 17),
                label: Text('Ver ${priorities.length} serviços deste filtro'),
              ),
          ] else if (view == 'sellers') ...[
            Text(
              'A produção de cada vendedora',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 4),
            Text(
              'Toque no nome para filtrar a operação. Cadastros ativos aparecem mesmo sem serviços.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 12),
            if (sellers.isEmpty)
              const Text('Nenhuma vendedora cadastrada.')
            else
              ProductionPanel(
                child: Column(
                  children: [
                    for (var i = 0; i < sellers.length; i++) ...[
                      if (i > 0) const Divider(height: 1),
                      ListTile(
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 4,
                        ),
                        leading: CircleAvatar(
                          radius: 18,
                          backgroundColor: Theme.of(context)
                              .colorScheme
                              .primaryContainer,
                          child: Text(
                            sellers[i].name.characters.first.toUpperCase(),
                            style: TextStyle(
                              fontSize: 13,
                              color: Theme.of(context)
                                  .colorScheme
                                  .onPrimaryContainer,
                            ),
                          ),
                        ),
                        title: Text(
                          sellers[i].name,
                          style: Theme.of(context).textTheme.titleSmall,
                        ),
                        subtitle: Text(
                          sellers[i].count == 0
                              ? 'Sem serviços em andamento'
                              : '${sellers[i].count} serviços · ${sellers[i].late} em atraso · ${sellers[i].ready} prontos',
                        ),
                        trailing: const Icon(Icons.chevron_right, size: 18),
                        onTap: () {
                          widget.scope.select(sellers[i].id);
                          setState(() {
                            focus = 'all';
                            view = 'priority';
                          });
                        },
                      ),
                    ],
                  ],
                ),
              ),
          ] else ...[
            Text(
              'Fluxo de produção',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 12),
            ProductionPanel(
              child: Column(
                children: [
                  for (final stage in queueStatuses)
                    ListTile(
                      dense: true,
                      leading: Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: stageTone(context, stage),
                          shape: BoxShape.circle,
                        ),
                      ),
                      title: Text(
                        statusLabel[stage] ?? stage,
                        style: Theme.of(context).textTheme.titleSmall,
                      ),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            '${orders.where((r) => r['status'] == stage).length}',
                            style: const TextStyle(
                              fontFamily: 'JetBrainsMono',
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(width: 8),
                          const Icon(Icons.chevron_right, size: 17),
                        ],
                      ),
                      onTap: () => widget.onStage(stage),
                    ),
                ],
              ),
            ),
          ],
        ],
      );
    },
  );
  bool _today(OrderData row) {
    if (row['status'] == 'pronto') return false;
    final date = DateTime.tryParse('${row['due_at'] ?? ''}')?.toLocal();
    final now = widget.now;
    return date != null &&
        date.year == now.year &&
        date.month == now.month &&
        date.day == now.day;
  }
}
