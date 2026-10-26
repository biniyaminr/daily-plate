import { z } from 'zod';
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const num = (min,max) => z.number().finite().min(min).max(max);
const fitness = z.object({
 profile:z.object({weight:num(30,300),height:num(100,250),start:date,walk:num(0,300)}),
 weights:z.record(date,num(30,300)),
 logs:z.record(date,z.object({meals:z.array(z.boolean().nullable()).max(5),sets:z.record(z.string().regex(/^\d+-\d+$/),z.object({kg:num(0,1000).nullable().optional(),reps:num(0,200).nullable().optional(),done:z.boolean().optional()})),walk:num(0,1440),sleep:num(0,24),recovery:z.boolean(),note:z.string().max(1000),shopping:z.array(z.boolean().nullable()).max(5).optional()}))
});
const nutrition=z.object({goals:z.tuple([num(1,20000),num(1,1000),num(1,2000),num(1,1000)]),days:z.record(date,z.array(z.object({id:z.string().regex(/^[a-zA-Z0-9-]+$/).max(100),food:z.tuple([z.string().max(200),num(0,1000),num(0,100),num(0,100),num(0,100)]),grams:num(1,5000),meal:z.enum(['Breakfast','Lunch','Dinner','Snacks'])})).max(1000))});
const respond=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
export async function handleProgress(request, db) {
 const userId=request.headers.get('oai-authenticated-user-id');
 if(!userId)return respond({error:'Sign in to save your progress.'},401);
 if(!db)return respond({error:'Cloud storage is unavailable.'},503);
 try {
  if(request.method==='GET') {
   const {results}=await db.prepare('SELECT kind, payload, revision FROM progress WHERE user_id = ?').bind(userId).all();
   return respond({userId,records:Object.fromEntries(results.map(r=>[r.kind,{value:JSON.parse(r.payload),revision:r.revision}]))});
  }
  if(request.method!=='PUT')return respond({error:'Method not allowed'},405);
  if(request.headers.get('origin')!==new URL(request.url).origin)return respond({error:'Invalid origin'},403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return respond({error:'JSON required'},415);
  // Bound actual streamed bytes rather than trusting Content-Length.
  const reader=request.body?.getReader();if(!reader)return respond({error:'Missing body'},400);
  let size=0,chunks=[];for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>2_000_000){await reader.cancel();return respond({error:'Backup is too large'},413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let pos=0;for(const c of chunks){bytes.set(c,pos);pos+=c.length;}
  let body;try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{return respond({error:'Invalid JSON'},400);}
  const base=z.object({userId:z.string().min(1),kind:z.enum(['fitness','nutrition']),revision:z.number().int().min(0),value:z.unknown()}).safeParse(body);
  if(!base.success)return respond({error:'Invalid record'},400);
  if(body.userId!==userId)return respond({error:'Your sign-in changed. Reload before saving.'},403);
  const parsed=(body.kind==='fitness'?fitness:nutrition).safeParse(body.value);
  if(!parsed.success)return respond({error:'Invalid progress data'},400);
  const result=await db.prepare(`INSERT INTO progress (user_id,kind,payload,revision,updated_at) SELECT ?,?,?,1,? WHERE ? = 0
   ON CONFLICT(user_id,kind) DO UPDATE SET payload=excluded.payload, revision=progress.revision+1, updated_at=excluded.updated_at WHERE progress.revision = ?`).bind(userId,body.kind,JSON.stringify(parsed.data),new Date().toISOString(),body.revision,body.revision).run();
  // Existing records use a conditional UPDATE; initial inserts use the insert path above.
  if(!result.meta.changes&&body.revision>0){
   const updated=await db.prepare('UPDATE progress SET payload=?,revision=revision+1,updated_at=? WHERE user_id=? AND kind=? AND revision=?').bind(JSON.stringify(parsed.data),new Date().toISOString(),userId,body.kind,body.revision).run();
   if(!updated.meta.changes)return respond({error:'Newer changes exist. Reload cloud data before editing.'},409);
  } else if(!result.meta.changes)return respond({error:'Newer changes exist. Reload cloud data before editing.'},409);
  return respond({revision:body.revision+1});
 } catch { return respond({error:'Cloud storage is temporarily unavailable.'},503); }
}
