package com.erpm.medical.lms;

import android.os.Bundle;
import android.os.Build;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

import java.io.File;

public class MainActivity extends BridgeActivity {
    private boolean secureQuizModeEnabled = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        clearWebViewCacheBeforeLoad();
        super.onCreate(savedInstanceState);
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView != null) {
            webView.clearCache(true);
            webView.getSettings().setCacheMode(WebSettings.LOAD_NO_CACHE);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                webView.getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
            }
            webView.addJavascriptInterface(new SecureQuizBridge(), "LmsSecureQuiz");
        }
    }

    private void clearWebViewCacheBeforeLoad() {
        deleteDirectory(new File(getCacheDir(), "WebView/Default/HTTP Cache"));
        deleteDirectory(getCacheDir());
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            deleteDirectory(getCodeCacheDir());
        }
    }

    private boolean deleteDirectory(File file) {
        if (file == null || !file.exists()) return true;
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) {
                for (File child : children) {
                    deleteDirectory(child);
                }
            }
        }
        return file.delete();
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
