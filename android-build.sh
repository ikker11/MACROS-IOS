#!/usr/bin/env bash
# =====================================================================
#  MacroFit · genera y compila la app Android (la ejecuta GitHub Actions)
#  Usa los MISMOS archivos web que la versión de iPhone (PWA), así que
#  cualquier cambio en la app se aplica a las dos a la vez.
# =====================================================================
set -euo pipefail

ROOT="$(pwd)"
A="$ROOT/android-app"
rm -rf "$A"
mkdir -p "$A/app/src/main/java/com/macrofit/app" \
         "$A/app/src/main/assets/www" \
         "$A/app/src/main/res/values" \
         "$A/app/src/main/res/values-night" \
         "$A/app/src/main/res/values-v27" \
         "$A/app/src/main/res/mipmap-xxxhdpi" \
         "$A/app/src/main/res/mipmap-anydpi-v26"

# ---------- archivos web (los mismos de la PWA) ----------
cp index.html styles.css app.js coach.js data.js ex-img.js manifest.json \
   icon-180.png icon-192.png icon-512.png "$A/app/src/main/assets/www/"

# ---------- iconos ----------
cp icon-192.png "$A/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png"
cp icon-maskable-512.png "$A/app/src/main/res/mipmap-xxxhdpi/ic_launcher_fg.png"
cat > "$A/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/icon_bg"/>
    <foreground android:drawable="@mipmap/ic_launcher_fg"/>
</adaptive-icon>
EOF

# ---------- Gradle ----------
cat > "$A/settings.gradle" <<'EOF'
pluginManagement {
    repositories { google(); mavenCentral(); gradlePluginPortal() }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories { google(); mavenCentral() }
}
rootProject.name = "MacroFit"
include ':app'
EOF

cat > "$A/build.gradle" <<'EOF'
plugins {
    id 'com.android.application' version '8.5.2' apply false
}
EOF

cat > "$A/gradle.properties" <<'EOF'
org.gradle.jvmargs=-Xmx2g -Dfile.encoding=UTF-8
android.useAndroidX=false
android.nonTransitiveRClass=true
EOF

cat > "$A/app/build.gradle" <<'EOF'
plugins {
    id 'com.android.application'
}

def vCode = Integer.parseInt(System.getenv('VERSION_CODE') ?: '1')

android {
    namespace 'com.macrofit.app'
    compileSdk 34

    defaultConfig {
        applicationId 'com.macrofit.app'
        minSdk 24
        targetSdk 34
        versionCode vCode
        versionName "1.${vCode}"
    }

    signingConfigs {
        release {
            storeFile file(System.getenv('KEYSTORE_PATH'))
            storeType 'pkcs12'
            storePassword System.getenv('KEYSTORE_PASS')
            keyAlias 'macrofit'
            keyPassword System.getenv('KEYSTORE_PASS')
        }
    }

    buildTypes {
        release {
            minifyEnabled false
            signingConfig signingConfigs.release
        }
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }

}
EOF

# ---------- Manifest ----------
cat > "$A/app/src/main/AndroidManifest.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />
    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="MacroFit"
        android:theme="@style/AppTheme"
        android:hardwareAccelerated="true">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:launchMode="singleTask"
            android:windowSoftInputMode="adjustResize"
            android:configChanges="orientation|screenSize|screenLayout|smallestScreenSize|keyboard|keyboardHidden">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
EOF

# ---------- Temas (claro / oscuro, igual que la PWA) ----------
cat > "$A/app/src/main/res/values/colors.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="bg">#F2F2F7</color>
    <color name="icon_bg">#30B45A</color>
</resources>
EOF
cat > "$A/app/src/main/res/values-night/colors.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="bg">#000000</color>
</resources>
EOF
cat > "$A/app/src/main/res/values/themes.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="android:Theme.Material.Light.NoActionBar">
        <item name="android:windowBackground">@color/bg</item>
        <item name="android:statusBarColor">@color/bg</item>
        <item name="android:navigationBarColor">#000000</item>
        <item name="android:windowLightStatusBar">true</item>
    </style>
</resources>
EOF
cat > "$A/app/src/main/res/values-v27/themes.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="android:Theme.Material.Light.NoActionBar">
        <item name="android:windowBackground">@color/bg</item>
        <item name="android:statusBarColor">@color/bg</item>
        <item name="android:navigationBarColor">@color/bg</item>
        <item name="android:windowLightStatusBar">true</item>
        <item name="android:windowLightNavigationBar">true</item>
    </style>
</resources>
EOF
cat > "$A/app/src/main/res/values-night/themes.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="android:Theme.Material.NoActionBar">
        <item name="android:windowBackground">@color/bg</item>
        <item name="android:statusBarColor">@color/bg</item>
        <item name="android:navigationBarColor">@color/bg</item>
        <item name="android:windowLightStatusBar">false</item>
    </style>
</resources>
EOF
mkdir -p "$A/app/src/main/res/values-night-v27"
cat > "$A/app/src/main/res/values-night-v27/themes.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="android:Theme.Material.NoActionBar">
        <item name="android:windowBackground">@color/bg</item>
        <item name="android:statusBarColor">@color/bg</item>
        <item name="android:navigationBarColor">@color/bg</item>
        <item name="android:windowLightStatusBar">false</item>
        <item name="android:windowLightNavigationBar">false</item>
    </style>
</resources>
EOF

