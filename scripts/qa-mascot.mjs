import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const browser = await chromium.launch({ headless: true });
await fs.mkdir('/root/jrc/qa', { recursive: true });
for (const [name,width,height] of [['desktop',1280,720],['mobile',390,844]]) {
 const page = await browser.newPage({ viewport: { width, height } });
 const errors=[]; page.on('console',m=>{if(m.type()==='error') errors.push(m.text())}); page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.QA_URL ?? 'http://127.0.0.1:4174/',{waitUntil:'networkidle'});
 const video=page.locator('[data-testid="hero-mascot-video"]'); await video.waitFor();
 await page.waitForFunction(()=>{const v=document.querySelector('[data-testid="hero-mascot-video"]');return v&&v.readyState>=3&&!v.paused&&v.currentTime>.15});
 const a=await video.evaluate(v=>({readyState:v.readyState,currentTime:v.currentTime,paused:v.paused,box:v.getBoundingClientRect().toJSON(),opacity:getComputedStyle(v).opacity,scrollWidth:document.documentElement.scrollWidth,innerWidth}));
 await page.waitForTimeout(500); const b=await video.evaluate(v=>v.currentTime);
 const path=`/root/jrc/qa/mascot-${name}.png`; await page.screenshot({path,fullPage:false});
 console.log(JSON.stringify({name,...a,currentTimeAfter500ms:b,advanced:b>a.currentTime,errors,screenshot:path})); await page.close();
}
await browser.close();
