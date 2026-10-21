"""Optional browser smoke test; start the demo on PORT (default 8004) first.
Requires Playwright and Chromium only for this test, not for the application.
Uses unique sample accounts; run against a disposable development database.
"""
import os
import io,json,time,urllib.request,http.cookiejar
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright
base=os.environ.get('RFC_TEST_URL','http://127.0.0.1:8004')
jar=http.cookiejar.CookieJar();opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
def request(path,data=None,method='POST'):
    req=urllib.request.Request(base+'/api/portal/'+path,data=json.dumps(data).encode() if data is not None else None,method=method,headers={'Content-Type':'application/json','X-Requested-With':'fetch'})
    with opener.open(req) as response:return json.load(response)
request('login',{'email':'gym@demo.rfc.test','password':'RfcDemo2026!'})
code=request('state',method='GET')['organization'][0]['join_code']
image=Image.new('RGB',(200,240),'#aeaeae');image.save('/tmp/rfc-test-fighter.jpg')
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('RFC_CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1920,'height':1080});errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto(base+'/portal.html')
    page.get_by_role('heading',name='The rankings.',exact=True).wait_for()
    assert page.get_by_role('link',name='Directory',exact=True).count()==0
    assert page.locator('.category-tabs > a').count()==2
    for selector in ('.nav-shell','.portal-shell'):
        box=page.locator(selector).bounding_box();assert abs(box['x']-(1920-box['width'])/2)<1,(selector,box)
    page.screenshot(path='/tmp/rfc-rankings-redesign.png',full_page=True)
    page.locator('#account-controls a[href="#register"]').click()
    page.get_by_role('heading',name='Create your account.',exact=True).wait_for()
    page.screenshot(path='/tmp/rfc-register-redesign.png',full_page=True)
    name='QA Journey Fighter'
    page.get_by_label('Full name',exact=True).fill(name)
    page.get_by_label('Email address',exact=True).fill('journey-'+str(int(time.time()))+'@demo.rfc.test')
    page.get_by_label('Create a password',exact=True).fill('JourneyTest2026!')
    page.get_by_role('button',name='Continue',exact=False).click()
    page.get_by_role('heading',name='Make it yours.',exact=True).wait_for()
    page.locator('#registration-photo').set_input_files('/tmp/rfc-test-fighter.jpg')
    page.get_by_label('Lightweight',exact=True).check()
    page.get_by_label('Country',exact=True).fill('Ireland')
    page.locator('summary').filter(has_text='Connect my gym').click()
    page.get_by_label('Gym invitation code',exact=True).fill(code)
    page.get_by_role('button',name='Find gym',exact=True).click()
    page.get_by_text('Demo Emerald Gym',exact=True).wait_for()
    page.get_by_label('Coach (optional)',exact=True).select_option(label='Demo Casey Coach')
    page.get_by_role('button',name='Continue',exact=False).click()
    page.get_by_role('heading',name='Ready to step in?',exact=True).wait_for()
    page.get_by_role('button',name='Create fighter account',exact=False).click()
    page.get_by_role('heading',name='Your fighter profile.',exact=True).wait_for()
    page.get_by_role('heading',name='Demo Emerald Gym',exact=True).wait_for()
    assert page.locator('.avatar-hero').get_attribute('src').startswith('assets/uploads/fighters/')
    assert page.locator('a[href="#directory"]').count()==0
    profile=page.locator('[data-form="fighter-profile"]')
    profile.locator('[name="nickname"]').fill('The Test')
    profile.locator('[name="biography"]').fill('A sample fighter journey for stakeholder testing.')
    profile.get_by_role('button',name='Save profile',exact=False).click()
    page.get_by_text('Your profile has been updated.',exact=True).wait_for()
    page.reload();page.get_by_role('heading',name='Your fighter profile.',exact=True).wait_for()
    assert page.locator('[name="nickname"]').input_value()=='The Test'
    page.screenshot(path='/tmp/rfc-fighter-redesign.png',full_page=True)
    page.locator('#portal-navigation a[href="#events"]').click()
    page.get_by_role('link',name='View event',exact=False).first.click()
    page.locator('[data-form="entry"] select').select_option(label=name)
    page.get_by_role('button',name='Register fighter',exact=True).click()
    page.get_by_text('Registration confirmed.',exact=False).wait_for()
    page.locator('#portal-navigation a[href="#fighter"]').click()
    page.get_by_role('heading',name='Your fighter profile.',exact=True).wait_for()
    assert page.locator('.event-entry').count()==1
    for width in (360,390,768,1440,1920):
        page.set_viewport_size({'width':width,'height':1000})
        for route in ('fighter','rankings-featherweight','rankings-lightweight'):
            page.goto(base+'/portal.html#'+route)
            page.locator('#portal-app h1').wait_for()
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),(width,route)
        if width==390:page.screenshot(path='/tmp/rfc-rankings-mobile.png',full_page=True)
    assert not errors,errors
    browser.close()
    print('PASS: centered 1920px layout; 3-step fighter signup with photo/category/gym/coach; own profile editing persists; event entry; two ranking categories; no directory; 360/390/768/1440/1920px layouts; no JS errors')
