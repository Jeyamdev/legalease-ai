import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'lawyer_api.dart';
import 'lawyer_store.dart';
import 'models.dart';
import 'widgets.dart';

class LawyerBrowseScreen extends StatelessWidget {
  const LawyerBrowseScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final store = context.watch<LawyerStore>();
    return Scaffold(
      appBar: AppBar(title: const Text('Find a lawyer')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                TextField(
                  decoration: const InputDecoration(
                    labelText: 'Search lawyers by name',
                    prefixIcon: Icon(Icons.search),
                  ),
                  textInputAction: TextInputAction.search,
                  onSubmitted: (text) => store.load(search: text),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<int>(
                  initialValue: store.specializationId ?? 0,
                  decoration: const InputDecoration(
                    labelText: 'Specialization',
                  ),
                  items: [
                    const DropdownMenuItem(
                      value: 0,
                      child: Text('All specializations'),
                    ),
                    ...store.specializations.map(
                      (s) => DropdownMenuItem(value: s.id, child: Text(s.name)),
                    ),
                  ],
                  onChanged: store.loading
                      ? null
                      : (id) => store.load(
                          specialization: id == 0 ? null : id,
                          changeFilter: true,
                        ),
                ),
              ],
            ),
          ),
          Expanded(
            child: store.loading
                ? const Center(child: CircularProgressIndicator())
                : store.error != null
                ? LoadError(
                    message: store.error!,
                    retry: () => store.load(nextPage: store.page),
                  )
                : store.lawyers.isEmpty
                ? const Center(child: Text('No lawyers match your search.'))
                : RefreshIndicator(
                    onRefresh: () => store.load(nextPage: store.page),
                    child: ListView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: store.lawyers.length,
                      itemBuilder: (context, index) {
                        final lawyer = store.lawyers[index];
                        return LawyerCard(
                          lawyer: lawyer,
                          onTap: () => Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => ChangeNotifierProvider(
                                create: (_) => LawyerProfileStore(
                                  context.read<LawyerApi>(),
                                  lawyer.id,
                                )..load(),
                                child: const LawyerProfileScreen(),
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
          ),
          SafeArea(
            top: false,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                TextButton(
                  onPressed: store.loading || store.page == 1
                      ? null
                      : () => store.load(nextPage: store.page - 1),
                  child: const Text('Previous'),
                ),
                Text('Page ${store.page}'),
                TextButton(
                  onPressed: store.loading || store.page * 20 >= store.total
                      ? null
                      : () => store.load(nextPage: store.page + 1),
                  child: const Text('Next'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class LawyerProfileScreen extends StatelessWidget {
  const LawyerProfileScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final store = context.watch<LawyerProfileStore>();
    final lawyer = store.lawyer;
    return Scaffold(
      appBar: AppBar(title: const Text('Lawyer profile')),
      body: store.loading
          ? const Center(child: CircularProgressIndicator())
          : store.error != null
          ? LoadError(message: store.error!, retry: store.load)
          : lawyer == null
          ? const Center(child: Text('Profile unavailable.'))
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                Text(
                  lawyer.name,
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                Text(
                  '${lawyer.experience} years experience · ${lawyer.status}',
                ),
                const SizedBox(height: 16),
                Text(lawyer.description ?? ''),
                ListTile(
                  title: const Text('Qualification'),
                  subtitle: Text(lawyer.qualification ?? 'Not provided'),
                ),
                ListTile(
                  title: const Text('Contact'),
                  subtitle: Text(
                    '${lawyer.email ?? ''}\n${lawyer.phone ?? ''}',
                  ),
                ),
                Text(
                  'Specializations',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                if (lawyer.specializations.isEmpty)
                  const Text('No specializations recorded.'),
                ...lawyer.specializations.map(
                  (s) => ListTile(
                    title: Text(s.name),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => SpecializationScreen(specialization: s),
                      ),
                    ),
                  ),
                ),
                Text(
                  'Legal services',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                if (lawyer.services.isEmpty)
                  const Text('No legal services recorded.'),
                ...lawyer.services.map(
                  (s) => ListTile(
                    title: Text(s.name),
                    subtitle: Text(s.description),
                  ),
                ),
                Text(
                  'Availability',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const Text(
                  'Times are in Asia/Colombo. Working periods do not guarantee a free booking slot.',
                ),
                if (store.availability.isEmpty)
                  const Padding(
                    padding: EdgeInsets.all(16),
                    child: Text('No availability recorded.'),
                  ),
                ...store.availability.map(
                  (a) => ListTile(
                    leading: const Icon(Icons.schedule),
                    title: Text(a.date),
                    subtitle: Text('${a.start}–${a.end}'),
                  ),
                ),
              ],
            ),
    );
  }
}

class SpecializationScreen extends StatelessWidget {
  final Catalog specialization;
  const SpecializationScreen({super.key, required this.specialization});
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(specialization.name)),
    body: Padding(
      padding: const EdgeInsets.all(24),
      child: Text(
        specialization.description.isEmpty
            ? 'No description recorded.'
            : specialization.description,
      ),
    ),
  );
}
