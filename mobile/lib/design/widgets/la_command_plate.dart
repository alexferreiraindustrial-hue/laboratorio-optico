import 'package:flutter/material.dart';

import '../la_tokens.dart';
import 'la_button.dart';

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
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: LaColors.branco,
      borderRadius: LaRadius.rCartao,
      border: Border.all(color: LaColors.filete),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Começar um serviço', style: LaType.corpoForte),
        const SizedBox(height: 12),
        LayoutBuilder(
          builder: (context, box) {
            final primary = LaButton(
              label: 'Entrada rápida',
              variant: LaButtonVariant.principal,
              leading: const Icon(Icons.add, color: LaColors.branco),
              onPressed: onLancarOs,
            );
            final secondary = LaButton(
              label: 'OS completa',
              variant: LaButtonVariant.contorno,
              onPressed: onOsCompleta,
            );
            if (box.maxWidth < 420 ||
                MediaQuery.textScalerOf(context).scale(16) > 22) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [primary, const SizedBox(height: 8), secondary],
              );
            }
            return Row(
              children: [
                Expanded(child: primary),
                const SizedBox(width: 8),
                Expanded(child: secondary),
              ],
            );
          },
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: TextButton.icon(
                onPressed: onRotina,
                icon: const Icon(Icons.checklist),
                label: const Text('Rotina do dia'),
              ),
            ),
            IconButton(
              tooltip: 'Configurar rotina',
              onPressed: onConfigurarRotina,
              icon: const Icon(Icons.settings_outlined),
            ),
          ],
        ),
      ],
    ),
  );
}
