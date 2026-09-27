// 약속 장소 가챠 - 추천 로직 (브라우저 + node 테스트 겸용)

// 음식/장소 태그: OSM cuisine 값 + 가게 이름 키워드로 판정
const TAGS = {
  '해산물': { cuisine: ['seafood', 'sushi', 'fish', 'raw_fish', 'crab'], name: ['횟집', '회센터', '해물', '수산', '초밥', '스시', '조개', '대게', '낙지', '쭈꾸미', '주꾸미', '아구', '장어', '굴', '생선', 'crab', 'shrimp', 'lobster', 'oyster', 'seafood', 'sushi', 'fish'] },
  '고기':   { cuisine: ['barbecue', 'korean_bbq', 'meat', 'steak_house', 'grill'], name: ['고기', '갈비', '삼겹', '정육', '한우', '곱창', '막창', '숯불', '양꼬치', 'bbq', 'steak', 'grill'] },
  '매운음식': { cuisine: ['spicy', 'sichuan', 'mala'], name: ['마라', '떡볶이', '불닭', '짬뽕', '매운', '엽떡', '닭발', '낙곱새'] },
  '한식':   { cuisine: ['korean'], name: ['국밥', '찌개', '백반', '한식', '칼국수', '냉면', '비빔밥', '설렁탕'] },
  '중식':   { cuisine: ['chinese'], name: ['반점', '중화', '짜장', '짬뽕', '마라', '딤섬'] },
  '일식':   { cuisine: ['japanese', 'sushi', 'ramen', 'udon'], name: ['돈까스', '돈카츠', '라멘', '우동', '스시', '초밥', '이자카야'] },
  '양식':   { cuisine: ['italian', 'pizza', 'western', 'french', 'american', 'steak_house', 'pasta'], name: ['파스타', '피자', '스테이크', '비스트로', '브런치', 'pasta', 'pizza', 'bistro', 'trattoria'] },
  '패스트푸드': { cuisine: ['burger', 'chicken', 'fried_chicken', 'sandwich'], name: ['버거', '치킨', '맥도날드', '롯데리아', '서브웨이', 'burger', 'chicken', 'subway', 'kfc'] },
  '분식':   { cuisine: ['bunsik'], name: ['분식', '김밥', '떡볶이', '라면'] },
};

// 목적별 Overpass 필터 (around 반경은 호출할 때 붙임)
const PURPOSES = {
  meal:  { label: '든든한 밥 식사', filters: ['nwr[amenity~"^(restaurant|fast_food|food_court)$"]'] },
  cafe:  { label: '가벼운 카페 / 디저트', filters: ['nwr[amenity~"^(cafe|ice_cream)$"]', 'nwr[shop~"^(bakery|pastry|confectionery)$"]'] },
  drink: { label: '무드 있는 술자리', filters: ['nwr[amenity~"^(bar|pub|biergarten)$"]', 'nwr[amenity=restaurant][name~"포차|이자카야|호프|주점|술집|와인|이자까야"]'] },
  play:  { label: '활동적인 놀거리', filters: [
    'nwr[leisure~"^(escape_game|bowling_alley|amusement_arcade|trampoline_park|miniature_golf|sports_centre)$"]',
    'nwr[amenity~"^(karaoke_box|internet_cafe)$"]',
    // 키 존재 필터를 앞에 둬야 이름 정규식이 빨라짐 (전체 nwr[name~] 대비 약 9배)
    ...['shop', 'amenity', 'leisure'].map(k => `nwr[${k}][name~"보드게임|방탈출|만화카페|볼링|스크린|노래방|코인노래|당구|오락실|VR|클라이밍|룸카페"]`)] },
};

// 놀거리 세부 분류 (예산 스타일과 매칭)
const PLAY_KIND = [
  { kind: 'cheap', words: ['만화카페', '보드게임', 'PC방', '코인노래', '오락실', '당구'], tags: { amenity: ['internet_cafe'], leisure: ['amusement_arcade'] } },
  { kind: 'active', words: ['방탈출', '볼링', '스크린', 'VR', '클라이밍', '트램폴린'], tags: { leisure: ['escape_game', 'bowling_alley', 'trampoline_park', 'sports_centre'] } },
  { kind: 'chat', words: ['룸카페', '노래방', '파티룸'], tags: { amenity: ['karaoke_box'] } },
];

const TRAVEL = {
  walk:    { label: '걸어서 10분', radius: 800, kmh: 4.5, wait: 0, word: '도보' },
  transit: { label: '대중교통 20분', radius: 4000, kmh: 15, wait: 5, word: '대중교통' },
  car:     { label: '차 타고 멀리', radius: 10000, kmh: 25, wait: 3, word: '차로' },
};

function buildQuery(purpose, lat, lng, radius) {
  const around = `(around:${radius},${lat},${lng})`;
  const parts = PURPOSES[purpose].filters.map(f => f + around + ';').join('');
  // ponytail: 600개 상한(id순이라 반경 전체에 고루 퍼짐). 밀집 지역 전체 후보가 필요하면 서버 프록시+캐시로
  return `[out:json][timeout:25];(${parts});out center tags 600;`;
}

