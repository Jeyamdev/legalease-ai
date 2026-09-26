import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:legal_service_app/features/lawyers/lawyer_api.dart';
import 'package:legal_service_app/features/lawyers/lawyer_store.dart';

void main() {
  test('search sends filters and handles empty results', () async {
    final api = LawyerApi(
      MockClient((request) async {
        if (request.url.path.endsWith('specializations')) {
          return http.Response('[]', 200);
        }
        expect(request.url.queryParameters['search'], 'Alice');
        expect(request.url.queryParameters['specializationId'], '2');
        return http.Response(jsonEncode({'items': [], 'totalCount': 0}), 200);
      }),
      'https://example.test/api',
    );
    final store = LawyerStore(api);
    await store.load(search: 'Alice', specialization: 2, changeFilter: true);
    expect(store.loading, false);
    expect(store.error, null);
    expect(store.lawyers, isEmpty);
    store.dispose();
    api.dispose();
  });
  test('network failures become recoverable error state', () async {
    final api = LawyerApi(
      MockClient((_) async => http.Response('', 503)),
      'https://example.test/api',
    );
    final store = LawyerStore(api);
    await store.load();
    expect(store.loading, false);
    expect(store.error, isNotNull);
    store.dispose();
    api.dispose();
  });
}
