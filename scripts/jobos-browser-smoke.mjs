import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage();
const errors=[];
const traces=[];
page.on('requestfailed',r=>traces.push('request failed '+r.url()+' '+r.failure()?.errorText));
page.on('response',r=>{if(r.url().includes('research-feed'))traces.push('feed response '+r.status()+' '+r.url());});
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(['error','warning'].includes(m.type()))errors.push('console '+m.type()+': '+m.text());});
try{
  await page.goto('http://127.0.0.1:4173/jobos/',{waitUntil:'domcontentloaded',timeout:20000});
  await page.locator('#vault-pass').fill('jobos-test-passphrase-2026');
  await page.locator('#vault-confirm').fill('jobos-test-passphrase-2026');
  await page.locator('#vault-submit').click();
  await page.locator('#app-shell').waitFor({state:'visible',timeout:15000});
  // A personal browser should reopen the encrypted vault without another passphrase.
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#app-shell').waitFor({state:'visible',timeout:15000});
  if(!(await page.locator('#unlock-screen').evaluate(el=>el.hidden)))throw Error('Remembered browser did not auto-unlock');
  console.log('PASS remembered browser automatically unlocks after reload');
  await page.waitForTimeout(3500);
  const vaultError=await page.locator('#vault-error').innerText();
  const stateHints=await page.evaluate(()=>({unlockHidden:document.querySelector('#unlock-screen')?.hidden,buttonText:document.querySelector('#vault-submit')?.innerText,viewRootExists:!!document.querySelector('#view-root'),selectedNav:[...document.querySelectorAll('[data-view].active')].map(x=>x.dataset.view)}));
  const overview=await page.locator('#view-root').innerText();
  const overviewHTML=await page.locator('#view-root').innerHTML();
  const shellHTML=await page.locator('#app-shell').evaluate(e=>({hidden:e.hidden,display:getComputedStyle(e).display}));
  await page.locator('[data-view="career"]').click();
  await page.waitForTimeout(1000);
  const jobs=await page.locator('#view-root').innerText();
  const result={errors,traces,vaultError,stateHints,overviewHTML:overviewHTML.slice(0,1800),shellHTML,overview:overview.slice(0,1800),jobs:jobs.slice(0,2500),jobHTML:(await page.locator('#view-root').innerHTML()).slice(0,1800),hasHoneycomb:jobs.includes('Marketing Ops Analyst'),hasHarrow:jobs.includes('Marketing Operations Coordinator')};
  console.log(JSON.stringify(result,null,2));
  if(errors.some(s=>/ReferenceError|TypeError|SyntaxError|is not defined|Cannot read/.test(s)))throw Error('Browser runtime errors detected');
  if(!result.hasHoneycomb||!result.hasHarrow)throw Error('Public starter jobs did not appear in Employment after vault unlock');
  await page.evaluate(async()=>{
    await window.LeviOutreachImportResearchPack({records:[{name:'QA Cleaning Outreach',type:'Business',industry:'Cleaning Services',location:'Madison, WI',distanceMiles:'100',email:'qa@example.org',website:'https://example.org',sourceUrl:'https://example.org',researchDate:'2026-11-18',verification:'official-site'}]});
    window.open=(url)=>{window.__jobosDraftTestUrl=url;return {opener:null};};
  });
  await page.locator('[data-view="business"]').click();
  const btn=page.locator('[data-action="opencompose"]').first();
  await btn.waitFor({state:'visible',timeout:10000});
  await btn.click();
  const draftUrl=await page.evaluate(()=>window.__jobosDraftTestUrl||'');
  const draftParsed=new URL(draftUrl);
  const fields={to:draftParsed.searchParams.get('to'),subject:draftParsed.searchParams.get('su'),message:draftParsed.searchParams.get('body')};
  if(fields.to!=='qa@example.org'||!fields.subject?.includes('QA Cleaning Outreach')||!fields.message?.includes('client journey'))throw Error('Open Draft did not prefill correct To, subject and new client-journey message: '+JSON.stringify(fields));
  const activeBusinessText=await page.locator('#view-root').innerText();
  if(activeBusinessText.includes('Email ready')||activeBusinessText.includes('Held for later')||activeBusinessText.includes('Research updates and import tools')||activeBusinessText.includes('Contact research needed')||activeBusinessText.includes('Sent outreach'))throw Error('MunkOS active queue includes management clutter');
  if(await page.locator('.simple-list > .simple-opportunity').filter({hasText:'QA Cleaning Outreach'}).count())throw Error('Opened contact remained in active outreach');
  await page.locator('[data-view="manage"]').click();
  const sentDetails=page.locator('details.simple-secondary').filter({hasText:/Sent outreach/});
  if(await sentDetails.count()===0)throw Error('Sent Outreach is not accessible from Workspace management');
  if(!(await sentDetails.first().textContent()).includes('QA Cleaning Outreach'))throw Error('Opened contact missing from Workspace management');
  if(!(await page.locator('#view-root').innerText()).includes('Contact research needed'))throw Error('Research tools missing from management');
  console.log('PASS JobOS Open Draft: recipient, subject, body, and sent-queue transition');
  await page.locator('#lock-button').click();
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#unlock-screen').waitFor({state:'visible',timeout:10000});
  if(!(await page.locator('#app-shell').evaluate(el=>el.hidden)))throw Error('Lock & forget did not revoke remembered browser key');
  console.log('PASS remembered key revoked by Lock & forget');


}finally{await browser.close();}
