const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
// Transcribed from the club's attached annual reading list, 2026 section.
const titles = [
  ["The Backyard Bird Chronicles", "Outlive"],
  ["Love in the time of Cholera", "War Horse"],
  ["Something in the woods loves you", "To the Lighthouse"],
  ["All Passion Spent", "The City and its uncertain walls"],
  ["Why Fish Don’t Exist", "Watership Down"],
  ["Atonement", "Rebecca"],
  ["Perfume", "Butter"],
  ["The English Patient", "The Hound of Baskervilles"],
  ["The Odyssey", "Odyssey"],
  ["A Tree Grows in Brooklyn", "The Ocean would paint me blue"],
  ["The Correspondent", "The Tin Drum"],
  ["Hercule Poirot’s Christmas", "Mate"]
];
const books = titles.flatMap((pair, monthIndex) => pair.map((title, index) => ({ id: `${String(monthIndex+1).padStart(2,'0')}-${index+1}`, title, month: months[monthIndex], monthIndex })));
const palette = [
  ['#dfe8db','#e1b6a6','#6e8974','#fbf3e7','✿'],
  ['#eadbdc','#744d5d','#ba929c','#fff4ed','☾'],
  ['#d7e3e7','#617e8c','#9db4ba','#fff4e4','✧'],
  ['#f1dfcc','#bd8976','#d6aea0','#fff9ed','❋'],
  ['#e5e5d8','#687b68','#9baa87','#fff9e9','❀'],
  ['#e7dce9','#84698c','#b9a3bc','#fff6e9','✦'],
  ['#f2dfce','#a46e62','#d9b29d','#fff6e7','✷'],
  ['#dce5e6','#5d7986','#a7bec4','#fef6e8','✩']
];
const $ = (s) => document.querySelector(s);
const bookGrid = $('#bookGrid');
const monthPicker = $('#monthPicker');
const fileGrid = $('#fileGrid');
const statusEl = $('#libraryStatus');
const otherStatus = $('#otherStatus');
const otherGrid = $('#otherGrid');
const feedback = $('#dialogFeedback');
const config = window.BOOKVERSE_CONFIG || {};
const configured = Boolean(config.supabaseUrl && config.supabaseAnonKey && /^https:\/\//.test(config.supabaseUrl));
let supabase = null, member = null, uploadedFiles = [], otherFiles = [], activeMonth = 'all';

function escapeHTML(s) {return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function formatSize(bytes) {return bytes < 1024*1024 ? `${Math.max(1,Math.round(bytes/1024))} KB` : `${(bytes/(1024*1024)).toFixed(1)} MB`;}
function paintBooks() {
  const filtered = books.filter(b => activeMonth === 'all' || b.month === activeMonth);
  bookGrid.innerHTML = filtered.map((b) => {
    const p = palette[b.monthIndex % palette.length];
    return `<article class="book-card"><div class="book-art" style="--art-bg:${p[0]};--art-accent:${p[2]};--cover-bg:${p[1]};--cover-text:${p[3]}"><span class="art-doodle" aria-hidden="true">${p[4]}</span><div class="book-cover" aria-hidden="true"><span class="cover-decoration">❦</span><span class="cover-title">${escapeHTML(b.title)}</span></div></div><div class="book-info"><div class="book-meta">${escapeHTML(b.month)} · Book ${b.id.slice(-1)}</div><h3>${escapeHTML(b.title)}</h3><button type="button" class="book-action" data-find="${b.id}">Find shared files ↗</button></div></article>`;
  }).join('');
}
monthPicker.innerHTML += months.map(m=> `<button class="month" data-month="${m}" type="button">${m}</button>`).join('');
monthPicker.addEventListener('click', e=> {const btn=e.target.closest('[data-month]');if(!btn)return;activeMonth=btn.dataset.month;monthPicker.querySelectorAll('.month').forEach(x=>x.classList.toggle('active',x===btn));paintBooks();});
bookGrid.addEventListener('click', e=> {const btn=e.target.closest('[data-find]');if(!btn)return;const b=books.find(x=>x.id===btn.dataset.find);if(!b)return;$('#librarySearch').value=b.title;renderFiles();$('#shared-library').scrollIntoView({behavior:'smooth'});});
$('#uploadBook').innerHTML = books.map(b=>`<option value="${b.id}">${escapeHTML(b.month)} · ${escapeHTML(b.title)}</option>`).join('');
paintBooks();

function parseObject(obj) {
  // The two shelf formats are: 01-1--uuid--filename and other--uuid--title--filename.
  const otherMatch = /^other--([a-f0-9-]+)--([A-Za-z0-9._-]+)--([A-Za-z0-9._-]+)$/.exec(obj.name);
  if (otherMatch) return {
    key: obj.name, kind: 'other', title: otherMatch[2].replace(/_/g, ' '),
    original: otherMatch[3], size: obj.metadata?.size ?? 0,
    created: obj.created_at || '', ext: otherMatch[3].split('.').pop().toUpperCase()
  };
  const match = /^([0-9]{2}-[12])--([a-f0-9-]+)--(.+)$/.exec(obj.name);
  if (!match) return null;
  const book = books.find(b => b.id === match[1]); if (!book) return null;
  return {key: obj.name, kind: 'reading', book, original: match[3], size: obj.metadata?.size ?? 0,
    created: obj.created_at || '', ext: match[3].split('.').pop().toUpperCase()};
}
function fileCard(f) {
  const url = supabase.storage.from(config.bucket || 'bookclub-files').getPublicUrl(f.key,{download:f.original}).data.publicUrl;
  const date = f.created ? new Date(f.created).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : 'Shared file';
  const title = f.kind === 'other' ? f.title : f.book.title;
  return `<article class="file-item"><div class="file-icon">${escapeHTML(f.ext.slice(0,5))}</div><div class="file-info"><strong title="${escapeHTML(title)}">${escapeHTML(title)}</strong><small>${escapeHTML(f.original)} · ${escapeHTML(date)}${f.size ? ' · ' + formatSize(f.size) : ''}</small></div><a class="download-btn" href="${escapeHTML(url)}" aria-label="Download ${escapeHTML(f.original)}">↓ Download</a></article>`;
}
function renderFiles() {
  const query = $('#librarySearch').value.trim().toLocaleLowerCase();
  const filtered = uploadedFiles.filter(f => `${f.book.title} ${f.original} ${f.book.month}`.toLocaleLowerCase().includes(query));
  $('#fileCount').textContent = `${uploadedFiles.length} shared file${uploadedFiles.length === 1 ? '' : 's'}`;
  fileGrid.innerHTML = filtered.map(fileCard).join('');
  if (!filtered.length && uploadedFiles.length && query) statusEl.textContent = 'No matching files yet. Try another title or filename.';
  else if (!uploadedFiles.length && configured) statusEl.textContent = 'The shelf is waiting for its first shared book. Be the first to contribute!';
  else statusEl.textContent = '';
}
function renderOtherFiles() {
  const query = $('#otherSearch').value.trim().toLocaleLowerCase();
  const filtered = otherFiles.filter(f => `${f.title} ${f.original}`.toLocaleLowerCase().includes(query));
  $('#otherCount').textContent = `${otherFiles.length} shared book${otherFiles.length === 1 ? '' : 's'}`;
  otherGrid.innerHTML = filtered.map(fileCard).join('');
  if (!filtered.length && otherFiles.length && query) otherStatus.textContent = 'No matching books. Try a different search.';
  else if (!otherFiles.length && configured) otherStatus.textContent = 'The Other Books shelf is waiting for its first discovery. ✦';
  else otherStatus.textContent = '';
}
$('#librarySearch').addEventListener('input', renderFiles);
$('#otherSearch').addEventListener('input', renderOtherFiles);
async function loadFiles() {
  if (!supabase) {
    statusEl.textContent = 'File sharing is not connected yet.';
    otherStatus.textContent = 'File sharing is not connected yet.';
    return;
  }
  statusEl.textContent = 'Opening the shared bookshelf...';
  otherStatus.textContent = 'Discovering more books...';
  try {
    let result = [];
    for (let offset = 0; offset < 500; offset += 100) {
      const {data,error} = await supabase.storage.from(config.bucket || 'bookclub-files').list('',{limit:100,offset,sortBy:{column:'created_at',order:'desc'}});
      if (error) throw error;
      result.push(...data); if (data.length < 100) break;
    }
    const entries = result.map(parseObject).filter(Boolean).sort((a,b) => b.created.localeCompare(a.created));
    uploadedFiles = entries.filter(f => f.kind === 'reading');
    otherFiles = entries.filter(f => f.kind === 'other');
    renderFiles(); renderOtherFiles();
    if (result.length >= 500) {
      statusEl.textContent = 'Showing up to 500 newest shared files.';
      otherStatus.textContent = 'Showing up to 500 newest shared files.';
    }
  } catch(e) {
    statusEl.textContent = `Could not load shared files: ${e.message}`;
    otherStatus.textContent = `Could not load other books: ${e.message}`;
  }
}
$('#refreshFiles').addEventListener('click', loadFiles);
$('#refreshOther').addEventListener('click', loadFiles);

const dialog=$('#clubDialog');
function setFeedback(message){feedback.textContent=message;}
function showDialog(){setFeedback('');dialog.showModal();}
document.querySelectorAll('[data-upload]').forEach(btn=>btn.addEventListener('click',()=>{showDialog();if(!member && !configured)setFeedback('Uploads will become available once the club owner connects Supabase.');}));
$('#accountButton').addEventListener('click',showDialog);
function changeShelf(value) {
  const isOther = value === 'other';
  $('#uploadType').value = isOther ? 'other' : 'reading';
  $('#readingBookField').hidden = isOther;
  $('#otherTitleField').hidden = !isOther;
  $('#uploadBook').required = !isOther;
  $('#otherTitle').required = isOther;
}
$('#uploadType').addEventListener('change', e => changeShelf(e.target.value));
document.querySelectorAll('[data-upload-other]').forEach(btn => btn.addEventListener('click', () => {
  changeShelf('other'); showDialog();
}));
changeShelf('reading');
function syncMember(){
  $('#authPanel').hidden=Boolean(member);
  $('#signedPanel').hidden=!member;
  $('#signedEmail').textContent=member?.email||'';
}
$('#loginForm').addEventListener('submit', async e=> {
  e.preventDefault();
  if(!supabase){setFeedback('The file-sharing service has not been configured by the club owner.');return;}
  const btn=e.target.querySelector('button'); btn.disabled=true;btn.textContent='Sending...';
  try{const email=e.target.elements.email.value.trim();const {error}=await supabase.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname}});if(error)throw error;setFeedback('Check your inbox for a sign-in link. If you are an invited member, you can upload after signing in.');}
  catch(err){setFeedback(err.message);}finally{btn.disabled=false;btn.textContent='Send sign-in link ↗';}
});
$('#signOut').addEventListener('click', async()=>{if(!supabase)return;await supabase.auth.signOut();member=null;syncMember();setFeedback('You have signed out.');});
$('#uploadForm').addEventListener('submit', async e=> {
  e.preventDefault();if(!supabase||!member){setFeedback('Please sign in first.');return;}
  const file=$('#uploadFile').files?.[0], bookId=$('#uploadBook').value;
  const isOther=$('#uploadType').value==='other';
  if(!file){setFeedback('Choose a book file first.');return;}
  if(!/\.(pdf|epub|docx|txt|mobi)$/i.test(file.name)){setFeedback('This file type is not supported.');return;}
  if(file.size>20*1024*1024){setFeedback('Please choose a file under 20 MB.');return;}
  const safeFileName=file.name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g,'_').replace(/^\.+/,'').slice(-110)||'book.pdf';
  const rawTitle=$('#otherTitle').value.trim();
  if(isOther && !rawTitle){setFeedback('Please enter a book title.');return;}
  const safeTitle=rawTitle.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g,'_').replace(/^\.+/,'').slice(0,80).replace(/_+/g,'_') || 'Untitled';
  const objectName=isOther
    ? `other--${crypto.randomUUID()}--${safeTitle}--${safeFileName}`
    : `${bookId}--${crypto.randomUUID()}--${safeFileName}`;
  const btn=$('#uploadSubmit');btn.disabled=true;btn.textContent='Uploading...';setFeedback('Uploading your file securely...');
  try {
    const {error}=await supabase.storage.from(config.bucket||'bookclub-files').upload(objectName,file,{upsert:false,contentType:file.type||'application/octet-stream',cacheControl:'3600'});
    if(error)throw error;
    $('#uploadFile').value='';if(isOther)$('#otherTitle').value='';setFeedback('Book uploaded! Your club can now download it.');await loadFiles();
  }catch(err){setFeedback(`Upload failed: ${err.message}. If you are not on the club member list, ask the organizer for access.`);}
  finally{btn.disabled=false;btn.textContent='Upload to the club ↗';}
});

