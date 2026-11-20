import 'package:file_picker/file_picker.dart';
import 'package:material_ui/material_ui.dart';

import 'api.dart';
import 'fields.dart';
import 'language.dart';

enum AccountMode { signIn, register, reset }

const signupFields = [
  FormFieldSpec('name', 'Full name', min: 2),
  emailField,
  FormFieldSpec('phone', 'Phone number', min: 8, max: 20),
  passwordField,
  professionField,
  cityField,
  experienceField,
  descriptionField,
];

class AccountScreen extends StatefulWidget {
  const AccountScreen({
    required this.api,
    required this.onAuthenticated,
    required this.sessionError,
    required this.retry,
    super.key,
  });
  final ProviderApi api;
  final void Function(Json, String?) onAuthenticated;
  final String? sessionError;
  final VoidCallback retry;

  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  final form = GlobalKey<FormState>();
  final fields = {
    for (final field in signupFields)
      field.key: TextEditingController(text: field.numeric ? '0' : ''),
  };
  final files = <String, PlatformFile>{};
  List<Json> categories = [];
  String? category;
  String? error;
  String? message;
  bool busy = false;
  AccountMode mode = AccountMode.signIn;

  @override
  void dispose() {
    for (final controller in fields.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> setMode(AccountMode next) async {
    setState(() {
      mode = next;
      error = null;
      message = null;
      fields['password']!.clear();
      files.clear();
    });
    if (next != AccountMode.register || categories.isNotEmpty) return;
    setState(() => busy = true);
    try {
      final result = await widget.api.request('workers/categories');
      if (mounted) setState(() => categories = records(result, 'categories'));
    } catch (reason) {
      if (mounted) setState(() => error = reason.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> pick(String type) async {
    setState(() => busy = true);
    try {
      final file = await chooseDocument();
      if (mounted && file != null) setState(() => files[type] = file);
    } catch (reason) {
      if (mounted) setState(() => error = reason.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> submit() async {
    if (busy || !form.currentState!.validate()) return;
    setState(() {
      busy = true;
      error = null;
      message = null;
    });
    try {
      final body = <String, dynamic>{'email': fields['email']!.text.trim()};
      if (mode == AccountMode.reset) {
        final result = await widget.api.request(
          'auth/forgot-password',
          method: 'POST',
          body: body,
        );
        if (mounted) setState(() => message = result['message'] as String?);
        return;
      }
      body['password'] = fields['password']!.text;
      final signup = mode == AccountMode.register;
      if (signup) {
        for (final field in signupFields.where(
          (field) => !body.containsKey(field.key),
        )) {
          final value = fields[field.key]!.text.trim();
          body[field.key] = field.numeric ? int.parse(value) : value;
        }
        body.addAll({'role': 'worker', 'category': category});
      }
      final result = await widget.api.request(
        signup ? 'auth/register' : 'auth/login',
        method: 'POST',
        body: body,
      );
      final user = result['user'] as Json;
      if (user['role'] != 'worker') {
        await widget.api.signOut();
        throw const ApiException(403, 'Sign in with a provider account.');
      }
      final failed = <String>[];
      for (final entry in files.entries) {
        try {
          await upload(widget.api, entry.key, entry.value);
        } catch (reason) {
          failed.add('${documentTypes[entry.key]} ($reason)');
        }
      }
      if (mounted) {
        widget.onAuthenticated(
          user,
          failed.isEmpty
              ? null
              : context.t(
                  'Account created. Upload these documents again below: {documents}',
                  {'documents': failed.join(', ')},
                ),
        );
      }
    } catch (reason) {
      if (mounted) setState(() => error = reason.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final signup = mode == AccountMode.register;
    final reset = mode == AccountMode.reset;
    final title = switch (mode) {
      AccountMode.signIn => 'Sign in to provider portal',
      AccountMode.register => 'Create a provider account',
      AccountMode.reset => 'Reset password',
    };
    return Scaffold(
      appBar: AppBar(
        title: const Text('KaamGhar Provider'),
        actions: const [LanguageMenu()],
      ),
      body: ContentPanel(
        width: 530,
        child: Card(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Form(
              key: form,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    context.t(title),
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 24),
                  if (widget.sessionError != null) ...[
                    Text(context.t(widget.sessionError!)),
                    TextButton(
                      onPressed: busy ? null : widget.retry,
                      child: Text(context.t('Retry')),
                    ),
                  ],
                  for (final field
                      in signup
                          ? signupFields
                          : [emailField, if (!reset) passwordField])
                    ProviderField(
                      field,
                      controller: fields[field.key]!,
                      enabled: !busy,
                      key: ValueKey(field.key),
                    ),
                  if (signup) ...[
                    CategoryField(
                      categories: categories,
                      value: category,
                      onChanged: busy
                          ? null
                          : (value) => setState(() => category = value),
                    ),
                    if (categories.isEmpty && !busy)
                      TextButton(
                        onPressed: () => setMode(AccountMode.register),
                        child: Text(context.t('Reload categories')),
                      ),
                    Text(
                      context.t('Verification documents'),
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    Text(
                      context.t('Optional. PDF, JPG, or PNG, up to 5 MB each.'),
                    ),
                    for (final item in onboardingDocuments.entries)
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(context.t(item.value)),
                        subtitle: files.containsKey(item.key)
                            ? Text(files[item.key]!.name)
                            : null,
                        onTap: busy ? null : () => pick(item.key),
                        trailing: IconButton(
                          tooltip: context.t(
                            files.containsKey(item.key)
                                ? 'Remove'
                                : 'Choose file',
                          ),
                          icon: Icon(
                            files.containsKey(item.key)
                                ? Icons.close
                                : Icons.attach_file,
                          ),
                          onPressed: busy
                              ? null
                              : files.containsKey(item.key)
                              ? () => setState(() => files.remove(item.key))
                              : () => pick(item.key),
                        ),
                      ),
                  ],
                  if (error != null)
                    Text(
                      context.t(error!),
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                  if (message != null) Text(context.t(message!)),
                  if (busy) const LinearProgressIndicator(),
                  FilledButton(
                    onPressed: busy || (signup && categories.isEmpty)
                        ? null
                        : submit,
                    child: Text(
                      context.t(
                        signup
                            ? 'Create account'
                            : reset
                            ? 'Send reset link'
                            : 'Sign in',
                      ),
                    ),
                  ),
                  if (mode == AccountMode.signIn) ...[
                    TextButton(
                      onPressed: busy ? null : () => setMode(AccountMode.reset),
                      child: Text(context.t('Forgot password?')),
                    ),
                    OutlinedButton(
                      onPressed: busy
                          ? null
                          : () => setMode(AccountMode.register),
                      child: Text(context.t('Create a provider account')),
                    ),
                  ] else
                    TextButton(
                      onPressed: busy
                          ? null
                          : () => setMode(AccountMode.signIn),
                      child: Text(context.t('Back to sign in')),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
