import 'package:material_ui/material_ui.dart';

import 'app_config.dart';

class WorkspaceView extends StatelessWidget {
  const WorkspaceView({
    super.key,
    required this.workspace,
    required this.onClose,
  });

  final WorkspaceConfig workspace;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('Workspace preview is not supported on this platform.'),
          const SizedBox(height: 8),
          TextButton(onPressed: onClose, child: const Text('Back')),
        ],
      ),
    );
  }
}