async function initialize(){
  syncMember();
  if(!configured){await loadFiles();return;}
  try {
    const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    supabase=createClient(config.supabaseUrl,config.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    const {data}=await supabase.auth.getUser();member=data.user;
    supabase.auth.onAuthStateChange((_event,session)=>{member=session?.user||null;syncMember();});
    syncMember();await loadFiles();
  }catch(err){statusEl.textContent=`File-sharing connection failed: ${err.message}`;}
}
initialize();

const navLinks=[...document.querySelectorAll('.nav-link')];
const observer=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){navLinks.forEach(a=>a.classList.toggle('active',a.hash===`#${entry.target.id}`));}})},{rootMargin:'-90px 0px -65% 0px'});
document.querySelectorAll('main section[id]').forEach(x=>observer.observe(x));

// Reading Journal and safe online previews
const journal=document.createElement('section');journal.id='reading-journal';journal.className='section-shell journal';journal.innerHTML=`<span class="pill-label">✦ STORIES IN NUMBERS</span><h2>Our Reading <em>Journal</em></h2><p>Every reader, every chapter, every thought.</p><label>Choose a book <select id="journalBook"></select></label><div id="journalStats"></div><div id="journalReviews"></div><form id="statsForm" class="stack-form"><h3>Update group statistics</h3><label>Currently reading<input name="reading" type="number" min="0" step="1"></label><label>Finished<input name="finished" type="number" min="0" step="1"></label><label>Scores used in the average (comma separated, 0–5)<input name="ratings" placeholder="3, 4, 4.5"></label><button class="button button-primary">Save statistics</button></form><form id="reviewForm" class="stack-form"><h3>Write your review</h3><p>Reviews and display names are public. Do not include personal information.</p><label>Display name<input name="display_name" required maxlength="60"></label><label>Your rating (optional)<input name="rating" type="number" min="0" max="5" step="0.25"></label><label>Book review<textarea name="review" required maxlength="5000" rows="5"></textarea></label><button class="button button-primary">Save my review</button></form><p id="journalStatus" role="status"></p>`;document.querySelector('.closing').before(journal);
const seed={'11-1':{reading:24,finished:11,ratings:[3,3.5,4.5,4.75,3.5,3.5,3.5,3,4]},'11-2':{reading:3,finished:null,ratings:[]}};
function journalOptions(){const select=$('#journalBook'),old=select.value;const opts=[...books,...Array.from(new Set(otherFiles.map(f=>f.title))).map(title=>({id:'other:'+title,title,month:'Other Books'}))];select.innerHTML=opts.map(b=>`<option value="${escapeHTML(b.id)}">${escapeHTML(b.month+' · '+b.title)}</option>`).join('');select.value=opts.some(b=>b.id===old)?old:'11-1';}
journalOptions();let journalVersion=0;
async function refreshJournal(){const version=++journalVersion,id=$('#journalBook').value;let stat=seed[id]||{},reviews=[];$('#journalStatus').textContent='';if(supabase){try{const [a,b]=await Promise.all([supabase.from('reading_stats').select('*').eq('book_id',id).maybeSingle(),supabase.from('book_reviews').select('display_name,review,rating,user_id').eq('book_id',id)]);if(a.error||b.error)throw a.error||b.error;stat=a.data||stat;reviews=b.data||[];}catch(e){if(version===journalVersion)$('#journalStatus').textContent='Live journal unavailable: '+e.message;}}else $('#journalStatus').textContent='Connecting to the club…';if(version!==journalVersion)return;const ratings=(stat.ratings||[]).map(Number),avg=ratings.length?(ratings.reduce((a,b)=>a+b,0)/ratings.length).toFixed(2):'—';const max=Math.max(1,stat.reading||0,stat.finished||0);const bar=(label,n)=>`<div class="journal-bar"><span>${label}</span><div><i style="width:${n==null?0:n/max*100}%"></i></div><strong>${n??'—'}</strong></div>`;const counts={};ratings.forEach(r=>counts[r]=(counts[r]||0)+1);$('#journalStats').innerHTML=`<div class="journal-metrics"><div>Reading<strong>${stat.reading??'—'}</strong></div><div>Finished<strong>${stat.finished??'—'}</strong></div><div>Average rating<strong>${avg}</strong><small> / 5 · ${ratings.length} scores</small></div></div><h3>Reading activity</h3>${bar('Reading',stat.reading)}${bar('Finished',stat.finished)}<h3>Rating distribution</h3>${Object.keys(counts).sort((a,b)=>a-b).map(r=>`<div class="journal-bar"><span>${r} / 5</span><div><i style="width:${counts[r]/Math.max(...Object.values(counts))*100}%"></i></div><strong>${counts[r]}</strong></div>`).join('')||'<p>No scores yet.</p>'}`;$('#journalReviews').innerHTML='<h3>Book Reviews</h3>'+(reviews.map(r=>`<article class="journal-review"><strong>${escapeHTML(r.display_name)}</strong> · ${r.rating??'—'} / 5<p>${escapeHTML(r.review)}</p></article>`).join('')||'<p>No reviews yet.</p>');const f=$('#statsForm');f.elements.reading.value=stat.reading??'';f.elements.finished.value=stat.finished??'';f.elements.ratings.value=ratings.join(', ');const mine=reviews.find(r=>r.user_id===member?.id),rf=$('#reviewForm');rf.elements.display_name.value=mine?.display_name||'';rf.elements.review.value=mine?.review||'';rf.elements.rating.value=mine?.rating??'';}
$('#journalBook').addEventListener('change',refreshJournal);
async function saveJournal(e,kind){e.preventDefault();if(!supabase||!member){showDialog();return;}const f=e.target,button=f.querySelector('button'),id=$('#journalBook').value;button.disabled=true;try{let row={book_id:id};if(kind==='reading_stats'){const val=n=>f.elements[n].value===''?null:Number(f.elements[n].value);const raw=f.elements.ratings.value.trim();const ratings=raw?raw.split(',').map(x=>x.trim()===''?NaN:Number(x)):[];if(ratings.some(x=>!Number.isFinite(x)||x<0||x>5))throw Error('Enter scores from 0 to 5.');Object.assign(row,{reading:val('reading'),finished:val('finished'),ratings});}else Object.assign(row,{user_id:member.id,display_name:f.elements.display_name.value.trim(),review:f.elements.review.value.trim(),rating:f.elements.rating.value===''?null:Number(f.elements.rating.value)});const {error}=await supabase.from(kind).upsert(row);if(error)throw error;await refreshJournal();$('#journalStatus').textContent='Saved to the club.';}catch(err){$('#journalStatus').textContent=err.message;}finally{button.disabled=false;}}
$('#statsForm').addEventListener('submit',e=>saveJournal(e,'reading_stats'));$('#reviewForm').addEventListener('submit',e=>saveJournal(e,'book_reviews'));
const originalLoad=loadFiles;loadFiles=async function(){await originalLoad();journalOptions();};
// Initial connection is asynchronous; refresh once the existing client becomes available.
let attempts=0;const journalTimer=setInterval(()=>{if(supabase||++attempts>=30){clearInterval(journalTimer);journalOptions();refreshJournal();}},500);refreshJournal();
const preview=document.createElement('dialog');preview.className='club-dialog preview-dialog';preview.innerHTML='<form method="dialog"><button class="dialog-close" aria-label="Close preview">×</button></form><h2 id="previewTitle">Read Online</h2><div id="previewBody"></div>';document.body.append(preview);let previewVersion=0;preview.addEventListener('close',()=>{previewVersion++;$('#previewBody').replaceChildren();});
function addPreviewButtons(){for(const grid of [fileGrid,otherGrid])for(const item of grid.querySelectorAll('.file-item')){if(item.querySelector('.preview-btn'))continue;const a=item.querySelector('.download-btn');if(!a)continue;const f=[...uploadedFiles,...otherFiles].find(x=>supabase.storage.from(config.bucket||'bookclub-files').getPublicUrl(x.key,{download:x.original}).data.publicUrl===a.getAttribute('href'));if(!f)continue;const b=document.createElement('button');b.type='button';b.className='outline-btn preview-btn';b.textContent='Read online';b.onclick=()=>openPreview(f);a.before(b);const j=document.createElement('button');j.type='button';j.className='outline-btn preview-btn';j.textContent='Journal';j.onclick=()=>{journalOptions();$('#journalBook').value=f.kind==='other'?'other:'+f.title:f.book.id;refreshJournal();journal.scrollIntoView({behavior:'smooth'});};a.before(j);}}
new MutationObserver(addPreviewButtons).observe(fileGrid,{childList:true});new MutationObserver(addPreviewButtons).observe(otherGrid,{childList:true});addPreviewButtons();
async function openPreview(f){const v=++previewVersion,body=$('#previewBody');$('#previewTitle').textContent=f.kind==='other'?f.title:f.book.title;body.textContent='Opening book…';preview.showModal();const url=supabase.storage.from(config.bucket||'bookclub-files').getPublicUrl(f.key).data.publicUrl;try{if(f.ext==='PDF'){const frame=document.createElement('iframe');frame.title='PDF preview';frame.src=url;frame.setAttribute('sandbox','allow-same-origin');body.replaceChildren(frame);const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Open PDF in browser if preview is unavailable';body.append(a);return;}if(!['TXT','DOCX','EPUB'].includes(f.ext))throw Error('Online preview is unavailable for this format. Please download the file.');const response=await fetch(url);if(!response.ok)throw Error('Unable to open file.');let content;if(f.ext==='TXT')content=await response.text();else{const {default:JSZip}=await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm');const zip=await JSZip.loadAsync(await response.arrayBuffer());const parser=new DOMParser();if(f.ext==='DOCX'){const xml=await zip.file('word/document.xml').async('string');content=Array.from(parser.parseFromString(xml,'application/xml').getElementsByTagNameNS('*','p')).map(p=>Array.from(p.getElementsByTagNameNS('*','t')).map(t=>t.textContent).join('')).join('\n\n');}else{const container=parser.parseFromString(await zip.file('META-INF/container.xml').async('string'),'application/xml');const path=container.getElementsByTagNameNS('*','rootfile')[0].getAttribute('full-path');const opf=parser.parseFromString(await zip.file(path).async('string'),'application/xml');const manifest=new Map(Array.from(opf.getElementsByTagNameNS('*','item')).map(x=>[x.getAttribute('id'),x.getAttribute('href')]));const parts=[];for(const item of opf.getElementsByTagNameNS('*','itemref')){const href=manifest.get(item.getAttribute('idref'));if(!href)continue;const resolved=new URL(href,'https://local.invalid/'+path).pathname.slice(1);const entry=zip.file(decodeURIComponent(resolved));if(!entry)continue;const doc=parser.parseFromString(await entry.async('string'),'application/xhtml+xml');parts.push(Array.from(doc.getElementsByTagNameNS('*','body')).map(x=>x.textContent).join('\n'));}content=parts.join('\n\n');}}if(v!==previewVersion)return;const pre=document.createElement('pre');pre.className='reading-text';pre.textContent=content||'No readable text found.';body.replaceChildren(pre);}catch(e){if(v===previewVersion)body.textContent=e.message;}}
