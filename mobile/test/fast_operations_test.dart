import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:oticahub_lab/lab_api.dart';
import 'package:oticahub_lab/domain.dart';
import 'package:oticahub_lab/operational_controls.dart';
import 'package:oticahub_lab/theme.dart';

void main() {
  test(
    'montagem conclui sem cliques nas etapas e médico é decisão explícita',
    () {
      expect(
        nextBenchAction(status: 'em_montagem', role: 'montador', steps: []).to,
        'pronto',
      );
      expect(
        nextBenchAction(
          status: 'em_montagem',
          role: 'montador',
          steps: [],
          medicalRequired: true,
        ).to,
        'em_conferencia',
      );
      expect(allowedTargets('pronto', 'montador'), contains('em_conferencia'));
      expect(
        nextBenchAction(status: 'pronto', role: 'montador', steps: []).kind,
        'none',
      );
    },
  );
  test('registros rápidos, correção e entrega chamam RPCs distintas, sem gravar etapas', () async {
    final requests = <http.Request>[];
    final client = SupabaseClient(
      'https://example.test',
      'public-test-key',
      httpClient: MockClient((r) async {
        requests.add(r);
        return http.Response(
          '{}',
          200,
          headers: {'content-type': 'application/json'},
          request: r,
        );
      }),
    );
    addTearDown(client.dispose);
    final api = LabApi(client: client);
    await api.stageNote('os', 'lensometria', 'Registro informativo', false);
    await api.changeStatus('os', 'em_correcao', 'Dano identificado');
    await api.confirmClientDelivery(
      'os',
      '11999999999',
      DateTime.utc(2026, 11, 20, 15),
    );
    await api.updateClientFeedback(
      {'id': 'delivery', 'updated_at': 'version'},
      null,
      'Telefone corrigido',
      '11999999999',
    );
    expect(requests.map((r) => r.url.path), [
      '/rest/v1/rpc/register_order_stage_note',
      '/rest/v1/rpc/send_order_to_correction',
      '/rest/v1/rpc/confirm_client_delivery',
      '/rest/v1/rpc/update_client_followup',
    ]);
    expect(jsonDecode(requests[0].body)['p_correction'], false);
    expect(jsonDecode(requests[3].body)['p_expected_updated_at'], 'version');
    expect(jsonDecode(requests[3].body)['p_outcome'], isNull);
    expect(
      jsonDecode(requests[2].body)['p_delivered_at'],
      '2026-11-20T15:00:00.000Z',
    );
  });
  test(
    'cadastro já pronto usa operação atômica sem completar etapas',
    () async {
      late http.Request request;
      final client = SupabaseClient(
        'https://example.test',
        'public-test-key',
        httpClient: MockClient((r) async {
          request = r;
          return http.Response(
            '{"id":"new-order"}',
            200,
            headers: {'content-type': 'application/json'},
            request: r,
          );
        }),
      );
      addTearDown(client.dispose);
      await LabApi(client: client).createReady(
        sellerId: 'seller',
        storeId: 'store',
        laboratoryId: 'lab',
        clientName: '',
        orderRef: 'TESTE',
        completed: DateTime.utc(2026, 11, 20),
      );
      expect(request.url.path, '/rest/v1/rpc/create_ready_service_order');
      final data = jsonDecode(request.body);
      expect(data['p_order']['p_client_name'], 'OS TESTE');
      expect(data['p_order']['p_store_id'], 'store');
      expect(data['p_order'].containsKey('steps'), false);
    },
  );
  for (final dark in [true, false]) {
    testWidgets('registro opcional fica legível em tela estreita, tema $dark', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(320, 1100);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(
        MaterialApp(
          theme: labTheme(dark: dark),
          home: Scaffold(
            body: SingleChildScrollView(
              child: StageNoteControl(
                id: 'os',
                status: 'em_montagem',
                onChanged: () async {},
                photo: (_, _) async {},
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(find.text('Salvar registro · manter posição'), findsOneWidget);
      expect(
        find.text('O problema exige enviar para correção'),
        findsOneWidget,
      );
    });
  }
}
