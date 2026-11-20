import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';

Future<Json?> openWindowsPayment(Json options) async {
  final random = Random.secure();
  final ticket = List.generate(
    24,
    (_) => random.nextInt(256).toRadixString(16).padLeft(2, '0'),
  ).join();
  final script = await rootBundle.loadString('web/checkout.js');
  final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
  final url = Uri.parse('http://127.0.0.1:${server.port}/$ticket/');
  final completion = Completer<Json?>();

  server.listen((request) async {
    final response = request.response;
    response.headers.set(HttpHeaders.cacheControlHeader, 'no-store');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'no-referrer');
    try {
      if (request.headers.value(HttpHeaders.hostHeader) !=
          '${url.host}:${url.port}') {
        response.statusCode = 403;
      } else if (request.method == 'GET' && request.uri.path == url.path) {
        response.headers.contentType = ContentType.html;
        response.write(_checkoutPage);
      } else if (request.method == 'GET' &&
          request.uri.path == '${url.path}checkout.js') {
        response.headers.contentType = ContentType('application', 'javascript');
        response.write(script);
      } else if (request.method == 'GET' &&
          request.uri.path == '${url.path}options') {
        response.headers.contentType = ContentType.json;
        response.write(jsonEncode(options));
      } else if (request.method == 'POST' &&
          request.uri.path == '${url.path}result') {
        if (request.headers.value('origin') != url.origin ||
            request.contentLength < 0 ||
            request.contentLength > 4096) {
          response.statusCode = 403;
        } else {
          final payload =
              jsonDecode(await utf8.decoder.bind(request).join()) as Json;
          final result = payload['result'] as Json?;
          await response.close();
          if (!completion.isCompleted) {
            if (payload['error'] case final String error) {
              completion.completeError(StateError(error));
            } else {
              completion.complete(result);
            }
          }
          return;
        }
      } else {
        response.statusCode = 404;
      }
    } catch (_) {
      response.statusCode = 400;
    }
    await response.close();
  });

  try {
    if (!await launchUrl(url, mode: LaunchMode.externalApplication)) {
      throw StateError('Could not open your browser for Razorpay checkout.');
    }
    return await completion.future.timeout(const Duration(minutes: 15));
  } finally {
    await server.close(force: true);
  }
}

const _checkoutPage = '''
<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>KaamGhar checkout</title>
<style>
  body { font: 1rem system-ui; max-width: 34rem; margin: 10vh auto; padding: 1.5rem; color: #22362d; }
  button { font: inherit; padding: .65rem 1rem; margin-right: .5rem; }
</style>
<h1>KaamGhar checkout</h1>
<p id="status" role="status">Complete this payment to continue in the app.</p>
<button type="button" id="pay">Open Razorpay</button>
<button type="button" id="cancel">Cancel</button>
<script src="checkout.js"></script>
<script>
  const status = document.querySelector('#status');
  const pay = document.querySelector('#pay');
  const cancel = document.querySelector('#cancel');
  let finishing = false;
  async function finish(body) {
    if (finishing) return;
    finishing = true;
    pay.disabled = cancel.disabled = true;
    try {
      const response = await fetch('result', {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)
      });
      if (!response.ok) throw new Error('The app did not receive the result.');
      status.textContent = 'Return to the KaamGhar app.';
    } catch (error) {
      status.textContent = error.message + ' Return to the app to check your booking.';
    }
  }
  pay.onclick = async () => {
    pay.disabled = true;
    try {
      const response = await fetch('options');
      if (!response.ok) throw new Error('Checkout could not be started.');
      const options = await response.json();
      window.kaamgharOpenPayment(options,
        (order, payment, signature) => finish({result: {
          razorpay_order_id: order, razorpay_payment_id: payment, razorpay_signature: signature
        }}),
        () => finish({}), (error) => finish({error}));
    } catch (error) { finish({error: error.message}); }
  };
  cancel.onclick = () => finish({});
</script>
</html>
''';
