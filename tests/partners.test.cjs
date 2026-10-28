// Partner revenue share: commissions on completed purchases by attributed buyers, and the
// secret-key partner panel that never exposes buyer identities.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {A,B,setup,q,role}=require('./db-setup.cjs');

async function buy(db,user,pkg,amount,currency,tag){
 const p=(await q(db,`select public.xora_begin_credit_purchase($1,$2) as r`,[user,pkg]))[0].r;
 await db.exec(`select public.xora_attach_credit_purchase_token('${p.purchase_id}','token-${tag}')`);
 const r=(await q(db,`select public.xora_complete_credit_purchase($1,$2,$3,$4,$5,$6) as r`,[p.purchase_id,'token-'+tag,'pay-'+tag,pkg,amount,currency]))[0].r;
 assert.equal(r.status,'completed');return p.purchase_id;
}

test('attributed purchases earn the partner commission once; others earn nothing',async()=>{
 const db=await setup();
 try{
  await role(db,'service_role');
  const created=(await q(db,`select public.xora_admin_upsert_affiliate('Kartal_TR','Kartal Hesabı',2500) as r`))[0].r;
  assert.equal(created.code,'kartal_tr');assert.equal(created.commission_bps,2500);assert.match(created.panel_key,/^[0-9a-f]{32}$/);
  await db.exec(`insert into public.affiliate_attributions(user_id,referral_code) values('${A}','kartal_tr')`);
  const p1=await buy(db,A,'popular',279,'TRY','a1');
  await buy(db,A,'popular_usd',7.49,'USD','a2');
  await buy(db,B,'value',599,'TRY','b1'); // B came without a partner link
  const rows=await q(db,`select purchase_id,referral_code,amount,currency,commission_amount from public.affiliate_commissions order by currency`);
  assert.equal(rows.length,2,'only the attributed buyer earns commission');
  assert.deepEqual(rows.map(r=>[r.currency,Number(r.amount),Number(r.commission_amount)]),[['TRY',279,69.75],['USD',7.49,1.87]]);
  // Re-completing (duplicate callback) does not add a second commission.
  await q(db,`select public.xora_complete_credit_purchase($1,'token-a1','pay-a1','popular',279,'TRY')`,[p1]);
  assert.equal((await q(db,`select count(*)::int as n from public.affiliate_commissions`))[0].n,2);
  // Expired attribution earns nothing.
  await db.exec(`update public.affiliate_attributions set expires_at=now()-interval '1 day' where user_id='${A}'`);
  await buy(db,A,'starter',149,'TRY','a3');
  assert.equal((await q(db,`select count(*)::int as n from public.affiliate_commissions`))[0].n,2,'no commission after the 30-day window');

  // Panel: by secret key, totals per currency, no buyer ids.
  await db.exec('reset role');await role(db,'anon');
  const panel=(await q(db,`select public.xora_partner_panel($1) as r`,[created.panel_key]))[0].r;
  assert.equal(panel.code,'kartal_tr');assert.equal(panel.signups,1);assert.equal(panel.buyers,1);
  const tryTotal=panel.totals.find(t=>t.currency==='TRY');
  assert.equal(Number(tryTotal.sales),1);assert.equal(Number(tryTotal.commission),69.75);assert.equal(Number(tryTotal.unpaid),69.75);
  assert.equal(panel.recent.length,2);
  assert.doesNotMatch(JSON.stringify(panel),new RegExp(A+'|'+B+'|purchase_id|user_id'),'no buyer or purchase identities');
  assert.equal((await q(db,`select public.xora_partner_panel('wrong-key-wrong-key-wrong') as r`))[0].r,null);
  assert.equal((await q(db,`select public.xora_partner_panel(null) as r`))[0].r,null);
  await assert.rejects(db.exec(`select public.xora_admin_upsert_affiliate('x','x',100)`),/permission denied/,'anon cannot create partners');
  await assert.rejects(db.exec(`select * from public.affiliate_commissions`),/permission denied/,'anon cannot read commissions');

  // Payout marker.
  await db.exec('reset role');await role(db,'service_role');
  const paid=(await q(db,`select public.xora_admin_mark_commissions_paid('kartal_tr','try') as r`))[0].r;
  assert.equal(paid.marked,1);assert.equal(Number(paid.total),69.75);
  await db.exec('reset role');await role(db,'anon');
  const after=(await q(db,`select public.xora_partner_panel($1) as r`,[created.panel_key]))[0].r;
  const t2=after.totals.find(t=>t.currency==='TRY');assert.equal(Number(t2.paid),69.75);assert.equal(t2.unpaid,null);
 }finally{await db.close();}
});

test('admin page RPCs: only admins manage partners; panel keys can be replaced',async()=>{
 const db=await setup();
 try{
  // Non-admin signed-in users and anon are refused.
  await role(db,'authenticated',B);
  assert.equal((await q(db,`select public.xora_is_admin() as r`))[0].r,false);
  await assert.rejects(db.exec(`select public.xora_admin_partners()`),/not_admin/);
  await assert.rejects(db.exec(`select public.xora_admin_save_partner('x1','X',2500,true)`),/not_admin/);
  await role(db,'anon');
  await assert.rejects(db.exec(`select public.xora_admin_partners()`),/permission denied/);
  // A is made admin (in production: the owner's account, by the migration).
  await db.exec('reset role');await db.exec(`insert into public.xora_admins(user_id) values('${A}')`);
  await role(db,'authenticated',A);
  assert.equal((await q(db,`select public.xora_is_admin() as r`))[0].r,true);
  await assert.rejects(db.exec(`select public.xora_admin_save_partner('Bad Code!','X',2500,true)`),/bad_code/);
  await assert.rejects(db.exec(`select public.xora_admin_save_partner('ok','X',20000,true)`),/bad_commission/);
  const p=(await q(db,`select public.xora_admin_save_partner('Kartal','Kartal Hesabı',3000,true) as r`))[0].r;
  assert.equal(p.code,'kartal');assert.equal(p.commission_bps,3000);assert.match(p.panel_key,/^[0-9a-f]{32}$/);
  const list=(await q(db,`select public.xora_admin_partners() as r`))[0].r;
  assert.equal(list.length,1);assert.equal(list[0].code,'kartal');assert.equal(Number(list[0].signups),0);assert.deepEqual(list[0].totals,[]);
  // Rotating the key kills the old panel link.
  const rot=(await q(db,`select public.xora_admin_rotate_panel_key('kartal') as r`))[0].r;
  assert.notEqual(rot.panel_key,p.panel_key);
  await role(db,'anon');
  assert.equal((await q(db,`select public.xora_partner_panel($1) as r`,[p.panel_key]))[0].r,null,'old link dead');
  assert.equal((await q(db,`select public.xora_partner_panel($1) as r`,[rot.panel_key]))[0].r.code,'kartal');
  // Pausing a partner closes its panel.
  await role(db,'authenticated',A);
  await db.exec(`select public.xora_admin_save_partner('kartal','Kartal Hesabı',3000,false)`);
  await role(db,'anon');
  assert.equal((await q(db,`select public.xora_partner_panel($1) as r`,[rot.panel_key]))[0].r,null,'paused partner has no panel');
  // Admin can mark paid; a non-admin cannot.
  await role(db,'authenticated',B);
  await assert.rejects(db.exec(`select public.xora_admin_mark_commissions_paid('kartal','TRY')`),/not_admin/);
 }finally{await db.close();}
});
