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
    body = [{
      outstanding_balance:25215000, customer_id:'22222222-2222-4222-8222-222222222222',
      customer_name:'Demo Customer', credit_limit:120000, status:'OVER_LIMIT'
    }];
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

    // All requests remain intercepted. Never create customers or transactions in Supabase.
    await page.goBack();
    await page.waitForSelector('.zl-dashboard .zl-hero',{timeout:10000});
    const mobileNav = page.getByRole('navigation',{name:'Mobile navigation'});
    await mobileNav.getByRole('button',{name:'Customers'}).click();
    await page.getByPlaceholder('Search Name or Phone...').waitFor({state:'visible',timeout:10000});
    await page.getByText('Demo Customer',{exact:true}).first().waitFor({state:'visible',timeout:10000});
    const customersSearch = page.getByPlaceholder('Search Name or Phone...');
    const searchWidth = (await customersSearch.boundingBox())?.width || 0;
    assert.ok(searchWidth > Math.min(size.width * .62,230),JSON.stringify({size,searchWidth,reason:'customer search field clipped'}));
    await customersSearch.fill('demo');
    await page.getByText('Demo Customer',{exact:true}).first().waitFor();
    await customersSearch.fill('999999');
    await page.getByText('Demo Customer',{exact:true}).first().waitFor();
    await customersSearch.fill('zz-no-customer');
    await page.getByText('No customers found',{exact:true}).waitFor();
    await customersSearch.fill('');
    await page.getByText('Demo Customer',{exact:true}).first().waitFor();
    await page.screenshot({path:'android-ui-screenshots/customers-'+size.width+'.png',fullPage:false});
    const customerOverflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
    assert.ok(customerOverflow<=4,JSON.stringify({size,customerOverflow,reason:'customers page horizontal overflow'}));

    await mobileNav.getByRole('button',{name:'Recovery'}).click();
    await page.getByRole('heading',{name:'Recovery Dashboard'}).waitFor({state:'visible',timeout:10000});
    await page.locator('[data-testid="mobile-recovery-accounts"]').waitFor();
    await page.getByPlaceholder('Search debtor name...').fill('demo');
    await page.locator('[data-testid="mobile-recovery-accounts"]').getByText('Demo Customer',{exact:true}).first().waitFor();
    await page.getByPlaceholder('Search debtor name...').fill('zz-no-customer');
    await page.locator('[data-testid="mobile-recovery-accounts"]').getByText('No matching debtor accounts.').waitFor();
    await page.getByPlaceholder('Search debtor name...').fill('');
    const recoveryScroll=await page.locator('.zl-workspace-scroll').evaluate(node=>({
      height:node.clientHeight,scrollHeight:node.scrollHeight
    }));
    assert.ok(recoveryScroll.scrollHeight>recoveryScroll.height+30,JSON.stringify({size,recoveryScroll,reason:'recovery cannot scroll'}));
    await page.locator('.zl-workspace-scroll').evaluate(node=>node.scrollTo(0,node.scrollHeight));
    await page.screenshot({path:'android-ui-screenshots/recovery-'+size.width+'.png',fullPage:false});
    await page.locator('.zl-workspace-scroll').evaluate(node=>node.scrollTo(0,0));

    await mobileNav.getByRole('button',{name:'More navigation options'}).click();
    await page.getByRole('dialog',{name:'More navigation'}).getByRole('button',{name:'Reports'}).click();
    await page.getByRole('heading',{name:'Enterprise Reports'}).waitFor({state:'visible',timeout:10000});
    await page.getByRole('button',{name:'This Week'}).click();
    await page.getByRole('button',{name:'All Time'}).click();
    const reportScroll=await page.locator('.zl-workspace-scroll').evaluate(node=>({
      height:node.clientHeight,scrollHeight:node.scrollHeight
    }));
    assert.ok(reportScroll.scrollHeight>reportScroll.height+30,JSON.stringify({size,reportScroll,reason:'reports cannot scroll'}));
    await page.locator('.zl-workspace-scroll').evaluate(node=>node.scrollTo(0,node.scrollHeight));
    await page.getByRole('heading',{name:'Available Reports'}).waitFor({state:'attached'});
    await page.screenshot({path:'android-ui-screenshots/reports-'+size.width+'.png',fullPage:false});

    const lastOverflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
    assert.ok(lastOverflow<=4,JSON.stringify({size,lastOverflow,reason:'reports page horizontal overflow'}));
    assert.equal(pageErrors.length,0,JSON.stringify({size,pageErrors}));
    console.log('PASS full Android QA',size.width,'customer search, recovery cards, reports filters, scrolling, date picker');
    await context.close();
  }
} finally {
  await browser.close();
}
