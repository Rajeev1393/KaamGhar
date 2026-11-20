import 'package:material_ui/material_ui.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'account.dart';
import 'api.dart';
import 'booking.dart';
import 'marketplace.dart';
import 'strings.dart';
import 'support.dart';
import 'widgets.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final preferences = await SharedPreferences.getInstance();
  final theme = preferences.getString('theme');
  final language = preferences.getString('language');
  runApp(
    CustomerApp(
      api: CustomerApi(),
      preferences: preferences,
      initialTheme: ThemeMode.values.firstWhere(
        (mode) => mode.name == theme,
        orElse: () => ThemeMode.system,
      ),
      initialLocale: languages.containsKey(language) ? Locale(language!) : null,
    ),
  );
}

class CustomerApp extends StatefulWidget {
  const CustomerApp({
    super.key,
    required this.api,
    required this.preferences,
    this.initialTheme = ThemeMode.system,
    this.initialLocale,
  });

  final CustomerApi api;
  final SharedPreferences preferences;
  final ThemeMode initialTheme;
  final Locale? initialLocale;

  @override
  State<CustomerApp> createState() => _CustomerAppState();
}

class _CustomerAppState extends State<CustomerApp> {
  late ThemeMode theme = widget.initialTheme;
  late Locale? locale = widget.initialLocale;

  ThemeData _theme(Brightness brightness) {
    final scheme = ColorScheme.fromSeed(
      seedColor: const Color(0xff24664f),
      brightness: brightness,
    );
    return ThemeData(
      colorScheme: scheme,
      scaffoldBackgroundColor: brightness == Brightness.light
          ? const Color(0xfff6f5ee)
          : scheme.surface,
      inputDecorationTheme: const InputDecorationTheme(
        border: OutlineInputBorder(),
      ),
      cardTheme: const CardThemeData(elevation: 0, margin: EdgeInsets.zero),
    );
  }

  @override
  void dispose() {
    widget.api.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'KaamGhar',
    debugShowCheckedModeBanner: false,
    localizationsDelegates: GlobalMaterialLocalizations.delegates,
    supportedLocales: languages.keys.map(Locale.new),
    locale: locale,
    themeMode: theme,
    theme: _theme(Brightness.light),
    darkTheme: _theme(Brightness.dark),
    home: CustomerHome(
      api: widget.api,
      theme: theme,
      locale: locale,
      onTheme: (value) async {
        setState(() => theme = value);
        await widget.preferences.setString('theme', value.name);
      },
      onLocale: (value) async {
        setState(() => locale = value);
        if (value == null) {
          await widget.preferences.remove('language');
        } else {
          await widget.preferences.setString('language', value.languageCode);
        }
      },
    ),
  );
}

class CustomerHome extends StatefulWidget {
  const CustomerHome({
    super.key,
    required this.api,
    required this.theme,
    required this.locale,
    required this.onTheme,
    required this.onLocale,
  });
  final CustomerApi api;
  final ThemeMode theme;
  final Locale? locale;
  final ValueChanged<ThemeMode> onTheme;
  final ValueChanged<Locale?> onLocale;

  @override
  State<CustomerHome> createState() => _CustomerHomeState();
}

class _CustomerHomeState extends State<CustomerHome> {
  Json? user;
  int tab = 0;
  bool checking = true;
  bool authenticating = false;

  @override
  void initState() {
    super.initState();
    _restore();
  }

  Future<void> _restore() async {
    try {
      await widget.api.restoreSession();
      final response = await widget.api.request('auth/me');
      final account = response['user'] as Json;
      if (mounted && account['role'] == 'customer') {
        setState(() => user = account);
      }
    } catch (error) {
      if (mounted &&
          !(error is ApiException && [401, 403].contains(error.status))) {
        showNotice(context, error.toString());
      }
    } finally {
      if (mounted) setState(() => checking = false);
    }
  }

