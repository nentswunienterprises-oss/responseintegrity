import test from "node:test";
import assert from "node:assert/strict";
import {tutorScheduleWeekRange} from "./tutorScheduleWeek";
test("Monday early-morning SAST booking is in exactly the displayed local week",()=>{
 const week=tutorScheduleWeekRange({weekStart:"2026-10-19",weekStartUtc:"2026-10-18T22:00:00Z",weekEndUtc:"2026-10-25T22:00:00Z"});
 const booking=new Date("2026-10-18T23:30:00Z");
 assert.ok(booking>=week.weekStart && booking<=week.weekEnd);
 assert.equal(week.weekEnd.toISOString(),"2026-10-25T21:59:59.999Z");
 assert.ok(new Date("2026-10-18T21:59:59.999Z")<week.weekStart);
 assert.ok(new Date("2026-10-25T22:00:00Z")>week.weekEnd);
});
test("DST calendar week can contain 167 or 169 elapsed hours",()=>{
 for(const [start,end] of [["2026-03-02T05:00:00Z","2026-03-09T04:00:00Z"],["2026-10-26T04:00:00Z","2026-11-02T05:00:00Z"]]){
  const week=tutorScheduleWeekRange({weekStart:start.slice(0,10),weekStartUtc:start,weekEndUtc:end});
  assert.equal(week.weekEnd.getTime()+1,Date.parse(end));
 }
});
test("partial, shifted and oversized ranges are rejected",()=>{
 const valid={weekStart:"2026-10-19",weekStartUtc:"2026-10-18T22:00:00Z",weekEndUtc:"2026-10-25T22:00:00Z"};
 for(const input of [{...valid,weekEndUtc:undefined},{...valid,weekStartUtc:"bad"},{...valid,weekStart:"2026-10-20"},{...valid,weekEndUtc:"2026-11-25T22:00:00Z"},{...valid,weekStartUtc:"2026-10-17T22:00:00Z"}])assert.throws(()=>tutorScheduleWeekRange(input));
});
test("legacy callers retain a UTC Monday-to-Sunday window",()=>{
 const week=tutorScheduleWeekRange({weekStart:"2026-10-19"});
 assert.equal(week.weekStart.toISOString(),"2026-10-19T00:00:00.000Z");
 assert.equal(week.weekEnd.toISOString(),"2026-10-25T23:59:59.999Z");
});
