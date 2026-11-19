/* JobOS Apply Phase 1: schema and safe, exact-match answer handling.
   Public code only. No user data belongs in this repository. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.JobOSApply=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
  'use strict';
  const VERSION='jobos-apply-v1';
  const FIELDS=['firstName','lastName','email','phone','city','state','postalCode','linkedinUrl','portfolioUrl','currentCompany','currentTitle'];
  const SENSITIVE=/(?:\b(?:race|ethnic(?:ity)?|gender|sex(?:ual)?|pronouns?|disabilit(?:y|ies)|veteran|military status|religio(?:n|us)|birth(?:date|day)|date of birth|ssn|social security|passport|citizenship|nationality|visa|sponsorship|work authori[sz]ation|legally authori[sz]ed|criminal|conviction|arrest|background check|drug test|salary history|current salary|expected salary|compensation|pay expectation|age|marital|pregnan(?:t|cy)|accommodation)\b)/i;
  const clean=(x,max)=>String(x??'').trim().slice(0,max);
  function questionKey(s){return clean(s,300).toLowerCase().replace(/\s+/g,' ').replace(/[?*:]+$/,'').trim();}
  function isSensitiveQuestion(s){return SENSITIVE.test(String(s||''));}
  function normalizeProfile(raw){
    const obj=raw&&typeof raw==='object'?raw:{};
    const profile={};
    for(const f of FIELDS)profile[f]=clean(obj[f],f.endsWith('Url')?400:160);
    return profile;
  }
  function validProfile(profile){
    const p=normalizeProfile(profile);
    const errors=[];
    if(p.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email))errors.push('Enter a valid email address.');
    for(const k of ['linkedinUrl','portfolioUrl'])if(p[k]&&!/^https:\/\//i.test(p[k]))errors.push(k+' must begin with https://');
    return errors;
  }
  function normalizeAnswers(raw){
    if(!Array.isArray(raw))return [];
    const output=[],seen=new Set();
    for(const item of raw.slice(0,100)){
      const question=clean(item?.question,300),answer=clean(item?.answer,2500),key=questionKey(question);
      if(!key||!answer||isSensitiveQuestion(question)||seen.has(key))continue;
      seen.add(key);
      output.push({question,answer,verifiedAt:clean(item.verifiedAt,40)});
    }
    return output;
  }
  const EXPERIENCE_FIELDS=['company','title','location','startDate','endDate','description'];
  const EDUCATION_FIELDS=['school','degree','field','startDate','endDate'];
  function normalizeEntries(raw,kind){
    const fields=kind==='experience'?EXPERIENCE_FIELDS:EDUCATION_FIELDS;
    const limit=kind==='experience'?15:10;
    const output=[];
    if(!Array.isArray(raw))return output;
    for(const item of raw.slice(0,limit)){
      const row={};
      for(const field of fields)row[field]=clean(item?.[field],field==='description'?1500:160);
      row.verifiedAt=clean(item?.verifiedAt,40);
      if(row[fields[0]]&&row[fields[1]])output.push(row);
    }
    return output;
  }
  function verifiedEntries(raw,kind){
    return normalizeEntries(raw,kind).filter(r=>r.verifiedAt&&
      (!r.startDate||/^\d{4}(?:-\d{2})?$/.test(r.startDate))&&
      (!r.endDate||/^(?:\d{4}(?:-\d{2})?|Present)$/i.test(r.endDate)));
  }
  function entryValue(entries,kind,index,field){
    if(!Number.isInteger(index)||index<0||index>9)return '';
    if(!(kind==='experience'?EXPERIENCE_FIELDS:EDUCATION_FIELDS).includes(field))return '';
    return verifiedEntries(entries,kind)[index]?.[field]||'';
  }
  function packageForExtension(profile,answers,experience=[],education=[]){
    const normalized=normalizeProfile(profile);
    const validationErrors=validProfile(normalized);
    if(validationErrors.length)throw Error(validationErrors.join(' '));
    const checked=normalizeAnswers(answers).filter(x=>x.verifiedAt);
    return {format:VERSION,createdAt:new Date().toISOString(),profile:normalized,answers:checked,experience:verifiedEntries(experience,'experience'),education:verifiedEntries(education,'education')};
  }
  function parsePackage(data){
    const p=typeof data==='string'?JSON.parse(data):data;
    if(!p||p.format!==VERSION||!p.profile||!Array.isArray(p.answers))throw Error('Not a JobOS Apply Phase 1 export.');
    if(p.answers.length>100)throw Error('Too many saved answers.');
    if(JSON.stringify(p).length>150000)throw Error('Export exceeds size limit.');
    const profile=normalizeProfile(p.profile),errors=validProfile(profile);
    if(errors.length)throw Error(errors.join(' '));
    return {format:VERSION,profile,answers:normalizeAnswers(p.answers).filter(x=>x.verifiedAt),experience:verifiedEntries(p.experience,'experience'),education:verifiedEntries(p.education,'education')};
  }
  function matchingAnswer(answers,question){
    if(isSensitiveQuestion(question))return null;
    const key=questionKey(question);
    if(!key)return null;
    const answer=normalizeAnswers(answers).find(a=>a.verifiedAt&&questionKey(a.question)===key);
    return answer?.answer||null;
  }

  // Conservative topic matching: only user-approved answers can be suggested for autofill.
  // Broad topic matches are intentionally not used for unattended choice/radio fields.
  const TOPICS={
    analytics:['analytics','analyze','analysis','data','metrics','reporting','insights','measurement','performance'],
    social:['social media','social channels','social content','instagram','facebook','community','content strategy'],
    automation:['automation','automate','workflow','process improvement','efficiency','integration'],
    collaboration:['collaboration','cross functional','stakeholders','teamwork','working with teams'],
    leadership:['leadership','lead','managed a team','management experience','mentoring'],
    communication:['communication','communicate','writing','presentations','stakeholder updates'],
    planning:['project planning','project management','prioritization','deadlines','organizing projects'],
    customers:['customer service','customers','client relationships','client experience','customer success']
  };
  function topicFor(question){
    const q=questionKey(question);
    for(const [topic,words] of Object.entries(TOPICS))if(words.some(word=>q.includes(word)))return topic;
    return '';
  }
  function relatedAnswers(answers,question){
    if(isSensitiveQuestion(question))return [];
    const exact=questionKey(question),topic=topicFor(question);
    if(!topic)return [];
    return normalizeAnswers(answers).filter(a=>a.verifiedAt&&questionKey(a.question)!==exact&&topicFor(a.question)===topic).slice(0,3);
  }
  function suggestAnswer(question,answers=[],experience=[],context={}){
    const q=clean(question,300);
    if(!q||isSensitiveQuestion(q))return {draft:'',source:'blocked',topic:''};
    const exact=matchingAnswer(answers,q);
    if(exact)return {draft:exact,source:'approved-exact',topic:topicFor(q)};
    const related=relatedAnswers(answers,q);
    const topic=topicFor(q);
    // Do not invent achievements, skill levels, results, timelines or tool usage.
    // Related answers are offered as wording to revise, not auto-verified as an exact answer.
    if(related.length)return {draft:related[0].answer,source:'related-approved-answer',topic};
    const verified=verifiedEntries(experience,'experience').filter(e=>e.description);
    if(verified.length){
      const best=verified.find(e=>topic&&topicFor(e.description)===topic)||verified[0];
      const intro='In my role as '+best.title+' at '+best.company+', ';
      const description=best.description.replace(/\s+/g,' ').trim().replace(/^[•\-\s]+/,'');
      return {draft:(intro+description.charAt(0).toLowerCase()+description.slice(1)).slice(0,1200),source:'verified-experience-rephrase',topic};
    }
    return {draft:'',source:'needs-facts',topic};
  }
  return {topicFor,relatedAnswers,suggestAnswer,VERSION,FIELDS,questionKey,isSensitiveQuestion,normalizeProfile,validProfile,normalizeAnswers,normalizeEntries,verifiedEntries,entryValue,EXPERIENCE_FIELDS,EDUCATION_FIELDS,packageForExtension,parsePackage,matchingAnswer};
});