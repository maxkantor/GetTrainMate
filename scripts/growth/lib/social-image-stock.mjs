/**
 * Free stock photography for owned social — curated Unsplash only.
 * HARD RULE: the image must visibly communicate human connection, not generic activity.
 */
import { assessPhotoQuality } from './social-image-bedrock.mjs';
import {
  PROHIBITED_VIBE_KEYWORDS,
  allStockPhotos,
  stockPhotosForMode,
  unsplashCropUrl
} from './social-image-stock-library.mjs';
import { assessCreativeProductFit } from './social-creative-quality.mjs';

function hashSeed(input) { let h=2166136261; for (let i=0;i<input.length;i++){ h^=input.charCodeAt(i); h=Math.imul(h,16777619); } return Math.abs(h); }

const HARD_BLOCKED_IDS = new Set([
  'vibe-hiking-mountain-trail',
  'vibe-friends-street-chat',
  'vibe-friends-coastal-scenery',
  'vibe-friends-park-social', // purged: photo-1517486808906
  'vibe-cafe-coffee-culture', // purged: photo-1525610553991
  'date-couple-cafe-social', // purged: same cafe stock
  // Solo tennis action remains blocked; partner tennis stock is allowed.
  'train-tennis-court-action',
  'train-gym-strength-lifting',
  'date-cocktails-cheers-date',
  'date-wine-celebration-toast',
  // Sep 15 regressions: restaurant crowd + cocktail/nightlife without TRAIN context
  'vibe-friends-patio-dining',
  'vibe-cocktail-toast-night',
  'vibe-wine-celebration-toast'
]);

const PREMIUM_PREFERRED_IDS = {
  TRAIN: new Set([
    'train-gym-partners-goals',
    'train-pickleball-match',
    'train-pickleball-doubles',
    'train-tennis-partners-talk',
    'train-running-outdoor-group',
    'train-cycling-road-partners',
    'train-functional-gym-class'
  ]),
  VIBE: new Set([
    'vibe-friends-rooftop-sunset',
    'vibe-friends-laughing-golden',
    'vibe-outdoor-hilltop-friends'
  ]),
  DATE: new Set([
    'date-couple-candid-outdoors',
    'date-couple-walking-holding-hands',
    'date-couple-laughing-close'
  ])
};

/** Map journey-standard sport ids onto stock activity tags. */
const ACTIVITY_ALIASES = {
  tennis: ['tennis', 'pickleball', 'court', 'racket', 'racquet'],
  pickleball: ['pickleball', 'tennis', 'court'],
  padel: ['pickleball', 'tennis', 'court'],
  running: ['running', 'run', 'cardio', 'workout'],
  cycling: ['cycling', 'bike', 'workout'],
  // No dedicated triathlon stock yet — map to real bike/run partner photos.
  // Keep tokens sport-specific (avoid bare "workout" matching generic VIBE hangouts).
  triathlon: ['cycling', 'bike', 'running', 'cardio'],
  swimming: ['swimming', 'swim', 'pool'],
  gym: ['gym', 'workout', 'fitness', 'partner'],
  functional: ['functional', 'gym', 'workout'],
  hyrox: ['functional', 'gym', 'workout'],
  hiking: ['hiking', 'outdoors', 'trail', 'nature'],
  soccer: ['soccer', 'sports', 'partner'],
  volleyball: ['volleyball', 'sports', 'partner'],
  basketball: ['sports', 'partner', 'workout']
};

function connectionPool(mode, input, activity='') {
  let pool=[...input].filter(p=>!HARD_BLOCKED_IDS.has(p.id));
  const sceneText = p => `${p.scene||''} ${(p.activities||[]).join(' ')}`;

  if (mode==='TRAIN') {
    const social=pool.filter(p=>/partners|doubles|runners|cyclists|group|together|class|training partners|players competing together|walking from|after playing/i.test(sceneText(p)));
    if (social.length) pool=social;
  }

  if (mode==='VIBE') {
    const peopleFirst=pool.filter(p=>/friends|group|socializing|laughing|chatting|clinking|celebrating|shoulder to shoulder|partners?|together|walking/i.test(sceneText(p)));
    if (peopleFirst.length) pool=peopleFirst;
    if (activity==='hiking') {
      const closeSocial=pool.filter(p=>/friends|group/i.test(sceneText(p)) && !/toward scenic alpine peak|backpacks.*peak/i.test(sceneText(p)));
      if (closeSocial.length) pool=closeSocial;
    }
  }

  // DATE can use athletic partner imagery from the sport library when chemistry is present.
  if (mode==='DATE') {
    const coupleOrPartners=pool.filter(p=>/couple|romantic|holding hands|close embrace|chemistry|partners?|together|man and woman|walking from|after playing/i.test(sceneText(p)));
    if (coupleOrPartners.length) pool=coupleOrPartners;
  }

  return pool;
}

