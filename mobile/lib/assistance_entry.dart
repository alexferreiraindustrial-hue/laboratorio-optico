import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'lab_api.dart';
import 'domain.dart';

class AssistanceEntry extends StatefulWidget {
  const AssistanceEntry({super.key, required this.onChanged});
  final Future<void> Function() onChanged;
  @override
  State<AssistanceEntry> createState() => _AssistanceEntryState();
}

class _AssistanceEntryState extends State<AssistanceEntry> {
  final form = GlobalKey<FormState>();
  final original = TextEditingController();
  final description = TextEditingController();
  String kind = 'garantia';
  bool lenses = false, medical = false, busy = false;
  DateTime? due;
  String? error;
  Map<String, dynamic>? saved;
  @override
  void dispose() {
    original.dispose();
    description.dispose();
    super.dispose();
  }

  Future<void> pickDue() async {
    final now = DateTime.now();
    final date = await showDatePicker(
      context: context,
      initialDate: now.add(const Duration(days: 2)),
      firstDate: DateTime(now.year, now.month, now.day),
      lastDate: now.add(const Duration(days: 730)),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(now),
    );
    if (time != null && mounted)
      setState(
        () => due = DateTime(
          date.year,
          date.month,
          date.day,
          time.hour,
          time.minute,
        ),
      );
  }

  Future<void> save() async {
    if (busy || !form.currentState!.validate()) return;
    if (due == null || !due!.isAfter(DateTime.now())) {
      setState(() => error = 'Informe o novo prazo futuro.');
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final row = await LabApi().createAssistance(
        original: original.text.trim(),
        kind: kind,
        description: description.text.trim(),
        due: due!,
        lenses: lenses,
        medical: medical,
      );
      if (mounted) setState(() => saved = row);
      await widget.onChanged();
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Card(
    child: ExpansionTile(
      title: const Text('Registrar garantia ou assistência'),
      childrenPadding: const EdgeInsets.all(14),
      children: [
        if (saved != null) ...[
          Text(
            'Assistência ${saved!['number']} registrada. OS original preservada.',
          ),
          TextButton(
            onPressed: () => context.push('/os/${saved!['id']}'),
            child: const Text('Abrir processos e fotos'),
          ),
          TextButton(
            onPressed: () => setState(() {
              saved = null;
              original.clear();
              description.clear();
              due = null;
              medical = false;
              lenses = false;
            }),
            child: const Text('Registrar outra'),
          ),
        ] else
          Form(
            key: form,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Cria outro serviço e mantém a entrega e o histórico anteriores. Use o número exato da OS original.',
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: original,
                  enabled: !busy,
                  maxLength: 80,
                  decoration: const InputDecoration(labelText: 'OS original'),
                  validator: (value) => value == null || value.trim().isEmpty
                      ? 'Informe a OS original'
                      : null,
                ),
                DropdownButtonFormField<String>(
                  initialValue: kind,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Motivo'),
                  items: const [
                    DropdownMenuItem(
                      value: 'garantia',
                      child: Text('Garantia'),
                    ),
                    DropdownMenuItem(value: 'refacao', child: Text('Refação')),
                    DropdownMenuItem(
                      value: 'prescricao',
                      child: Text('Alteração de prescrição'),
                    ),
                    DropdownMenuItem(
                      value: 'outro',
                      child: Text('Outro motivo'),
                    ),
                  ],
                  onChanged: busy
                      ? null
                      : (value) => setState(() => kind = value ?? 'garantia'),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: description,
                  enabled: !busy,
                  maxLength: 500,
                  maxLines: 2,
                  decoration: const InputDecoration(
                    labelText: 'O que precisa ser feito?',
                  ),
                  validator: (value) => (value?.trim().length ?? 0) < 3
                      ? 'Descreva a assistência'
                      : null,
                ),
                OutlinedButton.icon(
                  onPressed: busy ? null : pickDue,
                  icon: const Icon(Icons.calendar_today),
                  label: Text(
                    due == null
                        ? 'Escolher novo prazo'
                        : formatWhen(due!.toIso8601String()),
                  ),
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Precisa pedir nova lente'),
                  subtitle: Text(
                    lenses ? 'Vai para Lentes' : 'Vai direto para a bancada',
                  ),
                  value: lenses,
                  onChanged: busy
                      ? null
                      : (value) => setState(() => lenses = value),
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Precisa passar pelo médico'),
                  value: medical,
                  onChanged: busy
                      ? null
                      : (value) => setState(() => medical = value),
                ),
                if (error != null)
                  Text(
                    error!,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                FilledButton(
                  onPressed: busy ? null : save,
                  child: Text(busy ? 'Registrando…' : 'Criar assistência'),
                ),
              ],
            ),
          ),
      ],
    ),
  );
}
