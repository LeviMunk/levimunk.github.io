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
  await page.goto('http://127.0.0.1:4173/levios-outreach/',{waitUntil:'domcontentloaded',timeout:20000});
  await page.locator('#vault-pass').fill('jobos-test-passphrase-2026');
  await page.locator('#vault-confirm').fill('jobos-test-passphrase-2026');
  await page.locator('#vault-submit').click();
  await page.locator('#app-shell').waitFor({state:'visible',timeout:15000});
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
}finally{await browser.close();}
