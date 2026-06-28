package app.xyndrome.xyndrome

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        flutterEngine.platformViewsController.registry.registerViewFactory(
            "app.xyndrome.lk/note_canvas",
            NoteCanvasViewFactory(flutterEngine.dartExecutor.binaryMessenger)
        )
    }
}
