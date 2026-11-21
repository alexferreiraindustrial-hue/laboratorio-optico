import 'package:flutter/material.dart';

import '../la_tokens.dart';

/// Símbolos do mapa de fluxo de valor (VSM) usados no Painel.
enum LaFlowKind {
  /// Triângulo de estoque: Aguardando lentes, Aguardando montagem.
  fila,

  /// Caixa de processo preenchida: Em montagem.
  bancada,

  /// Laço de retrabalho: Em correção.
  retrabalho,

  /// Caixa com visto: Em conferência.
  inspecao,

  /// Caixa amarela com seta: Pronto.
  saida,
}

class LaFlowSymbol extends StatelessWidget {
  const LaFlowSymbol({super.key, required this.kind, this.size = 40, this.vazio = false});

  final LaFlowKind kind;
  final double size;

  /// Versão vazada em cinza (estado vazio).
  final bool vazio;

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: CustomPaint(size: Size.square(size), painter: _FlowPainter(kind, vazio, Theme.of(context).brightness)),
    );
  }
}

class _FlowPainter extends CustomPainter {
  _FlowPainter(this.kind, this.vazio, this.brightness);
  final Brightness brightness;
  Color tone(Color color) => brightness == Brightness.dark && color == LaColors.branco ? const Color(0xFF23211E) : LaColors.forBrightness(brightness, color);

  final LaFlowKind kind;
  final bool vazio;

  @override
  void paint(Canvas canvas, Size size) {
    // Desenho em grade 40×40, escalado.
    final s = size.width / 40;
    canvas.scale(s);

    final traco = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.2
      ..strokeJoin = StrokeJoin.round
      ..strokeCap = StrokeCap.round
      ..color = vazio ? tone(LaColors.abaInativa) : tone(LaColors.grafite);
    final grosso = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.4
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..color = tone(LaColors.grafite);
    final caixa = RRect.fromRectAndRadius(const Rect.fromLTWH(7, 9, 26, 22), const Radius.circular(3));

    switch (kind) {
      case LaFlowKind.fila:
        final tri = Path()
          ..moveTo(20, 7)
          ..lineTo(34, 32)
          ..lineTo(6, 32)
          ..close();
        if (!vazio) canvas.drawPath(tri, Paint()..color = tone(LaColors.branco));
        canvas.drawPath(tri, traco);
        if (!vazio) canvas.drawLine(const Offset(20, 18), const Offset(20, 27), grosso);
      case LaFlowKind.bancada:
        canvas.drawRRect(caixa, Paint()..color = tone(LaColors.grafite));
      case LaFlowKind.retrabalho:
        canvas.drawCircle(const Offset(20, 20), 14, Paint()..color = tone(LaColors.alertaFundo));
        final laranja = Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2.4
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round
          ..color = tone(LaColors.alerta);
        // Arco quase completo, aberto no canto superior direito.
        canvas.drawArc(Rect.fromCircle(center: const Offset(20, 20), radius: 9), -0.5, 5.2, false, laranja);
        final seta = Path()
          ..moveTo(29, 9)
          ..lineTo(29, 15)
          ..lineTo(23, 15);
        canvas.drawPath(seta, laranja);
      case LaFlowKind.inspecao:
        canvas.drawRRect(caixa, Paint()..color = tone(LaColors.branco));
        canvas.drawRRect(caixa, traco);
        final visto = Path()
          ..moveTo(14, 20)
          ..lineTo(18, 24)
          ..lineTo(26, 16);
        canvas.drawPath(visto, grosso);
      case LaFlowKind.saida:
        canvas.drawRRect(caixa, Paint()..color = LaColors.faixa);
        canvas.drawRRect(caixa, traco);
        canvas.drawLine(const Offset(13, 20), const Offset(25, 20), grosso);
        final ponta = Path()
          ..moveTo(21, 15)
          ..lineTo(26, 20)
          ..lineTo(21, 25);
        canvas.drawPath(ponta, grosso);
    }
  }

  @override
  bool shouldRepaint(_FlowPainter old) => old.brightness != brightness || old.kind != kind || old.vazio != vazio;
}
