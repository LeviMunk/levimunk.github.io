import test from "node:test";
import assert from "node:assert/strict";
import {parseBLS,parseBEA,fetchOfficialEvents} from "../src/event-feeds.mjs";
const today="2026-11-12";
const ics=`BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:Employment Situation for November 2026
DTSTART:20261204T083000
END:VEVENT
BEGIN:VEVENT
SUMMARY:Consumer Price Index for November 2026
DTSTART:20261210T133000Z
END:VEVENT
BEGIN:VEVENT
SUMMARY:Producer Price Index for October 2026
DTSTART:20261113T083000
END:VEVENT
END:VCALENDAR`;
const json={
 "Gross Domestic Product":{release_dates:["2026-11-25T13:30:00+00:00","2026-12-23T13:30:00+00:00"]},
 "Personal Income and Outlays":{release_dates:["2026-11-25T13:30:00+00:00","2026-11-25T13:30:00+00:00","2027-02-25T13:30:00+00:00"]}
};
test("BLS ICS parses local and Zulu timestamps without interpreting UTC as ET",()=>{
 const rows=parseBLS(ics,today);
 assert.equal(rows.length,3);
 assert.equal(rows.find(x=>x.name.includes("Consumer Price Index")).time,"08:30");
 assert.ok(rows.every(x=>x.agency==="BLS"&&x.source==="live"));
});
test("BEA machine-readable JSON converts UTC to ET and deduplicates dates",()=>{
 const rows=parseBEA(json,today);
 assert.equal(rows.length,3);
 assert.ok(rows.every(x=>x.time==="08:30"));
 assert.ok(rows.every(x=>x.agency==="BEA"));
});
test("feed reader hardcodes exactly two sources and never exposes upstream errors",async()=>{
 const called=[];
 const data=await fetchOfficialEvents({
 now:new Date("2026-11-12T15:00:00Z"),
 fetchImpl:async (url,opts)=>{
   called.push({url,method:opts.method,redirect:opts.redirect});
   return new Response(url.includes("bls.gov")?ics:JSON.stringify(json),{status:200});
 }
 });
 assert.deepEqual(data.sources.map(x=>x.status),["fresh","fresh"]);
 assert.equal(data.sources.reduce((n,s)=>n+s.events.length,0),6);
 assert.ok(called.every(x=>x.method==="GET"&&x.redirect==="error"));
 assert.deepEqual(called.map(x=>x.url),[
  "https://www.bls.gov/schedule/news_release/bls.ics",
  "https://apps.bea.gov/API/signup/release_dates.json"
 ]);
});
test("fail closed per agency and never treat unverified upstream HTML as schedule",async()=>{
 const data=await fetchOfficialEvents({now:new Date("2026-11-12T15:00:00Z"),
   fetchImpl:async url=>url.includes("bls")?
     new Response("<html>blocked</html>") :new Response(JSON.stringify(json))});
 assert.equal(data.sources[0].status,"unavailable");
 assert.equal(data.sources[0].events.length,0);
 assert.equal(data.sources[1].status,"fresh");
});
test("unexpected or oversized datasets are rejected",()=>{
 assert.throws(()=>parseBLS("test",today));
 assert.throws(()=>parseBEA({},today));
 assert.throws(()=>parseBLS("BEGIN:VCALENDAR"+"x".repeat(650001),today));
});
