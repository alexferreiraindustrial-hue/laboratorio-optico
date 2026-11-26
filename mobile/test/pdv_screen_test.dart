import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:oticahub_lab/screens/pdv_screen.dart';
import 'package:oticahub_lab/session.dart';
import 'package:oticahub_lab/theme.dart';

void main() {
  for (final scenario in [
    (const Size(320, 640), 1.0),
    (const Size(360, 800), 1.6),
    (const Size(800, 1280), 1.3),
    (const Size(1280, 800), 1.0),
  ]) {
    testWidgets('PDV sem estouro em ${scenario.$1}, fonte ${scenario.$2}', (tester) async {
      tester.view.physicalSize = scenario.$1;
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final session = Session()..profile = Profile(id: 'u', fullName: 'Teste', role: 'admin', active: true);
      await tester.pumpWidget(
        MaterialApp(
          theme: labTheme(),
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(scenario.$2)),
            child: child!,
          ),
          home: PdvScreen(session: session),
        ),
      );
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text('Aguardando bipe'), findsOneWidget);
      expect(find.text('Ficou pronto'), findsWidgets);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    });
  }
}
