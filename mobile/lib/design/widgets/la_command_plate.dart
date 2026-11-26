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
    padding: EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: LaColors.surface(context),
      borderRadius: LaRadius.rCartao,
      border: Border.all(color: LaColors.adapt(context, LaColors.filete)),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Começar um serviço', style: LaType.corpoForte),
        SizedBox(height: 12),
        LayoutBuilder(
          builder: (context, box) {
            final primary = LaButton(
              label: 'Entrada rápida',
              variant: LaButtonVariant.principal,
              leading: Icon(Icons.add, color: Theme.of(context).colorScheme.onPrimary),
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
                children: [primary, SizedBox(height: 8), secondary],
              );
            }
            return Row(
              children: [
                Expanded(child: primary),
                SizedBox(width: 8),
                Expanded(child: secondary),
              ],
            );
          },
        ),
        SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: TextButton.icon(
                onPressed: onRotina,
                icon: Icon(Icons.checklist),
                label: Text('Rotina do dia'),
              ),
            ),
            IconButton(
              tooltip: 'Configurar rotina',
              onPressed: onConfigurarRotina,
              icon: Icon(Icons.settings_outlined),
            ),
          ],
        ),
      ],
    ),
  );
}
