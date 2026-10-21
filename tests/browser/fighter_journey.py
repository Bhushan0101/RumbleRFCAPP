"""Paid application -> approval -> event entry browser smoke test.
Run against a disposable W.U.C.O demo server. Playwright/Chromium are test-only dependencies.
"""
import os,io,json,time,urllib.request,http.cookiejar
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright
base=os.environ.get('WUCO_TEST_URL',os.environ.get('RFC_TEST_URL','http://127.0.0.1:8006'))
jar=http.cookiejar.CookieJar();opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
def request(path,data=None,method='POST'):
    req=urllib.request.Request(base+'/api/portal/'+path,data=json.dumps(data).encode() if data is not None else None,method=method,headers={'Content-Type':'application/json','X-Requested-With':'fetch'})
    with opener.open(req) as response:return json.load(response)
request('login',{'email':'gym@demo.wuco.test','password':'WucoDemo2026!'})
code=request('state',method='GET')['organization'][0]['join_code']
Image.new('RGB',(200,240),'#aeaeae').save('/tmp/wuco-test-fighter.jpg')
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('RFC_CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':1440,'height':1000});page=context.new_page()
    admin_context=browser.new_context(viewport={'width':1440,'height':1000});admin=admin_context.new_page()
    anonymous=browser.new_context();errors=[]
    for tab in (page,admin):tab.on('pageerror',lambda error:errors.append(str(error)))
    name='WUCO Applicant '+str(int(time.time()));email='journey-'+str(int(time.time()))+'@demo.wuco.test'
    page.goto(base+'/portal.html#register')
    page.get_by_role('heading',name='Create your account.',exact=True).wait_for()
    page.get_by_label('Full name',exact=True).fill(name)
    page.get_by_label('Email address',exact=True).fill(email)
    page.get_by_label('Create a password',exact=True).fill('JourneyTest2026!')
    page.get_by_role('button',name='Continue',exact=False).click()
    page.get_by_role('heading',name='Make it yours.',exact=True).wait_for()
    page.locator('#registration-photo').set_input_files('/tmp/wuco-test-fighter.jpg')
    page.get_by_label('Lightweight',exact=True).check();page.get_by_label('Country',exact=True).fill('Ireland')
    page.locator('summary').filter(has_text='Connect my gym').click()
    page.get_by_label('Gym invitation code',exact=True).fill(code)
    page.get_by_role('button',name='Find gym',exact=True).click()
    page.get_by_text('Demo Emerald Gym',exact=True).wait_for()
    page.get_by_label('Coach (optional)',exact=True).select_option(label='Demo Casey Coach')
    page.get_by_role('button',name='Continue',exact=False).click()
    page.get_by_role('heading',name='Ready to step in?',exact=True).wait_for()
    page.get_by_role('button',name='Create application',exact=False).click()
    page.get_by_role('heading',name='Your fighter application.',exact=True).wait_for()
    page.get_by_role('heading',name='Application fee due',exact=True).wait_for()
    own=page.request.get(base+'/api/portal/state').json();aid=own['profile'][0]['athlete_id']
    assert aid not in [f['id'] for f in anonymous.request.get(base+'/api/portal/state').json()['fighters']]
    page.get_by_role('button',name='Open test checkout',exact=False).click()
    page.get_by_role('heading',name='One step closer.',exact=True).wait_for()
    page.get_by_label('I understand this is a test payment and no money will be charged.',exact=True).check()
    page.get_by_role('button',name='Record test payment',exact=False).click()
    page.get_by_role('heading',name='Awaiting admin approval',exact=True).wait_for()
    with page.expect_download() as download:page.get_by_role('link',name='Download test receipt',exact=False).click()
    download.value.save_as('/tmp/wuco-application-receipt.pdf')
    assert Path('/tmp/wuco-application-receipt.pdf').read_bytes().startswith(b'%PDF-')
    assert aid not in [f['id'] for f in anonymous.request.get(base+'/api/portal/state').json()['fighters']]
    page.screenshot(path='/tmp/wuco-application-paid.png',full_page=True)
    admin.goto(base+'/portal.html#account');admin.get_by_text('Try a demo account',exact=True).click()
    admin.get_by_role('button',name='admin',exact=True).click();admin.get_by_role('button',name='Sign in',exact=False).click()
    admin.locator('.account-chip').wait_for();admin.locator('#portal-navigation a[href="#fighters"]').click()
    card=admin.locator('.application-grid>.panel').filter(has=admin.get_by_role('heading',name=name,exact=True))
    card.get_by_label('Decision',exact=True).select_option('approved')
    card.get_by_role('button',name='Save review decision',exact=True).click()
    admin.get_by_text('Review saved.',exact=False).wait_for()
    page.get_by_role('button',name='Refresh status',exact=True).click()
    page.get_by_role('heading',name='Your fighter profile.',exact=True).wait_for()
    assert aid in [f['id'] for f in anonymous.request.get(base+'/api/portal/state').json()['fighters']]
    profile=page.locator('[data-form="fighter-profile"]');profile.locator('[name="nickname"]').fill('The Applicant')
    profile.get_by_role('button',name='Save profile',exact=False).click();page.get_by_text('Your profile has been updated.',exact=True).wait_for()
    page.locator('#portal-navigation a[href="#events"]').click();page.get_by_role('link',name='View event',exact=False).first.click()
    entry=page.locator('[data-form="entry"]');entry.get_by_label('Your fighter profile',exact=True).select_option(str(aid))
    entry.get_by_label('I confirm the fighter details and that I am authorised to submit this event entry.',exact=True).check()
    entry.get_by_role('button',name='Confirm event registration',exact=True).click()
    page.get_by_text('You’re registered.',exact=True).wait_for()
    reference=page.locator('.entry-confirmation').inner_text();assert 'WUCO-E' in reference
    page.once('dialog',lambda dialog:dialog.accept());page.get_by_role('button',name='Withdraw entry',exact=True).click()
    page.get_by_text('Event entry withdrawn.',exact=False).wait_for()
    assert page.locator('.entry-confirmation').count()==0
    admin.locator('#portal-navigation a[href="#finance"]').click();admin.get_by_role('heading',name='Payments & receipts.',exact=True).wait_for()
    assert admin.locator('tbody tr').filter(has_text=name).count()==1
    assert '€0.00' in admin.locator('.finance-metrics .panel').first.inner_text()
    with admin.expect_download() as export:admin.get_by_role('button',name='Download CSV',exact=False).click()
    export.value.save_as('/tmp/wuco-finance.csv');assert name in Path('/tmp/wuco-finance.csv').read_text()
    admin.screenshot(path='/tmp/wuco-finance-report.png',full_page=True)
    for width in (360,390,768,1440,1920):
        page.set_viewport_size({'width':width,'height':1000});admin.set_viewport_size({'width':width,'height':1000})
        for route in ('fighter','rankings-featherweight','rankings-lightweight'):
            page.goto(base+'/portal.html#'+route);page.locator('#portal-app h1').wait_for()
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),(width,route)
        admin.goto(base+'/portal.html#finance');admin.get_by_role('heading',name='Payments & receipts.',exact=True).wait_for()
        assert admin.evaluate('document.documentElement.scrollWidth <= innerWidth'),(width,'finance')
    assert not errors,errors
    browser.close()
    print('PASS: W.U.C.O signup/photo -> test EUR10 payment -> PDF receipt -> private paid review -> admin approval -> public profile -> event confirmation/withdrawal -> finance CSV; responsive 360..1920px; no JS errors')
