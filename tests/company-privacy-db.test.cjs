const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const db = new PGlite();
const migration = fs.readFileSync('supabase/migrations/20261103124119_require_authenticated_companies.sql', 'utf8');
const owner = '00000000-0000-0000-0000-000000000001';
const other = '00000000-0000-0000-0000-000000000002';
const customer = '00000000-0000-0000-0000-000000000003';
async function role(name, uid = '', admin = false) {
  await db.exec(`RESET ROLE; SELECT set_config('test.uid','${uid}',false),set_config('test.admin','${admin}',false),set_config('test.role','${name}',false); SET ROLE ${name};`);
}
async function rows() { return (await db.query('SELECT * FROM public.get_companies() ORDER BY name')).rows; }
before(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('test.uid',true),'')::uuid$$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('test.role',true),'')$$;
    CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE AS $$SELECT coalesce(current_setting('test.admin',true),'false')::boolean$$;
    CREATE TABLE profiles(id uuid PRIMARY KEY,is_locked boolean NOT NULL DEFAULT false);
    CREATE FUNCTION public.assert_account_access(uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$BEGIN
      IF NOT EXISTS(SELECT 1 FROM profiles WHERE id=$1 AND NOT is_locked) THEN RAISE EXCEPTION 'Account is locked or unavailable'; END IF;
    END$$;
    CREATE TABLE companies(id uuid PRIMARY KEY,name text,prefix text,status text,created_at timestamptz DEFAULT now(),
      owner_id uuid,gstin text,pan text,account_number text,ifsc_code text,document_url text,future_private_column text);
    GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
  `);
  await db.exec(migration);
});
after(() => db.close());
beforeEach(async () => {
  await db.exec(`RESET ROLE; TRUNCATE profiles,companies;
    INSERT INTO profiles VALUES('${owner}',false),('${other}',false),('${customer}',false);
    INSERT INTO companies(id,name,prefix,status,owner_id,gstin,pan,account_number,ifsc_code,document_url,future_private_column) VALUES
    (gen_random_uuid(),'Approved','APP','approved','${owner}','fictional-gst','fictional-pan','fictional-account','fictional-ifsc','private-document','future-secret'),
    (gen_random_uuid(),'Pending','PND','pending','${other}','fictional-gst','fictional-pan','fictional-account','fictional-ifsc','private-document','future-secret');
  `);
});
test('anonymous execution is denied even if a forged user ID is supplied', async () => {
  await role('anon', owner); await assert.rejects(rows(), /permission denied/);
});
test('a missing identity fails closed despite authenticated execution permission', async () => {
  await role('authenticated'); await assert.rejects(rows(), /Authentication required/);
});
test('populated and future private columns are absent for ordinary customers', async () => {
  await role('authenticated', customer); const result = await rows(); assert.equal(result.length, 1);
  assert.equal(result[0].name, 'Approved');
  for (const key of ['owner_id','gstin','pan','account_number','ifsc_code','document_url','future_private_column']) assert.equal(result[0][key], null, key);
});
test('merchants retain only their own private details', async () => {
  await role('authenticated', other); const result = await rows(); assert.equal(result.length, 2);
  assert.equal(result.find(row => row.name === 'Pending').account_number, 'fictional-account');
  assert.equal(result.find(row => row.name === 'Approved').account_number, null);
});
test('active administrators retain access and locked accounts are rejected', async () => {
  await role('authenticated', customer, true); assert.ok((await rows()).every(row => row.account_number === 'fictional-account'));
  await db.exec(`RESET ROLE; UPDATE profiles SET is_locked=true WHERE id='${customer}'`);
  await role('authenticated', customer, true); await assert.rejects(rows(), /locked/);
});
test('trusted server calls retain their previous public-only anonymous-identity result', async () => {
  await role('service_role'); const result = await rows(); assert.equal(result.length, 1); assert.equal(result[0].account_number, null);
});
test('an accidental anonymous regrant is still blocked by the function guard', async () => {
  await db.exec('RESET ROLE; GRANT EXECUTE ON FUNCTION public.get_companies() TO anon');
  await role('anon'); await assert.rejects(rows(), /Authentication required/);
  await db.exec('RESET ROLE'); await db.exec(migration);
  await role('anon'); await assert.rejects(rows(), /permission denied/);
});
