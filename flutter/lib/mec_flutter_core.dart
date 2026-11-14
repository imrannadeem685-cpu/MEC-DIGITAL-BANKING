library mec_flutter_core;

import 'package:material_ui/material_ui.dart';
import 'package:http/http.dart' as http;
import 'package:url_launcher/url_launcher.dart';

import 'api_transport.dart';

class ProjectFeature {
  const ProjectFeature({
    required this.title,
    required this.description,
    required this.path,
  });

  final String title;
  final String description;
  final String path;
}

class ProjectConfig {
  const ProjectConfig({
    required this.name,
    required this.subtitle,
    required this.appUrl,
    required this.apiBaseUrl,
    required this.logoUrl,
    required this.healthPath,
    required this.loginUrl,
    required this.features,
    this.accent = const Color(0xFF173B63),
    this.gold = const Color(0xFFD8B77A),
  });

  final String name;
  final String subtitle;
  final String appUrl;
  final String apiBaseUrl;
  final String logoUrl;
  final String healthPath;
  final String loginUrl;
  final List<ProjectFeature> features;
  final Color accent;
  final Color gold;
}

class ApiSnapshot {
  const ApiSnapshot({required this.statusCode, this.summary = '', this.error});

  final int statusCode;
  final String summary;
  final String? error;

  bool get isSuccess => statusCode >= 200 && statusCode < 300;
  bool get needsSignIn => statusCode == 401 || statusCode == 403;

  String get label {
    if (error != null) return error!;
    if (needsSignIn) return 'Secure sign-in required';
    if (isSuccess) return 'Connected • HTTP $statusCode';
    if (statusCode == 0) return 'Connection unavailable';
    return 'Service returned HTTP $statusCode';
  }
}

class ApiClient {
  ApiClient(this.baseUrl) : _client = createHttpClient();

  final String baseUrl;
  final http.Client _client;

  Future<ApiSnapshot> get(String path) async {
    final root = baseUrl.endsWith('/')
        ? baseUrl.substring(0, baseUrl.length - 1)
        : baseUrl;
    try {
      final response = await _client.get(
        Uri.parse('$root$path'),
        headers: const {'Accept': 'application/json'},
      );
      final shortBody = response.body
          .replaceAll(RegExp(r'\s+'), ' ')
          .trim();
      return ApiSnapshot(
        statusCode: response.statusCode,
        summary: shortBody.length > 180
            ? shortBody.substring(0, 180) + '…'
            : shortBody,
      );
    } catch (error) {
      return ApiSnapshot(statusCode: 0, error: 'Connection failed: $error');
    }
  }

  void close() => _client.close();
}

class MecProjectApp extends StatelessWidget {
  const MecProjectApp({super.key, required this.config});

  final ProjectConfig config;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: config.name,
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(seedColor: config.accent),
        scaffoldBackgroundColor: const Color(0xFFF4F6F9),
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.white,
          foregroundColor: Color(0xFF172B42),
          elevation: 0,
        ),
      ),
      home: ProjectHomePage(config: config),
    );
  }
}

class ProjectHomePage extends StatefulWidget {
  const ProjectHomePage({super.key, required this.config});

  final ProjectConfig config;

  @override
  State<ProjectHomePage> createState() => _ProjectHomePageState();
}

class _ProjectHomePageState extends State<ProjectHomePage> {
  late final ApiClient _api;
  late Future<ApiSnapshot> _health;
  final Map<String, Future<ApiSnapshot>> _featureChecks = {};

  @override
  void initState() {
    super.initState();
    _api = ApiClient(widget.config.apiBaseUrl);
    _health = _api.get(widget.config.healthPath);
  }

  @override
  void dispose() {
    _api.close();
    super.dispose();
  }

  void _refresh() {
    setState(() {
      _health = _api.get(widget.config.healthPath);
      _featureChecks.clear();
    });
  }

