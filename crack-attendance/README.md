# 크랙 매일 자동 출석

GitHub 서버에서 매일 **한국시간 00:10** (초기화 00:00 + 10분)에 출석해요. 폰·PC 꺼져 있어도 됨.

## 동작
1. `refresh_token`(14일짜리)을 들고 `https://crack.wrtn.ai/` 접속 → 서버가 새 `access_token`(1시간짜리)을 줌
2. 그 토큰으로 `POST https://crack-api.wrtn.ai/crack-cash/cash/reward-cards/check-in`
3. 응답 `granted: true` = 출석 완료, `false` = 오늘 이미 받음

## 설정 (한 번만)
1. PC 크롬 → crack.wrtn.ai 로그인 → `F12` → **Application → Cookies → https://crack.wrtn.ai**
2. `refresh_token` 의 Value 복사
3. GitHub 저장소 **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `CRACK_REFRESH_TOKEN` / Secret: 복사한 값
4. **Actions** 탭 → **크랙 매일 출석** → **Run workflow** 로 테스트

⚠️ refresh_token 은 채팅·코드에 붙여넣지 마세요.

## 주의
- `refresh_token` 은 **14일 뒤 만료** → 실패 메일이 오면 1~3번 다시
- 스케줄 실행은 **main 브랜치**에 있어야 돌아감
- GitHub 스케줄은 몇 분~수십 분 늦을 수 있음
- 초기화 시각이 다르면 `.github/workflows/crack-attendance.yml` 의 `cron` 수정 (UTC = 한국시간 − 9)
- 자동화는 이용약관 위반이 될 수 있음 (본인 책임)
