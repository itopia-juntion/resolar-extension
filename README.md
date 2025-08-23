# Chrome Extension MV3 Starter (KR)

기본 MV3 템플릿입니다. 팝업/옵션/콘텐츠 스크립트/백그라운드(Service Worker) 구조를 포함합니다.

## 설치 (Load unpacked)
1. 크롬 주소창에 `chrome://extensions` 입력 후 엔터
2. 우측 상단 **개발자 모드** 켜기
3. **압축해제된 확장 프로그램을 로드** 클릭
4. 이 폴더를 선택

## 구성
- `manifest.json` — MV3 매니페스트
- `background.js` — 서비스 워커
- `content/content.js` — 모든 페이지에 주입되는 콘텐츠 스크립트
- `popup/` — 액션 팝업 UI (HTML/CSS/JS)
- `options/` — 옵션 페이지 (스토리지 예시)

## 사용
- 확장 아이콘을 눌러 팝업을 연 뒤, **현재 탭 하이라이트 토글** 버튼을 누르면
  현재 페이지의 주요 요소들에 테두리를 토글합니다.
- 색상은 팝업에서 바꿀 수 있고, 인사말은 옵션 페이지에서 변경합니다.

## 권한
- `storage`: `chrome.storage.sync` 사용
- `activeTab`: 팝업 버튼(사용자 제스처)으로 활성 탭과 통신

## 빌드/배포 팁
- 아이콘은 매니페스트에 생략되어 있습니다. 배포 시 `icons` 필드를 추가하고 실제 PNG 아이콘을 넣으세요.
- 퍼미션은 최소화되어 있습니다. 필요 시 `scripting`, `contextMenus` 등을 추가하세요.
