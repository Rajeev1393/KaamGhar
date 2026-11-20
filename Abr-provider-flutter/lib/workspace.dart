import 'dart:async';

import 'package:material_ui/material_ui.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';
import 'fields.dart';
import 'language.dart';
import 'profile.dart';

const bookingFilters = {
  'all': 'All',
  'pending': 'Pending',
  'confirmed': 'Confirmed',
  'completed': 'Completed',
  'cancelled': 'Cancelled',
};

const bookingColors = {
  'pending': (Color(0xffffedcf), Color(0xff79430c)),
  'confirmed': (Color(0xffe9e4ff), Color(0xff4e3596)),
  'completed': (Color(0xffd7f5e8), Color(0xff075b45)),
  'cancelled': (Color(0xffffe2e8), Color(0xff932d4a)),
};

class Workspace extends StatefulWidget {
  const Workspace({
    required this.api,
    required this.user,
    required this.notice,
    required this.onSignedOut,
    super.key,
  });
  final ProviderApi api;
  final Json user;
  final String? notice;
  final VoidCallback onSignedOut;

  @override
  State<Workspace> createState() => _WorkspaceState();
}

class _WorkspaceState extends State<Workspace> {
  Json? profile;
  Json? earnings;
  List<Json> bookings = [];
  List<Json> categories = [];
  String filter = 'all';
  String? error;
  String? bookingUpdate;
  Timer? earningsTimer;
  bool loading = false;
  bool signingOut = false;
  bool loadingEarnings = false;
  int tab = 0;

  @override
  void initState() {
    super.initState();
    refresh();
    earningsTimer = Timer.periodic(const Duration(seconds: 10), (_) {
      if (tab == 1 &&
          WidgetsBinding.instance.lifecycleState == AppLifecycleState.resumed) {
        refreshEarnings();
      }
    });
  }

  @override
  void dispose() {
    earningsTimer?.cancel();
    super.dispose();
  }

  Future<void> refreshEarnings({bool reportError = false}) async {
    if (loadingEarnings) return;
    loadingEarnings = true;
    try {
      final result = await widget.api.request('workers/me/earnings');
      if (mounted) setState(() => earnings = result['earnings'] as Json);
    } catch (reason) {
      if (reportError) rethrow;
    } finally {
      loadingEarnings = false;
    }
  }

