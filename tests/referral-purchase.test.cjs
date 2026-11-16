// Partner attribution is settled when the payment starts and stamped on the purchase row; the
// iyzico callback (a cross-site POST without cookies) only completes that row.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {A,B,setup,q,role}=require('./db-setup.cjs');

async function begin(db,user,pkg,code){
 return (await q(db,`select public.xora_begin_credit_purchase($1,$2,$3) as r`,[user,pkg,code]))[0].r.purchase_id;
}
async function complete(db,id,pkg,amount,currency,tag){
 await db.exec(`select public.xora_attach_credit_purchase_token('${id}','token-${tag}')`);
 const r=(await q(db,`select public.xora_complete_credit_purchase($1,$2,$3,$4,$5,$6) as r`,[id,'token-'+tag,'pay-'+tag,pkg,amount,currency]))[0].r;
 assert.equal(r.status,'completed');
}
const commissions=db=>q(db,`select purchase_id,referral_code,commission_amount from public.affiliate_commissions order by created_at`);

test('a buyer who never synced the partner in the browser is still attributed at checkout',async()=>{
 const db=await setup();
 try{
  await role(db,'service_role');
  await q(db,`select public.xora_admin_upsert_affiliate('deneme1','Deneme 1',2500)`);
  // No attribution row yet: the code arrives with the checkout request.
  const id=await begin(db,A,'starter','DENEME1');
  assert.equal((await q(db,`select referral_code from public.credit_purchases where id=$1`,[id]))[0].referral_code,'deneme1');
  assert.equal((await q(db,`select referral_code from public.affiliate_attributions where user_id=$1`,[A]))[0].referral_code,'deneme1');
  await complete(db,id,'starter',149,'TRY','a1');
  const rows=await commissions(db);
  assert.equal(rows.length,1);assert.equal(rows[0].referral_code,'deneme1');assert.equal(Number(rows[0].commission_amount),37.25);
 }finally{await db.close();}
});

test('first touch is permanent: a later partner link never takes the buyer over',async()=>{
 const db=await setup();
 try{
  await role(db,'service_role');
  await q(db,`select public.xora_admin_upsert_affiliate('deneme1','Deneme 1',2500)`);
  await q(db,`select public.xora_admin_upsert_affiliate('deneme2','Deneme 2',2500)`);
  await role(db,'authenticated',A);
  assert.equal((await q(db,`select public.xora_capture_referral('deneme1') as r`))[0].r.referral_code,'deneme1');
  assert.equal((await q(db,`select public.xora_capture_referral('deneme2') as r`))[0].r.referral_code,'deneme1');
  await role(db,'service_role');
  const id=await begin(db,A,'starter','deneme2');
  await complete(db,id,'starter',149,'TRY','a2');
  assert.deepEqual((await commissions(db)).map(r=>r.referral_code),['deneme1']);
  // Even after the 30-day window the account is not re-attributed to another partner.
  await db.exec(`update public.affiliate_attributions set expires_at=now()-interval '1 day' where user_id='${A}'`);
  await role(db,'authenticated',A);
  assert.equal((await q(db,`select public.xora_capture_referral('deneme2') as r`))[0].r,null);
  await role(db,'service_role');
  assert.equal((await q(db,`select referral_code from public.affiliate_attributions where user_id=$1`,[A]))[0].referral_code,'deneme1');
  const late=await begin(db,A,'starter','deneme2');
  assert.equal((await q(db,`select referral_code from public.credit_purchases where id=$1`,[late]))[0].referral_code,null);
 }finally{await db.close();}
});

test('the partner\'s own account never earns from its own link',async()=>{
 const db=await setup();
 try{
  await db.exec(`update auth.users set email='owner@example.com' where id='${A}'`);
  await db.exec(`insert into public.xora_admins(user_id) values('${B}')`);
  await role(db,'authenticated',B);
  const p=(await q(db,`select public.xora_admin_save_partner('kendi','Kendi',2500,true,'Owner@Example.com') as r`))[0].r;
  assert.equal(p.has_owner,true);
  await assert.rejects(db.exec(`select public.xora_admin_save_partner('yok','Yok',2500,true,'nobody@example.com')`),/owner_not_found/);
  // Saving again without an e-mail (rate change) keeps the owner link.
  await q(db,`select public.xora_admin_save_partner('kendi','Kendi',3000,true)`);
  assert.equal((await q(db,`select public.xora_admin_partners() as r`))[0].r[0].has_owner,true);

  await role(db,'authenticated',A);
  assert.equal((await q(db,`select public.xora_capture_referral('kendi') as r`))[0].r,null,'owner is not attributed');
  await role(db,'service_role');
  const id=await begin(db,A,'starter','kendi');
  await complete(db,id,'starter',149,'TRY','own');
  assert.equal((await commissions(db)).length,0);
  // Someone else buying through the same link does earn.
  const other=await begin(db,B,'starter','kendi');
  await complete(db,other,'starter',149,'TRY','other');
  assert.deepEqual((await commissions(db)).map(r=>r.referral_code),['kendi']);
 }finally{await db.close();}
});

test('browsers and the anon key cannot start purchases or stamp partners',async()=>{
 const db=await setup();
 try{
  await role(db,'authenticated',A);
  await assert.rejects(db.exec(`select public.xora_begin_credit_purchase('${A}','starter','x')`),/permission denied/);
  await assert.rejects(db.exec(`select public.xora_attribute_first_touch('${A}','x','x')`),/permission denied/);
  await role(db,'anon');
  await assert.rejects(db.exec(`select public.xora_purchase_partner('${A}')`),/permission denied/);
 }finally{await db.close();}
});
