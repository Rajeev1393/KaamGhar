import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:material_ui/material_ui.dart';
import 'package:geolocator/geolocator.dart';

import 'api.dart';
import 'fields.dart';
import 'language.dart';

const profileFields = [
  professionField,
  cityField,
  experienceField,
  priceField,
  descriptionField,
];

class ProfileEditor extends StatefulWidget {
  const ProfileEditor({
    required this.api,
    required this.profile,
    required this.categories,
    required this.onSaved,
    super.key,
  });
  final ProviderApi api;
  final Json profile;
  final List<Json> categories;
  final ValueChanged<Json> onSaved;

  @override
  State<ProfileEditor> createState() => _ProfileEditorState();
}

class _ProfileEditorState extends State<ProfileEditor> {
  final form = GlobalKey<FormState>();
  late final fields = {
    for (final field in profileFields)
      field.key: TextEditingController(
        text: widget.profile[field.key]?.toString() ?? '',
      ),
  };
  late String? category = widget.profile['category'] as String?;
  late bool available = widget.profile['available'] == true;
  bool busy = false;

  @override
  void dispose() {
    for (final controller in fields.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> run(Future<void> Function() action) async {
    setState(() => busy = true);
    try {
      await action();
    } catch (error) {
      if (mounted) notify(error.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  void notify(String message) {
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(context.t(message))));
  }

  void save() {
    if (!form.currentState!.validate()) return;
    run(() async {
      final result = await widget.api.request(
        'workers/me',
        method: 'PATCH',
        body: {
          for (final field in profileFields)
            field.key: field.numeric
                ? int.parse(fields[field.key]!.text.trim())
                : fields[field.key]!.text.trim(),
          'category': category,
          'available': available,
        },
      );
      if (mounted) {
        widget.onSaved(result['worker'] as Json);
        notify('Your profile is saved.');
      }
    });
  }

  void locate() => run(() async {
    if (defaultTargetPlatformSupportsPermission()) {
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        throw const FormatException(
          'Allow location access or enter your city manually.',
        );
      }
    }
    final position = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.medium,
        timeLimit: Duration(seconds: 10),
      ),
    );
    final result = await widget.api.request(
      'location/reverse',
      query: {
        'latitude': position.latitude.toString(),
        'longitude': position.longitude.toString(),
      },
    );
    if (mounted) fields['city']!.text = result['city'] as String;
  });

  bool defaultTargetPlatformSupportsPermission() =>
      !kIsWeb && defaultTargetPlatform == TargetPlatform.android;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(20),
      child: Form(
        key: form,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              context.t('Professional profile'),
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 16),
            CategoryField(
              categories: widget.categories,
              value: category,
              onChanged: busy
                  ? null
                  : (value) => setState(() => category = value),
            ),
            for (final field in profileFields) ...[
              ProviderField(
                field,
                controller: fields[field.key]!,
                enabled: !busy,
              ),
              if (field == cityField)
                Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton.icon(
                    onPressed: busy ? null : locate,
                    icon: const Icon(Icons.my_location),
                    label: Text(context.t('Use my location')),
                  ),
                ),
            ],
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(context.t('Accept new bookings')),
              value: available,
              onChanged: busy
                  ? null
                  : (value) => setState(() => available = value),
            ),
            if (busy) const LinearProgressIndicator(),
            FilledButton(
              onPressed: busy ? null : save,
              child: Text(context.t('Save profile')),
            ),
          ],
        ),
      ),
    ),
  );
}

class DocumentsPanel extends StatefulWidget {
  const DocumentsPanel({
    required this.api,
    required this.documents,
    required this.onUploaded,
    super.key,
  });
  final ProviderApi api;
  final List<Json> documents;
  final VoidCallback onUploaded;

  @override
  State<DocumentsPanel> createState() => _DocumentsPanelState();
}

class _DocumentsPanelState extends State<DocumentsPanel> {
  String type = 'identity';
  PlatformFile? selected;
  bool busy = false;
  String? error;

  Future<void> run(Future<void> Function() action) async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await action();
    } catch (reason) {
      if (mounted) setState(() => error = reason.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            context.t('Verification documents'),
            style: Theme.of(context).textTheme.titleLarge,
          ),
          Text(
            context.t('{count}/10 uploaded', {
              'count': widget.documents.length,
            }),
          ),
          Text(
            context.t(
              'Upload documents for admin review. PDF, JPG, or PNG, up to 5 MB each.',
            ),
          ),
          const SizedBox(height: 16),
          DropdownButtonFormField<String>(
            initialValue: type,
            isExpanded: true,
            decoration: InputDecoration(labelText: context.t('Document type')),
            items: [
              for (final entry in documentTypes.entries)
                DropdownMenuItem(
                  value: entry.key,
                  child: Text(context.t(entry.value)),
                ),
            ],
            onChanged: busy ? null : (value) => setState(() => type = value!),
          ),
          OutlinedButton.icon(
            icon: const Icon(Icons.attach_file),
            label: Text(selected?.name ?? context.t('Choose file')),
            onPressed: busy || widget.documents.length >= 10
                ? null
                : () => run(() async {
                    final file = await chooseDocument();
                    if (mounted && file != null) {
                      setState(() => selected = file);
                    }
                  }),
          ),
          FilledButton(
            onPressed: busy || selected == null || widget.documents.length >= 10
                ? null
                : () => run(() async {
                    await upload(widget.api, type, selected!);
                    if (mounted) {
                      setState(() => selected = null);
                      widget.onUploaded();
                    }
                  }),
            child: Text(context.t('Upload document')),
          ),
          if (busy) const LinearProgressIndicator(),
          if (error != null)
            Text(
              context.t(error!),
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          for (final document in widget.documents)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.description_outlined),
              title: Text(document['originalName']?.toString() ?? ''),
              subtitle: Text(
                context.t(
                  documentTypes[document['type']] ??
                      document['type'].toString(),
                ),
              ),
              trailing: Text(context.t(statusLabel(document['status']))),
            ),
        ],
      ),
    ),
  );
}

String statusLabel(Object? status) {
  final text = status?.toString() ?? '';
  return text.isEmpty ? '—' : '${text[0].toUpperCase()}${text.substring(1)}';
}
