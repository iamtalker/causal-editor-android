# 인과 편집기 안드로이드 앱

`프로그램/index.html`(PC 편집기 화면)을 그대로 쓰고, PC의 `server.js`가 하던 파일 저장 작업을 안드로이드 저장소에서 처리하는 Capacitor 앱입니다. 노드 파일 동기화는 Syncthing이 맡습니다.

## 구조

- `web/android-shim.js` : `/api/*` 요청을 기기 파일 작업으로 바꿔 주는 어댑터 (`server.js`와 같은 응답 형식)
- `native/DataFilesPlugin.java` : 내장 저장소 파일 읽기·쓰기·목록 플러그인 (허용 범위는 `/storage/emulated/0` 안)
- `scripts/copy-web.js` : `프로그램/index.html`을 `www/`로 복사하고 어댑터를 끼워 넣음. PC용 HTML은 바꾸지 않음
- `android/` : Capacitor가 만든 안드로이드 프로젝트 (Gradle)

## 데이터 위치

- 기본 폴더: `/storage/emulated/0/Documents/인과편집기`
- 편집기 설정의 데이터 폴더 항목에서 다른 폴더를 고를 수 있습니다. 선택은 앱 WebView 저장소에 남습니다.
- 폴더 구조는 PC와 같습니다: `노드파일/`, `변경이력/`
- Syncthing으로 이 폴더를 동기화하면 됩니다.

## 빌드 방법

필요한 것: Node.js 20 이상, JDK 21, Android SDK (`compileSdk 35`).

```bash
cd android
npm install
npm run build:apk
```

- Gradle이 JDK 21을 써야 합니다. 이 PC에서는 `JAVA_HOME="C:/Program Files/Eclipse Adoptium/jdk-21.0.13.9-hotspot"`로 지정해 빌드했습니다.
- `android/local.properties`의 `sdk.dir`은 PC마다 다르므로 저장소에 올리지 않습니다 (`android/android/.gitignore`에 포함).
- 결과물: `android/android/app/build/outputs/apk/debug/app-debug.apk`

웹 화면만 바꾼 뒤에는 `npm run sync`로 다시 복사하고 빌드합니다.

## 처음 실행할 때

- "모든 파일 관리" 권한 화면이 열립니다. 허용해야 데이터 폴더에 저장됩니다 (Android 11 이상).

## 업데이트

- 헤더 오른쪽 끝의 `업데이트` 버튼을 누르면 현재 버전과 새 버전을 비교합니다.
- `업데이트 확인`은 GitHub 릴리즈의 최신 APK를 찾습니다. 저장소가 공개라서 토큰 없이 동작합니다.
- 새 버전이 있으면 `다운로드 후 설치`를 누릅니다. 다운로드 진행률이 막대와 퍼센트로 표시됩니다.
- 설치 전에 "출처를 알 수 없는 앱 설치"를 이 앱에 허용해야 합니다. 허용 화면은 앱 안의 버튼으로 바로 열립니다.
- 현재 최신 릴리즈: v1.1.3 (빌드 5)

릴리즈 목록: https://github.com/iamtalker/causal-editor-android/releases

## 아직 안 되는 것 / 차이점

- 노드 Markdown을 앱에서 여는 버튼은 동작하지 않습니다. 동기화된 폴더에서 직접 여세요.
- PC에 있던 예전 브라우저 폴더 형식의 그래프 자동 이전 기능은 넣지 않았습니다.
- 터치 조작(드래그 연결, 더블클릭 추가)은 PC 화면 그대로입니다. 실제 기기에서 조작감을 확인하고 조정이 필요합니다.
- 에뮬레이터나 실제 기기에서는 아직 실행해 보지 않았습니다. 빌드와 저장 로직(graph, nodes, versions 응답)은 PC에서 모의 파일 시스템으로 확인했습니다.
