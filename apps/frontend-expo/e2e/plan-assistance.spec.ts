import { test, expect } from '@playwright/test';
const API='http://127.0.0.1:4317',headers={Authorization:'Bearer local-e2e-token'};
for(const theme of ['DARK','LIGHT']) test(`assistance separates choices and preserves consent in ${theme}`,async({page,request})=>{
 await request.post(`${API}/__reset`);await request.patch(`${API}/users/user`,{headers,data:{themeMode:theme,themeBaseColor:'AMBER'}});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/plans?selectedPlan=fitness');
 const rows=page.getByTestId('plan-assistance'),sheet=page.getByTestId('plan-assistance-sheet');
 await expect(rows.getByRole('button',{name:'Schedule · Anytime',exact:true})).toBeVisible();
 await rows.scrollIntoViewIfNeeded();await page.screenshot({path:`test-results/assistance-plan-${theme}.png`});
 await rows.getByRole('button',{name:'Reminders · Off',exact:true}).click();
 await expect(sheet.getByText('Your week is flexible, so there is no session time to remind you about.',{exact:true})).toBeVisible();await sheet.getByRole('button',{name:'Keep reminders off',exact:true}).click();
 await rows.getByRole('button',{name:'Schedule · Anytime',exact:true}).click();await expect(sheet.getByText("When works for you?",{exact:true})).toBeVisible();await page.waitForTimeout(400);await page.screenshot({path:`test-results/assistance-schedule-${theme}.png`});
 await sheet.getByRole('button',{name:'Choose days',exact:true}).click();await sheet.getByRole('button',{name:'Wed',exact:true}).click();await sheet.getByRole('button',{name:'Close',exact:true}).click();
 let state=await(await request.get(`${API}/__state`)).json();expect(state.requests.filter((r:any)=>r.method==='PUT'&&r.path.startsWith('/follow-through/plans'))).toHaveLength(0);
 await rows.getByRole('button',{name:'Schedule · Anytime',exact:true}).click();await sheet.getByRole('button',{name:'Choose days',exact:true}).click();await sheet.getByRole('button',{name:'Wed',exact:true}).click();await sheet.getByRole('button',{name:'Continue',exact:true}).click();await sheet.getByRole('button',{name:'Set a time',exact:true}).click();await sheet.getByLabel('Time',{exact:true}).fill('18:30');await sheet.getByRole('button',{name:'Save schedule',exact:true}).click();
 await expect(rows.getByRole('button',{name:'Schedule · Wed · 18:30',exact:true})).toBeVisible();await rows.getByRole('button',{name:'Reminders · Off',exact:true}).click();await sheet.getByRole('button',{name:'30 minutes before',exact:true}).click();
 await request.post(`${API}/__fail`,{data:{path:'/follow-through/plans/fitness'}});await sheet.getByRole('button',{name:'Save reminder',exact:true}).click();await expect(sheet.getByText(/Simulated network failure/)).toBeVisible();await sheet.getByRole('button',{name:'Save reminder',exact:true}).click();
 await expect(rows.getByRole('button',{name:'Reminders · 30 min before',exact:true})).toBeVisible();
 await rows.getByRole('button',{name:'Weekly review · Off',exact:true}).click();await sheet.getByRole('button',{name:'One weekly review',exact:true}).click();await sheet.getByRole('button',{name:'Sun',exact:true}).click();await sheet.getByRole('button',{name:'Continue',exact:true}).click();await sheet.getByLabel('Time',{exact:true}).fill('19:00');await sheet.getByRole('button',{name:'Save weekly review',exact:true}).click();
 await page.reload();await expect(rows.getByRole('button',{name:'Weekly review · Sun · 19:00',exact:true})).toBeVisible();
 let saved=await(await request.get(`${API}/follow-through`,{headers})).json();expect(saved.state.supports.fitness.preferences).toMatchObject({coaching:true,weeklyReview:true,reviewTime:'19:00',reminder:true,checkIn:false});
 await rows.getByRole('button',{name:'Schedule · Wed · 18:30',exact:true}).click();await sheet.getByRole('button',{name:'Anytime',exact:true}).click();await sheet.getByRole('button',{name:'Save schedule',exact:true}).click();await expect(rows.getByRole('button',{name:'Schedule · Anytime',exact:true})).toBeVisible();
 saved=await(await request.get(`${API}/follow-through`,{headers})).json();expect(saved.state.supports.fitness).toMatchObject({mode:'WEEKLY',time:null,weekdays:[],preferences:{reminder:false,checkIn:false,weeklyReview:true}});expect(errors).toEqual([]);
});
test('day reminders validate time and reviews respect entitlement',async({page,request})=>{
 await request.post(`${API}/__reset`);await request.patch(`${API}/users/user`,{headers,data:{planType:'FREE'}});await page.goto('/plan-support/fitness');const sheet=page.getByTestId('plan-assistance-sheet');
 await page.getByRole('button',{name:'Weekly review · Off',exact:true}).click();await expect(sheet.getByRole('button',{name:'One weekly review',exact:true})).toBeDisabled();await sheet.getByRole('button',{name:'Close',exact:true}).click();
 await page.getByRole('button',{name:'Schedule · Anytime',exact:true}).click();await sheet.getByRole('button',{name:'Choose days',exact:true}).click();await sheet.getByRole('button',{name:'Fri',exact:true}).click();await sheet.getByRole('button',{name:'Continue',exact:true}).click();await sheet.getByRole('button',{name:'Choose on the day',exact:true}).click();await sheet.getByRole('button',{name:'Save schedule',exact:true}).click();
 await page.getByRole('button',{name:'Reminders · Off',exact:true}).click();await sheet.getByRole('button',{name:'Choose a reminder time',exact:true}).click();await sheet.getByLabel('Time',{exact:true}).fill('25:90');await expect(sheet.getByRole('button',{name:'Save reminder',exact:true})).toBeDisabled();await sheet.getByLabel('Time',{exact:true}).fill('09:30');await sheet.getByRole('button',{name:'Save reminder',exact:true}).click();
 const saved=await(await request.get(`${API}/follow-through`,{headers})).json();expect(saved.state.supports.fitness).toMatchObject({mode:'DAYS',time:null,preferences:{coaching:false,reminder:true,dayReminderTime:'09:30'}});
});
test('scheduled tools and existing after-session checks remain editable',async({page,request})=>{
 await request.post(`${API}/__reset`);expect((await request.post(`${API}/__follow-through`,{headers,data:{}})).ok()).toBeTruthy();await page.goto('/plan-support/fitness?tools=1');const sheet=page.getByTestId('plan-assistance-sheet');
 await page.getByRole('button',{name:'Session tools · Timer',exact:true}).click();await sheet.getByRole('button',{name:'Open a resource',exact:true}).click();await sheet.getByLabel('Resource name',{exact:true}).fill('My course');await sheet.getByLabel('Resource link',{exact:true}).fill('https://example.com/course');await sheet.getByRole('button',{name:'Save session tools',exact:true}).click();
 await page.getByRole('button',{name:'After-session check · On',exact:true}).click();await sheet.getByRole('button',{name:'Off',exact:true}).click();await sheet.getByRole('button',{name:'Save check-in',exact:true}).click();
 const saved=await(await request.get(`${API}/follow-through`,{headers})).json();expect(saved.state.supports.fitness).toMatchObject({format:'RESOURCE',resourceName:'My course',preferences:{coaching:true,weeklyReview:true,checkIn:false}});
});
