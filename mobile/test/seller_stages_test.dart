import 'package:flutter_test/flutter_test.dart';
import 'package:oticahub_lab/seller_stages.dart';

void main() {
  test('etapas para a vendedora', () {
    expect(sellerStageKey('aguardando_lentes'), 'lentes');
    expect(sellerStageKey('aguardando_montagem'), 'fila');
    expect(sellerStageKey('em_correcao'), 'bancada');
    expect(sellerStageKey('em_conferencia'), 'conferencia');
    expect(sellerStageOf('pronto').tip, contains('cliente'));
    expect(sellerProduction, ['lentes', 'fila', 'bancada', 'conferencia']);
  });
}
