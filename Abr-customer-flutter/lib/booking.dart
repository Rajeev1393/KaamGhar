import 'package:material_ui/material_ui.dart';

import 'api.dart';
import 'payment.dart';
import 'strings.dart';
import 'widgets.dart';

Future<bool> _checkout(
  CustomerApi api,
  Json user,
  String path,
  Json order,
  String description,
) async {
  if (order['alreadyPaid'] == true) return true;
  if (!paymentSupported) {
    throw const ApiException(
      400,
      'Use the web or Android app to pay by Razorpay.',
    );
  }
  if (order['keyId'] == null ||
      order['orderId'] == null ||
      order['amount'] == null ||
      order['currency'] == null) {
    throw const ApiException(502, 'Could not start Razorpay checkout.');
  }
  final result = await openPayment({
    'key': order['keyId'],
    'order_id': order['orderId'],
    'amount': order['amount'],
    'currency': order['currency'],
    'name': 'KaamGhar',
    'description': description,
    'prefill': {
      'name': user['name'],
      'email': user['email'],
      'contact': user['phone'],
    },
    'theme': {'color': '#24664f'},
  });
  if (result == null) return false;
  if (result.values.any((value) => value is! String || value.isEmpty)) {
    throw const ApiException(
      502,
      'Razorpay returned incomplete payment details.',
    );
  }
  await api.request('$path/verify', method: 'POST', body: result);
  return true;
}

class BookingPage extends StatefulWidget {
  const BookingPage({
    super.key,
    required this.api,
    required this.user,
    required this.worker,
  });
  final CustomerApi api;
  final Json user;
  final Json worker;
  @override
  State<BookingPage> createState() => _BookingPageState();
}

class _BookingPageState extends State<BookingPage> {
  final form = GlobalKey<FormState>();
  final address = TextEditingController();
  final notes = TextEditingController();
  DateTime? scheduled;
  int hours = 1;
  bool busy = false;
  String error = '';

  @override
  void dispose() {
    address.dispose();
    notes.dispose();
    super.dispose();
  }

