import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { createHash, randomBytes } from 'node:crypto';
import { constants, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, chmodSync } from 'node:fs';
import { open, rename, unlink } from 'node:fs/promises';
import path from 'node:path';

export const setting = (key:string) => (process.env[key] || '').trim();

function isWithin(parent:string, candidate:string) {
  const relative=path.relative(parent,candidate);
  return relative==='' || (!relative.startsWith('..'+path.sep) && relative!=='..' && !path.isAbsolute(relative));
}
function rejectLinks(target:string) {
  let current=path.resolve(target);
  for (;;) {
    if(existsSync(current) && lstatSync(current).isSymbolicLink())throw new Error('Persistent storage must not contain symbolic links.');
    const parent=path.dirname(current);if(parent===current)break;current=parent;
  }
}
function privateDirectory(target:string) {
  rejectLinks(target);mkdirSync(target,{recursive:true,mode:0o700});
  if(!lstatSync(target).isDirectory())throw new Error('Persistent storage path must be a directory.');
  if(process.platform!=='win32')chmodSync(target,0o700);
  return realpathSync(target);
}
function regularFileOrAbsent(target:string) {
  try {const stat=lstatSync(target);if(!stat.isFile()||stat.isSymbolicLink())throw new Error('Persistent object path is not a regular file.');}
  catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
}
async function storageOperation<T>(operation:()=>T|Promise<T>):Promise<T> {
  try{return await operation();}
  catch(error){
    // API routes may display Error.message; raw filesystem errors include private paths.
    if(error&&typeof error==='object'&&'code' in error)throw new Error('数据存储暂时不可用，请稍后再试。',{cause:error});
    throw error;
  }
}

export function createNodeStorage(options:{dataDir?:string;migrationsDir?:string}={}) {
  const requested=path.resolve(options.dataDir||setting('FORMA_DATA_DIR')||path.join(process.cwd(),'.data','forma'));
  for(const publiclyServed of ['public','.next/static','dist/client']) {
    const publicPath=path.resolve(process.cwd(),publiclyServed);
    if(isWithin(publicPath,requested)||(existsSync(publicPath)&&isWithin(realpathSync(publicPath),requested)))throw new Error('FORMA_DATA_DIR must be outside publicly served directories.');
  }
  const dataDir=privateDirectory(requested),objectsDir=privateDirectory(path.join(dataDir,'objects'));
  const directories={drafts:privateDirectory(path.join(objectsDir,'drafts')),sites:privateDirectory(path.join(objectsDir,'sites'))};
  const databasePath=path.join(dataDir,'orders.sqlite');
  for(const suffix of ['', '-wal', '-shm'])regularFileOrAbsent(databasePath+suffix);
  const sqlite=new DatabaseSync(databasePath,{timeout:5000});
  let closed=false;
  try {
    if(process.platform!=='win32')chmodSync(databasePath,0o600);
    sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;');
    const migrationsDir=path.resolve(options.migrationsDir||setting('FORMA_MIGRATIONS_DIR')||path.join(process.cwd(),'drizzle'));
    const names=readdirSync(migrationsDir).filter(name=>/^\d{4}_[A-Za-z0-9_-]+\.sql$/.test(name)).sort();
    if(!names.length)throw new Error('No database migrations found.');
    sqlite.exec('BEGIN IMMEDIATE');
    try {
      sqlite.exec('CREATE TABLE IF NOT EXISTS forma_migrations (name TEXT PRIMARY KEY NOT NULL, sha256 TEXT NOT NULL, applied_at INTEGER NOT NULL)');
      const applied=sqlite.prepare('SELECT name,sha256 FROM forma_migrations').all() as {name:string;sha256:string}[];
      if(applied.some(row=>!names.includes(row.name)))throw new Error('Database has a migration not present in this release.');
      for(const name of names) {
        const sql=readFileSync(path.join(migrationsDir,name),'utf8'),hash=createHash('sha256').update(sql).digest('hex');
        const previous=applied.find(row=>row.name===name);
        if(previous){if(previous.sha256!==hash)throw new Error('An applied database migration has changed: '+name);continue;}
        sqlite.exec(sql);
        sqlite.prepare('INSERT INTO forma_migrations (name,sha256,applied_at) VALUES (?,?,?)').run(name,hash,Date.now());
      }
      sqlite.exec('COMMIT');
    } catch(error){sqlite.exec('ROLLBACK');throw error;}
  } catch(error){sqlite.close();throw error;}

  function assertOpen(){if(closed)throw new Error('Persistent storage is closed.');}
  function statement(sql:string,values:SQLInputValue[]=[]) {
    return {
      bind(...bound:SQLInputValue[]){return statement(sql,bound);},
      async first<T=Record<string,unknown>>(){return storageOperation(()=>{assertOpen();return (sqlite.prepare(sql).get(...values)||null) as T|null;});},
      async run(){return storageOperation(()=>{assertOpen();const result=sqlite.prepare(sql).run(...values);return {success:true,meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}};});}
    };
  }
  function objectPath(key:string) {
    assertOpen();
    const match=/^(drafts\/F[a-f0-9]{30}\.json|sites\/[a-f0-9]{36}\.html)$/.exec(key);
    if(!match)throw new Error('Invalid persistent object key.');
    const group=key.startsWith('drafts/')?'drafts':'sites',directory=directories[group];
    rejectLinks(directory);
    if(realpathSync(directory)!==directory)throw new Error('Persistent object directory changed.');
    const target=path.join(directory,key.slice(key.indexOf('/')+1));regularFileOrAbsent(target);return target;
  }
  const bucket={
    async put(key:string,value:string,options?:{httpMetadata?:{contentType?:string}}) {
      return storageOperation(async()=>{
      void options;
      if(typeof value!=='string')throw new Error('Persistent objects must be text.');
      const target=objectPath(key),temporary=target+'.'+randomBytes(12).toString('hex')+'.tmp';
      const handle=await open(temporary,constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|(constants.O_NOFOLLOW||0),0o600);
      try {await handle.writeFile(value,'utf8');await handle.sync();}
      catch(error){await handle.close();await unlink(temporary).catch(()=>{});throw error;}
      await handle.close();
      try {objectPath(key);await rename(temporary,target);}
      catch(error){await unlink(temporary).catch(()=>{});throw error;}
      });
    },
    async get(key:string) {
      return storageOperation(async()=>{
      const target=objectPath(key);
      try {
        const handle=await open(target,constants.O_RDONLY|(constants.O_NOFOLLOW||0));
        let value:string;
        try {if(!(await handle.stat()).isFile())throw new Error('Persistent object is not a regular file.');value=await handle.readFile('utf8');}finally{await handle.close();}
        return {body:value,text:async()=>value,json:async<T=unknown>()=>JSON.parse(value) as T};
      }catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error;}
      });
    },
    async delete(key:string) {return storageOperation(async()=>{const target=objectPath(key);try{await unlink(target);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}});}
  };
  return {db:{prepare:statement},bucket,dataDir,get isClosed(){return closed;},close(){if(!closed){sqlite.close();closed=true;}}};
}

type Storage=ReturnType<typeof createNodeStorage>;
const globalStorage=globalThis as typeof globalThis & {__wenbingNodeStorage?:Storage};
export function getStorage(){if(!globalStorage.__wenbingNodeStorage||globalStorage.__wenbingNodeStorage.isClosed)globalStorage.__wenbingNodeStorage=createNodeStorage();return globalStorage.__wenbingNodeStorage;}
