import {test,expect} from '@playwright/test'

test('world hub remembers keyboard and pointer swipe selection and makes zero API calls',async({page})=>{
 const api:string[]=[];page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))api.push(r.url())})
 await page.goto('/');await expect(page.getByRole('heading',{name:'Capybara',exact:true})).toBeVisible();
 await page.getByLabel('Champion selection').focus();await page.keyboard.press('ArrowRight');await expect(page.getByRole('heading',{name:'Amber',exact:true})).toBeVisible();
 await page.locator('.champion-selector').evaluate(el=>{el.dispatchEvent(new PointerEvent('pointerdown',{clientX:240,clientY:10,bubbles:true}));el.dispatchEvent(new PointerEvent('pointerup',{clientX:110,clientY:12,bubbles:true}))});await expect(page.getByRole('heading',{name:'Polymath',exact:true})).toBeVisible();
 await page.reload();await expect(page.getByRole('heading',{name:'Polymath',exact:true})).toBeVisible();
 await page.getByRole('link',{name:/Enter trial/}).click();await page.getByLabel('Your answer').fill('297');await page.getByRole('button',{name:'Grade it',exact:true}).click();await expect(page.getByRole('status')).toContainText('Correct.');
 expect(api).toEqual([]);await expect(page.locator('body')).not.toContainText('Threat HIGH');
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'.validation/world-desktop.png',fullPage:false});
})

test('full equipment survives reload, clone and mutation preserve actual ancestry',async({page})=>{
 const api:string[]=[];page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))api.push(r.url())})
 await page.goto('/workshop');await page.getByRole('button',{name:'Create build',exact:true}).click();await page.getByLabel('Champion name').fill('Proof champion');
 const proof=page.locator('.inventory-node').filter({hasText:'Proof Scaffolding'});await proof.getByRole('button',{name:'Equip',exact:true}).click();
 const socratic=page.locator('.inventory-node').filter({hasText:'Socratic Inquiry'});await socratic.getByRole('button',{name:'Equip',exact:true}).click();
 await page.getByLabel('Core instructions').fill('Check every assumption.');await page.getByRole('button',{name:'Save champion',exact:true}).click();await expect(page.getByRole('status')).toContainText('Saved revision');
 await page.reload();await expect(page.getByLabel('Champion name')).toHaveValue('Proof champion');await expect(page.getByLabel('Equipped abilities')).toContainText('Proof Scaffolding');await expect(page.getByLabel('Equipped abilities')).toContainText('Socratic Inquiry');
 await page.getByText('Inspect complete instructions',{exact:false}).click();await expect(page.locator('pre').first()).toContainText('formal proof');await expect(page.locator('pre').first()).toContainText('assuming');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export build',exact:true}).click();expect((await download).suggestedFilename()).toBe('colosseum-champion.json');
 await page.goto('/mutation-lab');await page.getByRole('button',{name:'Clone a variant',exact:true}).click();await page.getByLabel('Variant name').fill('Proof mutation');await page.getByRole('button',{name:'Fermi Estimation +',exact:true}).click();await page.getByRole('button',{name:'Save mutation',exact:true}).click();await expect(page.getByRole('status')).toContainText('Mutation saved');
 await page.goto('/lineage');await expect(page.locator('.lineage-node.child')).toContainText('Parent: Proof champion at v1');await expect(page.locator('.lineage-node.child')).toContainText('+ Fermi Estimation');expect(api).toEqual([]);
 await page.screenshot({path:'.validation/lineage.png',fullPage:true});
})

test('skill constellation equips an actual saved instruction and explains locked capabilities',async({page})=>{
 await page.goto('/workshop');await page.getByRole('button',{name:'Create build',exact:true}).click();await page.getByLabel('Champion name').fill('Ledger scholar');await page.getByRole('button',{name:'Save champion',exact:true}).click();await expect(page.getByRole('status')).toContainText('Saved revision');
 await page.goto('/skills');await page.getByLabel('Equip to saved build').selectOption({label:'Ledger scholar · v1'});await page.getByRole('button',{name:/Ledger Interpretation/}).click();await expect(page.getByRole('dialog')).toContainText('Instruction modifier');await page.getByRole('button',{name:'Equip instruction',exact:true}).click();await expect(page.getByRole('status')).toContainText('Saved v2');
 await page.getByRole('button',{name:/Sandboxed Execution/}).click();await expect(page.getByRole('dialog')).toContainText('isolated code-execution sandbox');await expect(page.getByRole('button',{name:'Equip instruction',exact:true})).toBeDisabled();await page.keyboard.press('Escape');
 await page.goto('/workshop');await expect(page.getByLabel('Equipped abilities')).toContainText('Ledger Interpretation');
})

test('archive exports original evidence and developer validation rejects a forged verdict',async({page})=>{
 await page.goto('/');await page.evaluate(()=>localStorage.setItem('colosseum:evidence:v1',JSON.stringify([{id:'test-only',timestamp:1000,challengeId:'the-first-sigil',challengeName:'The First Sigil',discipline:'Mathematics',contenderId:'capybara-sage',contenderName:'Capybara',correct:true,latencyMs:10,extracted:'297',response:'ANSWER: 297'}])));
 await page.goto('/battle-archive');await expect(page.getByRole('heading',{name:'Capybara',exact:true})).toBeVisible();const d=page.waitForEvent('download');await page.getByRole('button',{name:'Export local JSON',exact:true}).click();expect((await d).suggestedFilename()).toBe('colosseum-archive-export.json');
 await page.goto('/developers');await page.getByLabel('Validate evidence file').setInputFiles({name:'forged.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify([{id:'forged',contenderId:'capybara-sage',challengeId:'the-first-sigil',response:'ANSWER: 8',extracted:'8',correct:true,claimedLevel:'graded',source:'owner-curated'}]))});await expect(page.getByText('0 accepted · 1 rejected.',{exact:false})).toBeVisible();await expect(page.getByText(/Re-grading says incorrect/)).toBeVisible();
})

test('Ledger Island grades source mismatch, decimals and token-account limitations',async({page})=>{
 const requests:string[]=[];page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:8791'))requests.push(r.url())});await page.goto('/solana');await page.getByLabel('Displayed token supply').fill('1000');await page.getByLabel('Sum of account balances').fill('10');await page.getByLabel('Concentration conclusion').selectOption('cannot-combine');await page.getByLabel('Unique holders conclusion').selectOption('unknown');await page.getByRole('button',{name:'Check research findings'}).click();await expect(page.getByRole('status')).toContainText('4 / 4 findings accepted');expect(requests).toEqual([]);
})

test('mobile world navigation, reduced motion and honest empty podium remain usable',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await page.getByText('Explore the world',{exact:true}).click();await expect(page.getByRole('navigation',{name:'Mobile world destinations'}).getByRole('link',{name:'Mutation Lab'})).toBeVisible();await page.getByRole('navigation',{name:'Mobile world destinations'}).getByRole('link',{name:'Leaderboards'}).click();await expect(page.getByText('The podium awaits its evidence.')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.goto('/');expect(await page.locator('.world-cloud').first().evaluate(el=>getComputedStyle(el).animationName)).toBe('none');await page.screenshot({path:'.validation/world-mobile.png',fullPage:true});
})
