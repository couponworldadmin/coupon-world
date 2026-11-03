const {test,before,beforeEach,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const db=new PGlite();
const owner='00000000-0000-0000-0000-000000000001';
const stranger='00000000-0000-0000-0000-000000000002';
const merchant='00000000-0000-0000-0000-000000000003';
const company='00000000-0000-0000-0000-000000000004';
const coupon='00000000-0000-0000-0000-000000000005';
const request='00000000-0000-0000-0000-000000000006';
async function actor(uid=owner,role='authenticated',admin=false){
 await db.exec(`RESET ROLE; SELECT set_config('test.uid','${uid}',false),set_config('test.admin','${admin}',false); SET ROLE ${role};`);
}
async function redeem(amount=null,id=request){return (await db.query('SELECT redeem_coupon_once($1,$2,$3) AS result',[coupon,amount,id])).rows[0].result;}
async function balance(){await db.exec('RESET ROLE');return Number((await db.query('SELECT remaining_balance FROM coupons WHERE id=$1',[coupon])).rows[0].remaining_balance);}
before(async()=>{
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('test.uid',true),'')::uuid$$;
 CREATE FUNCTION is_admin() RETURNS boolean LANGUAGE sql STABLE AS $$SELECT coalesce(current_setting('test.admin',true),'false')::boolean$$;
 CREATE TABLE profiles(id uuid PRIMARY KEY,country_code text,is_locked boolean DEFAULT false);
 CREATE FUNCTION assert_account_access(uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$BEGIN IF NOT EXISTS(SELECT 1 FROM profiles WHERE id=$1 AND NOT is_locked) THEN RAISE EXCEPTION 'Account unavailable'; END IF;END$$;
 CREATE FUNCTION currency_for_country(text) RETURNS text LANGUAGE sql AS $$SELECT CASE WHEN $1='IN' THEN 'INR' END$$;
 CREATE TABLE companies(id uuid PRIMARY KEY,owner_id uuid,status text,name text);
 CREATE TABLE coupons(id uuid PRIMARY KEY,company_id uuid,issued_to uuid,is_used boolean,status text,country_code text,remaining_balance numeric,expiry_date timestamptz,redeemed_at timestamptz,redemption_destination text,code text,created_at timestamptz DEFAULT now());
 CREATE TABLE redemptions(id uuid DEFAULT gen_random_uuid(),coupon_id uuid,amount numeric,remaining_balance_after numeric);
 CREATE TABLE coupon_redemptions(id uuid DEFAULT gen_random_uuid(),coupon_id uuid,game_user_id text,game_id text,wallet_transaction_id text UNIQUE,ip_address text,device text,status text);
 GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;`);
 await db.exec(fs.readFileSync('supabase/migrations/20261103134529_secure_coupon_redemption_and_preview.sql','utf8'));
});
after(()=>db.close());
beforeEach(async()=>{
 await db.exec(`RESET ROLE; TRUNCATE coupon_redemption_requests,coupons,companies,profiles,redemptions,coupon_redemptions;
 INSERT INTO profiles VALUES('${owner}','IN',false),('${stranger}','IN',false),('${merchant}','IN',false);
 INSERT INTO companies VALUES('${company}','${merchant}','approved','Fictional Company');
 INSERT INTO coupons(id,company_id,issued_to,is_used,status,country_code,remaining_balance,expiry_date,redemption_destination,code)
 VALUES('${coupon}','${company}','${owner}',false,'active','IN',100,now()+interval '1 year','couponvault','FICTIONAL-SECRET-CODE');`);
 await actor();
});
test('all modern routes reject Gaming, Lottery and unclassified coupons without writes',async()=>{
 for(const destination of ['gaming','lottery',null]){
  await db.exec('RESET ROLE');await db.query('UPDATE coupons SET redemption_destination=$1',[destination]);await actor();
  await assert.rejects(redeem(10),/destination/);
  await assert.rejects(db.query('SELECT redeem_coupon_cv($1,$2)',[coupon,request]),/destination/);
  assert.equal(await balance(),100);
 }
});
test('legacy function is inaccessible and its body also fails closed',async()=>{
 await assert.rejects(db.query('SELECT * FROM redeem_coupon_amount($1,10)',[coupon]),/permission denied/);
 await db.exec('RESET ROLE');
 await assert.rejects(db.query('SELECT * FROM redeem_coupon_amount($1,10)',[coupon]),/Legacy redemption is disabled/);
 assert.equal(await balance(),100);
});
test('full redemption retries write exactly once, including through compatibility wrapper',async()=>{
 const result=(await db.query('SELECT redeem_coupon_cv($1,$2) AS result',[coupon,request])).rows[0].result;
 assert.equal(result.redeemed_amount,100);assert.equal(result.remaining_balance,0);
 assert.equal((await redeem()).idempotent,true);
 await db.exec('RESET ROLE');
 assert.equal(Number((await db.query('SELECT count(*) AS n FROM redemptions')).rows[0].n),1);
 assert.equal(Number((await db.query('SELECT count(*) AS n FROM coupon_redemptions')).rows[0].n),1);
});
test('partial redemption retries preserve amount and reject request ID reuse',async()=>{
 assert.equal((await redeem(25)).remaining_balance,75);
 assert.equal((await redeem(25)).idempotent,true);
 await assert.rejects(redeem(20),/different redemption/);
 assert.equal(await balance(),75);
});
test('wrong user cannot spend or read another user receipt',async()=>{
 await redeem(25);await actor(stranger);
 await assert.rejects(redeem(25),/unauthorized/);assert.equal(await balance(),75);
});
test('approved merchant can redeem a valid recipient voucher; admin can redeem it',async()=>{
 await actor(merchant);assert.equal((await redeem(25)).remaining_balance,75);
 await actor(stranger,'authenticated',true);assert.equal((await redeem(25)).remaining_balance,50);
});
test('recipient country, locked account, expiry and issuer approval are enforced',async()=>{
 for(const change of ["UPDATE profiles SET country_code='US' WHERE id='"+owner+"'", "UPDATE profiles SET is_locked=true WHERE id='"+owner+"'", "UPDATE coupons SET expiry_date=now()-interval '1 day'", "UPDATE companies SET status='pending'"]){
  await db.exec('RESET ROLE');await db.exec(change);await actor(merchant);
  await assert.rejects(redeem(10));assert.equal(await balance(),100);
  await db.exec(`UPDATE profiles SET country_code='IN',is_locked=false; UPDATE coupons SET expiry_date=now()+interval '1 year'; UPDATE companies SET status='approved'`);
 }
});
test('invalid amounts and missing retry IDs never change the balance',async()=>{
 for(const amount of [0,-1,0.001,101,'NaN','Infinity']) await assert.rejects(redeem(amount));
 await assert.rejects(redeem(10,null),/request ID/);assert.equal(await balance(),100);
});
test('anonymous preview has no code, balance, owner or issuance timestamp',async()=>{
 await actor('','anon');
 const row=(await db.query('SELECT * FROM get_coupon_preview($1)',[coupon])).rows[0];
 assert.deepEqual(Object.keys(row).sort(),['coupon_id','company_name','is_used','expiry_date','status','redemption_destination','can_redeem'].sort());
 assert.equal(row.can_redeem,true);assert.equal(JSON.stringify(row).includes('FICTIONAL-SECRET'),false);
 for(const call of ['SELECT * FROM validate_coupon_by_id($1)','SELECT * FROM validate_coupon($1)'])
  await assert.rejects(db.query(call,[call.includes('by_id')?coupon:'FICTIONAL-SECRET-CODE']),/permission denied/);
});
test('private validation is restricted to recipient, approved merchant and admin',async()=>{
 for(const uid of [owner,merchant]){await actor(uid);assert.equal((await db.query('SELECT * FROM validate_coupon_by_id($1)',[coupon])).rows[0].coupon_code,'FICTIONAL-SECRET-CODE');}
 await actor(stranger);assert.equal((await db.query('SELECT * FROM validate_coupon_by_id($1)',[coupon])).rows.length,0);
 await assert.rejects(db.query('SELECT * FROM validate_coupon($1)',['FICTIONAL-SECRET-CODE']),/Invalid coupon/);
 await actor(stranger,'authenticated',true);assert.equal((await db.query('SELECT * FROM validate_coupon_by_id($1)',[coupon])).rows.length,1);
});
test('receipts are not accessible through the client table API',async()=>{
 await redeem(10);await assert.rejects(db.query('SELECT * FROM coupon_redemption_requests'),/permission denied/);
});
test('a successful old-style request remains retryable without another debit',async()=>{
 await db.exec(`RESET ROLE; UPDATE coupons SET remaining_balance=0,is_used=true,status='redeemed';
 INSERT INTO coupon_redemptions(coupon_id,game_user_id,game_id,wallet_transaction_id,status)
 VALUES('${coupon}','${owner}','couponvault','${request}','SUCCESS');`);
 await actor();assert.equal((await redeem()).idempotent,true);assert.equal(await balance(),0);
});
test('request identity cannot be reassigned to another authorized coupon',async()=>{
 await redeem(10);await db.exec('RESET ROLE');
 const second=(await db.query(`INSERT INTO coupons SELECT gen_random_uuid(),company_id,issued_to,false,'active',country_code,100,expiry_date,NULL,redemption_destination,'ANOTHER-FICTIONAL',created_at FROM coupons RETURNING id`)).rows[0].id;
 await actor();await assert.rejects(db.query('SELECT redeem_coupon_once($1,10,$2)',[second,request]),/different redemption/);
});
test('validation guards still reject anonymous identity after accidental execute regrant',async()=>{
 await db.exec('RESET ROLE; GRANT EXECUTE ON FUNCTION validate_coupon_by_id(uuid),validate_coupon(text) TO anon;');
 await actor('','anon');await assert.rejects(db.query('SELECT * FROM validate_coupon_by_id($1)',[coupon]),/Sign-in required/);
 await assert.rejects(db.query('SELECT * FROM validate_coupon($1)',['FICTIONAL-SECRET-CODE']),/Sign-in required/);
 await db.exec('RESET ROLE; REVOKE EXECUTE ON FUNCTION validate_coupon_by_id(uuid),validate_coupon(text) FROM anon;');
});
test('client roles cannot create schema objects or truncate application tables',async()=>{
 const result=(await db.query(`SELECT has_schema_privilege('authenticated','public','CREATE') AS create_access,
 has_table_privilege('authenticated','coupons','TRUNCATE') AS truncate_access`)).rows[0];
 assert.equal(result.create_access,false);assert.equal(result.truncate_access,false);
});
