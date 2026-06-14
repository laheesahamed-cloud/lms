package com.erpm.medical.lms;

import android.graphics.Color;
import android.os.Bundle;
import android.os.Build;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private boolean secureQuizModeEnabled = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        configureEdgeToEdgeWindow();
        super.onCreate(savedInstanceState);
        configureEdgeToEdgeWindow();
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView != null) {
            webView.setFitsSystemWindows(false);
            webView.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_YES);
            webView.setBackgroundColor(Color.rgb(6, 13, 34));
            webView.setOverScrollMode(View.OVER_SCROLL_ALWAYS);
            webView.setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY);
            webView.setScrollbarFadingEnabled(true);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                webView.setNestedScrollingEnabled(true);
            }
            webView.getSettings().setCacheMode(WebSettings.LOAD_DEFAULT);
            webView.getSettings().setDomStorageEnabled(true);
            webView.getSettings().setDatabaseEnabled(true);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                webView.getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
            }
            webView.addJavascriptInterface(new SecureQuizBridge(), "LmsSecureQuiz");
        }
    }

    private void configureEdgeToEdgeWindow() {
        Window window = getWindow();
        if (window == null) return;

        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams attributes = window.getAttributes();
            attributes.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            window.setAttributes(attributes);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setStatusBarContrastEnforced(false);
            window.setNavigationBarContrastEnforced(false);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false);
        } else {
            window.getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE |
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN |
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            );
        }
    }

    @Override
    public void onDestroy() {
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
