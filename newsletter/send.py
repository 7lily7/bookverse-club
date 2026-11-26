import os,json,urllib.error,urllib.request,urllib.parse,datetime,html,string,pathlib,sys
from zoneinfo import ZoneInfo
import smtplib, ssl
from email.message import EmailMessage
from email.utils import formataddr, make_msgid
P=pathlib.Path(__file__).parent
SITE='https://7lily7.github.io/bookverse-club/'
URL=os.environ['SUPABASE_URL'].rstrip('/')+'/rest/v1/'
KEY=os.environ['SUPABASE_SERVICE_ROLE_KEY']
def req(url,method='GET',data=None,headers=None):
    r=urllib.request.Request(url,data=None if data is None else json.dumps(data).encode(),method=method,headers={'Content-Type':'application/json',**(headers or {})})
    with urllib.request.urlopen(r,timeout=30) as f:
        raw=f.read(); return json.loads(raw) if raw else None
def db(path,method='GET',data=None,extra=None):
    try:
        return req(URL+path,method,data,{'apikey':KEY,'Authorization':'Bearer '+KEY,**(extra or {})})
    except urllib.error.HTTPError as e:
        print('API endpoint:', path.split('?')[0], flush=True)
        print('HTTP status:', e.code, flush=True)
        try:
            result=json.loads(e.read())
            code=result.get('code') if isinstance(result,dict) else None
            print('API error code:', code if isinstance(code,str) and code.isalnum() and len(code)<=20 else 'unavailable', flush=True)
        except Exception:
            print('No JSON error response', flush=True)
        raise
def rpc(name,data={}): return db('rpc/'+name,'POST',data)
def rows(table,query=''):
    out=[]
    for start in range(0,100000,500):
        batch=db(table+'?'+query+('&' if query else '')+f'limit=500&offset={start}') or []
        out+=batch
        if len(batch)<500:return out
    raise RuntimeError('Pagination limit reached')
def esc(x):return html.escape(str(x),quote=True)
def prev():
    return (datetime.datetime.now(ZoneInfo('Asia/Shanghai')).date().replace(day=1)-datetime.timedelta(days=1)).strftime('%Y-%m')
def render(period,token=''):
    y,m=map(int,period.split('-')); start=datetime.datetime(y,m,1,tzinfo=ZoneInfo('Asia/Shanghai')); end=(start.replace(day=28)+datetime.timedelta(days=4)).replace(day=1)
    catalog=json.loads((P/'catalog.json').read_text()); year=catalog.get(str(y),[]); current=year[(m-1)*2:m*2]; upcoming=catalog.get(str(end.year),[])[(end.month-1)*2:end.month*2]
    stats={r['book_id']:r for r in rows('reading_stats','select=book_id,reading,finished,ratings')}; counts=rpc('bv_news_counts',{'start_at':start.isoformat(),'end_at':end.isoformat()}); ratings=[]; parts=[]
    def section(title,body):parts.append(f'<h2 style="color:#855661;border-bottom:1px solid #dfcec2;padding-bottom:8px">{esc(title)}</h2>'+body)
    def cards(books):
        return ''.join(f'<table role="presentation" width="100%" style="background:#f5e9df;margin:10px 0"><tr><td width="90" style="padding:12px">'+(f'<img width="76" alt="Book cover" src="https://covers.openlibrary.org/b/isbn/{esc(b["isbn"])}-M.jpg">' if b.get('isbn') else '<div style="background:#94636c;color:white;padding:20px 8px;text-align:center">❦</div>')+f'</td><td style="padding:12px"><b>{esc(b["title"])}</b><br>{esc(b["author"])}</td></tr></table>' for b in books) or '<p>To be announced.</p>'
    # Legacy statistics have no timestamp; do not imply a historical snapshot.
    for b in current if y==2026 else []:ratings.extend(stats.get(b['id'],{}).get('ratings') or [])
    section('Reading statistics', ''.join(f'<p><b>{esc(b["title"])}</b>: Reading {esc(stats.get(b["id"],{}).get("reading","—"))} · Finished {esc(stats.get(b["id"],{}).get("finished","—"))}</p>' for b in current if y==2026)+f'<p>Average rating: {sum(map(float,ratings))/len(ratings):.2f}/5</p>' if ratings else ''.join(f'<p>{esc(b["title"])}: Reading {esc(stats.get(b["id"],{}).get("reading","—"))} · Finished {esc(stats.get(b["id"],{}).get("finished","—"))}</p>' for b in current if y==2026)+'<p>No recorded ratings available.</p>')
    parts.append('<p style="font-size:12px">Reading figures are current recorded totals, not month-end snapshots.</p>')
    section('Last month’s books — '+start.strftime('%B %Y'),cards(current))
    featured=rows('bv_featured','select=book_id,user_id'); reviews=rows('book_reviews','select=book_id,user_id,review,display_name'); keys={(r['book_id'],r['user_id']) for r in featured}; ids={b['id'] for b in current} if y==2026 else set()
    section('Readers’ voices',''.join(f'<blockquote>{esc(r["review"][:350])}<br>— {esc(r["display_name"])}</blockquote>' for r in [r for r in reviews if r['book_id'] in ids and (r['book_id'],r['user_id']) in keys][:3]) or '<p>No featured reviews yet.</p>')
    section('Community & shared library',f'<p>New registered members (currently eligible): <b>{counts["new_members"]}</b><br>New shared files still available: <b>{counts["new_files"]}</b></p>')
    classics=json.loads((P/'classics.json').read_text()); n,t,a=classics[(m-1)%len(classics)]; section('Classics corner',f'<p><b>{esc(t)}</b> · {esc(a)}<br><a href="https://www.gutenberg.org/ebooks/{n}">Explore the public-domain edition</a> (US status; check local rights).</p>')
    section('This month’s reading plan — '+end.strftime('%B %Y'),cards(upcoming)); section('Annual reading journey',f'<p>{min(m*2,len(year))} of {len(year)} planned titles reached on the calendar. This is schedule progress, not completion.</p>')
    return string.Template((P/'template.html').read_text()).substitute(period=esc(period),hero=SITE+'assets/hero-reading.webp',content=''.join(parts),site=SITE,unsubscribe=SITE+'?unsubscribe='+urllib.parse.quote(token) if token else SITE+'#newsletter')
