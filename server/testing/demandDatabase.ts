import { readFile } from 'node:fs/promises';
import express from 'express';
import { createServer } from 'node:http';

export async function createDemandDatabase() {
  const { PGlite } = await import(process.env.RI_TEST_PGLITE_MODULE || '@electric-sql/pglite');
  const db = new PGlite();
  await db.exec(await readFile(new URL('./demand-fixture.sql', import.meta.url), 'utf8'));
  const migration = await readFile(new URL('../../migrations/20260916191307_demand_production_gateway.sql', import.meta.url), 'utf8');
  await db.exec(migration);
  return { db, migration };
}

// Minimal PostgREST transport for real Supabase clients against isolated PostgreSQL.
// SQL is parameterized. Unsupported operators/projections fail rather than producing invented data.
export async function serveDemandDatabase(db: any) {
  const app = express();
  app.use(express.json());
  const identifier = (value: string) => {
    if (!/^[a-z_][a-z_0-9]*$/i.test(value)) throw new Error(`Unsupported test identifier: ${value}`);
    return `"${value}"`;
  };
  app.post('/auth/v1/signup', (req, res) => res.json({ id: req.body.email.split('@')[0], email: req.body.email, aud: 'authenticated', created_at: new Date().toISOString() }));
  app.post('/rest/v1/rpc/update_demand_production', async (req, res) => {
    try {
      const p = req.body;
      const result = await db.query('SELECT update_demand_production($1,$2,$3,$4,$5,$6,$7) AS result',
        [p.p_enrollment_id,p.p_actor_id,p.p_action,p.p_status,p.p_owner_id,p.p_entry_type,p.p_note]);
      res.json(result.rows[0].result);
    } catch (error: any) { res.status(400).json({ message: error.message, code: error.code }); }
  });
  app.all('/rest/v1/:table', async (req, res) => {
    try {
      const values: any[] = [];
      const bind = (value: any) => { values.push(value); return `$${values.length}`; };
      const table = identifier(req.params.table);
      const conditions: string[] = [];
      for (const [key, raw] of Object.entries(req.query)) {
        if (['select','order','limit','offset','on_conflict','columns'].includes(key)) continue;
        for (const item of Array.isArray(raw) ? raw : [raw]) {
          const value = String(item);
          const column = identifier(key);
          if (value.startsWith('eq.')) conditions.push(`${column} = ${bind(value.slice(3))}`);
          else if (value.startsWith('neq.')) conditions.push(`${column} <> ${bind(value.slice(4))}`);
          else if (value === 'is.null') conditions.push(`${column} IS NULL`);
          else if (value === 'not.is.null') conditions.push(`${column} IS NOT NULL`);
          else if (value.startsWith('in.(')) conditions.push(`${column}::text = ANY(${bind(value.slice(4,-1).split(',').map(v => v.replace(/^"|"$/g,'')))})`);
          else throw new Error(`Unsupported test filter ${key}=${value}`);
        }
      }
      const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
      let sql: string;
      if (req.method === 'GET' || req.method === 'HEAD') {
        const fields = req.query.select ? String(req.query.select) : '*';
        const select = fields === '*' ? '*' : fields.split(',').map(v => identifier(v.trim())).join(',');
        sql = `SELECT ${select} FROM ${table}${where}`;
        if (req.query.order) sql += ' ORDER BY ' + String(req.query.order).split(',').map(term => {
          const [key, direction] = term.split('.'); return identifier(key) + (direction === 'desc' ? ' DESC' : ' ASC');
        }).join(',');
        if (req.query.limit) sql += ` LIMIT ${bind(Number(req.query.limit))}`;
      } else if (req.method === 'POST') {
        const data = Array.isArray(req.body) ? req.body : [req.body];
        const keys = Object.keys(data[0]);
        const tuples = data.map(row => '(' + keys.map(key => bind(typeof row[key] === 'object' && row[key] !== null ? JSON.stringify(row[key]) : row[key])).join(',') + ')');
        sql = `INSERT INTO ${table} (${keys.map(identifier).join(',')}) VALUES ${tuples.join(',')}`;
        const prefer = String(req.headers.prefer || '');
        if (prefer.includes('resolution=')) {
          const conflict = String(req.query.on_conflict || 'id').split(',').map(identifier).join(',');
          sql += ` ON CONFLICT (${conflict}) ` + (prefer.includes('ignore-duplicates') ? 'DO NOTHING' : 'DO UPDATE SET ' + keys.map(key => `${identifier(key)}=EXCLUDED.${identifier(key)}`).join(','));
        }
        sql += ' RETURNING *';
      } else if (req.method === 'PATCH') {
        sql = `UPDATE ${table} SET ` + Object.entries(req.body).map(([key,value]) => `${identifier(key)}=${bind(typeof value === 'object' && value !== null ? JSON.stringify(value) : value)}`).join(',') + where + ' RETURNING *';
      } else throw new Error(`Unsupported test method ${req.method}`);
      const result = await db.query(sql, values);
      const rows = JSON.parse(JSON.stringify(result.rows));
      res.set('content-range', `0-${Math.max(0,rows.length-1)}/${rows.length}`);
      if (String(req.headers.accept).includes('vnd.pgrst.object')) {
        if (rows.length !== 1) return res.status(406).json({ code: 'PGRST116', details: `The result contains ${rows.length} rows`, message: 'Cannot coerce result to a single JSON object' });
        return res.json(rows[0]);
      }
      res.json(rows);
    } catch (error: any) { res.status(400).json({ message: error.message, code: error.code || 'TEST_TRANSPORT' }); }
  });
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${(server.address() as any).port}`, close: () => new Promise<void>(resolve => server.close(() => resolve())) };
}
