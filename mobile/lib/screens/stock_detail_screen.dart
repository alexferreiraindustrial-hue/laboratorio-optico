import 'package:flutter/material.dart';

import '../domain.dart';
import '../lab_api.dart';
import '../session.dart';

class StockDetailScreen extends StatefulWidget {
  const StockDetailScreen({super.key, required this.id, required this.session});
  final String id;
  final Session session;

  @override
  State<StockDetailScreen> createState() => _StockDetailScreenState();
}

class _StockDetailScreenState extends State<StockDetailScreen> {
  final api = LabApi();
  final qty = TextEditingController(text: '1');
  final reason = TextEditingController();
  final orderRef = TextEditingController();
  Map<String, dynamic>? item;
  List<Map<String, dynamic>> movements = [];
  String type = 'entrada';
  String? error;
  bool pending = false;

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    qty.dispose();
    reason.dispose();
    orderRef.dispose();
    super.dispose();
  }

  Future<void> load() async {
    try {
      final next = await api.stockItem(widget.id);
      final hist = await api.stockMovements(widget.id);
      if (mounted) {
        setState(() {
          item = next;
          movements = hist;
          error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    }
  }

  Future<void> move() async {
    setState(() => pending = true);
    try {
      await api.moveStock(
        stockId: widget.id,
        type: type,
        quantity: int.parse(qty.text.trim()),
        reason: reason.text.trim(),
        orderId: orderRef.text.trim().isEmpty ? null : orderRef.text.trim(),
      );
      reason.clear();
      await load();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Movimentação registrada.')));
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    } finally {
      if (mounted) setState(() => pending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final role = widget.session.profile?.role ?? '';
    final row = item;
    return Scaffold(
      appBar: AppBar(title: Text(row?['public_code'] as String? ?? 'Estoque')),
      body: row == null
          ? Center(child: error == null ? const CircularProgressIndicator() : Text(error!))
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(
                  '${formatDiopter(row['sphere_cents'])} / ${formatDiopter(row['cylinder_cents'])}',
                  style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w700),
                ),
                Text('Adição ${formatDiopter(row['addition_cents'])}'),
                const SizedBox(height: 8),
                Text('Saldo ${row['current_qty']} · mín. ${row['min_qty']} · ideal ${row['ideal_qty']}'),
                Text([row['manufacturer'], row['brand'], row['material'], row['treatment']].where((part) => part != null).join(' · ')),
                Text('Local ${row['location'] ?? '—'} · lote ${row['lot_code'] ?? '—'}'),
                Text(row['is_special'] == true ? 'Grau especial' : 'Grade principal'),
                const SizedBox(height: 20),
                if (canStockWrite(role) || canStockConsume(role)) ...[
                  const Text('Movimentar', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                  DropdownButtonFormField<String>(
                    initialValue: type,
                    items: [
                      if (canStockWrite(role)) ...[
                        const DropdownMenuItem(value: 'entrada', child: Text('Entrada')),
                        const DropdownMenuItem(value: 'saida', child: Text('Saída')),
                        const DropdownMenuItem(value: 'ajuste', child: Text('Ajuste de inventário')),
                        const DropdownMenuItem(value: 'devolucao', child: Text('Devolução')),
                      ],
                      if (canStockConsume(role)) const DropdownMenuItem(value: 'consumo', child: Text('Consumo por OS')),
                    ],
                    onChanged: (value) => setState(() => type = value ?? 'entrada'),
                  ),
                  const SizedBox(height: 8),
                  TextField(controller: qty, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Quantidade')),
                  const SizedBox(height: 8),
                  TextField(controller: reason, decoration: const InputDecoration(labelText: 'Motivo')),
                  if (type == 'consumo') ...[
                    const SizedBox(height: 8),
                    TextField(controller: orderRef, decoration: const InputDecoration(labelText: 'ID da OS (uuid)')),
                  ],
                  const SizedBox(height: 12),
                  FilledButton(onPressed: pending ? null : move, child: Text(pending ? 'Registrando...' : 'Registrar')),
                ],
                if (error != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(error!, style: const TextStyle(color: Color(0xFFB42318)))),
                const SizedBox(height: 24),
                const Text('Histórico', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                for (final move in movements)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text('${movementLabel[move['movement_type']] ?? move['movement_type']} · ${move['signed_delta']}'),
                    subtitle: Text('${formatWhen(move['created_at'])} · saldo ${move['balance_after']}\n${move['reason'] ?? ''}'),
                    isThreeLine: true,
                  ),
              ],
            ),
    );
  }
}
