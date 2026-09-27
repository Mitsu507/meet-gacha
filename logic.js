// 약속 장소 가챠 - 추천 로직 (브라우저 + node 테스트 겸용)
// 장소 데이터: 카카오 로컬(장소 검색). place = { id, name, lat, lng, category: '음식점 > 한식 > 육류,고기 > 삼겹살', url, address }

// 음식/장소 태그: 카카오 카테고리 단어(정확히 일치) + 가게 이름 키워드(포함)로 판정
const TAGS = {
  '해산물': { cat: ['해물', '생선', '회', '초밥', '롤', '조개', '게', '대게', '장어', '복어', '아구', '굴', '해산물뷔페'], name: ['횟집', '회센터', '해물', '수산', '초밥', '스시', '조개', '대게', '낙지', '쭈꾸미', '주꾸미', '아구', '장어', '생선', 'crab', 'shrimp', 'seafood', 'sushi'] },
  '고기': { cat: ['육류', '고기', '삼겹살', '갈비', '곱창', '막창', '소고기', '돼지고기', '닭갈비', '양꼬치', '족발', '보쌈', '스테이크'], name: ['고기', '갈비', '삼겹', '정육', '한우', '곱창', '막창', '숯불', '양꼬치', '족발', 'bbq', 'steak'] },
  '매운음식': { cat: ['마라탕', '떡볶이', '닭발', '짬뽕', '훠궈'], name: ['마라', '떡볶이', '불닭', '짬뽕', '매운', '엽떡', '닭발', '낙곱새', '쭈꾸미', '주꾸미'] },
  '한식': { cat: ['한식', '한정식', '국밥', '해장국', '냉면', '칼국수', '국수'], name: ['국밥', '찌개', '백반', '한식', '칼국수', '냉면', '비빔밥', '설렁탕'] },
  '중식': { cat: ['중식', '중국요리', '양꼬치', '마라탕', '훠궈'], name: ['반점', '중화', '짜장', '짬뽕', '마라', '딤섬'] },
  '일식': { cat: ['일식', '초밥', '롤', '돈까스', '우동', '라멘', '일본식라면', '오마카세', '이자카야'], name: ['돈까스', '돈카츠', '라멘', '우동', '스시', '초밥', '이자카야'] },
  '양식': { cat: ['양식', '이탈리안', '프랑스음식', '스페인음식', '피자', '스테이크', '패밀리레스토랑'], name: ['파스타', '피자', '스테이크', '비스트로', '브런치', 'pasta', 'pizza', 'bistro'] },
  '패스트푸드': { cat: ['패스트푸드', '햄버거', '치킨', '샌드위치'], name: ['버거', '치킨', '맥도날드', '롯데리아', '서브웨이', 'kfc'] },
  '분식': { cat: ['분식', '떡볶이', '김밥'], name: ['분식', '김밥', '떡볶이', '라면'] },
};

// 목적별 카카오 검색 키워드. group = 카카오 카테고리 그룹 코드 (FD6 음식점, CE7 카페)
const PURPOSES = {
  meal: { label: '든든한 밥 식사', group: 'FD6', keywords: ['맛집', '한식', '중식', '일식', '양식', '고기', '분식', '국밥', '돈까스', '치킨', '햄버거', '해산물'] },
  cafe: { label: '가벼운 카페 / 디저트', group: 'CE7', keywords: ['카페', '디저트카페', '베이커리', '브런치카페', '대형카페', '빙수'] },
  drink: { label: '무드 있는 술자리', group: 'FD6', keywords: ['술집', '이자카야', '포차', '호프', '요리주점', '와인바', '칵테일바', '막걸리'] },
  play: { label: '활동적인 놀거리', group: '', keywords: ['PC방', '노래방', '코인노래방', '볼링장', '방탈출', '보드게임카페', '만화카페', '당구장', '오락실', '스크린야구', '스크린골프', 'VR체험', '실내클라이밍', '룸카페', '탁구장', '다트', '인형뽑기', '실내낚시', '롤러장', '트램폴린', '파티룸', '공방', '영화관', '찜질방', '실내사격장', '양궁카페', '아쿠아리움', '방방'] },
};

// 놀거리 세부 분류 (예산 스타일과 매칭)
const PLAY_KIND = {
  cheap: ['PC방', '피씨방', '만화카페', '보드게임', '코인노래', '오락실', '당구', '인형뽑기', '탁구', '다트'],
  active: ['방탈출', '볼링', '스크린', 'VR', '클라이밍', '트램폴린', '롤러', '사격', '양궁', '낚시', '방방'],
  chat: ['룸카페', '노래방', '노래연습장', '파티룸', '찜질방', '공방', '영화', 'CGV', '메가박스', '롯데시네마', '아쿠아리움'],
};

