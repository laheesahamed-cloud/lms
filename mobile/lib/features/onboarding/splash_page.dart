import 'package:flutter/material.dart';
import '../../theme/tokens.dart';

/// Holding screen shown only while auth hydrates, then the router redirects
/// to /welcome (or the app). Intentionally blank — no splash UI.
class SplashPage extends StatelessWidget {
  const SplashPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(backgroundColor: AppColors.dark.page);
  }
}