  Future<void> refresh() async {
    if (loading) return;
    setState(() {
      loading = true;
      error = null;
    });
    try {
      await Future.wait([
        widget.api.request('workers/me').then((result) {
          if (mounted) setState(() => profile = result['worker'] as Json);
        }),
        widget.api.request('bookings').then((result) {
          if (mounted) setState(() => bookings = records(result, 'bookings'));
        }),
        widget.api.request('workers/categories').then((result) {
          if (mounted) {
            setState(() => categories = records(result, 'categories'));
          }
        }),
        refreshEarnings(reportError: true),
      ]);
    } catch (reason) {
      if (mounted) setState(() => error = reason.toString());
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> update(Json booking, String status) async {
    final id = booking['_id'] as String;
    if (bookingUpdate != null || loading) return;
    setState(() => bookingUpdate = id);
    try {
      if (status == 'cancelled') {
        final confirmed = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: Text(
              context.t(
                booking['status'] == 'pending'
                    ? 'Decline this job?'
                    : 'Cancel this booking?',
              ),
            ),
            content: booking['paymentStatus'] == 'paid'
                ? Text(
                    context.t(
                      'Payment received; contact support to arrange the customer refund.',
                    ),
                  )
                : null,
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: Text(context.t('Back')),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(context, true),
                child: Text(context.t('Confirm')),
              ),
            ],
          ),
        );
        if (confirmed != true || !mounted) return;
      }
      final result = await widget.api.request(
        'bookings/$id/status',
        method: 'PATCH',
        body: {'status': status},
      );
      if (!mounted) return;
      final updated = result['booking'] as Json?;
      setState(
        () => bookings = [
          for (final current in bookings)
            if (current['_id'] == id)
              {
                ...current,
                ...?updated,
                'customer': current['customer'],
                'status': status,
              }
            else
              current,
        ],
      );
      await refresh();
    } catch (reason) {
      if (mounted) showMessage(reason.toString());
    } finally {
      if (mounted) setState(() => bookingUpdate = null);
    }
  }

  void showMessage(String message) =>
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(context.t(message))));

  Future<void> openSupport() async {
    try {
      if (await launchUrl(
        Uri(scheme: 'mailto', path: 'hello@kaamghar.example'),
      )) {
        return;
      }
      if (mounted) showMessage('Could not open your email app.');
    } catch (reason) {
      if (mounted) showMessage('Could not open your email app.');
    }
  }

  Future<void> signOut() async {
    setState(() => signingOut = true);
    try {
      await widget.api.signOut();
      if (mounted) widget.onSignedOut();
    } catch (reason) {
      if (mounted) showMessage(reason.toString());
    } finally {
      if (mounted) setState(() => signingOut = false);
    }
  }

  String money(Object? amount) => NumberFormat.currency(
    locale: 'en_IN',
    symbol: '₹',
    decimalDigits: 0,
  ).format(amount is num ? amount : 0);

  @override
  Widget build(BuildContext context) {
    final worker = profile;
    final approval = worker?['approvalStatus'];
    final documents =
        (worker?['verificationDocuments'] as List?)?.cast<Json>() ?? <Json>[];
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'KaamGhar Provider',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
        actions: [
          const LanguageMenu(),
          IconButton(
            tooltip: context.t('Refresh'),
            onPressed: loading || bookingUpdate != null ? null : refresh,
            icon: const Icon(Icons.refresh),
          ),
          PopupMenuButton<String>(
            onSelected: (value) =>
                value == 'support' ? openSupport() : signOut(),
            itemBuilder: (context) => [
              PopupMenuItem(
                value: 'support',
                child: Text(context.t('Get in touch')),
              ),
              PopupMenuItem(
                value: 'logout',
                enabled: !signingOut && bookingUpdate == null,
                child: Text(context.t('Sign out')),
              ),
            ],
          ),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        height: 62,
        selectedIndex: tab,
        onDestinationSelected: (index) {
          setState(() => tab = index);
          if (index == 1) refreshEarnings();
        },
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.event_note_outlined),
            label: context.t('Bookings'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.account_balance_wallet_outlined),
            label: context.t('Earnings'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.badge_outlined),
            label: context.t('My profile'),
          ),
        ],
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (loading || signingOut) const LinearProgressIndicator(),
          if (error != null) ...[
            Text(
              context.t(error!),
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton(
                onPressed: loading ? null : refresh,
                child: Text(context.t('Retry')),
              ),
            ),
          ],
          if (worker != null && approval != 'approved')
            Card(
              child: ListTile(
                leading: const Icon(Icons.verified_user_outlined),
                title: Text(
                  context.t(
                    approval == 'pending'
                        ? 'Profile under review'
                        : 'Profile not approved',
                  ),
                ),
                subtitle: Text(
                  context.t(
                    approval == 'pending'
                        ? 'Your listing will be available to customers after admin approval.'
                        : 'Contact support if you need help with your profile.',
                  ),
                ),
                onTap: tab == 2 ? null : () => setState(() => tab = 2),
              ),
            ),
          Expanded(
            child: IndexedStack(
              index: tab,
              children: [
                ContentPanel(width: 920, child: buildBookings(context)),
                ContentPanel(width: 920, child: buildEarnings(context)),
                if (worker == null)
                  const SizedBox()
                else
                  ContentPanel(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (widget.notice != null) Text(widget.notice!),
                        ProfileEditor(
                          api: widget.api,
                          profile: worker,
                          categories: categories,
                          onSaved: (updated) {
                            setState(() => profile = {...?profile, ...updated});
                          },
                        ),
                        DocumentsPanel(
                          api: widget.api,
                          documents: documents,
                          onUploaded: refresh,
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget buildBookings(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final counts = <String, int>{};
    for (final booking in bookings) {
      final status = booking['status']?.toString();
      if (status != null) {
        counts.update(status, (count) => count + 1, ifAbsent: () => 1);
      }
    }
    final visible = bookings.where(
      (booking) => filter == 'all' || booking['status'] == filter,
    );
    const summary = {
      'pending': Icons.schedule_outlined,
      'confirmed': Icons.event_available_outlined,
      'completed': Icons.task_alt_outlined,
    };
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.centerLeft,
              end: Alignment.centerRight,
              colors: [Color(0xff005b52), Color(0xff254f95), Color(0xff603798)],
            ),
            borderRadius: BorderRadius.circular(18),
          ),
          child: Row(
            children: [
              DecoratedBox(
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Padding(
                  padding: EdgeInsets.all(8),
                  child: Icon(
                    Icons.space_dashboard_outlined,
                    size: 20,
                    color: Colors.white,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  context.t('Good to see you, {name}.', {
                    'name': widget.user['name'],
                  }),
                  style: theme.textTheme.headlineSmall?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        LayoutBuilder(
          builder: (context, constraints) {
            final columns = constraints.maxWidth >= 480 ? 3 : 1;
            final width = (constraints.maxWidth - (columns - 1) * 12) / columns;
            return Wrap(
              spacing: 12,
              runSpacing: 8,
              children: [
                for (final entry in summary.entries)
                  SizedBox(
                    width: width,
                    child: bookingSummary(
                      context,
                      entry.key,
                      entry.value,
                      loading && bookings.isEmpty
                          ? '—'
                          : '${counts[entry.key] ?? 0}',
                    ),
                  ),
              ],
            );
          },
        ),
        const SizedBox(height: 20),
        Text(
          context.t('Service requests'),
          style: theme.textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final entry in bookingFilters.entries)
              ChoiceChip(
                label: Text(context.t(entry.value)),
                selectedColor: bookingColors[entry.key]?.$1,
                labelStyle: filter == entry.key
                    ? TextStyle(color: bookingColors[entry.key]?.$2)
                    : null,
                selected: entry.key == filter,
                onSelected: (_) => setState(() => filter = entry.key),
              ),
          ],
        ),
        const SizedBox(height: 12),
        if (!loading && error == null && visible.isEmpty)
          Card.outlined(
            margin: EdgeInsets.zero,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 32),
              child: Column(
                children: [
                  Icon(Icons.event_busy_outlined, color: colors.primary),
                  const SizedBox(height: 10),
                  Text(
                    context.t('No bookings in this view.'),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
        for (final booking in visible) bookingCard(context, booking),
      ],
    );
  }

  Widget bookingSummary(
    BuildContext context,
    String status,
    IconData icon,
    String count,
  ) {
    final theme = Theme.of(context);
    final (tint, accent) = bookingColors[status]!;
    final selected = filter == status;
    final foreground = selected ? Colors.white : accent;
    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(14),
      side: BorderSide(color: selected ? accent : tint),
    );
    return Semantics(
      selected: selected,
      button: true,
      child: Material(
        color: selected
            ? accent
            : Color.lerp(theme.colorScheme.surface, tint, 0.45),
        shape: shape,
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => setState(() => filter = selected ? 'all' : status),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 17,
                  backgroundColor: selected ? Colors.white24 : tint,
                  foregroundColor: foreground,
                  child: Icon(icon, size: 18),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    context.t(bookingFilters[status]!),
                    style: TextStyle(
                      color: foreground,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                const SizedBox(width: 4),
                Text(
                  count,
                  style: theme.textTheme.titleLarge?.copyWith(
                    color: foreground,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget buildEarnings(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final payments = bookings
        .where((booking) => booking['paymentStatus'] == 'paid')
        .toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xff153e5c), Color(0xff51418a)],
            ),
            borderRadius: BorderRadius.circular(18),
          ),
          child: Row(
            children: [
              const CircleAvatar(
                backgroundColor: Colors.white24,
                foregroundColor: Colors.white,
                child: Icon(Icons.account_balance_wallet_outlined),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      context.t('Total earning'),
                      style: const TextStyle(color: Colors.white),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      earnings == null ? '—' : money(earnings!['total']),
                      style: theme.textTheme.headlineMedium?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        LayoutBuilder(
          builder: (context, constraints) {
            final width = constraints.maxWidth >= 400
                ? (constraints.maxWidth - 12) / 2
                : constraints.maxWidth;
            return Wrap(
              spacing: 12,
              runSpacing: 10,
              children: [
                for (final (key, label, icon, status) in const [
                  (
                    'pending',
                    'Total pending',
                    Icons.schedule_outlined,
                    'pending',
                  ),
                  (
                    'cleared',
                    'Payment received',
                    Icons.task_alt_outlined,
                    'completed',
                  ),
                ])
                  SizedBox(
                    width: width,
                    child: payoutSummary(context, key, label, icon, status),
                  ),
              ],
            );
          },
        ),
        const SizedBox(height: 22),
        Text(
          context.t('Payment history'),
          style: theme.textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 10),
        if (!loading && error == null && payments.isEmpty)
          Card.outlined(
            margin: EdgeInsets.zero,
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  Icon(Icons.receipt_long_outlined, color: colors.primary),
                  const SizedBox(height: 8),
                  Text(
                    context.t('No payments yet.'),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
        for (final booking in payments) paymentCard(context, booking),
      ],
    );
  }

  Widget payoutSummary(
    BuildContext context,
    String key,
    String label,
    IconData icon,
    String status,
  ) {
    final theme = Theme.of(context);
    final (tint, accent) = bookingColors[status]!;
    return Card.outlined(
      margin: EdgeInsets.zero,
      color: Color.lerp(theme.colorScheme.surface, tint, 0.55),
      shape: RoundedRectangleBorder(
        side: BorderSide(color: tint),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            CircleAvatar(
              backgroundColor: tint,
              foregroundColor: accent,
              child: Icon(icon, size: 20),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(context.t(label), style: TextStyle(color: accent)),
                  Text(
                    earnings == null ? '—' : money(earnings![key]),
                    style: theme.textTheme.titleLarge?.copyWith(
                      color: accent,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget paymentCard(BuildContext context, Json booking) {
    final theme = Theme.of(context);
    final paid = booking['providerPayoutStatus'] == 'cleared';
    final (tint, accent) = bookingColors[paid ? 'completed' : 'pending']!;
    return Card.outlined(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            CircleAvatar(
              backgroundColor: tint,
              foregroundColor: accent,
              child: const Icon(Icons.receipt_long_outlined, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                customerName(booking),
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            const SizedBox(width: 8),
            Flexible(
              child: Align(
                alignment: AlignmentDirectional.centerEnd,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      context.t('Customer paid'),
                      textAlign: TextAlign.end,
                      style: theme.textTheme.labelSmall,
                    ),
                    Text(
                      money(booking['totalAmount']),
                      textAlign: TextAlign.end,
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    Text(
                      '${context.t('Payout:')} ${context.t(paid ? 'Paid' : 'Pending')}',
                      textAlign: TextAlign.end,
                      style: theme.textTheme.labelMedium?.copyWith(
                        color: accent,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String customerName(Json booking) =>
      ((booking['customer'] as Json?)?['name'] ?? booking['customerName'] ?? '')
          .toString();

  Widget bookingCard(BuildContext context, Json booking) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final status = booking['status'];
    final payment = booking['paymentStatus'];
    final paid = payment == 'paid';
    final refund = payment == 'refund_required';
    final expiry = DateTime.tryParse(
      booking['paymentOrderExpiresAt']?.toString() ?? '',
    );
    final checkout =
        !paid &&
        !refund &&
        ((booking['paymentOrderId']?.toString().isNotEmpty ?? false) ||
            expiry?.isAfter(DateTime.now()) == true);
    final pending = status == 'pending';
    final confirmed = status == 'confirmed';
    final cleared = booking['providerPayoutStatus'] == 'cleared';
    final enabled = bookingUpdate == null && !loading && !signingOut;
    final date = DateTime.tryParse(booking['scheduledAt']?.toString() ?? '')
        ?.toLocal();
    final phone =
        (booking['customer'] as Json?)?['phone'] ?? booking['phone'] ?? '—';
    final (statusBackground, statusForeground) =
        bookingColors[status] ??
        (colors.surfaceContainerHighest, colors.onSurfaceVariant);
    final details = [
      bookingDetail(
        context,
        Icons.event_outlined,
        'When',
        '${date == null ? '—' : MaterialLocalizations.of(context).formatFullDate(date)} ${date == null ? '' : TimeOfDay.fromDateTime(date).format(context)} · ${context.t('{count} hr', {'count': booking['durationHours'] ?? 1})}',
      ),
      bookingDetail(
        context,
        Icons.place_outlined,
        'Address',
        '${booking['address'] ?? '—'}',
      ),
      bookingDetail(context, Icons.call_outlined, 'Contact', '$phone'),
      bookingDetail(
        context,
        Icons.notes_outlined,
        'Notes',
        booking['notes']?.toString().isNotEmpty == true
            ? booking['notes'].toString()
            : context.t('No extra details'),
      ),
    ];
    return Card.outlined(
      margin: const EdgeInsets.only(bottom: 12),
      color: Color.lerp(colors.surface, statusBackground, 0.25),
      shape: RoundedRectangleBorder(
        side: BorderSide(
          color: Color.lerp(colors.outlineVariant, statusBackground, 0.65)!,
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CircleAvatar(
                  backgroundColor: statusBackground,
                  foregroundColor: statusForeground,
                  child: const Icon(Icons.person_outline),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        customerName(booking),
                        style: theme.textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 6),
                      DecoratedBox(
                        decoration: BoxDecoration(
                          color: statusBackground,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 4,
                          ),
                          child: Text(
                            context.t(statusLabel(status)),
                            style: theme.textTheme.labelMedium?.copyWith(
                              color: statusForeground,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Flexible(
                  child: Align(
                    alignment: AlignmentDirectional.topEnd,
                    child: Text(
                      money(booking['totalAmount']),
                      textAlign: TextAlign.end,
                      style: theme.textTheme.titleLarge?.copyWith(
                        color: colors.primary,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const Divider(height: 22),
            LayoutBuilder(
              builder: (context, constraints) {
                final width = constraints.maxWidth >= 590
                    ? (constraints.maxWidth - 20) / 2
                    : constraints.maxWidth;
                return Wrap(
                  spacing: 20,
                  children: [
                    for (final detail in details)
                      SizedBox(width: width, child: detail),
                  ],
                );
              },
            ),
            if (paid)
              Text(
                '${context.t('Payout:')} ${context.t(cleared ? 'Paid' : 'Pending')}',
              ),
            if (refund)
              Text(
                context.t(
                  'Payment received; contact support to arrange the customer refund.',
                ),
              ),
            if (checkout)
              Text(
                context.t(
                  'Customer payment checkout is active; cancellation is temporarily unavailable.',
                ),
              ),
            if (pending || confirmed)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    FilledButton(
                      onPressed: enabled
                          ? () => update(
                              booking,
                              pending ? 'confirmed' : 'completed',
                            )
                          : null,
                      child: Text(
                        context.t(pending ? 'Accept job' : 'Mark complete'),
                      ),
                    ),
                    if (!checkout && !cleared)
                      OutlinedButton(
                        onPressed: enabled
                            ? () => update(booking, 'cancelled')
                            : null,
                        child: Text(
                          context.t(
                            pending
                                ? 'Decline'
                                : paid
                                ? 'Cancel & flag refund'
                                : 'Cancel',
                          ),
                        ),
                      ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget bookingDetail(
    BuildContext context,
    IconData icon,
    String label,
    String value,
  ) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: theme.colorScheme.onSurfaceVariant),
          const SizedBox(width: 10),
          Expanded(
            child: Text.rich(
              TextSpan(
                children: [
                  TextSpan(
                    text: '${context.t(label)}  ',
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  TextSpan(text: value),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
