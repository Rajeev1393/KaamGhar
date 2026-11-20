import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:kaamghar_customer/api.dart';
import 'package:kaamghar_customer/main.dart';
import 'package:material_ui/material_ui.dart';
import 'package:shared_preferences/shared_preferences.dart';

class TestCustomerApi extends CustomerApi {
  TestCustomerApi(http.Client client) : super(client: client);

  @override
  Future<void> restoreSession() async {}
}

void main() {
  testWidgets('Customer app loads service data and gates private tabs', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final preferences = await SharedPreferences.getInstance();
    final seen = <String>[];
    final client = MockClient((request) async {
      final path = request.url.path;
      seen.add(path);
      return switch (path) {
        '/api/auth/me' => http.Response('{"message":"Please sign in."}', 401),
        '/api/workers/categories' => http.Response(
          '{"categories":[{"name":"Plumber","label":"Plumbing"}]}',
          200,
        ),
        '/api/workers' => http.Response(
          '{"workers":[{"_id":"worker","name":"Sample Professional","profession":"Plumber","city":"Delhi","price":500}]}',
          200,
        ),
        _ => http.Response('{"message":"Unexpected request"}', 500),
      };
    });
    await tester.pumpWidget(
      CustomerApp(
        api: TestCustomerApi(client),
        preferences: preferences,
        initialLocale: const Locale('en'),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('KaamGhar'), findsOneWidget);
    expect(find.text('Plumbing'), findsOneWidget);
    expect(
      seen,
      containsAll(['/api/auth/me', '/api/workers/categories', '/api/workers']),
    );
    await tester.tap(find.text('Support'));
    await tester.pumpAndSettle();
    expect(find.text('Sign in'), findsWidgets);
    expect(seen, isNot(contains('/api/support')));
  });

  testWidgets('Signed-in customer can read and send support messages', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final preferences = await SharedPreferences.getInstance();
    final client = MockClient((request) async {
      switch (request.url.path) {
        case '/api/auth/me':
          return http.Response(
            '{"user":{"role":"customer","name":"Test Customer","email":"test@example.org"}}',
            200,
          );
        case '/api/workers/categories':
          return http.Response('{"categories":[]}', 200);
        case '/api/workers':
          return http.Response('{"workers":[]}', 200);
        case '/api/support':
          if (request.method == 'POST') {
            expect(jsonDecode(request.body), {'text': 'Booking question'});
            return http.Response(
              '{"message":{"_id":"2","sender":"customer","text":"Booking question"}}',
              201,
            );
          }
          return http.Response(
            '{"messages":[{"_id":"1","sender":"support","text":"Hello","attachment":{"name":"receipt.pdf","size":5,"mimeType":"application/pdf"}}]}',
            200,
          );
        default:
          return http.Response('{}', 404);
      }
    });
    await tester.pumpWidget(
      CustomerApp(
        api: TestCustomerApi(client),
        preferences: preferences,
        initialLocale: const Locale('en'),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Support'));
    await tester.pumpAndSettle();
    expect(find.text('Hello'), findsOneWidget);
    expect(find.text('receipt.pdf'), findsOneWidget);
    await tester.enterText(find.byType(TextField), 'Booking question');
    await tester.tap(find.byTooltip('Send'));
    await tester.pumpAndSettle();
    expect(find.text('Booking question'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });
}
