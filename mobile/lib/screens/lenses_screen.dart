import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../design/la_design.dart';
import '../domain.dart';
import '../floor_format.dart';
import '../lab_api.dart';
import '../production_scope.dart';
import '../production_summary.dart';
import '../production_widgets.dart';
import '../session.dart';

class LensesScreen extends StatefulWidget {
  const LensesScreen({
    super.key,
    required this.session,
    required this.scope,
    this.active = true,
  });
  final Session session;
  final ProductionScope scope;
  final bool active;
  @override
  State<LensesScreen> createState() => _LensesScreenState();
}

class _LensesScreenState extends State<LensesScreen> {
  final api = LabApi();
  final busca = TextEditingController();
  final selected = <String>{};
  List<Map<String, dynamic>> rows = [];
  String phase = 'all';
  String? casa;
  String? error;
  String? message;
  String? seller;
  bool pending = false, loading = false;
  bool get podeGravar =>
      canWriteOrders(widget.session.profile?.role ?? 'consulta');
  bool get podeReceber => allowedTargets(
    'aguardando_lentes',
    widget.session.profile?.role ?? 'consulta',
  ).contains('aguardando_montagem');
  @override
  void initState() {
    super.initState();
    seller = widget.scope.sellerId;
    widget.scope.addListener(scopeChanged);
    load();
  }

  @override
  void didUpdateWidget(covariant LensesScreen old) {
    super.didUpdateWidget(old);
    if (widget.active && !old.active) load();
  }

  @override
  void dispose() {
    widget.scope.removeListener(scopeChanged);
    busca.dispose();
    super.dispose();
  }

  void scopeChanged() {
    if (!mounted) return;
    setState(() {
      if (seller != widget.scope.sellerId) selected.clear();
      seller = widget.scope.sellerId;
    });
  }

  Future<void> load() async {
    if (loading) return;
    setState(() => loading = true);
    try {
      final next = await api.lensQueue();
      if (!mounted) return;
      setState(() {
        rows = next;
        selected.removeWhere((id) => !next.any((row) => row['id'] == id));
        error = null;
      });
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  bool vta(Map<String, dynamic> row) =>
      row['frame_state'] == 'vta' && row['lens_arrived_at'] != null;
  bool missing(Map<String, dynamic> row) =>
      '${row['lens_supplier_ref'] ?? ''}'.trim().isEmpty;
  bool matchesPhase(Map<String, dynamic> row) => switch (phase) {
    'missing' => !vta(row) && missing(row),
    'ordered' => !vta(row) && !missing(row),
    'vta' => vta(row),
    _ => true,
  };
  Future<void> openOrder(Map<String, dynamic> row) async {
    await context.push('/os/${row['id']}');
    if (mounted) await load();
  }

  Future<void> abrirPedido(Map<String, dynamic> row) async {
    if (!podeGravar) {
      await openOrder(row);
      return;
    }
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: LaColors.surface(context),
      shape: RoundedRectangleBorder(borderRadius: LaRadius.rFolhaTopo),
      builder: (context) => SingleChildScrollView(
        child: _PedidoSheet(row: row, api: api),
      ),
    );
    if (saved == true && mounted) await load();
  }

  Future<void> receive(List<String> ids) async {
    if (pending || loading || !podeReceber || error != null || ids.isEmpty)
      return;
    setState(() {
      pending = true;
      message = null;
    });
    var done = 0, frames = 0;
    String? failed;
    for (final id in ids.take(100)) {
      try {
        final row = await api.receiveLenses(id);
        done++;
        if (row['frame_state'] == 'vta') frames++;
        selected.remove(id);
      } catch (e) {
        failed = friendlyError(e);
      }
    }
    if (!mounted) return;
    await load();
    if (!mounted) return;
    setState(() {
      pending = false;
      error = failed;
      message =
          '$done lente(s) recebida(s).${frames > 0
              ? ' $frames VTA aguardam a armação; demais serviços seguem para bancada.'
              : done > 0
              ? ' Serviços encaminhados à bancada.'
              : ''}';
    });
    HapticFeedback.mediumImpact();
  }

