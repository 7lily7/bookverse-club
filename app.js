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
const metadata = [
['Amy Tan','English','Nature'],['Peter Attia with Bill Gifford','English','Health'],['Gabriel García Márquez','Spanish','Fiction'],['Michael Morpurgo','English','Fiction'],['Jarod K. Anderson','English','Nature'],['Virginia Woolf','English','Fiction'],['Vita Sackville-West','English','Fiction'],['Haruki Murakami','Japanese','Fiction'],['Lulu Miller','English','Nonfiction'],['Richard Adams','English','Fantasy'],['Ian McEwan','English','Fiction'],['Daphne du Maurier','English','Mystery'],['Patrick Süskind','German','Fiction'],['Asako Yuzuki','Japanese','Fiction'],['Michael Ondaatje','English','Fiction'],['Arthur Conan Doyle','English','Mystery'],['Homer','Ancient Greek','Epic'],['','',''],['Betty Smith','English','Fiction'],['','',''],['Virginia Evans','English','Fiction'],['Günter Grass','German','Fiction'],['Agatha Christie','English','Mystery'],['Ali Hazelwood','English','Romance']];
books.forEach((b,i)=>[b.author,b.language,b.genre]=metadata[i]);
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
  const filtered = books.filter(b => (activeMonth === 'all' || b.month === activeMonth) && (!$('#bookQuery') || `${b.title} ${b.author} ${b.genre} ${b.month}`.toLowerCase().includes($('#bookQuery').value.toLowerCase())) && (!$('#languageFilter')?.value || b.language===$('#languageFilter').value) && (!$('#genreFilter')?.value || b.genre===$('#genreFilter').value));
  bookGrid.innerHTML = filtered.map((b) => {
    const p = palette[b.monthIndex % palette.length];
    return `<article class="book-card"><div class="book-art" style="--art-bg:${p[0]};--art-accent:${p[2]};--cover-bg:${p[1]};--cover-text:${p[3]}"><span class="art-doodle" aria-hidden="true">${p[4]}</span><div class="book-cover" aria-hidden="true"><span class="cover-decoration">❦</span><span class="cover-title">${escapeHTML(b.title)}</span></div></div><div class="book-info"><div class="book-meta">${escapeHTML(b.month)} · Book ${b.id.slice(-1)}</div><h3>${escapeHTML(b.title)}</h3><small>${escapeHTML(b.author||"Author to be confirmed")} · ${escapeHTML(b.genre||"Unclassified")}</small><button type="button" class="book-action" data-detail="${b.id}">Book details ↗</button><button type="button" class="book-action" data-find="${b.id}">Find shared files ↗</button></div></article>`;
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
    $('#fileCount').textContent='Unavailable';$('#otherCount').textContent='Unavailable';statusEl.textContent = 'File sharing is not connected yet.';
    otherStatus.textContent = 'File sharing is not connected yet.';
    return;
  }
  $('#fileCount').textContent='Loading…';$('#otherCount').textContent='Loading…';statusEl.textContent = 'Opening the shared bookshelf...';
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
    renderFiles(); renderOtherFiles(); document.querySelectorAll(".v4-updated").forEach(x=>x.textContent="Last refreshed: "+new Date().toLocaleString());
    if (result.length >= 500) {
      statusEl.textContent = 'Showing up to 500 newest shared files.';
      otherStatus.textContent = 'Showing up to 500 newest shared files.';
    }
  } catch(e) {
    $('#fileCount').textContent='Unavailable';$('#otherCount').textContent='Unavailable';statusEl.textContent = `Could not load shared files: ${e.message}`;
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
    await uploadWithProgress(objectName,file);
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
  }catch(err){$('#fileCount').textContent='Unavailable';$('#otherCount').textContent='Unavailable';statusEl.textContent=`File-sharing connection failed: ${err.message}`;otherStatus.textContent=statusEl.textContent;}
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
function addPreviewButtons(){for(const grid of [fileGrid,otherGrid])for(const item of grid.querySelectorAll('.file-item')){if(item.querySelector('.preview-btn'))continue;const a=item.querySelector('.download-btn');if(!a)continue;const f=[...uploadedFiles,...otherFiles].find(x=>supabase.storage.from(config.bucket||'bookclub-files').getPublicUrl(x.key,{download:x.original}).data.publicUrl===a.getAttribute('href'));if(!f)continue;const b=document.createElement('button');b.type='button';b.className='outline-btn preview-btn';b.textContent='Read online';b.onclick=()=>openPreview(f);a.before(b);const j=document.createElement('button');j.type='button';j.className='outline-btn preview-btn';j.textContent='Journal';j.onclick=()=>{journalOptions();$('#journalBook').value=f.kind==='other'?'other:'+f.title:f.book.id;refreshJournal();loadPersonal();journal.scrollIntoView({behavior:'smooth'});};a.before(j);}}
new MutationObserver(addPreviewButtons).observe(fileGrid,{childList:true});new MutationObserver(addPreviewButtons).observe(otherGrid,{childList:true});addPreviewButtons();
async function openPreview(f){const v=++previewVersion,body=$('#previewBody');$('#previewTitle').textContent=f.kind==='other'?f.title:f.book.title;body.textContent='Opening book…';preview.showModal();const url=supabase.storage.from(config.bucket||'bookclub-files').getPublicUrl(f.key).data.publicUrl;try{if(f.ext==='PDF'){const frame=document.createElement('iframe');frame.title='PDF preview';frame.src=url;frame.setAttribute('sandbox','allow-same-origin');body.replaceChildren(frame);const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Open PDF in browser if preview is unavailable';body.append(a);return;}if(!['TXT','DOCX','EPUB'].includes(f.ext))throw Error('Online preview is unavailable for this format. Please download the file.');const response=await fetch(url);if(!response.ok)throw Error('Unable to open file.');let content;if(f.ext==='TXT')content=await response.text();else{const {default:JSZip}=await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm');const zip=await JSZip.loadAsync(await response.arrayBuffer());const parser=new DOMParser();if(f.ext==='DOCX'){const xml=await zip.file('word/document.xml').async('string');content=Array.from(parser.parseFromString(xml,'application/xml').getElementsByTagNameNS('*','p')).map(p=>Array.from(p.getElementsByTagNameNS('*','t')).map(t=>t.textContent).join('')).join('\n\n');}else{const container=parser.parseFromString(await zip.file('META-INF/container.xml').async('string'),'application/xml');const path=container.getElementsByTagNameNS('*','rootfile')[0].getAttribute('full-path');const opf=parser.parseFromString(await zip.file(path).async('string'),'application/xml');const manifest=new Map(Array.from(opf.getElementsByTagNameNS('*','item')).map(x=>[x.getAttribute('id'),x.getAttribute('href')]));const parts=[];for(const item of opf.getElementsByTagNameNS('*','itemref')){const href=manifest.get(item.getAttribute('idref'));if(!href)continue;const resolved=new URL(href,'https://local.invalid/'+path).pathname.slice(1);const entry=zip.file(decodeURIComponent(resolved));if(!entry)continue;const doc=parser.parseFromString(await entry.async('string'),'application/xhtml+xml');parts.push(Array.from(doc.getElementsByTagNameNS('*','body')).map(x=>x.textContent).join('\n'));}content=parts.join('\n\n');}}if(v!==previewVersion)return;const pre=document.createElement('pre');pre.className='reading-text';pre.textContent=content||'No readable text found.';body.replaceChildren(pre);}catch(e){if(v===previewVersion)body.textContent=e.message;}}

