import 'package:flutter/material.dart';

import '../la_tokens.dart';

/// Controle segmentado (ex.: Laboratório | Vendedor no login).
class LaSegmented extends StatelessWidget {
  const LaSegmented({
    super.key,
    required this.opcoes,
    required this.selecionado,
    required this.onChanged,
  });

  final List<String> opcoes;
  final int selecionado;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: LaColors.piso,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          for (var i = 0; i < opcoes.length; i++) ...[
            if (i > 0) const SizedBox(width: 4),
            Expanded(
              child: Semantics(
                selected: i == selecionado,
                button: true,
                child: Material(
                  color: i == selecionado
                      ? LaColors.grafite
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(11),
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    onTap: () => onChanged(i),
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(
                        minHeight: LaSize.toque,
                      ),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 12,
                        ),
                        child: Text(
                          opcoes[i],
                          textAlign: TextAlign.center,
                          style: LaType.botao.copyWith(
                            fontWeight: FontWeight.w600,
                            color: i == selecionado
                                ? LaColors.branco
                                : LaColors.regua,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
