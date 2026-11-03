import 'package:flutter/material.dart';

import '../la_tokens.dart';

enum LaButtonVariant {
  /// Amarelo. Só UMA por tela: a ação principal.
  principal,

  /// Grafite. Ações fortes secundárias (Entrar, Lançar OS, Mover para…).
  escuro,

  /// Contorno grafite 2 px.
  contorno,

  /// Contorno vermelho (Sair).
  perigo,
}

class LaButton extends StatelessWidget {
  const LaButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.variant = LaButtonVariant.escuro,
    this.height = LaSize.toque + 4,
    this.leading,
    this.trailing,
    this.loading = false,
    this.expand = true,
    this.alignStart = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final LaButtonVariant variant;
  final double height;
  final Widget? leading;
  final Widget? trailing;
  final bool loading;
  final bool expand;
  final bool alignStart;

  @override
  Widget build(BuildContext context) {
    final (Color bg, Color fg, BorderSide side) = switch (variant) {
      LaButtonVariant.principal => (LaColors.faixa, LaColors.grafite, BorderSide.none),
      LaButtonVariant.escuro => (LaColors.grafite, LaColors.branco, BorderSide.none),
      LaButtonVariant.contorno => (LaColors.branco, LaColors.grafite, const BorderSide(color: LaColors.grafite, width: 2)),
      LaButtonVariant.perigo => (LaColors.branco, LaColors.perigo, const BorderSide(color: LaColors.perigo, width: 2)),
    };
    final enabled = onPressed != null && !loading;

    final content = loading
        ? SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.4, color: fg))
        : Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (leading != null) ...[leading!, const SizedBox(width: LaSpace.item)],
              Flexible(
                child: Text(label, style: LaType.botao.copyWith(color: fg), overflow: TextOverflow.ellipsis),
              ),
              if (trailing != null) ...[const SizedBox(width: LaSpace.item), trailing!],
            ],
          );

    return Semantics(
      button: true,
      enabled: enabled,
      child: Opacity(
        opacity: onPressed == null ? 0.4 : 1,
        child: Material(
          color: bg,
          shape: RoundedRectangleBorder(borderRadius: LaRadius.rBotao, side: side),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: enabled ? onPressed : null,
            overlayColor: WidgetStatePropertyAll(LaColors.grafite.withValues(alpha: 0.08)),
            child: SizedBox(
              height: height < LaSize.toque ? LaSize.toque : height,
              width: expand ? double.infinity : null,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: LaSpace.xl),
                child: Align(
                  alignment: alignStart ? Alignment.centerLeft : Alignment.center,
                  widthFactor: expand ? null : 1,
                  child: content,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
