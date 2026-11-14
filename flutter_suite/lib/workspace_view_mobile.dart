import 'package:material_ui/material_ui.dart';
import 'package:webview_flutter/webview_flutter.dart';

import 'app_config.dart';

class WorkspaceView extends StatefulWidget {
  const WorkspaceView({
    super.key,
    required this.workspace,
    required this.onClose,
  });

  final WorkspaceConfig workspace;
  final VoidCallback onClose;

  @override
  State<WorkspaceView> createState() => _WorkspaceViewState();
}

class _WorkspaceViewState extends State<WorkspaceView> {
  late final WebViewController _controller;
  int _progress = 0;
  String? _error;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.white)
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (progress) {
            if (mounted) setState(() => _progress = progress);
          },
          onWebResourceError: (error) {
            if (mounted) setState(() => _error = error.description);
          },
        ),
      )
      ..loadRequest(Uri.parse(widget.workspace.url));
  }

  Future<void> _goBack() async {
    if (await _controller.canGoBack()) {
      await _controller.goBack();
    } else {
      widget.onClose();
    }
  }

  Future<void> _reload() => _controller.reload();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Material(
          color: Colors.white,
          child: Row(
            children: [
              IconButton(
                tooltip: 'Back',
                onPressed: _goBack,
                icon: const Icon(Icons.arrow_back),
              ),
              Expanded(
                child: Text(
                  widget.workspace.url.replaceFirst('https://', ''),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 11, color: Colors.black54),
                ),
              ),
              IconButton(
                tooltip: 'Reload',
                onPressed: _reload,
                icon: const Icon(Icons.refresh),
              ),
              IconButton(
                tooltip: 'All workspaces',
                onPressed: widget.onClose,
                icon: const Icon(Icons.grid_view_rounded),
              ),
            ],
          ),
        ),
        if (_progress < 100)
          LinearProgressIndicator(
            value: _progress == 0 ? null : _progress / 100,
            minHeight: 2,
          ),
        if (_error != null)
          Material(
            color: const Color(0xFFFFF4E5),
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: Row(
                children: [
                  const Icon(Icons.info_outline, size: 16),
                  const SizedBox(width: 7),
                  Expanded(
                    child: Text(
                      'Network notice: $_error',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 11),
                    ),
                  ),
                  TextButton(
                    onPressed: () {
                      setState(() => _error = null);
                      _reload();
                    },
                    child: const Text('Retry'),
                  ),
                ],
              ),
            ),
          ),
        Expanded(
          child: WebViewWidget(controller: _controller),
        ),
      ],
    );
  }
}
