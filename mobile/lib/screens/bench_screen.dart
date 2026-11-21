import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../design/la_design.dart';
import '../domain.dart';
import '../lab_api.dart';
import '../session.dart';

class BenchScreen extends StatefulWidget {
  const BenchScreen({super.key, required this.session});
  final Session session;

  static final station = ValueNotifier<String>('aguardando_montagem');

  @override
  State<BenchScreen> createState() => _BenchScreenState();
}

class _BenchScreenState extends State<BenchScreen> {
  final api = LabApi();
  List<Map<String, dynamic>> orders = [];
  String? error;
  String? pendingId;

  static const _stations = [
    ('aguardando_montagem', 'Aguardando montagem'),
    ('em_montagem', 'Em montagem'),
    ('em_correcao', 'Em correção'),
    ('em_conferencia', 'Em conferência'),
  ];

  @override
  void initState() {
    super.initState();
    BenchScreen.station.addListener(_onStation);
    load();
  }

  @override
  void dispose() {
    BenchScreen.station.removeListener(_onStation);
    super.dispose();
  }

  void _onStation() {
    if (mounted) setState(() {});
  }

  Future<void> load() async {
    try {
      final next = await api.benchOrders();
      if (mounted) {
        setState(() {
          orders = next;
          error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    }
  }

  Future<void> run(Map<String, dynamic> order) async {
    final role = widget.session.profile?.role ?? 'consulta';
    final action = nextBenchAction(
      status: order['status'] as String,
      role: role,
      steps: List<Map<String, dynamic>>.from(order['steps'] as List? ?? []),
    );
    if (action.kind == 'none') return;
    final id = order['id'] as String;
    final previous = '${order['status']}';
    final numero = visibleOrderNumber(order);
    setState(() => pendingId = id);
    try {
      if (action.kind == 'status') {
        await api.changeStatus(id, action.to!, action.note);
      } else {
        await api.advanceStep(id, action.step!, action.action!);
      }
      await load();
      if (!mounted) return;
      HapticFeedback.mediumImpact();
      final destino = action.to != null
          ? (statusLabel[action.to!] ?? action.label)
          : action.label;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('OS $numero movida para $destino'),
          duration: Duration(seconds: 5),
          action: action.kind == 'status'
              ? SnackBarAction(
                  label: 'Desfazer',
                  onPressed: () async {
                    await api.changeStatus(
                      id,
                      previous,
                      'Desfazer movimentação',
                    );
                    await load();
                  },
                )
              : null,
        ),
      );
    } catch (e) {
      if (mounted)
        setState(
          () => error = 'OS $numero não foi movida. ${friendlyError(e)}',
        );
    } finally {
      if (mounted) setState(() => pendingId = null);
    }
  }

  List<Map<String, dynamic>> _of(String status) {
    final rows = [
      for (final order in orders)
        if ('${order['status']}' == status) order,
    ];
    rows.sort((a, b) {
      final urgentA = a['priority'] == 'critica' ? 0 : 1;
      final urgentB = b['priority'] == 'critica' ? 0 : 1;
      final byUrgent = urgentA.compareTo(urgentB);
      if (byUrgent != 0) return byUrgent;
      return '${a['due_at'] ?? '9'}'.compareTo('${b['due_at'] ?? '9'}');
    });
    return rows;
  }

  @override
  Widget build(BuildContext context) {
    final role = widget.session.profile?.role ?? 'consulta';
    final current = BenchScreen.station.value;
    final items = _of(current);
    final total = orders
        .where((order) => benchStatuses.contains('${order['status']}'))
        .length;
    return RefreshIndicator(
      color: LaColors.adapt(context, LaColors.grafite),
      onRefresh: load,
      child: ListView(
        padding: EdgeInsets.fromLTRB(
          LaSpace.tela,
          LaSpace.l,
          LaSpace.tela,
          LaSpace.xxl,
        ),
        children: [
          SafeArea(
            bottom: false,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(child: Text('Bancada', style: LaType.tituloTela)),
                Text(
                  '$total',
                  style: LaType.tituloSecao.copyWith(fontSize: 28),
                ),
                SizedBox(width: 4),
                Padding(
                  padding: EdgeInsets.only(bottom: 4),
                  child: Text('OS', style: LaType.apoio),
                ),
              ],
            ),
          ),
          SizedBox(height: LaSpace.secao),
          if (error != null) ...[
            LaErrorBanner(
              titulo: 'Bancada',
              mensagem: error!,
              onTentarDeNovo: load,
            ),
            SizedBox(height: LaSpace.item),
          ],
          LaAdaptiveGrid(
            minWidth: 150,
            children: [
              for (final station in _stations)
                _Station(
                  label: station.$2,
                  count: _of(station.$1).length,
                  selected: current == station.$1,
                  alert: station.$1 == 'em_correcao',
                  onTap: () => BenchScreen.station.value = station.$1,
                ),
            ],
          ),
          SizedBox(height: LaSpace.secao),
          if (items.isEmpty)
            LaEmptyState(
              titulo: current == 'em_correcao'
                  ? 'Nada em correção'
                  : 'Nenhuma OS nesta estação',
              mensagem: 'As OS que chegarem aqui aparecem neste cartão.',
            )
          else
            for (final order in items) ...[
              _card(order, role),
              SizedBox(height: LaSpace.item),
            ],
        ],
      ),
    );
  }

  Widget _card(Map<String, dynamic> order, String role) {
    final action = nextBenchAction(
      status: '${order['status']}',
      role: role,
      steps: List<Map<String, dynamic>>.from(order['steps'] as List? ?? []),
    );
    final id = order['id'] as String;
    final destino = action.to != null
        ? (statusLabel[action.to!] ?? action.label)
        : action.label;
    return LaOsCard(
      numero: visibleOrderNumber(order),
      cliente: '${order['client_name'] ?? 'Sem nome'}',
      detalhe:
          '${order['store_name'] ?? 'Sem loja'}, ${order['seller_name'] ?? 'sem vendedora'}',
      urgente: order['priority'] == 'critica',
      emCorrecao: '${order['status']}' == 'em_correcao',
      acaoLabel: action.kind == 'none' ? action.label : 'Mover para $destino',
      acaoFinal: action.to == 'pronto',
      carregando: pendingId == id,
      onAcao: action.kind == 'none' ? null : () => run(order),
      onAbrir: () => context.push('/os/$id'),
    );
  }
}

class _Station extends StatelessWidget {
  const _Station({
    required this.label,
    required this.count,
    required this.selected,
    required this.alert,
    required this.onTap,
  });

  final String label;
  final int count;
  final bool selected;
  final bool alert;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final bg = selected ? Color(0xFF222222) : LaColors.surface(context);
    final fg = selected
        ? LaColors.branco
        : (alert ? LaColors.adapt(context, LaColors.alerta) : LaColors.adapt(context, LaColors.grafite));
    final number = selected ? LaColors.branco : fg;
    return Semantics(
      button: true,
      selected: selected,
      label: '$label, $count OS',
      child: Material(
        color: bg,
        borderRadius: LaRadius.rCartao,
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  '$count',
                  style: LaType.numeroLista.copyWith(
                    color: number,
                    fontSize: 28,
                    height: 1,
                  ),
                ),
                Text(
                  label,
                  maxLines: 2,
                  style: LaType.apoio.copyWith(
                    color: fg,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