def send(email,body,period,key):
    msg=EmailMessage()
    msg['From']=formataddr(('BookVerse',os.environ['SMTP_USER']))
    msg['To']=email
    msg['Subject']='BookVerse | Letters Between Pages · '+period
    msg['Message-ID']=make_msgid()
    msg.set_content('Read the BookVerse newsletter in an HTML-capable email client: '+SITE)
    msg.add_alternative(body,subtype='html')
    with smtplib.SMTP_SSL(os.environ['SMTP_HOST'],int(os.environ['SMTP_PORT']),context=ssl.create_default_context(),timeout=30) as smtp:
        smtp.login(os.environ['SMTP_USER'],os.environ['SMTP_PASSWORD'])
        refused=smtp.send_message(msg)
        if refused: raise RuntimeError('Recipient refused')
    return {'id':msg['Message-ID']}

def campaign(period):
    for r in rpc('bv_news_recipients'):
        uid=r['user_id']; q='bv_news_delivery?period=eq.'+period+'&user_id=eq.'+uid
        if db(q):continue
        # Claim before sending. Uncertain outcomes require manual reconciliation, never blind retry.
        db('bv_news_delivery','POST',{'period':period,'user_id':uid,'state':'sending'})
        try:
            if not any(x['user_id']==uid for x in rpc('bv_news_recipients')): state,detail='skipped','Unsubscribed'
            else: state,detail='accepted',send(r['email'],render(period,r['token']),period,period+'-'+uid)['id']
        except Exception:state,detail='uncertain','Check Gmail sent folder before retrying'
        db(q,'PATCH',{'state':state,'detail':detail})
def main():
    if os.getenv('TEST_ADMINS')=='true':
        period=prev()
        body=render(period)
        for email in ('sisizyc@163.com','yukiziyu973@gmail.com'):
            send(email,body,period,'admin-test')
        print('Two administrator test messages accepted by SMTP')
        return
    if os.getenv('RUN_MONTHLY')=='true':campaign(prev())
    for j in rows('bv_news_jobs','state=eq.queued&order=created_at.asc'):
        q='bv_news_jobs?id=eq.'+j['id']; db(q,'PATCH',{'state':'running'})
        try:
            email=rpc('bv_news_admin_email',{'uid':j['requested_by']})
            if not email:raise ValueError('Admin no longer authorized')
            p=j['period']; body=render(p)
            if j['mode']=='test':send(email,body,p,'test-'+j['id'])
            elif j['mode']=='send':campaign(p)
            db(q,'PATCH',{'state':'done','html':body if j['mode']=='preview' else None,'detail':'Processed; inspect delivery log for individual results'})
        except Exception:db(q,'PATCH',{'state':'error','detail':'Job failed; inspect configuration and provider dashboard'})
if __name__=='__main__':main()
