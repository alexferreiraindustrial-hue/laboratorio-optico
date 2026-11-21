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
    _timer = Timer.periodic(Duration(seconds: 20), (_) {
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
        color: LaColors.adapt(context, LaColors.grafite),
        backgroundColor: LaColors.surface(context),
        onRefresh: load,
        child: ListView(
          padding: EdgeInsets.fromLTRB(
            LaSpace.tela,
            LaSpace.l,
            LaSpace.tela,
            LaSpace.xxl,
          ),
          children: [
            Row(
              children: [
                LaMonogram(size: 44),
                SizedBox(width: LaSpace.l),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Lab Gold',
                        style: LaType.corpoForte.copyWith(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      Text(
                        dataPorExtenso(DateTime.now()),
                        style: LaType.rotulo.copyWith(
                          fontWeight: FontWeight.w500,
                          color: LaColors.adapt(context, LaColors.regua),
                        ),
                      ),
                    ],
                  ),
                ),
                NoticeBell(),
              ],
            ),
            SizedBox(height: LaSpace.secao),
            LaCommandPlate(
              onLancarOs: () => context.go('/lancar'),
              onOsCompleta: () => context.push('/os/nova'),
              onRotina: () => context.push('/rotina'),
              onConfigurarRotina: () => context.push(
                canSettingsWrite(role) ? '/configuracoes' : '/mais',
              ),
            ),
            SizedBox(height: LaSpace.secao),
            if (error != null)
              LaErrorBanner(
                titulo: 'Painel indisponível',
                mensagem: error!,
                onTentarDeNovo: load,
              ),
            if (loading)
              Padding(
                padding: EdgeInsets.all(40),
                child: Center(
                  child: CircularProgressIndicator(color: LaColors.adapt(context, LaColors.grafite)),
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
            SizedBox(height: LaSpace.secao),
            _StockNotice(
              alert: alert,
              lowStock: lowStock,
              onTap: () => context.push('/estoque'),
            ),
            SizedBox(height: LaSpace.item),
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
      color: LaColors.surface(context),
      shape: RoundedRectangleBorder(
        borderRadius: LaRadius.rCartao,
        side: BorderSide(
          color: alert ? LaColors.adapt(context, LaColors.alertaBorda) : LaColors.adapt(context, LaColors.linha),
          width: alert ? 1.5 : 1,
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: SizedBox(
          height: LaSize.toque + 8,
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: LaSpace.interno),
            child: Row(
              children: [
                Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    color: alert
                        ? LaColors.adapt(context, LaColors.pontoProximo)
                        : LaColors.adapt(context, LaColors.pontoNoPrazo),
                    shape: BoxShape.circle,
                  ),
                ),
                SizedBox(width: LaSpace.m),
                Expanded(
                  child: Text(
                    alert ? '$lowStock lentes no mínimo' : 'Estoque em dia',
                    style: LaType.corpoForte,
                  ),
                ),
                Icon(Icons.north_east, color: LaColors.adapt(context, LaColors.grafite), size: 20),
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
      color: LaColors.surface(context),
      borderRadius: LaRadius.rCartao,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: EdgeInsets.fromLTRB(10, 10, 16, 10),
          child: Row(
            children: [
              CircleAvatar(
                radius: 22,
                backgroundColor: Color(0xFF222222),
                child: Text(
                  iniciaisDe(name),
                  style: LaType.rotulo.copyWith(color: LaColors.branco),
                ),
              ),
              SizedBox(width: LaSpace.l),
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
