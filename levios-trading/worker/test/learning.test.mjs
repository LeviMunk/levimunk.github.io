import test from "node:test";
import assert from "node:assert/strict";
import "../../learning-engine.js";
const e=globalThis.LeviLearning;
test("long and short lessons exist independently",()=>{
 assert.ok(e.courses.long.length>=4);
 assert.ok(e.courses.short.length>=4);
 assert.equal(e.get("short","long-1"),null);
});
test("answers are graded deterministically without moving the goalposts",()=>{
 const r=e.score("short-4",1);
 assert.equal(r.correct,true);
 assert.equal(e.score("short-4",0).correct,false);
 assert.throws(()=>e.score("short-4",99));
});
test("progress accepts only known lesson identifiers",()=>{
 assert.deepEqual(e.sanitizeProgress(["long-1","long-1","foreign","short-4"]),["long-1","short-4"]);
 assert.deepEqual(e.sanitizeProgress({long:true}),[]);
});