const TRAVEL = {
  walk: { label: '걸어서 10분', radius: 800, kmh: 4.5, wait: 0, word: '도보' },
  transit: { label: '대중교통 20분', radius: 4000, kmh: 15, wait: 5, word: '대중교통' },
  car: { label: '차 타고 멀리', radius: 10000, kmh: 25, wait: 3, word: '차로' },
};

// 받침 있으면 '이', 없으면 '가'
function iga(word) {
  const c = word.charCodeAt(word.length - 1);
  return c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 ? '이' : '가';
}

// 카카오 검색 결과 → place
function toPlace(d) {
  return { id: d.id, name: d.place_name, lat: +d.y, lng: +d.x, category: d.category_name || '', url: d.place_url, address: d.road_address_name || d.address_name || '' };
}

function distanceM(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ponytail: 직선거리×1.3 / 평균속도 추정. 실제 경로 시간은 길찾기 API 붙일 때 교체
function travelMinutes(meters, mode) {
  const m = TRAVEL[mode];
  return Math.max(1, Math.round((meters * 1.3 / 1000) / m.kmh * 60 + m.wait));
}

// ponytail: 단순 위경도 평균. 대중교통 기준 공정한 중간지점은 경로 API 필요
function midpoint(points) {
  return { lat: points.reduce((s, p) => s + p.lat, 0) / points.length, lng: points.reduce((s, p) => s + p.lng, 0) / points.length };
}

// '음식점 > 한식 > 해물,생선 > 회' → ['음식점','한식','해물','생선','회']
const catTokens = cat => cat.split(/\s*>\s*|,/).map(s => s.trim()).filter(Boolean);

function hasTag(place, tag) {
  const def = TAGS[tag];
  if (!def) return false;
  const tokens = catTokens(place.category || '');
  if (def.cat.some(c => tokens.includes(c))) return true;
  const name = place.name.toLowerCase();
  return def.name.some(w => name.includes(w));
}

function playKind(place) {
  const text = place.name + ' ' + place.category;
  for (const kind in PLAY_KIND) if (PLAY_KIND[kind].some(w => text.includes(w))) return kind;
  return null;
}

const OUTDOOR = ['야외', '캠핑', '루프탑', '공원', '해수욕장'];

// ponytail: 카카오 API엔 영업시간이 없어서 업종별 "보통" 영업시간으로 추정 (정기휴무·개별 시간은 모름).
// 정확히 하려면 구글 Places(영업시간 제공) 연동 필요. [이름·카테고리 단어, 여는 시각, 닫는 시각(24 넘으면 다음날 새벽)]
const HOURS = [
  [/24시|24H|무인|PC방|피씨방|찜질방|사우나|뽑기/i, 0, 24],
  [/술집|주점|호프|포차|이자카야|바$|와인|칵테일|맥주|막걸리/, 17, 26],
  [/노래/, 12, 28],
  [/당구|스크린골프|골프존|영화|CGV|메가박스|롯데시네마/, 10, 26],
  [/볼링|오락실|보드|만화카페|룸카페|방탈출|스크린야구|VR|다트|탁구|클라이밍|트램폴린|롤러|인라인|사격|양궁|낚시/, 11, 24],
  [/공방|공예|도자기|아쿠아리움|파티룸|공간대여/, 11, 20],
  [/국밥|해장국|순대국|감자탕/, 7, 23],
  [/분식|김밥/, 9, 21],
  [/패스트푸드|햄버거|맥도날드|버거킹|롯데리아|KFC|맘스터치/i, 9, 23],
  [/치킨|족발|보쌈|고기|삼겹|갈비|곱창|막창|양꼬치/, 16, 24],
  [/카페|커피|디저트|베이커리|빵|제과|빙수/, 9, 22],
  [/음식점/, 11, 22],
];
function typicalHours(place) {
  const text = place.name + ' ' + place.category;
  const hit = HOURS.find(([re]) => re.test(text));
  return hit ? [hit[1], hit[2]] : [10, 22];
}
// now: Date. 문 닫기 1시간 전까지만 추천
// place.week(가게 실제 영업시간, OSM에서 찾은 경우)가 있으면 그걸로, 없으면 업종 추정으로
function likelyOpen(place, now, marginMin = 60) {
  if (place.week) return !!openRange(place.week, now, marginMin);
  const [o, c] = typicalHours(place);
  if (c - o >= 24) return true;
  const t = now.getHours() * 60 + now.getMinutes();
  return [t, t + 1440].some(x => x >= o * 60 && x + marginMin <= c * 60);
}
const hhmm = h => `${h % 24}시`;
const clock = m => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
function openText(place, now) {
  if (place.week) {
    const r = openRange(place.week, now, 0);
    return r[1] - r[0] >= 1440 ? '가게 영업시간 확인됨 (24시간)' : `가게 영업시간 확인됨 (오늘 ${clock(r[1])}까지)`;
  }
  const [o, c] = typicalHours(place);
  return c - o >= 24 ? '24시간 영업하는 업종' : `지금 영업 시간대 (보통 ${hhmm(o)}~${hhmm(c)}, 방문 전 확인)`;
}

// OSM opening_hours 문자열 → 요일별(월=0) [시작분, 끝분] 목록. 끝이 1440 넘으면 다음날 새벽까지.
// ponytail: 흔한 형식만 (Mo-Fr 09:00-21:00; Sa,Su off; 24/7). 못 읽으면 null → 업종 추정으로
const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
function parseHours(str) {
  if (!str) return null;
  str = str.trim();
  if (str === '24/7') return DAYS.map(() => [[0, 1440]]);
  const week = DAYS.map(() => null);
  for (let rule of str.split(';').map(r => r.trim()).filter(Boolean)) {
    if (/[\[\]"]/.test(rule)) return null;
    let m = rule.match(/^([A-Za-z,\- ]+?)\s+(.+)$/);
    let days = DAYS.map((_, i) => i), times = rule;
    if (m && /^[A-Z]/.test(m[1])) {
      times = m[2]; days = [];
      for (const part of m[1].split(',').map(x => x.trim())) {
        if (part === 'PH' || part === 'SH') continue;
        const [a, b] = part.split('-').map(d => DAYS.indexOf(d));
        if (a < 0 || (b !== undefined && b < 0)) return null;
        for (let i = a; ; i = (i + 1) % 7) { days.push(i); if (b === undefined || i === b) break; }
      }
      if (!days.length) continue; // 공휴일 규칙만 있으면 무시
    } else if (/^(PH|SH)\b/.test(rule)) continue;
    let ranges;
    if (/^(off|closed)$/.test(times)) ranges = [];
    else {
      ranges = [];
      for (const t of times.split(',')) {
        const tm = t.trim().match(/^(\d\d?):(\d\d)-(\d\d?):(\d\d)$/);
        if (!tm) return null;
        const a = tm[1] * 60 + +tm[2]; let b = tm[3] * 60 + +tm[4];
        if (b <= a) b += 1440;
        ranges.push([a, b]);
      }
    }
    days.forEach(d => week[d] = ranges);
  }
  return week.every(w => w === null) ? null : week.map(w => w || []);
}
// 지금 열려 있고 marginMin분 이상 남은 구간 [시작, 끝] (어제 밤부터 이어진 구간 포함), 없으면 null
function openRange(week, now, marginMin) {
  const d = (now.getDay() + 6) % 7, t = now.getHours() * 60 + now.getMinutes();
  for (const r of week[d]) if (r[0] <= t && t + marginMin <= r[1]) return r;
  for (const r of week[(d + 6) % 7]) if (r[1] > 1440 && t + 1440 + marginMin <= r[1]) return [r[0] - 1440, r[1] - 1440];
  return null;
}

// 카카오 가게 ↔ OSM 가게 짝짓기: 80m 안 + 이름이 서로 포함
const normName = s => (s || '').toLowerCase().replace(/[\s()·.\-&]/g, '');
function attachHours(places, osm) {
  for (const p of places) {
    const a = normName(p.name);
    const hit = osm.find(o => o.name.length >= 2 && (a.includes(o.name) || o.name.includes(a)) && distanceM(p, o) < 80);
    if (hit) p.week = hit.week;
  }
  return places;
}

// 놀거리 키워드 검색에 딸려오는 엉뚱한 곳 거르기 (보드·만화카페는 '음식점 > 카페 > 테마카페'라 살림)
const NOT_PLAY = ['키즈카페', '골동품', '액자', '표구', '화랑', '수예', '자수', '아카데미', '학원', '체육관', '스포츠센터', '교통', '운송'];
function isPlay(place) {
  const tokens = catTokens(place.category);
  if (tokens.includes('음식점') && !tokens.includes('테마카페')) return false;
  return !NOT_PLAY.some(w => tokens.includes(w));
}

/**
 * 조건으로 후보 필터링 + 점수 매기기
 * opts: { origin, originLabel, mode, who, purpose, budget, excludes:[{tag, by}], likes:[{tag, by}], indoorOnly, blacklist:Set, seen:Set }
 * 반환: [{ place, weight, dist, reasons[] }]
 */
function scoreCandidates(places, opts) {
  const out = [];
  const excludedTags = [...new Set(opts.excludes.map(e => e.tag))];
  const food = opts.purpose === 'meal' || opts.purpose === 'drink';
  for (const p of places) {
    if (!p.name || p.lat == null) continue;
    if (opts.blacklist.has(p.id) || opts.seen.has(p.id)) continue;
    const dist = distanceM(opts.origin, p);
    if (dist > TRAVEL[opts.mode].radius) continue;
    if (food && excludedTags.some(tag => hasTag(p, tag))) continue;
    if (opts.purpose === 'play' && !isPlay(p)) continue;
    if (opts.purpose === 'meal' && catTokens(p.category).includes('술집')) continue; // 카카오는 술집도 음식점(FD6)
    if (opts.now && !likelyOpen(p, opts.now)) continue;
    if (opts.indoorOnly && OUTDOOR.some(w => (p.name + p.category).includes(w))) continue;

    let w = 1.3 - 0.6 * Math.min(1, dist / TRAVEL[opts.mode].radius); // 가까울수록 약간 우대
    const reasons = [`${opts.originLabel || '출발지'}에서 ${TRAVEL[opts.mode].word} 약 ${travelMinutes(dist, opts.mode)}분`];
    if (opts.now) reasons.push(openText(p, opts.now));

    if (food) for (const l of opts.likes) {
      if (hasTag(p, l.tag)) { w += 2; reasons.push(`${l.by}${iga(l.by)} 좋아하는 '${l.tag}'`); break; }
    }

    const cheap = hasTag(p, '분식') || hasTag(p, '패스트푸드') || /국밥|푸드코트|김밥|저가|가성비/.test(p.name + p.category);
    const fancy = hasTag(p, '양식') || hasTag(p, '일식') || /오마카세|다이닝|레스토랑|와인/.test(p.name + p.category);
    if (opts.purpose !== 'play') {
      if (opts.budget === 'cheap' && cheap) { w += 1.5; reasons.push('엔빵 부담 적은 가성비'); }
      if (opts.budget === 'special' && fancy) { w += 1.5; reasons.push('특별한 날 분위기 내기 좋은 곳'); }
      if (opts.budget === 'special' && cheap) w *= 0.4;
    } else {
      const k = playKind(p);
      const want = { cheap: 'cheap', normal: 'active', special: 'chat' }[opts.budget];
      if (k && k === want) { w += 1.5; reasons.push({ cheap: '저렴하게 오래 놀 수 있는 곳', active: '다 같이 신나게 내기하기 좋은 곳', chat: '오래 앉아 수다 떨기 좋은 곳' }[k]); }
    }

    if (opts.who === 'date' && (fancy || opts.purpose === 'cafe')) { w += 1; reasons.push('데이트 코스로 무난'); }
    if (opts.who === 'friends' && (hasTag(p, '고기') || opts.purpose === 'drink')) { w += 1; reasons.push('여럿이 가기 좋은 곳'); }
    if (opts.who === 'solo' && cheap) { w += 1; reasons.push('혼밥하기 편한 곳'); }

    if (food) for (const tag of excludedTags) {
      const who = opts.excludes.filter(e => e.tag === tag && e.by !== '오늘').map(e => e.by);
      reasons.push(who.length ? `${who.join('·')}${iga(who[who.length - 1])} 싫어하는 '${tag}' 제외 완료` : `오늘 뺀 '${tag}' 제외 완료`);
    }
    out.push({ place: p, weight: w, dist, reasons });
  }
  return out;
}

// 가중치 랜덤으로 n개 비복원 추출 (같은 이름 체인점은 한 번만). rand 주입 가능(테스트용)
function gacha(cands, n, rand = Math.random) {
  const pool = cands.slice(), picked = [];
  while (picked.length < n && pool.length) {
    const total = pool.reduce((s, c) => s + c.weight, 0);
    let r = rand() * total, i = 0;
    while (i < pool.length - 1 && (r -= pool[i].weight) >= 0) i++;
    const c = pool.splice(i, 1)[0];
    if (!picked.some(x => x.place.name === c.place.name)) picked.push(c);
  }
  return picked;
}

if (typeof module !== 'undefined') module.exports = { parseHours, openRange, attachHours, normName, typicalHours, likelyOpen, iga, TAGS, PURPOSES, TRAVEL, toPlace, distanceM, travelMinutes, midpoint, hasTag, playKind, scoreCandidates, gacha };
