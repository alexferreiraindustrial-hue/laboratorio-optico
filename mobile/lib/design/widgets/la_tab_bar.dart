import 'package:flutter/material.dart';

import '../la_tokens.dart';

/// Barra de abas do modo Laboratório: Painel, Lançar, Bancada, Lentes, Mais.
/// Não usar no modo Vendedor.
class LaTabBar extends StatelessWidget {
  const LaTabBar({super.key, required this.currentIndex, required this.onTap});

  final int currentIndex;
  final ValueChanged<int> onTap;

  static const _itens = <(IconData, String)>[
    (Icons.dashboard_outlined, 'Painel'),
    (Icons.add, 'Lançar'),
    (Icons.handyman_outlined, 'Bancada'),
    (Icons.adjust, 'Lentes'),
    (Icons.more_horiz, 'Mais'),
  ];

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: LaColors.grafite,
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: LaSize.barraAbas,
          child: Row(
            children: [
              for (var i = 0; i < _itens.length; i++)
                Expanded(child: _Item(icone: _itens[i].$1, rotulo: _itens[i].$2, ativo: i == currentIndex, onTap: () => onTap(i))),
            ],
          ),
        ),
      ),
    );
  }
}

class _Item extends StatelessWidget {
  const _Item({required this.icone, required this.rotulo, required this.ativo, required this.onTap});

  final IconData icone;
  final String rotulo;
  final bool ativo;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      selected: ativo,
      button: true,
      label: rotulo,
      onTap: onTap,
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        overlayColor: WidgetStatePropertyAll(LaColors.branco.withValues(alpha: 0.06)),
        child: Stack(
          children: [
            if (ativo)
              const Positioned(
                top: 0,
                left: 16,
                right: 16,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: LaColors.faixa,
                    borderRadius: BorderRadius.vertical(bottom: Radius.circular(4)),
                  ),
                  child: SizedBox(height: 4),
                ),
              ),
            Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(icone, size: 24, color: ativo ? LaColors.faixa : LaColors.abaInativa),
                  const SizedBox(height: 4),
                  Text(rotulo, style: ativo ? LaType.abaAtiva : LaType.aba),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
