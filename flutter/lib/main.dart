import 'package:material_ui/material_ui.dart';
import 'mec_flutter_core.dart';

const appConfig = ProjectConfig(
  name: 'MEC Detail Banking System',
  subtitle: 'Finance, payments and cash flow',
  appUrl: 'https://mec-detail-banking.hatchable.site/',
  apiBaseUrl: 'https://mec-detail-banking.hatchable.site/api',
  logoUrl: 'https://mec-detail-banking.hatchable.site/mec-logo.webp',
  healthPath: '/ecosystem-health',
  loginUrl: 'https://mec-detail-banking.hatchable.site/login.html',
  accent: Color(0xFF0B1830),
  features: <ProjectFeature>[
    ProjectFeature(title: 'Dashboard', description: 'Finance workspace overview', path: '/dashboard'),
    ProjectFeature(title: 'Transactions', description: 'Business transactions and transfers', path: '/transactions'),
    ProjectFeature(title: 'Accounts & wallets', description: 'Bank accounts and cash wallets', path: '/accounts'),
    ProjectFeature(title: 'Businesses', description: 'Business account directory', path: '/businesses'),
    ProjectFeature(title: 'Payment proofs', description: 'Payment slips and verification', path: '/proofs'),
    ProjectFeature(title: 'Documents', description: 'Financial documents and attachments', path: '/documents'),
    ProjectFeature(title: 'Reports', description: 'Financial and cash-flow reports', path: '/reports'),
    ProjectFeature(title: 'Activity log', description: 'Access and activity history', path: '/audit'),
    ProjectFeature(title: 'Reconciliation', description: 'Payment and ledger reconciliation', path: '/reconciliation'),
  ],
);

void main() {
  runApp(const MecProjectApp(config: appConfig));
}
