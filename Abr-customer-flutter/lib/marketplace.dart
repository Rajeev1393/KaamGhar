import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:material_ui/material_ui.dart';

import 'api.dart';
import 'strings.dart';
import 'widgets.dart';

class Marketplace extends StatefulWidget {
  const Marketplace({super.key, required this.api, required this.onBook});
  final CustomerApi api;
  final ValueChanged<Json> onBook;
  @override
  State<Marketplace> createState() => _MarketplaceState();
}

class _MarketplaceState extends State<Marketplace> {
  final search = TextEditingController();
  final city = TextEditingController();
  Timer? debounce;
  int requestVersion = 0;
  String category = '';
  List<Json> categories = [];
  List<Json> workers = [];
  bool loading = true;
  bool locating = false;
  String error = '';
  String categoryError = '';

  @override
  void initState() {
    super.initState();
    _loadCategories();
    _loadWorkers();
  }

  @override
  void dispose() {
    debounce?.cancel();
    search.dispose();
    city.dispose();
    super.dispose();
  }

  Future<void> _loadCategories() async {
    try {
      final response = await widget.api.request('workers/categories');
      if (mounted) {
        setState(() {
          categories = records(response, 'categories');
          categoryError = '';
        });
      }
    } catch (reason) {
      if (mounted) setState(() => categoryError = reason.toString());
    }
  }

  Future<void> _loadWorkers() async {
    final version = ++requestVersion;
    setState(() {
      loading = true;
      error = '';
    });
    final searchValue = search.text.trim();
    final cityValue = city.text.trim();
    try {
      final response = await widget.api.request(
        'workers',
        query: {
          if (category.isNotEmpty) 'category': category,
          if (searchValue.isNotEmpty) 'search': searchValue,
          if (cityValue.isNotEmpty) 'city': cityValue,
        },
      );
      if (mounted && version == requestVersion) {
        setState(() => workers = records(response, 'workers'));
      }
    } catch (reason) {
      if (mounted && version == requestVersion) {
        setState(() => error = reason.toString());
      }
    } finally {
      if (mounted && version == requestVersion) setState(() => loading = false);
    }
  }

  void _scheduleSearch() {
    debounce?.cancel();
    debounce = Timer(const Duration(milliseconds: 300), _loadWorkers);
  }

  Future<void> _findCity() async {
    if (locating) return;
    setState(() => locating = true);
    try {
      if (!kIsWeb) {
        var permission = await Geolocator.checkPermission();
        if (permission == LocationPermission.denied) {
          permission = await Geolocator.requestPermission();
        }
        if (permission == LocationPermission.denied ||
            permission == LocationPermission.deniedForever) {
          throw StateError(
            'Allow location access or enter your city manually.',
          );
        }
      }
      final location = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.low,
          timeLimit: Duration(seconds: 12),
        ),
      );
      final match = await widget.api.request(
        'location/reverse',
        query: {
          'latitude': location.latitude.toString(),
          'longitude': location.longitude.toString(),
        },
      );
      if (mounted) {
        city.text = match['city'] as String;
        await _loadWorkers();
      }
    } catch (reason) {
      if (mounted) showNotice(context, reason.toString());
    } finally {
      if (mounted) setState(() => locating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return RefreshIndicator(
      onRefresh: () => Future.wait([_loadCategories(), _loadWorkers()]),
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(18),
        children: [
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: colors.primaryContainer,
              borderRadius: BorderRadius.circular(22),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  context.t('Home stuff. Handled.'),
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    color: colors.onPrimaryContainer,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  context.t(
                    'Find trusted home-service professionals near you.',
                  ),
                  style: TextStyle(color: colors.onPrimaryContainer),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          TextField(
            controller: search,
            onChanged: (_) => _scheduleSearch(),
            decoration: InputDecoration(
              prefixIcon: const Icon(Icons.search),
              labelText: context.t('Search services'),
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: city,
            onChanged: (_) => _scheduleSearch(),
            decoration: InputDecoration(
              prefixIcon: const Icon(Icons.place_outlined),
              labelText: context.t('City'),
              suffixIcon: IconButton(
                tooltip: context.t('Use current location'),
                onPressed: locating ? null : _findCity,
                icon: locating
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.my_location),
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            context.t(
              'If you use location, your coordinates are sent to look up your city.',
            ),
            style: Theme.of(context).textTheme.bodySmall,
          ),
          if (categoryError.isNotEmpty)
            PageError(categoryError, retry: _loadCategories),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 4,
            children: [
              ChoiceChip(
                label: Text(context.t('All services')),
                selected: category.isEmpty,
                onSelected: (_) {
                  setState(() => category = '');
                  _loadWorkers();
                },
              ),
              for (final item in categories)
                ChoiceChip(
                  label: Text(context.t(item['label'] as String)),
                  selected: category == item['name'],
                  onSelected: (selected) {
                    setState(
                      () => category = selected ? item['name'] as String : '',
                    );
                    _loadWorkers();
                  },
                ),
            ],
          ),
          const SizedBox(height: 18),
          Text(
            context.t('Our professionals'),
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 8),
          if (loading) const LinearProgressIndicator(),
          if (!loading && error.isNotEmpty)
            PageError(error, retry: _loadWorkers)
          else if (!loading && workers.isEmpty)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(context.t('No professionals found just yet.')),
            )
          else
            for (final worker in workers)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: const CircleAvatar(
                            child: Icon(Icons.home_repair_service_outlined),
                          ),
                          title: Text(
                            worker['name'] as String,
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                          subtitle: Text(
                            '${worker['profession']} · ${worker['city']}',
                          ),
                          trailing: Text(
                            '★ ${worker['rating'] ?? '—'} (${worker['reviewCount'] ?? 0})',
                          ),
                        ),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              '${rupees(worker['price'] as num)} ${context.t('/ hour')}',
                            ),
                            FilledButton(
                              onPressed: () => widget.onBook(worker),
                              child: Text(context.t('Book pro')),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
        ],
      ),
    );
  }
}
