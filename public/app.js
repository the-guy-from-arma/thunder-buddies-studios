const $ = (selector) => document.querySelector(selector);
const views = ['home', 'profile', 'request', 'privacy'];
let content;
const contentReady = fetch('/content.json').then(r => { if (!r.ok) throw new Error('Content unavailable'); return r.json(); }).then(data => content = data);
let routeVersion = 0;
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeURL = value => { try { const u = new URL(value); return u.protocol === 'https:' ? u.href : null; } catch { return null; } };
async function route() {
  const version = ++routeVersion;
  const hash = location.hash.slice(1) || 'home';
  const view = hash.startsWith('project/') ? 'profile' : ['request','privacy'].includes(hash) ? hash : 'home';
  for (const name of views) $(`#${name}-view`).hidden = name !== view;
  document.title = 'Thunder Buddies Studios — Built to be played.';
  if (view === 'profile') {
    const root = $('#profile-view');
    root.innerHTML = '<p>Opening project profile…</p>';
    try {
      await contentReady;
      if (version !== routeVersion) return;
      const id = hash.split('/')[1];
      const project = content.projects.find(p => p.id === id);
      if (!project) { root.innerHTML = '<h1>World not found.</h1><a class="inline-link" href="#work">Back to our work →</a>'; return; }
      const next = content.projects[(content.projects.indexOf(project)+1)%content.projects.length];
      const art = document.querySelector(`.portal.${project.id} .portal-art`).outerHTML;
      const url = safeURL(project.url);
      root.innerHTML = `<a class="back-link" href="#work">← All four worlds</a><div class="profile-layout"><div class="profile-copy"><p class="eyebrow">${escape(project.label)}</p><h1 id="profile-title">${escape(project.name).replaceAll('\n','<br>')}</h1><p class="lead">${escape(project.headline)}</p><p>${escape(project.description)}</p><div class="tags">${project.tags.map(t=>`<span>${escape(t)}</span>`).join('')}</div><div class="profile-links">${url ? `<a class="button" href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(project.linkLabel)} ↗</a>` : ''}<a class="button secondary" href="#request">Work with us ↗</a></div></div><div class="profile-art ${project.id}">${art}<span>THUNDER BUDDIES STUDIOS / ${escape(project.id.toUpperCase())}</span></div></div><div class="profile-details">${project.details.map((d,i)=>`<article><p class="eyebrow">0${i+1}</p><h2>${escape(d.title)}</h2><p>${escape(d.text)}</p></article>`).join('')}</div><div class="profile-switcher"><a href="#work">← Studio index</a><a href="#project/${next.id}">Next world / ${escape(next.id === 'arma' ? 'Arma library' : next.id)} →</a></div>`;
      document.title = `${project.id === 'arma' ? 'Arma Library' : project.name.replace('\n','')} — Thunder Buddies Studios`;
    } catch { if (version === routeVersion) root.innerHTML = '<h1>Couldn’t open this world.</h1><p>Reconnect and refresh to load the project profiles.</p><a href="#home" class="inline-link">Back to the studio →</a>'; }
  }
  if (version !== routeVersion) return;
  if (view !== 'home') { window.scrollTo({top:0,behavior:'instant'}); $(`#${view}-view`).focus({preventScroll:true}); }
  else requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView());
}
window.addEventListener('hashchange', route);
route();
$('#year').textContent = new Date().getFullYear();

const form = $('#request-form');
const fieldsets = [...form.querySelectorAll('[data-step]')];
let step = 0;
let sending = false;
let attemptId = crypto.randomUUID();
function values() {
  // Read disabled previous steps without making them participate in browser validation.
  return Object.fromEntries([...form.elements].filter(e=>e.name && !['radio','checkbox'].includes(e.type)).map(e=>[e.name,e.value]).concat([['service',form.querySelector('[name=service]:checked')?.value || ''],['consent',form.elements.consent.checked]]));
}
function setStep(next) {
  step = next;
  fieldsets.forEach((f,i)=>{f.hidden=i!==step;f.disabled=i!==step;});
  document.querySelectorAll('.steps li').forEach((el,i)=>{el.classList.toggle('active',i===step);if(i===step)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});
  $('#form-back').hidden = step === 0;
  $('#form-next').hidden = step === 2;
  $('#form-submit').hidden = step !== 2;
  $('#form-status').textContent = '';
  if (step === 2) {
    const v = values();
    const labels = {service:'Project type',engine:'Platform',brief:'Your brief',name:'Name',email:'Email',company:'Company',budget:'Budget',timeline:'Timeline',reference:'Reference'};
    $('#request-summary').innerHTML = Object.entries(labels).filter(([key])=>v[key]).map(([key,label])=>`<div><dt>${label}</dt><dd>${escape(v[key])}</dd></div>`).join('');
  }
  const legend = fieldsets[step].querySelector('legend');
  legend.tabIndex = -1;
  legend.focus({preventScroll:true});
}
$('#form-next').addEventListener('click',()=>{if(form.reportValidity())setStep(step+1);});
$('#form-back').addEventListener('click',()=>setStep(step-1));
form.addEventListener('input',()=>{attemptId=crypto.randomUUID();});
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (sending) return;
  if (step < 2) { if (form.reportValidity()) setStep(step+1); return; }
  if (!form.reportValidity()) return;
  if (!navigator.onLine) { $('#form-status').textContent = 'You’re offline. Your brief is still here; reconnect before sending.'; return; }
  sending = true;
  $('#form-submit').disabled = true;
  $('#form-back').disabled = true;
  $('#form-status').textContent = 'Sending your project request…';
  try {
    const response = await fetch('/api/requests', {method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':attemptId},body:JSON.stringify(values()),signal:AbortSignal.timeout(20000)});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'We couldn’t save your request. Please try again.');
    form.hidden = true;
    $('#request-id').textContent = data.id;
    $('#request-success').hidden = false;
    $('#request-success').focus();
  } catch(error) { $('#form-status').textContent = error.name === 'TimeoutError' ? 'The connection timed out. Your details are still here. Retry to check or save the same request.' : (error.message === 'Failed to fetch' ? 'Connection interrupted. Your details are still here. Please retry.' : error.message); }
  finally { sending=false;$('#form-submit').disabled=false;$('#form-back').disabled=false; }
});
const connection = () => { $('#connection-status').hidden = navigator.onLine; };
window.addEventListener('online',connection);window.addEventListener('offline',connection);connection();
let installEvent;
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installEvent=event;$('#install-app').hidden=false;});
$('#install-app').addEventListener('click',async()=>{if(!installEvent)return;await installEvent.prompt();installEvent=null;$('#install-app').hidden=true;});
window.addEventListener('appinstalled',()=>{$('#install-app').hidden=true;installEvent=null;});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
