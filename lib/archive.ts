// Minimal ZIP writer (stored entries); browser and Worker compatible.
export function makeZip(files:Record<string,string>):Uint8Array<ArrayBuffer>{
 const encoder=new TextEncoder(),parts:Uint8Array[]=[],central:Uint8Array[]=[];let offset=0;
 const crc=(data:Uint8Array)=>{let c=0xffffffff;for(const b of data){c^=b;for(let n=0;n<8;n++)c=(c>>>1)^((c&1)?0xedb88320:0)}return(c^0xffffffff)>>>0};
 for(const [filename,text] of Object.entries(files)){
  const name=encoder.encode(filename),data=encoder.encode(text),sum=crc(data),header=new Uint8Array(30+name.length),h=new DataView(header.buffer);
  h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x800,true);h.setUint32(14,sum,true);h.setUint32(18,data.length,true);h.setUint32(22,data.length,true);h.setUint16(26,name.length,true);header.set(name,30);parts.push(header,data);
  const directory=new Uint8Array(46+name.length),v=new DataView(directory.buffer);v.setUint32(0,0x02014b50,true);v.setUint16(4,20,true);v.setUint16(6,20,true);v.setUint16(8,0x800,true);v.setUint32(16,sum,true);v.setUint32(20,data.length,true);v.setUint32(24,data.length,true);v.setUint16(28,name.length,true);v.setUint32(42,offset,true);directory.set(name,46);central.push(directory);offset+=header.length+data.length;
 }
 const size=central.reduce((n,p)=>n+p.length,0),end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,central.length,true);e.setUint16(10,central.length,true);e.setUint32(12,size,true);e.setUint32(16,offset,true);const output=new Uint8Array(offset+size+22);let position=0;for(const p of [...parts,...central,end]){output.set(p,position);position+=p.length}return output;
}
export function deploymentFiles(html:string){return {
 'index.html':html,
 'README.txt':'文炳建站 · 独立网站部署包\n\n1. 解压本 ZIP。\n2. 双击 index.html 可离线预览，样式与图片均已内嵌，不依赖外部字体或图片服务。\n3. 需要自行托管时，将 index.html 上传至自己的静态网站目录即可，无需安装依赖或执行构建。首页文件必须保持为 index.html。\n4. 面向中国大陆访客，建议选择可稳定访问的国内云服务。使用中国大陆服务器及域名提供网站服务前，请向接入商确认相应备案要求。\n5. 已购买的域名需在托管平台或服务器绑定，按服务商说明设置 DNS，并启用 HTTPS。下载本部署包不会自动购买域名或服务器。\n6. 若使用境外静态托管，请在目标地区的手机网络实测可访问性。\n\n付费发布后的在线地址以订单交付页为准。本 ZIP 是可独立托管的备份，不含商城、后台预约、支付或联系表单服务。邮件和电话链接调用访客的邮箱或拨号软件。\n没有包含任何 API 密钥。\n',
 '_headers':'/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n',
 };}
