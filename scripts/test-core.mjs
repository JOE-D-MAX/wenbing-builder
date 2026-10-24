import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {generateDraft,renderSite,validateDraft,examples} from '../lib/generator.ts';
import {makeZip,deploymentFiles} from '../lib/archive.ts';
// Match the application's extensionless TypeScript imports without a bundler or network access.
registerHooks({resolve(specifier,context,next){
 if(/^\.{1,2}\//.test(specifier)&&!(/\.[a-z]+$/i.test(specifier)))return next(specifier+'.ts',context);
 return next(specifier,context);
}});
const {readBrief,previewSummary}=await import('../lib/brief.ts');
const {normalizeBrief,draftBackup,readDraftBackup}=await import('../lib/studio.ts');
const {readBody}=await import('../lib/request.ts');
// The standalone server validates the configured origin instead of proxy headers.
process.env.FORMA_PUBLIC_ORIGIN='https://forma.test';
for(const kind of ['personal','business','restaurant']){const d=generateDraft(kind,examples[kind].text,examples[kind].prompt);assert.equal(d.kind,kind);assert(['editorial','studio','menu'].includes(d.layout));assert.equal(d.items.length,3);const html=renderSite(d);assert(html.includes(d.name));assert(html.includes(`class="layout-${d.layout}"`));assert(html.includes('width=device-width'));assert(html.includes('Content-Security-Policy'));assert(!html.includes('<script'));}
assert.equal(generateDraft('personal',examples.personal.text,'').layout,'editorial');assert.equal(generateDraft('business',examples.business.text,'').layout,'studio');assert.equal(generateDraft('restaurant',examples.restaurant.text,'').layout,'menu');
assert.throws(()=>generateDraft('personal',' ','无衬线'));
assert.throws(()=>generateDraft('invalid','名称：例子\n介绍：足够字数',''));
const plain=generateDraft('personal','名称：阿明\n介绍：自由插画师，喜欢在旅途中记录日常。','蓝色无衬线');assert.equal(plain.theme,'blue');assert.equal(plain.font,'sans');assert.equal(plain.phone,'');assert.equal(plain.address,'');assert.equal(plain.items.length,0);
assert.equal(generateDraft('business','名称：甲方工作室\n介绍：提供品牌服务和空间设计。','杂志留白').layout,'editorial');

// Pasting normal paragraphs and one menu entry per line must preserve the user's content.
const multiline=generateDraft('restaurant',[
 '名称：两段小馆',
 '介绍：第一段介绍，记录店里的季节餐桌。',
 '',
 '第二段介绍，保留用户输入的补充说明。',
 '菜单：烤鸡｜香草与时蔬',
 '菌菇饭｜当季菌菇',
 '招牌：气泡水｜柠檬与薄荷',
 '地址：西湖区',
 '二层临街入口',
 '营业时间：周二至周日',
 '11:00—21:00',
 '邮箱：hello@example.com',
].join('\r\n'),'');
assert.equal(multiline.intro,'第一段介绍，记录店里的季节餐桌。\n\n第二段介绍，保留用户输入的补充说明。');
assert.deepEqual(multiline.items,[{title:'烤鸡',description:'香草与时蔬'},{title:'菌菇饭',description:'当季菌菇'},{title:'气泡水',description:'柠檬与薄荷'}]);
assert.equal(multiline.address,'西湖区\n二层临街入口');
assert.equal(multiline.hours,'周二至周日\n11:00—21:00');
assert.equal(multiline.email,'hello@example.com');
assert.equal(multiline.phone,'');
const multilineHtml=renderSite(multiline);
assert(multilineHtml.includes('第二段介绍，保留用户输入的补充说明。'));
assert(multilineHtml.includes('<h3>气泡水</h3>'));
const unlabelled=generateDraft('personal','\n名称：阿明\n我是一名自由插画师。\n也记录旅行中的日常。\n项目：旅行速写｜沿途记录','');
assert.equal(unlabelled.intro,'我是一名自由插画师。\n也记录旅行中的日常。');
const menuText=n=>'名称：十二道菜\n介绍：按季节准备的菜单，欢迎了解。\n菜单：'+Array.from({length:n},(_,i)=>`菜品 ${i+1}｜说明 ${i+1}`).join('\n');
assert.equal(generateDraft('restaurant',menuText(12),'').items.length,12);
assert.throws(()=>generateDraft('restaurant',menuText(13),''),/最多支持 12 项/);
const longTitle='名'.repeat(150),longDescription='说'.repeat(800);
const fullItem=generateDraft('business',`名称：完整说明\n介绍：专注完整保留客户输入的说明。\n服务：${longTitle}｜${longDescription}`,'');
assert.deepEqual(fullItem.items,[{title:longTitle,description:longDescription}]);
assert.throws(()=>generateDraft('business',`名称：超长说明\n介绍：测试明确的内容上限反馈。\n服务：设计｜${longDescription}多`,''),/说明最多 800 字/);
assert.throws(()=>generateDraft('business','名称：空项目\n介绍：测试项目名称不能为空。\n服务：｜只有说明',''),/填写名称/);
assert.throws(()=>generateDraft('personal','名称：长介绍\n介绍：'+'文'.repeat(6001),''),/介绍最多支持 6000 字/);

// Export/import supports current and legacy drafts, and invalid imports cannot inject settings or images.
const legacyBrief={kind:'personal',name:'阿明',text:'介绍：自由插画师，记录旅行中的日常。',prompt:'蓝色，商务网格，无衬线',contact:'邮箱：hello@example.com',image:''};
assert.deepEqual(readDraftBackup(JSON.stringify(legacyBrief)),normalizeBrief(legacyBrief));
const selectedBrief={...legacyBrief,headline:'  旅行之间的细小故事  ',theme:'clay',layout:'editorial',font:'serif',image:'data:image/png;base64,aGVsbG8='};
const restoredBrief=readDraftBackup(draftBackup(selectedBrief));
assert.deepEqual(restoredBrief,normalizeBrief(selectedBrief));
const selectedDraft=readBrief(restoredBrief);
assert.equal(selectedDraft.headline,'旅行之间的细小故事');
assert.equal(selectedDraft.theme,'clay');
assert.equal(selectedDraft.layout,'editorial');
assert.equal(selectedDraft.font,'serif');
assert.equal(selectedDraft.image,selectedBrief.image);
const automaticDraft=readBrief({...selectedBrief,headline:'',theme:'auto',layout:'auto',font:'auto'});
assert.equal(automaticDraft.headline,legacyBrief.name);
assert.equal(automaticDraft.theme,'blue');
assert.equal(automaticDraft.layout,'studio');
assert.equal(automaticDraft.font,'sans');
assert.deepEqual(previewSummary(selectedBrief),{name:'阿明',kind:'personal',layout:'editorial',theme:'clay',sectionCount:2});
assert.throws(()=>readDraftBackup('{broken json'));
assert.throws(()=>readDraftBackup(JSON.stringify({format:'forma-brief',version:2,brief:legacyBrief})),/备份版本/);
for(const change of [{theme:'red'},{layout:'<script>'},{font:'Comic Sans'},{headline:'字'.repeat(161)},{image:'data:image/svg+xml;base64,AAAA'},{text:'字'.repeat(6001)}])assert.throws(()=>readDraftBackup(JSON.stringify({...legacyBrief,...change})));
assert.throws(()=>readDraftBackup(' '.repeat(1800001)),/备份文件过大/);
assert.throws(()=>readDraftBackup('[]'),/资料格式不正确/);
assert.throws(()=>readBrief({...legacyBrief,name:' '}),/请填写名称/);
assert.throws(()=>readBrief({...legacyBrief,text:'太短'}),/至少 8 个字/);

const longName='LONGNAME'.repeat(10);
const longNameDraft=readBrief({...legacyBrief,name:longName});
const longNameHtml=renderSite(longNameDraft);
assert.equal(longNameDraft.name,longName);
assert(longNameHtml.includes(`<h2>关于${longName}</h2>`));
assert(longNameHtml.includes(`<meta property="og:title" content="${longName}">`));
const malicious={...plain,headline:'<script>alert(1)</script>',name:'<img src=x onerror=alert(1)>',email:'x\" onclick=\"alert(1)',phone:'javascript:alert(1)',image:'data:image/svg+xml,<svg onload=alert(1)>'};const escaped=renderSite(malicious);assert(!escaped.includes('<script>'));assert(!escaped.includes('<img src=x'));assert(!escaped.includes('href="javascript:'));assert(!escaped.includes('src="data:image/svg'));assert(escaped.includes('&lt;script&gt;'));
assert.throws(()=>validateDraft({...plain,theme:'red; background:url(https://evil)'}));
assert.throws(()=>validateDraft({...plain,items:[null]}),/项目内容/);
assert.throws(()=>validateDraft({...plain,items:[{title:'',description:'没有名称'}]}),/项目内容/);
assert.throws(()=>validateDraft({...plain,items:[{title:'设计',description:'字'.repeat(801)}]}),/项目内容/);
const zip=makeZip(deploymentFiles(renderSite(plain))),view=new DataView(zip.buffer);assert.equal(view.getUint32(0,true),0x04034b50);assert.equal(view.getUint32(zip.length-22,true),0x06054b50);assert.equal(view.getUint16(zip.length-14,true),3);const filenameLength=view.getUint16(26,true),size=view.getUint32(18,true);assert.equal(new TextDecoder().decode(zip.slice(30,30+filenameLength)),'index.html');assert.equal(new TextDecoder().decode(zip.slice(30+filenameLength,30+filenameLength+size)),renderSite(plain));
const validRequest=new Request('https://forma.test/api',{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://forma.test'},body:'{"ok":true}'});assert.deepEqual(await readBody(validRequest),{ok:true});
await assert.rejects(readBody(new Request('https://forma.test/api',{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://evil.test'},body:'{}'})));
await assert.rejects(readBody(new Request('https://forma.test/api',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"a":"too long"}'}),4));
console.log('PASS: three site types, multiline factual fields, 12-item limits, draft backup roundtrip, style overrides, validation, long names, HTML escaping, ZIP structure, origin and payload validation');
