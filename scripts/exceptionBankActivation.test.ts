import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {Client} from 'pg';
import {activateReviewedBanks,readBank} from './exceptionBankActivation.mjs';

test('Reviewed bank activation is atomic, idempotent and preserves historical qualification evidence',async()=>{
 const url=process.env.EXCEPTION_CI_DATABASE_URL;
 if(url)assert.match(new URL(url).hostname,/^(localhost|127\.0\.0\.1|postgres)$/);
 const db=url?new Client({connectionString:url}):new PGlite();
 if(db instanceof Client)await db.connect();
 const execute=async(s:string)=>db instanceof Client?db.query(s):db.exec(s);
 try {
  await execute(`CREATE SCHEMA private;
    CREATE TABLE private.specialist_capability_assessment_configs(
      assessment_key text,bank_version int,active boolean,review_mode boolean,
      created_at timestamptz default now(),retired_at timestamptz,PRIMARY KEY(assessment_key,bank_version));
    CREATE TABLE private.specialist_capability_assessment_items(
      assessment_key text,bank_version int,item_key text,active boolean,prompt text,created_at timestamptz default now());
    CREATE TABLE public.historical_qualification(id text,bank_version int,passed boolean,evidence jsonb);
    INSERT INTO public.historical_qualification VALUES('earned',1,true,'{"immutable":true}');
    INSERT INTO private.specialist_capability_assessment_configs VALUES
      ('synthetic-a',1,true,false,now(),null),('synthetic-a',2,false,false,now(),null),
      ('synthetic-b',1,true,false,now(),null),('synthetic-b',2,false,false,now(),null);
    INSERT INTO private.specialist_capability_assessment_items(assessment_key,bank_version,item_key,active,prompt) VALUES
      ('synthetic-a',1,'item',true,'historical'),('synthetic-a',2,'item',true,'reviewed'),
      ('synthetic-b',1,'item',true,'historical'),('synthetic-b',2,'item',true,'reviewed');`);
  const banks=[];
  for(const key of ['synthetic-a','synthetic-b']){
    const b={assessmentKey:key,previousVersion:1,version:2,itemCount:1};
    const next=await readBank(db,b),old=await readBank(db,{...b,version:1});
    banks.push({...b,expectedHash:next.content_hash,expectedConfigHash:next.config_hash,predecessorHash:old.content_hash});
  }
  const history=(await db.query('SELECT * FROM public.historical_qualification')).rows;
  // A mismatch in the second bank must leave the first bank inactive too.
  await assert.rejects(activateReviewedBanks(db,[banks[0],{...banks[1],expectedHash:'unreviewed'}]),/content hash drift/);
  assert.equal((await readBank(db,banks[0])).active,false);
  await assert.rejects(activateReviewedBanks(db,[{...banks[0],previousVersion:99},banks[1]]),/version drift/);
  const after=await activateReviewedBanks(db,banks);
  assert.ok(after.every(x=>x.active===true && x.review_mode===false));
  assert.deepEqual((await db.query('SELECT * FROM public.historical_qualification')).rows,history);
  assert.deepEqual(await activateReviewedBanks(db,banks),after);
  assert.deepEqual((await db.query('SELECT * FROM public.historical_qualification')).rows,history);
 }finally {if(db instanceof Client)await db.end();else await db.close();}
});