  Future<void> _chooseDate() async {
    final now = DateTime.now();
    final day = await showDatePicker(
      context: context,
      initialDate: scheduled ?? now,
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
    );
    if (!mounted || day == null) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(
        scheduled ?? now.add(const Duration(hours: 1)),
      ),
    );
    if (mounted && time != null) {
      setState(
        () => scheduled = DateTime(
          day.year,
          day.month,
          day.day,
          time.hour,
          time.minute,
        ),
      );
    }
  }

  Future<void> _book() async {
    if (busy || !(form.currentState?.validate() ?? false)) return;
    final date = scheduled;
    if (date == null || !date.isAfter(DateTime.now())) {
      setState(() => error = 'Please choose a valid date and time.');
      return;
    }
    if (!paymentSupported) {
      setState(() => error = 'Use the web or Android app to pay by Razorpay.');
      return;
    }
    setState(() {
      busy = true;
      error = '';
    });
    const endpoint = 'bookings/payment';
    try {
      final order = await widget.api.request(
        '$endpoint/order',
        method: 'POST',
        body: {
          'workerId': widget.worker['_id'],
          'address': address.text.trim(),
          'scheduledAt': date.toUtc().toIso8601String(),
          'durationHours': hours,
          'notes': notes.text.trim(),
        },
      );
      final pending = order['pendingBooking'] as Json?;
      if (!mounted) return;
      if (pending != null) {
        final resume = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: Text(context.t('Resume your previous booking checkout?')),
            content: Text(
              [
                '${pending['provider']} · ${pending['profession']}',
                pending['address'],
                localDate(pending['scheduledAt'] as String?),
                '${pending['durationHours']} ${context.t('hour')}',
                if (order['amount'] is num)
                  rupees((order['amount'] as num) / 100),
              ].join('\n'),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: Text(context.t('Cancel')),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(context, true),
                child: Text(context.t('Pay now')),
              ),
            ],
          ),
        );
        if (resume != true) return;
      }
      final paid = await _checkout(
        widget.api,
        widget.user,
        endpoint,
        order,
        (pending?['profession'] ?? widget.worker['profession']) as String,
      );
      if (mounted && paid) Navigator.pop(context, true);
    } catch (reason) {
      if (mounted) setState(() => error = reason.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(context.t('Book a service'))),
    body: Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 600),
        child: Form(
          key: form,
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Text(
                widget.worker['name'] as String,
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              Text(
                '${widget.worker['profession']} · ${rupees(widget.worker['price'] as num)} ${context.t('/ hour')}',
              ),
              const SizedBox(height: 20),
              TextFormField(
                controller: address,
                maxLength: 300,
                maxLines: 2,
                enabled: !busy,
                decoration: InputDecoration(
                  labelText: context.t('Service address'),
                ),
                validator: (value) => (value ?? '').trim().length < 8
                    ? context.t('Check this field.')
                    : null,
              ),
              OutlinedButton.icon(
                onPressed: busy ? null : _chooseDate,
                icon: const Icon(Icons.event),
                label: Text(
                  scheduled == null
                      ? context.t('Preferred date & time')
                      : localDate(scheduled!.toIso8601String()),
                ),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<int>(
                initialValue: hours,
                decoration: InputDecoration(labelText: context.t('Duration:')),
                items: List.generate(
                  12,
                  (index) => DropdownMenuItem(
                    value: index + 1,
                    child: Text('${index + 1} ${context.t('hour')}'),
                  ),
                ),
                onChanged: busy
                    ? null
                    : (value) {
                        if (value != null) setState(() => hours = value);
                      },
              ),
              const SizedBox(height: 12),
              TextField(
                controller: notes,
                maxLength: 500,
                enabled: !busy,
                decoration: InputDecoration(
                  labelText: context.t('Anything else?'),
                ),
              ),
              if (error.isNotEmpty) PageError(context.t(error)),
              FilledButton.icon(
                onPressed: busy ? null : _book,
                icon: const Icon(Icons.lock_outline),
                label: Text(
                  busy
                      ? context.t('Opening payment…')
                      : '${context.t('Pay now')} · ${rupees((widget.worker['price'] as num) * hours)}',
                ),
              ),
              const SizedBox(height: 8),
              Text(
                context.t(
                  'Your booking is sent to the professional only after successful payment.',
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

class BookingsPage extends StatefulWidget {
  const BookingsPage({super.key, required this.api, required this.user});
  final CustomerApi api;
  final Json user;
  @override
  State<BookingsPage> createState() => _BookingsPageState();
}

class _BookingsPageState extends State<BookingsPage> {
  List<Json> bookings = [];
  bool loading = true;
  String? activeBooking;
  String error = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final result = await widget.api.request('bookings');
      if (mounted) {
        setState(() {
          bookings = records(result, 'bookings');
          error = '';
        });
      }
    } catch (reason) {
      if (mounted) setState(() => error = reason.toString());
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  bool _hasCheckout(Json booking) {
    final expiry = DateTime.tryParse(
      booking['paymentOrderExpiresAt'] as String? ?? '',
    );
    return booking['paymentStatus'] != 'paid' &&
        booking['paymentStatus'] != 'refund_required' &&
        (booking['paymentOrderId'] != null ||
            (expiry?.isAfter(DateTime.now()) ?? false));
  }

  Future<void> _change(Json booking, {required bool pay}) async {
    if (activeBooking != null) return;
    if (pay && !paymentSupported) {
      setState(() => error = 'Use the web or Android app to pay by Razorpay.');
      return;
    }
    final id = booking['_id'] as String;
    setState(() {
      activeBooking = id;
      error = '';
    });
    try {
      if (pay) {
        final endpoint = 'bookings/$id/payment';
        final order = await widget.api.request(
          '$endpoint/order',
          method: 'POST',
        );
        final paid = await _checkout(
          widget.api,
          widget.user,
          endpoint,
          order,
          'KaamGhar booking',
        );
        if (mounted && paid) {
          showNotice(context, context.t('Payment successful.'));
        }
      } else {
        final confirmed = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: Text(context.t('Cancel this booking?')),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: Text(context.t('Keep booking')),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(context, true),
                child: Text(context.t('Cancel booking')),
              ),
            ],
          ),
        );
        if (confirmed != true) return;
        await widget.api.request(
          'bookings/$id/status',
          method: 'PATCH',
          body: {'status': 'cancelled'},
        );
      }
      if (mounted) await _load();
    } catch (reason) {
      if (mounted) setState(() => error = reason.toString());
    } finally {
      if (mounted) setState(() => activeBooking = null);
    }
  }

  @override
  Widget build(BuildContext context) => RefreshIndicator(
    onRefresh: _load,
    child: ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(18),
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                context.t('My bookings'),
                style: Theme.of(context).textTheme.headlineSmall,
              ),
            ),
            IconButton(
              tooltip: context.t('Refresh'),
              onPressed: _load,
              icon: const Icon(Icons.refresh),
            ),
          ],
        ),
        if (error.isNotEmpty) PageError(context.t(error)),
        if (loading) const LinearProgressIndicator(),
        if (!loading && bookings.isEmpty && error.isEmpty)
          Padding(
            padding: const EdgeInsets.all(14),
            child: Text(context.t('No bookings yet.')),
          ),
        for (final booking in bookings) _card(context, booking),
      ],
    ),
  );

  Widget _card(BuildContext context, Json booking) {
    final status = booking['status'] as String;
    final payment = booking['paymentStatus'];
    final worker = booking['worker'] as Json?;
    final canPay =
        ['confirmed', 'completed'].contains(status) &&
        !['paid', 'refund_required'].contains(payment);
    final canCancel =
        ['pending', 'confirmed'].contains(status) &&
        payment != 'paid' &&
        !_hasCheckout(booking);
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      worker?['name'] as String? ??
                          context.t('Your professional'),
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ),
                  Chip(
                    label: Text(
                      context.t(
                        '${status[0].toUpperCase()}${status.substring(1)}',
                      ),
                    ),
                  ),
                ],
              ),
              Text(
                '${localDate(booking['scheduledAt'] as String?)} · ${booking['durationHours'] ?? 1} ${context.t('hour')}',
              ),
              Text(booking['address'] as String? ?? ''),
              Text(rupees(booking['totalAmount'] as num? ?? 0)),
              if (payment == 'paid') Text(context.t('Payment received')),
              if (payment == 'refund_required')
                Text(
                  context.t(
                    'Booking cancelled after payment. Contact support for a refund.',
                  ),
                ),
              if (canPay || canCancel)
                Wrap(
                  spacing: 8,
                  children: [
                    if (canPay)
                      FilledButton(
                        onPressed: activeBooking == null
                            ? () => _change(booking, pay: true)
                            : null,
                        child: Text(context.t('Pay now')),
                      ),
                    if (canCancel)
                      OutlinedButton(
                        onPressed: activeBooking == null
                            ? () => _change(booking, pay: false)
                            : null,
                        child: Text(context.t('Cancel booking')),
                      ),
                  ],
                ),
            ],
          ),
        ),
      ),
    );
  }
}
