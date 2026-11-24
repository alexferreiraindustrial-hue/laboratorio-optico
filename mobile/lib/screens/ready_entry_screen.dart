import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../domain.dart';
import '../lab_api.dart';

class ReadyEntryScreen extends StatefulWidget {
  const ReadyEntryScreen({super.key});
  @override
  State<ReadyEntryScreen> createState() => _ReadyEntryScreenState();
}

class _ReadyEntryScreenState extends State<ReadyEntryScreen> {
  final ref = TextEditingController(), name = TextEditingController();
  final api = LabApi();
  List<Map<String, dynamic>> sellers = [], labs = [], links = [];
  String? seller, lab;
  String? error;
  Map<String, dynamic>? saved;
  DateTime date = DateTime.now();
  bool busy = false, loading = true;
  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    ref.dispose();
    name.dispose();
    super.dispose();
  }

  Future<void> load() async {
    try {
      final result = await Future.wait([
        api.sellers(),
        api.catalogs(),
        api.sellerLinks(),
      ]);
      if (!mounted) return;
      setState(() {
        sellers = result[0];
        labs = result[1];
        links = result[2];
        lab =
            labs
                .where((r) => r['code'] == 'LAB_MONTAGEM_INTERNA')
                .map((r) => r['id'] as String)
                .firstOrNull ??
            labs
                .where((r) => r['code'] == 'LAB_A_DEFINIR')
                .map((r) => r['id'] as String)
                .firstOrNull;
        loading = false;
      });
    } catch (e) {
      if (mounted)
        setState(() {
          error = friendlyError(e);
          loading = false;
        });
    }
  }

  Future<void> pick() async {
    final now = DateTime.now();
    final day = await showDatePicker(
      context: context,
      initialDate: date,
      firstDate: DateTime(2000),
      lastDate: now,
    );
    if (day == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(date),
    );
    if (time != null && mounted)
      setState(
        () => date = DateTime(
          day.year,
          day.month,
          day.day,
          time.hour,
          time.minute,
        ),
      );
  }

  Future<void> save() async {
    if (busy) return;
    if (seller == null ||
        lab == null ||
        (ref.text.trim().isEmpty && name.text.trim().length < 2)) {
      setState(
        () => error = 'Informe a vendedora, laboratório e OS ou cliente.',
      );
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final stores = links
          .where((r) => r['seller_id'] == seller)
          .map((r) => r['store_id'] as String)
          .toList();
      final row = await api.createReady(
        sellerId: seller!,
        storeId: stores.length == 1 ? stores.single : null,
        laboratoryId: lab!,
        clientName: name.text,
        orderRef: ref.text,
        completed: date,
      );
      if (mounted) setState(() => saved = row);
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Registrar serviço já pronto')),
    body: ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text(
          'Para registrar a passagem pelo laboratório sem repetir etapas ou inventar atividades realizadas.',
        ),
        const SizedBox(height: 16),
        if (loading)
          const Center(child: CircularProgressIndicator())
        else if (saved != null) ...[
          Text('OS ${saved!['number']} registrada como pronta.'),
          FilledButton(
            onPressed: () => context.push('/os/${saved!['id']}'),
            child: const Text('Abrir registro · decidir médico ou entrega'),
          ),
          TextButton(
            onPressed: () => setState(() {
              saved = null;
              ref.clear();
              name.clear();
              date = DateTime.now();
            }),
            child: const Text('Registrar outro já pronto'),
          ),
        ] else ...[
          DropdownButtonFormField<String>(
            initialValue: seller,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Vendedora'),
            items: [
              for (final s in sellers)
                DropdownMenuItem(
                  value: s['id'] as String,
                  child: Text('${s['name']}'),
                ),
            ],
            onChanged: busy ? null : (v) => setState(() => seller = v),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: ref,
            maxLength: 80,
            decoration: const InputDecoration(
              labelText: 'Número da OS · se tiver',
            ),
          ),
          TextField(
            controller: name,
            maxLength: 200,
            decoration: const InputDecoration(
              labelText: 'Cliente · se não tiver OS',
            ),
          ),
          DropdownButtonFormField<String>(
            key: ValueKey(lab),
            initialValue: lab,
            isExpanded: true,
            decoration: const InputDecoration(
              labelText: 'Laboratório do registro',
            ),
            items: [
              for (final l in labs)
                DropdownMenuItem(
                  value: l['id'] as String,
                  child: Text('${l['name']}'),
                ),
            ],
            onChanged: busy ? null : (v) => setState(() => lab = v),
          ),
          TextButton.icon(
            onPressed: busy ? null : pick,
            icon: const Icon(Icons.event),
            label: Text('Já pronto em ${formatWhen(date.toIso8601String())}'),
          ),
          FilledButton(
            onPressed: busy ? null : save,
            child: Text(
              busy ? 'Registrando…' : 'Registrar pronto · sem marcar etapas',
            ),
          ),
        ],
        if (error != null)
          Text(
            error!,
            style: TextStyle(color: Theme.of(context).colorScheme.error),
          ),
      ],
    ),
  );
}
