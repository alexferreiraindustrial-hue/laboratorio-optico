// PDV da produção: tela cheia para bipar, com avisos e radar de prazos.
// O leitor Bluetooth/USB funciona como teclado no campo de bipe; a câmera lê código de barras e QR.
// Cada bipe usa uma ação que o app já tinha (mesmas regras do banco).
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../design/la_design.dart';
import '../domain.dart';
import '../lab_api.dart';
import '../pdv_logic.dart';
import '../session.dart';

const _lcd = Color(0xFF0E2724);
const _lcdInk = Color(0xFFA6F4CF);
const _lcdDim = Color(0xFF5F9C83);
const _errBg = Color(0xFF3A1412);
const _errInk = Color(0xFFFFC2B8);
const _late = Color(0xFFC8372D);
const _risk = Color(0xFFD4760B);

const _icons = {
  ScanAction.lente: Icons.inventory_2_outlined,
  ScanAction.pronto: Icons.check_circle_outline,
  ScanAction.medico: Icons.medical_services_outlined,
  ScanAction.voltou: Icons.undo,
  ScanAction.entregue: Icons.local_shipping_outlined,
};

class _Scan {
  _Scan({required this.ok, required this.title, required this.detail, required this.action, this.client, this.id})
    : at = DateTime.now();
  final bool ok;
  final String title, detail;
  final String? client, id;
  final ScanAction action;
  final DateTime at;
}

class PdvScreen extends StatefulWidget {
  const PdvScreen({super.key, required this.session});
  final Session session;
  @override
  State<PdvScreen> createState() => _PdvScreenState();
}

class _PdvScreenState extends State<PdvScreen> {
  final api = LabApi();
  final input = TextEditingController();
  final focus = FocusNode();
  late final List<ScanAction> actions;
  ScanAction? action;
  final log = <_Scan>[];
  _Scan? last;
  bool busy = false;
  List<Map<String, dynamic>>? orders;
  int unread = 0;
  DateTime now = DateTime.now();
  Timer? timer;
  String? lastCode;
  // Mesmo código lido de novo: ignorado por 2 s; depois de um registro certo, por 15 s.
  DateTime? lastUntil;

  String get role => widget.session.profile?.role ?? 'consulta';

  @override
  void initState() {
    super.initState();
    actions = allowedScanActions(role);
    action = actions.isEmpty ? null : actions.first;
    loadRadar();
    timer = Timer.periodic(const Duration(minutes: 1), (_) => loadRadar());
  }

  @override
  void dispose() {
    timer?.cancel();
    input.dispose();
    focus.dispose();
    super.dispose();
  }

  Future<void> loadRadar() async {
    try {
      final result = await Future.wait([api.pdvOrders(), api.unreadMessageCount()]);
      if (!mounted) return;
      setState(() {
        orders = result[0] as List<Map<String, dynamic>>;
        unread = result[1] as int;
        now = DateTime.now();
      });
    } catch (_) {
      // O radar é só leitura; se falhar, o bipe continua funcionando.
    }
  }

  String _message(Object e) => e is StateError ? e.message : friendlyError(e);

  Future<void> _run(ScanAction chosen, Map<String, dynamic> order) async {
    final id = '${order['id']}';
    switch (chosen) {
      case ScanAction.lente:
        // Lente chegou: vai direto para "Em montagem" (a VTA continua esperando a armação).
        final row = await api.receiveLenses(id);
        if ('${row['status']}' == 'aguardando_montagem') {
          await api.changeStatus(id, 'em_montagem', 'Lentes recebidas: montagem iniciada');
        }
      case ScanAction.pronto:
        await api.changeStatus(id, 'pronto', 'Bipe: ficou pronto');
      case ScanAction.medico:
        await api.changeStatus(id, 'em_conferencia', 'Bipe: foi para o médico');
      case ScanAction.voltou:
        await api.approveMedical(id, 'Bipe: voltou do médico, conferido e liberado', '${order['updated_at']}');
      case ScanAction.entregue:
        await api.confirmClientDelivery(id, '', DateTime.now());
    }
  }

