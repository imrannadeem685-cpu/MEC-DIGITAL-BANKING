import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import 'app_config.dart';

class WorkspaceView extends StatelessWidget {
  const WorkspaceView({
    super.key,
    required this.workspace,
    required this.onClose,
  });

  final WorkspaceConfig workspace;
  final VoidCallback onClose;

  Future<void> _openWorkspace() async {
    await launchUrl(
      Uri.parse(workspace.url),
      mode: LaunchMode.platformDefault,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 520),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Image.network(
                    workspace.logoUrl,
                    width: 76,
                    height: 76,
                    fit: BoxFit.contain,
                    errorBuilder: (context, error, stack) =>
                        const Icon(Icons.business, size: 64),
                  ),
                  const SizedBox(height: 14),
                  Text(
                    workspace.name,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'The original secure workspace opens in your browser. Sign in there with your existing Hatchable account.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.blueGrey.shade700,
                      height: 1.45,
                    ),
                  ),
                  const SizedBox(height: 18),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: _openWorkspace,
                      icon: const Icon(Icons.open_in_browser),
                      label: const Text('Open secure workspace'),
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: onClose,
                    child: const Text('Back to workspaces'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
