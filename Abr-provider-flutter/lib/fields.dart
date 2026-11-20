import 'package:file_picker/file_picker.dart';
import 'package:material_ui/material_ui.dart';

import 'api.dart';
import 'language.dart';

const onboardingDocuments = {
  'aadhaar': 'Aadhaar card',
  'pan': 'PAN card',
  'police_verification': 'Police verification',
};
const documentTypes = {
  ...onboardingDocuments,
  'identity': 'Identity proof',
  'address': 'Address proof',
  'certificate': 'Service certificate',
  'other': 'Other',
};

Future<PlatformFile?> chooseDocument() async {
  final file = await FilePicker.pickFile(
    type: FileType.custom,
    allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'],
  );
  final size = await file?.length();
  if (file != null && (size == null || size == 0 || size > 5 * 1024 * 1024)) {
    throw const FormatException('Choose a PDF, JPG, or PNG file up to 5 MB.');
  }
  return file;
}

Future<void> upload(ProviderApi api, String type, PlatformFile file) async {
  final mime = switch (file.extension?.toLowerCase()) {
    'pdf' => 'application/pdf',
    'png' => 'image/png',
    'jpg' || 'jpeg' => 'image/jpeg',
    _ => throw const FormatException(
      'Choose a PDF, JPG, or PNG file up to 5 MB.',
    ),
  };
  await api.uploadDocument(type, file.name, await file.readAsBytes(), mime);
}

class FormFieldSpec {
  const FormFieldSpec(
    this.key,
    this.label, {
    this.min = 1,
    this.max = 80,
    this.numeric = false,
  });
  final String key;
  final String label;
  final int min;
  final int max;
  final bool numeric;
}

const emailField = FormFieldSpec('email', 'Email address', max: 254);
const passwordField = FormFieldSpec('password', 'Password', min: 8, max: 72);
const professionField = FormFieldSpec('profession', 'Profession', min: 2);
const cityField = FormFieldSpec('city', 'City', min: 2);
const experienceField = FormFieldSpec(
  'experience',
  'Experience (years)',
  min: 0,
  max: 60,
  numeric: true,
);
const descriptionField = FormFieldSpec(
  'description',
  'About your service',
  min: 10,
  max: 300,
);
const priceField = FormFieldSpec(
  'price',
  'Hourly rate (₹)',
  min: 1,
  max: 1000000,
  numeric: true,
);

class ProviderField extends StatelessWidget {
  const ProviderField(
    this.spec, {
    required this.controller,
    this.enabled = true,
    super.key,
  });
  final FormFieldSpec spec;
  final TextEditingController controller;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final password = spec.key == 'password';
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: TextFormField(
        controller: controller,
        enabled: enabled,
        obscureText: password,
        maxLines: spec.key == 'description' ? 3 : 1,
        keyboardType: switch (spec.key) {
          'email' => TextInputType.emailAddress,
          'phone' => TextInputType.phone,
          _ => spec.numeric ? TextInputType.number : TextInputType.text,
        },
        decoration: InputDecoration(labelText: context.t(spec.label)),
        validator: (input) {
          final value = password ? input ?? '' : input?.trim() ?? '';
          if (spec.numeric) {
            final number = int.tryParse(value);
            if (number == null || number < spec.min || number > spec.max) {
              return context.t('Enter a number from {min} to {max}.', {
                'min': spec.min,
                'max': spec.max,
              });
            }
          } else if (value.length < spec.min || value.length > spec.max) {
            return context.t('Enter {min} to {max} characters.', {
              'min': spec.min,
              'max': spec.max,
            });
          }
          return null;
        },
      ),
    );
  }
}

class CategoryField extends StatelessWidget {
  const CategoryField({
    required this.categories,
    required this.value,
    required this.onChanged,
    super.key,
  });
  final List<Json> categories;
  final String? value;
  final ValueChanged<String?>? onChanged;

  @override
  Widget build(BuildContext context) {
    final labels = {
      ?value: ?value,
      for (final item in categories)
        item['name'] as String: item['label'] as String,
    };
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: DropdownButtonFormField<String>(
        initialValue: value,
        isExpanded: true,
        decoration: InputDecoration(labelText: context.t('Service category')),
        items: [
          for (final item in labels.entries)
            DropdownMenuItem(
              value: item.key,
              child: Text(context.t(item.value)),
            ),
        ],
        onChanged: onChanged,
        validator: (value) =>
            value == null ? context.t('Choose a category') : null,
      ),
    );
  }
}

class ContentPanel extends StatelessWidget {
  const ContentPanel({required this.child, this.width = 1040, super.key});
  final Widget child;
  final double width;

  @override
  Widget build(BuildContext context) => Align(
    alignment: Alignment.topCenter,
    child: ConstrainedBox(
      constraints: BoxConstraints(maxWidth: width),
      child: ListView(padding: const EdgeInsets.all(20), children: [child]),
    ),
  );
}
