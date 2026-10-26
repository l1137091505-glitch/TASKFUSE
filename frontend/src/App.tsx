import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, NavLink, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { ArrowDownRight, ArrowUpRight, Check, CircleDollarSign, Clock3, Copy, CornerDownRight, FileCheck2, Flame, Menu, Plus, Search, ShieldAlert, Trophy, Users, X } from "lucide-react";
import { formatEther, type JsonRpcSigner } from "ethers";
import { BOT_CHAIN, CONTRACT_ADDRESS, DEMO_BOUNTIES, bot, connectWallet, digest, parseEther, readContract, readProvider, short, statusLabel, timeLeft, writeContract, type Bounty, type Submission } from "./chain";

type Wallet = { signer: JsonRpcSigner | null; address: string; balance: string };
type Notice = { kind: "ok" | "error" | "pending"; text: string } | null;
type WalletEvents = { on?: (event: "accountsChanged" | "chainChanged", fn: (value: unknown) => void) => void; removeListener?: (event: "accountsChanged" | "chainChanged", fn: (value: unknown) => void) => void };
const EMPTY: Wallet = { signer: null, address: "", balance: "" };

export default function App() {
  const [wallet, setWallet] = useState<Wallet>(EMPTY);
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [notice, setNotice] = useState<Notice>(null);
  const [menu, setMenu] = useState(false);

  const reload = useCallback(async () => {
    if (!CONTRACT_ADDRESS) { setBounties(DEMO_BOUNTIES); return; }
    try {
      const contract = readContract()!;
      const count = Number(await contract.bountyCount());
      const items: Bounty[] = [];
      for (let id = count; id >= Math.max(1, count - 39); id--) {
        const b = await contract.getBounty(id);
        items.push({ id, poster: String(b.poster), winner: String(b.winner), reward: b.reward, createdAt: Number(b.createdAt), deadline: Number(b.deadline), submissionCount: Number(b.submissionCount), status: Number(b.status), taskHash: String(b.taskHash), title: String(b.title) });
      }
      setBounties(items);
    } catch (error) { setNotice({ kind: "error", text: msg(error, "Could not read the task board.") }); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  const connect = useCallback(async () => {
    try {
      setNotice({ kind: "pending", text: "Waiting for your wallet…" });
      const c = await connectWallet();
      const balance = Number(formatEther(await c.provider.getBalance(c.address))).toFixed(3);
      setWallet({ signer: c.signer, address: c.address, balance });
      setNotice({ kind: "ok", text: "Wallet connected. Dispatch is live." });
    } catch (error) { setNotice({ kind: "error", text: msg(error, "Wallet connection failed.") }); }
  }, []);

  useEffect(() => {
    const ethereum = (window as Window & { ethereum?: WalletEvents }).ethereum;
    if (!ethereum?.on) return;
    const accounts = (value: unknown) => Array.isArray(value) && value.length === 0 ? setWallet(EMPTY) : void connect();
    const chain = () => void connect();
    ethereum.on("accountsChanged", accounts); ethereum.on("chainChanged", chain);
    return () => { ethereum.removeListener?.("accountsChanged", accounts); ethereum.removeListener?.("chainChanged", chain); };
  }, [connect]);

  return <div className="shell">
    <header className="header"><Link to="/" className="logo"><span><Flame /></span><b>TASKFUSE</b><small>PUBLIC JOB DISPATCH</small></Link><button className="menu" onClick={() => setMenu(!menu)}><Menu /></button><nav className={menu ? "open" : ""}><NavLink to="/" end>Dispatch</NavLink><NavLink to="/new">Fund a task</NavLink><NavLink to="/my">My desk</NavLink></nav><WalletButton wallet={wallet} connect={connect} /></header>
    {!CONTRACT_ADDRESS && <div className="preview"><b>SIMULATION FEED</b><span>Deploy the contract and set <code>VITE_TASKFUSE_ADDRESS</code> to enable live rewards.</span></div>}
    {notice && <button className={`toast ${notice.kind}`} onClick={() => setNotice(null)}><span>{notice.text}</span><X /></button>}
    <Routes>
      <Route path="/" element={<Home bounties={bounties} />} />
      <Route path="/new" element={<NewTask wallet={wallet} setNotice={setNotice} reload={reload} />} />
      <Route path="/bounties/:id" element={<BountyPage bounties={bounties} wallet={wallet} setNotice={setNotice} reload={reload} />} />
      <Route path="/my" element={<MyDesk bounties={bounties} wallet={wallet} />} />
      <Route path="*" element={<main className="missing"><b>404</b><h1>Mission not found.</h1><Link className="action acid" to="/">Back to dispatch</Link></main>} />
    </Routes>
    <Footer />
  </div>;
}

function WalletButton({ wallet, connect }: { wallet: Wallet; connect(): void }) { return <button className="wallet" onClick={connect}><i className={wallet.address ? "live" : ""} />{wallet.address ? <><b>{short(wallet.address)}</b><small>{wallet.balance} BOT</small></> : <><b>Connect</b><small>Start here</small></>}</button>; }

function Home({ bounties }: { bounties: Bounty[] }) {
  const [filter, setFilter] = useState("ALL");
  const open = bounties.filter((b) => statusLabel(b.status, b.deadline) === "OPEN");
  const value = open.reduce((sum, b) => sum + b.reward, 0n);
  const visible = bounties.filter((b) => filter === "ALL" || statusLabel(b.status, b.deadline) === filter);
  return <main>
    <section className="hero"><div className="hero-kicker"><span>NETWORK / 677</span><span>ESCROW / ACTIVE</span></div><div className="hero-title"><p>FUND THE WORK.</p><h1>Light the<br /><em>fuse.</em></h1></div><div className="hero-aside"><p>Post a concrete job. Lock the reward. Let contributors bring the proof.</p><div className="hero-actions"><Link className="action acid" to="/new">Fund a task <ArrowUpRight /></Link><a className="plain-link" href="#board">Browse the feed <ArrowDownRight /></a></div></div><div className="pulse-orb"><Flame /><span>LIVE<br />BOUNTIES</span></div></section>
    <section className="stats"><div><small>OPEN TASKS</small><b>{String(open.length).padStart(2, "0")}</b></div><div><small>REWARDS IN PLAY</small><b>{bot(value)} <i>BOT</i></b></div><div><small>SUBMISSIONS</small><b>{bounties.reduce((n, b) => n + b.submissionCount, 0)}</b></div><div><small>PROTOCOL FEE</small><b>0%</b></div></section>
    <section className="board" id="board"><div className="board-head"><div><p className="label">LIVE DISPATCH</p><h2>Pick a mission.</h2></div><div className="filters">{["ALL","OPEN","AWARDED","EXPIRED"].map((item) => <button className={filter === item ? "active" : ""} onClick={() => setFilter(item)} key={item}>{item}</button>)}</div></div><div className="bounty-grid">{visible.map((bounty) => <BountyCard bounty={bounty} key={bounty.id} />)}{!visible.length && <div className="empty">Nothing on this frequency yet.</div>}</div></section>
    <section className="flow"><div className="flow-heading"><p className="label">THE CIRCUIT</p><h2>Value moves<br />only twice.</h2></div><div className="flow-steps"><Step n="01" icon={<CircleDollarSign />} title="Lock it" text="The poster funds the full reward when the task goes live."/><Step n="02" icon={<FileCheck2 />} title="Prove it" text="Each wallet can leave one public submission before the deadline."/><Step n="03" icon={<Trophy />} title="Route it" text="The poster awards one contributor, or reclaims after expiry."/></div></section>
    <section className="warning"><ShieldAlert /><div><b>THE HUMAN DECIDES</b><p>The contract proves deposits, submissions, and payments. It does not judge quality or force the poster to choose a winner.</p></div><Link to="/new">Post with care <ArrowUpRight /></Link></section>
  </main>;
}

function Step({ n, icon, title, text }: { n: string; icon: ReactNode; title: string; text: string }) { return <article><span>{n}</span>{icon}<h3>{title}</h3><p>{text}</p></article>; }

function BountyCard({ bounty }: { bounty: Bounty }) {
  const status = statusLabel(bounty.status, bounty.deadline);
  return <Link className={`bounty-card ${status.toLowerCase()}`} to={`/bounties/${bounty.id}`}><div className="card-top"><span>#{String(bounty.id).padStart(3,"0")}</span><b>{status}</b></div><p className="category">{bounty.category ?? "PUBLIC TASK"}</p><h3>{bounty.title}</h3><p>{bounty.summary ?? "Task fingerprint and terms are recorded on-chain."}</p><div className="card-data"><span><CircleDollarSign /> REWARD<strong>{bot(bounty.reward)} BOT</strong></span><span><Users /> ENTRIES<strong>{bounty.submissionCount}</strong></span><span><Clock3 /> WINDOW<strong>{timeLeft(bounty.deadline)}</strong></span></div><div className="card-foot"><span>VIEW MISSION</span><ArrowUpRight /></div></Link>;
}

function NewTask({ wallet, setNotice, reload }: { wallet: Wallet; setNotice(v: Notice): void; reload(): Promise<void> }) {
  const [title, setTitle] = useState(""); const [task, setTask] = useState(""); const [reward, setReward] = useState(""); const [days, setDays] = useState("7"); const [review, setReview] = useState(false);
  const navigate = useNavigate(); const hash = useMemo(() => digest(task), [task]);
  const submit = async () => {
    if (!CONTRACT_ADDRESS) { setNotice({ kind:"ok", text:`Simulation ready: ${short(hash)}` }); navigate("/"); return; }
    if (!wallet.signer) { setNotice({kind:"error",text:"Connect the funding wallet first."}); return; }
    try { setNotice({kind:"pending",text:"Confirm the reward deposit in your wallet…"}); const tx = await writeContract(wallet.signer).openBounty(title.trim(), hash, BigInt(Number(days) * 86400), { value: parseEther(reward) }); await tx.wait(); await reload(); setNotice({kind:"ok",text:"Task funded and dispatched."}); navigate("/"); }
    catch (error) { setNotice({kind:"error",text:msg(error,"The task was not created.")}); }
  };
  return <main className="page"><section className="page-title"><p className="label">NEW DISPATCH</p><h1>Put a reward<br />on the table.</h1><p>Everything except the private task text is public. The browser sends only its fingerprint.</p></section><section className="composer"><aside><span>01</span><h2>{review ? "Final check" : "Mission brief"}</h2><p>The reward is locked immediately. It can only go to a recorded contributor or return to this wallet after the deadline.</p><div className="composer-status"><i className="on"/><i className={review?"on":""}/><i/></div></aside>{!review ? <form onSubmit={(e)=>{e.preventDefault();setReview(true)}}><Field label="Public title" hint={`${new TextEncoder().encode(title).length} / 64 bytes`}><input required maxLength={64} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Audit the onboarding checklist" /></Field><Field label="Private task text" hint="Kept in this browser; share it directly with contributors."><textarea required value={task} onChange={e=>setTask(e.target.value)} placeholder="Describe the deliverable, acceptance criteria, and handoff format." /></Field><div className="field-pair"><Field label="Reward" hint="Native BOT"><input required min="0.000001" step="any" type="number" value={reward} onChange={e=>setReward(e.target.value)} placeholder="2.5" /></Field><Field label="Deadline" hint="Starts after confirmation"><select value={days} onChange={e=>setDays(e.target.value)}><option value="1">1 day</option><option value="3">3 days</option><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option><option value="90">90 days</option></select></Field></div><button className="action acid">Review dispatch <ArrowUpRight /></button></form> : <div className="review"><div className="review-block"><small>MISSION</small><h2>{title}</h2><p>{task}</p></div><div className="receipt"><span>TASK FINGERPRINT</span><code>{hash}</code><button onClick={()=>void navigator.clipboard.writeText(hash)}><Copy /> Copy</button></div><div className="review-metrics"><div><small>REWARD</small><b>{reward} BOT</b></div><div><small>WINDOW</small><b>{days} DAYS</b></div><div><small>FEE</small><b>0 BOT</b></div></div><div className="review-buttons"><button className="action outline" onClick={()=>setReview(false)}>Edit</button><button className="action acid" onClick={()=>void submit()}>{CONTRACT_ADDRESS?"Fund & dispatch":"Run simulation"}<ArrowUpRight /></button></div></div>}</section></main>;
}

function Field({label,hint,children}:{label:string;hint:string;children:ReactNode}) { return <label className="field"><span><b>{label}</b><small>{hint}</small></span>{children}</label>; }

function BountyPage({ bounties, wallet, setNotice, reload }: { bounties:Bounty[]; wallet:Wallet; setNotice(v:Notice):void; reload():Promise<void> }) {
  const { id } = useParams(); const bounty = bounties.find(b=>String(b.id)===id); const [subs,setSubs]=useState<Submission[]>(bounty?.submissions??[]); const [note,setNote]=useState(""); const [proof,setProof]=useState("");
  useEffect(()=>{ if (!bounty || bounty.demo || !CONTRACT_ADDRESS) { setSubs(bounty?.submissions??[]); return; } void readContract()!.getSubmissions(bounty.id).then((items:Submission[])=>setSubs(items.map(s=>({contributor:String(s.contributor),submittedAt:Number(s.submittedAt),proofHash:String(s.proofHash),note:String(s.note)})))).catch(()=>setSubs([])); },[bounty]);
  if (!bounty) return <main className="missing"><b>···</b><h1>Loading mission.</h1></main>;
  const isPoster = wallet.address.toLowerCase()===bounty.poster.toLowerCase(); const status=statusLabel(bounty.status,bounty.deadline); const proofHash=digest(proof||note);
  const send = async (e:FormEvent)=>{e.preventDefault(); if(!CONTRACT_ADDRESS){setNotice({kind:"ok",text:`Simulation entry ready: ${short(proofHash)}`});return;} if(!wallet.signer){setNotice({kind:"error",text:"Connect a contributor wallet first."});return;} try{setNotice({kind:"pending",text:"Confirm the submission in your wallet…"});const tx=await writeContract(wallet.signer).submit(bounty.id,note,proofHash);await tx.wait();await reload();setNotice({kind:"ok",text:"Submission recorded."});}catch(error){setNotice({kind:"error",text:msg(error,"Submission failed.")});}};
  const award=async(index:number)=>{if(!wallet.signer)return;try{setNotice({kind:"pending",text:"Confirm the full reward payment…"});const tx=await writeContract(wallet.signer).award(bounty.id,index);await tx.wait();await reload();setNotice({kind:"ok",text:"Reward routed to the selected contributor."});}catch(error){setNotice({kind:"error",text:msg(error,"Award failed.")});}};
  const reclaim=async()=>{if(!wallet.signer)return;try{setNotice({kind:"pending",text:"Confirm reward recovery…"});const tx=await writeContract(wallet.signer).reclaim(bounty.id);await tx.wait();await reload();setNotice({kind:"ok",text:"Reward returned to the poster."});}catch(error){setNotice({kind:"error",text:msg(error,"Recovery failed.")});}};
  return <main className="detail"><section className="detail-hero"><div className="detail-id"><span>MISSION</span><b>#{String(bounty.id).padStart(3,"0")}</b></div><div><p className="label">{bounty.category??"PUBLIC TASK"}</p><h1>{bounty.title}</h1><p>{bounty.summary??"The public contract stores the task fingerprint, reward, deadline, and every submission."}</p></div><div className="reward-dial"><small>REWARD HELD</small><b>{bot(bounty.reward)}</b><span>BOT</span></div></section><section className="detail-facts"><div><small>STATUS</small><b>{status}</b></div><div><small>TIME</small><b>{timeLeft(bounty.deadline)}</b></div><div><small>POSTER</small><b>{short(bounty.poster)}</b></div><div><small>ENTRIES</small><b>{bounty.submissionCount}/100</b></div></section><section className="detail-body"><div className="submission-side"><div className="section-line"><h2>Submission feed</h2><span>{subs.length} RECEIVED</span></div>{subs.map((s,index)=><article className="submission" key={`${s.contributor}-${index}`}><div><span>#{String(index+1).padStart(2,"0")}</span><b>{short(s.contributor)}</b><time>{new Date(s.submittedAt*1000).toLocaleString()}</time></div><p>{s.note}</p><code>{short(s.proofHash)}</code>{isPoster&&status==="OPEN"&&<button onClick={()=>void award(index)}>Award full reward <Trophy /></button>}</article>)}{!subs.length&&<div className="empty">No one has answered this call yet.</div>}</div><aside className="entry-panel">{!isPoster&&status==="OPEN"?<form onSubmit={send}><p className="label">SEND YOUR SIGNAL</p><h2>Submit proof.</h2><Field label="Public note" hint="Maximum 280 characters"><textarea required maxLength={280} value={note} onChange={e=>setNote(e.target.value)} placeholder="Describe what you completed and how the poster can review it." /></Field><Field label="Proof reference" hint="Link, commit, or delivery identifier"><input value={proof} onChange={e=>setProof(e.target.value)} placeholder="https://github.com/.../commit/..." /></Field><code>{proofHash}</code><button className="action acid">Record submission <CornerDownRight /></button><small>One submission per wallet. It cannot be edited.</small></form>:<div className="poster-panel"><p className="label">POSTER CONTROLS</p><h2>{isPoster?"Choose carefully.":"Read-only view."}</h2><p>{isPoster?"Award any recorded contributor before or after the deadline. If unpaid when time expires, reclaim the reward.":"Only the funding wallet can award or recover this reward."}</p>{isPoster&&status==="EXPIRED"&&<button className="action danger" onClick={()=>void reclaim()}>Reclaim reward</button>}</div>}<div className="fingerprint"><span>TASK FINGERPRINT</span><code>{bounty.taskHash}</code></div></aside></section></main>;
}

function MyDesk({bounties,wallet}:{bounties:Bounty[];wallet:Wallet}) { const own=bounties.filter(b=>wallet.address&&b.poster.toLowerCase()===wallet.address.toLowerCase()); return <main className="page"><section className="page-title"><p className="label">MY DESK</p><h1>Funded from<br />this wallet.</h1><p>{wallet.address?short(wallet.address):"Connect a wallet to see its dispatches."}</p></section><section className="board personal"><div className="bounty-grid">{own.map(b=><BountyCard bounty={b} key={b.id}/>)}{!own.length&&<div className="empty">No funded missions found for this wallet.</div>}</div></section></main>; }

function Footer(){return <footer><div className="footer-logo"><Flame/>TASKFUSE</div><p>Funded tasks. Public submissions. Direct rewards.</p><div><a href="https://www.botchain.ai/en/" target="_blank" rel="noreferrer">BOT Chain ↗</a><a href={BOT_CHAIN.explorer} target="_blank" rel="noreferrer">Explorer ↗</a></div><small>UNAUDITED / USE SMALL VALUES</small></footer>}
function msg(error:unknown,fallback:string){return error instanceof Error?error.message.replace("execution reverted: ",""):fallback}

