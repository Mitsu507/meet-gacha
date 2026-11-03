// 크랙 매일 출석 자동화
// GitHub Actions에서 매일 (초기화 시각 + 10분)에 실행됨.
// 요청 정보는 전부 GitHub Secrets 에서 읽음 → 코드/로그에 토큰이 남지 않음.
//
// 필요한 Secrets
//   CRACK_TOKEN          로그인 토큰 (Authorization 헤더의 "Bearer " 뒤 값)
// 선택 Secrets
//   CRACK_ATTEND_URL     기본: crack-api.wrtn.ai/.../reward-cards/check-in
//   CRACK_ATTEND_METHOD  기본 POST
//   CRACK_ATTEND_BODY    요청 본문(JSON 문자열). 없으면 본문 없이 보냄
//   CRACK_EXTRA_HEADERS  추가 헤더(JSON 객체 문자열). 예: {"platform":"web"}

const env = (k, d = '') => (process.env[k] ?? '').trim() || d;

const url = env(
  'CRACK_ATTEND_URL',
  'https://crack-api.wrtn.ai/crack-cash/cash/reward-cards/check-in',
);
const token = env('CRACK_TOKEN');
const method = env('CRACK_ATTEND_METHOD', 'POST').toUpperCase();
const body = env('CRACK_ATTEND_BODY');
const extraHeaders = env('CRACK_EXTRA_HEADERS');

if (!token) {
  console.error('❌ CRACK_TOKEN Secret 이 비어 있어요.');
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/json, text/plain, */*',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
};
if (body) headers['Content-Type'] = 'application/json';
if (extraHeaders) {
  try {
    Object.assign(headers, JSON.parse(extraHeaders));
  } catch {
    console.error('❌ CRACK_EXTRA_HEADERS 가 올바른 JSON 이 아니에요.');
    process.exit(1);
  }
}

// 이미 출석한 경우로 볼 응답 문구 (서버 메시지를 보고 나중에 보정)
const ALREADY = /already|이미|duplicate|중복/i;

const kst = () =>
  new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false });

async function attendOnce() {
  const res = await fetch(url, {
    method,
    headers,
    body: body && method !== 'GET' ? body : undefined,
  });
  const text = await res.text();
  return { status: res.status, text: text.slice(0, 1000) };
}

for (let attempt = 1; attempt <= 3; attempt++) {
  let r;
  try {
    r = await attendOnce();
  } catch (e) {
    console.log(`[${kst()}] ${attempt}번째 시도 네트워크 오류: ${e.message}`);
    await new Promise((s) => setTimeout(s, attempt * 5000));
    continue;
  }

  // 응답 본문은 토큰을 포함하지 않지만, 혹시 몰라 토큰 문자열은 가림
  const safe = r.text.split(token).join('***');
  console.log(`[${kst()}] ${attempt}번째 시도 → HTTP ${r.status} ${safe}`);

  if (r.status >= 200 && r.status < 300) {
    // 응답 예: {"result":"SUCCESS","data":{"granted":true,"quantity":350,...}}
    // granted:false = 오늘 이미 받음
    let data = {};
    try {
      data = JSON.parse(r.text).data ?? {};
    } catch {}
    if (data.granted === true) console.log(`✅ 출석 완료 (+${data.quantity ?? '?'} 크래커)`);
    else if (data.granted === false) console.log('✅ 오늘은 이미 출석되어 있어요');
    else console.log('✅ 요청 성공');
    process.exit(0);
  }
  if (ALREADY.test(r.text)) {
    console.log('✅ 오늘은 이미 출석되어 있어요');
    process.exit(0);
  }
  if (r.status === 401 || r.status === 403) {
    console.error('❌ 토큰이 만료됐거나 잘못됐어요. CRACK_TOKEN 을 새로 넣어주세요.');
    process.exit(1); // 실패 → GitHub 가 메일로 알려줌
  }
  await new Promise((s) => setTimeout(s, attempt * 5000));
}

console.error('❌ 3번 시도했지만 출석 실패');
process.exit(1);
