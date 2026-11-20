import 'package:material_ui/material_ui.dart';

import 'messages.dart';

const languages = {
  'en': 'English',
  'hi': 'हिन्दी',
  'pa': 'ਪੰਜਾਬੀ',
  'mr': 'मराठी',
};

class ProviderLanguage extends InheritedWidget {
  const ProviderLanguage({
    required this.code,
    required this.change,
    required super.child,
    super.key,
  });

  final String code;
  final ValueChanged<String> change;

  static ProviderLanguage of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<ProviderLanguage>()!;

  @override
  bool updateShouldNotify(ProviderLanguage oldWidget) => code != oldWidget.code;
}

extension ProviderTranslation on BuildContext {
  String t(String message, [Map<String, Object?> values = const {}]) {
    final index = languages.keys.toList().indexOf(
      ProviderLanguage.of(this).code,
    );
    var translated = index > 0
        ? (messages[message]?[index - 1] ?? message)
        : message;
    for (final entry in values.entries) {
      translated = translated.replaceAll('{${entry.key}}', '${entry.value}');
    }
    return translated;
  }
}

class LanguageMenu extends StatelessWidget {
  const LanguageMenu({super.key});

  @override
  Widget build(BuildContext context) {
    final language = ProviderLanguage.of(context);
    return PopupMenuButton<String>(
      tooltip: 'Language',
      icon: const Icon(Icons.language),
      initialValue: language.code,
      onSelected: language.change,
      itemBuilder: (context) => [
        for (final entry in languages.entries)
          PopupMenuItem(value: entry.key, child: Text(entry.value)),
      ],
    );
  }
}
