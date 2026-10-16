'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import AuthGate, { useSession } from '@/components/AuthGate';
import { accountAction, clientDb } from '@/lib/firebase-client';
import { Notice } from '@/components/ui';

interface Site { site_id: string; site_name_display?: string; latitude: number; longitude: number; active: boolean }
interface Proposal {
  proposal_id: string; site_id: string; kind: string; status: string; submitted_by_uid: string;
  submitted_by_display_name?: string; reason: string; proposed_site_name?: string;
  proposed_coordinates: { latitude: number; longitude: number };
  original_coordinates: { latitude: number; longitude: number } | null; decision_reason?: string;
}
function Locations() {
  const { user, role } = useSession();
  const reviewer = ['QC_REVIEWER', 'ADMIN'].includes(role);
  const [sites, setSites] = useState<Site[]>([]);
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [kind, setKind] = useState('COORDINATE_CORRECTION');
  const [siteId, setSiteId] = useState('');
  const [name, setName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [accuracy, setAccuracy] = useState('');
  const [reason, setReason] = useState('');
  const [decisionReason, setDecisionReason] = useState('');
  const [siteCode, setSiteCode] = useState('');
  const [approvedName, setApprovedName] = useState('');
  const [tolerance, setTolerance] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const attempt = useRef<{ id: string; body: string } | null>(null);
  useEffect(() => {
    const stopSites = onSnapshot(collection(clientDb(), 'siteCatalog'), snapshot => setSites(snapshot.docs.map(document => ({ ...document.data(), site_id: document.id }) as Site)), () => setError('The approved site catalog could not be loaded.'));
    const source = collection(clientDb(), 'siteCoordinateProposals');
    const stopProposals = onSnapshot(reviewer ? source : query(source, where('submitted_by_uid', '==', user.uid)), snapshot => setProposals(snapshot.docs.map(document => document.data() as Proposal)), () => setError('Coordinate proposals could not be loaded.'));
    return () => { stopSites(); stopProposals(); };
  }, [user.uid, reviewer]);
  async function perform(action: () => Promise<void>) {
    setBusy(true); setError(''); setMessage('');
    try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'The coordinate action could not be completed.'); }
    finally { setBusy(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const data = { kind, ...(kind === 'NEW_SITE' ? { proposedSiteName: name } : { siteId }), latitude: Number(latitude), longitude: Number(longitude), gpsAccuracyM: accuracy.trim() ? Number(accuracy) : null, reason };
    const body = JSON.stringify(data);
    if (!attempt.current || attempt.current.body !== body) attempt.current = { id: crypto.randomUUID(), body };
    await perform(async () => {
      await accountAction('proposeSiteCoordinates', { ...data, proposalId: attempt.current!.id });
      attempt.current = null; setReason(''); setMessage('Coordinate proposal saved. Approved site coordinates remain unchanged until a separate reviewer approves it.');
    });
  }
  async function decide(proposal: Proposal, status: string) {
    await perform(async () => {
      await accountAction('decideSiteCoordinates', {
        proposalId: proposal.proposal_id, status, reason: decisionReason,
        ...(proposal.kind === 'NEW_SITE' && status === 'APPROVED' ? { siteName: approvedName, siteCode, siteToleranceM: Number(tolerance) } : {}),
      });
      setMessage('Coordinate decision saved with its audit history.'); setDecisionReason('');
    });
  }
  const current = sites.find(site => site.site_id === siteId);
  return <main className="record-inner" style={{ maxWidth: 1000, margin: '0 auto', overflow: 'auto' }}>
    <h1>Site location proposals</h1><p><a href="/my-observations">My observations</a> · <a href="/review">Supervisor workspace</a></p>
    <p className="muted">Propose a new site or a coordinate correction. Approval updates the private authoritative catalog and preserves the original coordinates in the proposal audit.</p>
    {error && <Notice kind="error" role="alert">{error}</Notice>}{message && <p role="status">{message}</p>}
    <section className="panel"><div className="panel-body"><h2>Propose coordinates</h2>
      <p>Use your verified collector profile. <a href="/review">Complete your account profile</a> if needed.</p>
      <form onSubmit={submit} aria-busy={busy}>
        <label className="field"><span className="field-label">Proposal type</span><select value={kind} onChange={event => setKind(event.target.value)}><option value="COORDINATE_CORRECTION">Correct an existing site</option><option value="NEW_SITE">Propose a new site</option></select></label>
        {kind === 'NEW_SITE' ? <label className="field"><span className="field-label">Proposed site name</span><input required minLength={2} value={name} onChange={event => setName(event.target.value)} /></label> : <label className="field"><span className="field-label">Approved site</span><select required value={siteId} onChange={event => setSiteId(event.target.value)}><option value="">Choose a site</option>{sites.filter(site => site.active).map(site => <option key={site.site_id} value={site.site_id}>{site.site_name_display ?? site.site_id}</option>)}</select></label>}
        {kind === 'COORDINATE_CORRECTION' && current && <p>Current approved coordinates: <strong>{current.latitude}, {current.longitude}</strong></p>}
        <label className="field"><span className="field-label">Proposed latitude</span><input required type="number" step="any" min={-90} max={90} value={latitude} onChange={event => setLatitude(event.target.value)} /></label>
        <label className="field"><span className="field-label">Proposed longitude</span><input required type="number" step="any" min={-180} max={180} value={longitude} onChange={event => setLongitude(event.target.value)} /></label>
        <label className="field"><span className="field-label">GPS accuracy in meters (optional)</span><input type="number" step="any" min={0} value={accuracy} onChange={event => setAccuracy(event.target.value)} /></label>
        <label className="field"><span className="field-label">Reason for proposal</span><textarea required minLength={5} maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} /></label>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Submit coordinate proposal'}</button>
      </form>
    </div></section>
    <h2>{reviewer ? 'Coordinate review' : 'My coordinate proposals'}</h2>
    {proposals === null && !error && <p role="status">Loading proposals…</p>}{proposals?.length === 0 && <p>No coordinate proposals yet.</p>}
    {proposals?.map(proposal => <section className="panel" key={proposal.proposal_id} style={{ marginBottom: 16 }}><div className="panel-body">
      <h3>{proposal.proposed_site_name ?? sites.find(site => site.site_id === proposal.site_id)?.site_name_display ?? proposal.site_id}</h3>
      <p>{proposal.status} · {proposal.submitted_by_display_name ?? 'Collector'}</p>
      <p>Original approved coordinates: {proposal.original_coordinates ? `${proposal.original_coordinates.latitude}, ${proposal.original_coordinates.longitude}` : 'New site; no approved coordinates yet'}</p>
      <p>Proposed coordinates: <strong>{proposal.proposed_coordinates.latitude}, {proposal.proposed_coordinates.longitude}</strong></p>
      <p>{proposal.reason}</p>{proposal.decision_reason && <p>Decision: {proposal.decision_reason}</p>}
      {reviewer && proposal.status === 'PENDING' && proposal.submitted_by_uid !== user.uid && <div>
        <label className="field"><span className="field-label">Coordinate decision reason</span><textarea value={decisionReason} maxLength={1000} onChange={event => setDecisionReason(event.target.value)} /></label>
        {proposal.kind === 'NEW_SITE' && <>
          <label className="field"><span className="field-label">Approved site name</span><input value={approvedName} onChange={event => setApprovedName(event.target.value)} /></label>
          <label className="field"><span className="field-label">Approved site code</span><input value={siteCode} onChange={event => setSiteCode(event.target.value)} /></label>
          <label className="field"><span className="field-label">Approved site tolerance in meters</span><input type="number" min={0} value={tolerance} onChange={event => setTolerance(event.target.value)} /></label>
        </>}
        <button type="button" className="btn btn-primary" disabled={busy || decisionReason.trim().length < 5} onClick={() => void decide(proposal, 'APPROVED')}>Approve coordinates</button>{' '}
        <button type="button" className="btn" disabled={busy || decisionReason.trim().length < 5} onClick={() => void decide(proposal, 'REJECTED')}>Reject proposal</button>
      </div>}
    </div></section>)}
  </main>;
}
export default function SiteLocationsPage() { return <AuthGate allowCollector><Locations /></AuthGate>; }
