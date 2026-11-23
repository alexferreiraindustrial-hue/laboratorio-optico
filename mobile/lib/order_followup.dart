import 'dart:async';

import 'package:flutter/material.dart';

import 'lab_api.dart';
import 'domain.dart';

class OrderFollowup extends StatefulWidget {
  const OrderFollowup({
    super.key,
    required this.order,
    required this.editable,
    required this.onChanged,
  });
  final Map<String, dynamic> order;
  final bool editable;
  final Future<void> Function() onChanged;
  @override
  State<OrderFollowup> createState() => _OrderFollowupState();
}

class _OrderFollowupState extends State<OrderFollowup> {
  bool busy = false;
  String? error;
  Timer? timer;
  final note = TextEditingController();
  @override
  void initState() {
    super.initState();
    timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted &&
          widget.order['express_started_at'] != null &&
          widget.order['express_finished_at'] == null)
        setState(() {});
    });
  }

  @override
  void dispose() {
    timer?.cancel();
    note.dispose();
    super.dispose();
  }

  Future<void> run(Future<void> Function() action) async {
    if (busy) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await action();
      await widget.onChanged();
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final o = widget.order;
    final required = o['medical_review_required'] == true;
    final closed = ['pronto', 'entregue', 'cancelado'].contains(o['status']);
    final api = LabApi();
    final minutes = o['express_minutes'] as int?;
    final started = DateTime.tryParse('${o['express_started_at'] ?? ''}');
    final finished = DateTime.tryParse('${o['express_finished_at'] ?? ''}');
    final seconds = started == null || minutes == null
        ? null
        : minutes * 60 -
              (finished ?? DateTime.now()).difference(started).inSeconds;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (o['assistance_kind'] != null)
              Text(
                'Assistência · ${o['assistance_kind']}',
                style: Theme.of(context).textTheme.titleSmall,
              ),
            if (minutes != null)
              Text(
                seconds == null
                    ? 'Expressa $minutes min · aguardando início'
                    : finished != null
                    ? 'Montagem expressa concluída'
                    : seconds < 0
                    ? 'Expressa · ${-seconds ~/ 60} min de atraso'
                    : 'Expressa · ${seconds ~/ 60}:${(seconds % 60).toString().padLeft(2, '0')} restantes',
                style: Theme.of(context).textTheme.titleSmall,
              ),
            if (o['frame_state'] == 'vta') ...[
              const Text('VTA · aguardando armação do cliente'),
              if (o['lens_arrived_at'] != null)
                const Text('Lente recebida. A montagem aguarda a armação.'),
              if (widget.editable && !closed)
                OutlinedButton.icon(
                  onPressed: busy
                      ? null
                      : () => run(() => api.receiveFrame(o['id'] as String)),
                  icon: const Icon(Icons.check),
                  label: const Text('Armação chegou · confirmar'),
                ),
            ],
            const Text(
              'Conferência Médico',
              style: TextStyle(fontWeight: FontWeight.w700),
            ),
            if (widget.editable && !closed)
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Precisa passar pelo médico'),
                value: required,
                onChanged: busy
                    ? null
                    : (value) => run(
                        () => api.medicalReview(
                          o['id'] as String,
                          value,
                          o['updated_at'] as String,
                        ),
                      ),
              )
            else
              Text(
                required
                    ? 'Conferência médica indicada'
                    : 'Sem indicação médica',
              ),
            if (o['medical_review_note'] != null)
              Text('${o['medical_review_note']}'),
            if (required && o['medical_review_approved_at'] == null)
              const Text(
                'Não avisar como pronto nem entregar antes do retorno médico.',
              ),
            if (widget.editable &&
                required &&
                o['status'] == 'em_conferencia' &&
                o['medical_review_approved_at'] == null) ...[
              TextField(
                controller: note,
                maxLength: 1000,
                maxLines: 2,
                decoration: const InputDecoration(
                  labelText: 'Quem conferiu e qual foi o retorno?',
                ),
              ),
              FilledButton(
                onPressed: busy
                    ? null
                    : () {
                        if (note.text.trim().length < 3) {
                          setState(
                            () => error =
                                'Informe o médico e o resultado recebido.',
                          );
                          return;
                        }
                        run(
                          () => api.approveMedical(
                            o['id'] as String,
                            note.text.trim(),
                            o['updated_at'] as String,
                          ),
                        );
                      },
                child: const Text('Confirmar retorno médico e liberar'),
              ),
            ],
            if (error != null)
              Text(
                error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
          ],
        ),
      ),
    );
  }
}
