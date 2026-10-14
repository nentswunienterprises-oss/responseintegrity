import assert from 'node:assert/strict';

export async function readBank(client, bank) {
  const { rows } = await client.query(`SELECT c.bank_version,c.active,c.review_mode,
    md5((to_jsonb(c)-array['created_at','retired_at','active','review_mode']::text[])::text) AS config_hash,
    (SELECT count(*)::int FROM private.specialist_capability_assessment_items i
      WHERE i.assessment_key=c.assessment_key AND i.bank_version=c.bank_version) AS item_count,
    (SELECT count(*)::int FROM private.specialist_capability_assessment_items i
      WHERE i.assessment_key=c.assessment_key AND i.bank_version=c.bank_version AND i.active) AS active_item_count,
    (SELECT md5(jsonb_agg(to_jsonb(i)-'created_at'-'bank_version' ORDER BY item_key)::text)
      FROM private.specialist_capability_assessment_items i
      WHERE i.assessment_key=c.assessment_key AND i.bank_version=c.bank_version) AS content_hash
    FROM private.specialist_capability_assessment_configs c
    WHERE c.assessment_key=$1 AND c.bank_version=$2`, [bank.assessmentKey, bank.version]);
  assert.equal(rows.length,1,`Missing pinned config: ${bank.assessmentKey} v${bank.version}`);
  return rows[0];
}

function assertReviewed(bank,state) {
  assert.equal(state.content_hash,bank.expectedHash,'Reviewed content hash drift');
  assert.equal(state.config_hash,bank.expectedConfigHash,'Reviewed configuration drift');
  assert.equal(Number(state.item_count),bank.itemCount,'Reviewed item count drift');
  assert.equal(Number(state.active_item_count),bank.itemCount,'Reviewed item availability drift');
  assert.equal(state.review_mode,false,'Review Mode must remain disabled');
}

export async function activateReviewedBanks(client,banks) {
  assert.ok(banks.length>0);
  assert.equal(new Set(banks.map(b=>b.assessmentKey)).size,banks.length,'Duplicate bank authority');
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
  try {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('ri-exception-bank-activation'))");
    await client.query('LOCK TABLE private.specialist_capability_assessment_configs IN SHARE ROW EXCLUSIVE MODE');
    await client.query('LOCK TABLE private.specialist_capability_assessment_items IN SHARE MODE');
    // Validate every predecessor and staged successor before changing any active config.
    for(const bank of banks) {
      const active=await client.query(`SELECT bank_version FROM private.specialist_capability_assessment_configs
        WHERE assessment_key=$1 AND active=true`,[bank.assessmentKey]);
      assert.equal(active.rows.length,1,'Exactly one active bank is required');
      const version=Number(active.rows[0].bank_version);
      assert.ok(version===bank.previousVersion || version===bank.version,'Active bank version drift');
      const reviewed=await readBank(client,bank);
      assertReviewed(bank,reviewed);
      assert.equal(reviewed.active,version===bank.version,'Staged activation state drift');
      const predecessor=await readBank(client,{...bank,version:bank.previousVersion});
      assert.equal(predecessor.content_hash,bank.predecessorHash,'Predecessor content drift');
    }
    for(const bank of banks) {
      await client.query(`UPDATE private.specialist_capability_assessment_configs
        SET active=false,retired_at=coalesce(retired_at,now())
        WHERE assessment_key=$1 AND bank_version=$2 AND active=true`,[bank.assessmentKey,bank.previousVersion]);
      await client.query(`UPDATE private.specialist_capability_assessment_configs
        SET active=true,review_mode=false,retired_at=null
        WHERE assessment_key=$1 AND bank_version=$2`,[bank.assessmentKey,bank.version]);
    }
    for(const bank of banks) {
      const reviewed=await readBank(client,bank); assertReviewed(bank,reviewed); assert.equal(reviewed.active,true);
      const active=await client.query(`SELECT bank_version FROM private.specialist_capability_assessment_configs
        WHERE assessment_key=$1 AND active=true`,[bank.assessmentKey]);
      assert.deepEqual(active.rows.map(x=>Number(x.bank_version)),[bank.version]);
    }
    await client.query('COMMIT');
  } catch(error) { await client.query('ROLLBACK'); throw error; }
  const after=[];
  for(const bank of banks) after.push({assessmentKey:bank.assessmentKey,...await readBank(client,bank)});
  return after;
}
