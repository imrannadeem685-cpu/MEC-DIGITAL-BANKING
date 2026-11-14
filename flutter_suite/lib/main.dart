import 'package:material_ui/material_ui.dart';

import 'app_config.dart';
import 'workspace_view.dart';

const appId = String.fromEnvironment('PROJECT_ID', defaultValue: 'mec_hub');

void main() {
  runApp(const MecFlutterSuiteApp());
}

class MecFlutterSuiteApp extends StatelessWidget {
  const MecFlutterSuiteApp({super.key});

  @override
  Widget build(BuildContext context) {
    final initial = workspaceForId(appId);
    final title = initial?.name ?? 'MEC Workspaces';

    return MaterialApp(
      title: title,
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF173B5E),
          brightness: Brightness.light,
        ),
        scaffoldBackgroundColor: const Color(0xFFF4F6F8),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF102A43),
          foregroundColor: Colors.white,
          elevation: 0,
        ),
        cardTheme: CardThemeData(
          color: Colors.white,
          elevation: 1,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
          ),
        ),
      ),
      home: WorkspaceHome(initialWorkspace: initial),
    );
  }
}

class WorkspaceHome extends StatefulWidget {
  const WorkspaceHome({super.key, this.initialWorkspace});

  final WorkspaceConfig? initialWorkspace;

  @override
  State<WorkspaceHome> createState() => _WorkspaceHomeState();
}

class _WorkspaceHomeState extends State<WorkspaceHome> {
  WorkspaceConfig? _activeWorkspace;

  @override
  void initState() {
    super.initState();
    _activeWorkspace = widget.initialWorkspace;
  }

  void _open(WorkspaceConfig workspace) {
    setState(() => _activeWorkspace = workspace);
  }

  void _home() {
    setState(() => _activeWorkspace = null);
  }

  @override
  Widget build(BuildContext context) {
    final active = _activeWorkspace;

    return PopScope(
      canPop: active == null,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop && _activeWorkspace != null) _home();
      },
      child: Scaffold(
        appBar: AppBar(
          leading: active == null
              ? null
              : IconButton(
                  tooltip: 'Workspaces',
                  onPressed: _home,
                  icon: const Icon(Icons.arrow_back),
                ),
          title: Row(
            children: [
              if (active != null)
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: Image.network(
                    active.logoUrl,
                    width: 34,
                    height: 34,
                    fit: BoxFit.contain,
                    errorBuilder: (context, error, stack) => const Icon(
                      Icons.business,
                      size: 30,
                    ),
                  ),
                )
              else
                const Icon(Icons.grid_view_rounded, size: 25),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  active?.name ?? 'MEC WORKSPACES',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.6,
                  ),
                ),
              ),
            ],
          ),
          actions: [
            if (active != null)
              IconButton(
                tooltip: 'Open workspace home',
                onPressed: _home,
                icon: const Icon(Icons.home_outlined),
              ),
          ],
        ),
        body: active == null
            ? _WorkspaceDirectory(onOpen: _open)
            : WorkspaceView(
                workspace: active,
                onClose: _home,
              ),
      ),
    );
  }
}

class _WorkspaceDirectory extends StatelessWidget {
  const _WorkspaceDirectory({required this.onOpen});

  final ValueChanged<WorkspaceConfig> onOpen;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth >= 1050
            ? 3
            : constraints.maxWidth >= 650
                ? 2
                : 1;

        return SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 1160),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(22),
                      gradient: const LinearGradient(
                        colors: [Color(0xFF102A43), Color(0xFF1D496B)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                    ),
                    child: const Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'ONE GROUP. SIX WORKSPACES.',
                          style: TextStyle(
                            color: Color(0xFFE5C58D),
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1.6,
                          ),
                        ),
                        SizedBox(height: 12),
                        Text(
                          'Your MEC business tools,\nin one place.',
                          style: TextStyle(
                            color: Colors.white,
                            height: 1.15,
                            fontSize: 27,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        SizedBox(height: 10),
                        Text(
                          'Choose a workspace to open its existing secure application.',
                          style: TextStyle(
                            color: Color(0xFFD7E2EB),
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 22),
                  GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: workspaces.length,
                    gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: columns,
                      crossAxisSpacing: 14,
                      mainAxisSpacing: 14,
                      mainAxisExtent: 194,
                    ),
                    itemBuilder: (context, index) {
                      final workspace = workspaces[index];
                      return _WorkspaceCard(
                        workspace: workspace,
                        onTap: () => onOpen(workspace),
                      );
                    },
                  ),
                  const SizedBox(height: 18),
                  const Text(
                    'Secure access',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 5),
                  Text(
                    'Each workspace continues to use its existing Hatchable sign-in, permissions, APIs and database. This Flutter companion does not store passwords or copy business records.',
                    style: TextStyle(
                      color: Colors.blueGrey.shade700,
                      height: 1.45,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _WorkspaceCard extends StatelessWidget {
  const _WorkspaceCard({
    required this.workspace,
    required this.onTap,
  });

  final WorkspaceConfig workspace;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(17),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 43,
                    height: 43,
                    padding: const EdgeInsets.all(5),
                    decoration: BoxDecoration(
                      color: workspace.accent.withValues(alpha: 0.09),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Image.network(
                      workspace.logoUrl,
                      fit: BoxFit.contain,
                      errorBuilder: (context, error, stack) =>
                          Icon(Icons.business, color: workspace.accent),
                    ),
                  ),
                  const Spacer(),
                  Icon(Icons.open_in_new, color: workspace.accent, size: 19),
                ],
              ),
              const SizedBox(height: 14),
              Text(
                workspace.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 7),
              Expanded(
                child: Text(
                  workspace.description,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: Colors.blueGrey.shade700,
                    height: 1.35,
                    fontSize: 12,
                  ),
                ),
              ),
              Row(
                children: [
                  Icon(Icons.verified_user_outlined,
                      color: workspace.accent, size: 15),
                  const SizedBox(width: 6),
                  Text(
                    'Open secure workspace',
                    style: TextStyle(
                      color: workspace.accent,
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                    ),
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
