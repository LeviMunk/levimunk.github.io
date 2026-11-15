(()=>{'use strict';
const form=document.getElementById('talk-form');if(!form)return;
const eventUrl=String(window.LEVI_CALENDLY_EVENT_URL||'').trim();
const validCalendly=/^https:\/\/([a-z0-9-]+\.)?calendly\.com\/[a-z0-9_/%-]+(?:\?.*)?$/i.test(eventUrl);
if(validCalendly){
 const wrapper=document.getElementById('talk-booking');
 const fallback=document.getElementById('talk-email-fallback');
 const parent=document.getElementById('calendly-embed');
 const direct=document.getElementById('talk-direct-booking');
 wrapper.hidden=false;fallback.hidden=true;direct.href=eventUrl;
 const options=[...document.querySelectorAll('.talk-interest-option')];
 const notes=document.getElementById('talk-interest-notes');
 const showTimes=document.getElementById('talk-show-times');
 const calendar=document.getElementById('talk-calendar-panel');
 const selected=new Set();
 options.forEach(button=>button.addEventListener('click',()=>{
   const interest=button.dataset.interest;
   if(selected.has(interest))selected.delete(interest);else selected.add(interest);
   const pressed=selected.has(interest);
   button.setAttribute('aria-pressed',String(pressed));
   button.querySelector('span').textContent=pressed?'✓':'+';
 }));
 const buildAnswer=()=>[...(selected.size?['Interests: '+[...selected].join(', ')]:[]),...(notes.value.trim()?['Details: '+notes.value.trim()]:[])].join(' | ').slice(0,1000);
 const bookingUrl=new URL(eventUrl);
 bookingUrl.searchParams.set('hide_event_type_details','1');
 showTimes.addEventListener('click',()=>{
   const answer=buildAnswer();
   const directUrl=new URL(bookingUrl.toString());
   if(answer)directUrl.searchParams.set('a1',answer);
   direct.href=directUrl.toString();
   calendar.hidden=false;
   showTimes.textContent='Update calendar details';
   // Reload the widget only when the visitor explicitly asks to proceed.
   parent.replaceChildren();
   const init=()=>{
     if(window.Calendly?.initInlineWidget){
       window.Calendly.initInlineWidget({
         url:bookingUrl.toString(),parentElement:parent,resize:true,
         ...(answer?{prefill:{customAnswers:{a1:answer}}}:{})
       });
     } else {
       parent.textContent='The embedded calendar could not load. Use the direct link below.';
     }
   };
   if(window.Calendly?.initInlineWidget)init();
   else {
     const script=document.createElement('script');
     script.src='https://assets.calendly.com/assets/external/widget.js';
     script.async=true;
     script.onload=init;
     script.onerror=()=>{parent.textContent='The embedded calendar could not load. Use the direct link below.';};
     document.head.appendChild(script);
   }
   calendar.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
 });
}

const status=document.getElementById('talk-status'),fallback=document.getElementById('talk-fallback'),copyArea=document.getElementById('talk-copy-text'),copy=document.getElementById('talk-copy');
const choices=[...form.querySelectorAll('input[name="topic"]')],count=document.getElementById('talk-topic-count');
const updateCount=()=>{const n=choices.filter(x=>x.checked).length;count.textContent=n===0?'None selected':n===1?'1 selected':n+' selected';};
choices.forEach(input=>input.addEventListener('change',()=>{updateCount();status.textContent='';}));
updateCount();
form.addEventListener('submit',event=>{
 event.preventDefault();
 const data=new FormData(form),topics=data.getAll('topic');
 if(!topics.length){status.textContent='Choose at least one topic before continuing.';document.getElementById('talk-topics')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});form.querySelector('input[name="topic"]').focus();return;}
 if(!form.reportValidity())return;
 const take=k=>String(data.get(k)||'').trim();
 const lines=[
 'Hi Levi,',
 '',
 "I'd like to find a time to connect.",
 '',
 'Name: '+take('name'),
 'Email: '+take('email'),
 ...(take('company')?['Organization: '+take('company')]:[]),
 'Topics: '+topics.join(', '),
 'Preferred format: '+take('format'),
 'Conversation length: '+take('length'),
 'Time zone: '+take('timezone'),
 ...(take('availability')?['General availability: '+take('availability')]:[]),
 ...(take('notes')?['','What I would like to discuss:',take('notes')]:[]),
 '',
 'Looking forward to connecting!'
 ];
 const subject='Call request: '+topics.slice(0,2).join(' + ');
 const body=lines.join('\n');
 copyArea.value='To: levivanstap@gmail.com\nSubject: '+subject+'\n\n'+body;
 fallback.hidden=false;
 status.textContent='Your request is ready. Your email app should open with the details; review and send it to request a time.';
 window.location.href='mailto:levivanstap@gmail.com?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
});
copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(copyArea.value);copy.textContent='Copied ✓';}catch(e){copyArea.focus();copyArea.select();status.textContent='Select and copy the prepared request above.';}});
})();