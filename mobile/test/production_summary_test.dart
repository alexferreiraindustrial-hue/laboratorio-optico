import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:oticahub_lab/production_scope.dart';
import 'package:oticahub_lab/production_summary.dart';

void main() {
  final now = DateTime(2026, 11, 22, 12);
  Map<String, dynamic> row(
    String id, {
    String status = 'em_montagem',
    String? seller = 'a',
    int? hours = 48,
    String priority = 'normal',
  }) => {
    'id': id,
    'number': id,
    'client_name': 'Cliente Exemplo',
    'seller_id': seller,
    'seller_name': 'Márcia Exemplo',
    'status': status,
    'priority': priority,
    'due_at': hours == null
        ? null
        : now.add(Duration(hours: hours)).toIso8601String(),
  };
  test('atraso vem antes de crítico, prazo próximo, sem prazo e pronto; entrada não muda', () {
    final rows = [
      row('ready', status: 'pronto', hours: -100),
      row('no-date', hours: null),
      row('normal'),
      row('soon', hours: 8),
      row('critical', hours: 200, priority: 'critica'),
      row('late', hours: -1),
    ];
    expect(selectProduction(rows, now: now).map((r) => r['id']), [
      'late',
      'critical',
      'soon',
      'normal',
      'no-date',
      'ready',
    ]);
    expect(rows.first['id'], 'ready');
  });
  test(
    'filtra por identidade, pesquisa com acentos e separa não atribuídas',
    () {
      final rows = [row('1'), row('2', seller: 'b'), row('3', seller: null)];
      expect(
        selectProduction(rows, sellerId: 'a', now: now).map((r) => r['id']),
        ['1'],
      );
      expect(
        selectProduction(
          rows,
          sellerId: unassignedSeller,
          now: now,
        ).single['id'],
        '3',
      );
      expect(selectProduction(rows, query: 'marcia', now: now), hasLength(3));
    },
  );
  test(
    'pronto com prazo passado não vira atraso; encerrado não entra nos totais',
    () {
      final rows = [
        row('late', hours: -1),
        row('today', hours: 3),
        row('ready', status: 'pronto', hours: -100),
        row('done', status: 'entregue', hours: -1),
      ];
      expect(summarizeProduction(rows, now), (
        total: 3,
        late: 1,
        today: 2,
        ready: 1,
      ));
      expect(selectProduction(rows, attention: true, now: now), hasLength(2));
    },
  );
  test(
    'vendedora nova sem serviços aparece; nomes iguais não misturam contagens',
    () {
      final sellers = [
        {'id': 'a', 'name': 'Nome Exemplo', 'active': true},
        {'id': 'b', 'name': 'Nome Exemplo', 'active': true},
        {'id': 'new', 'name': 'Vendedora Nova', 'active': true},
        {'id': 'old', 'name': 'Histórica', 'active': false},
        {'id': 'hidden', 'name': 'Desativada', 'active': false},
      ];
      final groups = summarizeSellers(
        [
          row('1'),
          row('2', seller: 'b'),
          row('3', seller: 'b'),
          row('4', seller: 'old'),
        ],
        sellers,
        now,
      );
      expect(groups.singleWhere((g) => g.id == 'a').count, 1);
      expect(groups.singleWhere((g) => g.id == 'b').count, 2);
      expect(groups.singleWhere((g) => g.id == 'new').count, 0);
      expect(groups.any((g) => g.id == 'old'), true);
      expect(groups.any((g) => g.id == 'hidden'), false);
    },
  );
  test('sem prazo e limites de prioridade continuam explícitos', () {
    expect(productionSignal(row('none', hours: null), now).label, 'Sem prazo');
    expect(productionSignal(row('now', hours: 0), now).rank, 1);
    expect(productionSignal(row('tomorrow', hours: 24), now).rank, 2);
    expect(productionSignal(row('later', hours: 49), now).rank, 4);
  });
  test('contexto compartilha uma consulta e preserva seleção durante falha de atualização', () async {
    final completer = Completer<List<Map<String, dynamic>>>();
    var calls = 0;
    final scope = ProductionScope(
      sellerLoader: () {
        calls++;
        return calls == 1
            ? completer.future
            : Future.error(StateError('offline'));
      },
    );
    final first = scope.refreshSellers();
    final second = scope.refreshSellers();
    expect(calls, 1);
    completer.complete([
      {'id': 'a', 'name': 'Vendedora Exemplo', 'active': true},
    ]);
    await Future.wait([first, second]);
    scope.select('a');
    await scope.refreshSellers();
    expect(scope.label, 'Vendedora Exemplo');
    expect(scope.error, isNotNull);
    expect(scope.matches(row('other', seller: 'b')), false);
    scope.dispose();
  });
  test('retorno de consulta não notifica escopo descartado e seleção não é persistida entre sessões', () async {
    final completer = Completer<List<Map<String, dynamic>>>();
    final old = ProductionScope(sellerLoader: () => completer.future);
    old.select('a');
    final pending = old.refreshSellers();
    old.dispose();
    completer.complete([]);
    await pending;
    final fresh = ProductionScope(sellerLoader: () async => []);
    expect(fresh.sellerId, isNull);
    fresh.dispose();
  });
}
