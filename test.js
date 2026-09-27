// node test.js  - 추천 로직 점검
const assert = require('assert');
const L = require('./logic.js');

const origin = { lat: 37.5665, lng: 126.978 };
const mk = (id, name, category = '음식점') => ({ id: String(id), name, lat: 37.567, lng: 126.979, category });
const places = [
  mk(1, '바다횟집', '음식점 > 한식 > 해물,생선 > 회'),
  mk(2, '행복한 삼겹살', '음식점 > 한식 > 육류,고기 > 삼겹살'),
  mk(3, '스시로', '음식점 > 일식 > 초밥,롤'),
  mk(4, '김밥천국', '음식점 > 분식'),
  mk(5, '', '음식점'),
  mk(6, '파스타집', '음식점 > 양식 > 이탈리안'),
  mk(7, 'Boiling Crab & Shrimp', '음식점 > 양식'),
  mk(8, '고기회관', '음식점 > 한식 > 육류,고기'), // '회'관이지만 해산물 아님
  { ...mk(9, '먼 식당', '음식점 > 한식'), lat: 37.7 }, // 반경 밖
];
const base = { origin, mode: 'transit', who: 'friends', purpose: 'meal', budget: 'normal', excludes: [], likes: [], indoorOnly: false, blacklist: new Set(), seen: new Set() };

// 조사
assert.strictEqual(L.iga('민수'), '가');
assert.strictEqual(L.iga('지민'), '이');

// 카카오 결과 변환
assert.deepStrictEqual(L.toPlace({ id: '1', place_name: 'A', x: '126.9', y: '37.5', category_name: 'c', place_url: 'u', road_address_name: '', address_name: '주소' }),
  { id: '1', name: 'A', lat: 37.5, lng: 126.9, category: 'c', url: 'u', address: '주소' });

// 해산물 제외: 카테고리(회, 초밥) + 영어 이름, '회관'은 안 걸림, 이름 없는 곳·반경 밖 제외
let r = L.scoreCandidates(places, { ...base, excludes: [{ tag: '해산물', by: '민수' }] });
assert.deepStrictEqual(r.map(c => c.place.name).sort(), ['고기회관', '김밥천국', '파스타집', '행복한 삼겹살']);
assert.ok(r[0].reasons.includes("민수가 싫어하는 '해산물' 제외 완료"));

// 블랙리스트 + 이미 본 곳 제외
r = L.scoreCandidates(places, { ...base, blacklist: new Set(['2']), seen: new Set(['4']) });
assert.ok(!r.some(c => ['2', '4'].includes(c.place.id)));

// 좋아하는 태그 가중치
r = L.scoreCandidates(places, { ...base, likes: [{ tag: '고기', by: '지민' }] });
const meat = r.find(c => c.place.name === '행복한 삼겹살');
assert.ok(meat.weight > 2 && meat.reasons.includes("지민이 좋아하는 '고기'"));

// 놀거리: 음식 제외 조건 무시, 예산 스타일 매칭
const play = [mk(10, '레드버튼 보드게임카페', '가정,생활 > 여가시설 > 보드카페'), mk(11, '제로월드 방탈출', '가정,생활 > 여가시설 > 방탈출카페')];
r = L.scoreCandidates(play, { ...base, purpose: 'play', budget: 'normal', excludes: [{ tag: '해산물', by: '민수' }] });
assert.strictEqual(r.length, 2);
assert.ok(r.find(c => c.place.id === '11').reasons.includes('다 같이 신나게 내기하기 좋은 곳'));
assert.strictEqual(L.playKind(play[0]), 'cheap');
// 놀거리에 딸려온 식당·키즈카페는 빼고, 테마카페(보드·만화카페)는 살림
const noise = [mk(12, '국밥집', '음식점 > 한식 > 국밥'), mk(13, '뽀로로 키즈카페', '가정,생활 > 여가시설 > 키즈카페'), mk(14, '벌툰', '음식점 > 카페 > 테마카페 > 만화카페')];
assert.deepStrictEqual(L.scoreCandidates(noise, { ...base, purpose: 'play' }).map(c => c.place.name), ['벌툰']);

// 밥 먹으러 갈 땐 술집 제외
assert.strictEqual(L.scoreCandidates([mk(15, '가을주막', '음식점 > 술집 > 호프,요리주점')], base).length, 0);

// 영업시간 추정: 밤 11시엔 카페·밥집 빠지고 술집·PC방은 남음, 술집은 새벽 1시에도 OK, 문 닫기 1시간 전이면 제외
const at = (h, m = 0) => new Date(2026, 8, 27, h, m);
const night = [mk(20, '스타벅스', '음식점 > 카페 > 커피전문점 > 스타벅스'), mk(21, '가마솥순대국', '음식점 > 한식 > 국밥'), mk(22, '역전할머니맥주', '음식점 > 술집 > 호프,요리주점'), mk(23, '배틀존 PC', '가정,생활 > 여가시설 > 게임방,PC방')];
assert.deepStrictEqual(night.filter(p => L.likelyOpen(p, at(23))).map(p => p.name), ['역전할머니맥주', '배틀존 PC']);
assert.deepStrictEqual(night.filter(p => L.likelyOpen(p, at(1))).map(p => p.name), ['역전할머니맥주', '배틀존 PC']);
assert.ok(L.likelyOpen(night[0], at(20, 59)) && !L.likelyOpen(night[0], at(21, 1))); // 카페 22시 마감
assert.ok(!L.likelyOpen(night[2], at(12))); // 술집 낮엔 X
assert.strictEqual(L.scoreCandidates(night, { ...base, purpose: 'cafe', now: at(23) }).length, 2);

// 가챠: 중복 없이 n개, 후보보다 많이 요구하면 있는 만큼
r = L.scoreCandidates(places, base);
const g = L.gacha(r, 3);
assert.strictEqual(new Set(g.map(c => c.place.id)).size, 3);
assert.strictEqual(L.gacha(r, 99).length, r.length);
assert.strictEqual(L.gacha(r, 1, () => 0)[0], r[0]);
assert.strictEqual(L.gacha(r, 1, () => 0.9999)[0], r[r.length - 1]);

// 같은 이름은 한 번만
const dup = [1, 2, 3].map(i => ({ place: { id: 'n' + i, name: i < 3 ? '스타벅스' : '이디야' }, weight: 1 }));
assert.deepStrictEqual(L.gacha(dup, 3).map(c => c.place.name).sort(), ['스타벅스', '이디야']);

// 거리/시간/중간지점
assert.ok(Math.abs(L.distanceM(origin, { lat: 37.5755, lng: 126.978 }) - 1000) < 10);
assert.strictEqual(L.travelMinutes(800, 'walk'), 14);
assert.deepStrictEqual(L.midpoint([{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }]), { lat: 2, lng: 3 });

console.log('ok');
