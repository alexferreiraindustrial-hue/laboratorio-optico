// Lab Gold: ThemeData do app.
import 'package:flutter/material.dart';

import 'la_tokens.dart';

ThemeData laTheme({Brightness brightness = Brightness.light}) {
  final dark = brightness == Brightness.dark;
  Color tone(Color color) => LaColors.forBrightness(brightness, color);
  final surface = dark ? Color(0xFF131210) : LaColors.branco;
  final scheme = ColorScheme(
    brightness: brightness,
    primary: dark ? const Color(0xFFF5B53D) : LaColors.acento,
    onPrimary: dark ? const Color(0xFF1A1205) : LaColors.branco,
    secondary: dark ? const Color(0xFFF5C15A) : LaColors.faixa,
    onSurfaceVariant: tone(LaColors.regua),
    onSecondary: LaColors.branco,
    error: tone(LaColors.perigo),
    onError: LaColors.branco,
    surface: surface,
    onSurface: tone(LaColors.grafite),
    outline: tone(LaColors.borda),
  );

  final base = ThemeData(useMaterial3: true, colorScheme: scheme);
  final text = base.textTheme.apply(
    fontFamily: 'PlusJakartaSans',
    bodyColor: tone(LaColors.grafite),
    displayColor: tone(LaColors.grafite),
  );

  OutlineInputBorder borda(Color c, double w) => OutlineInputBorder(
    borderRadius: LaRadius.rBotao,
    borderSide: BorderSide(color: c, width: w),
  );

  return base.copyWith(
    scaffoldBackgroundColor: tone(LaColors.piso),
    textTheme: text,
    materialTapTargetSize: MaterialTapTargetSize.padded,
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: Size(48, 48),
        padding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        shape: RoundedRectangleBorder(borderRadius: LaRadius.rBotao),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: Size(48, 48),
        padding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        shape: RoundedRectangleBorder(borderRadius: LaRadius.rBotao),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: tone(LaColors.acento),
        minimumSize: Size(48, 48),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: surface,
      indicatorColor: dark
          ? const Color(0xFFF5B53D)
          : tone(LaColors.acentoSuave),
      indicatorShape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
      ),
      labelTextStyle: WidgetStatePropertyAll(
        LaType.aba.copyWith(color: tone(LaColors.grafite)),
      ),
      elevation: 0,
    ),
    cardTheme: CardThemeData(
      color: surface,
      elevation: 0,
      margin: const EdgeInsets.symmetric(vertical: 5),
      shape: RoundedRectangleBorder(
        borderRadius: LaRadius.rCartao,
        side: BorderSide(color: tone(LaColors.borda)),
      ),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: surface,
      side: BorderSide(color: tone(LaColors.borda)),
      labelStyle: text.labelMedium,
    ),
    expansionTileTheme: ExpansionTileThemeData(
      textColor: tone(LaColors.grafite),
      collapsedTextColor: tone(LaColors.grafite),
      iconColor: tone(LaColors.acento),
      collapsedIconColor: tone(LaColors.regua),
    ),
    splashFactory: InkRipple.splashFactory,
    appBarTheme: AppBarTheme(
      backgroundColor: tone(LaColors.piso),
      foregroundColor: tone(LaColors.grafite),
      elevation: 0,
      scrolledUnderElevation: 0,
      titleTextStyle: LaType.corpoForte,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: surface,
      contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      labelStyle: LaType.rotulo,
      floatingLabelBehavior: FloatingLabelBehavior.always,
      hintStyle: LaType.corpo.copyWith(color: tone(LaColors.regua)),
      errorStyle: LaType.rotulo.copyWith(color: tone(LaColors.perigo)),
      enabledBorder: borda(tone(LaColors.borda), 1.5),
      focusedBorder: borda(tone(LaColors.acento), 2),
      errorBorder: borda(tone(LaColors.perigo), 2),
      focusedErrorBorder: borda(tone(LaColors.perigo), 2),
      disabledBorder: borda(tone(LaColors.filete), 1.5),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: LaColors.grafite,
      contentTextStyle: LaType.corpo.copyWith(color: LaColors.branco),
      actionTextColor: LaColors.faixa,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: LaRadius.rBotao),
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(
      color: tone(LaColors.grafite),
    ),
    dividerTheme: DividerThemeData(
      color: tone(LaColors.linha),
      thickness: 1,
      space: 1,
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: surface,
      shape: RoundedRectangleBorder(borderRadius: LaRadius.rFolhaTopo),
    ),
  );
}
