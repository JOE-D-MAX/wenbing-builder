import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, renameSync, symlinkSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createNodeStorage, getStorage } from '../lib/runtime.ts';

const fixture=mkdtempSync(path.join(tmpdir(),'wenbing-storage-'));
const dataDir=path.join(fixture,'data'),migrationsDir=path.join(fixture,'migrations');
const originalDataDir=process.env.FORMA_DATA_DIR,originalMigrationsDir=process.env.FORMA_MIGRATIONS_DIR;
let storage,second;
try {
  mkdirSync(migrationsDir);
  const migrationName='0000_breezy_anthem.sql';
  const migration=readFileSync(new URL('../drizzle/'+migrationName,import.meta.url),'utf8');
  writeFileSync(path.join(migrationsDir,migrationName),migration);
  storage=createNodeStorage({dataDir,migrationsDir});
  assert.equal((await storage.db.prepare('PRAGMA journal_mode').first()).journal_mode,'wal');
  assert.equal((await storage.db.prepare('SELECT COUNT(*) AS n FROM forma_migrations').first()).n,1);
  const id='F'+'a'.repeat(30),siteKey='b'.repeat(36);
  const inserted=await storage.db.prepare('INSERT INTO orders (id,owner_hash,request_key,site_key,recovery_hash,name,amount,state,created_at,ip_hash) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .bind(id,'owner','request',siteKey,'recovery','持久测试门店',80000,'pending',Date.now(),'ip').run();
  assert.equal(inserted.meta.changes,1);
  assert.equal((await storage.db.prepare('UPDATE orders SET state=? WHERE id=? AND state=?').bind('paid',id,'pending').run()).meta.changes,1);
  assert.equal((await storage.db.prepare('UPDATE orders SET state=? WHERE id=? AND state=?').bind('paid',id,'pending').run()).meta.changes,0);
  assert.equal(await storage.db.prepare('SELECT id FROM orders WHERE id=?').bind('missing').first(),null);
  await assert.rejects(storage.db.prepare('SELECT * FROM nonexistent_private_table').first(),error=>error.message==='数据存储暂时不可用，请稍后再试。'&&!error.message.includes(dataDir));
  const draftKey='drafts/'+id+'.json',siteObjectKey='sites/'+siteKey+'.html';
  await storage.bucket.put(draftKey,JSON.stringify({name:'持久测试门店',private:true}),{httpMetadata:{contentType:'application/json'}});
  await storage.bucket.put(siteObjectKey,'<!DOCTYPE html><title>持久测试门店</title>');
  const object=await storage.bucket.get(draftKey);
  assert.equal((await object.json()).name,'持久测试门店');assert.equal(object.body,await object.text());
  second=createNodeStorage({dataDir,migrationsDir});
  assert.equal((await second.db.prepare('SELECT name FROM orders WHERE id=?').bind(id).first()).name,'持久测试门店');
  assert.equal((await second.bucket.get(draftKey)).body,object.body);
  second.close();second=undefined;storage.close();

  // A new process must reopen the same database and objects after shutdown.
  const runtimeURL=new URL('../lib/runtime.ts',import.meta.url).href;
  const restarted=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','-e',
    `import assert from 'node:assert/strict';import {getStorage} from ${JSON.stringify(runtimeURL)};const s=getStorage();assert.equal((await s.db.prepare('SELECT COUNT(*) AS n FROM orders').first()).n,1);assert.equal((await s.bucket.get(${JSON.stringify(draftKey)})).body,${JSON.stringify(object.body)});s.close();assert.equal(getStorage().isClosed,false);getStorage().close();console.log('restart persisted');`],
    {encoding:'utf8',env:{...process.env,FORMA_DATA_DIR:dataDir,FORMA_MIGRATIONS_DIR:migrationsDir}});
  assert.equal(restarted.status,0,restarted.stderr);assert.match(restarted.stdout,/restart persisted/);
  storage=createNodeStorage({dataDir,migrationsDir});
  await Promise.all(Array.from({length:12},(_,version)=>storage.bucket.put(draftKey,JSON.stringify({version,body:'测'.repeat(5000)}))));
  const complete=await (await storage.bucket.get(draftKey)).json();assert.equal(complete.body.length,5000);assert(Number.isInteger(complete.version));
  assert.equal(readdirSync(path.join(dataDir,'objects','drafts')).filter(name=>name.endsWith('.tmp')).length,0);
  for(const key of ['../orders.sqlite','drafts/../orders.sqlite','/sites/'+siteKey+'.html','sites\\'+siteKey+'.html','drafts/%2e%2e.json','drafts/invalid.json','sites/'+siteKey+'.html/extra']) {
    await assert.rejects(storage.bucket.get(key),/Invalid persistent object key/);
    await assert.rejects(storage.bucket.put(key,'bad'),/Invalid persistent object key/);
    await assert.rejects(storage.bucket.delete(key),/Invalid persistent object key/);
  }
  const draftsDir=path.join(dataDir,'objects','drafts'),heldDir=draftsDir+'-held',outside=path.join(fixture,'outside');
  mkdirSync(outside);renameSync(draftsDir,heldDir);
  try {
    symlinkSync(outside,draftsDir,process.platform==='win32'?'junction':'dir');
    await assert.rejects(storage.bucket.put(draftKey,'blocked'),/symbolic links/);
    assert.deepEqual(readdirSync(outside),[]);
  } finally {try{unlinkSync(draftsDir);}catch(error){if(error.code!=='ENOENT')throw error;}renameSync(heldDir,draftsDir);}
  await storage.bucket.delete(siteObjectKey);assert.equal(await storage.bucket.get(siteObjectKey),null);await storage.bucket.delete(siteObjectKey);
  storage.close();
  writeFileSync(path.join(migrationsDir,migrationName),migration+'\n-- changed after application');
  assert.throws(()=>createNodeStorage({dataDir,migrationsDir}),/migration has changed/);
  writeFileSync(path.join(migrationsDir,migrationName),migration);
  writeFileSync(path.join(migrationsDir,'0001_failed_test.sql'),'CREATE TABLE rollback_probe (id INTEGER); INVALID SQL;');
  assert.throws(()=>createNodeStorage({dataDir,migrationsDir}));
  unlinkSync(path.join(migrationsDir,'0001_failed_test.sql'));
  storage=createNodeStorage({dataDir,migrationsDir});
  assert.equal(await storage.db.prepare("SELECT name FROM sqlite_master WHERE name='rollback_probe'").first(),null);
  assert.equal((await storage.db.prepare('SELECT COUNT(*) AS n FROM orders').first()).n,1);
  assert.equal((await storage.db.prepare('SELECT COUNT(*) AS n FROM forma_migrations').first()).n,1);
  storage.close();
  writeFileSync(path.join(fixture,'not-directory'),'x');
  assert.throws(()=>createNodeStorage({dataDir:path.join(fixture,'not-directory'),migrationsDir}));
  assert.throws(()=>createNodeStorage({dataDir:path.join(process.cwd(),'public','private-data'),migrationsDir}),/outside publicly served/);
  process.env.FORMA_DATA_DIR=dataDir;process.env.FORMA_MIGRATIONS_DIR=migrationsDir;
  assert.equal((await getStorage().db.prepare('SELECT COUNT(*) AS n FROM orders').first()).n,1);getStorage().close();
  process.env.FORMA_DATA_DIR=path.join(fixture,'not-directory');assert.throws(()=>getStorage());
  console.log('PASS: SQLite WAL persistence; fresh-process restart; migration integrity and transactional rollback; conditional updates; atomic object writes; key traversal and symlink rejection; delete semantics; private data directory; failed initialization never falls back to memory.');
} finally {
  storage?.close();second?.close();
  if(originalDataDir===undefined)delete process.env.FORMA_DATA_DIR;else process.env.FORMA_DATA_DIR=originalDataDir;
  if(originalMigrationsDir===undefined)delete process.env.FORMA_MIGRATIONS_DIR;else process.env.FORMA_MIGRATIONS_DIR=originalMigrationsDir;
  assert(path.resolve(fixture).startsWith(path.resolve(tmpdir())+path.sep));rmSync(fixture,{recursive:true,force:true});
}
