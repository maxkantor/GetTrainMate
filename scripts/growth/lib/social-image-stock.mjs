/**
 * Free stock photography for owned social — curated Unsplash only.
 * HARD RULE: the image must visibly communicate human connection, not generic activity.
 */
import { assessPhotoQuality } from './social-image-bedrock.mjs';
import { PROHIBITED_VIBE_KEYWORDS, stockPhotosForMode, unsplashCropUrl } from './social-image-stock-library.mjs';

function hashSeed(input) { let h=2166136261; for (let i=0;i<input.length;i++){ h^=input.charCodeAt(i); h=Math.imul(h,16777619); } return Math.abs(h); }

const HARD_BLOCKED_IDS = new Set([
  'vibe-hiking-mountain-trail',
  'vibe-friends-street-chat',       // today's weak generic street creative
  'vibe-friends-coastal-scenery',   // people too small / scenery dominates
  'train-tennis-player-lifestyle',
  'train-tennis-court-action',
  'train-gym-strength-lifting',
  'date-couple-cafe-social',
  'date-cocktails-cheers-date',
  'date-wine-celebration-toast'
]);

const PREMIUM_PREFERRED_IDS = {
  TRAIN: new Set([
    'train-gym-partners-goals',
    'train-pickleball-match',
    'train-pickleball-doubles',
    'train-running-outdoor-group',
    'train-cycling-road-partners',
    'train-functional-gym-class'
  ]),
  VIBE: new Set([
    'vibe-friends-rooftop-sunset',
    'vibe-friends-laughing-golden',
    'vibe-friends-park-social',
    'vibe-friends-patio-dining',
    'vibe-cafe-coffee-culture'
  ]),
  DATE: new Set([
    'date-couple-candid-outdoors',
    'date-couple-walking-holding-hands',
    'date-couple-laughing-close'
  ])
};

function connectionPool(mode, input, activity='') {
  let pool=[...input].filter(p=>!HARD_BLOCKED_IDS.has(p.id));
  const sceneText = p => `${p.scene||''} ${(p.activities||[]).join(' ')}`;

  if (mode==='TRAIN') {
    const social=pool.filter(p=>/partners|doubles|runners|cyclists|group|together|class|training partners|players competing together/i.test(sceneText(p)));
    if (social.length) pool=social;
  }

  if (mode==='VIBE') {
    const peopleFirst=pool.filter(p=>/friends|group|socializing|laughing|chatting|clinking|celebrating|shoulder to shoulder/i.test(sceneText(p)));
    if (peopleFirst.length) pool=peopleFirst;
    if (activity==='hiking') {
      const closeSocial=pool.filter(p=>/friends|group/i.test(sceneText(p)) && !/toward scenic alpine peak|backpacks.*peak/i.test(sceneText(p)));
      if (closeSocial.length) pool=closeSocial;
    }
  }

  if (mode==='DATE') {
    const coupleOnly=pool.filter(p=>/couple|romantic|holding hands|close embrace|chemistry/i.test(sceneText(p)));
    if (coupleOnly.length) pool=coupleOnly;
  }

  const preferredIds = PREMIUM_PREFERRED_IDS[mode];
  if (preferredIds?.size) {
    const preferred = pool.filter((p) => preferredIds.has(p.id));
    if (preferred.length) pool = preferred;
  }

  return pool;
}

