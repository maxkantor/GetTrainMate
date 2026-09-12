import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  MenuItem,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { adminApiService } from '@/services/adminApiService';
import { INITIAL_MARKET_CANDIDATES, MAX_ACTIVE_MARKETS, partnerInvitePath, slugPart } from '@/data/markets';

type Prospect = {
  prospectId: string; organizationName: string; organizationType: string; email: string; emailSource: string;
  metro: string; city?: string; country?: string; campaignLanguage?: string; mode?: string; activity: string;
  partnerCode?: string; landingUrl?: string; status: string; website?: string; sourceUrl?: string; fitScore?: number;
};
type QueueItem = { queueId: string; organizationName: string; recipient: string; subject: string; bodyText: string; status: string; partnerUrl: string; };
type Campaign = { campaignId: string; displayName?: string; name?: string; country: string; market: string; status: string; primaryMode?: string; languages?: string[]; };
type DiscoveryReport = { organizationsDiscovered?: number; qualifiedOrganizations?: number; verifiedPublicContacts?: number; draftsGenerated?: number; approvalReadyRecipients?: number; contactsUnavailable?: number; skippedDuplicate?: number; markets?: Array<{ displayName?: string; organizationsDiscovered?: number; qualifiedOrganizations?: number; verifiedPublicContacts?: number; contactsUnavailable?: number; draftsGenerated?: number; skippedDuplicate?: number; errors?: number; }>; };

const TABS = ['prospect','discovered','no_verified_public_email','qualified_language_unavailable','draft','approved','queued','sent','replied','opted_out','bounced','complained'];
const LABELS: Record<string,string> = {
  prospect: 'Ready', discovered: 'Discovered', no_verified_public_email: 'No public email', qualified_language_unavailable: 'Language blocked',
  draft: 'Needs approval', approved: 'Approved', queued: 'Queued', sent: 'Sent', replied: 'Replied', opted_out: 'Opted out', bounced: 'Bounced', complained: 'Complained'
};
const PROSPECT_STATUS_RANK: Record<string,number> = { replied: 80, sent: 70, queued: 60, approved: 50, draft: 40, prospect: 30, discovered: 20, no_verified_public_email: 10 };
const QUEUE_STATUS_RANK: Record<string,number> = { replied: 80, sent: 70, queued: 60, approved: 50, draft: 40 };

function dedupeProspects(items: Prospect[]) {
  const map = new Map<string,Prospect>();
  for (const p of items) {
    const key = (p.email?.toLowerCase() || p.partnerCode?.toLowerCase() || p.organizationName?.toLowerCase() || p.prospectId).trim();
    const prev = map.get(key);
    if (!prev || (PROSPECT_STATUS_RANK[p.status] ?? 0) > (PROSPECT_STATUS_RANK[prev.status] ?? 0)) map.set(key,p);
  }
  return [...map.values()];
}
function dedupeQueue(items: QueueItem[]) {
  const map = new Map<string,QueueItem>();
  for (const q of items) {
    const key = (q.recipient?.toLowerCase() || q.organizationName?.toLowerCase() || q.queueId).trim();
    const prev = map.get(key);
    if (!prev || (QUEUE_STATUS_RANK[q.status] ?? 0) > (QUEUE_STATUS_RANK[prev.status] ?? 0)) map.set(key,q);
  }
  return [...map.values()];
}
function MetricCard({ label, value, note, attention=false }: { label:string; value:unknown; note?:string; attention?:boolean }) {
  return <Box sx={{ p:1.5, border:'1px solid', borderColor: attention ? 'warning.main' : 'divider', borderRadius:2, minWidth:145, flex:'1 1 145px' }}>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography variant="h5" sx={{ fontWeight:800, lineHeight:1.2 }}>{String(value ?? 0)}</Typography>
    {note && <Typography variant="caption" color="text.secondary">{note}</Typography>}
  </Box>;
}

