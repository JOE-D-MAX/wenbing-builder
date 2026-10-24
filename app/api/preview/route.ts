import { readBrief } from '@/lib/brief';
import { renderSite } from '@/lib/generator';
import { json,readBody } from '@/lib/request';
export async function POST(request:Request){
  try {const draft=readBrief(await readBody(request,1800000));return json({preview:{name:draft.name,kind:draft.kind,layout:draft.layout,theme:draft.theme,sectionCount:draft.items.length+2},html:renderSite(draft).replace(/href="#/g,'href="about:srcdoc#')});}
  catch(e){return json({error:e instanceof Error?e.message:'无法生成，请检查资料。'},400);}
}
