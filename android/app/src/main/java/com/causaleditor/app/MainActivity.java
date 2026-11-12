package com.causaleditor.app;

import android.graphics.Rect;
import android.os.Build;
import android.view.View;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;

import java.util.Arrays;
import java.util.List;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(DataFilesPlugin.class);
        registerPlugin(UpdatePlugin.class);
        super.onCreate(savedInstanceState);

        // 뒤로 가기: 웹 화면에서 열린 창(설정 등)을 먼저 닫고, 닫을 것이 없을 때만 기본 동작(종료)을 합니다.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                getBridge().getWebView().evaluateJavascript(
                        "(window.__androidBack ? window.__androidBack() : false)",
                        value -> {
                            if ("true".equals(value)) return;   // 웹에서 창을 하나 닫았습니다
                            setEnabled(false);
                            getOnBackPressedDispatcher().onBackPressed();
                            setEnabled(true);
                        });
            }
        });
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) updateGestureExclusion();
    }

    // 제스처 내비게이션에서도 화면 양쪽 가장자리 스와이프가 앱으로 오게 합니다.
    // 왼쪽 가장자리 = 위쪽 툴바 서랍, 오른쪽 가장자리 = 하단 패널 서랍을 여는 동작입니다.
    // 시스템 제한 때문에 가장자리마다 200dp 높이까지만 제외할 수 있어서, 아래쪽 영역에만 적용합니다.
    private void updateGestureExclusion() {
        View decor = getWindow().getDecorView();
        int w = decor.getWidth(), h = decor.getHeight();
        if (w == 0 || h == 0) return;
        float d = getResources().getDisplayMetrics().density;
        int strip = Math.round(36 * d), zone = Math.round(200 * d), bottom = Math.round(60 * d);
        int top = Math.max(0, h - bottom - zone), end = h - bottom;
        List<Rect> rects = Arrays.asList(new Rect(0, top, strip, end), new Rect(w - strip, top, w, end));
        decor.setSystemGestureExclusionRects(rects);
    }
}
