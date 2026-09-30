const form=document.querySelector('#login');
const status=document.querySelector('#status');
const list=document.querySelector('#requests');
const logout=document.querySelector('#logout');
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
form.addEventListener('submit',async event=>{
  event.preventDefault();status.textContent='Opening studio inbox…';list.replaceChildren();
  const token=form.elements.token.value;form.elements.token.value='';
  try {
    const res=await fetch('/api/admin/requests',{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});
    const data=await res.json();if(!res.ok)throw new Error(data.error);
    form.hidden=true;logout.hidden=false;status.textContent=`${data.requests.length} project request${data.requests.length===1?'':'s'}.`;
    list.innerHTML=data.requests.map(r=>`<article><h2>${escape(r.id)}</h2><p>${escape(new Date(r.createdAt).toLocaleString())}</p><dl class="request-summary">${Object.entries(r.details).filter(([key])=>key!=='consent').map(([key,value])=>`<div><dt>${escape(key)}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl></article>`).join('');
  }catch(error){status.textContent=error.message||'Could not open the inbox.';}
});
logout.addEventListener('click',()=>{list.replaceChildren();form.hidden=false;logout.hidden=true;status.textContent='Inbox closed.';});
window.addEventListener('pagehide',()=>{list.replaceChildren();form.reset();form.hidden=false;logout.hidden=true;status.textContent='';});
