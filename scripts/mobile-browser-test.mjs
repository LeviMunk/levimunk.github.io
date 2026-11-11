import { chromium, webkit, devices } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:4173/';
const pages = [
  ['home','index.html'],
  ['work','work.html'],
  ['resume','resume.html'],
  ['contact','contact.html'],
  ['marketing-analytics','projects/marketing-analytics.html'],
  ['studio-growth','projects/studio-growth.html'],
  ['tableos','projects/tableos.html'],
];
const targets = [
  ['android-chromium',chromium,devices['Pixel 7']],
  ['iphone-webkit',webkit,devices['iPhone 13']],
];
const report = [];
await mkdir('mobile-test-results',{recursive:true});
for (const [browserName, browserType, device] of targets) {
  const browser = await browserType.launch({headless:true});
  try {
    const context = await browser.newContext({...device,reducedMotion:'reduce'});
    for (const [label,route] of pages) {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror',error=>errors.push(error.message));
      page.on('crash',()=>errors.push('Browser page crashed'));
      const result = {browser:browserName,page:label,route,passed:true,problems:[]};
      try {
        const response = await page.goto(new URL(route,base).href,{waitUntil:'load',timeout:30000});
        if (!response || !response.ok()) throw new Error(`Page HTTP ${response?.status() ?? 'unavailable'}`);
        await page.locator('h1').first().waitFor({state:'visible',timeout:10000});
        await page.waitForTimeout(400);
        const state = await page.evaluate(()=>({
          width:document.documentElement.clientWidth,
          scrollWidth:document.documentElement.scrollWidth,
          heading:document.querySelector('h1')?.textContent?.trim() ?? '',
        }));
        if (state.scrollWidth>state.width+3)
          result.problems.push(`Horizontal overflow: ${state.scrollWidth}px > ${state.width}px`);
        if (!state.heading) result.problems.push('Empty H1');
        result.problems.push(...errors);
        await page.screenshot({path:`mobile-test-results/${browserName}-${label}.png`,fullPage:true,animations:'disabled'});
      } catch (error) {
        result.problems.push(String(error.message ?? error));
        await page.screenshot({path:`mobile-test-results/${browserName}-${label}-failure.png`,animations:'disabled',timeout:5000}).catch(()=>{});
      } finally { await page.close(); }
      result.passed = result.problems.length===0;
      report.push(result);
      console.log(`${result.passed?'PASS':'FAIL'} ${browserName} ${label}${result.problems.length?' — '+result.problems.join('; '):''}`);
    }
    await context.close();
  } finally { await browser.close(); }
}
await writeFile('mobile-test-results/results.json',JSON.stringify(report,null,2));
const failed=report.filter(r=>!r.passed);
console.log(`Mobile tests: ${report.length-failed.length}/${report.length} passed`);
if(failed.length) process.exitCode=1;
