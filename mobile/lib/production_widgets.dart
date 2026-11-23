import 'package:flutter/material.dart';

import 'design/la_design.dart';
import 'domain.dart';
import 'production_scope.dart';
import 'production_summary.dart';

Color productionTone(BuildContext context, int rank) => switch (rank) {
  0 || 1 => LaColors.adapt(context, LaColors.perigo),
  2 || 3 => LaColors.adapt(context, LaColors.alerta),
  6 => LaColors.adapt(context, LaColors.noPrazo),
  _ => LaColors.adapt(context, LaColors.regua),
};
Color stageTone(BuildContext context, String status) => switch (status) {
  'em_montagem' => const Color(0xFF75ADFF),
  'em_correcao' => const Color(0xFFBCA3FF),
  'em_conferencia' => LaColors.adapt(context, LaColors.alerta),
  'pronto' => LaColors.adapt(context, LaColors.noPrazo),
  _ => LaColors.adapt(context, LaColors.regua),
};

class SellerPicker extends StatelessWidget {
  const SellerPicker({super.key, required this.scope, this.orders = const []});
  final ProductionScope scope;
  final List<OrderData> orders;
  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: scope,
    builder: (context, _) {
      final options = <String, String>{
        for (final row in scope.sellers)
          if (row['active'] == true ||
              orders.any((order) => order['seller_id'] == row['id']) ||
              row['id'] == scope.sellerId)
            '${row['id']}': '${row['name']}',
      };
      for (final row in orders) {
        final id = row['seller_id'] as String? ?? unassignedSeller;
        options.putIfAbsent(
          id,
          () => row['seller_name'] as String? ?? 'Sem vendedora',
        );
      }
      if (scope.sellerId != null)
        options.putIfAbsent(scope.sellerId!, () => scope.label);
      final entries = options.entries.toList()
        ..sort((a, b) => a.value.compareTo(b.value));
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  key: ValueKey(scope.sellerId),
                  initialValue: scope.sellerId ?? '',
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'Vendedora',
                    prefixIcon: Icon(Icons.people_outline, size: 20),
                    contentPadding: EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 12,
                    ),
                  ),
                  items: [
                    const DropdownMenuItem(
                      value: '',
                      child: Text(
                        'Todas as vendedoras',
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    for (final entry in entries)
                      DropdownMenuItem(
                        value: entry.key,
                        child: Text(
                          entry.value,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                  ],
                  onChanged: (id) => scope.select(id == '' ? null : id),
                ),
              ),
              if (scope.sellerId != null)
                IconButton(
                  tooltip: 'Limpar filtro de vendedora',
                  onPressed: () => scope.select(null),
                  icon: const Icon(Icons.filter_alt_off_outlined),
                ),
            ],
          ),
          if (scope.error != null)
            TextButton.icon(
              onPressed: scope.refreshSellers,
              icon: const Icon(Icons.refresh, size: 18),
              label: Text(scope.error!),
            ),
        ],
      );
    },
  );
}

class OperationalOrderLine extends StatelessWidget {
  const OperationalOrderLine({
    super.key,
    required this.order,
    required this.onTap,
    required this.now,
    this.showStage = true,
  });
  final OrderData order;
  final VoidCallback onTap;
  final DateTime now;
  final bool showStage;
  @override
  Widget build(BuildContext context) {
    final signal = productionSignal(order, now);
    final tone = productionTone(context, signal.rank);
    return Semantics(
      button: true,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(top: 6, right: 8),
                    child: Container(
                      width: 7,
                      height: 7,
                      decoration: BoxDecoration(
                        color: stageTone(context, '${order['status']}'),
                        shape: BoxShape.circle,
                      ),
                    ),
                  ),
                  Expanded(
                    child: Text(
                      '${order['client_name'] ?? 'Sem nome'}',
                      style: Theme.of(context).textTheme.titleSmall,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const Icon(Icons.chevron_right, size: 18),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                'OS ${visibleOrderNumber(order)} · ${showStage ? '${statusLabel[order['status']] ?? order['status']} · ' : ''}${order['seller_name'] ?? 'Sem vendedora'}',
                style: Theme.of(context).textTheme.bodySmall,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 7),
              Wrap(
                spacing: 10,
                runSpacing: 4,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  Text(
                    signal.label,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: tone,
                    ),
                  ),
                  Text(
                    formatWhen(order['due_at']),
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class ProductionPanel extends StatelessWidget {
  const ProductionPanel({super.key, required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) => Material(
    color: Theme.of(context).colorScheme.surface,
    clipBehavior: Clip.antiAlias,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(18),
      side: BorderSide(color: Theme.of(context).dividerColor),
    ),
    child: child,
  );
}

class ProductionMetric extends StatelessWidget {
  const ProductionMetric({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    required this.onTap,
    this.color,
    this.selected = false,
  });
  final String label;
  final int value;
  final IconData icon;
  final VoidCallback onTap;
  final Color? color;
  final bool selected;
  @override
  Widget build(BuildContext context) {
    final tone = color ?? Theme.of(context).colorScheme.primary;
    return Material(
      color: Theme.of(context).colorScheme.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(
          color: selected ? tone : Theme.of(context).dividerColor,
          width: selected ? 1.5 : 1,
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(13),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(icon, size: 17, color: tone),
                  const Spacer(),
                  if (selected) Icon(Icons.check_circle, size: 15, color: tone),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                '$value',
                style: TextStyle(
                  fontFamily: 'JetBrainsMono',
                  fontSize: 27,
                  fontWeight: FontWeight.w600,
                  color: tone,
                ),
              ),
              const SizedBox(height: 3),
              Text(label, style: Theme.of(context).textTheme.labelMedium),
            ],
          ),
        ),
      ),
    );
  }
}
