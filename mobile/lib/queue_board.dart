import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'domain.dart';
import 'theme.dart';
import 'widgets.dart';

class QueueLegend extends StatelessWidget {
  const QueueLegend({super.key});

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.fromLTRB(AppSpace.md, 0, AppSpace.md, AppSpace.sm),
      child: Wrap(
        spacing: 12,
        runSpacing: 6,
        children: [
          _LegendDot(color: Color(0xFFC0392B), label: 'Atrasada / urgente'),
          _LegendDot(color: Color(0xFFD97706), label: 'Prazo próximo'),
          _LegendDot(color: Color(0xFF1A7A63), label: 'No prazo'),
        ],
      ),
    );
  }
}

class _LegendDot extends StatelessWidget {
  const _LegendDot({required this.color, required this.label});
  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(width: 10, height: 10, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 6),
        Text(label, style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }
}

class QueueBoard extends StatefulWidget {
  const QueueBoard({
    super.key,
    required this.rows,
    this.selected,
    this.onToggle,
    this.emptyTitle = 'Nenhuma OS neste filtro.',
    this.splitByStatus = false,
    this.expandAll = false,
  });

  final List<Map<String, dynamic>> rows;
  final Set<String>? selected;
  final ValueChanged<String>? onToggle;
  final String emptyTitle;
  final bool splitByStatus;
  final bool expandAll;

  @override
  State<QueueBoard> createState() => _QueueBoardState();
}

class _QueueBoardState extends State<QueueBoard> {
  final open = <String>{};

  bool shown(String key) => widget.expandAll || open.contains(key);

  void toggle(String key) {
    setState(() {
      if (open.contains(key)) {
        open.remove(key);
      } else {
        open.add(key);
      }
    });
  }

