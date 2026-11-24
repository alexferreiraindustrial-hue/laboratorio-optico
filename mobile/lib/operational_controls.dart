import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import 'domain.dart';
import 'lab_api.dart';

class StageNoteControl extends StatefulWidget {
  const StageNoteControl({
    super.key,
    required this.id,
    required this.status,
    required this.onChanged,
    required this.photo,
  });
  final String id, status;
  final Future<void> Function() onChanged;
  final Future<void> Function(ImageSource, String?) photo;
  @override
  State<StageNoteControl> createState() => _StageNoteControlState();
}

class _StageNoteControlState extends State<StageNoteControl> {
  final text = TextEditingController();
  String? step;
  bool correction = false, busy = false;
  String? message, error;
  @override
  void dispose() {
    text.dispose();
    super.dispose();
  }

  Future<void> save() async {
    if (busy) return;
    if (text.text.trim().length < 3) {
      setState(() => error = 'Descreva o registro.');
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await LabApi().stageNote(widget.id, step, text.text.trim(), correction);
      if (mounted)
        setState(() {
          message = correction
              ? 'Problema registrado e enviado para correção.'
              : 'Registro salvo, sem mudar a posição do serviço.';
          text.clear();
          correction = false;
        });
      await widget.onChanged();
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Registrar o que aconteceu',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 6),
          const Text('Observações e fotos não interrompem a montagem.'),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: step,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Etapa · opcional'),
            items: [
              const DropdownMenuItem<String>(
                value: null,
                child: Text('Registro geral'),
              ),
              for (final e in stepLabel.entries)
                DropdownMenuItem(value: e.key, child: Text(e.value)),
            ],
            onChanged: busy ? null : (value) => setState(() => step = value),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: text,
            maxLines: 2,
            maxLength: 2000,
            decoration: const InputDecoration(labelText: 'O que aconteceu?'),
          ),
          if ([
            'em_montagem',
            'em_conferencia',
            'pronto',
          ].contains(widget.status))
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('O problema exige enviar para correção'),
              value: correction,
              onChanged: busy
                  ? null
                  : (value) => setState(() => correction = value ?? false),
            ),
          FilledButton(
            onPressed: busy ? null : save,
            child: Text(
              busy
                  ? 'Salvando…'
                  : correction
                  ? 'Registrar e enviar para correção'
                  : 'Salvar registro · manter posição',
            ),
          ),
          Wrap(
            spacing: 8,
            children: [
              TextButton.icon(
                onPressed: busy
                    ? null
                    : () => widget.photo(ImageSource.camera, step),
                icon: const Icon(Icons.photo_camera_outlined),
                label: const Text('Foto da etapa'),
              ),
              TextButton.icon(
                onPressed: busy
                    ? null
                    : () => widget.photo(ImageSource.gallery, step),
                icon: const Icon(Icons.photo_library_outlined),
                label: const Text('Galeria'),
              ),
            ],
          ),
          if (error != null)
            Text(
              error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          if (message != null) Text(message!),
        ],
      ),
    ),
  );
}

class ClientDeliveryControl extends StatefulWidget {
  const ClientDeliveryControl({
    super.key,
    required this.id,
    required this.delivery,
    required this.onChanged,
  });
  final String id;
  final Map<String, dynamic>? delivery;
  final Future<void> Function() onChanged;
  @override
  State<ClientDeliveryControl> createState() => _ClientDeliveryControlState();
}

class _ClientDeliveryControlState extends State<ClientDeliveryControl> {
  final phone = TextEditingController();
  DateTime date = DateTime.now();
  bool busy = false;
  String? error;
  @override
  void dispose() {
    phone.dispose();
    super.dispose();
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
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await LabApi().confirmClientDelivery(widget.id, phone.text, date);
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
      title: const Text('Entrega efetiva ao cliente'),
      childrenPadding: const EdgeInsets.all(14),
      children: [
        if (widget.delivery != null) ...[
          Text(
            'Confirmada em ${formatWhen(widget.delivery!['client_delivered_at'])}',
          ),
          Text(
            'Acompanhamento a partir de ${formatWhen(widget.delivery!['followup_due_at'])}',
          ),
          TextButton(
            onPressed: () => context.push('/pos-venda'),
            child: const Text('Abrir pós-venda'),
          ),
        ] else ...[
          const Text(
            'Use só quando o cliente recebeu os óculos. A saída para a loja não inicia os cinco dias.',
          ),
          const SizedBox(height: 12),
          TextField(
            controller: phone,
            keyboardType: TextInputType.phone,
            maxLength: 24,
            decoration: const InputDecoration(
              labelText: 'Telefone do cliente · opcional',
            ),
          ),
          OutlinedButton(
            onPressed: busy ? null : pick,
            child: Text('Entrega: ${formatWhen(date.toIso8601String())}'),
          ),
          FilledButton(
            onPressed: busy ? null : save,
            child: Text(busy ? 'Confirmando…' : 'Confirmar entrega ao cliente'),
          ),
          if (error != null)
            Text(
              error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
        ],
      ],
    ),
  );
}
