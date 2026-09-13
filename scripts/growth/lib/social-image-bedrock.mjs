/**
 * Bedrock Stable Image Core (ACTIVE) — text-to-image in us-west-2.
 * Fallback order: bedrock → procedural gradient (last resort only).
 *
 * CREATIVE NORTH STAR:
 * Every image must feel unmistakably GetTrainMate: active adults + real human
 * connection + an aspirational social setting. TRAIN / VIBE / DATE may rotate,
 * but the brand must never look like three unrelated apps.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const STABLE_IMAGE_CORE_MODEL_ID = process.env.SOCIAL_IMAGE_BEDROCK_MODEL_ID || 'stability.stable-image-core-v1:1';
export const BEDROCK_IMAGE_REGION = process.env.SOCIAL_IMAGE_BEDROCK_REGION || 'us-west-2';

export const DEFAULT_NEGATIVE_PROMPT = [
  'minors','teenagers','children','nudity','explicit sexual activity','distorted anatomy','malformed hands','extra fingers','extra arms','duplicated people','distorted faces','plastic skin','cartoon','illustration','anime','fake text','watermark','random logo','stock photo handshake pose','empty gradient background','text card design','corporate clipart','blurry faces','deformed limbs','uncanny valley','lonely isolated person','generic running silhouette','anonymous distant hikers','people too small in frame','faces hidden in shadow','cold impersonal stock photography','laptops','computer screens','office desks','office meetings','coworking space','business meetings','conference rooms','people working on laptops','people studying with textbooks','corporate networking','business suits'
].join(', ');

const BRAND_CORE =
  'GetTrainMate brand feeling: TRAIN • VIBE • DATE — active lifestyle, friendship, chemistry, community and real human connection. ' +
  'The image must immediately communicate people doing something enjoyable together, not a generic fitness stock photo. ' +
  'Premium aspirational lifestyle advertising, energetic but authentic, diverse adults, natural expressions, realistic skin and anatomy. ';

export function buildPhotographyPrompt(concept) {
  const mode=String(concept?.mode||'TRAIN').toUpperCase();
  const activity=concept?.photoPrompt||concept?.visualConcept||(mode==='VIBE'?'attractive adult friends sharing an active social experience at golden hour, laughing together after an activity':mode==='DATE'?'fit attractive adult couple sharing a playful active date, warm chemistry and genuine mutual attraction':'two fit adult workout partners training side by side and encouraging each other');

  if(mode==='VIBE') return (
    'Premium photorealistic commercial lifestyle campaign. '+BRAND_CORE+
    `Scene: ${activity}. `+
    'Show 2–4 clearly identifiable adults approximately 25–45 years old as large hero subjects, interacting with each other. This must read as a real social activity, not anonymous tourism. '+
    'Blend activity and social connection: rooftop after-workout hangout, outdoor fitness meetup, pickleball social, hiking overlook, coffee after training, or lively community event. '+
    'Stylish athletic-casual clothing, genuine laughter, eye contact, candid friendship, sophisticated modern environment. '+
    'The scene must be completely free of laptops, computer screens, office desks, coworking spaces, business meetings, conference rooms, and corporate networking. '+
    'Cinematic golden-hour or premium venue lighting, dynamic composition, shallow depth of field. Do not make this look like anonymous tourism or generic hikers; faces and connection must be obvious. '+
    'Leave clean natural negative space near the bottom for a short branded headline/CTA overlay. No text, no logo, no watermark.'
  );

  if(mode==='DATE') return (
    'Premium photorealistic commercial active-lifestyle dating campaign. '+BRAND_CORE+
    `Scene: ${activity}. `+
    'Show one attractive adult man and one attractive adult woman approximately 25–45 years old as large hero subjects. '+
    'They should look active and compatible: workout-to-coffee date, sunset walk after training, pickleball date, scenic hike break, or upscale fitness-social setting. '+
    'Natural romantic chemistry, mutual eye contact, playful flirty smiles, affectionate but tasteful body language. '+
    'Stylish premium athletic or smart-casual clothing, cinematic golden-hour/evening light, sophisticated surroundings, realistic anatomy. '+
    'The image must communicate both active lifestyle AND connection; avoid a generic dating-app portrait with no fitness/social context. '+
    'Leave clean natural negative space near the bottom for a short branded headline/CTA overlay. No text, no logo, no watermark.'
  );

  return (
    'Premium photorealistic commercial sports and lifestyle photography campaign. '+BRAND_CORE+
    `Scene: ${activity}. `+
    'Show exactly two or a small group of athletic adults approximately 25–45 years old training together as large hero subjects. '+
    'The partnership is the story: visible encouragement, eye contact, teamwork, smiles, spotting, pacing, partner drills, post-workout high-five, or shared effort. '+
    'Modern premium sportswear, natural athletic physiques, realistic skin texture and anatomy, professional sports and lifestyle photography. '+
    'Cinematic lighting, dynamic action, sophisticated gym or outdoor fitness environment, shallow depth of field. Never show a lone anonymous athlete or generic running silhouettes; the social connection must be obvious. '+
    'Leave clean natural negative space near the bottom for a short branded headline/CTA overlay. No text, no logo, no watermark.'
  );
}

function writeTempJson(obj){const file=path.join(os.tmpdir(),`gtm-stable-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);fs.writeFileSync(file,JSON.stringify(obj));return file;}
export function invokeStableImageCore({prompt,negativePrompt=DEFAULT_NEGATIVE_PROMPT,aspectRatio='4:5',seed=0,outputFormat='jpeg',region=BEDROCK_IMAGE_REGION,modelId=STABLE_IMAGE_CORE_MODEL_ID}={}){const body={prompt,negative_prompt:negativePrompt,aspect_ratio:aspectRatio,seed,output_format:outputFormat};const reqFile=writeTempJson(body);const outFile=path.join(os.tmpdir(),`gtm-stable-out-${Date.now()}.json`);try{const r=spawnSync('aws',['bedrock-runtime','invoke-model','--model-id',modelId,'--content-type','application/json','--accept','application/json','--body',`fileb://${reqFile}`,'--cli-binary-format','raw-in-base64-out',outFile,'--region',region],{encoding:'utf8',stdio:'pipe',maxBuffer:20*1024*1024});if(r.status!==0)return{ok:false,error:(r.stderr||r.stdout||'bedrock invoke failed').slice(0,500),modelId};const parsed=JSON.parse(fs.readFileSync(outFile,'utf8'));if(parsed.error)return{ok:false,error:String(parsed.error),modelId};const finishReason=parsed.finish_reasons?.[0];if(finishReason&&finishReason!=='SUCCESS')return{ok:false,error:`stable_image_${finishReason.toLowerCase()}`,modelId};const b64=parsed.images?.[0];if(!b64)return{ok:false,error:'stable_image_no_images',modelId};return{ok:true,buffer:Buffer.from(b64,'base64'),modelId,seed:parsed.seeds?.[0]??seed,aspectRatio};}finally{for(const f of[reqFile,outFile]){try{fs.unlinkSync(f);}catch{}}}}
export async function assessPhotoQuality(buffer,sharpImpl){const sharp=sharpImpl||(await import('sharp')).default;if(!buffer||buffer.length<40000)return{ok:false,reason:'file_too_small',bytes:buffer?.length||0};const img=sharp(buffer);const meta=await img.metadata();if(!meta.width||!meta.height||meta.width<512||meta.height<512)return{ok:false,reason:'resolution_too_low',meta};const stats=await img.stats();const channels=stats.channels||[];const avgStdev=channels.reduce((sum,c)=>sum+(c.stdev||0),0)/Math.max(channels.length,1);const avgMean=channels.reduce((sum,c)=>sum+(c.mean||0),0)/Math.max(channels.length,1);if(avgStdev<18)return{ok:false,reason:'flat_or_empty_background',avgStdev,avgMean};if(avgMean>185)return{ok:false,reason:'overexposed_washed_out',avgStdev,avgMean};if(avgMean<28)return{ok:false,reason:'underexposed',avgStdev,avgMean};return{ok:true,bytes:buffer.length,avgStdev,avgMean,meta};}
export async function generateBedrockPhoto(concept,{seed,sharpImpl,maxAttempts=2}={}){const baseSeed=seed??concept.backgroundSeed??42;let lastError='unknown';for(let attempt=0;attempt<maxAttempts;attempt++){const attemptSeed=baseSeed+attempt*7919;const prompt=buildPhotographyPrompt(concept);const invoked=invokeStableImageCore({prompt,seed:attemptSeed%4294967295,aspectRatio:'4:5',outputFormat:'jpeg'});if(!invoked.ok){lastError=invoked.error;continue;}const quality=await assessPhotoQuality(invoked.buffer,sharpImpl);if(!quality.ok){lastError=quality.reason;continue;}return{ok:true,buffer:invoked.buffer,modelId:invoked.modelId,seed:attemptSeed,prompt,quality};}return{ok:false,error:lastError};}
