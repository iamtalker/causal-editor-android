# 인과 편집기 안드로이드 앱

인과 편집기의 안드로이드 앱 저장소입니다. 편집기 화면(`src/`의 `index.html`, `app.js`, `storage.js`, `md-graph.js`)을 Capacitor로 감싸 APK로 빌드합니다. 흐름 모드, 연결 모드, 5가지 정렬, 버전 기록 자동 저장 같은 PC 편집기의 기능이 이 화면 코드에 들어 있습니다.

`src/`는 PC 편집기([causal-editor](https://github.com/iamtalker/causal-editor)의 크롬 확장)와 같은 편집기에서 갈라져 나온 **이 저장소 자신의 복사본**입니다. 예전에는 PC 저장소의 설치버전 폴더에서 가져왔지만 설치버전을 없애면서 이 저장소 안으로 옮겼습니다. 그래서 PC 편집기에서 기능을 고치면 같은 수정을 `src/`에도 직접 반영해야 합니다(자동으로 따라오지 않습니다).

**동기화 확인**: `npm run check-drift`는 PC 원본(`../인과편집기/크롬확장/`)과 `src/`의 화면 파일을 비교해 바뀐 줄 수를 보여 줍니다. 파일은 고치지 않습니다. PC 쪽을 고친 뒤 실행해 보고, 아래 **의도한 차이** 말고 다른 차이가 있으면 `src/`에 반영합니다. 다른 위치의 PC 원본은 `PC_DIR` 환경 변수로 지정합니다.

의도한 차이(안드로이드 쪽에서 일부러 다르게 둔 부분):
- `storage.js`: 안드로이드는 `/api/*` 요청을 보내는 옛 서버 방식을 그대로 둡니다. `android-shim.js`가 이 요청을 기기 파일 작업으로 바꿉니다. PC의 IndexedDB·폴더 저장 코드로 바꾸면 기기 저장이 깨집니다.
- `app.js`: 폴더 설정 문구와 `connectFolder` 동작이 안드로이드 저장 방식에 맞춰져 있습니다.
- `index.html`: PC의 "데이터를 안전하게 보관하세요" 안내창(`folderTipDlg`)은 안드로이드에 없습니다.
- `md-graph.js`는 두 쪽이 같아야 합니다.

## 구성

| 경로 | 내용 |
| --- | --- |
| `src/` | 편집기 화면 파일 (`index.html`, `app.js`, `storage.js`, `md-graph.js`). `storage.js`는 서버에 `/api/*` 요청을 보내는 방식입니다 |
| `web/` | 안드로이드 전용 자바스크립트 (`android-shim.js`: `storage.js`의 `/api/*` 요청을 기기 파일 작업으로 바꿔 주는 어댑터, `android-touch.js`, `android-update.js`) |
| `native/` | 안드로이드 네이티브 플러그인 원본 (`DataFilesPlugin.java`, `UpdatePlugin.java`, `UpdateReceiver.java`, `ReplacedReceiver.java`) |
| `scripts/copy-web.js` | `src/`의 화면 파일을 `www/`로 복사하고 안드로이드 파일을 끼워 넣으며, `native/`의 자바 파일을 Gradle 프로젝트로 복사 |
| `android/` | Gradle 안드로이드 프로젝트 (Capacitor가 만든 프로젝트) |
| `capacitor.config.json` | 앱 ID `com.causaleditor.app`, 앱 이름 "인과 편집기", 웹 폴더 `www` |
| `scripts/check-drift.js` | PC 원본과 `src/`의 화면 파일 차이를 보고만 함 (`npm run check-drift`) |
| `www/` | `copy-web.js`가 만드는 웹 파일 모음 (Git에 올리지 않음) |

`native/`의 자바 파일이 원본이고, `android/app/src/main/java/com/causaleditor/app/`의 같은 파일은 `copy-web.js`가 복사한 결과입니다. 자바 파일을 고칠 때는 `native/`에서 고칩니다.

## 필요한 것

- Node.js
- JDK와 Android SDK (`android/local.properties`에 `sdk.dir` 설정, Git에 올리지 않음)

## 빌드

```bash
npm install
npm run build:apk
```

`build:apk`는 다음 순서로 실행합니다.

1. `node scripts/copy-web.js`: `www/`를 만들고 네이티브 자바 파일을 Gradle 프로젝트로 복사
2. `npx cap sync android`: Capacitor 설정을 안드로이드 프로젝트에 반영
3. `android/`에서 `gradlew.bat assembleDebug`: 디버그 APK 빌드

디버그 APK는 Gradle 기본 위치인 `android/app/build/outputs/apk/debug/`에 생깁니다.

> **화면 파일 위치**: `copy-web.js`는 이 저장소의 `src/`에서 `index.html`, `app.js`, `storage.js`, `md-graph.js`를 읽습니다. 다른 곳의 파일로 빌드해 보려면 `SRC_DIR` 환경 변수로 폴더를 지정하세요. `index.html`의 보안 정책(CSP) 줄은 앱 안에서 필요 없어 복사할 때 뺍니다.
>
> **JDK**: Capacitor 7은 JDK 21이 필요합니다. `JAVA_HOME`이 JDK 17을 가리키면 `invalid source release: 21` 오류가 납니다. 빌드할 때 JDK 21 경로를 `JAVA_HOME`으로 지정하세요.

## 최소 사양

`android/variables.gradle` 기준입니다.

- minSdk 23 (안드로이드 6.0)
- compileSdk / targetSdk 35
- Capacitor 7.6.10

## 안드로이드에서 달라지는 점

- **데이터 폴더**: 설정의 "폴더 바꾸기"가 기기의 기본 파일 탐색기를 엽니다. SD 카드 같은 외부 저장소도 고를 수 있고, 바꾸면 바로 적용됩니다. "기본 폴더로"로 `Documents/인과편집기`로 돌아갑니다. 고른 폴더에 노드 파일이 이미 있으면 PC와 같이 "폴더 내용을 불러올지, 지금 그래프로 덮어쓸지" 묻습니다.
- **파일 저장**: `src/storage.js`가 서버에 보내던 요청(`/api/nodes`, `/api/graph`, `/api/versions`, `/api/data-folder`, `/api/pick-folder`, `/api/folder-info`)을 `android-shim.js`가 받아 `DataFilesPlugin`으로 기기 저장소의 파일을 읽고 씁니다. 기기 파일 쓰기는 느려서, 파일에 이미 같은 내용이 있다고 아는 노드 파일과 그래프 JSON은 다시 쓰지 않고 바뀐 것만 씁니다. 노드 파일(`노드파일/`)이 그래프의 원본입니다.
- **터치**: 노드를 손가락으로 끌어 옮기고, 빈 곳을 한 손가락으로 밀고, 두 손가락으로 확대·축소합니다. 빈 곳을 두 번 탭하면 노드가 추가됩니다. 노드를 탭하면 선택만 합니다. 노드를 길게 누르면(약 0.45초, 짧은 진동) 그 자리에서 제목·메모·진행 상태 편집창이 열립니다(누른 자리에 따라 제목, 메모, 진행 상태 칸으로 갑니다). 빈 곳을 탭하면 저장되고 닫힙니다. PC의 사이드바에 해당하는 패널에서도 같은 노드를 고칠 수 있습니다(화면 오른쪽 가장자리에서 왼쪽으로 밀면 서랍으로 열립니다. 이때 열려 있던 편집창은 먼저 저장하고 닫습니다). 흐름·연결 모드에서 중심 노드를 처음 고르는 누르기와 화살표 연결 중의 누르기는 편집창을 열지 않습니다.
- **화살표 연결**: 노드를 선택하면 노드 오른쪽에 둥근 손잡이(→)가 나타납니다. 손잡이를 다른 노드까지 끌어 놓으면 화살표가 생깁니다. 끄는 동안 점선이 손가락을 따라오고, 결과 노드 위에 오면 초록색으로 바뀝니다. 노드 몸통을 끌면 지금처럼 노드가 움직입니다. 오른쪽 아래의 "화살표 연결" 버튼도 그대로 씁니다. 버튼을 누른 뒤 결과 노드를 탭하면 연결됩니다. PC의 Shift+클릭에 해당합니다. 구현은 `web/android-touch.js`에 있고, 연결 상태는 PC와 같은 `pendingConnectionSource`를 씁니다.
- **툴바 서랍**: 화면 왼쪽 가장자리에서 오른쪽으로 밀면 툴바가 서랍으로 열립니다. 편집, 보기, 화면, 찾기, 파일, 앱 묶음으로 나누고 항목은 손가락으로 누르기 좋은 높이(44px)에 같은 왼쪽 여백으로 맞췄습니다. 모양은 `web/android-touch.js`의 스타일에 있습니다.
- **사이드 패널**: 폰 화면(800px 이하)에서는 처음에 접어 그래프를 넓게 보여 줍니다. 사용자가 직접 연 적이 있으면 그 설정을 따릅니다.
- **상태 보기**: 툴바의 상태 보기 드롭다운은 PC와 같습니다. 화면 설정이라 파일에 저장되지 않습니다.
- **Markdown 열기**: 노드 편집 패널의 "노드 md 파일 열기"는 기기의 텍스트 보기·편집 앱 선택창을 엽니다.
- **뒤로 가기**: 설정 같은 창이 열려 있으면 먼저 창을 닫고, 한 번 더 누르면 앱이 종료됩니다.
- **파일 다시 읽기**: 앱을 열 때, 상단의 "파일 다시 읽기"를 누를 때, 앱이 다시 보일 때 노드 파일을 읽어 그래프를 만듭니다. 다른 기기에서 동기화된 파일도 이렇게 반영됩니다.

## 자동 업데이트

`UpdatePlugin`과 `web/android-update.js`가 앱 업데이트를 처리합니다.

1. 앱을 열면 6시간마다 GitHub 최신 릴리즈를 확인합니다. 설정 창에서 자동 확인을 끌 수 있습니다.
2. 새 버전이 있으면 화면 위 띠로 알리고, "업데이트"를 누르면 APK를 받습니다.
3. 받는 중에는 진행 막대와 알림으로 진행률을 보여 줍니다.
4. 받은 뒤 설치 확인 화면을 열고, 설치 중 단계를 안내합니다.
5. 설치 뒤 새 버전으로 켜지면 "업데이트 완료" 알림과 띠를 한 번 보여 줍니다.

`UpdateReceiver`와 `ReplacedReceiver`는 설치 완료와 앱 교체를 감지하는 데 씁니다.

## 네이티브 플러그인 메서드

**DataFilesPlugin** (`native/DataFilesPlugin.java`)

- `status`, `openAccessSettings`: 저장소 접근 상태 확인과 접근 설정 열기
- `readText`, `writeText`, `mkdirs`, `remove`, `list`: 파일 읽기·쓰기·폴더 만들기·삭제·목록
- `openFile`: 기기의 앱으로 파일 열기
- `pickFolder`: 기기 파일 탐색기로 데이터 폴더 고르기

**UpdatePlugin** (`native/UpdatePlugin.java`)

- `appInfo`, `checkLatest`: 현재 앱 정보와 최신 릴리즈 확인
- `download`, `progress`: APK 받기와 진행률
- `canInstall`, `openInstallSettings`, `installState`, `install`: 설치 권한 확인, 설정 열기, 설치 상태, 설치 실행

## 배포

- **정식 릴리즈**: GitHub에서 최신 릴리즈(latest)로 올리면, 설치된 앱이 6시간 안에 업데이트를 알립니다. 자동 업데이트는 `releases/latest`를 보므로 릴리즈 APK 파일 이름은 `.apk`로 끝나야 합니다.
- **테스트 빌드**: 프리릴리즈로 올리면 자동 업데이트에는 나타나지 않고, 링크로만 받을 수 있습니다. 예: `v1.2.6-test`.

```bash
gh release create v1.2.6-test --repo iamtalker/causal-editor-android --prerelease --target master --title "v1.2.6 테스트 빌드" "causal-editor-1.2.6-debug.apk"
```

디버그 APK는 서명이 달라서, 이미 설치된 앱과 서명이 다르면 설치가 막힐 수 있습니다. 이때는 기존 앱을 지우고 설치하세요. 노드 파일은 데이터 폴더에 그대로 남습니다.

## 변경 기록

### v1.3.7
- 노드를 탭하면 선택만 하고, 길게 누르면 편집창이 열립니다(전에는 탭하면 바로 열렸습니다).
- 선택한 노드 오른쪽의 손잡이(→)를 다른 노드로 끌어 놓으면 화살표가 연결됩니다. "화살표 연결" 버튼 방식도 그대로 씁니다.

### v1.3.6
- v1.3.5 앱이 제목 이름 노드 파일을 읽지 못하던 문제를 고쳤습니다. 안드로이드 어댑터(`web/android-shim.js`)의 노드 파일 판별 규칙이 옛 `n0001_` 이름만 받고 있었습니다. 이제 PC `storage.js`와 같은 규칙을 씁니다(제목 이름 `.md`와 `_경로.md`는 받고, 동기화 충돌 사본은 뺍니다).

### v1.3.5
- PC 편집기 v0.30.0의 화면 코드를 가져왔습니다. 노드 파일 이름이 제목으로 바뀌었습니다(접두사 `n0001_` 없음). 같은 제목의 노드는 한 노드로 합치고 가장 최근 파일을 남기며, 같은 id의 중복 파일은 새 번호를 주지 않습니다. 동기화 충돌 사본(`.sync-conflict-`)은 무시합니다.
- 안드로이드 `storage.js`는 파일 수정 시각을 아직 넘기지 않아, 같은 제목이 여럿이면 파일 이름 기준으로 남깁니다.
- **주의**: 옛 앱은 제목 이름 파일을 읽지 못합니다. PC 편집기도 v0.30.0 이상으로 맞춰 주세요.

## 공개 범위

이 저장소에는 앱 코드와 빌드 설정만 둡니다. 다음 항목은 Git에 올리지 않습니다.

- 노드 기록: `노드파일/`, `내부데이터/`, `변경이력/`, `개인자료/`
- 빌드 결과와 로컬 설정: `www/`, `node_modules/`, `android/local.properties`, `android/build/`, 키스토어 파일
