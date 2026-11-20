import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../domain.dart';
import '../lab_api.dart';

class StockCreateScreen extends StatefulWidget {
  const StockCreateScreen({super.key, this.sphere, this.cylinder});
  final String? sphere;
  final String? cylinder;

  @override
  State<StockCreateScreen> createState() => _StockCreateScreenState();
}

class _StockCreateScreenState extends State<StockCreateScreen> {
  final api = LabApi();
  late final sphere = TextEditingController(text: widget.sphere ?? '');
  late final cylinder = TextEditingController(text: widget.cylinder ?? '');
  final addition = TextEditingController();
  final manufacturer = TextEditingController();
  final brand = TextEditingController();
  final location = TextEditingController();
  final initial = TextEditingController(text: '1');
  bool special = false;
  bool pending = false;
  String? error;

  @override
  void dispose() {
    sphere.dispose();
    cylinder.dispose();
    addition.dispose();
    manufacturer.dispose();
    brand.dispose();
    location.dispose();
    initial.dispose();
    super.dispose();
  }

  Future<void> save() async {
    final sph = parseDiopterToCents(sphere.text);
    final cyl = parseDiopterToCents(cylinder.text);
    if (sph == null || cyl == null) {
      setState(() => error = 'Informe esférico e cilíndrico (ex.: -1,25).');
      return;
    }
    setState(() => pending = true);
    try {
      final item = await api.createStock(
        sphereCents: sph,
        cylinderCents: cyl,
        additionCents: parseDiopterToCents(addition.text),
        manufacturer: manufacturer.text.trim().isEmpty ? null : manufacturer.text.trim(),
        brand: brand.text.trim().isEmpty ? null : brand.text.trim(),
        location: location.text.trim().isEmpty ? null : location.text.trim(),
        isSpecial: special,
        initialQty: int.tryParse(initial.text.trim()) ?? 0,
      );
      if (mounted) context.push('/estoque/${item['id']}');
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    } finally {
      if (mounted) setState(() => pending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Cadastrar lente')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (widget.sphere != null || widget.cylinder != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(
                'Grau da grade: ${widget.sphere ?? '—'} / ${widget.cylinder ?? '—'}',
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
          TextField(controller: sphere, decoration: const InputDecoration(labelText: 'Esférico'), keyboardType: TextInputType.text),
          const SizedBox(height: 8),
          TextField(controller: cylinder, decoration: const InputDecoration(labelText: 'Cilíndrico')),
          const SizedBox(height: 8),
          TextField(controller: addition, decoration: const InputDecoration(labelText: 'Adição (opcional)')),
          const SizedBox(height: 8),
          TextField(controller: manufacturer, decoration: const InputDecoration(labelText: 'Fabricante')),
          const SizedBox(height: 8),
          TextField(controller: brand, decoration: const InputDecoration(labelText: 'Marca ou modelo')),
          const SizedBox(height: 8),
          TextField(controller: location, decoration: const InputDecoration(labelText: 'Localização')),
          const SizedBox(height: 8),
          TextField(controller: initial, decoration: const InputDecoration(labelText: 'Entrada inicial'), keyboardType: TextInputType.number),
          SwitchListTile(title: const Text('Grau especial'), value: special, onChanged: (value) => setState(() => special = value)),
          FilledButton(onPressed: pending ? null : save, child: Text(pending ? 'Salvando...' : 'Cadastrar no estoque')),
          if (error != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(error!, style: const TextStyle(color: Color(0xFFB83A3A)))),
        ],
      ),
    );
  }
}
