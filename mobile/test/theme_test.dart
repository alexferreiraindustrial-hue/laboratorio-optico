import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:oticahub_lab/design/la_design.dart';
import 'package:oticahub_lab/theme.dart';
import 'package:oticahub_lab/theme_preference.dart';
import 'package:oticahub_lab/screens/login_screen.dart';
import 'package:oticahub_lab/session.dart';

double contrast(Color a, Color b) {
  final x = a.computeLuminance();
  final y = b.computeLuminance();
  return ((x > y ? x : y) + .05) / ((x > y ? y : x) + .05);
}

void main() {
  test('preferência de tema persiste e não usa sessão', () async {
    SharedPreferences.setMockInitialValues({});
    final first = ThemePreference();
    await first.load();
    expect(first.dark, true);
    await first.toggle();
    final second = ThemePreference();
    await second.load();
    expect(second.dark, false);
    await second.toggle();
    expect(second.dark, true);
    first.dispose();
    second.dispose();
  });
  test('escolha clara existente permanece preservada', () async {
    SharedPreferences.setMockInitialValues({'lab_gold_dark': false});
    final pref = ThemePreference();
    await pref.load();
    expect(pref.dark, false);
    pref.dispose();
  });
  test('ouro mantém contraste AA nos botões', () {
    final scheme = labTheme(dark: true).colorScheme;
    expect(
      contrast(scheme.primary, scheme.onPrimary),
      greaterThanOrEqualTo(4.5),
    );
    expect(scheme.primary, const Color(0xFFF5B53D));
  });
  test('etiquetas selecionadas preservam contraste AA nos dois temas', () {
    for (final dark in [false, true]) {
      final theme = labTheme(dark: dark);
      final foreground = WidgetStateProperty.resolveAs<Color>(
        theme.chipTheme.labelStyle!.color!,
        {WidgetState.selected},
      );
      expect(
        contrast(foreground, theme.chipTheme.selectedColor!),
        greaterThanOrEqualTo(4.5),
      );
    }
  });
  for (final dark in [false, true]) {
    testWidgets('tema $dark mantém texto, controles e alertas legíveis', (
      tester,
    ) async {
      final theme = labTheme(dark: dark);
      expect(
        contrast(theme.colorScheme.onSurface, theme.colorScheme.surface),
        greaterThanOrEqualTo(4.5),
      );
      expect(
        contrast(theme.colorScheme.onPrimary, theme.colorScheme.primary),
        greaterThanOrEqualTo(4.5),
      );
      await tester.pumpWidget(
        MaterialApp(
          theme: theme,
          home: Scaffold(
            body: Builder(
              builder: (context) {
                for (final color in [
                  LaColors.regua,
                  LaColors.perigo,
                  LaColors.alerta,
                  LaColors.noPrazo,
                ]) {
                  expect(
                    contrast(
                      LaColors.adapt(context, color),
                      theme.colorScheme.surface,
                    ),
                    greaterThanOrEqualTo(4.5),
                  );
                }
                return Column(
                  children: [
                    Text('Texto principal', style: LaType.corpo),
                    TextField(
                      decoration: const InputDecoration(
                        labelText: 'Número da OS',
                        hintText: 'Ex.: 123',
                      ),
                    ),
                    LaBadge.emCorrecao(),
                    LaButton(label: 'Salvar OS', onPressed: () {}),
                  ],
                );
              },
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
    testWidgets('login vendedor no tema $dark aceita letras e mantém campos', (
      tester,
    ) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: labTheme(dark: dark),
          home: LoginScreen(session: Session()..lastAccessKind = 'vendedor'),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Senha do vendedor'), findsOneWidget);
      final password = find.byWidgetPredicate(
        (widget) =>
            widget is TextField &&
            widget.decoration?.labelText == 'Senha do vendedor',
      );
      await tester.enterText(password, 'Lentes2026');
      expect(
        (tester.widget(password) as TextField).controller!.text,
        'Lentes2026',
      );
      expect(tester.takeException(), isNull);
    });
  }
}
