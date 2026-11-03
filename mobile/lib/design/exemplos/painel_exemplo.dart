// Exemplo do Painel montado com o design system.
// Substitua os números fixos pelas contagens reais e as navegações pelas rotas do app.
import 'package:flutter/material.dart';

import '../la_design.dart';

class PainelExemplo extends StatefulWidget {
  const PainelExemplo({super.key});

  @override
  State<PainelExemplo> createState() => _PainelExemploState();
}

class _PainelExemploState extends State<PainelExemplo> {
  int _aba = 0;

  void _ir(String destino) => debugPrint('navegar: $destino');

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: LaColors.piso,
      bottomNavigationBar: LaTabBar(currentIndex: _aba, onTap: (i) => setState(() => _aba = i)),
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(LaSpace.tela, LaSpace.l, LaSpace.tela, LaSpace.xxl),
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: LaSpace.xs),
              child: Row(
                children: [
                  const LaMonogram(size: 44),
                  const SizedBox(width: LaSpace.l),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Laboratório ALEX', style: LaType.corpoForte.copyWith(fontSize: 18, fontWeight: FontWeight.w700)),
                      Text('Terça, 3 de novembro', style: LaType.rotulo.copyWith(fontWeight: FontWeight.w500, color: LaColors.regua)),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: LaSpace.secao),

            LaCommandPlate(
              onLancarOs: () => _ir('lancar'),
              onOsCompleta: () => _ir('os-completa'),
              onRotina: () => _ir('rotina'),
              onConfigurarRotina: () => _ir('rotina/config'),
            ),
            const SizedBox(height: LaSpace.secao),

            LaFlowList(
              steps: [
                LaFlowStep(rotulo: 'Aguardando lentes', subtitulo: 'Fila', contagem: 18, kind: LaFlowKind.fila, onTap: () => _ir('fila/lentes')),
                LaFlowStep(rotulo: 'Aguardando montagem', subtitulo: 'Fila', contagem: 7, kind: LaFlowKind.fila, onTap: () => _ir('bancada/aguardando')),
                LaFlowStep(rotulo: 'Em montagem', subtitulo: 'Na bancada', contagem: 4, kind: LaFlowKind.bancada, onTap: () => _ir('bancada/montagem')),
                LaFlowStep(rotulo: 'Em correção', subtitulo: 'Retrabalho', contagem: 1, kind: LaFlowKind.retrabalho, onTap: () => _ir('bancada/correcao')),
                LaFlowStep(rotulo: 'Em conferência', subtitulo: 'Inspeção', contagem: 2, kind: LaFlowKind.inspecao, onTap: () => _ir('bancada/conferencia')),
                LaFlowStep(rotulo: 'Pronto', subtitulo: 'Saída', contagem: 11, kind: LaFlowKind.saida, onTap: () => _ir('prontas')),
              ],
            ),
            const SizedBox(height: LaSpace.l),

            // Aviso de estoque + perfil
            Row(
              children: [
                Expanded(
                  child: Material(
                    color: LaColors.branco,
                    shape: const RoundedRectangleBorder(
                      borderRadius: LaRadius.rBotao,
                      side: BorderSide(color: LaColors.alertaBorda, width: 1.5),
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: InkWell(
                      onTap: () => _ir('lentes/estoque'),
                      child: SizedBox(
                        height: 52,
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: LaSpace.secao),
                          child: Row(
                            children: [
                              Container(width: 10, height: 10, decoration: const BoxDecoration(color: LaColors.pontoProximo, shape: BoxShape.circle)),
                              const SizedBox(width: LaSpace.m),
                              Text('3 lentes no mínimo', style: LaType.rotulo.copyWith(fontSize: 15)),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: LaSpace.item),
                Material(
                  color: LaColors.branco,
                  borderRadius: LaRadius.rBotao,
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    onTap: () => setState(() => _aba = 4),
                    child: SizedBox(
                      height: 52,
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(6, 6, 12, 6),
                        child: Row(
                          children: [
                            Container(
                              width: 40,
                              height: 40,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(color: LaColors.grafite, borderRadius: BorderRadius.circular(9)),
                              child: Text('AF', style: LaType.numeroLista.copyWith(fontSize: 18, color: LaColors.branco)),
                            ),
                            const SizedBox(width: LaSpace.item),
                            Text('Alex Ferreira', style: LaType.rotulo.copyWith(fontSize: 15)),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
