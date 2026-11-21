import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../design/la_design.dart';
import '../domain.dart';
import '../lab_api.dart';

class LaunchScreen extends StatefulWidget {
  const LaunchScreen({super.key, this.inShell = false});
  final bool inShell;

  @override
  State<LaunchScreen> createState() => _LaunchScreenState();
}

class _LaunchScreenState extends State<LaunchScreen> {
  final api = LabApi();
  final line = TextEditingController();
  final focus = FocusNode();
  List<Map<String, dynamic>> labs = [];
  List<Map<String, dynamic>> sellerRows = [];
  List<Map<String, dynamic>> storeRows = [];
  List<Map<String, dynamic>> links = [];
  final launched = <Map<String, dynamic>>[];
  String? labId;
  String? sellerId;
  String? storeId;
  String status = 'aguardando_lentes';
  int? dueHours = 48;
  String lensDate = '';
  String lensRef = '';
  bool urgent = false;
  bool pending = false;
  String? error;
  String? hint;
  int lotCount = 0;

  @override
  void initState() {
    super.initState();
    load();
    line.addListener(() {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    line.dispose();
    focus.dispose();
    super.dispose();
  }

  String get labName {
    for (final lab in labs) {
      if (lab['id'] == labId) return '${lab['name']}';
    }
    return 'Laboratório';
  }

  String get sellerName {
    for (final seller in sellerRows) {
      if (seller['id'] == sellerId) return '${seller['name']}';
    }
    return 'sem vendedora';
  }

  String get storeName {
    for (final store in storeRows) {
      if (store['id'] == storeId) return '${store['trade_name']}';
    }
    return 'sem loja';
  }

  Set<String> get storeSellerIds => {
    for (final link in links)
      if (link['store_id'] == storeId) link['seller_id'] as String,
  };

  bool get externalStore => storeId != null && storeSellerIds.isEmpty;

  List<Map<String, dynamic>> get visibleSellers {
    if (storeId == null || externalStore) return sellerRows;
    return sellerRows
        .where((seller) => storeSellerIds.contains(seller['id']))
        .toList();
  }

  Future<void> load() async {
    try {
      final result = await Future.wait([
        api.catalogs(),
        api.sellers(),
        api.stores(),
        api.sellerLinks(),
      ]);
      if (!mounted) return;
      setState(() {
        labs = result[0];
        sellerRows = result[1];
        storeRows = result[2];
        links = result[3];
        labId ??= labs.isNotEmpty ? labs.first['id'] as String : null;
        error = null;
      });
      focus.requestFocus();
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    }
  }

  void applyCommand(({String kind, int code}) command) {
    if (command.kind == 'seller') {
      if (command.code == 0) {
        setState(() {
          sellerId = null;
          lotCount = 0;
          hint = 'Lançando sem vendedora.';
        });
        return;
      }
      Map<String, dynamic>? found;
      for (final seller in sellerRows) {
        if ((seller['quick_code'] as num?)?.toInt() == command.code)
          found = seller;
      }
      if (found == null) {
        setState(() => error = 'Nenhuma vendedora com código ${command.code}.');
        return;
      }
      setState(() {
        sellerId = found!['id'] as String;
        lotCount = 0;
        error = null;
        hint = 'Agora lançando para ${found['name']} (v${command.code}).';
      });
      return;
    }
    if (command.code == 0) {
      setState(() {
        storeId = null;
        hint = 'Lançando sem loja.';
      });
      return;
    }
    Map<String, dynamic>? found;
    for (final store in storeRows) {
      if ((store['quick_code'] as num?)?.toInt() == command.code) found = store;
    }
    if (found == null) {
      setState(() => error = 'Nenhuma loja com código ${command.code}.');
      return;
    }
    setState(() {
      storeId = found!['id'] as String;
      if (sellerId != null &&
          !{
            for (final link in links)
              if (link['store_id'] == storeId) link['seller_id'] as String,
          }.contains(sellerId)) {
        sellerId = null;
      }
      hint = 'Agora lançando para ${found['trade_name']} (l${command.code}).';
      error = null;
    });
  }

  Future<void> submitText(String raw) async {
    final command = parseTargetCommand(raw);
    if (command != null) {
      applyCommand(command);
      line.clear();
      focus.requestFocus();
      return;
    }
    final entries = parseQuickBatch(raw);
    if (entries.isEmpty) {
      setState(
        () => error =
            'Digite o número da OS (ex.: 4521) ou v3 / l1 para trocar o lote.',
      );
      return;
    }
    if (labId == null) {
      setState(() => error = 'Escolha o laboratório do lote.');
      return;
    }
    setState(() {
      pending = true;
      error = null;
    });
    var ok = 0;
    String? lastError;
    final dueAt = dueIsoFromHours(dueHours);
    final lensExpectedAt = dateToNoonIso(lensDate);
    for (final entry in entries) {
      try {
        final order = await api.createOrder(
          clientName: quickClientName(entry),
          laboratoryId: labId!,
          sellerId: sellerId,
          storeId: storeId,
          orderRef: entry.orderRef,
          status: status,
          dueAt: dueAt,
          priority: urgent ? 'critica' : 'normal',
          lensExpectedAt: lensExpectedAt,
          lensSupplierRef: lensRef.trim().isEmpty ? null : lensRef.trim(),
        );
        ok += 1;
        lotCount += 1;
        launched.insert(0, {
          'id': order['id'],
          'number': order['number'],
          'orderRef': entry.orderRef,
          'client': quickClientName(entry),
          'lab': labName,
          'seller': sellerName,
          'store': storeName,
        });
      } catch (e) {
        lastError = friendlyError(e);
      }
    }
    if (!mounted) return;
    setState(() {
      pending = false;
      if (ok > 0) line.clear();
      if (lastError != null) error = lastError;
      if (ok > 0) hint = null;
    });
    if (ok > 0 && mounted) {
      HapticFeedback.selectionClick();
      focus.requestFocus();
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('$ok OS lançadas')));
    }
  }

