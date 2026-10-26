import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {handleProgress} from './lib/progress.mjs';
const sqlite=new DatabaseSync(':memory:');
for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')))sqlite.exec(readFileSync('drizzle/'+f,'utf8'));
const db = { prepare(sql) { return { bind(...args) { return {
 async all() { return {results:sqlite.prepare(sql).all(...args)}; },
 async run() { return {meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}}; }
}; } }; } };
const value={profile:{weight:87,height:175,start:'2026-10-22',walk:90},logs:{},weights:{}};
const req=(user,method='GET',body,origin='https://plate.test')=>new Request('https://plate.test/api/progress',{method,headers:{...(user?{'oai-authenticated-user-id':user}:{}),'content-type':'application/json',origin},...(body?{body:JSON.stringify({userId:user,...body})}:{})});
assert.equal((await handleProgress(req(null),db)).status,401);
assert.equal((await handleProgress(req('a','PUT',{kind:'fitness',revision:0,value},'https://evil.test'),db)).status,403);
assert.equal((await handleProgress(req('a','PUT',{kind:'fitness',revision:0,value:{}}),db)).status,400);
const first=await handleProgress(req('a','PUT',{kind:'fitness',revision:0,value}),db);assert.equal(first.status,200);assert.equal((await first.json()).revision,1);
assert.deepEqual((await (await handleProgress(req('b'),db)).json()).records,{});
assert.equal((await handleProgress(req('a','PUT',{kind:'fitness',revision:0,value}),db)).status,409);
value.weights['2026-10-22']=86.5;
assert.equal((await handleProgress(req('a','PUT',{kind:'fitness',revision:1,value}),db)).status,200);
assert.equal((await handleProgress(req('a','PUT',{kind:'fitness',revision:1,value}),db)).status,409);
const saved=await (await handleProgress(req('a'),db)).json();assert.equal(saved.records.fitness.revision,2);assert.equal(saved.records.fitness.value.weights['2026-10-22'],86.5);
const nutrition={goals:[2100,185,185,70],days:{'2026-10-22':[{id:'test-1',food:['Egg',155,12.6,1.1,10.6],grams:100,meal:'Breakfast'}]}};
assert.equal((await handleProgress(req('a','PUT',{kind:'nutrition',revision:0,value:nutrition}),db)).status,200);
assert.equal((await handleProgress(req('b','PUT',{kind:'fitness',revision:9,value}),db)).status,409);
assert.equal((await handleProgress(req('b','PUT',{kind:'fitness',revision:0,value}),db)).status,200);
assert.equal((await handleProgress(req('a'),null)).status,503);
assert.equal((await handleProgress(req('b','PUT',{userId:'a',kind:'nutrition',revision:0,value:nutrition}),db)).status,403);
assert.equal((await handleProgress(req('a','PUT',{kind:'nutrition',revision:1,value:{...nutrition,goals:[-1,1,1,1]}}),db)).status,400);
const before=await (await handleProgress(req('a'),db)).json();
assert.equal(before.records.nutrition.revision,1);
assert.deepEqual(before.records.nutrition.value,nutrition);
const large=req('a','PUT',{kind:'fitness',revision:2,value:'x'.repeat(2_000_001)});
assert.equal((await handleProgress(large,db)).status,413);
const privateResponse=await handleProgress(req('a'),db);
assert.equal(privateResponse.headers.get('cache-control'),'private, no-store');
console.log('Passed: authentication, ownership isolation, origin checks, validation, insert/update, stale-write protection, separate nutrition records, unavailable database.');
