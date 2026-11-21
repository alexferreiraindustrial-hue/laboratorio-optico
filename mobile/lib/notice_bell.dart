import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'design/la_design.dart';
import 'domain.dart';
import 'floor_format.dart';
import 'lab_api.dart';

/// Sino do painel: atrasos em aberto e recados do vendedor.
class NoticeBell extends StatefulWidget {
  const NoticeBell({super.key});

  @override
  State<NoticeBell> createState() => _NoticeBellState();
}

class _NoticeBellState extends State<NoticeBell> {
  final api = LabApi();
  List<Map<String, dynamic>> lateOrders = [];
  List<Map<String, dynamic>> notes = [];

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final next = await api.dayNotices();
      if (!mounted) return;
      setState(() {
        lateOrders = next.lateOrders;
        notes = next.notes;
      });
    } catch (_) {}
  }

  int get total => lateOrders.length + notes.length;

  Future<void> open() async {
    await load();
    if (!mounted) return;
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: LaColors.surface(context),
      isScrollControlled: true,
      shape: RoundedRectangleBorder(borderRadius: LaRadius.rFolhaTopo),
      builder: (context) => _NoticeSheet(lateOrders: lateOrders, notes: notes),
    );
  }

  @override
  Widget build(BuildContext context) {
    final label = total == 0
        ? 'Avisos. Nenhum atraso ou recado novo.'
        : 'Avisos. $total';
    return Semantics(
      button: true,
      label: label,
      child: InkWell(
        onTap: open,
        customBorder: CircleBorder(),
        child: SizedBox(
          width: LaSize.toque,
          height: LaSize.toque,
          child: Stack(
            alignment: Alignment.center,
            children: [
              Icon(Icons.notifications_outlined, color: LaColors.adapt(context, LaColors.grafite)),
              if (total > 0)
                Positioned(
                  right: 6,
                  top: 6,
                  child: Container(
                    padding: EdgeInsets.symmetric(
                      horizontal: 5,
                      vertical: 1,
                    ),
                    decoration: BoxDecoration(
                      color: LaColors.adapt(context, LaColors.perigo),
                      borderRadius: LaRadius.rChip,
                    ),
                    child: Text(
                      total > 9 ? '9+' : '$total',
                      style: LaType.rotulo.copyWith(
                        color: LaColors.branco,
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NoticeSheet extends StatelessWidget {
  const _NoticeSheet({required this.lateOrders, required this.notes});

  final List<Map<String, dynamic>> lateOrders;
  final List<Map<String, dynamic>> notes;

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    final height = MediaQuery.sizeOf(context).height;
    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: height * 0.86),
      child: ListView(
        padding: EdgeInsets.fromLTRB(
          LaSpace.tela,
          LaSpace.l,
          LaSpace.tela,
          LaSpace.xl + bottom,
        ),
        children: [
          Text('Avisos', style: LaType.tituloSecao),
          SizedBox(height: LaSpace.secao),
          Text('Atrasos', style: LaType.rotulo),
          SizedBox(height: LaSpace.s),
          if (lateOrders.isEmpty)
            Text('Nenhuma OS atrasada.', style: LaType.apoio)
          else
            for (final row in lateOrders.take(8))
              _NoticeRow(
                titulo: visibleOrderNumber(row),
                detalhe: '${row['client_name'] ?? ''} · ${prazoCurto(row)}',
                onTap: () {
                  Navigator.pop(context);
                  context.push('/os/${row['id']}');
                },
              ),
          SizedBox(height: LaSpace.secao),
          Text('Recados do vendedor', style: LaType.rotulo),
          SizedBox(height: LaSpace.s),
          if (notes.isEmpty)
            Text('Nenhum recado novo.', style: LaType.apoio)
          else
            for (final row in notes.take(8))
              _NoticeRow(
                titulo: '${row['sender_label'] ?? 'Vendedor'}',
                detalhe: '${row['body'] ?? ''}',
                onTap: () {
                  Navigator.pop(context);
                  context.push('/os/${row['order_id']}');
                },
              ),
        ],
      ),
    );
  }
}

class _NoticeRow extends StatelessWidget {
  const _NoticeRow({
    required this.titulo,
    required this.detalhe,
    required this.onTap,
  });

  final String titulo;
  final String detalhe;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: ConstrainedBox(
        constraints: BoxConstraints(minHeight: LaSize.toque),
        child: Padding(
          padding: EdgeInsets.symmetric(vertical: 6),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                titulo,
                style: LaType.corpo.copyWith(fontWeight: FontWeight.w700),
              ),
              Text(
                detalhe,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: LaType.apoio,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
