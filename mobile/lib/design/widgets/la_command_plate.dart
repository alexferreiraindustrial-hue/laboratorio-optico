import 'package:flutter/material.dart';

import '../la_tokens.dart';
import 'la_button.dart';

/// Placa de comando amarela do Painel.
/// Linha 1: Lançar OS (escuro) | OS completa (contorno).
/// Linha 2: Rotina + engrenagem.
class LaCommandPlate extends StatelessWidget {
  const LaCommandPlate({
    super.key,
    required this.onLancarOs,
    required this.onOsCompleta,
    required this.onRotina,
    required this.onConfigurarRotina,
  });

  final VoidCallback onLancarOs;
  final VoidCallback onOsCompleta;
  final VoidCallback onRotina;
  final VoidCallback onConfigurarRotina;

  @override
  Widget build(BuildContext context) {
    final suave = LaColors.grafite.withValues(alpha: 0.08);
    return Container(
      padding: const EdgeInsets.all(LaSpace.m),
      decoration: const BoxDecoration(color: LaColors.faixa, borderRadius: LaRadius.rCartao),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                flex: 3,
                child: LaButton(
                  label: 'Lançar OS',
                  height: LaSize.botaoGrande,
                  leading: const Icon(Icons.add, color: LaColors.faixa, size: 22),
                  onPressed: onLancarOs,
                ),
              ),
              const SizedBox(width: LaSpace.item),
              Expanded(
                flex: 2,
                child: Material(
                  color: Colors.transparent,
                  shape: const RoundedRectangleBorder(
                    borderRadius: LaRadius.rBotao,
                    side: BorderSide(color: LaColors.grafite, width: 2),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    onTap: onOsCompleta,
                    child: SizedBox(
                      height: LaSize.botaoGrande,
                      child: Center(child: Text('OS completa', style: LaType.botao.copyWith(fontSize: 17))),
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: LaSpace.item),
          Row(
            children: [
              Expanded(
                child: Material(
                  color: suave,
                  borderRadius: LaRadius.rBotao,
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    onTap: onRotina,
                    child: SizedBox(
                      height: LaSize.toque,
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: LaSpace.secao),
                        child: Align(alignment: Alignment.centerLeft, child: Text('Rotina', style: LaType.botao)),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: LaSpace.item),
              Material(
                color: suave,
                borderRadius: LaRadius.rBotao,
                clipBehavior: Clip.antiAlias,
                child: InkWell(
                  onTap: onConfigurarRotina,
                  child: const SizedBox(
                    width: LaSize.toque,
                    height: LaSize.toque,
                    child: Icon(Icons.settings_outlined, color: LaColors.grafite, semanticLabel: 'Configurar rotina'),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