  Future<void> submit(String raw) async {
    final text = raw.trim();
    input.clear();
    final chosen = action;
    if (text.isEmpty || chosen == null || busy) return;
    final stamp = DateTime.now();
    if (lastCode == text && lastUntil != null && stamp.isBefore(lastUntil!)) return;
    lastCode = text;
    lastUntil = stamp.add(const Duration(seconds: 2));
    final target = parseScanCode(text);
    if (target == null) {
      _push(_Scan(ok: false, title: text, detail: 'Código não reconhecido.', action: chosen));
      return;
    }
    setState(() => busy = true);
    try {
      final order = await api.scanOrder(id: target.id, ref: target.ref);
      final number = visibleNumber(order);
      final client = '${order['client_name'] ?? ''}';
      if (scanAlreadyDone(chosen, order)) {
        lastUntil = DateTime.now().add(const Duration(seconds: 15));
        _push(_Scan(ok: true, title: number, client: client, id: '${order['id']}', detail: 'Já estava registrada. Nada mudou.', action: chosen));
        return;
      }
      final block = scanBlockReason(chosen, order);
      if (block != null) {
        _push(_Scan(ok: false, title: number, client: client, id: '${order['id']}', detail: 'Não registrado. $block', action: chosen));
        return;
      }
      await _run(chosen, order);
      lastUntil = DateTime.now().add(const Duration(seconds: 15));
      _push(_Scan(ok: true, title: number, client: client, id: '${order['id']}', detail: scanDone[chosen]!, action: chosen));
      unawaited(loadRadar());
    } catch (e) {
      _push(_Scan(ok: false, title: text, detail: _message(e), action: chosen));
    } finally {
      if (mounted) {
        setState(() => busy = false);
        focus.requestFocus();
      }
    }
  }

  void _push(_Scan scan) {
    if (scan.ok) {
      HapticFeedback.mediumImpact();
      SystemSound.play(SystemSoundType.click);
    } else {
      HapticFeedback.heavyImpact();
      HapticFeedback.vibrate();
    }
    if (!mounted) return;
    setState(() {
      last = scan;
      log.insert(0, scan);
      if (log.length > 80) log.removeLast();
    });
  }

  Future<void> openCamera() async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: _lcd,
      shape: RoundedRectangleBorder(borderRadius: LaRadius.rFolhaTopo),
      builder: (context) => _CameraSheet(
        actionLabel: scanLabel[action] ?? '',
        onCode: (code) => submit(code),
        lastOf: () => last,
      ),
    );
    if (mounted) focus.requestFocus();
  }

  Future<void> openOrder(String id) async {
    await context.push('/os/$id');
    if (mounted) await loadRadar();
  }

  @override
  Widget build(BuildContext context) {
    final wide = MediaQuery.sizeOf(context).width >= 900;
    final rows = orders;
    final alerts = rows == null ? <PdvAlert>[] : pdvAlerts(rows, now, unreadMessages: unread);
    final lanes = rows == null ? null : radarGroups(rows, now);
    final main = <Widget>[
      _AlertBar(alerts: alerts, loaded: rows != null, onTap: (route) => context.push(route)),
      const SizedBox(height: 12),
      if (action == null)
        const _Note('Seu perfil não movimenta OS pelo bipe.')
      else ...[
        _Display(action: action!, last: last, busy: busy),
        const SizedBox(height: 10),
        _ScanField(controller: input, focus: focus, busy: busy, onSubmit: submit, onCamera: openCamera),
        const SizedBox(height: 12),
        _ActionKeys(actions: actions, selected: action!, onSelect: (a) {
          setState(() => action = a);
          focus.requestFocus();
        }),
      ],
      const SizedBox(height: 16),
      _Radar(lanes: lanes, now: now, onOpen: openOrder),
      if (!wide) ...[const SizedBox(height: 16), _Receipt(log: log, onOpen: openOrder, onClear: () => setState(() { log.clear(); last = null; }))],
    ];
    return Scaffold(
      backgroundColor: LaColors.adapt(context, LaColors.piso),
      appBar: AppBar(
        backgroundColor: _lcd,
        foregroundColor: Colors.white,
        titleTextStyle: LaType.corpoForte.copyWith(color: Colors.white),
        title: const Text('PDV da produção'),
        actions: [
          IconButton(tooltip: 'Atualizar avisos', onPressed: loadRadar, icon: const Icon(Icons.refresh)),
        ],
      ),
      body: SafeArea(
        top: false,
        child: wide
            ? Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: ListView(padding: const EdgeInsets.all(16), children: main)),
                  SizedBox(
                    width: 340,
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(0, 16, 16, 16),
                      child: SingleChildScrollView(child: _Receipt(log: log, onOpen: openOrder, onClear: () => setState(() { log.clear(); last = null; }))),
                    ),
                  ),
                ],
              )
            : ListView(padding: const EdgeInsets.all(16), children: main),
      ),
    );
  }
}

