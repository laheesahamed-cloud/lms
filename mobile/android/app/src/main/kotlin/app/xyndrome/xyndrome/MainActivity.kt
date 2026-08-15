package app.xyndrome.xyndrome

import android.view.WindowManager
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        flutterEngine.platformViewsController.registry.registerViewFactory(
            "app.xyndrome.lk/note_canvas",
            NoteCanvasViewFactory(flutterEngine.dartExecutor.binaryMessenger)
        )

        // Screen protection. FLAG_SECURE is a real block on Android: the OS
        // refuses the screenshot outright, screen recordings and casts render
        // black, and the app's thumbnail in the recents switcher is hidden.
        // There is no iOS equivalent — see ScreenProtection.swift.
        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            "app.xyndrome.lk/screen_protection"
        ).setMethodCallHandler { call, result ->
            when (call.method) {
                "enable" -> {
                    runOnUiThread {
                        window.setFlags(
                            WindowManager.LayoutParams.FLAG_SECURE,
                            WindowManager.LayoutParams.FLAG_SECURE
                        )
                    }
                    result.success(true)
                }
                "disable" -> {
                    runOnUiThread { window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE) }
                    result.success(true)
                }
                // Android blocks the capture before it happens, so there is
                // nothing to report after the fact and nothing to blur.
                "capabilities" -> result.success(
                    mapOf(
                        "blocksScreenshots" to true,
                        "blocksRecording" to true,
                        "hidesInAppSwitcher" to true,
                        "detectsScreenshots" to false
                    )
                )
                else -> result.notImplemented()
            }
        }
    }
}