  @override
  Widget build(BuildContext context) {
    final all = selectProduction(
      rows,
      sellerId: widget.scope.sellerId,
      query: busca.text,
    );
    final visible = all
        .where(matchesPhase)
        .where((r) => casa == null || houseOf(r) == casa)
        .toList();
    final eligible = visible
        .where((r) => !vta(r))
        .map((r) => '${r['id']}')
        .take(100)
        .toList();
    final houses = {
      ...lensHouses,
      ...rows.map(houseOf).whereType<String>(),
    }.toList();
    return Column(
      children: [
        Expanded(
          child: RefreshIndicator(
            onRefresh: load,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
              children: [
                SafeArea(
                  bottom: false,
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'PEDIDOS · RECEBIMENTO',
                              style: Theme.of(context).textTheme.labelSmall
                                  ?.copyWith(
                                    color: Theme.of(context)
                                        .colorScheme
                                        .primary,
                                    letterSpacing: 1.1,
                                  ),
                            ),
                            const SizedBox(height: 4),
                            const Text(
                              'Lentes a chegar',
                              style: TextStyle(
                                fontSize: 26,
                                fontWeight: FontWeight.w700,
                                letterSpacing: -.5,
                              ),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        tooltip: 'Atualizar lentes',
                        onPressed: loading ? null : load,
                        icon: const Icon(Icons.refresh),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Prioridade pelo prazo. VTA fica separado até a armação chegar.',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: 16),
                SellerPicker(scope: widget.scope, orders: rows),
                const SizedBox(height: 12),
                TextField(
                  controller: busca,
                  onChanged: (_) => setState(() => selected.clear()),
                  decoration: InputDecoration(
                    hintText: 'OS, cliente, pedido ou vendedora',
                    prefixIcon: const Icon(Icons.search),
                    suffixIcon: busca.text.isEmpty
                        ? null
                        : IconButton(
                            tooltip: 'Limpar busca',
                            onPressed: () => setState(() => busca.clear()),
                            icon: const Icon(Icons.close),
                          ),
                  ),
                ),
                const SizedBox(height: 10),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      for (final item in [
                        ('all', 'Todas', all.length),
                        (
                          'missing',
                          'Sem nº de pedido',
                          all.where((r) => !vta(r) && missing(r)).length,
                        ),
                        (
                          'ordered',
                          'Pedidos',
                          all.where((r) => !vta(r) && !missing(r)).length,
                        ),
                        ('vta', 'VTA', all.where(vta).length),
                      ])
                        Padding(
                          padding: const EdgeInsets.only(right: 7),
                          child: ChoiceChip(
                            selected: phase == item.$1,
                            label: Text('${item.$2} ${item.$3}'),
                            onSelected: pending
                                ? null
                                : (_) => setState(() {
                                    phase = item.$1;
                                    selected.clear();
                                  }),
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 10),
                ExpansionTile(
                  tilePadding: EdgeInsets.zero,
                  childrenPadding: const EdgeInsets.only(bottom: 12),
                  title: Text(
                    casa == null
                        ? 'Casa da lente · filtro opcional'
                        : 'Casa: $casa',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  children: [
                    DropdownButtonFormField<String>(
                      initialValue: casa ?? '',
                      isExpanded: true,
                      items: [
                        const DropdownMenuItem(
                          value: '',
                          child: Text('Todas as casas / gavetas'),
                        ),
                        for (final house in houses)
                          DropdownMenuItem(value: house, child: Text(house)),
                      ],
                      onChanged: (value) => setState(() {
                        casa = value == '' ? null : value;
                        selected.clear();
                      }),
                    ),
                  ],
                ),
                if (error != null)
                  LaErrorBanner(
                    titulo: 'Confira a atualização da fila',
                    mensagem: error!,
                    onTentarDeNovo: load,
                  ),
                if (message != null)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    child: Text(
                      message!,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.primary,
                      ),
                    ),
                  ),
                Row(
                  children: [
                    if (podeReceber)
                      Checkbox(
                        value:
                            eligible.isNotEmpty &&
                            eligible.every(selected.contains),
                        onChanged: pending || error != null || eligible.isEmpty
                            ? null
                            : (value) => setState(() {
                                selected.clear();
                                if (value == true) selected.addAll(eligible);
                              }),
                      ),
                    Expanded(
                      child: Text(
                        podeReceber
                            ? 'Selecionar até 100 visíveis'
                            : 'Lista por prioridade',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ),
                    Text(
                      '${visible.length} serviços',
                      style: Theme.of(context).textTheme.labelSmall,
                    ),
                  ],
                ),
                if (loading && rows.isEmpty)
                  const Padding(
                    padding: EdgeInsets.all(30),
                    child: Center(child: CircularProgressIndicator()),
                  )
                else if (visible.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 26),
                    child: Text(
                      'Nenhum serviço neste filtro. Você pode trocar a vendedora ou limpar a busca.',
                    ),
                  )
                else
                  ProductionPanel(
                    child: Column(
                      children: [
                        for (var i = 0; i < visible.length; i++) ...[
                          if (i > 0) const Divider(height: 1),
                          Row(
                            children: [
                              if (podeReceber)
                                Checkbox(
                                  value: selected.contains(visible[i]['id']),
                                  onChanged:
                                      pending ||
                                          vta(visible[i]) ||
                                          error != null
                                      ? null
                                      : (value) => setState(() {
                                          final id = '${visible[i]['id']}';
                                          if (value == true &&
                                              selected.length < 100) {
                                            selected.add(id);
                                          } else {
                                            selected.remove(id);
                                          }
                                        }),
                                ),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    OperationalOrderLine(
                                      order: visible[i],
                                      showStage: false,
                                      now: DateTime.now(),
                                      onTap: () => openOrder(visible[i]),
                                    ),
                                    if (vta(visible[i]) || missing(visible[i]))
                                      Padding(
                                        padding: const EdgeInsets.fromLTRB(
                                          14,
                                          0,
                                          8,
                                          10,
                                        ),
                                        child: Text(
                                          vta(visible[i])
                                              ? 'VTA · lente recebida, aguardando armação'
                                              : 'Falta o número do pedido externo',
                                          style: TextStyle(
                                            fontSize: 12,
                                            color: LaColors.adapt(
                                              context,
                                              LaColors.alerta,
                                            ),
                                          ),
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                              PopupMenuButton<String>(
                                tooltip: 'Ações do serviço',
                                enabled: !pending,
                                onSelected: (action) {
                                  if (action == 'order')
                                    abrirPedido(visible[i]);
                                  else if (action == 'receive')
                                    receive(['${visible[i]['id']}']);
                                  else
                                    openOrder(visible[i]);
                                },
                                itemBuilder: (_) => [
                                  const PopupMenuItem(
                                    value: 'detail',
                                    child: Text('Processos, fotos e histórico'),
                                  ),
                                  if (podeGravar)
                                    const PopupMenuItem(
                                      value: 'order',
                                      child: Text('Pedido e previsão da lente'),
                                    ),
                                  if (podeReceber &&
                                      !vta(visible[i]) &&
                                      error == null)
                                    const PopupMenuItem(
                                      value: 'receive',
                                      child: Text('Lente chegou · receber'),
                                    ),
                                ],
                              ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
                if (busca.text.trim().isNotEmpty)
                  TextButton.icon(
                    onPressed: () => context.push(
                      Uri(
                        path: '/os',
                        queryParameters: {
                          'busca': busca.text,
                          if (widget.scope.sellerId != null)
                            'vendedora': widget.scope.sellerId!,
                        },
                      ).toString(),
                    ),
                    icon: const Icon(Icons.search, size: 18),
                    label: const Text('Buscar também nas outras etapas'),
                  ),
              ],
            ),
          ),
        ),
        if (selected.isNotEmpty && podeReceber)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 6, 16, 12),
            child: FilledButton.icon(
              onPressed: pending || error != null
                  ? null
                  : () => receive(selected.toList()),
              icon: pending
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.check, size: 18),
              label: Text(
                pending ? 'Recebendo…' : 'Receber ${selected.length} lente(s)',
              ),
            ),
          ),
      ],
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? Color(0xFF222222) : LaColors.surface(context),
      borderRadius: LaRadius.rChip,
      child: InkWell(
        onTap: onTap,
        borderRadius: LaRadius.rChip,
        child: ConstrainedBox(
          constraints: BoxConstraints(
            minHeight: LaSize.toque,
            minWidth: LaSize.toque,
          ),
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: 14),
            child: Center(
              widthFactor: 1,
              child: Text(
                label,
                style: LaType.rotulo.copyWith(
                  fontWeight: FontWeight.w700,
                  color: selected
                      ? LaColors.branco
                      : LaColors.adapt(context, LaColors.grafite),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

Color _riscoCor(BuildContext context, LensWatch watch) {
  switch (watch) {
    case LensWatch.atrasada:
    case LensWatch.estoura:
      return LaColors.adapt(context, LaColors.perigo);
    case LensWatch.apertado:
      return LaColors.adapt(context, LaColors.alerta);
    case LensWatch.noPrazo:
      return LaColors.adapt(context, LaColors.noPrazo);
    case LensWatch.semPrevisao:
    case LensWatch.semPrazo:
      return LaColors.adapt(context, LaColors.regua);
  }
}

class _PedidoSheet extends StatefulWidget {
  const _PedidoSheet({required this.row, required this.api});

  final Map<String, dynamic> row;
  final LabApi api;

  @override
  State<_PedidoSheet> createState() => _PedidoSheetState();
}

class _PedidoSheetState extends State<_PedidoSheet> {
  late final TextEditingController numero;
  late String? casa;
  DateTime? dia;
  bool salvando = false;
  String? erro;

  @override
  void initState() {
    super.initState();
    numero = TextEditingController(
      text: '${widget.row['lens_supplier_ref'] ?? ''}',
    );
    casa = houseOf(widget.row);
    dia = DateTime.tryParse('${widget.row['lens_expected_at'] ?? ''}')
        ?.toLocal();
  }

  @override
  void dispose() {
    numero.dispose();
    super.dispose();
  }

  String? get _iso {
    final date = dia;
    if (date == null) return null;
    final ymd =
        '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
    return dateToNoonIso(ymd);
  }

  Future<void> escolherDia() async {
    final hoje = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: dia ?? hoje,
      firstDate: DateTime(hoje.year - 1),
      lastDate: DateTime(hoje.year + 2),
    );
    if (picked != null) setState(() => dia = picked);
  }

  Future<void> salvar() async {
    setState(() {
      salvando = true;
      erro = null;
    });
    try {
      await widget.api.saveLensOrder(
        widget.row['id'] as String,
        expectedAt: _iso,
        supplierRef: numero.text,
        house: casa,
        lensSpec: lensSpecOf(widget.row),
      );
      HapticFeedback.mediumImpact();
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        setState(() {
          salvando = false;
          erro = friendlyError(e);
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final risco = acompanharLente(
      dueAt: widget.row['due_at'] as String?,
      lensExpectedAt: _iso,
    );
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        LaSpace.tela,
        LaSpace.l,
        LaSpace.tela,
        LaSpace.xl + bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(visibleOrderNumber(widget.row), style: LaType.tituloSecao),
          Text('${widget.row['client_name'] ?? ''}', style: LaType.apoio),
          SizedBox(height: LaSpace.m),
          LaPrazoTag(
            status: prazoDe(widget.row),
            texto: 'Cliente · ${prazoCurto(widget.row)}',
          ),
          SizedBox(height: LaSpace.secao),
          Text('Casa da gaveta', style: LaType.rotulo),
          SizedBox(height: LaSpace.s),
          Wrap(
            spacing: LaSpace.item,
            runSpacing: LaSpace.item,
            children: [
              for (final opcao in lensHouses)
                _Chip(
                  label: opcao,
                  selected: casa == opcao,
                  onTap: () =>
                      setState(() => casa = casa == opcao ? null : opcao),
                ),
            ],
          ),
          SizedBox(height: LaSpace.secao),
          TextField(
            controller: numero,
            textCapitalization: TextCapitalization.characters,
            decoration: InputDecoration(
              labelText: 'Número do pedido',
              filled: true,
              fillColor: LaColors.adapt(context, LaColors.piso),
            ),
          ),
          SizedBox(height: LaSpace.item),
          OutlinedButton(
            onPressed: escolherDia,
            style: OutlinedButton.styleFrom(
              minimumSize: Size.fromHeight(LaSize.toque),
              foregroundColor: LaColors.adapt(context, LaColors.grafite),
              side: BorderSide(
                color: LaColors.adapt(context, LaColors.grafite),
                width: 2,
              ),
            ),
            child: Text(
              dia == null
                  ? 'Data prevista do laboratório'
                  : 'Laboratório ${diaCurto(dia!.toIso8601String())}',
            ),
          ),
          if (dia != null)
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton(
                onPressed: () => setState(() => dia = null),
                child: Text(
                  'Limpar data',
                  style: LaType.apoio.copyWith(
                    color: LaColors.adapt(context, LaColors.regua),
                  ),
                ),
              ),
            ),
          SizedBox(height: LaSpace.s),
          Text(
            risco.label,
            style: LaType.corpo.copyWith(
              fontWeight: FontWeight.w700,
              color: _riscoCor(context, risco.watch),
            ),
          ),
          if (erro != null) ...[
            SizedBox(height: LaSpace.item),
            Text(
              erro!,
              style: LaType.apoio.copyWith(
                color: LaColors.adapt(context, LaColors.perigo),
              ),
            ),
          ],
          SizedBox(height: LaSpace.secao),
          LaButton(
            label: 'Salvar pedido',
            variant: LaButtonVariant.principal,
            loading: salvando,
            onPressed: salvando ? null : salvar,
          ),
          SizedBox(height: LaSpace.item),
          LaButton(
            label: 'Abrir OS',
            variant: LaButtonVariant.contorno,
            onPressed: () {
              Navigator.pop(context);
              context.push('/os/${widget.row['id']}');
            },
          ),
        ],
      ),
    );
  }
}
