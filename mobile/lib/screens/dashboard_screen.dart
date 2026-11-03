import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../design/la_design.dart';
import '../notice_bell.dart';
import '../domain.dart';
import '../floor_format.dart';
import '../lab_api.dart';
import '../session.dart';
import 'bench_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key, required this.session});
  final Session session;

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final api = LabApi();
  Map<String, int> counts = {};
  int lowStock = 0;
  String? error;
  bool loading = true;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    load();
    _timer = Timer.periodic(const Duration(seconds: 20), (_) {
      if (mounted) load(silent: true);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> load({bool silent = false}) async {
    try {
      final next = await api.pipeline();
      final stock = await api.lowStockCount();
      if (!mounted) return;
      setState(() {
        counts = next;
        lowStock = stock;
        error = null;
        if (!silent) loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        error = friendlyError(e);
        if (!silent) loading = false;
      });
    }
  }

  String get _name => widget.session.profile?.fullName ?? 'Laboratório';

  void _open(String status) {
    if (status == 'aguardando_lentes') {
      context.go('/lentes');
      return;
    }
    if (benchStatuses.contains(status)) {
      BenchScreen.station.value = status;
      context.go('/bancada');
      return;
    }
    context.push('/fila/$status');
  }

  @override
  Widget build(BuildContext context) {
    final role = widget.session.profile?.role ?? '';
    final alert = lowStock > 0;
    return SafeArea(
      bottom: false,
      child: RefreshIndicator(
        color: LaColors.grafite,
        backgroundColor: LaColors.branco,
        onRefresh: load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            LaSpace.tela,
            LaSpace.l,
            LaSpace.tela,
            LaSpace.xxl,
          ),
          children: [
            Row(
              children: [
                const LaMonogram(size: 44),
                const SizedBox(width: LaSpace.l),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Laboratório ALEX',
                        style: LaType.corpoForte.copyWith(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      Text(
                        dataPorExtenso(DateTime.now()),
                        style: LaType.rotulo.copyWith(
                          fontWeight: FontWeight.w500,
                          color: LaColors.regua,
                        ),
                      ),
                    ],
                  ),
                ),
                const NoticeBell(),
              ],
            ),
            const SizedBox(height: LaSpace.secao),
            LaCommandPlate(
              onLancarOs: () => context.go('/lancar'),
              onOsCompleta: () => context.push('/os/nova'),
              onRotina: () => context.push('/rotina'),
              onConfigurarRotina: () => context.push(
                canSettingsWrite(role) ? '/configuracoes' : '/mais',
              ),
            ),
            const SizedBox(height: LaSpace.secao),
            if (error != null)
              LaErrorBanner(
                titulo: 'Painel indisponível',
                mensagem: error!,
                onTentarDeNovo: load,
              ),
            if (loading)
              const Padding(
                padding: EdgeInsets.all(40),
                child: Center(
                  child: CircularProgressIndicator(color: LaColors.grafite),
                ),
              )
            else
              LaFlowList(
                steps: [
                  for (final status in queueStatuses)
                    LaFlowStep(
                      rotulo: statusLabel[status] ?? status,
                      subtitulo: _subtitulo(status),
                      contagem: counts[status] ?? 0,
                      kind: _kind(status),
                      onTap: () => _open(status),
                    ),
                ],
              ),
            const SizedBox(height: LaSpace.secao),
            _StockNotice(
              alert: alert,
              lowStock: lowStock,
              onTap: () => context.push('/estoque'),
            ),
            const SizedBox(height: LaSpace.item),
            _ProfileChip(name: _name, onTap: () => context.go('/mais')),
          ],
        ),
      ),
    );
  }

  String _subtitulo(String status) {
    return switch (status) {
      'aguardando_lentes' || 'aguardando_montagem' => 'Fila',
      'em_montagem' => 'Na bancada',
      'em_correcao' => 'Retrabalho',
      'em_conferencia' => 'Inspeção',
      'pronto' => 'Saída',
      _ => '',
    };
  }

  LaFlowKind _kind(String status) {
    return switch (status) {
      'em_montagem' => LaFlowKind.bancada,
      'em_correcao' => LaFlowKind.retrabalho,
      'em_conferencia' => LaFlowKind.inspecao,
      'pronto' => LaFlowKind.saida,
      _ => LaFlowKind.fila,
    };
  }
}

class _StockNotice extends StatelessWidget {
  const _StockNotice({
    required this.alert,
    required this.lowStock,
    required this.onTap,
  });
  final bool alert;
  final int lowStock;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: LaColors.branco,
      shape: RoundedRectangleBorder(
        borderRadius: LaRadius.rCartao,
        side: BorderSide(
          color: alert ? LaColors.alertaBorda : LaColors.linha,
          width: alert ? 1.5 : 1,
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: SizedBox(
          height: LaSize.toque + 8,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: LaSpace.interno),
            child: Row(
              children: [
                Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    color: alert
                        ? LaColors.pontoProximo
                        : LaColors.pontoNoPrazo,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: LaSpace.m),
                Expanded(
                  child: Text(
                    alert ? '$lowStock lentes no mínimo' : 'Estoque em dia',
                    style: LaType.corpoForte,
                  ),
                ),
                const Icon(Icons.north_east, color: LaColors.grafite, size: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ProfileChip extends StatelessWidget {
  const _ProfileChip({required this.name, required this.onTap});
  final String name;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: LaColors.branco,
      borderRadius: LaRadius.rCartao,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(10, 10, 16, 10),
          child: Row(
            children: [
              CircleAvatar(
                radius: 22,
                backgroundColor: LaColors.grafite,
                child: Text(
                  iniciaisDe(name),
                  style: LaType.rotulo.copyWith(color: LaColors.branco),
                ),
              ),
              const SizedBox(width: LaSpace.l),
              Expanded(
                child: Text(
                  name,
                  style: LaType.corpoForte,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