class _Note extends StatelessWidget {
  const _Note(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Padding(padding: const EdgeInsets.all(12), child: Text(text, style: LaType.corpo));
}

/// Letreiro de avisos, como o painel de um caixa.
class _AlertBar extends StatelessWidget {
  const _AlertBar({required this.alerts, required this.loaded, required this.onTap});
  final List<PdvAlert> alerts;
  final bool loaded;
  final void Function(String route) onTap;
  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(color: const Color(0xFF10201D), borderRadius: BorderRadius.circular(14)),
      clipBehavior: Clip.antiAlias,
      child: Row(
        children: [
          Container(
            color: const Color(0xFFF2B705),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
            child: const Row(children: [Icon(Icons.notifications_active_outlined, size: 18, color: Color(0xFF1D1600)), SizedBox(width: 6), Text('Avisos', style: TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF1D1600)))]),
          ),
          Expanded(
            child: !loaded
                ? const Padding(padding: EdgeInsets.all(12), child: Text('Carregando avisos…', style: TextStyle(color: _lcdInk)))
                : alerts.isEmpty
                ? const Padding(padding: EdgeInsets.all(12), child: Text('Sem avisos agora.', style: TextStyle(color: _lcdInk)))
                : SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    child: Row(
                      children: [
                        for (final alert in alerts)
                          InkWell(
                            onTap: () => onTap(alert.route),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 12),
                              child: Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: switch (alert.tone) { 'late' => _late, 'risk' => _risk, _ => _lcdInk },
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Text('${alert.count}', style: TextStyle(fontWeight: FontWeight.w800, color: alert.tone == 'info' ? _lcd : Colors.white)),
                                  ),
                                  const SizedBox(width: 6),
                                  Text(alert.text, style: const TextStyle(color: Color(0xFFE8F3EE), fontWeight: FontWeight.w600)),
                                ],
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}

/// Visor: mostra a última OS bipada.
class _Display extends StatelessWidget {
  const _Display({required this.action, required this.last, required this.busy});
  final ScanAction action;
  final _Scan? last;
  final bool busy;
  @override
  Widget build(BuildContext context) {
    final err = last != null && !last!.ok;
    final ink = err ? _errInk : _lcdInk;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 250),
      padding: const EdgeInsets.fromLTRB(18, 14, 18, 16),
      decoration: BoxDecoration(color: err ? _errBg : _lcd, borderRadius: BorderRadius.circular(18)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [Icon(_icons[action], size: 18, color: _lcdDim), const SizedBox(width: 6), Flexible(child: Text(scanLabel[action]!, overflow: TextOverflow.ellipsis, style: const TextStyle(color: _lcdDim, fontWeight: FontWeight.w600)))]),
          const SizedBox(height: 6),
          if (busy)
            Text('Consultando…', style: TextStyle(color: ink, fontSize: 28, fontWeight: FontWeight.w800, fontFamily: 'monospace'))
          else if (last == null)
            const Text('Aguardando bipe', style: TextStyle(color: _lcdDim, fontSize: 28, fontWeight: FontWeight.w800, fontFamily: 'monospace'))
          else ...[
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(last!.title, style: TextStyle(color: ink, fontSize: 40, fontWeight: FontWeight.w800, fontFamily: 'monospace')),
            ),
            if ((last!.client ?? '').isNotEmpty) Text(last!.client!, style: TextStyle(color: ink, fontSize: 17, fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(last!.ok ? Icons.check : Icons.close, size: 18, color: ink),
                const SizedBox(width: 6),
                Expanded(child: Text(last!.detail, style: TextStyle(color: ink, fontSize: 15))),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

/// Campo do bipe: o leitor Bluetooth/USB "digita" o número e dá Enter.
class _ScanField extends StatelessWidget {
  const _ScanField({required this.controller, required this.focus, required this.busy, required this.onSubmit, required this.onCamera});
  final TextEditingController controller;
  final FocusNode focus;
  final bool busy;
  final void Function(String) onSubmit;
  final VoidCallback onCamera;
  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: TextField(
            controller: controller,
            focusNode: focus,
            autofocus: true,
            enabled: !busy,
            textInputAction: TextInputAction.done,
            textCapitalization: TextCapitalization.characters,
            autocorrect: false,
            enableSuggestions: false,
            decoration: const InputDecoration(
              prefixIcon: Icon(Icons.qr_code_scanner),
              hintText: 'Bipe a etiqueta ou digite o nº da OS',
            ),
            onSubmitted: onSubmit,
          ),
        ),
        const SizedBox(width: 8),
        SizedBox(
          height: LaSize.toque + 4,
          child: FilledButton.icon(
            onPressed: busy ? null : onCamera,
            icon: const Icon(Icons.photo_camera_outlined),
            label: const Text('Câmera'),
          ),
        ),
      ],
    );
  }
}

class _ActionKeys extends StatelessWidget {
  const _ActionKeys({required this.actions, required this.selected, required this.onSelect});
  final List<ScanAction> actions;
  final ScanAction selected;
  final void Function(ScanAction) onSelect;
  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, box) {
        final columns = box.maxWidth >= 1000 ? 5 : box.maxWidth >= 560 ? 3 : 2;
        final tile = (box.maxWidth - 8 * (columns - 1)) / columns;
        return Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final key in actions)
              SizedBox(
                width: tile,
                child: Semantics(
                  selected: key == selected,
                  button: true,
                  child: Material(
                    color: key == selected ? Theme.of(context).colorScheme.primary : LaColors.surface(context),
                    borderRadius: BorderRadius.circular(14),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(14),
                      onTap: () => onSelect(key),
                      child: Container(
                        constraints: const BoxConstraints(minHeight: 84),
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: key == selected ? Colors.transparent : LaColors.adapt(context, LaColors.borda)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(_icons[key], color: key == selected ? Theme.of(context).colorScheme.onPrimary : LaColors.adapt(context, LaColors.regua)),
                            const SizedBox(height: 4),
                            Text(scanLabel[key]!, style: LaType.rotulo.copyWith(color: key == selected ? Theme.of(context).colorScheme.onPrimary : null)),
                            Text(scanHint[key]!, style: LaType.apoio.copyWith(color: key == selected ? Theme.of(context).colorScheme.onPrimary.withValues(alpha: .8) : null)),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}

class _Radar extends StatelessWidget {
  const _Radar({required this.lanes, required this.now, required this.onOpen});
  final Map<RadarLane, List<Map<String, dynamic>>>? lanes;
  final DateTime now;
  final void Function(String id) onOpen;
  @override
  Widget build(BuildContext context) {
    if (lanes == null) return const _Note('Carregando o radar de prazos…');
    Widget lane(RadarLane key, String title, Color tone) {
      final list = lanes![key]!;
      return Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: LaColors.surface(context),
          borderRadius: BorderRadius.circular(14),
          border: Border(top: BorderSide(color: tone, width: 4)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Expanded(child: Text(title, style: LaType.corpoForte)),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 2),
                decoration: BoxDecoration(color: tone, borderRadius: BorderRadius.circular(99)),
                child: Text('${list.length}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
              ),
            ]),
            if (list.isEmpty) Padding(padding: const EdgeInsets.only(top: 6), child: Text('Nenhuma.', style: LaType.apoio)),
            for (final row in list.take(8))
              ListTile(
                contentPadding: EdgeInsets.zero,
                dense: true,
                title: Text('${visibleNumber(row)} · ${row['client_name'] ?? ''}', maxLines: 1, overflow: TextOverflow.ellipsis),
                subtitle: Text(statusLabel['${row['status']}'] ?? '${row['status']}'),
                trailing: Text(deadlineText(row['due_at'] as String?, now), style: TextStyle(color: tone, fontWeight: FontWeight.w700)),
                onTap: () => onOpen('${row['id']}'),
              ),
            if (list.length > 8) Text('Mais ${list.length - 8} na lista de OS.', style: LaType.apoio),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Radar de prazos', style: LaType.tituloSecao),
        const SizedBox(height: 8),
        lane(RadarLane.atrasada, 'Atrasadas', _late),
        lane(RadarLane.vence24h, 'Vencem nas próximas 24 h', _risk),
      ],
    );
  }
}

/// Cupom do turno: cada bipe, com hora e resultado.
class _Receipt extends StatelessWidget {
  const _Receipt({required this.log, required this.onOpen, required this.onClear});
  final List<_Scan> log;
  final void Function(String id) onOpen;
  final VoidCallback onClear;
  @override
  Widget build(BuildContext context) {
    const mono = TextStyle(fontFamily: 'monospace', color: Color(0xFF1F2A28), fontSize: 13);
    final ok = log.where((item) => item.ok).length;
    String hh(DateTime t) => '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(6), boxShadow: const [BoxShadow(color: Color(0x33000000), blurRadius: 18, offset: Offset(0, 8))]),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Lab Gold · cupom do turno', textAlign: TextAlign.center, style: mono.copyWith(fontWeight: FontWeight.w700)),
          const Divider(height: 20),
          if (log.isEmpty) Text('Nenhum bipe ainda.', style: mono.copyWith(color: const Color(0xFF6B7671))),
          for (final item in log)
            InkWell(
              onTap: item.id == null ? null : () => onOpen(item.id!),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 5),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Text(hh(item.at), style: mono.copyWith(color: const Color(0xFF6B7671))),
                      const SizedBox(width: 8),
                      Expanded(child: Text(item.title, style: mono.copyWith(fontWeight: FontWeight.w700), maxLines: 1, overflow: TextOverflow.ellipsis)),
                      Text(item.ok ? 'OK' : 'RECUSADO', style: mono.copyWith(fontWeight: FontWeight.w800, color: item.ok ? const Color(0xFF1D7A4F) : const Color(0xFFB3261E))),
                    ]),
                    Text('${scanLabel[item.action]}${(item.client ?? '').isEmpty ? '' : ' · ${item.client}'}', style: mono.copyWith(color: const Color(0xFF4A5551)), maxLines: 1, overflow: TextOverflow.ellipsis),
                    if (!item.ok) Text(item.detail, style: mono.copyWith(color: const Color(0xFFB3261E))),
                  ],
                ),
              ),
            ),
          const Divider(height: 20),
          Row(children: [Expanded(child: Text('Registradas', style: mono.copyWith(fontWeight: FontWeight.w700, fontSize: 15))), Text('$ok', style: mono.copyWith(fontWeight: FontWeight.w700, fontSize: 15))]),
          Row(children: [Expanded(child: Text('Recusadas', style: mono)), Text('${log.length - ok}', style: mono)]),
          if (log.isNotEmpty) ...[
            const SizedBox(height: 10),
            OutlinedButton(onPressed: onClear, child: const Text('Novo cupom')),
          ],
        ],
      ),
    );
  }
}