  Future<void> _checkFeature(ProjectFeature feature) async {
    setState(() {
      _featureChecks[feature.path] = _api.get(feature.path);
    });
    final result = await _featureChecks[feature.path]!;
    if (!mounted) return;
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) => Padding(
        padding: const EdgeInsets.fromLTRB(22, 12, 22, 30),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(feature.title,
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 6),
            Text(feature.description),
            const SizedBox(height: 16),
            Text(result.label,
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  color: result.isSuccess
                      ? Colors.green.shade700
                      : result.needsSignIn
                          ? Colors.orange.shade800
                          : Colors.red.shade700,
                )),
            if (result.summary.isNotEmpty) ...[
              const SizedBox(height: 8),
              SelectableText(result.summary,
                  style: const TextStyle(fontSize: 11)),
            ],
            const SizedBox(height: 8),
            Text('Read-only connector: ' + feature.path,
                style: const TextStyle(color: Colors.black54, fontSize: 11)),
          ],
        ),
      ),
    );
  }

  Future<void> _openLive() async {
    final uri = Uri.tryParse(widget.config.appUrl);
    if (uri != null) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  Future<void> _openSignIn() async {
    final uri = Uri.tryParse(widget.config.loginUrl);
    if (uri != null) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  Widget _logo() {
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: Image.network(
        widget.config.logoUrl,
        width: 46,
        height: 46,
        fit: BoxFit.contain,
        errorBuilder: (_, __, ___) => Container(
          width: 46,
          height: 46,
          color: widget.config.accent,
          alignment: Alignment.center,
          child: const Icon(Icons.business_rounded,
              color: Colors.white, size: 26),
        ),
      ),
    );
  }

  Widget _healthCard() {
    return FutureBuilder<ApiSnapshot>(
      future: _health,
      builder: (context, snapshot) {
        final result = snapshot.data;
        final busy = snapshot.connectionState == ConnectionState.waiting;
        final color = busy
            ? Colors.blueGrey
            : result == null
                ? Colors.blueGrey
                : result.isSuccess
                    ? Colors.green
                    : result.needsSignIn
                        ? Colors.orange
                        : Colors.redAccent;
        final label = busy
            ? 'Checking service connection…'
            : result?.label ?? 'Not checked';
        return Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Icon(Icons.shield_outlined, color: color, size: 28),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(label,
                          style: const TextStyle(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 3),
                      const Text(
                        'Original Hatchable API and database remain connected.',
                        style: TextStyle(color: Colors.black54, fontSize: 11),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  tooltip: 'Refresh service status',
                  onPressed: _refresh,
                  icon: const Icon(Icons.refresh_rounded),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final config = widget.config;
    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            _logo(),
            const SizedBox(width: 11),
            Flexible(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(config.name,
                      maxLines: 1, overflow: TextOverflow.ellipsis),
                  Text(config.subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 10, color: Colors.black54)),
                ],
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            onPressed: _refresh,
            tooltip: 'Refresh',
            icon: const Icon(Icons.sync_rounded),
          ),
        ],
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 1080),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(18, 18, 18, 32),
              children: [
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(22),
                    gradient: LinearGradient(
                      colors: [config.accent, config.accent.withOpacity(.82)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(config.subtitle.toUpperCase(),
                          style: TextStyle(
                            color: config.gold,
                            letterSpacing: 1.15,
                            fontWeight: FontWeight.w800,
                            fontSize: 10,
                          )),
                      const SizedBox(height: 10),
                      Text(config.name,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 27,
                            fontWeight: FontWeight.w800,
                          )),
                      const SizedBox(height: 8),
                      const Text(
                        'Flutter Web + Android • migration workspace',
                        style: TextStyle(color: Colors.white70),
                      ),
                      const SizedBox(height: 18),
                      Wrap(
                        spacing: 10,
                        runSpacing: 8,
                        children: [
                          FilledButton.icon(
                            onPressed: _openSignIn,
                            icon: const Icon(Icons.lock_open_rounded),
                            label: const Text('Secure sign-in'),
                            style: FilledButton.styleFrom(
                              backgroundColor: config.gold,
                              foregroundColor: const Color(0xFF172B42),
                            ),
                          ),
                          OutlinedButton.icon(
                            onPressed: _openLive,
                            icon: const Icon(Icons.open_in_new_rounded),
                            label: const Text('Open live app'),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: Colors.white,
                              side: const BorderSide(color: Colors.white70),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 15),
                _healthCard(),
                const SizedBox(height: 24),
                const Text(
                  'APPLICATION MODULES',
                  style: TextStyle(
                    color: Color(0xFF516174),
                    fontSize: 10,
                    letterSpacing: 1.3,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 10),
                LayoutBuilder(
                  builder: (context, constraints) {
                    final columns = constraints.maxWidth >= 760
                        ? 3
                        : constraints.maxWidth >= 480
                            ? 2
                            : 1;
                    return GridView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: config.features.length,
                      gridDelegate:
                          SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: columns,
                        crossAxisSpacing: 10,
                        mainAxisSpacing: 10,
                        mainAxisExtent: 115,
                      ),
                      itemBuilder: (context, index) {
                        final feature = config.features[index];
                        final checked = _featureChecks.containsKey(feature.path);
                        return Card(
                          child: InkWell(
                            borderRadius: BorderRadius.circular(18),
                            onTap: () => _checkFeature(feature),
                            child: Padding(
                              padding: const EdgeInsets.all(15),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Icon(Icons.grid_view_rounded,
                                          color: config.accent),
                                      const Spacer(),
                                      if (checked)
                                        const Icon(Icons.check_circle_outline,
                                            size: 17, color: Colors.green),
                                    ],
                                  ),
                                  const Spacer(),
                                  Text(feature.title,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                          fontWeight: FontWeight.w700)),
                                  const SizedBox(height: 3),
                                  Text(feature.description,
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                          color: Colors.black54,
                                          fontSize: 10)),
                                ],
                              ),
                            ),
                          ),
                        );
                      },
                    );
                  },
                ),
                const SizedBox(height: 18),
                const Text(
                  'Migration preview only: module checks are read-only. The existing live app, authentication, production data and database are not replaced by this build.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 10, color: Colors.black54),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
