package com.erpm.medical.lms;

import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private boolean secureQuizModeEnabled = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView != null) {
            webView.addJavascriptInterface(new SecureQuizBridge(), "LmsSecureQuiz");
        }
    }

    @Override
    protected void onDestroy() {
        setSecureQuizMode(false);
        super.onDestroy();
    }

    private void setSecureQuizMode(boolean enabled) {
        secureQuizModeEnabled = enabled;
        runOnUiThread(() -> {
            if (enabled) {
                getWindow().setFlags(
                    WindowManager.LayoutParams.FLAG_SECURE,
                    WindowManager.LayoutParams.FLAG_SECURE
                );
            } else {
                getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
            }
        });
    }

    public class SecureQuizBridge {
        @JavascriptInterface
        public void enable() {
            setSecureQuizMode(true);
        }

        @JavascriptInterface
        public void disable() {
            setSecureQuizMode(false);
        }

        @JavascriptInterface
        public boolean isEnabled() {
            return secureQuizModeEnabled;
        }

        @JavascriptInterface
        public String getCaptureState() {
            return "{\"captureActive\":false,\"reason\":\"\",\"secureModeEnabled\":" +
                (secureQuizModeEnabled ? "true" : "false") +
                ",\"supported\":true}";
        }
    }
}
