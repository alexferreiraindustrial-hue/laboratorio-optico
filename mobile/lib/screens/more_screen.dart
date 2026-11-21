import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../design/la_design.dart';
import '../domain.dart';
import '../floor_format.dart';
import '../session.dart';

class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key, required this.session});
  final Session session;

  @override
  Widget build(BuildContext context) {
    final name = session.profile?.fullName ?? 'Laboratório';
    final role = session.profile?.role ?? '';
    final full = canManage(role);
    final assembler = role == 'montador';
    return ListView(
      padding: EdgeInsets.fromLTRB(
        LaSpace.tela,
        LaSpace.l,
        LaSpace.tela,
        LaSpace.xxl,
      ),
      children: [
        SafeArea(bottom: false, child: Text('Mais', style: LaType.tituloTela)),
        SizedBox(height: LaSpace.secao),
        Material(
          color: LaColors.surface(context),
          borderRadius: LaRadius.rCartao,
          child: Padding(
            padding: EdgeInsets.all(LaSpace.interno),
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
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name,
                        style: LaType.corpoForte,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      Text(roleLabel[role] ?? role, style: LaType.apoio),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        SizedBox(height: LaSpace.secao),
        LaButton(
          label: 'Rotina do dia',
          variant: LaButtonVariant.principal,
          leading: Icon(Icons.checklist, color: LaColors.adapt(context, LaColors.grafite)),
          onPressed: () => context.push('/rotina'),
        ),
        SizedBox(height: LaSpace.secao),
        _grupo(context, '1 Entrada', [
          _item(
            context,
            'Lançar OS',
            'Lote rápido das OS que chegaram.',
            '/lancar',
            go: true,
          ),
          _item(
            context,
            'OS completa',
            'Cliente, receita, prazo e prioridade.',
            '/os/nova',
          ),
          _item(
            context,
            'Todas as OS',
            'Em andamento, prontas e encerradas.',
            '/os',
          ),
        ]),
        _grupo(context, '2 Lentes', [
          _item(
            context,
            'Lentes a chegar',
            'Fila aguardando lentes.',
            '/lentes',
            go: true,
          ),
          _item(
            context,
            'Estoque de lentes',
            'Grau, lote, entrada e consumo.',
            '/estoque',
          ),
        ]),
        _grupo(context, '3 Montagem', [
          _item(
            context,
            'Bancada',
            'Passos da montagem.',
            '/bancada',
            go: true,
          ),
          _item(
            context,
            'Assistência · BO',
            'Decidir ocorrência na bancada.',
            '/assistencia',
          ),
        ]),
        _grupo(context, '4 Saída', [
          _item(context, 'Entrega', 'OS prontas para o vendedor.', '/entrega'),
        ]),
        if (full || assembler)
          _grupo(context, 'Equipe', [
            if (full)
              _item(
                context,
                'Lojas',
                'Cadastro, edição e desativação.',
                '/lojas',
              ),
            if (full)
              _item(
                context,
                'Vendedores',
                'Cadastro, lojas e desativação.',
                '/vendedores',
              ),
            _item(context, 'Recados', 'Mensagens da loja na OS.', '/recados'),
            _item(context, 'Ranking', 'OS prontas no mês.', '/ranking'),
          ]),
        if (full || assembler)
          _grupo(context, 'Gestão', [
            _item(context, 'Kaizen', 'Ideias de melhoria.', '/kaizen'),
            if (full)
              _item(
                context,
                'Indicadores',
                'WIP, OTD e ocorrências.',
                '/indicadores',
              ),
            if (full)
              _item(
                context,
                'Auditoria 5S',
                'Notas por senso e histórico.',
                '/auditoria-5s',
              ),
            if (full)
              _item(
                context,
                'Relatórios',
                'Fila, estoque e BO.',
                '/relatorios',
              ),
            if (full)
              _item(
                context,
                'Configurações',
                'Usuários, laboratórios e metas.',
                '/configuracoes',
              ),
          ]),
        SizedBox(height: LaSpace.xxl),
        LaButton(
          label: 'Sair',
          variant: LaButtonVariant.perigo,
          leading: Icon(Icons.logout, color: LaColors.adapt(context, LaColors.perigo)),
          onPressed: session.signOut,
        ),
      ],
    );
  }

  Widget _grupo(BuildContext context, String title, List<Widget> items) {
    return Padding(
      padding: EdgeInsets.only(top: LaSpace.secao),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: LaType.tituloSecao),
          SizedBox(height: LaSpace.item),
          ...items,
        ],
      ),
    );
  }

  Widget _item(
    BuildContext context,
    String title,
    String subtitle,
    String path, {
    bool go = false,
  }) {
    return Padding(
      padding: EdgeInsets.only(bottom: LaSpace.item),
      child: Material(
        color: LaColors.surface(context),
        borderRadius: LaRadius.rCartao,
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => go ? context.go(path) : context.push(path),
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: LaSize.toque + 16),
            child: Padding(
              padding: EdgeInsets.symmetric(
                horizontal: LaSpace.interno,
                vertical: 10,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(title, style: LaType.corpoForte),
                        Text(subtitle, style: LaType.apoio),
                      ],
                    ),
                  ),
                  Icon(Icons.chevron_right, color: LaColors.adapt(context, LaColors.regua)),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