  int get recognized => parseQuickBatch(line.text).length;

  @override
  Widget build(BuildContext context) {
    final ready = !pending && recognized > 0 && labId != null;
    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: EdgeInsets.fromLTRB(
              LaSpace.tela,
              LaSpace.l,
              LaSpace.tela,
              LaSpace.tela,
            ),
            children: [
              SafeArea(
                bottom: false,
                child: Text('Lançar', style: LaType.tituloTela),
              ),
              SizedBox(height: LaSpace.secao),
              TextField(
                controller: line,
                focusNode: focus,
                enabled: !pending,
                minLines: 3,
                maxLines: 6,
                style: LaType.corpoForte.copyWith(fontSize: 19, height: 1.5),
                decoration: InputDecoration(
                  hintText: 'Número, nome ou lista colada',
                  alignLabelWithHint: true,
                  enabledBorder: OutlineInputBorder(
                    borderRadius: LaRadius.rBotao,
                    borderSide: BorderSide(
                      color: LaColors.adapt(context, LaColors.grafite),
                      width: 2,
                    ),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: LaRadius.rBotao,
                    borderSide: BorderSide(
                      color: LaColors.adapt(context, LaColors.grafite),
                      width: 2,
                    ),
                  ),
                ),
                onSubmitted: submitText,
              ),
              SizedBox(height: LaSpace.item),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      recognized == 0
                          ? 'Nenhuma OS reconhecida'
                          : '$recognized OS reconhecidas',
                      style: LaType.rotulo.copyWith(
                        color: recognized == 0
                            ? LaColors.adapt(context, LaColors.regua)
                            : LaColors.adapt(context, LaColors.noPrazo),
                      ),
                    ),
                  ),
                  TextButton(
                    onPressed: line.text.isEmpty ? null : line.clear,
                    child: Text('Limpar'),
                  ),
                ],
              ),
              SizedBox(height: LaSpace.secao),
              Text('Loja', style: LaType.rotulo),
              SizedBox(height: LaSpace.item),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _Pick(
                    label: 'Sem loja',
                    selected: storeId == null,
                    onTap: () => setState(() => storeId = null),
                  ),
                  for (final store in storeRows)
                    _Pick(
                      label: '${store['trade_name']}',
                      selected: storeId == store['id'],
                      onTap: () => setState(() {
                        storeId = store['id'] as String;
                        if (sellerId != null &&
                            !storeSellerIds.contains(sellerId))
                          sellerId = null;
                      }),
                    ),
                ],
              ),
              SizedBox(height: LaSpace.secao),
              Text('Vendedora', style: LaType.rotulo),
              SizedBox(height: LaSpace.item),
              if (externalStore)
                Text(
                  'Esta loja é externa: a OS fica só com a loja.',
                  style: LaType.apoio,
                )
              else
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _Pick(
                      label: 'Sem vendedora',
                      selected: sellerId == null,
                      onTap: () => setState(() => sellerId = null),
                    ),
                    for (final seller in visibleSellers)
                      _Pick(
                        label: '${seller['name']}, v${seller['quick_code']}',
                        selected: sellerId == seller['id'],
                        onTap: () =>
                            setState(() => sellerId = seller['id'] as String),
                      ),
                  ],
                ),
              SizedBox(height: LaSpace.secao),
              Theme(
                data: Theme.of(context)
                    .copyWith(dividerColor: Colors.transparent),
                child: ExpansionTile(
                  tilePadding: EdgeInsets.zero,
                  title: Text('Prazo e lente', style: LaType.corpoForte),
                  children: [
                    Align(
                      alignment: Alignment.centerLeft,
                      child: Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          for (final lab in labs)
                            _Pick(
                              label: '${lab['name']}',
                              selected: labId == lab['id'],
                              onTap: () =>
                                  setState(() => labId = lab['id'] as String),
                            ),
                          for (final option in [
                            (24, '24 h'),
                            (48, '48 h'),
                            (72, '72 h'),
                            (120, '5 dias'),
                            (168, '7 dias'),
                          ])
                            _Pick(
                              label: option.$2,
                              selected: dueHours == option.$1,
                              onTap: () => setState(() => dueHours = option.$1),
                            ),
                          _Pick(
                            label: 'Sem prazo',
                            selected: dueHours == null,
                            onTap: () => setState(() => dueHours = null),
                          ),
                          _Pick(
                            label: 'Aguardar lente',
                            selected: status == 'aguardando_lentes',
                            onTap: () =>
                                setState(() => status = 'aguardando_lentes'),
                          ),
                          _Pick(
                            label: 'Já na bancada',
                            selected: status == 'aguardando_montagem',
                            onTap: () =>
                                setState(() => status = 'aguardando_montagem'),
                          ),
                          _Pick(
                            label: 'Urgente',
                            selected: urgent,
                            onTap: () => setState(() => urgent = !urgent),
                          ),
                        ],
                      ),
                    ),
                    SizedBox(height: LaSpace.item),
                    TextField(
                      decoration: InputDecoration(
                        labelText: 'Previsão da lente (AAAA-MM-DD)',
                      ),
                      onChanged: (value) => lensDate = value.trim(),
                    ),
                    SizedBox(height: LaSpace.item),
                    TextField(
                      decoration: InputDecoration(
                        labelText: 'Nº do pedido no laboratório',
                      ),
                      onChanged: (value) => lensRef = value,
                    ),
                  ],
                ),
              ),
              if (hint != null)
                Padding(
                  padding: EdgeInsets.only(top: LaSpace.item),
                  child: Text(
                    hint!,
                    style: LaType.rotulo.copyWith(color: LaColors.adapt(context, LaColors.noPrazo)),
                  ),
                ),
              if (error != null) ...[
                SizedBox(height: LaSpace.item),
                LaErrorBanner(titulo: 'Lote não lançado', mensagem: error!),
              ],
              if (launched.isNotEmpty) ...[
                SizedBox(height: LaSpace.secao),
                Text('Neste lote', style: LaType.tituloSecao),
                for (final row in launched)
                  Padding(
                    padding: EdgeInsets.only(top: 8),
                    child: Text(
                      '${row['orderRef'] ?? row['number']} · ${row['store']} · ${row['seller']}',
                      style: LaType.corpo,
                    ),
                  ),
              ],
              SizedBox(height: LaSpace.item),
              Text(
                status == 'aguardando_montagem'
                    ? 'As OS entram em Aguardando montagem.'
                    : 'As OS entram em Aguardando lentes.',
                style: LaType.apoio,
              ),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton(
                  onPressed: () => context.push('/os/nova'),
                  child: Text('OS completa'),
                ),
              ),
            ],
          ),
        ),
        Padding(
          padding: EdgeInsets.fromLTRB(
            LaSpace.tela,
            0,
            LaSpace.tela,
            LaSpace.item,
          ),
          child: LaButton(
            label: 'Lançar lote',
            variant: LaButtonVariant.principal,
            height: LaSize.botaoPrincipal,
            loading: pending,
            trailing: Container(
              padding: EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: LaColors.adapt(context, LaColors.grafite),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                '$recognized',
                style: LaType.numeroLista.copyWith(
                  color: LaColors.adapt(context, LaColors.faixa),
                  fontSize: 18,
                ),
              ),
            ),
            onPressed: ready ? () => submitText(line.text) : null,
          ),
        ),
      ],
    );
  }
}

class _Pick extends StatelessWidget {
  const _Pick({
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
      borderRadius: LaRadius.rBotao,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: LaSize.toque),
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            child: Text(
              label,
              style: LaType.rotulo.copyWith(
                color: selected ? LaColors.branco : LaColors.adapt(context, LaColors.grafite),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
