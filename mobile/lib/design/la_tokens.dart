// Lab Gold: tokens de design.
// Fonte da verdade: design-handoff/HANDOFF.md §2.
import 'package:flutter/material.dart';

/// Cores. Use sempre o token, nunca o hex solto.
abstract final class LaColors {
  static Color surface(BuildContext context) =>
      Theme.of(context).colorScheme.surface;
  static Color adapt(BuildContext context, Color color) =>
      forBrightness(Theme.of(context).brightness, color);
  static Color forBrightness(Brightness brightness, Color color) {
    if (brightness != Brightness.dark) return color;
    // Mesmas cores do modo escuro do site (lab.oticahub.com).
    if (color == piso) return const Color(0xFF0B141A);
    if (color == grafite || color == navegacao) return const Color(0xFFE9EDEF);
    if (color == regua || color == abaInativa) return const Color(0xFFAEBAC1);
    if (color == borda) return const Color(0xFF34474F);
    if (color == filete || color == linha) return const Color(0xFF2A3942);
    if (color == acentoSuave) return const Color(0xFF103529);
    if (color == alertaFundo) return const Color(0xFF3A3120);
    if (color == perigoFundo) return const Color(0xFF3D1F27);
    if (color == perigo || color == pontoAtrasada) return const Color(0xFFFF8FA3);
    if (color == alerta || color == alertaBorda || color == pontoProximo) return const Color(0xFFFFD279);
    if (color == acento || color == faixa) return const Color(0xFF00A884);
    if (color == noPrazo || color == pontoNoPrazo) return const Color(0xFF06CF9C);
    return color;
  }

  // Paleta do site (tema claro). O modo escuro vem de forBrightness.
  static const acento = Color(0xFF008069);
  static const acentoSuave = Color(0xFFD9FDD3);
  static const navegacao = Color(0xFF111B21);
  static const piso = Color(0xFFF0F2F5);
  static const branco = Color(0xFFFFFFFF);
  static const grafite = Color(0xFF111B21);
  static const regua = Color(0xFF54656F);
  static const borda = Color(0xFFD1D7DB);
  static const filete = Color(0xFFE9EDEF);
  static const linha = Color(0xFFE9EDEF);

  /// Ação principal e "você está aqui".
  static const faixa = Color(0xFF008069);
  static const abaInativa = Color(0xFF54656F);

  static const perigo = Color(0xFFB0002A);
  static const perigoFundo = Color(0xFFFFE6EC);
  static const alerta = Color(0xFF7A5000);
  static const alertaFundo = Color(0xFFFFF4D6);
  static const alertaBorda = Color(0xFFE0A100);
  static const noPrazo = Color(0xFF017561);

  static const pontoAtrasada = Color(0xFFB0002A);
  static const pontoProximo = Color(0xFFE0A100);
  static const pontoNoPrazo = Color(0xFF00A884);
}

abstract final class LaSpace {
  static const double xs = 4;
  static const double s = 6;
  static const double item = 8;
  static const double m = 10;
  static const double l = 12;
  static const double secao = 14;
  static const double interno = 14;
  static const double tela = 16;
  static const double xl = 20;
  static const double xxl = 24;
}

abstract final class LaRadius {
  static const double chip = 6;
  static const double botao = 14;
  static const double cartao = 20;
  static const double folha = 24;

  static const BorderRadius rChip = BorderRadius.all(Radius.circular(chip));
  static const BorderRadius rBotao = BorderRadius.all(Radius.circular(botao));
  static const BorderRadius rCartao = BorderRadius.all(Radius.circular(cartao));
  static const BorderRadius rFolhaTopo = BorderRadius.vertical(
    top: Radius.circular(folha),
  );
}

abstract final class LaSize {
  /// Alvo mínimo de toque.
  static const double toque = 48;
  static const double botaoGrande = 56;
  static const double botaoPrincipal = 60;
  static const double linhaFluxo = 56;
  static const double barraAbas = 66;
}

/// Tipografia. Barlow Condensed para números e títulos; Barlow para interface.
abstract final class LaType {
  static TextStyle _cd(
    double size, {
    FontWeight w = FontWeight.w700,
    double? h,
    double? ls,
    Color? c,
  }) => TextStyle(
    fontFamily: 'PlusJakartaSans',
    fontSize: size,
    fontWeight: w,
    height: h,
    letterSpacing: ls,
    color: c,
  );

  static TextStyle _ui(
    double size, {
    FontWeight w = FontWeight.w500,
    double? h,
    Color? c,
  }) => TextStyle(
    fontFamily: 'PlusJakartaSans',
    fontSize: size,
    fontWeight: w,
    height: h,
    color: c,
  );

  // Condensed
  static TextStyle get numeroOs => _cd(40, h: 1.15, ls: -1);
  static TextStyle get marca => _cd(40, h: 1.15, ls: -1);
  static TextStyle get tituloTela => _cd(30, h: 1.2, ls: -0.5);
  static TextStyle get contagem => _cd(32, h: 1.15);
  static TextStyle get numeroCartao => _cd(24, h: 1.2);
  static TextStyle get tituloSecao => _cd(22);
  static TextStyle get numeroLista => _cd(20);
  static TextStyle get grau => _cd(26, w: FontWeight.w600);

  // Barlow
  static TextStyle get corpoForte => _ui(17, w: FontWeight.w600);
  static TextStyle get corpo => _ui(16);
  static TextStyle get botao => _ui(16, w: FontWeight.w700);
  static TextStyle get botaoGrande => _ui(18, w: FontWeight.w700);
  static TextStyle get rotulo => _ui(14, w: FontWeight.w600);
  static TextStyle get apoio => _ui(13, w: FontWeight.w400);
  static TextStyle get aba => _ui(12, w: FontWeight.w600);
  static TextStyle get abaAtiva =>
      _ui(12, w: FontWeight.w700, c: LaColors.branco);
}