export function selectStockPhoto({ mode, contentId='', isoDate='', activity='', recentEntries=[] }={}) {
  const m=String(mode||'TRAIN').toUpperCase();
  const act=String(activity||'').toLowerCase().trim();
  let pool=connectionPool(m, stockPhotosForMode(m), act);

  if (act) {
    const actTokens=act.split(/[\s,/_]+/).filter(Boolean);
    if (m==='DATE' && (act==='lifestyle'||actTokens.includes('active'))) {
      const preferred=pool.filter(p=>{const tags=(p.activities||[]).map(a=>a.toLowerCase()); const scene=(p.scene||'').toLowerCase(); return (tags.includes('lifestyle')||tags.includes('active')||tags.includes('outdoor')) && /couple|holding hands|romantic|chemistry/i.test(scene);});
      if (preferred.length) pool=preferred;
    } else {
      const matched=pool.filter(p=>{const acts=(p.activities||[]).map(a=>a.toLowerCase()); const scene=(p.scene||'').toLowerCase(); return actTokens.some(t=>acts.includes(t)||scene.includes(t));});
      if (matched.length) pool=matched;
    }
  }

  if (m==='VIBE') pool=pool.filter(p=>{const text=`${p.scene||''} ${(p.activities||[]).join(' ')}`.toLowerCase(); return !PROHIBITED_VIBE_KEYWORDS.some(b=>text.includes(b));});
  if (!pool.length) pool=connectionPool(m, stockPhotosForMode(m), act);
  if (!pool.length) throw new Error(`no_connection_photo_for_mode:${m}:${act}`);

  const usedIds=new Set((recentEntries||[]).map(e=>e.stockPhotoId||'').filter(Boolean));
  const seed=hashSeed(`${isoDate}:${contentId}:${m}:${act}`);
  const sorted=[...pool].sort((a,b)=>a.id.localeCompare(b.id));
  const fresh=sorted.filter(p=>!usedIds.has(p.id));
  const candidates=fresh.length?fresh:sorted;
  for (let offset=0;offset<candidates.length;offset++) {
    const photo=candidates[(seed+offset*17)%candidates.length];
    const visualUsed=(recentEntries||[]).some(e=>String(e.stockPhotoId||'')===photo.id||String(e.visualConcept||'')===photo.scene);
    if (!visualUsed||offset===candidates.length-1) return {...photo,url:unsplashCropUrl(photo.unsplashId)};
  }
  const fallback=candidates[seed%candidates.length];
  return {...fallback,url:unsplashCropUrl(fallback.unsplashId)};
}

export async function fetchStockPhotoBuffer(photo,{fetchImpl=globalThis.fetch,timeoutMs=20000}={}) {
  const url=photo?.url||unsplashCropUrl(photo?.unsplashId); const controller=typeof AbortController!=='undefined'?new AbortController():null; const timer=controller?setTimeout(()=>controller.abort(),timeoutMs):null;
  try { const res=await fetchImpl(url,controller?{signal:controller.signal}:{}); if(!res.ok)return{ok:false,error:`stock_fetch_${res.status}`,url}; const buffer=Buffer.from(await res.arrayBuffer()); return{ok:true,buffer,url,photoId:photo?.id||'',modelId:'unsplash_stock'}; }
  catch(e){return{ok:false,error:e instanceof Error?e.message:'stock_fetch_failed',url};} finally{if(timer)clearTimeout(timer);}
}

export async function generateStockPhoto(concept,{isoDate,activity,recentEntries=[],sharpImpl,maxAttempts=8,fetchImpl}={}) {
  let lastError='unknown'; const resolvedActivity=activity||concept?.semanticActivity||'';
  for(let attempt=0;attempt<maxAttempts;attempt++){
    let photo;
    try { photo=selectStockPhoto({mode:concept.mode,contentId:`${concept.contentId}:${attempt}`,isoDate:`${isoDate}:${attempt}`,activity:resolvedActivity,recentEntries}); }
    catch(e) { lastError=e instanceof Error?e.message:String(e); break; }
    const fetched=await fetchStockPhotoBuffer(photo,{fetchImpl}); if(!fetched.ok){lastError=fetched.error;continue;}
    const quality=await assessPhotoQuality(fetched.buffer,sharpImpl); if(!quality.ok){lastError=quality.reason;continue;}
    return{ok:true,buffer:fetched.buffer,modelId:'unsplash_stock',stockPhotoId:photo.id,sourceUrl:fetched.url,scene:photo.scene,seed:hashSeed(`${isoDate}:${concept.contentId}:${photo.id}`),quality};
  }
  return{ok:false,error:lastError};
}
