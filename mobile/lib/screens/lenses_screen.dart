import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../design/la_design.dart';
import '../domain.dart';
import '../floor_format.dart';
import '../lab_api.dart';
import '../session.dart';

class LensesScreen extends StatefulWidget {
  const LensesScreen({super.key, required this.session});

  final Session session;

  @override
  State<LensesScreen> createState() => _LensesScreenState();
}

class _LensesScreenState extends State<LensesScreen> {
  final api = LabApi();
  final busca = TextEditingController();
  final selected = <String>{};
  Timer? _debounce;
  List<Map<String, dynamic>> rows = [];
  Set<String> conversas = {};
  List<Map<String, dynamic>> achados = [];
  String? error;
  String? casa;
  bool pending = false;
  bool buscando = false;

  bool get podeGravar =>
      canWriteOrders(widget.session.profile?.role ?? 'consulta');

  bool get podeReceber => allowedTargets(
    'aguardando_lentes',
    widget.session.profile?.role ?? 'consulta',
  ).contains('aguardando_montagem');

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    busca.dispose();
    super.dispose();
  }

  Future<void> load() async {
    try {
      final next = await api.lensQueue();
      final talks = await api.conversationOrderIds();
      if (!mounted) return;
      setState(() {
        rows = next;
        conversas = talks;
        selected.removeWhere((id) => !next.any((row) => row['id'] == id));
        error = null;
      });
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    }
  }

  void onBusca(String value) {
    _debounce?.cancel();
    final texto = value.trim();
    if (texto.length < 2) {
      setState(() {
        achados = [];
        buscando = false;
      });
      return;
    }
    setState(() => buscando = true);
    _debounce = Timer(Duration(milliseconds: 280), () async {
      try {
        final next = await api.findOrders(texto);
        if (!mounted || busca.text.trim() != texto) return;
        setState(() {
          achados = next;
          buscando = false;
          error = null;
        });
      } catch (e) {
        if (mounted) {
          setState(() {
            buscando = false;
            error = friendlyError(e);
          });
        }
      }
    });
  }

  Future<void> release() async {
    setState(() => pending = true);
    try {
      for (final id in selected.toList()) {
        await api.receiveLenses(id);
      }
      selected.clear();
      HapticFeedback.mediumImpact();
      await load();
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    } finally {
      if (mounted) setState(() => pending = false);
    }
  }

  Future<void> abrirPedido(Map<String, dynamic> row) async {
    if (!podeGravar) {
      context.push('/os/${row['id']}');
      return;
    }
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: LaColors.surface(context),
      shape: RoundedRectangleBorder(borderRadius: LaRadius.rFolhaTopo),
      builder: (context) => _PedidoSheet(row: row, api: api),
    );
    if (saved == true) await load();
  }

  List<Map<String, dynamic>> _daCasa(List<Map<String, dynamic>> source) {
    if (casa == null) return source;
    return source.where((row) => houseOf(row) == casa).toList();
  }

  @override
  Widget build(BuildContext context) {
    final texto = busca.text.trim();
    final pesquisando = texto.length >= 2;
    final pedido = _daCasa(rows.where((row) => !pedidoFeito(row)).toList());
    final lente = _daCasa(rows.where(pedidoFeito).toList());
    return Column(
      children: [
        Expanded(
          child: RefreshIndicator(
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
                  child: Text('Lentes', style: LaType.tituloTela),
                ),
                Text(
                  'O prazo do cliente manda. O pedido confirma a chegada.',
                  style: LaType.apoio,
                ),
                SizedBox(height: LaSpace.secao),
                TextField(
                  controller: busca,
                  onChanged: onBusca,
                  textInputAction: TextInputAction.search,
                  decoration: InputDecoration(
                    hintText: 'Buscar OS, cliente ou pedido',
                    filled: true,
                    fillColor: LaColors.surface(context),
                  ),
                ),
                if (error != null) ...[
                  SizedBox(height: LaSpace.item),
                  LaErrorBanner(
                    titulo: 'Lentes',
                    mensagem: error!,
                    onTentarDeNovo: load,
                  ),
                ],
                SizedBox(height: LaSpace.secao),
                if (pesquisando)
                  _Busca(
                    carregando: buscando,
                    achados: achados,
                    onAbrir: (row) => context.push('/os/${row['id']}'),
                  )
                else ...[
                  _Casas(
                    selecionada: casa,
                    onChanged: (value) => setState(() => casa = value),
                  ),
                  SizedBox(height: LaSpace.secao),
                  LayoutBuilder(
                    builder: (context, constraints) {
                      final wide = constraints.maxWidth >= 840;
                      final pedidoBloco = _Coluna(
                        titulo: 'Aguardando pedido',
                        vazio: 'Nada sem pedido.',
                        rows: pedido,
                        podeReceber: false,
                        selected: selected,
                        onToggle: (_) {},
                        conversas: conversas,
                        onPedido: abrirPedido,
                        onAbrir: (row) => context.push('/os/${row['id']}'),
                      );
                      final lenteBloco = _Coluna(
                        titulo: 'Aguardando lente',
                        vazio: 'Nenhuma lente pedida.',
                        rows: lente,
                        podeReceber: podeReceber,
                        selected: selected,
                        onToggle: (id) => setState(() {
                          if (!selected.add(id)) selected.remove(id);
                        }),
                        conversas: conversas,
                        onPedido: abrirPedido,
                        onAbrir: (row) => context.push('/os/${row['id']}'),
                      );
                      if (!wide) {
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            pedidoBloco,
                            SizedBox(height: LaSpace.xxl),
                            lenteBloco,
                          ],
                        );
                      }
                      return Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(child: pedidoBloco),
                          SizedBox(width: LaSpace.l),
                          Expanded(child: lenteBloco),
                        ],
                      );
                    },
                  ),
                ],
              ],
            ),
          ),
        ),
        if (!pesquisando && selected.isNotEmpty && podeReceber)
          Padding(
            padding: EdgeInsets.fromLTRB(
              LaSpace.tela,
              0,
              LaSpace.tela,
              LaSpace.l,
            ),
            child: LaButton(
              label: 'Lentes recebidas · ${selected.length}',
              variant: LaButtonVariant.principal,
              loading: pending,
              onPressed: pending ? null : release,
            ),
          ),
      ],
    );
  }
}

