import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';

typedef Json = Map<String, dynamic>;

List<Json> records(Json response, String key) =>
    (response[key] as List).cast<Json>();

class ApiException implements Exception {
  const ApiException(this.status, this.message);
  final int status;
  final String message;
  @override
  String toString() => message;
}

class ProviderApi {
  ProviderApi({http.Client? client}) : _client = client ?? http.Client();

  static const _storage = FlutterSecureStorage();
  static const _sessionKey = 'kaamghar.provider.session';
  static const _configuredOrigin = String.fromEnvironment('KAAMGHAR_URL');
  final http.Client _client;
  String? _session;

  static Uri get origin {
    if (_configuredOrigin.isNotEmpty) return Uri.parse(_configuredOrigin);
    if (kIsWeb) return Uri.parse(Uri.base.origin);
    return Uri.parse(
      defaultTargetPlatform == TargetPlatform.android
          ? 'http://10.0.2.2:3001'
          : 'http://localhost:3001',
    );
  }

  Future<void> restoreSession() async {
    if (!kIsWeb) {
      _session = await _storage.read(key: '${origin.origin}:$_sessionKey');
    }
  }

  Future<void> _saveSession(String? value) async {
    _session = value;
    if (kIsWeb) return;
    final key = '${origin.origin}:$_sessionKey';
    if (value == null) {
      await _storage.delete(key: key);
    } else {
      await _storage.write(key: key, value: value);
    }
  }

  Uri _uri(String path, Map<String, String>? query) =>
      origin.replace(path: '/api/$path', queryParameters: query);

  Map<String, String> get _headers => {
    if (!kIsWeb && _session != null) 'Cookie': 'kg_session=$_session',
  };

  Future<Json> request(
    String path, {
    String method = 'GET',
    Json? body,
    Map<String, String>? query,
  }) async {
    final request = http.Request(method, _uri(path, query));
    request.headers.addAll(_headers);
    if (body != null) {
      request.headers['Content-Type'] = 'application/json';
      request.body = jsonEncode(body);
    }
    final response = await _send(request);
    if (!kIsWeb && (path == 'auth/login' || path == 'auth/register')) {
      final cookie = response.headers['set-cookie'] ?? '';
      final session = RegExp(r'(?:^|,\s*)kg_session=([^;,]*)')
          .firstMatch(cookie)
          ?.group(1);
      if (session == null || session.isEmpty) {
        throw const ApiException(
          502,
          'The server did not return a provider session.',
        );
      }
      await _saveSession(session);
    }
    return _decode(response);
  }

  Future<void> signOut() async {
    try {
      await request('auth/logout', method: 'POST');
    } on ApiException catch (error) {
      if (error.status != 401) rethrow;
    }
    await _saveSession(null);
  }

  Future<Json> uploadDocument(
    String type,
    String filename,
    Uint8List bytes,
    String mimeType,
  ) async {
    final request =
        http.MultipartRequest('POST', _uri('workers/me/documents', null))
          ..headers.addAll(_headers)
          ..fields['type'] = type
          ..files.add(
            http.MultipartFile.fromBytes(
              'document',
              bytes,
              filename: filename,
              contentType: MediaType.parse(mimeType),
            ),
          );
    return _decode(await _send(request));
  }

  Json _decode(http.Response response) {
    try {
      final payload = jsonDecode(utf8.decode(response.bodyBytes));
      if (payload is Json) return payload;
    } on FormatException {
      // An upstream gateway may return HTML instead of JSON.
    }
    throw const ApiException(
      502,
      'The server returned an unexpected response.',
    );
  }

  Future<http.Response> _send(http.BaseRequest request) async {
    final response = await _client
        .send(request)
        .then(http.Response.fromStream)
        .timeout(const Duration(seconds: 30));
    if (response.statusCode < 200 || response.statusCode >= 300) {
      String message = 'Request failed. Please try again.';
      try {
        message = _decode(response)['message'] as String? ?? message;
      } on ApiException {
        // Keep the fallback for a non-JSON error response.
      }
      throw ApiException(response.statusCode, message);
    }
    return response;
  }

  void dispose() => _client.close();
}
