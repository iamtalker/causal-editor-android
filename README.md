# 인과 편집기 안드로이드 앱

인과 편집기의 안드로이드 앱 저장소입니다. PC 편집기와 같은 화면(`프로그램/index.html`)을 Capacitor로 감싸 APK로 빌드합니다. PC 편집기 소스는 [causal-editor](https://github.com/iamtalker/causal-editor)에서 관리하며, 이 저장소에는 안드로이드 전용 코드만 둡니다.

## 구성

| 경로 | 내용 |
| --- | --- |
| `web/` | 안드로이드 전용 자바스크립트 (`android-shim.js`, `android-touch.js`, `android-update.js`) |
| `native/` | 안드로이드 네이티브 플러그인 원본 (`DataFilesPlugin.java`, `UpdatePlugin.java`, `UpdateReceiver.java`, `ReplacedReceiver.java`) |
| `scripts/copy-web.js` | PC 편집기 파일을 `www/`로 복사하고 안드로이드 파일을 끼워 넣으며, `native/`의 자바 파일을 Gradle 프로젝트로 복사 |
| `android/` | Gradle 안드로이드 프로젝트 (Capacitor가 만든 프로젝트) |
| `capacitor.config.json` | 앱 ID `com.causaleditor.app`, 앱 이름 "인과 편집기", 웹 폴더 `www` |
| `www/` | `copy-web.js`가 만드는 웹 파일 모음 (Git에 올리지 않음) |

`native/`의 자바 파일이 원본이고, `android/app/src/main/java/com/causaleditor/app/`의 같은 파일은 `copy-web.js`가 복사한 결과입니다. 자바 파일을 고칠 때는 `native/`에서 고칩니다.

## 필요한 것

- Node.js
- JDK와 Android SDK (`android/local.properties`에 `sdk.dir` 설정, Git에 올리지 않음)
- PC 편집기 소스: `프로그램/index.html`, `프로그램/md-graph.js`

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

> **PC 편집기 소스 위치**: `copy-web.js`는 PC 편집기의 `프로그램/index.html`과 `md-graph.js`를 읽습니다. 찾는 순서는 다음과 같습니다.
> 1. `PC_PROGRAM_DIR` 환경 변수가 가리키는 폴더
> 2. 이 저장소 바로 위의 `인과편집기/프로그램/` (PC 저장소 기준)
> 3. 이 저장소 안의 `프로그램/`
>
> 다른 위치에 PC 저장소를 두었다면 `PC_PROGRAM_DIR`을 설정하세요.
>
> **JDK**: Capacitor 7은 JDK 21이 필요합니다. `JAVA_HOME`이 JDK 17을 가리키면 `invalid source release: 21` 오류가 납니다. 빌드할 때 JDK 21 경로를 `JAVA_HOME`으로 지정하세요.

## 최소 사양

`android/variables.gradle` 기준입니다.

- minSdk 23 (안드로이드 6.0)
- compileSdk / targetSdk 35
- Capacitor 7.6.10

## 안드로이드에서 달라지는 점

- **데이터 폴더**: 데이터 폴더 고르기에서 기기의 기본 파일 탐색기를 씁니다. SD 카드 같은 외부 저장소도 고를 수 있습니다.
- **파일 저장**: `DataFilesPlugin`이 기기 저장소의 파일을 읽고 씁니다. 노드 파일(`노드파일/`)이 그래프의 원본입니다.
- **터치**: 노드를 손가락으로 끌어 옮기고, 빈 곳을 한 손가락으로 밀고, 두 손가락으로 확대·축소합니다. 빈 곳을 두 번 탭하면 노드가 추가됩니다. 노드 상자의 제목을 누르면 제목 칸, 메모를 누르면 메모 칸으로 바로 갑니다.
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

## 공개 범위

이 저장소에는 앱 코드와 빌드 설정만 둡니다. 다음 항목은 Git에 올리지 않습니다.

- 노드 기록: `노드파일/`, `내부데이터/`, `변경이력/`, `개인자료/`
- 빌드 결과와 로컬 설정: `www/`, `node_modules/`, `android/local.properties`, `android/build/`, 키스토어 파일
