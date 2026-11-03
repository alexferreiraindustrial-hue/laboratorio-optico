// Laboratório ALEX: tokens de design.
// Fonte da verdade: design-handoff/HANDOFF.md §2.
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Cores. Use sempre o token, nunca o hex solto.
abstract final class LaColors {
  static const piso = Color(0xFFE9EAE6);
  static const branco = Color(0xFFFFFFFF);
  static const grafite = Color(0xFF1C1E1F);
  static const regua = Color(0xFF5C6166);
  static const borda = Color(0xFFC9CCC6);
  static const filete = Color(0xFFDCDDD8);
  static const linha = Color(0xFFECEDEA);

  /// Amarelo de faixa de piso: só ação principal e "você está aqui".
  static const faixa = Color(0xFFFFCC00);
  static const abaInativa = Color(0xFFB4B8B3);

  static const perigo = Color(0xFFB42318);
  static const perigoFundo = Color(0xFFFEF3F2);
  static const alerta = Color(0xFFB54708);
  static const alertaFundo = Color(0xFFFFF1E6);
  static const alertaBorda = Color(0xFFF2B98C);
  static const noPrazo = Color(0xFF2B7A3B);

  static const pontoAtrasada = Color(0xFFD92D20);
  static const pontoProximo = Color(0xFFF27A1A);
  static const pontoNoPrazo = Color(0xFF2F9E44);
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
  static const double botao = 12;
  static const double cartao = 16;
  static const double folha = 24;

  static const BorderRadius rChip = BorderRadius.all(Radius.circular(chip));
  static const BorderRadius rBotao = BorderRadius.all(Radius.circular(botao));
  static const BorderRadius rCartao = BorderRadius.all(Radius.circular(cartao));
  static const BorderRadius rFolhaTopo = BorderRadius.vertical(top: Radius.circular(folha));
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
  static TextStyle _cd(double size, {FontWeight w = FontWeight.w700, double? h, double? ls, Color c = LaColors.grafite}) =>
      GoogleFonts.barlowCondensed(fontSize: size, fontWeight: w, height: h, letterSpacing: ls, color: c);

  static TextStyle _ui(double size, {FontWeight w = FontWeight.w500, double? h, Color c = LaColors.grafite}) =>
      GoogleFonts.barlow(fontSize: size, fontWeight: w, height: h, color: c);

  // Condensed
  static TextStyle get numeroOs => _cd(84, h: 0.82, ls: -1);
  static TextStyle get marca => _cd(72, h: 0.86, ls: -1.5);
  static TextStyle get tituloTela => _cd(48, h: 1.0, ls: -0.5);
  static TextStyle get contagem => _cd(44, h: 1.0);
  static TextStyle get numeroCartao => _cd(36, h: 1.0);
  static TextStyle get tituloSecao => _cd(26);
  static TextStyle get numeroLista => _cd(24);
  static TextStyle get grau => _cd(26, w: FontWeight.w600);

  // Barlow
  static TextStyle get corpoForte => _ui(17, w: FontWeight.w600);
  static TextStyle get corpo => _ui(16);
  static TextStyle get botao => _ui(16, w: FontWeight.w700);
  static TextStyle get botaoGrande => _ui(18, w: FontWeight.w700);
  static TextStyle get rotulo => _ui(14, w: FontWeight.w600);
  static TextStyle get apoio => _ui(13, w: FontWeight.w400, c: LaColors.regua);
  static TextStyle get aba => _ui(12, w: FontWeight.w600, c: LaColors.abaInativa);
  static TextStyle get abaAtiva => _ui(12, w: FontWeight.w700, c: LaColors.branco);
}
