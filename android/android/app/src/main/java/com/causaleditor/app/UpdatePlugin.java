package com.causaleditor.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

// GitHub 비공개 저장소의 최신 릴리즈(APK)를 확인하고 내려받아 설치합니다.
// 다운로드 진행률은 JS가 progress 메서드를 주기적으로 호출해서 읽습니다.
@CapacitorPlugin(name = "Updater")
public class UpdatePlugin extends Plugin {
    private static volatile long downloaded = 0;
    private static volatile long totalBytes = 0;
    private static volatile boolean downloading = false;

    @PluginMethod
    public void appInfo(PluginCall call) {
        try {
            android.content.pm.PackageInfo info = getContext().getPackageManager()
                    .getPackageInfo(getContext().getPackageName(), 0);
            JSObject ret = new JSObject();
            ret.put("versionName", info.versionName);
            ret.put("versionCode", info.versionCode);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void checkLatest(PluginCall call) {
        final String repo = call.getString("repo", "");
        final String token = call.getString("token", "");
        new Thread(() -> {
            try {
                HttpURLConnection c = open(new URL("https://api.github.com/repos/" + repo + "/releases/latest"),
                        token, "application/vnd.github+json");
                int code = c.getResponseCode();
                if (code == 404) { call.reject("릴리즈를 찾지 못했습니다. 저장소 이름과 토큰을 확인해 주세요."); return; }
                if (code == 401 || code == 403) { call.reject("GitHub 인증에 실패했습니다. 토큰을 확인해 주세요."); return; }
                if (code != 200) { call.reject("업데이트 확인 실패 (HTTP " + code + ")"); return; }
                JSONObject rel = new JSONObject(readAll(c.getInputStream()));
                JSONObject apk = null;
                JSONArray assets = rel.optJSONArray("assets");
                if (assets != null) {
                    for (int i = 0; i < assets.length(); i++) {
                        JSONObject a = assets.getJSONObject(i);
                        if (a.optString("name", "").toLowerCase().endsWith(".apk")) { apk = a; break; }
                    }
                }
                if (apk == null) { call.reject("최신 릴리즈에 APK 파일이 없습니다."); return; }
                JSObject ret = new JSObject();
                ret.put("tag", rel.optString("tag_name", ""));
                ret.put("notes", rel.optString("body", ""));
                ret.put("assetName", apk.getString("name"));
                ret.put("assetUrl", apk.getString("url"));
                ret.put("assetSize", apk.optLong("size", 0));
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("업데이트 확인 실패: " + e.getMessage());
            }
        }).start();
    }

    @PluginMethod
    public void download(PluginCall call) {
        final String url = call.getString("url", "");
        final String token = call.getString("token", "");
        final String fileName = call.getString("fileName", "update.apk").replaceAll("[^A-Za-z0-9._-]", "_");
        new Thread(() -> {
            downloaded = 0;
            totalBytes = 0;
            downloading = true;
            try {
                HttpURLConnection c = open(new URL(url), token, "application/octet-stream");
                int code = c.getResponseCode();
                // GitHub는 실제 파일을 다른 주소로 넘겨줍니다. 그 주소에는 토큰을 보내지 않습니다.
                if (code == 301 || code == 302 || code == 303 || code == 307 || code == 308) {
                    String location = c.getHeaderField("Location");
                    c.disconnect();
                    c = open(new URL(location), null, "application/octet-stream");
                    code = c.getResponseCode();
                }
                if (code != 200) { call.reject("다운로드 실패 (HTTP " + code + ")"); return; }
                totalBytes = c.getContentLengthLong();
                File dir = new File(getContext().getCacheDir(), "updates");
                if (!dir.isDirectory() && !dir.mkdirs()) throw new IOException("폴더를 만들지 못했습니다.");
                File out = new File(dir, fileName);
                try (InputStream in = c.getInputStream(); OutputStream os = new FileOutputStream(out)) {
                    byte[] buf = new byte[64 * 1024];
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        os.write(buf, 0, n);
                        downloaded += n;
                    }
                }
                JSObject ret = new JSObject();
                ret.put("path", out.getAbsolutePath());
                ret.put("size", out.length());
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("다운로드 실패: " + e.getMessage());
            } finally {
                downloading = false;
            }
        }).start();
    }

    @PluginMethod
    public void progress(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("downloading", downloading);
        ret.put("received", downloaded);
        ret.put("total", totalBytes);
        call.resolve(ret);
    }

    @PluginMethod
    public void canInstall(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("allowed", Build.VERSION.SDK_INT < Build.VERSION_CODES.O
                || getContext().getPackageManager().canRequestPackageInstalls());
        call.resolve(ret);
    }

    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + getContext().getPackageName()));
        getActivity().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void install(PluginCall call) {
        try {
            File apk = new File(call.getString("path", "")).getCanonicalFile();
            File updates = new File(getContext().getCacheDir(), "updates").getCanonicalFile();
            if (!apk.getPath().startsWith(updates.getPath() + File.separator) || !apk.isFile()) {
                call.reject("설치 파일을 찾지 못했습니다.");
                return;
            }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("설치 화면을 열지 못했습니다: " + e.getMessage());
        }
    }

    private static HttpURLConnection open(URL url, String token, String accept) throws IOException {
        HttpURLConnection c = (HttpURLConnection) url.openConnection();
        c.setInstanceFollowRedirects(false);
        c.setConnectTimeout(15000);
        c.setReadTimeout(30000);
        c.setRequestProperty("Accept", accept);
        c.setRequestProperty("User-Agent", "causal-editor-android");
        if (token != null && !token.isEmpty()) c.setRequestProperty("Authorization", "Bearer " + token);
        return c;
    }

    private static String readAll(InputStream in) throws IOException {
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) > 0) bos.write(buf, 0, n);
        return bos.toString("UTF-8");
    }
}
