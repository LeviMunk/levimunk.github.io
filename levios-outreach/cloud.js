/* LeviOS encrypted cloud synchronization; safe offline-first fallback. */
(() => {
  "use strict";
  const CFG="levios.outreach.cloud.config.v1", LINK="levios.outreach.cloud.link.v1", VAULT="levios.outreach.encrypted.v1";
  const OWNER="levivanstap@gmail.com";
  // Public Supabase project URL/key: safe to distribute, never a privileged credential.
  const DEFAULT_CONFIG={url:"https://yfqtyuynsumvwhnmnswk.supabase.co",key:"sb_publishable_-l-qx8tIGXMvcQc9pcBq0w_nB2dEFQm"};
  let client=null, user=null, remote=null, revision=0, linked=false, saving=false, pending=false, timer=0, message="";
  let gmailReady=false, gmailConnected=false;
  let researchImporting=false, researchMessage="Research Inbox: checking";
  const $=id=>document.getElementById(id);
  const vault=()=>{try{return JSON.parse(localStorage.getItem(VAULT)||"null")}catch{return null}};
  const valid=v=>!!(v&&v.version===1&&v.salt&&v.iv&&v.ciphertext);
  const config=()=>{try{return JSON.parse(localStorage.getItem(CFG)||"null")||DEFAULT_CONFIG}catch{return DEFAULT_CONFIG}};
  function makeClient(c){
    if(!window.supabase?.createClient)throw Error("Supabase script unavailable. Try reloading.");
    if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(c.url||""))throw Error("Invalid Supabase URL");
    if(!/^(sb_publishable_|eyJ)[A-Za-z0-9._-]{30,}$/.test(c.key||""))throw Error("Use a public publishable/anon key, never a secret key");
    client=window.supabase.createClient(c.url.replace(/\/$/,""),c.key,{auth:{flowType:"pkce",persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  }
  function status(text){message=text;const e=$("cloud-status");if(e){e.textContent=text;e.style.color=/^Error|^Conflict/.test(text)?"#ff9f9f":"#c8ff90"}}
  function refreshUI(){
    if(!$("cloud-modal"))return;
    $("cloud-setup").hidden=!!client;
    $("cloud-signin-pane").hidden=!client||!!user;
    $("cloud-signed-pane").hidden=!user;
    $("cloud-user").textContent=user?.email||"";
    $("cloud-remote").textContent=remote?"Cloud revision "+remote.revision:"No cloud vault stored";
    $("cloud-local").textContent=valid(vault())?"Encrypted browser vault present":"No encrypted browser vault";
    $("cloud-link").textContent=linked?"Sync active on this device":"Not syncing on this device";
    if($("research-status"))$("research-status").textContent=researchMessage;
    $("cloud-upload").disabled=!user||!valid(vault());
    $("cloud-restore").disabled=!user||!remote;
    $("cloud-upload").textContent=remote?"Replace cloud with THIS browser vault":"Upload browser vault and enable sync";
    $("gmail-authorize").disabled=!user||!gmailReady;
    $("gmail-activity").disabled=!user||!gmailConnected;
    $("gmail-test").disabled=!user||!gmailConnected||!window.LeviOutreachIsUnlocked?.();
    status(message);
  }
  function initUI(){
    document.querySelector(".sidebar-bottom")?.insertAdjacentHTML("afterbegin",'<button type="button" id="cloud-open" class="sidebar-lock">☁ &nbsp; Cloud & Gmail</button>');
    document.querySelector(".security-note")?.insertAdjacentHTML("afterend",'<button type="button" id="cloud-before-unlock" class="button button-secondary" style="margin-top:12px">☁ Restore from cloud on another device</button>');
    document.body.insertAdjacentHTML("beforeend", [
      '<dialog id="cloud-modal" class="modal" style="max-width:680px;width:calc(100% - 24px);max-height:90vh;overflow:auto;padding:24px">',
      '<div class="modal-head"><div><div class="eyebrow">LEVIOS / INTEGRATIONS</div><h2>Cloud & Gmail</h2></div><button type="button" class="close-modal" id="cloud-close">×</button></div>',
      '<p class="small subtle">Only encrypted vault snapshots go to cloud storage. Gmail requires separate Google authorization.</p>',
      '<div id="cloud-setup"><label class="field">Supabase project URL<input id="cloud-url" type="url" placeholder="https://project.supabase.co"></label>',
      '<label class="field">Public publishable key<input id="cloud-key" autocomplete="off" placeholder="sb_publishable_..."></label>',
      '<p class="small subtle">Public key only. Never enter a service-role or secret key.</p><button class="button button-primary" id="cloud-configure">Save cloud configuration</button></div>',
      '<div id="cloud-signin-pane" hidden><p class="small">Sign in as levivanstap@gmail.com to connect this private vault.</p>',
      '<button class="button button-primary" id="cloud-login">Email sign-in link</button></div>',
      '<div id="cloud-signed-pane" hidden><p class="small">Signed in: <strong id="cloud-user"></strong></p>',
      '<p class="small subtle" id="cloud-remote"></p><p class="small subtle" id="cloud-local"></p><p class="small" id="cloud-link"></p>',
      '<p class="small" id="research-status">Research Inbox: checking</p>',
      '<div class="actions" style="display:flex;flex-wrap:wrap;gap:8px"><button class="button button-primary" id="cloud-upload">Upload browser vault</button>',
      '<button class="button button-secondary" id="cloud-restore">Restore cloud to browser</button>',
      '<button class="button button-secondary" id="cloud-refresh">Refresh status</button>',
      '<button class="button button-secondary" id="cloud-logout">Sign out</button></div>',
      '<p class="small subtle">Conflicting edits never overwrite automatically. Export an encrypted backup before replacing a vault. Use one device at a time until merge support is available.</p>',
      '<hr style="opacity:.25;margin:20px 0"><h3>Gmail</h3>',
      '<p class="small subtle">Gmail requires separate Google OAuth credentials and account authorization. No emails are sent automatically.</p>',
      '<p class="small"><a href="https://github.com/LeviMunk/levios-outreach/blob/main/docs/CLOUD_SETUP.md" target="_blank" rel="noopener noreferrer">Google OAuth setup instructions ↗</a></p>',
      '<div class="actions" style="display:flex;flex-wrap:wrap;gap:8px">',
      '<button class="button button-secondary" id="gmail-status">Check connection</button>',
      '<button class="button button-primary" id="gmail-authorize">Connect Gmail</button>',
      '<button class="button button-secondary" id="gmail-activity">Inspect tracked email activity</button>',
      '<button class="button button-secondary" id="gmail-test">Create test prospect + Gmail draft</button></div>',
      '<p class="small subtle">Safe integration test: adds a clearly labeled sample to your encrypted vault and creates a Gmail draft addressed to yourself. Nothing is sent.</p>',
      '<pre id="gmail-results" class="small" style="white-space:pre-wrap;overflow-wrap:anywhere"></pre></div>',
      '<p id="cloud-status" role="status" aria-live="polite" class="small"></p>',
      '</dialog>'
    ].join(""));
  }
  async function readRemote(){
    const {data,error}=await client.from("outreach_vaults").select("revision,payload,updated_at").eq("user_id",user.id).maybeSingle();
    if(error)throw Error(error.message+"; verify migration and RLS");
    remote=data;revision=Number(data?.revision||0);
    let saved;try{saved=JSON.parse(localStorage.getItem(LINK)||"null")}catch{}
    linked=!!(saved?.userId===user.id&&remote&&saved.revision===revision&&valid(vault()));
    if(saved&&!linked){localStorage.removeItem(LINK);status("Conflict: cloud and browser versions differ. Choose which snapshot to use.");}
    refreshUI();
  }
  async function start(){
    const c=config();if(!c){refreshUI();return}
    try{
      makeClient(c);
      const {data:sessionData,error:sessionError}=await client.auth.getSession();
      if(sessionError)throw sessionError;
      if(sessionData.session){
        const {data,error}=await client.auth.getUser();
        if(error)throw error;
        user=data?.user||null;
      }else user=null;
      if(user&&user.email?.toLowerCase()!==OWNER){await client.auth.signOut();user=null;throw Error("Owner email required")}
      if(user)await readRemote();
      refreshUI();
      if(user)await syncResearchBatches();
    }catch(e){status("Error: "+e.message);refreshUI();}
  }
  async function upload(force=false){
    if(!client||!user)throw Error("Sign in first");
    if(!valid(vault()))throw Error("Create or restore a vault on this browser first");
    if(!force&&!linked)return;
    if(saving){pending=true;return}
    saving=true;
    try{
      const expected=force?Number(remote?.revision||0):revision;
      const {data,error}=await client.rpc("outreach_save_vault",{p_expected_revision:expected,p_payload:vault()});
      if(error)throw Error(error.message);
      revision=Number(data);remote={revision,payload:vault()};linked=true;
      localStorage.setItem(LINK,JSON.stringify({userId:user.id,revision}));
      status("Encrypted sync saved, revision "+revision);
    }catch(e){
      linked=false;localStorage.removeItem(LINK);
      status("Conflict / sync stopped: "+e.message+"; local data unchanged");
      throw e;
    }finally{saving=false;refreshUI();if(pending&&linked){pending=false;schedule();}}
  }
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(()=>upload().catch(()=>{}),1200)};

  // Research batches are server-staged public business information. Only a signed-in owner
  // with an unlocked, revision-linked vault can automatically merge and encrypt them.
  // Acknowledgement occurs only AFTER a successful encrypted Supabase revision save.
  async function syncResearchBatches(){
    if(researchImporting||!client||!user)return;
    researchImporting=true;
    try{
      const {data,error}=await client.from("outreach_research_batches")
        .select("id,batch_key,payload,created_at")
        .eq("user_id",user.id).eq("status","queued")
        .order("created_at",{ascending:true}).limit(20);
      if(error)throw Error(error.message);
      if(!data?.length){researchMessage="Research Inbox: all researched batches processed";refreshUI();return}
      if(!window.LeviOutreachIsUnlocked?.()){
        researchMessage="Research Inbox: "+data.length+" pending batch(es), automatically imported after vault unlock";
        refreshUI();return;
      }
      if(!linked){
        researchMessage="Research Inbox: "+data.length+" pending batch(es). Encrypted cloud sync must be active on this device; no records were changed.";
        refreshUI();return;
      }
      if(!window.LeviOutreachImportResearchPack)throw Error("Refresh to load the research importer.");
      let leads=0,strategies=0,skipped=0,processed=0;
      for(const batch of data){
        if(!linked||!window.LeviOutreachIsUnlocked?.())break;
        // A queued batch is idempotent: duplicate leads already in the vault are skipped.
        const report=await window.LeviOutreachImportResearchPack(batch.payload);
        if(!report)throw Error("Research batch merge did not complete.");
        clearTimeout(timer);
        // Never acknowledge a batch while a concurrent cloud save may still be running.
        if(saving||!linked)throw Error("An encrypted vault sync is already in progress or requires reconciliation");
        // If everything was already in the linked vault, no rewrite is necessary.
        if(report.added||report.strategiesAdded)await upload();
        if(!linked)throw Error("Research not acknowledged: encrypted cloud sync did not complete");
        const {data:ack,error:ackError}=await client.rpc("outreach_ack_research_batch",{p_batch_id:batch.id});
        if(ackError)throw Error("Research stored, but acknowledgement failed: "+ackError.message);
        if(ack!==true)throw Error("Research acknowledgement did not complete.");
        leads+=report.added;strategies+=report.strategiesAdded;skipped+=report.skipped;processed++;
      }
      researchMessage="Research Inbox: "+leads+" leads + "+strategies+" strategies imported from "+processed+" batch(es); "+skipped+" duplicates/invalid skipped. No emails sent.";
    }catch(e){
      researchMessage="Research Inbox: "+e.message+". No emails were sent; queued batches remain available if sync failed.";
    }finally{researchImporting=false;refreshUI();}
  }

  async function restore(){
    if(!valid(remote?.payload))throw Error("No valid remote vault");
    if(!confirm("Replace this browser's encrypted vault with cloud data? Download a backup first."))return;
    if(!confirm("Confirm replacement. You'll need the passphrase of the CLOUD vault."))return;
    localStorage.setItem(VAULT,JSON.stringify(remote.payload));
    localStorage.setItem(LINK,JSON.stringify({userId:user.id,revision:remote.revision}));
    location.reload();
  }
  async function gmail(action, extra={}){
    if(!client||!user)throw Error("Connect cloud first");
    const {data,error}=await client.functions.invoke("gmail-bridge",{body:{action,...extra}});
    if(error){
      let detail=error.message;
      try{const response=error.context?.clone?.()||error.context;if(response?.json){const body=await response.json();detail=body?.error||body?.message||detail;}}catch{}
      throw Error(detail);
    }
    if(data?.error)throw Error(data.error);
    return data;
  }
  async function checkGmail(){
    const data=await gmail("status");
    gmailReady=data.authorizationReady===true;
    gmailConnected=data.connected===true;
    const missing=Array.isArray(data.missingSecrets)?data.missingSecrets:[];
    const invalid=Array.isArray(data.invalidSecrets)?data.invalidSecrets:[];
    $("gmail-results").textContent=gmailConnected
      ? "Gmail is connected: "+(data.address||"authorized account")
      : gmailReady
        ? "Google OAuth is configured. Select Connect Gmail to authorize your account."
        : missing.length||invalid.length
          ? "Gmail authorization not ready.\n"+(missing.length?"Missing Supabase secrets: "+missing.join(", ")+"\n":"")+(invalid.length?"Invalid secret format: "+invalid.join(", ")+"\n":"")+"Save or correct those names under Supabase → Edge Functions → Secrets. No secret values are shown."
          : "Gmail is not connected yet. Open the Google OAuth setup instructions above and check your Supabase secrets.";
    refreshUI();
    return data;
  }
  async function createDraft(rec){
    if(!rec?.email||!rec?.draft||rec.channel!=="Email")throw Error("Save the email recipient and message first");
    const d=await gmail("draft",{recordId:rec.id,to:rec.email,cc:rec.cc||"",subject:rec.subject||"Hello",body:rec.draft});
    status("Gmail draft created. No message was sent.");
    return d;
  }
  async function click(e){
    const button=e.target.closest("button");const id=button?.id;
    if(!["cloud-open","cloud-before-unlock","cloud-close","cloud-configure","cloud-login","cloud-upload","cloud-restore","cloud-refresh","cloud-logout","gmail-status","gmail-authorize","gmail-activity","gmail-test"].includes(id))return;
    if(id==="cloud-open"||id==="cloud-before-unlock"){$("cloud-modal").showModal();refreshUI();if(user)checkGmail().catch(err=>status("Error checking Gmail: "+err.message));return}
    if(id==="cloud-close"){$("cloud-modal").close();return}
    if(button.disabled)return;
    button.disabled=true;
    try{
      if(id==="cloud-configure"){
        const c={url:$("cloud-url").value.trim(),key:$("cloud-key").value.trim()};makeClient(c);localStorage.setItem(CFG,JSON.stringify(c));await start();status("Configuration saved. Sign in using your email.");
      }else if(id==="cloud-login"){
        const {error}=await client.auth.signInWithOtp({email:OWNER,options:{emailRedirectTo:location.origin+location.pathname,shouldCreateUser:true}});
        if(error)throw Error(error.message);
        status("Sign-in link requested. Check "+OWNER);
      }else if(id==="cloud-upload"){
        if(remote&&!confirm("Replace existing cloud snapshot with this device? Confirm your encrypted backup is saved."))return;
        if(remote&&!confirm("This may overwrite another device's data. Continue?"))return;
        await upload(true);
      }else if(id==="cloud-restore")await restore();
      else if(id==="cloud-refresh"){await readRemote();status("Cloud status refreshed.");}
      else if(id==="cloud-logout"){await client.auth.signOut();user=null;remote=null;linked=false;gmailReady=false;gmailConnected=false;localStorage.removeItem(LINK);status("Signed out. Local vault unchanged.")}
      else if(id==="gmail-status"){await checkGmail();}
      else if(id==="gmail-authorize"){if(!gmailReady)throw Error("Google OAuth is not configured yet. Follow the Google OAuth setup link.");const r=await gmail("authorize");if(!r.authorizeUrl)throw Error("Google authorization unavailable");location.assign(r.authorizeUrl);}
      else if(id==="gmail-test"){
        if(!gmailConnected)throw Error('Connect Gmail first.');
        if(!window.LeviOutreachCreateTestProspect)throw Error('Test helper unavailable. Refresh the page.');
        const prospect=await window.LeviOutreachCreateTestProspect();
        const result=await createDraft(prospect);
        $("gmail-results").textContent="SUCCESS: Test prospect saved in your encrypted vault. Gmail draft created for levivanstap@gmail.com. No email sent."+(result.existing?" (Existing draft reused.)":"");
        status("Gmail draft test completed. Close this panel to find the prospect in Outreach Queue, or open Gmail Drafts.");
      }
      else if(id==="gmail-activity"){
        const emails=(window.LeviOutreachTrackedEmails?.()||[]).slice(0,10);
        if(!emails.length)throw Error("No email prospects in unlocked vault");
        $("gmail-results").textContent=JSON.stringify(await gmail("activity",{emails}),null,2);
        status("Gmail metadata inspected. No sent/reply statuses changed.");
      }
    }catch(e){status("Error: "+e.message)}finally{button.disabled=false;refreshUI();}
  }
  document.addEventListener("click",e=>{click(e).catch(err=>status("Error: "+err.message))});
  initUI();
  const oauthQuery=new URLSearchParams(location.search);
  if(oauthQuery.has("gmail")){
    const result=oauthQuery.get("gmail");
    const code=oauthQuery.get("gmail_error");
    const details={
      invalid_client:"Google rejected the Client ID or Client Secret. Check both values in Supabase Edge Function Secrets.",
      invalid_grant:"Google rejected the authorization code. Make sure the redirect URI matches, then try Connect Gmail again.",
      token_exchange:"Google could not exchange the authorization code. Verify the Google OAuth client and redirect URI.",
      gmail_api:"Google granted access, but the Gmail API request failed. Confirm Gmail API is enabled in your Google Cloud project.",
      wrong_account:"The Google account chosen does not match the Gmail address registered for LeviOS Outreach.",
      oauth_state:"The authorization session expired or could not be verified. Click Connect Gmail again.",
      refresh_token:"Google did not provide a refresh token. Reauthorize the app through Connect Gmail.",
      encryption:"Gmail token encryption could not complete. Check GMAIL_TOKEN_ENCRYPTION_KEY in Supabase.",
      database:"The secure Gmail connection could not be stored. Check Supabase Edge Function logs.",
      callback_failed:"An authorization callback step failed. Check Supabase Edge Function logs."
    };
    status(result==="connected"
      ?"Gmail authorization completed. Use Check connection to verify."
      :"Error: Gmail authorization did not complete. "+(details[code]||details.callback_failed));
    if(result!=="connected")$("gmail-results").textContent="Gmail authorization error: "+(code||"unknown");
    $("cloud-modal")?.showModal();
    const clean=new URL(location.href);
    clean.searchParams.delete("gmail");
    clean.searchParams.delete("gmail_error");
    history.replaceState(null,"",clean.pathname+clean.search+clean.hash);
  }
  window.LeviCloud={
    onLocalWrite(){if(linked&&user)schedule()},
    onVaultOpen(){refreshUI();syncResearchBatches().catch(e=>status("Research Inbox: "+e.message))},onLock(){refreshUI()},
    async createDraft(rec){return createDraft(rec)},
    async reviewReplies(records){if(!gmailConnected)throw Error("Connect Gmail first.");return gmail("reviewReplies",{records});},
    isGmailConnected(){return gmailConnected},
    isConnected(){return !!(linked&&user)}
  };
  start().catch(e=>status("Error: "+e.message));
})();