/// Leitura pela câmera, contínua: cada código lido é registrado e a câmera continua aberta.
class _CameraSheet extends StatefulWidget {
  const _CameraSheet({required this.actionLabel, required this.onCode, required this.lastOf});
  final String actionLabel;
  final Future<void> Function(String code) onCode;
  final _Scan? Function() lastOf;
  @override
  State<_CameraSheet> createState() => _CameraSheetState();
}

class _CameraSheetState extends State<_CameraSheet> {
  final controller = MobileScannerController(
    formats: const [BarcodeFormat.code128, BarcodeFormat.qrCode],
    detectionSpeed: DetectionSpeed.noDuplicates,
  );
  bool working = false;
  _Scan? shown;

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  Future<void> detected(BarcodeCapture capture) async {
    final value = capture.barcodes.map((b) => b.rawValue).whereType<String>().firstOrNull;
    if (value == null || working) return;
    setState(() => working = true);
    await widget.onCode(value);
    if (!mounted) return;
    setState(() {
      working = false;
      shown = widget.lastOf();
    });
  }

  @override
  Widget build(BuildContext context) {
    final height = MediaQuery.sizeOf(context).height * .72;
    return SafeArea(
      child: SizedBox(
        height: height,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 8, 8),
              child: Row(children: [
                Expanded(child: Text('Câmera · ${widget.actionLabel}', style: const TextStyle(color: _lcdInk, fontSize: 17, fontWeight: FontWeight.w700))),
                IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close, color: Colors.white), tooltip: 'Fechar câmera'),
              ]),
            ),
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: MobileScanner(controller: controller, onDetect: detected),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(14),
              child: Text(
                working
                    ? 'Registrando…'
                    : shown == null
                    ? 'Aponte para o código de barras ou o QR da etiqueta.'
                    : '${shown!.ok ? '✓' : '✗'} ${shown!.title} — ${shown!.detail}',
                style: TextStyle(color: shown != null && !shown!.ok ? _errInk : _lcdInk, fontSize: 15),
                textAlign: TextAlign.center,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
