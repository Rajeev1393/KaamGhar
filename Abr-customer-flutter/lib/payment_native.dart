import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

import 'api.dart';
import 'payment_windows.dart';

bool get paymentSupported =>
    defaultTargetPlatform == TargetPlatform.android ||
    defaultTargetPlatform == TargetPlatform.iOS ||
    defaultTargetPlatform == TargetPlatform.windows;

Future<Json?> openPayment(Json options) async {
  if (defaultTargetPlatform == TargetPlatform.windows) {
    return openWindowsPayment(options);
  }
  final razorpay = Razorpay();
  final completion = Completer<Json?>();
  razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, (PaymentSuccessResponse result) {
    if (!completion.isCompleted) {
      completion.complete({
        'razorpay_order_id': result.orderId,
        'razorpay_payment_id': result.paymentId,
        'razorpay_signature': result.signature,
      });
    }
  });
  razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, (PaymentFailureResponse result) {
    if (!completion.isCompleted) {
      completion.completeError(
        StateError(result.message ?? 'Payment cancelled or declined.'),
      );
    }
  });
  razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, (ExternalWalletResponse _) {
    if (!completion.isCompleted) completion.complete(null);
  });
  try {
    razorpay.open(options);
    return await completion.future.timeout(const Duration(minutes: 15));
  } finally {
    razorpay.clear();
  }
}