export const PartnerOutreachPage: React.FC = () => {
  const [tab,setTab] = useState(0);
  const [prospects,setProspects] = useState<Prospect[]>([]);
  const [queue,setQueue] = useState<QueueItem[]>([]);
  const [campaigns,setCampaigns] = useState<Campaign[]>([]);
  const [metrics,setMetrics] = useState<Record<string,unknown>|null>(null);
  const [discoverySummary,setDiscoverySummary] = useState<Record<string,unknown>|null>(null);
  const [error,setError] = useState<string|null>(null);
  const [notice,setNotice] = useState<string|null>(null);
  const [discovering,setDiscovering] = useState(false);
  const [discoverProgress,setDiscoverProgress] = useState(0);
  const [discoverStage,setDiscoverStage] = useState<string|null>(null);
  const [deduping,setDeduping] = useState(false);
  const [approveItem,setApproveItem] = useState<QueueItem|null>(null);
  const [showManual,setShowManual] = useState(false);
  const [form,setForm] = useState({ organizationName:'', organizationType:'run_club', email:'', emailSource:'public_listing', website:'', sourceUrl:'', partnerCode:'', landingUrl:'', activity:'training', country:'us', city:'', campaignLanguage:'en', mode:'TRAIN' });

  const load = async () => {
    setError(null);
    try {
      const [p,q,m,c,d] = await Promise.all([
        adminApiService.get('/api/admin/partner-outreach/prospects'), adminApiService.get('/api/admin/partner-outreach/queue'),
        adminApiService.get('/api/admin/partner-outreach/metrics'), adminApiService.get('/api/admin/partner-outreach/campaigns'),
        adminApiService.get('/api/admin/partner-outreach/discovery/summary')
      ]);
      setProspects(Array.isArray(p)?p:p?.items??[]); setQueue(Array.isArray(q)?q:q?.items??[]); setMetrics(m); setDiscoverySummary(d);
      setCampaigns(Array.isArray(c)?c:c?.items??INITIAL_MARKET_CANDIDATES);
    } catch(e:unknown) { setError(e instanceof Error?e.message:'Failed to load partner outreach'); }
  };
  useEffect(()=>{ void load(); },[]);

  const uniqueProspects = useMemo(()=>dedupeProspects(prospects),[prospects]);
  const uniqueQueue = useMemo(()=>dedupeQueue(queue),[queue]);
  const status = TABS[tab];
  const shownProspects = uniqueProspects.filter(p => status==='prospect' ? p.status==='prospect'||p.status==='draft' : p.status===status);
  const shownQueue = uniqueQueue.filter(q => status==='prospect'||status==='discovered' ? true : q.status===status);
  const draftCount = uniqueQueue.filter(q=>q.status==='draft').length;
  const approvedCount = uniqueQueue.filter(q=>q.status==='approved').length;
  const noEmailCount = uniqueProspects.filter(p=>p.status==='no_verified_public_email').length;
  const sendEnabled = Boolean(metrics?.sendEnabled);

  const runAutomatedDiscovery = async (onlyCampaignId?:string) => {
    setError(null); setNotice(null); setDiscovering(true); setDiscoverProgress(15);
    setDiscoverStage(onlyCampaignId ? 'Discovering organizations across this market…' : 'Discovering organizations across active markets…');
    try {
      // IMPORTANT: this is intentionally full discovery. The old UI used seedsOnly=true and repeatedly rechecked
      // the same small seed catalog, which is why runs often reported Created: 0.
      const res:DiscoveryReport = await adminApiService.post('/api/admin/partner-outreach/discover/automated', {
        prepareDrafts:true, maxPerMarket:40, seedsOnly:false, ...(onlyCampaignId ? { onlyCampaignId } : {})
      });
      setDiscoverProgress(85); setDiscoverStage('Refreshing pipeline…'); await load(); setDiscoverProgress(100);
      const markets = Array.isArray(res?.markets) ? res.markets : [];
      const dupes = markets.reduce((n,m)=>n+(m.skippedDuplicate??0),0);
      setNotice(`Discovery finished: ${res.organizationsDiscovered??0} new organizations, ${res.verifiedPublicContacts??0} verified public contacts, ${res.draftsGenerated??0} drafts, ${res.contactsUnavailable??0} without a verified public email${dupes ? `, ${dupes} duplicates skipped` : ''}.`);
    } catch(e:unknown) { setError(e instanceof Error?e.message:'Full market discovery failed'); }
    finally { setDiscovering(false); setDiscoverStage(null); setTimeout(()=>setDiscoverProgress(0),500); }
  };

  const setStatus = async (campaignId:string,next:string) => {
    setError(null); try { await adminApiService.post(`/api/admin/partner-outreach/campaigns/${encodeURIComponent(campaignId)}/status`,{status:next}); await load(); }
    catch(e:unknown){ setError(e instanceof Error?e.message:'Could not update campaign'); }
  };

  return <Box sx={{ maxWidth:1500 }}>
    <Box sx={{ display:'flex', justifyContent:'space-between', gap:2, flexWrap:'wrap', alignItems:'flex-start', mb:2 }}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight:800 }}>Partner Outreach</Typography>
        <Typography variant="body2" color="text.secondary">Find fitness/community partners → verify public business contacts → prepare personalized drafts → approve → send → measure replies.</Typography>
      </Box>
      <Box sx={{ display:'flex', gap:1 }}>
        <Button variant="outlined" onClick={()=>void load()}>Refresh</Button>
        <Button variant="contained" disabled={discovering} onClick={()=>void runAutomatedDiscovery()}>{discovering?'Discovering…':'Discover new partners'}</Button>
      </Box>
    </Box>

    {error && <Alert severity="error" sx={{mb:2}}>{error}</Alert>}
    {notice && <Alert severity="success" sx={{mb:2}} onClose={()=>setNotice(null)}>{notice}</Alert>}
    {!sendEnabled && approvedCount>0 && <Alert severity="warning" sx={{mb:2}}><b>{approvedCount} approved message{approvedCount===1?' is':'s are'} waiting.</b> Sending is currently disabled, so approval alone cannot produce outreach. Keep the safety gate, but enable partner sending in the deployed API configuration when you are ready to dispatch approved recipients.</Alert>}
    {sendEnabled && <Alert severity="success" sx={{mb:2}}>Sending is enabled. Only individually approved recipients can be dispatched, subject to the existing daily limit and safety gates.</Alert>}

    <Box sx={{ display:'flex', gap:1, flexWrap:'wrap', mb:2 }}>
      <MetricCard label="Discovered" value={discoverySummary?.organizationsDiscovered ?? uniqueProspects.length} note="organizations" />
      <MetricCard label="Verified contacts" value={discoverySummary?.verifiedPublicContacts ?? uniqueProspects.filter(p=>!!p.email).length} note="public business emails" />
      <MetricCard label="No public email" value={discoverySummary?.contactsUnavailable ?? noEmailCount} note="needs another source" attention={noEmailCount>0} />
      <MetricCard label="Needs approval" value={draftCount} note="review drafts" attention={draftCount>0} />
      <MetricCard label="Approved" value={metrics?.approvedRecipients ?? approvedCount} note={sendEnabled?'ready to dispatch':'blocked by send gate'} attention={!sendEnabled&&approvedCount>0} />
      <MetricCard label="Sent" value={metrics?.sent ?? 0} note="messages" />
      <MetricCard label="Replies" value={metrics?.replies ?? 0} note="partner responses" />
    </Box>

    {discovering && <Box sx={{mb:2}}><Box sx={{display:'flex',justifyContent:'space-between'}}><Typography variant="body2">{discoverStage}</Typography><Typography variant="caption">{discoverProgress}%</Typography></Box><LinearProgress variant="determinate" value={discoverProgress} sx={{height:8,borderRadius:1,mt:.5}}/></Box>}

    <Box sx={{ p:2, border:'1px solid', borderColor:'divider', borderRadius:2, mb:2 }}>
      <Typography variant="h6" sx={{fontWeight:700,mb:.5}}>What needs attention</Typography>
      <Box sx={{display:'flex',gap:1,flexWrap:'wrap'}}>
        <Button variant={draftCount?'contained':'outlined'} disabled={!draftCount} onClick={()=>setTab(TABS.indexOf('draft'))}>Review {draftCount} draft{draftCount===1?'':'s'}</Button>
        <Button variant="outlined" disabled={!noEmailCount} onClick={()=>setTab(TABS.indexOf('no_verified_public_email'))}>Inspect {noEmailCount} without email</Button>
        <Button variant="outlined" onClick={()=>setTab(TABS.indexOf('approved'))}>View approved ({approvedCount})</Button>
        <Button variant="text" onClick={()=>setShowManual(v=>!v)}>{showManual?'Hide manual tools':'Manual tools'}</Button>
      </Box>
    </Box>

    <Typography variant="h6" sx={{fontWeight:700,mb:1}}>Markets</Typography>
    <Box sx={{display:'grid',gap:1,mb:3}}>
      {(campaigns.length?campaigns:INITIAL_MARKET_CANDIDATES).map(c=><Box key={c.campaignId} sx={{display:'flex',flexWrap:'wrap',gap:1,alignItems:'center',p:1.25,border:'1px solid',borderColor:'divider',borderRadius:1.5}}>
        <Typography sx={{minWidth:220,fontWeight:700}}>{c.displayName||c.name||c.campaignId}</Typography>
        <Chip size="small" label={c.status}/><Chip size="small" variant="outlined" label={`${c.country}/${c.market}`}/><Chip size="small" variant="outlined" label={c.primaryMode||'TRAIN'}/>
        <Box sx={{flex:1}}/><Button size="small" disabled={discovering} onClick={()=>void runAutomatedDiscovery(c.campaignId)}>Discover new partners</Button>
        {c.status!=='active'&&<Button size="small" onClick={()=>void setStatus(c.campaignId,'active')}>Activate</Button>}
        {c.status==='active'&&<Button size="small" onClick={()=>void setStatus(c.campaignId,'paused')}>Pause</Button>}
      </Box>)}
    </Box>

    <Tabs value={tab} onChange={(_,v)=>setTab(v)} variant="scrollable" sx={{mb:2,borderBottom:'1px solid',borderColor:'divider'}}>
      {TABS.map(t=>{ const count=t==='draft'?draftCount:t==='approved'?approvedCount:t==='no_verified_public_email'?noEmailCount:undefined; return <Tab key={t} label={`${LABELS[t]||t}${count!==undefined?` (${count})`:''}`}/>; })}
    </Tabs>

    {showManual && <Box sx={{p:2,border:'1px solid',borderColor:'divider',borderRadius:2,mb:3}}>
      <Typography variant="subtitle1" sx={{fontWeight:700,mb:1}}>Manual prospect override</Typography>
      <Typography variant="caption" color="text.secondary">Use only when you already have a legitimate organization and public business contact. The automated workflow is primary.</Typography>
      <Box sx={{display:'grid',gap:1,gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',mt:1,mb:1}}>
        <TextField size="small" label="Organization" value={form.organizationName} onChange={e=>setForm({...form,organizationName:e.target.value})}/>
        <TextField size="small" label="Public business email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/>
        <TextField size="small" select label="Email source" value={form.emailSource} onChange={e=>setForm({...form,emailSource:e.target.value})}><MenuItem value="public_listing">public_listing</MenuItem><MenuItem value="owner_supplied">owner_supplied</MenuItem><MenuItem value="prior_engagement">prior_engagement</MenuItem></TextField>
        <TextField size="small" label="Country" value={form.country} onChange={e=>setForm({...form,country:e.target.value})}/>
        <TextField size="small" label="City / metro" value={form.city} onChange={e=>setForm({...form,city:e.target.value})}/>
        <TextField size="small" select label="Language" value={form.campaignLanguage} onChange={e=>setForm({...form,campaignLanguage:e.target.value})}><MenuItem value="en">English</MenuItem><MenuItem value="es">Spanish</MenuItem><MenuItem value="ru">Russian</MenuItem></TextField>
        <TextField size="small" label="Website" value={form.website} onChange={e=>setForm({...form,website:e.target.value})}/>
        <TextField size="small" label="Source URL" value={form.sourceUrl} onChange={e=>setForm({...form,sourceUrl:e.target.value})}/>
        <TextField size="small" label="Partner code" value={form.partnerCode} onChange={e=>setForm({...form,partnerCode:e.target.value})}/>
      </Box>
      <Box sx={{display:'flex',gap:1}}><Button variant="contained" onClick={async()=>{ setError(null); try { const landing=form.landingUrl||(form.partnerCode?`https://gettrainmate.com${partnerInvitePath(form.country,slugPart(form.city)||'market',form.partnerCode)}`:''); await adminApiService.post('/api/admin/partner-outreach/prospects',{...form,metro:form.city,landingUrl:landing}); setNotice('Prospect added.'); await load(); } catch(e:unknown){setError(e instanceof Error?e.message:'Could not add prospect');} }}>Add prospect</Button>
      <Button variant="outlined" disabled={deduping} onClick={async()=>{setDeduping(true);try{const r=await adminApiService.post('/api/admin/partner-outreach/dedupe',{dryRun:false});setNotice(`Removed ${r?.prospectsRemoved??0} duplicate prospects and ${r?.queueRemoved??0} duplicate queue items.`);await load();}catch(e:unknown){setError(e instanceof Error?e.message:'Dedupe failed');}finally{setDeduping(false);}}}>{deduping?'Cleaning…':'Remove duplicates'}</Button></Box>
    </Box>}

    <Typography variant="h6" sx={{fontWeight:700}}>Prospects</Typography>
    {shownProspects.length===0 && <Typography variant="body2" color="text.secondary" sx={{py:2}}>Nothing in this stage.</Typography>}
    {shownProspects.map(p=><Box key={p.prospectId} sx={{display:'flex',gap:1,alignItems:'center',flexWrap:'wrap',py:1.25,borderBottom:'1px solid',borderColor:'divider'}}>
      <Box sx={{minWidth:260,flex:1}}><Typography sx={{fontWeight:600}}>{p.organizationName}</Typography><Typography variant="caption" color="text.secondary">{p.email||'No verified public email'} · {p.country||'?'}/{p.metro||p.city||'?'}{p.fitScore?` · fit ${p.fitScore}`:''}</Typography></Box>
      <Chip size="small" label={LABELS[p.status]||p.status}/>
      {p.website&&<Button size="small" href={p.website} target="_blank">Website</Button>}
      {(p.status==='prospect'||p.status==='draft')&&<Button size="small" disabled={!p.email} onClick={async()=>{try{await adminApiService.post('/api/admin/partner-outreach/drafts',{prospectId:p.prospectId});await load();}catch(e:unknown){setError(e instanceof Error?e.message:'Could not prepare draft');}}}>Prepare draft</Button>}
    </Box>)}

    <Typography variant="h6" sx={{fontWeight:700,mt:3}}>Message queue</Typography>
    {shownQueue.length===0 && <Typography variant="body2" color="text.secondary" sx={{py:2}}>Nothing in this stage.</Typography>}
    {shownQueue.map(q=><Box key={q.queueId} sx={{py:1.25,borderBottom:'1px solid',borderColor:'divider'}}><Box sx={{display:'flex',gap:1,alignItems:'center',flexWrap:'wrap'}}><Typography sx={{fontWeight:600}}>{q.organizationName}</Typography><Typography variant="body2">→ {q.recipient}</Typography><Chip size="small" label={LABELS[q.status]||q.status}/>{q.status==='draft'&&<Button size="small" variant="contained" onClick={()=>setApproveItem(q)}>Review & approve</Button>}</Box><Typography variant="body2" color="text.secondary">{q.subject}</Typography></Box>)}

    <Dialog open={!!approveItem} onClose={()=>setApproveItem(null)} maxWidth="sm" fullWidth><DialogTitle>Review partner message</DialogTitle><DialogContent>{approveItem&&<><Typography sx={{mb:1,fontWeight:700}}>{approveItem.organizationName} / {approveItem.recipient}</Typography><Typography variant="subtitle2">{approveItem.subject}</Typography><Typography variant="body2" sx={{whiteSpace:'pre-wrap',mt:1}}>{approveItem.bodyText}</Typography><Typography variant="caption" display="block" sx={{mt:1}}>{approveItem.partnerUrl}</Typography></>}</DialogContent><DialogActions><Button onClick={()=>setApproveItem(null)}>Cancel</Button><Button variant="contained" onClick={async()=>{if(!approveItem)return;await adminApiService.post(`/api/admin/partner-outreach/queue/${approveItem.queueId}/approve`,{confirm:true});setApproveItem(null);await load();}}>Approve this recipient</Button></DialogActions></Dialog>
  </Box>;
};
