import 'package:material_ui/material_ui.dart';

class WorkspaceConfig {
  const WorkspaceConfig({
    required this.id,
    required this.name,
    required this.description,
    required this.url,
    required this.logoUrl,
    required this.accent,
  });

  final String id;
  final String name;
  final String description;
  final String url;
  final String logoUrl;
  final Color accent;
}

const mecLogo = 'https://mec-group-corporate.hatchable.site/mec-logo.webp';

const workspaces = <WorkspaceConfig>[
  WorkspaceConfig(
    id: 'email_marketing',
    name: 'Email Marketing',
    description: 'Audience, segments, campaigns, forms, automations and delivery analytics.',
    url: 'https://i8miz8.hatchable.site/',
    logoUrl: mecLogo,
    accent: Color(0xFF0F766E),
  ),
  WorkspaceConfig(
    id: 'mec_detail_banking',
    name: 'MEC Detail Banking',
    description: 'Accounts, wallets, transactions, payment proofs, reports and team access.',
    url: 'https://mec-detail-banking.hatchable.site/',
    logoUrl: mecLogo,
    accent: Color(0xFF244C75),
  ),
  WorkspaceConfig(
    id: 'mec_group',
    name: 'MEC Group',
    description: 'Corporate profile, business initiatives, memberships and enquiries.',
    url: 'https://mec-group-corporate.hatchable.site/',
    logoUrl: mecLogo,
    accent: Color(0xFFB38A4A),
  ),
  WorkspaceConfig(
    id: 'mec_notification_center',
    name: 'MEC Notification Center',
    description: 'Secure owner inbox, event notifications, delivery preferences and audit trail.',
    url: 'https://mec-notification.hatchable.site/',
    logoUrl: mecLogo,
    accent: Color(0xFF356B80),
  ),
  WorkspaceConfig(
    id: 'mec_owner_control',
    name: 'MEC Owner Control Center',
    description: 'Private administration, approvals, access reviews and security oversight.',
    url: 'https://mec-owner-control.hatchable.site/',
    logoUrl: mecLogo,
    accent: Color(0xFF8A6A37),
  ),
  WorkspaceConfig(
    id: 'prime_trade',
    name: 'PRIME TRADE',
    description: 'Wholesale POS, customer ledgers, stock, expenses, cash flow and reports.',
    url: 'https://prime-trade-web-app.hatchable.site/',
    logoUrl: 'https://prime-trade-web-app.hatchable.site/prime-trade-logo-circle.png',
    accent: Color(0xFF1E5E91),
  ),
];

WorkspaceConfig? workspaceForId(String id) {
  for (final workspace in workspaces) {
    if (workspace.id == id) return workspace;
  }
  return null;
}
