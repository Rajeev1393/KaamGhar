import 'package:material_ui/material_ui.dart';
import 'package:flutter_localizations/flutter_localizations.dart'
    show GlobalWidgetsLocalizations;
import 'package:shared_preferences/shared_preferences.dart';

import 'account.dart';
import 'api.dart';
import 'language.dart';
import 'workspace.dart';

void main() => runApp(const ProviderApp());

class ProviderApp extends StatefulWidget {
  const ProviderApp({super.key});

  @override
  State<ProviderApp> createState() => _ProviderAppState();
}

class _ProviderAppState extends State<ProviderApp> {
  final api = ProviderApi();
  final preferences = SharedPreferencesAsync();
  Json? user;
  String language = 'en';
  String? sessionError;
  String? notice;
  bool checking = true;

  @override
  void initState() {
    super.initState();
    restore();
  }

  Future<void> restore() async {
    setState(() {
      checking = true;
      sessionError = null;
    });
    try {
      final saved = await preferences.getString('provider.language');
      if (mounted && languages.containsKey(saved)) {
        setState(() => language = saved!);
      }
      await api.restoreSession();
      final response = await api.request('auth/me');
      final account = response['user'] as Json?;
      if (mounted && account?['role'] == 'worker') {
        setState(() => user = account);
      }
    } catch (error) {
      if (mounted && !(error is ApiException && error.status == 401)) {
        setState(() => sessionError = error.toString());
      }
    } finally {
      if (mounted) setState(() => checking = false);
    }
  }

  @override
  void dispose() {
    api.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ProviderLanguage(
    code: language,
    change: (code) {
      setState(() => language = code);
      preferences.setString('provider.language', code);
    },
    child: MaterialApp(
      title: 'KaamGhar Provider',
      debugShowCheckedModeBanner: false,
      locale: Locale(language),
      supportedLocales: languages.keys.map(Locale.new),
      localizationsDelegates: [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ],
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xff006653)),
        inputDecorationTheme: const InputDecorationTheme(
          border: OutlineInputBorder(),
        ),
      ),
      home: checking
          ? const Scaffold(body: Center(child: CircularProgressIndicator()))
          : user == null
          ? AccountScreen(
              api: api,
              sessionError: sessionError,
              retry: restore,
              onAuthenticated: (account, warnings) => setState(() {
                user = account;
                notice = warnings;
              }),
            )
          : Workspace(
              api: api,
              user: user!,
              notice: notice,
              onSignedOut: () => setState(() {
                user = null;
                notice = null;
                sessionError = null;
              }),
            ),
    ),
  );
}
