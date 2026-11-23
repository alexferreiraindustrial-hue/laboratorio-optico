import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:oticahub_lab/domain.dart';
import 'package:oticahub_lab/design/la_design.dart';
import 'package:oticahub_lab/theme.dart';
import 'package:oticahub_lab/order_followup.dart';

void main() {
  final complete = [
    for (final key in stepKeys) {'key': key, 'status': 'concluida'},
  ];
  test('somente serviços marcados passam pelo médico; consulta não movimenta e correção retoma montagem', () {
    expect(
      nextBenchAction(
        status: 'em_montagem',
        role: 'montador',
        steps: complete,
      ).to,
      'pronto',
    );
    expect(
      nextBenchAction(
        status: 'em_montagem',
        role: 'montador',
        steps: complete,
        medicalRequired: true,
      ).to,
      'em_conferencia',
    );
    expect(
      nextBenchAction(
        status: 'em_conferencia',
        role: 'montador',
        steps: complete,
        medicalRequired: true,
      ).kind,
      'none',
    );
    expect(
      nextBenchAction(
        status: 'aguardando_montagem',
        role: 'consulta',
        steps: [],
      ).kind,
      'none',
    );
    expect(
      nextBenchAction(status: 'em_correcao', role: 'montador', steps: []).to,
      'em_montagem',
    );
  });
  for (final dark in [true, false])
    testWidgets('cartão compacto expande processos em tema $dark', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(320, 900);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(
        MaterialApp(
          theme: labTheme(dark: dark),
          home: Scaffold(
            body: SingleChildScrollView(
              child: LaOsCard(
                numero: '12345',
                cliente: 'Cliente da bancada',
                detalhe: 'Loja Exemplo · Vendedora Exemplo',
                prazo: 'Faltam 20h',
                medical: true,
                acaoLabel: 'Iniciar conferência',
                onAcao: () {},
                onAbrir: () {},
              ),
            ),
          ),
        ),
      );
      expect(find.text('Cliente da bancada'), findsOneWidget);
      expect(find.text('Iniciar conferência').hitTestable(), findsNothing);
      await tester.tap(find.text('Cliente da bancada'));
      await tester.pumpAndSettle();
      expect(find.text('Iniciar conferência').hitTestable(), findsOneWidget);
      expect(find.text('Processos, fotos e histórico'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  testWidgets('consulta vê indicação médica sem botão de liberação', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: labTheme(dark: true),
        home: Scaffold(
          body: OrderFollowup(
            order: {
              'id': 'test',
              'status': 'em_conferencia',
              'medical_review_required': true,
            },
            editable: false,
            onChanged: () async {},
          ),
        ),
      ),
    );
    expect(
      find.text('Não avisar como pronto nem entregar antes do retorno médico.'),
      findsOneWidget,
    );
    expect(find.text('Confirmar retorno médico e liberar'), findsNothing);
    expect(tester.takeException(), isNull);
  });
}
