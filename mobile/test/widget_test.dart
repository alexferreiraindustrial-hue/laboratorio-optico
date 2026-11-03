import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:oticahub_lab/domain.dart';
import 'package:oticahub_lab/floor_format.dart';
import 'package:oticahub_lab/screens/login_screen.dart';
import 'package:oticahub_lab/session.dart';
import 'package:oticahub_lab/theme.dart';

void main() {
  test('próxima ação da bancada começa a montagem', () {
    final action = nextBenchAction(
      status: 'aguardando_montagem',
      role: 'montador',
      steps: [],
    );
    expect(action.kind, 'status');
    expect(action.to, 'em_montagem');
  });

  test('consulta não avança etapa', () {
    final action = nextBenchAction(
      status: 'em_montagem',
      role: 'consulta',
      steps: [
        {'key': 'conferencia_inicial', 'status': 'pendente'},
      ],
    );
    expect(action.kind, 'none');
  });

  test('atalho v3 e l1 troca o lote', () {
    expect(parseTargetCommand('v3')?.kind, 'seller');
    expect(parseTargetCommand('v3')?.code, 3);
    expect(parseTargetCommand('l1')?.kind, 'store');
    expect(parseTargetCommand('4521'), isNull);
  });

  test('data do laboratório compara com o prazo do cliente', () {
    final agora = DateTime.utc(2026, 11, 3, 15);
    final cedo = acompanharLente(
      dueAt: '2026-11-07T15:00:00Z',
      lensExpectedAt: '2026-11-04T15:00:00Z',
      now: agora,
    );
    expect(cedo.watch, LensWatch.noPrazo);
    final tarde = acompanharLente(
      dueAt: '2026-11-05T15:00:00Z',
      lensExpectedAt: '2026-11-05T12:00:00Z',
      now: agora,
    );
    expect(tarde.watch, LensWatch.estoura);
    final semData = acompanharLente(
      dueAt: '2026-11-10T15:00:00Z',
      lensExpectedAt: null,
      now: agora,
    );
    expect(semData.watch, LensWatch.semPrevisao);
  });

  test('pedido feito depende do número, a casa lê Zeiss e Hoya', () {
    expect(pedidoFeito({'lens_supplier_ref': ' 88321 '}), isTrue);
    expect(pedidoFeito({'lens_supplier_ref': ''}), isFalse);
    expect(
      houseOf({
        'lens_spec': {'supplier_house': 'Roya'},
      }),
      'Hoya',
    );
    expect(
      houseOf({
        'lens_spec': {'supplier_house': 'Zeis'},
      }),
      'Zeiss',
    );
    expect(
      houseOf({
        'lens_spec': {'supplier_house': 'outros'},
      }),
      'Outros',
    );
    expect(ondeEsta({'status': 'em_montagem'}), 'No laboratório. Em montagem');
    expect(
      ondeEsta({'status': 'entregue', 'lens_supplier_ref': '1'}),
      'Já saiu. Entregue',
    );
  });

  test('montador não tira OS de aguardando lentes', () {
    expect(allowedTargets('aguardando_lentes', 'montador'), isEmpty);
    expect(
      allowedTargets('aguardando_lentes', 'gestor'),
      contains('aguardando_montagem'),
    );
  });

  test('lançamento rápido lê número e nome', () {
    final numbered = parseQuickEntry('4521 Maria Souza');
    expect(numbered?.orderRef, '4521');
    expect(numbered?.clientName, 'Maria Souza');
    expect(parseQuickEntry('4521')?.orderRef, '4521');
    expect(parseQuickBatch('4521\n4522').length, 2);
    expect(quickClientName(parseQuickEntry('4521')!), 'OS 4521');
  });

  test('bancada mostra a data prevista de entrega quando existe', () {
    expect(deliveryForecastLabel(null), 'Sem previsão de entrega');
    expect(deliveryForecastLabel(''), 'Sem previsão de entrega');
    expect(
      deliveryForecastLabel('2026-10-31T15:00:00.000Z'),
      startsWith('Previsão '),
    );
  });

  test('número visível prefere a OS da ótica', () {
    expect(
      visibleOrderNumber({
        'number': 'OS-2026-000010',
        'external_order_id': '4521',
      }),
      '4521',
    );
    expect(visibleOrderNumber({'number': 'OS-2026-000010'}), 'OS-2026-000010');
  });

  test('clique da fila só devolve o status pedido', () {
    final rows = onlyQueueStatus([
      {'status': 'aguardando_lentes', 'number': '7'},
      {'status': 'aguardando_montagem', 'number': '3'},
      {'status': 'cancelado', 'number': '9'},
      {'status': 'pronto', 'number': '11'},
    ], 'aguardando_lentes');
    expect(rows.map((row) => row['number']).toList(), ['7']);
  });

  test('todas as OS em andamento não mistura cancelada', () {
    final rows = [
      {
        'status': 'aguardando_lentes',
        'number': '1',
        'store_name': 'Lorena',
        'seller_name': 'Lana',
      },
      {
        'status': 'cancelado',
        'number': '2',
        'store_name': 'Lorena',
        'seller_name': 'Lana',
      },
      {
        'status': 'em_montagem',
        'number': '3',
        'store_name': 'Pinda',
        'seller_name': 'Miriele',
      },
    ];
    expect(
      filterOrderList(
        rows,
        tab: 'andamento',
      ).map((row) => row['number']).toList(),
      ['1', '3'],
    );
    expect(
      filterOrderList(
        rows,
        tab: 'encerradas',
      ).map((row) => row['number']).toList(),
      ['2'],
    );
    final grouped = groupByStatusThenStoreThenSeller(rows);
    expect(grouped.map((item) => item.$1).toList(), [
      'aguardando_lentes',
      'em_montagem',
      'cancelado',
    ]);
  });

  test('aguardando lentes ignora cancelada e entregue', () {
    final kept = onlyQueueStatus([
      {'status': 'aguardando_lentes', 'number': '1'},
      {'status': 'cancelado', 'number': '2'},
      {'status': 'entregue', 'number': '3'},
      {'status': 'em_montagem', 'number': '4'},
    ], 'aguardando_lentes');
    expect(kept.map((row) => row['number']).toList(), ['1']);
  });

  test('fila agrupa loja depois vendedora e marca atraso', () {
    final now = DateTime.utc(2026, 10, 30, 12);
    expect(
      orderUrgency(
        status: 'aguardando_lentes',
        dueAt: '2026-10-29T12:00:00Z',
        now: now,
      ),
      'vermelho',
    );
    expect(
      orderUrgency(
        status: 'aguardando_lentes',
        dueAt: '2026-10-30T18:00:00Z',
        now: now,
      ),
      'amarelo',
    );
    final groups = groupByStoreThenSeller([
      {
        'store_name': 'Lorena',
        'seller_name': 'Miriele',
        'status': 'aguardando_lentes',
        'due_at': '2026-11-04T12:00:00Z',
      },
      {
        'store_name': 'Lorena',
        'seller_name': 'Lana',
        'status': 'aguardando_lentes',
        'due_at': '2026-10-20T12:00:00Z',
      },
      {
        'store_name': 'Pinda',
        'seller_name': 'Miriele',
        'status': 'aguardando_lentes',
        'due_at': '2026-11-04T12:00:00Z',
      },
    ]);
    expect(groups.length, 2);
    expect(groups[0].$1, 'Lorena');
    expect(groups[0].$2.map((item) => item.$1).toList(), ['Lana', 'Miriele']);
  });

  test('fila agrupa pelo laboratório pedido', () {
    final groups = groupByLaboratory([
      {'number': '1', 'laboratory_name': 'ZEISS'},
      {'number': '2', 'laboratory_name': 'ZEISS'},
      {'number': '3', 'laboratory_name': 'Mireeli'},
    ]);
    expect(groups.length, 2);
    expect(groups[0].$1, 'ZEISS');
    expect(groups[0].$2.length, 2);
    expect(groups[1].$1, 'Mireeli');
  });

  test('link do vendedor extrai token do PWA', () {
    expect(
      parsePortalLogin(
        'https://lab.oticahub.com/acompanhar/vendedor/abcDef1234567890tokenXX',
      )?.kind,
      'vendedor',
    );
    expect(parsePortalLogin('not-a-link'), isNull);
  });

  test('visão do vendedor separa pronta, produção e encerrada', () {
    final rows = [
      {
        'status': 'pronto',
        'number': '1',
        'client_name': 'Ana',
        'due_at': '2026-10-20T12:00:00Z',
      },
      {
        'status': 'em_montagem',
        'number': '2',
        'client_name': 'Bia',
        'due_at': '2026-11-20T12:00:00Z',
      },
      {
        'status': 'entregue',
        'number': '3',
        'client_name': 'Ana',
        'due_at': '2026-10-01T12:00:00Z',
      },
      {
        'status': 'cancelado',
        'number': '4',
        'client_name': 'Cris',
        'due_at': null,
      },
    ];
    expect(
      filterSellerOrders(
        rows,
        SellerFilter.ready,
        '',
      ).map((row) => row['number']).toList(),
      ['1'],
    );
    expect(
      filterSellerOrders(
        rows,
        SellerFilter.production,
        '',
      ).map((row) => row['number']).toList(),
      ['2'],
    );
    expect(
      filterSellerOrders(
        rows,
        SellerFilter.closed,
        '',
      ).map((row) => row['number']).toList(),
      ['3', '4'],
    );
    expect(
      filterSellerOrders(
        rows,
        SellerFilter.all,
        'ana',
      ).map((row) => row['number']).toList(),
      ['1', '3'],
    );
  });

  testWidgets('tela de login pede e-mail e senha', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: labTheme(),
        home: LoginScreen(session: Session()),
      ),
    );
    expect(find.text('Entrar'), findsWidgets);
  });
}
