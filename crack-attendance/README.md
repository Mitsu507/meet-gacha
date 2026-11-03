# 크랙 매일 자동 출석

GitHub 서버에서 매일 **한국시간 00:10** (초기화 00:00 + 10분)에 출석 요청을 보내요.
폰·PC가 꺼져 있어도 돌아가요.

## 설정 (한 번만)

### 1. 출석 요청 알아내기
1. PC 크롬으로 크랙 웹사이트에 로그인
2. `F12` → **Network** 탭 → 필터에 `attend` 또는 `check` 입력
3. 크래커 화면 → **무료로 받기** → **출석하기** 클릭 (오늘 이미 했으면 다음 날)
4. 새로 생긴 요청을 클릭해서 확인
   - **Request URL** → `CRACK_ATTEND_URL`
   - **Request Method** (GET/POST) → `CRACK_ATTEND_METHOD`
   - Request Headers 의 `Authorization: Bearer xxxxx` 에서 `xxxxx` → `CRACK_TOKEN`
   - Payload 탭에 내용이 있으면 → `CRACK_ATTEND_BODY`

### 2. GitHub Secrets 에 넣기
저장소 **Settings → Secrets and variables → Actions → New repository secret** 에 위 값들을 넣기.
⚠️ 토큰은 비밀번호와 같아요. 채팅·코드에 붙여넣지 마세요.

### 3. 테스트
**Actions** 탭 → **크랙 매일 출석** → **Run workflow**.
초록색이면 성공. 실패하면 GitHub 가 메일로 알려줘요.

## 참고
- 스케줄 실행은 **기본 브랜치(main)에 있는 워크플로만** 돌아요.
- GitHub 스케줄은 서버가 바쁘면 몇 분~수십 분 늦게 실행될 수 있어요.
- 초기화 시각이 다르면 `.github/workflows/crack-attendance.yml` 의 `cron` 만 바꾸면 돼요 (UTC = 한국시간 − 9).
- 토큰이 만료되면 실패 메일이 와요 → 1번처럼 새 토큰을 받아 `CRACK_TOKEN` 만 갈아끼우면 돼요.
- 공개 저장소면 실행 로그도 공개예요 (토큰은 GitHub 가 자동으로 `***` 처리).
- 자동화는 서비스 이용약관에 걸릴 수 있으니 본인 책임으로 사용하세요.
