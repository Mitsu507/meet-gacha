// node test.js  - 추천 로직 점검
const assert = require('assert');
const L = require('./logic.js');

const origin = { lat: 37.5665, lng: 126.978 };
const mk = (id, name, tags = {}) => ({ id: 'node/' + id, name, lat: 37.567, lng: 126.979, tags });
const places = [
  mk(1, '바다횟집', { amenity: 'restaurant' }),
  mk(2, '행복한 삼겹살', { amenity: 'restaurant' }),
  mk(3, '스시로', { amenity: 'restaurant', cuisine: 'sushi' }),
  mk(4, '김밥천국', { amenity: 'fast_food' }),
  mk(5, '', { amenity: 'restaurant' }),
  mk(6, '파스타집', { amenity: 'restaurant', cuisine: 'italian' }),
  mk(7, 'Boiling Crab & Shrimp', { amenity: 'restaurant' }),
];
const base = { origin, mode: 'transit', who: 'friends', purpose: 'meal', budget: 'normal', excludes: [], likes: [], indoorOnly: false, blacklist: new Set(), seen: new Set() };

// 조사
assert.strictEqual(L.iga('민수'), '가');
assert.strictEqual(L.iga('지민'), '이');

// 해산물 제외: 이름(횟집) + cuisine(sushi) 둘 다 걸러짐, 이름 없는 곳도 제외
let r = L.scoreCandidates(places, { ...base, excludes: [{ tag: '해산물', by: '민수' }] });
assert.deepStrictEqual(r.map(c => c.place.name).sort(), ['김밥천국', '파스타집', '행복한 삼겹살']);
assert.ok(r[0].reasons.includes("민수가 싫어하는 '해산물' 제외 완료"));

// 블랙리스트 + 이미 본 곳 제외
r = L.scoreCandidates(places, { ...base, blacklist: new Set(['node/2']), seen: new Set(['node/4']) });
assert.ok(!r.some(c => ['node/2', 'node/4'].includes(c.place.id)));

// 좋아하는 태그 가중치
r = L.scoreCandidates(places, { ...base, likes: [{ tag: '고기', by: '지민' }] });
const meat = r.find(c => c.place.name === '행복한 삼겹살');
assert.ok(meat.weight > 2 && meat.reasons.includes("지민이 좋아하는 '고기'"));

// 가챠: 중복 없이 n개, 후보보다 많이 요구하면 있는 만큼
const g = L.gacha(r, 3);
assert.strictEqual(new Set(g.map(c => c.place.id)).size, 3);
assert.strictEqual(L.gacha(r, 99).length, r.length);
// 가중치 쏠림: rand=0.999 → 마지막, rand=0 → 첫 번째
assert.strictEqual(L.gacha(r, 1, () => 0)[0], r[0]);
assert.strictEqual(L.gacha(r, 1, () => 0.9999)[0], r[r.length - 1]);

// 같은 이름은 한 번만
const dup = [1, 2, 3].map(i => ({ place: { id: 'n' + i, name: i < 3 ? '스타벅스' : '이디야' }, weight: 1 }));
assert.deepStrictEqual(L.gacha(dup, 3).map(c => c.place.name).sort(), ['스타벅스', '이디야']);

// 거리/시간/중간지점
assert.ok(Math.abs(L.distanceM(origin, { lat: 37.5755, lng: 126.978 }) - 1000) < 10);
assert.strictEqual(L.travelMinutes(800, 'walk'), 14);
assert.deepStrictEqual(L.midpoint([{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }]), { lat: 2, lng: 3 });

// 쿼리
assert.ok(L.buildQuery('cafe', 1, 2, 800).includes('nwr[amenity~"^(cafe|ice_cream)$"](around:800,1,2);'));

console.log('ok');
