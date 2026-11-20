import 'package:intl/intl.dart';
import 'package:material_ui/material_ui.dart';

String rupees(num value) => NumberFormat.currency(
  locale: 'en_IN',
  symbol: '₹',
  decimalDigits: value is int || value % 1 == 0 ? 0 : 2,
).format(value);

String localDate(String? isoDate) {
  final date = isoDate == null ? null : DateTime.tryParse(isoDate);
  return date == null
      ? '—'
      : DateFormat('d MMM yyyy, h:mm a', 'en_IN').format(date.toLocal());
}

void showNotice(BuildContext context, String message) =>
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));

class PageError extends StatelessWidget {
  const PageError(this.message, {super.key, this.retry});
  final String message;
  final VoidCallback? retry;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(12),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          message,
          style: TextStyle(color: Theme.of(context).colorScheme.error),
        ),
        if (retry != null)
          TextButton(onPressed: retry, child: const Text('Try again')),
      ],
    ),
  );
}