class _Casas extends StatelessWidget {
  const _Casas({required this.selecionada, required this.onChanged});

  final String? selecionada;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) {
    final opcoes = [null, ...lensHouses];
    return Wrap(
      spacing: LaSpace.item,
      runSpacing: LaSpace.item,
      children: [
        for (final opcao in opcoes)
          _Chip(
            label: opcao ?? 'Todas',
            selected: selecionada == opcao,
            onTap: () => onChanged(opcao),
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

class _Busca extends StatelessWidget {
  const _Busca({
    required this.carregando,
    required this.achados,
    required this.onAbrir,
  });

  final bool carregando;
  final List<Map<String, dynamic>> achados;
  final ValueChanged<Map<String, dynamic>> onAbrir;

  @override
  Widget build(BuildContext context) {
    if (carregando && achados.isEmpty) {
      return Padding(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: Center(
          child: CircularProgressIndicator(
            color: LaColors.adapt(context, LaColors.grafite),
          ),
        ),
      );
    }
    if (achados.isEmpty) {
      return LaEmptyState(
        titulo: 'Nenhuma OS',
        mensagem: 'Nada com esse número, cliente ou pedido.',
      );
    }
    return Column(
      children: [
        for (final row in achados) ...[
          _BuscaCard(row: row, onAbrir: () => onAbrir(row)),
          SizedBox(height: LaSpace.item),
        ],
      ],
    );
  }
}

class _BuscaCard extends StatelessWidget {
  const _BuscaCard({required this.row, required this.onAbrir});

  final Map<String, dynamic> row;
  final VoidCallback onAbrir;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: LaColors.surface(context),
      borderRadius: LaRadius.rCartao,
      child: InkWell(
        onTap: onAbrir,
        borderRadius: LaRadius.rCartao,
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: LaSize.toque),
          child: Padding(
            padding: EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(visibleOrderNumber(row), style: LaType.numeroCartao),
                Text(
                  '${row['client_name'] ?? 'Sem nome'}',
                  style: LaType.corpo.copyWith(fontWeight: FontWeight.w600),
                ),
                SizedBox(height: 4),
                Text(
                  ondeEsta(row),
                  style: LaType.corpo.copyWith(fontWeight: FontWeight.w700),
                ),
                Text(
                  '${storeNameOf(row)}, ${sellerNameOf(row)}',
                  style: LaType.apoio,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Coluna extends StatelessWidget {
  const _Coluna({
    required this.titulo,
    required this.vazio,
    required this.rows,
    required this.podeReceber,
    required this.selected,
    required this.onToggle,
    required this.onPedido,
    required this.onAbrir,
    required this.conversas,
  });

  final String titulo;
  final String vazio;
  final List<Map<String, dynamic>> rows;
  final bool podeReceber;
  final Set<String> selected;
  final ValueChanged<String> onToggle;
  final ValueChanged<Map<String, dynamic>> onPedido;
  final ValueChanged<Map<String, dynamic>> onAbrir;
  final Set<String> conversas;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(child: Text(titulo, style: LaType.tituloSecao)),
            Text(
              '${rows.length}',
              style: LaType.tituloSecao.copyWith(fontSize: 28),
            ),
          ],
        ),
        SizedBox(height: LaSpace.item),
        if (rows.isEmpty)
          LaEmptyState(
            titulo: vazio,
            mensagem: 'As OS desta etapa aparecem aqui.',
          )
        else
          for (final store in groupByStoreThenSeller(rows)) ...[
            Text(
              store.$1,
              style: LaType.rotulo.copyWith(fontWeight: FontWeight.w700),
            ),
            SizedBox(height: LaSpace.s),
            for (final seller in store.$2) ...[
              Text('Gaveta · ${seller.$1}', style: LaType.apoio),
              SizedBox(height: LaSpace.s),
              for (final house in _gavetas(seller.$2)) ...[
                if (house.$1 != null) ...[
                  Text(
                    house.$1!,
                    style: LaType.rotulo.copyWith(
                      color: LaColors.adapt(context, LaColors.regua),
                    ),
                  ),
                  SizedBox(height: LaSpace.s),
                ],
                for (final row in house.$2) ...[
                  _LenteCard(
                    row: row,
                    marcada: selected.contains(row['id']),
                    podeReceber: podeReceber,
                    onToggle: () => onToggle(row['id'] as String),
                    conversa: conversas.contains(row['id']),
                    onPedido: () => onPedido(row),
                    onAbrir: () => onAbrir(row),
                  ),
                  SizedBox(height: LaSpace.item),
                ],
              ],
            ],
          ],
      ],
    );
  }
}

List<(String? casa, List<Map<String, dynamic>> rows)> _gavetas(
  List<Map<String, dynamic>> rows,
) {
  final named = <String, List<Map<String, dynamic>>>{};
  final soltas = <Map<String, dynamic>>[];
  for (final row in rows) {
    final casa = houseOf(row);
    if (casa == null) {
      soltas.add(row);
    } else {
      named.putIfAbsent(casa, () => []).add(row);
    }
  }
  if (named.isEmpty) return [(null, rows)];
  return [
    for (final casa in lensHouses)
      if (named.containsKey(casa)) (casa, named[casa]!),
    for (final entry in named.entries)
      if (!lensHouses.contains(entry.key)) (entry.key, entry.value),
    if (soltas.isNotEmpty) ('Sem casa', soltas),
  ];
}

class _LenteCard extends StatelessWidget {
  const _LenteCard({
    required this.row,
    required this.marcada,
    required this.podeReceber,
    required this.onToggle,
    required this.onPedido,
    required this.onAbrir,
    required this.conversa,
  });

  final Map<String, dynamic> row;
  final bool marcada;
  final bool podeReceber;
  final bool conversa;
  final VoidCallback onToggle;
  final VoidCallback onPedido;
  final VoidCallback onAbrir;

  @override
  Widget build(BuildContext context) {
    final pedido = '${row['lens_supplier_ref'] ?? ''}'.trim();
    final casa = houseOf(row);
    final dia = diaCurto(row['lens_expected_at']);
    final risco = acompanharLente(
      dueAt: row['due_at'] as String?,
      lensExpectedAt: row['lens_expected_at'] as String?,
    );
    final faltaPedido = pedido.isEmpty;
    final faltaData = dia.isEmpty;
    return Container(
      padding: EdgeInsets.fromLTRB(8, 12, 12, 12),
      decoration: BoxDecoration(
        color: LaColors.surface(context),
        borderRadius: LaRadius.rCartao,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (podeReceber)
                SizedBox(
                  width: LaSize.toque,
                  height: LaSize.toque,
                  child: InkWell(
                    onTap: onToggle,
                    customBorder: CircleBorder(),
                    child: Icon(
                      marcada ? Icons.check_circle : Icons.circle_outlined,
                      color: LaColors.adapt(context, LaColors.grafite),
                    ),
                  ),
                )
              else
                SizedBox(width: 8),
              Expanded(
                child: InkWell(
                  onTap: onPedido,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(visibleOrderNumber(row), style: LaType.numeroCartao),
                      if (conversa)
                        Text(
                          'Conversa',
                          style: LaType.rotulo.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      Text(
                        '${row['client_name'] ?? 'Sem nome'}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: LaType.corpo.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      SizedBox(height: 6),
                      LaPrazoTag(
                        status: prazoDe(row),
                        texto: 'Cliente · ${prazoCurto(row)}',
                      ),
                      SizedBox(height: 6),
                      Text(
                        faltaPedido
                            ? 'Falta o número do pedido'
                            : 'Pedido ${casa == null ? pedido : '$casa $pedido'}',
                        style: LaType.corpo.copyWith(
                          fontWeight: FontWeight.w700,
                          color: faltaPedido
                              ? LaColors.adapt(context, LaColors.alerta)
                              : LaColors.adapt(context, LaColors.grafite),
                        ),
                      ),
                      Text(
                        faltaData
                            ? 'Falta a data do laboratório'
                            : 'Laboratório $dia',
                        style: LaType.corpo.copyWith(
                          fontWeight: FontWeight.w600,
                          color: faltaData
                              ? LaColors.adapt(context, LaColors.alerta)
                              : LaColors.adapt(context, LaColors.regua),
                        ),
                      ),
                      if (_mostraRisco(risco.watch))
                        Text(
                          risco.label,
                          style: LaType.apoio.copyWith(
                            color: _riscoCor(context, risco.watch),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              IconButton(
                onPressed: onAbrir,
                tooltip: 'Abrir OS',
                icon: Icon(
                  Icons.north_east,
                  color: LaColors.adapt(context, LaColors.grafite),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

bool _mostraRisco(LensWatch watch) {
  switch (watch) {
    case LensWatch.atrasada:
    case LensWatch.estoura:
    case LensWatch.apertado:
    case LensWatch.noPrazo:
      return true;
    case LensWatch.semPrevisao:
    case LensWatch.semPrazo:
      return false;
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
