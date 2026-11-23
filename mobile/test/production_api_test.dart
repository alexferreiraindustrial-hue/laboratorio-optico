import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:oticahub_lab/lab_api.dart';

void main() {
  test(
    'visão geral lê todas as páginas, com ordenação estável e sem gravar dados',
    () async {
      final offsets = <int>[];
      final client = SupabaseClient(
        'https://example.test',
        'public-test-key',
        httpClient: MockClient((request) async {
          expect(request.method, 'GET');
          expect(request.url.path, '/rest/v1/orders_enriched');
          expect(request.url.queryParameters['order'], contains('id'));
          final offset = int.parse(
            request.url.queryParameters['offset'] ?? '0',
          );
          offsets.add(offset);
          return http.Response(
            jsonEncode([
              for (var i = offset; i < offset + 500 && i < 1001; i++)
                {'id': 'order-$i', 'status': 'em_montagem'},
            ]),
            200,
            headers: {'content-type': 'application/json'},
            request: request,
          );
        }),
      );
      addTearDown(client.dispose);
      final rows = await LabApi(client: client).overviewOrders();
      expect(rows, hasLength(1001));
      expect(offsets, [0, 500, 1000]);
      expect(rows.map((r) => r['id']).toSet(), hasLength(1001));
    },
  );
  test('vendedora é filtrada no servidor antes da paginação em listas e em pronta retirada', () async {
    final requests = <Uri>[];
    final client = SupabaseClient(
      'https://example.test',
      'public-test-key',
      httpClient: MockClient((request) async {
        requests.add(request.url);
        expect(request.url.queryParameters['seller_id'], 'eq.seller-b');
        final offset = int.parse(request.url.queryParameters['offset'] ?? '0');
        return http.Response(
          jsonEncode([
            for (var i = offset; i < offset + 500 && i < 501; i++)
              {'id': 'order-$i', 'seller_id': 'seller-b', 'status': 'pronto'},
          ]),
          200,
          headers: {'content-type': 'application/json'},
          request: request,
        );
      }),
    );
    addTearDown(client.dispose);
    final api = LabApi(client: client);
    expect(await api.allOrders(sellerId: 'seller-b'), hasLength(501));
    expect(
      await api.queueOrders('pronto', sellerId: 'seller-b'),
      hasLength(501),
    );
    expect(requests, hasLength(4));
  });
  test('sem vendedora usa is.null e falha de paginação não apresenta lista parcial como completa', () async {
    var fail = false;
    final client = SupabaseClient(
      'https://example.test',
      'public-test-key',
      httpClient: MockClient((request) async {
        expect(request.url.queryParameters['seller_id'], 'is.null');
        if (fail)
          return http.Response(
            jsonEncode({'message': 'not authorized', 'code': '42501'}),
            403,
            headers: {'content-type': 'application/json'},
            request: request,
          );
        return http.Response(
          '[]',
          200,
          headers: {'content-type': 'application/json'},
          request: request,
        );
      }),
    );
    addTearDown(client.dispose);
    final api = LabApi(client: client);
    expect(
      await api.queueOrders('pronto', sellerId: '__unassigned__'),
      isEmpty,
    );
    fail = true;
    await expectLater(
      api.queueOrders('pronto', sellerId: '__unassigned__'),
      throwsA(isA<PostgrestException>()),
    );
  });
}
