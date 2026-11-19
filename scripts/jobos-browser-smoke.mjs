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
  // Finish saving the trusted-browser key before deliberately reloading.
  await page.waitForFunction(()=>!document.querySelector('#vault-submit')?.disabled);
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
  if(!result.hasHoneycomb)throw Error('Qualified active job not visible in Employment');
  if(await page.locator('#view-root #search-input').count())throw Error('Employment still contains search input');
  if(jobs.includes('Public jobs')||jobs.includes('Refresh & import jobs')||jobs.includes('interview and recruiter review')||jobs.includes('Jobs worth applying to'))throw Error('Employment still shows research or helper sections');
  if(await page.locator('#view-root [data-action="opendetail"]').count()<1)throw Error('No active job cards appeared in Employment');
  await page.evaluate(async()=>{
    await window.LeviOutreachImportResearchPack({records:[{name:'QA Cleaning Outreach',type:'Business',industry:'Cleaning Services',location:'Madison, WI',distanceMiles:'100',email:'qa@example.org',website:'https://example.org',sourceUrl:'https://example.org',researchDate:'2026-11-18',verification:'official-site'}]});
    window.open=(url)=>{window.__jobosDraftTestUrl=url;return {opener:null};};
  });
  await page.locator('[data-view="business"]').click();
  if(await page.locator('#view-root #search-input').count())throw Error('MunkOS still contains search input');
  if(await page.locator('#view-root .simple-opportunity').count()!==1)throw Error('Unexpected number of active MunkOS prospects');
  if(await page.locator('.compact-workspace .page-heading p').isVisible())throw Error('MunkOS page subtitle still visible');

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
  await page.locator('details.sidebar-more summary').click();
  await page.locator('[data-view="manage"]').click();
  const sentDetails=page.locator('details.simple-secondary').filter({hasText:/Sent outreach/});
  if(await sentDetails.count()===0)throw Error('Sent Outreach is not accessible from Workspace management');
  if(!(await sentDetails.first().textContent()).includes('QA Cleaning Outreach'))throw Error('Opened contact missing from Workspace management');
  if(!(await page.locator('#view-root').innerText()).includes('Contact research needed'))throw Error('Research tools missing from management');
  const manageText=await page.locator('#view-root').innerText();
  if(!manageText.includes('Applied jobs')||!manageText.includes('Job research and import'))throw Error('Applied jobs or job research not accessible in management');

  const applyDetails=page.locator('details.simple-secondary').filter({hasText:/JobOS Apply · master profile/}).first();
  await applyDetails.locator('summary').click();
  await page.locator('#apply-profile-form [name="firstName"]').fill('Test');
  await page.locator('#apply-profile-form [name="lastName"]').fill('Candidate');
  await page.locator('#apply-profile-form [name="email"]').fill('candidate@example.com');
  await page.locator('#apply-profile-form [name="city"]').fill('Appleton');
  await page.locator('#apply-profile-form [name="confirmFacts"]').check();
  await page.locator('#apply-profile-form button[type="submit"]').click();
  await page.locator('details.simple-secondary').filter({hasText:/JobOS Apply · master profile/}).first().locator('summary').click();
  await page.locator('#apply-answer-form [name="question"]').fill('Which analytics tools have you used?');
  await page.locator('#apply-answer-form [name="answer"]').fill('Google Analytics and Excel');
  await page.locator('#apply-answer-form [name="confirmAnswer"]').check();
  await page.locator('#apply-answer-form button[type="submit"]').click();
  await page.locator('details.simple-secondary').filter({hasText:/JobOS Apply · master profile/}).first().locator('summary').click();
  const experienceForm=page.locator('.apply-entry-form[data-kind="experience"]');
  await experienceForm.locator('[name="company"]').fill('QA Marketing Studio');
  await experienceForm.locator('[name="title"]').fill('Marketing Analyst');
  await experienceForm.locator('[name="startDate"]').fill('2024-08');
  await experienceForm.locator('[name="endDate"]').fill('Present');
  await experienceForm.locator('[name="confirmEntry"]').check();
  await experienceForm.locator('button[type="submit"]').click();
  await page.locator('details.simple-secondary').filter({hasText:/JobOS Apply · master profile/}).first().locator('summary').click();
  const educationForm=page.locator('.apply-entry-form[data-kind="education"]');
  await educationForm.locator('[name="school"]').fill('QA University');
  await educationForm.locator('[name="degree"]').fill('Bachelor of Science');
  await educationForm.locator('[name="endDate"]').fill('2014-05');
  await educationForm.locator('[name="confirmEntry"]').check();
  await educationForm.locator('button[type="submit"]').click();
  await page.locator('details.simple-secondary').filter({hasText:/JobOS Apply · master profile/}).first().locator('summary').click();
  await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__jobosApplyCopied=text;}}});});
  await page.locator('[data-action="applycopyprofile"]').click();
  const exported=await page.evaluate(()=>window.__jobosApplyCopied);
  const applyExport=JSON.parse(exported||'{}');
  if(applyExport.format!=='jobos-apply-v1'||applyExport.profile.email!=='candidate@example.com'||applyExport.answers.length!==1)throw Error('Encrypted JobOS Apply profile or answer export failed');
  if(applyExport.experience?.[0]?.company!=='QA Marketing Studio'||applyExport.education?.[0]?.degree!=='Bachelor of Science')throw Error('Verified history was not exported to extension');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#app-shell').waitFor({state:'visible',timeout:15000});
  await page.locator('details.sidebar-more summary').click();
  await page.locator('[data-view="manage"]').click();
  const persisted=await page.locator('details.simple-secondary').filter({hasText:/JobOS Apply · master profile/}).first().textContent();
  if(!persisted.includes('verified')||!persisted.includes('Which analytics tools have you used?'))throw Error('JobOS Apply profile/answers not persisted in encrypted vault');
  if(!persisted.includes('QA Marketing Studio')||!persisted.includes('QA University'))throw Error('JobOS Apply employment/education did not persist after reload');
  await page.locator('details.simple-secondary').filter({hasText:/JobOS Apply · master profile/}).first().locator('summary').click();
  const suggestions={
    format:'jobos-resume-suggestions-v1',
    profile:{firstName:'Test',lastName:'Candidate',email:'candidate@example.com'},
    experience:[{company:'Resume Imported Sample',title:'Analytics Specialist',startDate:'2021-01',endDate:'2023-09',description:'Imported but not yet verified'}],
    education:[{school:'Resume Sample School',degree:'Associate Degree',endDate:'2012'}]
  };
  await page.locator('#apply-resume-import').setInputFiles({name:'test-resume-suggestions.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(suggestions))});
  const closed=page.locator('details.simple-secondary').filter({hasText:/JobOS Apply · master profile/}).first();
  await page.waitForFunction(()=>document.querySelector('#view-root')?.textContent?.includes('Resume Imported Sample'),null,{timeout:12000});
  if(!(await closed.textContent()).includes('Resume Imported Sample'))throw Error('Resume suggestions were not imported');
  await closed.locator('summary').click();
  await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__jobosApplyCopied=text;}}});});
  await page.locator('[data-action="applycopyprofile"]').click();
  let beforeConfirmation=JSON.parse(await page.evaluate(()=>window.__jobosApplyCopied));
  if(beforeConfirmation.experience.some(x=>x.company==='Resume Imported Sample')||beforeConfirmation.education.some(x=>x.school==='Resume Sample School'))throw Error('Unverified résumé suggestions were exported to extension');
  await page.locator('[data-action="applyeditentry"][data-kind="experience"]').last().click();
  await page.locator('.apply-entry-form[data-kind="experience"] [name="title"]').fill('Verified Analytics Specialist');
  await page.locator('.apply-entry-form[data-kind="experience"] [name="confirmEntry"]').check();
  await page.locator('.apply-entry-form[data-kind="experience"] button[type="submit"]').click();
  const edited=page.locator('details.simple-secondary').filter({hasText:/JobOS Apply · master profile/}).first();
  await edited.locator('summary').click();
  await page.locator('[data-action="applycopyprofile"]').click();
  const afterConfirmation=JSON.parse(await page.evaluate(()=>window.__jobosApplyCopied));
  if(!afterConfirmation.experience.some(x=>x.company==='Resume Imported Sample'&&x.title==='Verified Analytics Specialist'))throw Error('Reviewed imported experience not exported');
  if(afterConfirmation.education.some(x=>x.school==='Resume Sample School'))throw Error('Unverified imported education exported');
  console.log('PASS private résumé suggestions: unverified imported, excluded from autofill, reviewed entry exported');
  const applyQuestions=page.locator('details.simple-secondary').filter({hasText:/JobOS Apply · master profile/}).first();
  await applyQuestions.locator('summary').click();
  await page.locator('#apply-common-form [data-question="When could you start a new position?"]').fill('Two weeks after accepting an offer');
  await page.locator('#apply-common-form [name="confirmCommon"]').check();
  await page.locator('#apply-common-form button[type="submit"]').click();
  const panelAfterAnswer=page.locator('details.simple-secondary').filter({hasText:/JobOS Apply · master profile/}).first();
  await panelAfterAnswer.locator('summary').click();
  await page.locator('details.simple-secondary').filter({hasText:/Private declarations · veteran/}).first().locator('summary').click();
  await page.locator('#apply-private-form [name="veteran"]').selectOption('review');
  await page.locator('#apply-private-form [name="disability"]').selectOption('prefer');
  await page.locator('#apply-private-form button[type="submit"]').first().click();
  const panelAfterPrivate=page.locator('details.simple-secondary').filter({hasText:/JobOS Apply · master profile/}).first();
  await panelAfterPrivate.locator('summary').click();
  await page.locator('[data-action="applycopyprofile"]').click();
  const questionnairePack=JSON.parse(await page.evaluate(()=>window.__jobosApplyCopied));
  if(!questionnairePack.answers.some(a=>a.question==='When could you start a new position?'&&a.answer==='Two weeks after accepting an offer'))
    throw Error('Verified common question not included in autofill export');
  if(JSON.stringify(questionnairePack).includes('applicationPrivateAnswers')||JSON.stringify(questionnairePack).includes('"veteran"')||JSON.stringify(questionnairePack).includes('"disability"'))
    throw Error('Private declarations leaked to extension export');
  console.log('PASS verified common answers and private declaration exclusion');
  console.log('PASS encrypted JobOS Apply profile verification, exact answers, export and reload');
  console.log('PASS JobOS Open Draft: recipient, subject, body, and sent-queue transition');
  await page.locator('#lock-button').click();
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#unlock-screen').waitFor({state:'visible',timeout:10000});
  if(!(await page.locator('#app-shell').evaluate(el=>el.hidden)))throw Error('Lock & forget did not revoke remembered browser key');
  console.log('PASS remembered key revoked by Lock & forget');


}finally{await browser.close();}