  Future<Json?> _signIn() async {
    if (user != null) return user;
    if (checking || authenticating) return null;
    authenticating = true;
    try {
      final result = await Navigator.of(context).push<Json>(
        MaterialPageRoute(builder: (_) => AccountPage(api: widget.api)),
      );
      if (mounted && result != null) setState(() => user = result);
      return result;
    } finally {
      authenticating = false;
    }
  }

  Future<void> _book(Json worker) async {
    final customer = await _signIn();
    if (!mounted || customer == null) return;
    final done = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) =>
            BookingPage(api: widget.api, user: customer, worker: worker),
      ),
    );
    if (mounted && done == true) {
      setState(() => tab = 1);
      showNotice(context, context.t('Payment successful.'));
    }
  }

  Future<void> _signOut() async {
    try {
      await widget.api.signOut();
      if (mounted) {
        setState(() {
          user = null;
          tab = 0;
        });
      }
    } catch (error) {
      if (mounted) showNotice(context, error.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    final content = switch (tab) {
      1 =>
        user == null
            ? _signInPrompt(context)
            : BookingsPage(api: widget.api, user: user!),
      2 => user == null ? _signInPrompt(context) : SupportPage(api: widget.api),
      3 => ListView(
        padding: const EdgeInsets.all(20),
        children: [
          if (user case final account?) ...[
            ListTile(
              leading: const CircleAvatar(child: Icon(Icons.person_outline)),
              title: Text(account['name'] as String),
              subtitle: Text(account['email'] as String),
            ),
            TextButton.icon(
              onPressed: _signOut,
              icon: const Icon(Icons.logout),
              label: Text(context.t('Sign out')),
            ),
          ] else if (!checking)
            FilledButton(onPressed: _signIn, child: Text(context.t('Sign in'))),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: widget.locale?.languageCode ?? '',
            decoration: InputDecoration(labelText: context.t('Language')),
            items: [
              DropdownMenuItem(
                value: '',
                child: Text(context.t('Device language')),
              ),
              ...languages.entries.map(
                (entry) => DropdownMenuItem(
                  value: entry.key,
                  child: Text(entry.value),
                ),
              ),
            ],
            onChanged: (value) => widget.onLocale(
              value == null || value.isEmpty ? null : Locale(value),
            ),
          ),
          const SizedBox(height: 14),
          DropdownButtonFormField<ThemeMode>(
            initialValue: widget.theme,
            decoration: InputDecoration(labelText: context.t('Theme')),
            items: ThemeMode.values
                .map(
                  (mode) => DropdownMenuItem(
                    value: mode,
                    child: Text(
                      context.t(switch (mode) {
                        ThemeMode.system => 'System',
                        ThemeMode.light => 'Light',
                        ThemeMode.dark => 'Dark',
                      }),
                    ),
                  ),
                )
                .toList(),
            onChanged: (value) {
              if (value != null) widget.onTheme(value);
            },
          ),
        ],
      ),
      _ => Marketplace(api: widget.api, onBook: _book),
    };
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'KaamGhar',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
        actions: [
          if (checking)
            const Padding(
              padding: EdgeInsets.all(16),
              child: SizedBox.square(
                dimension: 18,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            )
          else if (user == null)
            TextButton(onPressed: _signIn, child: Text(context.t('Sign in')))
          else
            IconButton(
              tooltip: context.t('Account'),
              onPressed: () => setState(() => tab = 3),
              icon: const Icon(Icons.account_circle_outlined),
            ),
          const SizedBox(width: 8),
        ],
      ),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 960),
          child: content,
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: tab,
        onDestinationSelected: (value) => setState(() => tab = value),
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.search),
            label: context.t('Services'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.calendar_month_outlined),
            label: context.t('Bookings'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.chat_bubble_outline),
            label: context.t('Support'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.person_outline),
            label: context.t('Account'),
          ),
        ],
      ),
    );
  }

  Widget _signInPrompt(BuildContext context) => Center(
    child: checking
        ? const CircularProgressIndicator()
        : FilledButton(onPressed: _signIn, child: Text(context.t('Sign in'))),
  );
}
