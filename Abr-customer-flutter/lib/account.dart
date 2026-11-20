import 'package:material_ui/material_ui.dart';

import 'api.dart';
import 'strings.dart';
import 'widgets.dart';

enum _Mode { login, register, reset }

class AccountPage extends StatefulWidget {
  const AccountPage({super.key, required this.api});
  final CustomerApi api;

  @override
  State<AccountPage> createState() => _AccountPageState();
}

class _AccountPageState extends State<AccountPage> {
  final form = GlobalKey<FormState>();
  final email = TextEditingController();
  final password = TextEditingController();
  final name = TextEditingController();
  final phone = TextEditingController();
  _Mode mode = _Mode.login;
  bool busy = false;
  bool hidePassword = true;
  String error = '';

  @override
  void dispose() {
    for (final field in [email, password, name, phone]) {
      field.dispose();
    }
    super.dispose();
  }

  void _setMode(_Mode next) {
    setState(() {
      mode = next;
      error = '';
      password.clear();
    });
  }

  Future<void> _submit() async {
    if (busy || !(form.currentState?.validate() ?? false)) return;
    setState(() {
      busy = true;
      error = '';
    });
    try {
      if (mode == _Mode.reset) {
        final result = await widget.api.request(
          'auth/forgot-password',
          method: 'POST',
          body: {'email': email.text.trim()},
        );
        if (mounted) {
          showNotice(
            context,
            result['message'] as String? ?? context.t('Check your email.'),
          );
          _setMode(_Mode.login);
        }
        return;
      }
      final result = await widget.api.request(
        mode == _Mode.register ? 'auth/register' : 'auth/login',
        method: 'POST',
        body: {
          'email': email.text.trim(),
          'password': password.text,
          if (mode == _Mode.register) ...{
            'name': name.text.trim(),
            'phone': phone.text.trim(),
            'role': 'customer',
          },
        },
      );
      final user = result['user'] as Json;
      if (user['role'] != 'customer') {
        await widget.api.signOut();
        throw const ApiException(
          403,
          'Please sign in with a customer account.',
        );
      }
      if (mounted) Navigator.pop(context, user);
    } catch (reason) {
      if (mounted) setState(() => error = reason.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final title = context.t(switch (mode) {
      _Mode.login => 'Sign in',
      _Mode.register => 'Create account',
      _Mode.reset => 'Reset password',
    });
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 460),
          child: ListView(
            padding: const EdgeInsets.all(24),
            shrinkWrap: true,
            children: [
              Text(title, style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 20),
              Form(
                key: form,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (mode == _Mode.register) ...[
                      _field(
                        name,
                        'Full name',
                        validate: (value) => value.trim().length >= 2,
                      ),
                      _field(
                        phone,
                        'Phone number',
                        keyboard: TextInputType.phone,
                        validate: (value) => value.trim().length >= 8,
                      ),
                    ],
                    _field(
                      email,
                      'Email address',
                      keyboard: TextInputType.emailAddress,
                      validate: (value) => value.contains('@'),
                    ),
                    if (mode != _Mode.reset)
                      _field(
                        password,
                        'Password',
                        secret: true,
                        validate: (value) => value.length >= 8,
                      ),
                    if (error.isNotEmpty) PageError(context.t(error)),
                    FilledButton(
                      onPressed: busy ? null : _submit,
                      child: Text(
                        busy
                            ? context.t('One moment…')
                            : context.t(
                                mode == _Mode.reset ? 'Send reset link' : title,
                              ),
                      ),
                    ),
                    if (mode == _Mode.login) ...[
                      TextButton(
                        onPressed: busy ? null : () => _setMode(_Mode.reset),
                        child: Text(context.t('Forgot password?')),
                      ),
                      OutlinedButton(
                        onPressed: busy ? null : () => _setMode(_Mode.register),
                        child: Text(context.t('Create account')),
                      ),
                    ] else
                      TextButton(
                        onPressed: busy ? null : () => _setMode(_Mode.login),
                        child: Text(context.t('Back to sign in')),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _field(
    TextEditingController controller,
    String label, {
    TextInputType? keyboard,
    bool secret = false,
    required bool Function(String) validate,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 14),
    child: TextFormField(
      controller: controller,
      enabled: !busy,
      obscureText: secret && hidePassword,
      keyboardType: keyboard,
      decoration: InputDecoration(
        labelText: context.t(label),
        suffixIcon: secret
            ? IconButton(
                tooltip: context.t(
                  hidePassword ? 'Show password' : 'Hide password',
                ),
                onPressed: () => setState(() => hidePassword = !hidePassword),
                icon: Icon(
                  hidePassword
                      ? Icons.visibility_outlined
                      : Icons.visibility_off_outlined,
                ),
              )
            : null,
      ),
      validator: (value) =>
          validate(value ?? '') ? null : context.t('Check this field.'),
    ),
  );
}
