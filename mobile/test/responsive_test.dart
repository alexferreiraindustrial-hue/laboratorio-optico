import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:oticahub_lab/design/la_design.dart';
import 'package:oticahub_lab/screens/login_screen.dart';
import 'package:oticahub_lab/session.dart';
import 'package:oticahub_lab/theme.dart';

void main() {
  Future<void> frame(WidgetTester tester, Size size, double scale, Widget child, {double keyboard = 0}) async {
    tester.view.physicalSize = size;
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(MaterialApp(theme: labTheme(), builder: (context, child) => MediaQuery(
      data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(scale), viewInsets: EdgeInsets.only(bottom: keyboard)), child: child!), home: child));
    await tester.pumpAndSettle();
  }

  for (final scenario in [
    (const Size(320, 640), 1.0, 0.0),
    (const Size(360, 800), 1.8, 280.0),
    (const Size(760, 360), 1.3, 160.0),
    (const Size(1024, 768), 1.5, 0.0),
  ]) {
    testWidgets('login acessível em ${scenario.$1}, fonte ${scenario.$2}, teclado ${scenario.$3}', (tester) async {
      await frame(tester, scenario.$1, scenario.$2, LoginScreen(session: Session()), keyboard: scenario.$3);
      expect(tester.takeException(), isNull);
      await tester.ensureVisible(find.text('Entrar').last);
      expect(tester.takeException(), isNull);
      await tester.ensureVisible(find.text('Vendedor'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Vendedor'));
      await tester.pumpAndSettle();
      expect(find.text('PIN'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('cartão mantém OS longa, cliente e dois alertas com fonte ampliada', (tester) async {
    await frame(tester, const Size(320, 900), 1.8, Scaffold(body: SingleChildScrollView(child: Padding(padding: const EdgeInsets.all(16), child: LaOsCard(
      numero: 'OS-2026-123456789012345', cliente: 'Cliente com nome completo muito longo para a bancada', detalhe: 'Loja Centro · Vendedora com nome completo', acaoLabel: 'Concluir conferência de qualidade', urgente: true, emCorrecao: true, onAcao: () {}, onAbrir: () {},
    )))));
    expect(tester.takeException(), isNull);
    expect(find.text('Urgente'), findsOneWidget);
    expect(find.text('Em correção'), findsOneWidget);
  });

  testWidgets('comandos e abas continuam acessíveis em 320px', (tester) async {
    await frame(tester, const Size(320, 900), 1.8, Scaffold(
      body: SingleChildScrollView(child: LaCommandPlate(onLancarOs: () {}, onOsCompleta: () {}, onRotina: () {}, onConfigurarRotina: () {})),
      bottomNavigationBar: LaTabBar(currentIndex: 2, onTap: (_) {}),
    ));
    expect(tester.takeException(), isNull);
    expect(find.text('Entrada rápida'), findsOneWidget);
  });

  testWidgets('grade expande altura ao ampliar a fonte', (tester) async {
    await frame(tester, const Size(320, 900), 2, Scaffold(body: SingleChildScrollView(child: LaAdaptiveGrid(minWidth: 150, children: [
      for (var i = 0; i < 4; i++) Card(child: Padding(padding: const EdgeInsets.all(12), child: Text('Conferência de qualidade · 123 OS', style: LaType.corpo))),
    ]))));
    expect(tester.takeException(), isNull);
  });
}
