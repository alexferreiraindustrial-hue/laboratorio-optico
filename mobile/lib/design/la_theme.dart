// Laboratório ALEX: ThemeData do app.
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'la_tokens.dart';

ThemeData laTheme() {
  const scheme = ColorScheme.light(
    primary: LaColors.grafite,
    onPrimary: LaColors.branco,
    secondary: LaColors.faixa,
    onSecondary: LaColors.grafite,
    error: LaColors.perigo,
    onError: LaColors.branco,
    surface: LaColors.branco,
    onSurface: LaColors.grafite,
    outline: LaColors.borda,
  );

  final base = ThemeData(useMaterial3: true, colorScheme: scheme);
  final text = GoogleFonts.barlowTextTheme(base.textTheme).apply(
    bodyColor: LaColors.grafite,
    displayColor: LaColors.grafite,
  );

  OutlineInputBorder borda(Color c, double w) =>
      OutlineInputBorder(borderRadius: LaRadius.rBotao, borderSide: BorderSide(color: c, width: w));

  return base.copyWith(
    scaffoldBackgroundColor: LaColors.piso,
    textTheme: text,
    splashFactory: InkRipple.splashFactory,
    appBarTheme: AppBarTheme(
      backgroundColor: LaColors.piso,
      foregroundColor: LaColors.grafite,
      elevation: 0,
      scrolledUnderElevation: 0,
      titleTextStyle: LaType.corpoForte,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: LaColors.branco,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      labelStyle: LaType.rotulo,
      floatingLabelBehavior: FloatingLabelBehavior.always,
      hintStyle: LaType.corpo.copyWith(color: LaColors.regua),
      errorStyle: LaType.rotulo.copyWith(color: LaColors.perigo),
      enabledBorder: borda(LaColors.borda, 1.5),
      focusedBorder: borda(LaColors.grafite, 2),
      errorBorder: borda(LaColors.perigo, 2),
      focusedErrorBorder: borda(LaColors.perigo, 2),
      disabledBorder: borda(LaColors.filete, 1.5),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: LaColors.grafite,
      contentTextStyle: LaType.corpo.copyWith(color: LaColors.branco),
      actionTextColor: LaColors.faixa,
      behavior: SnackBarBehavior.floating,
      shape: const RoundedRectangleBorder(borderRadius: LaRadius.rBotao),
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(color: LaColors.grafite),
    dividerTheme: const DividerThemeData(color: LaColors.linha, thickness: 1, space: 1),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: LaColors.branco,
      shape: RoundedRectangleBorder(borderRadius: LaRadius.rFolhaTopo),
    ),
  );
}
