import 'package:material_ui/material_ui.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:kaamghar_provider/account.dart';
import 'package:kaamghar_provider/api.dart';
import 'package:kaamghar_provider/language.dart';
import 'package:kaamghar_provider/workspace.dart';

void main() {
  testWidgets(
    'Provider signup loads categories and offers verification documents',
    (tester) async {
      final api = ProviderApi(
        client: MockClient((request) async {
          expect(request.url.path, '/api/workers/categories');
          return http.Response(
            '{"categories":[{"name":"Plumber","label":"Plumbing"}]}',
            200,
          );
        }),
      );
      addTearDown(api.dispose);
      await tester.pumpWidget(
        ProviderLanguage(
          code: 'en',
          change: (_) {},
          child: MaterialApp(
            home: AccountScreen(
              api: api,
              sessionError: null,
              retry: () {},
              onAuthenticated: (_, _) {},
            ),
          ),
        ),
      );
      expect(find.text('Sign in to provider portal'), findsOneWidget);
      await tester.tap(find.text('Create a provider account'));
      await tester.pumpAndSettle();
      expect(find.text('Create a provider account'), findsOneWidget);
      await tester.ensureVisible(find.text('Aadhaar card'));
      expect(find.text('Aadhaar card'), findsOneWidget);
    },
  );

  testWidgets('Provider can accept an assigned request and see its new status', (
    tester,
  ) async {
    var status = 'pending';
    final api = ProviderApi(
      client: MockClient((request) async {
        final body = switch (request.url.path) {
          '/api/workers/categories' => '{"categories":[]}',
          '/api/workers/me' => '{"worker":{"approvalStatus":"approved"}}',
          '/api/workers/me/earnings' =>
            '{"earnings":{"total":500,"pending":500,"cleared":0}}',
          '/api/bookings' =>
            '{"bookings":[{"_id":"test-booking","customerName":"Test Customer","status":"$status","paymentStatus":"paid","totalAmount":500}]}',
          '/api/bookings/test-booking/status' =>
            '{"booking":{"status":"confirmed"}}',
          _ => throw StateError('Unexpected route: ${request.url.path}'),
        };
        if (request.method == 'PATCH') {
          expect(request.body, '{"status":"confirmed"}');
          status = 'confirmed';
        }
        return http.Response(body, 200);
      }),
    );
    addTearDown(api.dispose);
    await tester.pumpWidget(
      ProviderLanguage(
        code: 'en',
        change: (_) {},
        child: MaterialApp(
          home: Workspace(
            api: api,
            user: {'name': 'Test Provider'},
            notice: null,
            onSignedOut: () {},
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Accept job'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Accept job'));
    await tester.pumpAndSettle();
    expect(status, 'confirmed');
    expect(find.text('Mark complete'), findsOneWidget);
    expect(find.text('Cancel & flag refund'), findsOneWidget);
  });
}