  void setAll(bool expand, List<(String, List<(String, List<(String, List<Map<String, dynamic>>)>)>)> sections) {
    setState(() {
      open.clear();
      if (!expand) return;
      for (final section in sections) {
        for (final storeGroup in section.$2) {
          open.add('${section.$1}|${storeGroup.$1}');
          for (final sellerGroup in storeGroup.$2) {
            open.add('${section.$1}|${storeGroup.$1}|${sellerGroup.$1}');
          }
        }
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    if (widget.rows.isEmpty) {
      return ListView(physics: const AlwaysScrollableScrollPhysics(), children: [LabEmpty(title: widget.emptyTitle)]);
    }
    final sections = widget.splitByStatus
        ? groupByStatusThenStoreThenSeller(widget.rows)
        : [('', groupByStoreThenSeller(widget.rows))];
    return ListView(
      padding: const EdgeInsets.fromLTRB(AppSpace.md, 0, AppSpace.md, 96),
      children: [
        const QueueLegend(),
        Padding(
          padding: const EdgeInsets.only(bottom: AppSpace.sm),
          child: Text(
            widget.expandAll
                ? 'Toque na OS para abrir o detalhe, movimentar e acompanhar a bancada.'
                : 'Toque na loja para ver as OS. Toque na OS para abrir o detalhe como no sistema.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ),
        if (!widget.expandAll)
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton(
              onPressed: () => setAll(open.isEmpty, sections),
              child: Text(open.isEmpty ? 'Abrir todas' : 'Minimizar lojas e vendedoras'),
            ),
          ),
        for (final section in sections) ...[
          if (widget.splitByStatus)
            _StatusHeader(status: section.$1, count: section.$2.fold<int>(0, (sum, store) => sum + store.$2.fold<int>(0, (inner, seller) => inner + seller.$2.length))),
          for (final storeGroup in section.$2) ...[
            _StoreHeader(
              name: storeGroup.$1,
              count: storeGroup.$2.fold<int>(0, (sum, seller) => sum + seller.$2.length),
              sellers: storeGroup.$2.length,
              open: shown('${section.$1}|${storeGroup.$1}'),
              onTap: () => toggle('${section.$1}|${storeGroup.$1}'),
            ),
            if (shown('${section.$1}|${storeGroup.$1}'))
              for (final sellerGroup in storeGroup.$2)
                for (final row in sellerGroup.$2)
                  QueueOrderCard(
                    row: row,
                    store: storeGroup.$1,
                    seller: sellerGroup.$1,
                    selected: widget.selected?.contains(row['id'] as String) ?? false,
                    onToggle: widget.onToggle == null ? null : () => widget.onToggle!(row['id'] as String),
                  ),
          ],
        ],
      ],
    );
  }
}

class _StatusHeader extends StatelessWidget {
  const _StatusHeader({required this.status, required this.count});
  final String status;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: AppSpace.md, bottom: 4),
      child: Row(
        children: [
          Expanded(
            child: Text(
              statusLabel[status] ?? status,
              style: Theme.of(context).textTheme.titleLarge,
            ),
          ),
          Text('$count', style: Theme.of(context).textTheme.titleMedium),
        ],
      ),
    );
  }
}

class _StoreHeader extends StatelessWidget {
  const _StoreHeader({
    required this.name,
    required this.count,
    required this.sellers,
    required this.open,
    required this.onTap,
  });
  final String name;
  final int count;
  final int sellers;
  final bool open;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Padding(
      padding: const EdgeInsets.only(top: AppSpace.md, bottom: 6),
      child: LabPressable(
        semanticLabel: name,
        onTap: onTap,
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: colors.ink,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(
              children: [
                Icon(open ? Icons.expand_less : Icons.expand_more, color: colors.accent),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    name,
                    style: TextStyle(color: colors.paper, fontWeight: FontWeight.w700, fontSize: 16),
                  ),
                ),
                Text(
                  '$count OS',
                  style: TextStyle(color: colors.accent, fontFamily: 'Fraunces', fontSize: 20, fontWeight: FontWeight.w600),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class QueueOrderCard extends StatelessWidget {
  const QueueOrderCard({
    super.key,
    required this.row,
    required this.store,
    required this.seller,
    this.selected = false,
    this.onToggle,
  });

  final Map<String, dynamic> row;
  final String store;
  final String seller;
  final bool selected;
  final VoidCallback? onToggle;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final urgency = orderUrgency(status: '${row['status']}', priority: row['priority'] as String?, dueAt: row['due_at'] as String?);
    final tone = switch (urgency) {
      'vermelho' => (colors.danger, colors.dangerFill, 'Atrasada'),
      'amarelo' => (colors.warn, colors.warnFill, 'Próximo'),
      'verde' => (colors.ok, colors.okFill, 'No prazo'),
      _ => (colors.muted, colors.paper, 'Sem prazo'),
    };
    final storeColor = Color(partyColorValue(store, store: true));
    final sellerColor = Color(partyColorValue(seller, store: false));
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: LabPressable(
        semanticLabel: visibleOrderNumber(row),
        onTap: () => context.push('/os/${row['id']}', extra: row),
        child: Container(
          decoration: BoxDecoration(
            color: colors.paper.withValues(alpha: 0.94),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: selected ? colors.accent : colors.hairline),
          ),
          child: IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  width: 8,
                  decoration: BoxDecoration(
                    color: tone.$1,
                    borderRadius: const BorderRadius.horizontal(left: Radius.circular(18)),
                  ),
                ),
                if (onToggle != null)
                  IconButton(
                    tooltip: selected ? 'Desmarcar' : 'Selecionar',
                    onPressed: onToggle,
                    icon: Icon(selected ? Icons.check_box : Icons.check_box_outline_blank, color: tone.$1),
                  ),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                visibleOrderNumber(row),
                                style: TextStyle(fontFamily: 'Fraunces', fontWeight: FontWeight.w600, fontSize: 22, color: colors.ink),
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(color: tone.$2, borderRadius: BorderRadius.circular(999)),
                              child: Text(tone.$3, style: TextStyle(color: tone.$1, fontWeight: FontWeight.w800, fontSize: 11)),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text('${row['laboratory_name'] ?? 'Sem laboratório'} · ${row['client_name'] ?? ''}'),
                        const SizedBox(height: 6),
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: [
                            _TintChip(color: storeColor, label: store),
                            _TintChip(color: sellerColor, label: seller),
                            _TintChip(color: const Color(0xFF3D4A48), label: statusLabel['${row['status']}'] ?? '${row['status']}'),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(dueDeltaLabel(row['due_at'] as String?, status: row['status'] as String?), style: TextStyle(color: tone.$1, fontWeight: FontWeight.w700, fontSize: 12)),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _TintChip extends StatelessWidget {
  const _TintChip({required this.color, required this.label});
  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(999)),
      child: Text(label, style: TextStyle(color: color, fontWeight: FontWeight.w800, fontSize: 11)),
    );
  }
}
