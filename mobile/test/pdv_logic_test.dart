import 'package:flutter_test/flutter_test.dart';
import 'package:oticahub_lab/pdv_logic.dart';

void main() {
  test('lê número da OS e link do QR Code', () {
    expect(parseScanCode(' OS-2026-000123\n')?.ref, 'OS-2026-000123');
    expect(
      parseScanCode('https://lab.oticahub.com/laboratorio/0F8FAD5B-D9CB-469F-A165-70867728950E')?.id,
      '0f8fad5b-d9cb-469f-a165-70867728950e',
    );
    expect(parseScanCode('   '), isNull);
  });

  test('explica quando a OS não está na etapa certa', () {
    expect(scanBlockReason(ScanAction.lente, {'status': 'em_montagem'}), 'Está em "Em montagem".');
    expect(scanBlockReason(ScanAction.lente, {'status': 'aguardando_lentes'}), isNull);
    final medico = {'status': 'em_conferencia', 'medical_review_required': true, 'medical_review_approved_at': null};
    expect(scanBlockReason(ScanAction.pronto, medico), contains('médico'));
    expect(scanBlockReason(ScanAction.voltou, medico), isNull);
  });

  test('perfis: montador não registra lente nem entrega', () {
    expect(allowedScanActions('montador'), isNot(contains(ScanAction.lente)));
    expect(allowedScanActions('montador'), isNot(contains(ScanAction.entregue)));
    expect(allowedScanActions('admin'), ScanAction.values);
  });

  test('radar e avisos', () {
    final now = DateTime.utc(2026, 11, 25, 15);
    final rows = [
      {'id': 'a', 'number': '1', 'status': 'em_montagem', 'due_at': '2026-11-25T10:00:00Z'},
      {'id': 'b', 'number': '2', 'status': 'aguardando_montagem', 'due_at': '2026-11-25T20:00:00Z'},
      {'id': 'c', 'number': '3', 'status': 'aguardando_lentes', 'due_at': '2026-12-10T10:00:00Z', 'lens_expected_at': '2026-11-24T10:00:00Z'},
      {'id': 'd', 'number': '4', 'status': 'pronto', 'due_at': '2026-11-01T10:00:00Z'},
    ];
    final lanes = radarGroups(rows, now);
    expect(lanes[RadarLane.atrasada]!.map((r) => r['id']), ['a']);
    expect(lanes[RadarLane.vence24h]!.map((r) => r['id']), ['b']);
    final alerts = pdvAlerts(rows, now, unreadMessages: 2);
    expect(alerts.map((a) => a.key), ['atrasadas', 'vence', 'lentes', 'retirada', 'recados']);
    expect(deadlineText('2026-11-25T10:00:00Z', now), 'atrasou há 5 h');
  });
}
