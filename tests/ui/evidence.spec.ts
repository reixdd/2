import {test,expect} from '@playwright/test'

test('archive exports original evidence and developer validation rejects a forged verdict',async({page})=>{
 await page.goto('/');await page.evaluate(()=>localStorage.setItem('colosseum:evidence:v1',JSON.stringify([{id:'test-only',timestamp:1000,challengeId:'the-first-sigil',challengeName:'The First Sigil',discipline:'Mathematics',contenderId:'capybara-sage',contenderName:'Capybara',correct:true,latencyMs:10,extracted:'297',response:'ANSWER: 297'}])));
 await page.goto('/battle-archive');await expect(page.getByRole('heading',{name:'Capybara',exact:true})).toBeVisible();const d=page.waitForEvent('download');await page.getByRole('button',{name:'Export local JSON',exact:true}).click();expect((await d).suggestedFilename()).toBe('colosseum-archive-export.json');
 await page.goto('/developers');await page.getByLabel('Validate evidence file').setInputFiles({name:'forged.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify([{id:'forged',contenderId:'capybara-sage',challengeId:'the-first-sigil',response:'ANSWER: 8',extracted:'8',correct:true,claimedLevel:'graded',source:'owner-curated'}]))});await expect(page.getByText('0 accepted · 1 rejected.',{exact:false})).toBeVisible();await expect(page.getByText(/Re-grading says incorrect/)).toBeVisible();
})

