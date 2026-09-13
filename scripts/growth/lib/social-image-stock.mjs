/**
 * Free stock photography for owned social — curated Unsplash URLs, no Bedrock cost.
 * Images must visibly communicate TRAIN / VIBE / DATE connection, not generic solo activity.
 */
import { assessPhotoQuality } from './social-image-bedrock.mjs';
import { PROHIBITED_VIBE_KEYWORDS, stockPhotosForMode, unsplashCropUrl } from './social-image-stock-library.mjs';

function hashSeed(input) {
  let h=2166136261; for (let i=0;i<input.length;i++){ h^=input.charCodeAt(i); h=Math.imul(h,16777619); } return Math.abs(h);
}

function socialFirstPool(mode, input, activity='') {
  let pool=[...input];
  if (mode==='TRAIN') {
    const social=pool.filter(p=>/partner|partners|players|doubles|runners|cyclists|group|together|class/i.test(`${p.scene||''} ${(p.activities||[]).join(' ')}`));
    if (social.length) pool=social;
  }
  if (mode==='VIBE' && activity!=='hiking') {
    const human=pool.filter(p=>!/(hiking mountain trail|scenic hilltop|toward scenic alpine peak)/i.test(p.scene||''));
    if (human.length) pool=human;
  }
  return pool;
}

export function selectStockPhoto({ mode, contentId='', isoDate='', activity='', recentEntries=[] }={}) {
  const m=String(mode||'TRAIN').toUpperCase();
  const act=String(activity||'').toLowerCase().trim();
  let pool=socialFirstPool(m, stockPhotosForMode(m), act);

  if (act) {
    const actTokens=act.split(/[\s,/_]+/).filter(Boolean);
    if (m==='DATE' && (act==='lifestyle'||actTokens.includes('active'))) {
      const preferred=pool.filter(p=>{const tags=(p.activities||[]).map(a=>a.toLowerCase()); return tags.includes('lifestyle')||tags.includes('active')||tags.includes('playful');});
      const energetic=preferred.filter(p=>{const tags=(p.activities||[]).map(a=>a.toLowerCase()); const scene=(p.scene||'').toLowerCase(); return (tags.includes('active')||tags.includes('outdoor')||/outdoor|park|walk|active|jacket|candid couple/.test(scene)) && !/group of|friends|communal|brewery|patio restaurant|close embrace|romantic close/.test(scene);});
      if (energetic.length) pool=energetic; else if (preferred.length) pool=preferred;
    } else {
      const matched=pool.filter(p=>{const acts=(p.activities||[]).map(a=>a.toLowerCase()); const scene=(p.scene||'').toLowerCase(); return actTokens.some(t=>acts.includes(t)||scene.includes(t));});
      if (matched.length) pool=matched;
    }
  }

  if (m==='VIBE') pool=pool.filter(p=>{const text=`${p.scene||''} ${(p.activities||[]).join(' ')}`.toLowerCase(); return !PROHIBITED_VIBE_KEYWORDS.some(b=>text.includes(b));});
  if (!pool.length) pool=socialFirstPool(m, stockPhotosForMode(m), act);

  const usedIds=new Set((recentEntries||[]).map(e=>e.stockPhotoId||'').filter(Boolean));
  const seed=hashSeed(`${isoDate}:${contentId}:${m}:${act}`);
  const sorted=[...pool].sort((a,b)=>a.id.localeCompare(b.id));
  const fresh=sorted.filter(p=>!usedIds.has(p.id)); const candidates=fresh.length?fresh:sorted;
  for (let offset=0;offset<candidates.length;offset++) {
    const photo=candidates[(seed+offset*17)%candidates.length];
    const visualUsed=(recentEntries||[]).some(e=>String(e.stockPhotoId||'')===photo.id||String(e.visualConcept||'')===photo.scene);
    if (!visualUsed||offset===candidates.length-1) return {...photo,url:unsplashCropUrl(photo.unsplashId)};
  }
  const fallback=candidates[seed%candidates.length]; return {...fallback,url:unsplashCropUrl(fallback.unsplashId)};
}

export async function fetchStockPhotoBuffer(photo,{fetchImpl=globalThis.fetch,timeoutMs=20000}={}) {
  const url=photo?.url||unsplashCropUrl(photo?.unsplashId); const controller=typeof AbortController!=='undefined'?new AbortController():null; const timer=controller?setTimeout(()=>controller.abort(),timeoutMs):null;
  try { const res=await fetchImpl(url,controller?{signal:controller.signal}:{}); if(!res.ok)return{ok:false,error:`stock_fetch_${res.status}`,url}; const buffer=Buffer.from(await res.arrayBuffer()); return{ok:true,buffer,url,photoId:photo?.id||'',modelId:'unsplash_stock'}; }
  catch(e){return{ok:false,error:e instanceof Error?e.message:'stock_fetch_failed',url};} finally{if(timer)clearTimeout(timer);}
}

export async function generateStockPhoto(concept,{isoDate,activity,recentEntries=[],sharpImpl,maxAttempts=3,fetchImpl}={}) {
  let lastError='unknown'; const resolvedActivity=activity||concept?.semanticActivity||'';
  for(let attempt=0;attempt<maxAttempts;attempt++){
    const photo=selectStockPhoto({mode:concept.mode,contentId:`${concept.contentId}:${attempt}`,isoDate:`${isoDate}:${attempt}`,activity:resolvedActivity,recentEntries});
    const fetched=await fetchStockPhotoBuffer(photo,{fetchImpl}); if(!fetched.ok){lastError=fetched.error;continue;}
    const quality=await assessPhotoQuality(fetched.buffer,sharpImpl); if(!quality.ok){lastError=quality.reason;continue;}
    return{ok:true,buffer:fetched.buffer,modelId:'unsplash_stock',stockPhotoId:photo.id,sourceUrl:fetched.url,scene:photo.scene,seed:hashSeed(`${isoDate}:${concept.contentId}:${photo.id}`),quality};
  }
  return{ok:false,error:lastError};
}
