import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:provider/provider.dart';
import 'package:legal_service_app/features/lawyers/lawyer_api.dart';
import 'package:legal_service_app/features/lawyers/lawyer_store.dart';
import 'package:legal_service_app/features/lawyers/screens.dart';

void main() {
  testWidgets('browse screen renders loading then an empty state', (
    tester,
  ) async {
    final api = LawyerApi(
      MockClient(
        (request) async => http.Response(
          request.url.path.endsWith('specializations')
              ? '[]'
              : '{"items":[],"totalCount":0}',
          200,
        ),
      ),
      'https://example.test/api',
    );
    final store = LawyerStore(api)..load();
    await tester.pumpWidget(
      ChangeNotifierProvider.value(
        value: store,
        child: const MaterialApp(home: LawyerBrowseScreen()),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Find a lawyer'), findsOneWidget);
    expect(find.text('No lawyers match your search.'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
    store.dispose();
    api.dispose();
  });
}