function activityTokens(activity='') {
  const act=String(activity||'').toLowerCase().trim();
  if (!act) return [];
  const base=act.split(/[\s,/_]+/).filter(Boolean);
  const aliases=ACTIVITY_ALIASES[act] || [];
  return [...new Set([...base, ...aliases])];
}

function photosMatchingActivity(pool, actTokens, preferredAct = '') {
  const matched = pool.filter((p) => {
    const acts = (p.activities || []).map((a) => a.toLowerCase());
    const scene = (p.scene || '').toLowerCase();
    return actTokens.some((t) => acts.includes(t) || scene.includes(t));
  });
  // Prefer exact sport tag (pickleball) over alias cousins (tennis).
  if (preferredAct) {
    const exact = matched.filter((p) => {
      const acts = (p.activities || []).map((a) => a.toLowerCase());
      const scene = (p.scene || '').toLowerCase();
      return acts.includes(preferredAct) || scene.includes(preferredAct);
    });
    if (exact.length) return exact;
  }
  return matched;
}

export function selectStockPhoto({ mode, contentId='', isoDate='', activity='', recentEntries=[] }={}) {
  const m=String(mode||'TRAIN').toUpperCase();
  const act=String(activity||'').toLowerCase().trim();
  const actTokens=activityTokens(act);
  let pool=connectionPool(m, stockPhotosForMode(m), act);

  if (actTokens.length) {
    if (m==='DATE' && (act==='lifestyle'||actTokens.includes('active')) && !ACTIVITY_ALIASES[act]) {
      const preferred=pool.filter(p=>{const tags=(p.activities||[]).map(a=>a.toLowerCase()); const scene=(p.scene||'').toLowerCase(); return (tags.includes('lifestyle')||tags.includes('active')||tags.includes('outdoor')) && /couple|holding hands|romantic|chemistry/i.test(scene);});
      if (preferred.length) pool=preferred;
    } else {
      let matched=photosMatchingActivity(pool, actTokens, act);
      // Sport lives in TRAIN library — allow DATE/VIBE posts to reuse matching sport stock.
      if (!matched.length) {
        const crossMode = connectionPool(m, allStockPhotos(), act);
        matched = photosMatchingActivity(crossMode, actTokens, act);
      }
      if (matched.length) {
        pool=matched;
      } else if (String(activity || '').trim() && String(contentId || '').trim()) {
        // Under the permanent journey standard, unrelated stock is not a
        // fallback. A swimming concept cannot silently become a generic couple.
        return null;
      }
    }
  } else {
    const preferredIds = PREMIUM_PREFERRED_IDS[m];
    if (preferredIds?.size) {
      const preferred = pool.filter((p) => preferredIds.has(p.id));
      if (preferred.length) pool = preferred;
    }
  }

  if (m==='VIBE') pool=pool.filter(p=>{
    const text=`${p.scene||''} ${(p.activities||[]).join(' ')}`.toLowerCase();
    // Word-boundary for "working" so "workout" stock is not false-positive blocked.
    return !PROHIBITED_VIBE_KEYWORDS.some((b) => {
      if (b === 'working') return /\bworking\b/.test(text);
      return text.includes(b);
    });
  });
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
  if (!photo) return { ok:false,error:'no_activity_matched_stock',url:'' };
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
    // Evaluate the photograph we actually fetched. The generated concept prompt
    // can contain exclusion wording or describe a different sport when no exact
    // stock match exists; neither is evidence about this photo.
    const fit=assessCreativeProductFit({
      mode: concept.mode,
      stockPhotoId: photo.id,
      scene: photo.scene
    });
    if(!fit.ok){lastError=fit.reason; continue;}
    return{ok:true,buffer:fetched.buffer,modelId:'unsplash_stock',stockPhotoId:photo.id,sourceUrl:fetched.url,scene:photo.scene,seed:hashSeed(`${isoDate}:${concept.contentId}:${photo.id}`),quality};
  }
  return{ok:false,error:lastError};
}
