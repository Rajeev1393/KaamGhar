import 'dart:async';

import 'package:file_picker/file_picker.dart';
import 'package:material_ui/material_ui.dart';

import 'api.dart';
import 'strings.dart';
import 'widgets.dart';

class SupportPage extends StatefulWidget {
  const SupportPage({super.key, required this.api});
  final CustomerApi api;
  @override
  State<SupportPage> createState() => _SupportPageState();
}

class _SupportPageState extends State<SupportPage> with WidgetsBindingObserver {
  final draft = TextEditingController();
  final scroll = ScrollController();
  late final Timer timer;
  List<Json> messages = [];
  PlatformFile? attachment;
  bool loading = true;
  bool fetching = false;
  bool sending = false;
  bool visible = true;
  String loadError = '';
  String sendError = '';
  static const mimeTypes = {
    'pdf': 'application/pdf',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
  };

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _load();
    timer = Timer.periodic(const Duration(seconds: 5), (_) {
      if (visible) _load();
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    visible = state == AppLifecycleState.resumed;
    if (visible) _load();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    timer.cancel();
    draft.dispose();
    scroll.dispose();
    super.dispose();
  }

  void _merge(List<Json> incoming, {bool scrollToLast = false}) {
    final nearBottom = !scroll.hasClients || scroll.position.extentAfter < 55;
    final byId = {
      for (final message in [...messages, ...incoming])
        message['_id'] as String: message,
    };
    final ids = byId.keys.toList()..sort();
    final updated = ids
        .skip(ids.length > 100 ? ids.length - 100 : 0)
        .map((id) => byId[id]!)
        .toList();
    final changed = messages.lastOrNull?['_id'] != updated.lastOrNull?['_id'];
    setState(() => messages = updated);
    if (scrollToLast || (nearBottom && changed)) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && scroll.hasClients) {
          scroll.jumpTo(scroll.position.maxScrollExtent);
        }
      });
    }
  }

  Future<void> _load() async {
    if (fetching) return;
    fetching = true;
    try {
      final result = await widget.api.request('support');
      if (mounted) {
        _merge(records(result, 'messages'));
        if (loadError.isNotEmpty) setState(() => loadError = '');
      }
    } catch (reason) {
      if (mounted) setState(() => loadError = reason.toString());
    } finally {
      fetching = false;
      if (mounted && loading) setState(() => loading = false);
    }
  }

  Future<void> _pick() async {
    try {
      final file = await FilePicker.pickFile(
        type: FileType.custom,
        allowedExtensions: mimeTypes.keys.toList(),
      );
      if (!mounted || file == null) return;
      final length = await file.length();
      if (length == null ||
          length == 0 ||
          length > 5 * 1024 * 1024 ||
          !mimeTypes.containsKey(file.extension?.toLowerCase())) {
        throw const ApiException(400, 'PDF, JPG or PNG up to 5 MB');
      }
      if (mounted) {
        setState(() {
          attachment = file;
          sendError = '';
        });
      }
    } catch (reason) {
      if (mounted) setState(() => sendError = reason.toString());
    }
  }

  Future<void> _send() async {
    final text = draft.text.trim();
    final file = attachment;
    if (sending || (text.isEmpty && file == null)) return;
    setState(() {
      sending = true;
      sendError = '';
    });
    try {
      final response = file == null
          ? await widget.api.request(
              'support',
              method: 'POST',
              body: {'text': text},
            )
          : await widget.api.uploadSupport(
              text,
              file.name,
              await file.readAsBytes(),
              mimeTypes[file.extension!.toLowerCase()]!,
            );
      if (mounted) {
        _merge([response['message'] as Json], scrollToLast: true);
        setState(() {
          attachment = null;
          draft.clear();
        });
      }
    } catch (reason) {
      if (mounted) setState(() => sendError = reason.toString());
    } finally {
      if (mounted) setState(() => sending = false);
    }
  }

  Future<void> _download(String id, Json file) async {
    try {
      final bytes = await widget.api.downloadSupport(id);
      await FilePicker.saveFile(
        fileName: file['name'] as String,
        bytes: bytes,
        mimeType: file['mimeType'] as String,
      );
    } catch (reason) {
      if (mounted) showNotice(context, reason.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Column(
      children: [
        ListTile(
          title: Text(
            context.t('Support chat'),
            style: Theme.of(context).textTheme.titleLarge,
          ),
          subtitle: Text(
            context.t(
              'Send us a message about your booking, payment, or account. Replies will appear here.',
            ),
          ),
          trailing: IconButton(
            tooltip: context.t('Refresh'),
            onPressed: _load,
            icon: const Icon(Icons.refresh),
          ),
        ),
        if (loadError.isNotEmpty) PageError(context.t(loadError), retry: _load),
        if (loading) const LinearProgressIndicator(),
        Expanded(
          child: ListView(
            controller: scroll,
            padding: const EdgeInsets.all(16),
            children: [
              if (!loading && messages.isEmpty && loadError.isEmpty)
                Text(context.t('No messages yet.')),
              for (final message in messages)
                Align(
                  alignment: message['sender'] == 'customer'
                      ? Alignment.centerRight
                      : Alignment.centerLeft,
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 540),
                    child: Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: message['sender'] == 'customer'
                            ? colors.primaryContainer
                            : colors.surfaceContainerHighest,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${context.t(message['sender'] == 'customer' ? 'You' : 'Support team')} · ${localDate(message['createdAt'] as String?)}',
                            style: Theme.of(context).textTheme.labelMedium,
                          ),
                          if ((message['text'] as String? ?? '').isNotEmpty)
                            SelectableText(message['text'] as String),
                          if (message['attachment'] case final Json file)
                            TextButton.icon(
                              onPressed: () =>
                                  _download(message['_id'] as String, file),
                              icon: const Icon(Icons.download_outlined),
                              label: Text(
                                file['name'] as String,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
        if (sendError.isNotEmpty) PageError(context.t(sendError)),
        if (attachment case final file?)
          ListTile(
            dense: true,
            leading: const Icon(Icons.description_outlined),
            title: Text(file.name, overflow: TextOverflow.ellipsis),
            trailing: IconButton(
              tooltip: context.t('Remove attachment'),
              onPressed: sending
                  ? null
                  : () => setState(() => attachment = null),
              icon: const Icon(Icons.close),
            ),
          ),
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 6, 12, 12),
          child: Row(
            children: [
              IconButton(
                tooltip: context.t('Attach document'),
                onPressed: sending ? null : _pick,
                icon: const Icon(Icons.attach_file),
              ),
              Expanded(
                child: TextField(
                  controller: draft,
                  enabled: !sending,
                  maxLength: 1000,
                  maxLines: 3,
                  minLines: 1,
                  decoration: InputDecoration(
                    hintText: context.t('Type your message…'),
                    counterText: '',
                  ),
                ),
              ),
              IconButton(
                tooltip: context.t('Send'),
                onPressed: sending ? null : _send,
                icon: const Icon(Icons.send_outlined),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
