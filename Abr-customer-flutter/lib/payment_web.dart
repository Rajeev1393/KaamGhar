import 'dart:async';
import 'dart:js_interop';

import 'api.dart';

@JS('kaamgharOpenPayment')
external void _open(
  JSAny? options,
  JSFunction success,
  JSFunction dismiss,
  JSFunction fail,
);

bool get paymentSupported => true;

Future<Json?> openPayment(Json options) {
  final completion = Completer<Json?>();
  _open(
    options.jsify(),
    ((JSString order, JSString payment, JSString signature) {
      if (!completion.isCompleted) {
        completion.complete({
          'razorpay_order_id': order.toDart,
          'razorpay_payment_id': payment.toDart,
          'razorpay_signature': signature.toDart,
        });
      }
    }).toJS,
    (() {
      if (!completion.isCompleted) completion.complete(null);
    }).toJS,
    ((JSString message) {
      if (!completion.isCompleted) {
        completion.completeError(StateError(message.toDart));
      }
    }).toJS,
  );
  return completion.future.timeout(const Duration(minutes: 15));
}
