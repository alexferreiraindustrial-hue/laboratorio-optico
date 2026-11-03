import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'domain.dart';
import 'theme.dart';

class StockPowerGrid extends StatelessWidget {
  const StockPowerGrid({
    super.key,
    required this.items,
    required this.grid,
    required this.canWrite,
    this.band = 'todas',
    this.highlight,
  });

  final List<Map<String, dynamic>> items;
  final ({int sphereMinCents, int sphereMaxCents, int cylinderMinCents, int cylinderMaxCents, int stepCents}) grid;
  final bool canWrite;
  final String band;
  final (int sphere, int cylinder)? highlight;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    var spheres = powerSeries(grid.sphereMinCents, grid.sphereMaxCents, grid.stepCents);
    final cylinders = powerSeries(grid.cylinderMinCents, grid.cylinderMaxCents, grid.stepCents);
    if (band == 'neg') spheres = spheres.where((value) => value < 0).toList();
    if (band == 'pos') spheres = spheres.where((value) => value >= 0).toList();
    final byPower = <String, List<Map<String, dynamic>>>{};
    for (final item in items) {
      final key = '${item['sphere_cents']}|${item['cylinder_cents']}';
      (byPower[key] ??= []).add(item);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 0, 4, 8),
          child: Text(
            'Linha = esférico. Coluna = cilíndrico. Número = saldo. + cadastra aquele grau.',
            style: TextStyle(color: colors.muted, fontSize: 12, fontWeight: FontWeight.w600),
          ),
        ),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  _HeadCell(label: 'Esf \\ Cil', width: 72, colors: colors),
                  for (final cyl in cylinders) _HeadCell(label: formatDiopter(cyl), colors: colors),
                ],
              ),
              for (final sph in spheres)
                Row(
                  children: [
                    _HeadCell(label: formatDiopter(sph), width: 72, alignEnd: true, colors: colors),
                    for (final cyl in cylinders)
                      _QtyCell(
                        items: byPower['$sph|$cyl'] ?? const [],
                        sphere: sph,
                        cylinder: cyl,
                        canWrite: canWrite,
                        highlighted: highlight == (sph, cyl),
                      ),
                  ],
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _HeadCell extends StatelessWidget {
  const _HeadCell({required this.label, required this.colors, this.width = 52, this.alignEnd = false});
  final String label;
  final AppColors colors;
  final double width;
  final bool alignEnd;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: 36,
      alignment: alignEnd ? Alignment.centerRight : Alignment.center,
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: colors.muted)),
    );
  }
}

class _QtyCell extends StatelessWidget {
  const _QtyCell({
    required this.items,
    required this.sphere,
    required this.cylinder,
    required this.canWrite,
    this.highlighted = false,
  });
  final List<Map<String, dynamic>> items;
  final int sphere;
  final int cylinder;
  final bool canWrite;
  final bool highlighted;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final empty = items.isEmpty;
    final qty = items.fold<int>(0, (sum, item) => sum + ((item['current_qty'] as num?)?.toInt() ?? 0));
    final min = items.isEmpty ? 0 : items.map((item) => (item['min_qty'] as num?)?.toInt() ?? 0).reduce((a, b) => a < b ? a : b);
    final ideal = items.isEmpty
        ? null
        : items.map((item) => (item['ideal_qty'] as num?)?.toInt()).whereType<int>().fold<int?>(null, (max, value) => max == null || value > max ? value : max);
    final tone = empty ? null : stockTone(qty, min, ideal);
    return Padding(
      padding: const EdgeInsets.all(2),
      child: SizedBox(
        width: 48,
        height: 40,
        child: Material(
          color: empty ? colors.paper.withValues(alpha: 0.7) : stockFillOf(context, tone ?? 'verde'),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
            side: BorderSide(
              color: highlighted ? colors.accent : (empty ? colors.hairline : Colors.transparent),
              width: highlighted ? 2 : 1,
            ),
          ),
          child: InkWell(
            onTap: empty
                ? (canWrite
                    ? () => context.push('/estoque/nova?esf=${Uri.encodeQueryComponent(formatDiopter(sphere))}&cil=${Uri.encodeQueryComponent(formatDiopter(cylinder))}')
                    : null)
                : () {
                    if (items.length == 1) {
                      context.push('/estoque/${items.first['id']}');
                    } else {
                      showModalBottomSheet<void>(
                        context: context,
                        showDragHandle: true,
                        builder: (context) => ListView(
                          padding: const EdgeInsets.all(16),
                          children: [
                            Text('${formatDiopter(sphere)} / ${formatDiopter(cylinder)}', style: Theme.of(context).textTheme.titleLarge),
                            const SizedBox(height: 8),
                            for (final item in items)
                              ListTile(
                                title: Text('${item['public_code']} · saldo ${item['current_qty']}'),
                                subtitle: Text('${item['brand'] ?? item['manufacturer'] ?? ''} ${item['location'] ?? ''}'),
                                onTap: () {
                                  Navigator.pop(context);
                                  context.push('/estoque/${item['id']}');
                                },
                              ),
                            if (canWrite)
                              ListTile(
                                leading: const Icon(Icons.add),
                                title: const Text('Cadastrar outra lente neste grau'),
                                onTap: () {
                                  Navigator.pop(context);
                                  context.push('/estoque/nova?esf=${Uri.encodeQueryComponent(formatDiopter(sphere))}&cil=${Uri.encodeQueryComponent(formatDiopter(cylinder))}');
                                },
                              ),
                          ],
                        ),
                      );
                    }
                  },
            child: Center(
              child: Text(
                empty ? '+' : '$qty',
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: empty ? 16 : 13,
                  color: empty ? colors.accent : colors.ink,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