# ---------- Código Java ----------
cat > "$A/app/src/main/java/com/macrofit/app/MainActivity.java" <<'EOF'
package com.macrofit.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.JsResult;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/**
 * MacroFit para Android: muestra la misma app web que la versión de iPhone,
 * empaquetada dentro del APK (funciona sin internet).
 * Los datos se guardan en el almacenamiento interno de la app y se conservan
 * al instalar versiones nuevas (mismo paquete y misma firma).
 */
public class MainActivity extends Activity {

    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/www/index.html";
    private static final int REQ_PICK = 1;
    private static final int REQ_SAVE = 2;

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private String pendingSave;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        web.setBackgroundColor(getColor(R.color.bg));
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setSupportMultipleWindows(false);
        s.setTextZoom(100);

        web.addJavascriptInterface(new Bridge(), "MacroFitAndroid");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (!HOST.equals(u.getHost())) return null;
                String path = u.getPath() == null ? "" : u.getPath();
                if (path.startsWith("/")) path = path.substring(1);
                if (path.isEmpty() || path.endsWith("/")) path = path + "index.html";
                try {
                    InputStream in = getAssets().open(path);
                    String mime = mimeOf(path);
                    Map<String, String> headers = new HashMap<>();
                    headers.put("Cache-Control", "no-cache");
                    return new WebResourceResponse(mime, mime.startsWith("image/") ? null : "utf-8", 200, "OK", headers, in);
                } catch (Exception e) {
                    return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found",
                            new HashMap<String, String>(), new ByteArrayInputStream(new byte[0]));
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (HOST.equals(u.getHost())) return false;
                openExternal(u);
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                boolean images = false;
                String[] types = params.getAcceptTypes();
                if (types != null) for (String t : types) if (t != null && t.startsWith("image")) images = true;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType(images ? "image/*" : "*/*");
                try {
                    startActivityForResult(Intent.createChooser(i, images ? "Elegir foto" : "Elegir copia de seguridad"), REQ_PICK);
                } catch (ActivityNotFoundException e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }

            @Override
            public boolean onJsAlert(WebView view, String url, String message, JsResult result) {
                new AlertDialog.Builder(MainActivity.this)
                        .setTitle("MacroFit")
                        .setMessage(message)
                        .setPositiveButton("Aceptar", (d, w) -> result.confirm())
                        .setOnCancelListener(d -> result.confirm())
                        .show();
                return true;
            }

            @Override
            public boolean onJsConfirm(WebView view, String url, String message, JsResult result) {
                new AlertDialog.Builder(MainActivity.this)
                        .setTitle("MacroFit")
                        .setMessage(message)
                        .setPositiveButton("Aceptar", (d, w) -> result.confirm())
                        .setNegativeButton("Cancelar", (d, w) -> result.cancel())
                        .setOnCancelListener(d -> result.cancel())
                        .show();
                return true;
            }
        });

        if (state != null) web.restoreState(state);
        if (state == null || web.getUrl() == null) web.loadUrl(START);
    }

    private static String mimeOf(String p) {
        String l = p.toLowerCase();
        if (l.endsWith(".html")) return "text/html";
        if (l.endsWith(".js")) return "application/javascript";
        if (l.endsWith(".css")) return "text/css";
        if (l.endsWith(".json")) return "application/json";
        if (l.endsWith(".png")) return "image/png";
        if (l.endsWith(".jpg") || l.endsWith(".jpeg")) return "image/jpeg";
        if (l.endsWith(".svg")) return "image/svg+xml";
        return "application/octet-stream";
    }

    private void openExternal(Uri u) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, u));
        } catch (ActivityNotFoundException e) {
            toast("No hay ninguna app para abrir el enlace");
        }
    }

    private void toast(String msg) {
        Toast.makeText(this, msg, Toast.LENGTH_SHORT).show();
    }

    /** Funciones que la app web puede llamar en Android. */
    private class Bridge {
        @JavascriptInterface
        public void saveFile(final String name, final String content) {
            runOnUiThread(() -> {
                pendingSave = content;
                Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("application/json");
                i.putExtra(Intent.EXTRA_TITLE, name);
                try {
                    startActivityForResult(i, REQ_SAVE);
                } catch (ActivityNotFoundException e) {
                    pendingSave = null;
                    toast("No hay gestor de archivos para guardar la copia");
                }
            });
        }

        @JavascriptInterface
        public void openUrl(final String url) {
            runOnUiThread(() -> openExternal(Uri.parse(url)));
        }

        @JavascriptInterface
        public String platform() {
            return "android";
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        Uri uri = (resultCode == RESULT_OK && data != null) ? data.getData() : null;
        if (requestCode == REQ_PICK) {
            if (fileCallback != null) {
                fileCallback.onReceiveValue(uri != null ? new Uri[]{uri} : null);
                fileCallback = null;
            }
        } else if (requestCode == REQ_SAVE) {
            if (uri != null && pendingSave != null) {
                try (OutputStream os = getContentResolver().openOutputStream(uri)) {
                    if (os == null) throw new Exception("sin salida");
                    os.write(pendingSave.getBytes(StandardCharsets.UTF_8));
                    toast("Copia de seguridad guardada");
                } catch (Exception e) {
                    toast("No se pudo guardar la copia");
                }
            }
            pendingSave = null;
        }
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.__macrofitBack ? String(window.__macrofitBack()) : 'false'", value -> {
            if (value == null || !value.contains("true")) finish();
        });
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }
}
EOF

echo "Proyecto Android generado en $A"
