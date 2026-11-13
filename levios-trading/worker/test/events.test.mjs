import test from "node:test";
import assert from "node:assert/strict";
import "../../events-engine.js";
const events=globalThis.LeviMarketEvents;
test("official-source snapshot has traceable events and unique IDs",()=>{
  assert.equal(events.verifiedOn,"2026-11-12");
  assert.ok(events.events.length>=8);
  assert.equal(new Set(events.events.map(e=>e.id)).size,events.events.length);
  for(const e of events.events){
    assert.match(e.date,/^\d{4}-\d{2}-\d{2}$/);
    assert.match(e.url,/^https:\/\/(?:www\.)?(?:bls\.gov|bea\.gov|federalreserve\.gov)\//);
    assert.ok(e.explain.length>30&&e.question.length>15);
  }
});
test("event filtering excludes past events and preserves chronology",()=>{
  const x=events.upcoming("2026-12-01","all",40);
  assert.ok(x.length>0);
  assert.ok(x.every(e=>e.date>="2026-12-01"&&e.date<="2027-01-10"));
  assert.deepEqual(x.map(e=>e.date),[...x].map(e=>e.date).sort());
  assert.ok(events.upcoming("2026-12-01","policy",40).every(e=>e.type==="policy"));
  assert.equal(events.upcoming("2030-01-01").length,0);
});
test("snapshot aging clearly indicates manual schedules can be stale",()=>{
  assert.equal(events.snapshotAge("2026-11-12").possiblyStale,false);
  assert.equal(events.snapshotAge("2027-01-20").expired,true);
  assert.throws(()=>events.upcoming("2026-11-12","bad"));
});
test("no future earnings dates or implied guaranteed price impact",()=>{
  assert.equal(events.events.some(e=>e.type==="earnings"),false);
  assert.ok(!events.events.some(e=>/guaranteed profit|buy now|sell now/i.test(e.explain)));
});
