import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:oticahub_lab/design/la_design.dart';
import 'package:oticahub_lab/overview_content.dart';
import 'package:oticahub_lab/production_scope.dart';
import 'package:oticahub_lab/production_widgets.dart';
import 'package:oticahub_lab/theme.dart';

void main() {
  final now = DateTime(2026, 11, 22, 12);
  final sellers = [
    {'id': 'a', 'name': 'Vendedora Exemplo A', 'active': true},
    {'id': 'b', 'name': 'Vendedora Exemplo B', 'active': true},
    {'id': 'new', 'name': 'Vendedora Nova', 'active': true},
  ];
  final orders = [
    {
      'id': 'one',
      'number': '123',
      'client_name': 'Cliente prioritário',
      'seller_id': 'a',
      'seller_name': 'Vendedora Exemplo A',
      'status': 'em_montagem',
      'due_at': now.subtract(const Duration(hours: 1)).toIso8601String(),
    },
    {
      'id': 'two',
      'number': '456',
      'client_name': 'Cliente para retirada',
      'seller_id': 'b',
      'seller_name': 'Vendedora Exemplo B',
      'status': 'pronto',
      'due_at': now.toIso8601String(),
    },
  ];
  Future<ProductionScope> scope() async {
    final value = ProductionScope(sellerLoader: () async => sellers);
    await value.refreshSellers();
    addTearDown(value.dispose);
    return value;
  }

  for (final scenario in [
    (320.0, 1.0, true),
    (320.0, 1.8, true),
    (390.0, 1.0, false),
    (840.0, 1.5, true),
  ])
    testWidgets(
      'visão geral sem overflow em ${scenario.$1}, fonte ${scenario.$2}, escuro ${scenario.$3}',
      (tester) async {
        tester.view.physicalSize = Size(scenario.$1, 960);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        final filter = await scope();
        await tester.pumpWidget(
          MaterialApp(
            theme: labTheme(dark: scenario.$3),
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(context)
                  .copyWith(textScaler: TextScaler.linear(scenario.$2)),
              child: child!,
            ),
            home: Scaffold(
              bottomNavigationBar: scenario.$1 < 720
                  ? LaTabBar(currentIndex: 0, onTap: (_) {})
                  : null,
              body: SingleChildScrollView(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: OverviewContent(
                    orders: orders,
                    scope: filter,
                    now: now,
                    onOrder: (_) {},
                    onStage: (_) {},
                    onAll: (_, __) {},
                  ),
                ),
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(find.text('Em acompanhamento'), findsOneWidget);
        expect(tester.takeException(), isNull);
        await tester.ensureVisible(find.text('Vendedoras'));
        await tester.tap(find.text('Vendedoras'));
        await tester.pumpAndSettle();
        expect(find.text('Vendedora Nova'), findsOneWidget);
        expect(tester.takeException(), isNull);
      },
    );
  testWidgets(
    'seleção por vendedora atualiza contagens e lista sem misturar outras pessoas',
    (tester) async {
      tester.view.physicalSize = const Size(390, 1500);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final filter = await scope();
      String? clicked;
      await tester.pumpWidget(
        MaterialApp(
          theme: labTheme(dark: true),
          home: Scaffold(
            body: SingleChildScrollView(
              child: OverviewContent(
                orders: orders,
                scope: filter,
                now: now,
                onOrder: (id) => clicked = id,
                onStage: (_) {},
                onAll: (_, __) {},
              ),
            ),
          ),
        ),
      );
      filter.select('b');
      await tester.pumpAndSettle();
      expect(find.text('Cliente prioritário'), findsNothing);
      expect(find.text('Cliente para retirada'), findsOneWidget);
      await tester.tap(find.text('Cliente para retirada'));
      expect(clicked, 'two');
      filter.select('new');
      await tester.pumpAndSettle();
      expect(
        find.text('Nenhum serviço em andamento neste filtro.'),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets('três seletores usam o mesmo contexto e limpeza afeta todos', (
    tester,
  ) async {
    final filter = await scope();
    await tester.pumpWidget(
      MaterialApp(
        theme: labTheme(dark: true),
        home: Scaffold(
          body: Column(
            children: [
              SellerPicker(scope: filter),
              SellerPicker(scope: filter),
              SellerPicker(scope: filter),
            ],
          ),
        ),
      ),
    );
    filter.select('a');
    await tester.pumpAndSettle();
    expect(find.byTooltip('Limpar filtro de vendedora'), findsNWidgets(3));
    await tester.tap(find.byTooltip('Limpar filtro de vendedora').first);
    await tester.pumpAndSettle();
    expect(filter.sellerId, isNull);
    expect(find.byTooltip('Limpar filtro de vendedora'), findsNothing);
    expect(tester.takeException(), isNull);
  });
}
