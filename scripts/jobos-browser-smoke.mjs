import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});
try{
  await page.goto('http://127.0.0.1:4173/levios-outreach/',{waitUntil:'domcontentloaded',timeout:20000});
  await page.locator('#vault-pass').fill('jobos-test-passphrase-2026');
  await page.locator('#vault-confirm').fill('jobos-test-passphrase-2026');
  await page.locator('#vault-submit').click();
  await page.locator('#app-shell').waitFor({state:'visible',timeout:15000});
  await page.waitForTimeout(3500);
  const overview=await page.locator('#view-root').innerText();
  await page.locator('[data-view="career"]').click();
  await page.waitForTimeout(1000);
  const jobs=await page.locator('#view-root').innerText();
  const result={errors,overview:overview.slice(0,1800),jobs:jobs.slice(0,2500),hasHoneycomb:jobs.includes('Marketing Ops Analyst'),hasHarrow:jobs.includes('Marketing Operations Coordinator')};
  console.log(JSON.stringify(result,null,2));
  if(errors.some(s=>/ReferenceError|TypeError|SyntaxError|is not defined|Cannot read/.test(s)))throw Error('Browser runtime errors detected');
  if(!result.hasHoneycomb||!result.hasHarrow)throw Error('Public starter jobs did not appear in Employment after vault unlock');
}finally{await browser.close();}
