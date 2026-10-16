import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const url = 'http://127.0.0.1:4173';
const storageKey = 'sb-exajrwxoijmgljcvigyj-auth-token';
const mockUser = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'android-layout-test@example.invalid',
  role: 'authenticated',
  aud: 'authenticated',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { full_name: 'Layout Test' },
  created_at: new Date().toISOString(),
};
const jwtPayload = {
  exp: 4102444800, iat: 1700000000,
  sub: mockUser.id, role: 'authenticated',
  aud: 'authenticated', iss: 'https://fake.invalid/auth/v1',
};
const enc = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
const token = enc({ alg: 'HS256', typ: 'JWT' }) + '.' + enc(jwtPayload) + '.test';
const session = {
  access_token: token, refresh_token: 'test-refresh-token', token_type: 'bearer',
  expires_at: 4102444800, expires_in: 3600, user: mockUser,
};

async function mockBackend(route) {
  const request = route.request();
  const path = new URL(request.url()).pathname;
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'content-range': '0-665/666',
    'cache-control': 'no-store',
  };
  if (request.method() === 'OPTIONS') {
    await route.fulfill({status:204,headers});
    return;
  }
  if (path.includes('/auth/v1/user')) {
    await route.fulfill({status:200,headers,body:JSON.stringify(mockUser)});
    return;
  }
  let body = [];
  if (path.includes('/view_customer_balances')) {
    body = [{outstanding_balance:25215000,customer_id:'22222222-2222-4222-8222-222222222222',status:'DUE'}];
  } else if (path.endsWith('/customers')) {
    body = [{
      id:'22222222-2222-4222-8222-222222222222',
      name:'Demo Customer',
      phone:'9999999999', diary_id:'33333333-3333-4333-8333-333333333333',
      balance:13000,address:'Example address',
    }];
  } else if (path.endsWith('/diaries')) {
    body = [{id:'33333333-3333-4333-8333-333333333333',name:'Demo diary'}];
  } else if (path.endsWith('/users')) {
    body = [mockUser];
  } else if (path.endsWith('/payments')) {
    body = [{amount:10000, date:'2026-10-16'}];
  } else if (path.endsWith('/transactions')) {
    body = [{total_amount:189000,date:'2026-10-15',
      id:'44444444-4444-4444-8444-444444444444',
      due_date:'2026-10-18',customers:{id:'22222222-2222-4222-8222-222222222222',name:'Demo Customer'},
    }];
  }
  await route.fulfill({
    status:200,headers,body:request.method()==='HEAD'?'':JSON.stringify(body)
  });
}

const sizes = [
  {width:320,height:640},
  {width:360,height:740},
  {width:393,height:852},
  {width:430,height:932},
  {width:768,height:1024},
];
await fs.mkdir('android-ui-screenshots',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
try {
  for (const size of sizes) {
    const context=await browser.newContext({viewport:size,isMobile:true,hasTouch:true,deviceScaleFactor:2});
    await context.addInitScript(([key,data])=>{
      localStorage.setItem(key, data);
    },[storageKey,JSON.stringify(session)]);
    await context.route('**/rest/v1/**',mockBackend);
    await context.route('**/auth/v1/**',mockBackend);
    await context.route('**/storage/v1/**',mockBackend);
    const page=await context.newPage();
    const pageErrors=[];
    page.on('pageerror',error=>pageErrors.push(error.message));
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForSelector('.zl-dashboard .zl-hero',{timeout:20000});

    const state=await page.evaluate(()=>{
      const scroller=document.querySelector('.zl-workspace-scroll');
      return {
        height:scroller?.clientHeight,
        scrollHeight:scroller?.scrollHeight,
        bodyWidth:document.documentElement.scrollWidth,
        windowWidth:window.innerWidth,
        actualOverflow:scroller?.scrollHeight - scroller?.clientHeight,
      };
    });
    assert.ok(state.height>100,JSON.stringify({size,state,reason:'scroller height'}));
    assert.ok(state.actualOverflow>100,JSON.stringify({size,state,reason:'dashboard content not scrollable'}));
    assert.ok(state.bodyWidth <= state.windowWidth+4,JSON.stringify({size,state,reason:'horizontal clipping'}));
    await page.screenshot({path:'android-ui-screenshots/dashboard-top-'+size.width+'.png',fullPage:false});
    await page.mouse.move(size.width/2,size.height/2);
    await page.mouse.wheel(0,600);
    await page.waitForTimeout(200);
    const top=await page.locator('.zl-workspace-scroll').evaluate(node=>node.scrollTop);
    assert.ok(top>30,JSON.stringify({size,top,reason:'touch viewport scroll not responding'}));
    await page.screenshot({path:'android-ui-screenshots/dashboard-'+size.width+'.png',fullPage:false});

    await page.getByRole('button',{name:/new sale/i}).first().click();
    const dates=page.locator('input[type="date"]');
    await dates.first().waitFor({state:'visible',timeout:10000});
    assert.equal(await dates.count(),2,'sale has 2 date controls');
    const dateRect=await dates.first().boundingBox();
    assert.ok(dateRect?.width>120,JSON.stringify({size,dateRect,reason:'date width'}));
    const formScrollable=await page.locator('.zl-workspace-scroll').evaluate(node=>node.scrollHeight>node.clientHeight);
    assert.ok(formScrollable,JSON.stringify({size,reason:'sale form cannot scroll'}));
    await page.screenshot({path:'android-ui-screenshots/new-sale-'+size.width+'.png',fullPage:false});
    assert.equal(pageErrors.length,0,JSON.stringify({size,pageErrors}));
    console.log('PASS mobile layout',size.width,'dashboard overflow',state.actualOverflow,'scrolled',top,'date',dateRect?.width);
    await context.close();
  }
} finally {
  await browser.close();
}
