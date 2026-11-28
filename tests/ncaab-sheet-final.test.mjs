import assert from "node:assert/strict";
import test from "node:test";
import {verifyGrade} from "../research/ncaab-sheet-tracker/verify.mjs";
const time=h=>`2026-01-01T${String(h).padStart(2,"0")}:00:00Z`;
const rule={verified:true,ruleId:"test",book:"test",jurisdiction:"lab",market:"total",period:"H2_REG",label:"test",
  push:"refund",voidTerms:"fixture",source:"fixture",validFrom:time(0),validUntil:time(23)};
const contract={...rule,homeId:"1",awayId:"2",eventId:"espn:3",line:80,side:"over",quotedAt:time(9),cutAt:time(10),recordedAt:time(10),start:time(13)};
const event={id:"3",status:{type:{state:"post",completed:true}},competitions:[{id:"3",date:time(13),
  competitors:[[30,40,8],[30,40,5]].map((scores,i)=>({id:String(i+1),team:{id:String(i+1)},homeAway:i?"away":"home",
    score:scores.reduce((a,b)=>a+b,0),linescores:scores.map((value,j)=>({value,period:j+1}))}))}]};
const box={event,sourceId:"receipt",capturedAt:time(16)};
test("regulation halves exclude OT and the exact full-game rule includes OT",()=>{
  for(const [period,line,expected] of [["H1",61,"loss"],["H2_REG",80,"push"],["REG",139,"win"],["FT_OT",152,"win"]]){
    assert.equal(verifyGrade({...contract,period,line},{...rule,period},[box],time(17)).result,expected);
  }
});
test("incomplete, duplicate, conflicting and late finals cannot grade",()=>{
  for(const bad of [null,-1,0.5,"oops"]){
    const b=structuredClone(box);b.event.competitions[0].competitors[0].linescores[0].value=bad;
    assert.equal(verifyGrade(contract,rule,[b],time(17)),null);
  }
  assert.equal(verifyGrade(contract,rule,[box,box],time(17)),null);
  assert.equal(verifyGrade(contract,rule,[box],time(14)),null);
  assert.equal(verifyGrade(contract,{...rule,jurisdiction:"other"},[box],time(17)),null);
  const b=structuredClone(box);b.sourceId="b";b.event.competitions[0].competitors[0].id="9";
  assert.equal(verifyGrade(contract,rule,[box,b],time(17)),null);
});