// 받침 있으면 '이', 없으면 '가'
function iga(word) {
  const c = word.charCodeAt(word.length - 1);
  return c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 ? '이' : '가';
}

function toPlace(el) {
  const t = el.tags || {};
  return {
    id: el.type + '/' + el.id,
    name: t.name || t['name:ko'] || '',
    lat: el.lat ?? el.center?.lat,
    lng: el.lon ?? el.center?.lon,
    tags: t,
  };
}

function distanceM(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ponytail: 직선거리×1.3 / 평균속도 추정. 실제 경로 시간은 카카오 길찾기 API 붙일 때 교체
function travelMinutes(meters, mode) {
  const m = TRAVEL[mode];
  return Math.max(1, Math.round((meters * 1.3 / 1000) / m.kmh * 60 + m.wait));
}

// ponytail: 단순 위경도 평균. 대중교통 기준 공정한 중간지점은 경로 API 필요
function midpoint(points) {
  return { lat: points.reduce((s, p) => s + p.lat, 0) / points.length, lng: points.reduce((s, p) => s + p.lng, 0) / points.length };
}

function hasTag(place, tag) {
  const def = TAGS[tag];
  if (!def) return false;
  const cuisines = (place.tags.cuisine || '').toLowerCase().split(/[;,]\s*/);
  if (def.cuisine.some(c => cuisines.includes(c))) return true;
  const name = place.name.toLowerCase();
  return def.name.some(w => name.includes(w));
}

function playKind(place) {
  for (const k of PLAY_KIND) {
    if (k.words.some(w => place.name.includes(w))) return k.kind;
    for (const key in k.tags) if (k.tags[key].includes(place.tags[key])) return k.kind;
  }
  return null;
}

const OUTDOOR = ['miniature_golf', 'biergarten'];

/**
 * 조건으로 후보 필터링 + 점수 매기기
 * opts: { origin, mode, who, purpose, budget, excludes:[{tag, by}], likes:[{tag, by}], indoorOnly, blacklist:Set, seen:Set }
 * 반환: [{ place, weight, reasons[] }]
 */
function scoreCandidates(places, opts) {
  const out = [];
  const excludedTags = [...new Set(opts.excludes.map(e => e.tag))];
  for (const p of places) {
    if (!p.name || p.lat == null) continue;
    if (opts.blacklist.has(p.id) || opts.seen.has(p.id)) continue;
    if (excludedTags.some(tag => hasTag(p, tag))) continue;
    if (opts.indoorOnly && (OUTDOOR.includes(p.tags.leisure) || OUTDOOR.includes(p.tags.amenity) || p.tags.outdoor_seating === 'only')) continue;

    const dist = distanceM(opts.origin, p);
    let w = 1.3 - 0.6 * Math.min(1, dist / TRAVEL[opts.mode].radius); // 가까울수록 약간 우대
    const reasons = [];
    reasons.push(`${opts.originLabel || '출발지'}에서 ${TRAVEL[opts.mode].word} 약 ${travelMinutes(dist, opts.mode)}분`);

    for (const l of opts.likes) {
      if (hasTag(p, l.tag)) { w += 2; reasons.push(`${l.by}${iga(l.by)} 좋아하는 '${l.tag}'`); break; }
    }

    const fast = ['fast_food', 'food_court'].includes(p.tags.amenity) || hasTag(p, '분식');
    const fancy = hasTag(p, '양식') || hasTag(p, '일식');
    if (opts.budget === 'cheap' && fast) { w += 1.5; reasons.push('엔빵 부담 적은 가성비 메뉴'); }
    if (opts.budget === 'special' && fancy) { w += 1.5; reasons.push('특별한 날 분위기 내기 좋은 곳'); }
    if (opts.budget === 'special' && fast) w *= 0.3;

    if (opts.purpose === 'play') {
      const k = playKind(p);
      const want = { cheap: 'cheap', normal: 'active', special: 'chat' }[opts.budget];
      if (k && k === want) { w += 1.5; reasons.push({ cheap: '저렴하게 오래 놀 수 있는 곳', active: '다 같이 신나게 내기하기 좋은 곳', chat: '오래 앉아 수다 떨기 좋은 곳' }[k]); }
    }

    if (opts.who === 'date' && (fancy || p.tags.amenity === 'cafe')) { w += 1; reasons.push('데이트 코스로 무난'); }
    if (opts.who === 'friends' && (hasTag(p, '고기') || p.tags.amenity === 'pub' || p.tags.amenity === 'bar')) { w += 1; reasons.push('여럿이 가기 좋은 곳'); }
    if (opts.who === 'solo' && fast) { w += 1; reasons.push('혼밥하기 편한 곳'); }

    if (opts.mode === 'car' && (p.tags.parking || p.tags['parking:fee'] || p.tags.drive_through === 'yes')) { w += 1; reasons.push('주차 정보 있음'); }
    if (p.tags.opening_hours) w += 0.3; // 정보가 많은 곳 약간 우대

    if (opts.purpose === 'meal' || opts.purpose === 'drink') for (const tag of excludedTags) {
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

if (typeof module !== 'undefined') module.exports = { iga, TAGS, PURPOSES, TRAVEL, buildQuery, toPlace, distanceM, travelMinutes, midpoint, hasTag, playKind, scoreCandidates, gacha };