// V4 community extension
for(const [id,key] of [['languageFilter','language'],['genreFilter','genre']]){const el=$('#'+id);for(const v of [...new Set(books.map(b=>b[key]).filter(Boolean))].sort())el.add(new Option(v,v));el.addEventListener('change',paintBooks);}
$('#bookQuery').addEventListener('input',paintBooks);
for(const el of [statusEl,otherStatus]){const p=document.createElement('p');p.className='v4-updated';p.textContent='Not refreshed yet';el.before(p);}
const detail=document.createElement('dialog');detail.className='club-dialog v4-detail';detail.innerHTML='<form method="dialog"><button class="dialog-close" aria-label="Close">×</button></form><div class="dialog-content" id="detailBody"></div>';document.body.append(detail);
function goJournal(id){journalOptions();$('#journalBook').value=id;refreshJournal();loadPersonal();journal.scrollIntoView({behavior:'smooth'});}
function showDetail(b){const files=uploadedFiles.filter(f=>f.book.id===b.id);$('#detailBody').innerHTML=`<h2>${escapeHTML(b.title)}</h2><p>${escapeHTML(b.author||'Author to be confirmed')} · ${escapeHTML(b.language||'Language to be confirmed')} · ${escapeHTML(b.genre||'Unclassified')}</p><p>${escapeHTML(b.month)} selection in our 2026 reading journey. ${escapeHTML(descriptions[b.id]||'A club introduction has not been added yet.')}</p><div id="detailFiles">${files.map(fileCard).join('')||'<p>No shared edition yet.</p>'}</div><button class="button button-primary" id="detailJournal">Reviews & reading progress</button>`;$('#detailJournal').onclick=()=>{detail.close();goJournal(b.id);};for(const [i,item] of [...$('#detailFiles').querySelectorAll('.file-item')].entries()){const btn=document.createElement('button');btn.className='outline-btn';btn.textContent='Read online';btn.onclick=()=>{detail.close();openPreview(files[i]);};item.append(btn);}detail.showModal();}
const descriptions={'11-1':'A life unfolds through letters, relationships and the enduring power of correspondence.','11-2':'A German novel exploring memory, history and the upheavals of the twentieth century.','12-1':'A family Christmas gathering becomes a mystery for Hercule Poirot.','12-2':'A paranormal romance in the world of Bride.','08-2':'Sherlock Holmes investigates a legend surrounding a family on the moor.','03-2':'A family and its guests reflect on time, art and relationships.'};
bookGrid.addEventListener('click',e=>{const btn=e.target.closest('[data-detail]');if(btn)showDetail(books.find(b=>b.id===btn.dataset.detail));});
const demo=document.createElement('section');demo.className='section-shell v4-panel';demo.innerHTML='<h2>Classic discoveries</h2><p>Public-domain examples from Project Gutenberg (US). These are external resources, not member uploads. Check local copyright rules.</p><div class="v4-cards">'+[['Pride and Prejudice','Jane Austen',1342],['Jane Eyre','Charlotte Brontë',1260],['The Adventures of Sherlock Holmes','Arthur Conan Doyle',1661]].map(([t,a,n])=>`<article><h3>${t}</h3><p>${a}</p><a class="download-btn" href="https://www.gutenberg.org/ebooks/${n}" target="_blank" rel="noopener">Read / download</a></article>`).join('')+'</div>';$('#other-books').after(demo);
$('#uploadFile').addEventListener('change',()=>{const f=$('#uploadFile').files[0];const msg=!f?'':! /\.(pdf|epub|docx|txt|mobi)$/i.test(f.name)?'Unsupported format / 不支持此格式':f.size>20*1024*1024?'Maximum 20 MB / 文件超过20 MB':'Ready / 可以上传';$('#uploadCheck').textContent=msg;$('#uploadFile').setCustomValidity(f&&(!/\.(pdf|epub|docx|txt|mobi)$/i.test(f.name)||f.size>20*1024*1024)?msg:'');});
async function uploadWithProgress(name,file){const {data,error}=await supabase.auth.getSession();if(error||!data.session)throw Error('Sign in again.');const bar=$('#uploadProgress');bar.hidden=false;bar.value=0;await new Promise((resolve,reject)=>{const x=new XMLHttpRequest();x.open('POST',config.supabaseUrl.replace(/\/$/,'')+'/storage/v1/object/'+encodeURIComponent(config.bucket||'bookclub-files')+'/'+encodeURIComponent(name));x.setRequestHeader('apikey',config.supabaseAnonKey);x.setRequestHeader('Authorization','Bearer '+data.session.access_token);x.setRequestHeader('x-upsert','false');x.setRequestHeader('Content-Type',file.type||'application/octet-stream');x.upload.onprogress=e=>{if(e.lengthComputable)bar.value=Math.min(99,e.loaded/e.total*100);};x.onload=()=>{if(x.status>=200&&x.status<300){bar.value=100;resolve();}else reject(Error('Storage rejected upload ('+x.status+')'));};x.onerror=()=>reject(Error('Network error'));x.ontimeout=()=>reject(Error('Upload timed out'));x.timeout=180000;x.send(file);});}
const community=document.createElement('section');community.id='community';community.className='section-shell v4-panel';community.innerHTML='<h2>Community dashboard</h2><p id="communityStatus" role="status">Connecting…</p><h3>Monthly reading activity</h3><select id="chartMonth"></select><div id="monthChart"></div><h3>2026 reading leaderboard</h3><p>Finished annual selections, using member-chosen public aliases. Historical group totals are separate.</p><div id="leaderboard"></div><h3>Release notes · V4.0</h3><p>Book details, personal progress, daily check-ins, featured reviews, responsive shelves and upload progress.</p>';journal.after(community);
months.forEach((m,i)=>$('#chartMonth').add(new Option(m,String(i+1).padStart(2,'0'))));$('#chartMonth').value='11';
const featured=document.createElement('section');featured.className='section-shell v4-panel';featured.innerHTML='<h2>Featured reviews</h2><div id="featuredReviews">No featured reviews yet.</div>';$('.intro').after(featured);
const personal=document.createElement('form');personal.className='stack-form';personal.innerHTML='<h3>My reading journey</h3><p>Choose a public nickname for the leaderboard. Your individual progress is private.</p><label>Nickname<input name="alias" required maxlength="60"></label><label>Status<select name="status"><option>Want to Read</option><option>Reading</option><option>Finished</option></select></label><label>Progress (%)<input name="progress" type="number" min="0" max="100" required value="0"></label><button class="button button-primary">Save my progress</button><button type="button" class="outline-btn" id="checkin">Check in today</button><p id="personalStatus" role="status"></p>';$('#journalStats').after(personal);
let personalVersion=0;async function loadPersonal(){const v=++personalVersion;personal.elements.alias.value='';personal.elements.status.value='Want to Read';personal.elements.progress.value=0;$('#personalStatus').textContent='';if(!supabase||!member)return;const {data,error}=await supabase.from('bv_progress').select('*').eq('user_id',member.id).eq('book_id',$('#journalBook').value).maybeSingle();if(v!==personalVersion)return;if(error){$('#personalStatus').textContent=error.message;return;}if(data){personal.elements.alias.value=data.display_name;personal.elements.status.value=data.status;personal.elements.progress.value=data.progress;}}
$('#journalBook').addEventListener('change',loadPersonal);personal.onsubmit=async e=>{e.preventDefault();if(!member||!supabase){showDialog();return;}const status=personal.elements.status.value;const {error}=await supabase.from('bv_progress').upsert({user_id:member.id,book_id:$('#journalBook').value,status,progress:status==='Finished'?100:Number(personal.elements.progress.value),display_name:personal.elements.alias.value.trim(),updated_at:new Date().toISOString()});$('#personalStatus').textContent=error?error.message:'Progress saved.';if(!error){loadPersonal();refreshCommunity();}};
$('#checkin').onclick=async()=>{if(!member||!supabase){showDialog();return;}const {error}=await supabase.from('bv_checkins').insert({user_id:member.id,book_id:$('#journalBook').value});$('#personalStatus').textContent=error?(error.code==='23505'?'Already checked in today.':error.message):'Checked in today!';};
let allStats=Object.entries(seed).map(([book_id,x])=>({book_id,...x})),isAdmin=false;function drawMonth(){const m=$('#chartMonth').value;const entries=books.filter(b=>b.id.startsWith(m));const max=Math.max(1,...allStats.flatMap(s=>[s.reading||0,s.finished||0]));$('#monthChart').innerHTML=entries.map(b=>{const s=allStats.find(x=>x.book_id===b.id)||{};const r=s.ratings||[];return `<article class="journal-review"><h3>${escapeHTML(b.title)}</h3>${[['Reading',s.reading],['Finished',s.finished]].map(([label,n])=>`<div class="journal-bar"><span>${label}</span><div><i style="width:${(n||0)/max*100}%"></i></div><strong>${n??'—'}</strong></div>`).join('')}<p>Average rating: ${r.length?(r.reduce((a,b)=>a+Number(b),0)/r.length).toFixed(2):'—'}</p></article>`;}).join('');}$('#chartMonth').onchange=drawMonth;drawMonth();
async function refreshCommunity(){if(!supabase){$('#communityStatus').textContent='Live community unavailable.';return;}try{const [s,l,f,r]=await Promise.all([supabase.from('reading_stats').select('*'),supabase.rpc('bv_leaderboard'),supabase.from('bv_featured').select('*'),supabase.from('book_reviews').select('book_id,user_id,display_name,review,rating')]);for(const x of [s,l,f,r])if(x.error)throw x.error;allStats=s.data;drawMonth();$('#leaderboard').innerHTML=l.data.map((x,i)=>`<p>${i+1}. ${escapeHTML(x.display_name)} · ${x.finished} finished</p>`).join('')||'No personal completion records yet.';$('#featuredReviews').innerHTML=r.data.filter(x=>f.data.some(y=>y.book_id===x.book_id&&y.user_id===x.user_id)).map(x=>`<article class="journal-review"><strong>${escapeHTML(books.find(b=>b.id===x.book_id)?.title||x.book_id)}</strong><p>${escapeHTML(x.review)}</p><small>${escapeHTML(x.display_name)}</small></article>`).join('')||'No featured reviews yet.';$('#communityStatus').textContent='Updated '+new Date().toLocaleString();if(member){const a=await supabase.rpc('bv_admin');isAdmin=a.data===true;}else isAdmin=false;renderAdmin();}catch(e){$('#communityStatus').textContent='Community data unavailable: '+e.message;}}
const admin=document.createElement('div');community.append(admin);function renderAdmin(){admin.replaceChildren();if(!isAdmin)return;const h=document.createElement('h3');h.textContent='Administrator tools';admin.append(h);for(const f of [...uploadedFiles,...otherFiles]){const b=document.createElement('button');b.className='outline-btn';b.textContent='Remove '+(f.title||f.book.title)+' · '+f.original;b.onclick=async()=>{if(!confirm('Permanently remove this shared file?'))return;const {error}=await supabase.storage.from(config.bucket||'bookclub-files').remove([f.key]);$('#communityStatus').textContent=error?error.message:'File removed.';await loadFiles();renderAdmin();};admin.append(b);}const b=document.createElement('button');b.className='outline-btn';b.textContent='Manage featured reviews';b.onclick=async()=>{const [r,f]=await Promise.all([supabase.from('book_reviews').select('*'),supabase.from('bv_featured').select('*')]);if(r.error||f.error){$('#communityStatus').textContent='Unable to load reviews.';return;}for(const x of r.data){const btn=document.createElement('button');btn.className='outline-btn';const on=f.data.some(y=>y.book_id===x.book_id&&y.user_id===x.user_id);btn.textContent=(on?'Unfeature: ':'Feature: ')+x.display_name+' · '+x.review.slice(0,80);btn.onclick=async()=>{const q=supabase.from('bv_featured');const result=on?await q.delete().eq('book_id',x.book_id).eq('user_id',x.user_id):await q.insert({book_id:x.book_id,user_id:x.user_id});if(result.error)$('#communityStatus').textContent=result.error.message;else refreshCommunity();};admin.append(btn);}};admin.append(b);}
const refreshButton=document.createElement('button');refreshButton.className='outline-btn';refreshButton.textContent='Refresh community';refreshButton.onclick=()=>{refreshCommunity();loadPersonal();};community.prepend(refreshButton);
let lastMember="initial";setInterval(()=>{if(supabase&&lastMember!==(member?.id||null)){lastMember=member?.id||null;refreshCommunity();loadPersonal();}},1500);
// Optional Chinese navigation and key controls; content remains in its original language.
const lang=document.createElement('button');lang.className='outline-btn v4-lang';lang.textContent='中文';$('.nav-actions').prepend(lang);let chinese=false;const translations={'Home':'首页','2026 Books':'2026书单','Shared Library':'共读书架','Other Books':'其他书籍','Reading Journal':'阅读日志','Community':'社区','Read online':'在线阅读','Journal':'日志','↓ Download':'↓ 下载','Book details ↗':'书籍详情 ↗','Find shared files ↗':'查找文件 ↗','Refresh community':'刷新社区','Check in today':'今日打卡','Save my progress':'保存进度','Want to Read':'想读','Reading':'在读','Finished':'完读'};lang.onclick=()=>{chinese=!chinese;lang.textContent=chinese?'EN':'中文';document.documentElement.lang=chinese?'zh-CN':'en';document.querySelectorAll('a,button,option').forEach(el=>{if(el.children.length)return;const t=el.textContent.trim();if(chinese&&translations[t]){el.dataset.en=t;if(el.tagName==='OPTION'&&!el.hasAttribute('value'))el.value=t;el.textContent=translations[t];}else if(!chinese&&el.dataset.en){el.textContent=el.dataset.en;delete el.dataset.en;}});};
