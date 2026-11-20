import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../domain.dart';
import '../lab_api.dart';
import '../session.dart';
import '../stock_grid.dart';
import '../theme.dart';

class StockScreen extends StatefulWidget {
  const StockScreen({super.key, required this.session});
  final Session session;

  @override
  State<StockScreen> createState() => _StockScreenState();
}

class _StockScreenState extends State<StockScreen> {
  final api = LabApi();
  final query = TextEditingController();
  final jumpSphere = TextEditingController();
  final jumpCylinder = TextEditingController();
  List<Map<String, dynamic>> items = [];
  Map<String, dynamic> gridRaw = {};
  String? error;
  bool special = false;
  bool listMode = false;
  String band = 'todas';
  (int, int)? highlight;

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    query.dispose();
    jumpSphere.dispose();
    jumpCylinder.dispose();
    super.dispose();
  }

  Future<void> load() async {
    try {
      final next = await api.stockItems(special: special);
      final grid = special ? <String, dynamic>{} : await api.stockGridSettings();
      if (mounted) {
        setState(() {
          items = next;
          gridRaw = grid;
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
    final visible = items.where((item) {
      if (term.isEmpty) return true;
      final blob = [
        item['public_code'],
        item['manufacturer'],
        item['brand'],
        item['location'],
        formatDiopter(item['sphere_cents']),
        formatDiopter(item['cylinder_cents']),
      ].join(' ').toLowerCase();
      return blob.contains(term);
    }).toList();
    final canWrite = canStockWrite(widget.session.profile?.role ?? '');
    final grid = parseStockGrid(gridRaw);
    final showGrid = !special && !listMode && term.isEmpty;

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Estoque de lentes', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700)),
              const SizedBox(height: 4),
              const Text('Grade esférico × cilíndrico. Toque no + para cadastrar aquele grau, ou no número para abrir o saldo.'),
              const SizedBox(height: 12),
              TextField(
                controller: query,
                decoration: const InputDecoration(labelText: 'Buscar código, grau, marca ou local'),
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  FilterChip(label: const Text('Grade'), selected: !special && !listMode, onSelected: (_) { setState(() { special = false; listMode = false; }); load(); }),
                  FilterChip(label: const Text('Lista'), selected: !special && listMode, onSelected: (_) { setState(() { special = false; listMode = true; }); load(); }),
                  FilterChip(label: const Text('Especiais'), selected: special, onSelected: (_) { setState(() { special = true; listMode = true; }); load(); }),
                  if (canWrite) FilledButton(onPressed: () => context.push('/estoque/nova'), child: const Text('Cadastrar')),
                ],
              ),
              if (showGrid) ...[
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(child: TextField(controller: jumpSphere, decoration: const InputDecoration(labelText: 'Esférico', hintText: '-1,25'))),
                    const SizedBox(width: 8),
                    Expanded(child: TextField(controller: jumpCylinder, decoration: const InputDecoration(labelText: 'Cilíndrico', hintText: '-0,75'))),
                    const SizedBox(width: 8),
                    FilledButton.tonal(
                      onPressed: () {
                        final sph = parseDiopterToCents(jumpSphere.text);
                        final cyl = parseDiopterToCents(jumpCylinder.text);
                        if (sph == null) {
                          setState(() => error = 'Informe o esférico, como -1,25.');
                          return;
                        }
                        setState(() {
                          error = null;
                          band = sph < 0 ? 'neg' : 'pos';
                          highlight = (sph, cyl ?? 0);
                        });
                      },
                      child: const Text('Ir'),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                SegmentedButton<String>(
                  segments: const [
                    ButtonSegment(value: 'todas', label: Text('Toda')),
                    ButtonSegment(value: 'neg', label: Text('Esf. −')),
                    ButtonSegment(value: 'pos', label: Text('Esf. 0/+')),
                  ],
                  selected: {band},
                  onSelectionChanged: (value) => setState(() => band = value.first),
                ),
              ],
              if (error != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(error!, style: const TextStyle(color: Color(0xFFB83A3A)))),
            ],
          ),
        ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: load,
            child: showGrid
                ? ListView(
                    padding: const EdgeInsets.fromLTRB(8, 0, 8, 24),
                    children: [
                      StockPowerGrid(items: visible, grid: grid, canWrite: canWrite, band: band, highlight: highlight),
                    ],
                  )
                : ListView.builder(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                    itemCount: visible.isEmpty ? 1 : visible.length,
                    itemBuilder: (context, index) {
                      if (visible.isEmpty) return const Padding(padding: EdgeInsets.all(24), child: Text('Nenhuma lente neste filtro.'));
                      final item = visible[index];
                      final qty = (item['current_qty'] as num?)?.toInt() ?? 0;
                      final min = (item['min_qty'] as num?)?.toInt() ?? 0;
                      final ideal = (item['ideal_qty'] as num?)?.toInt();
                      final tone = stockTone(qty, min, ideal);
                      return Card(
                        color: stockFillOf(context, tone),
                        child: ListTile(
                          title: Text('${item['public_code']} · ${formatDiopter(item['sphere_cents'])} / ${formatDiopter(item['cylinder_cents'])}'),
                          subtitle: Text([
                            'Saldo $qty · mín. $min',
                            item['brand'] ?? item['manufacturer'],
                            item['location'],
                          ].where((part) => part != null && '$part'.isNotEmpty).join(' · ')),
                          onTap: () => context.push('/estoque/${item['id']}'),
                        ),
                      );
                    },
                  ),
          ),
        ),
      ],
    );
  }
}
