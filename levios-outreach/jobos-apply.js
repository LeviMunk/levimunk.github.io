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
  function packageForExtension(profile,answers){
    const normalized=normalizeProfile(profile);
    const validationErrors=validProfile(normalized);
    if(validationErrors.length)throw Error(validationErrors.join(' '));
    const checked=normalizeAnswers(answers).filter(x=>x.verifiedAt);
    return {format:VERSION,createdAt:new Date().toISOString(),profile:normalized,answers:checked};
  }
  function parsePackage(data){
    const p=typeof data==='string'?JSON.parse(data):data;
    if(!p||p.format!==VERSION||!p.profile||!Array.isArray(p.answers))throw Error('Not a JobOS Apply Phase 1 export.');
    if(p.answers.length>100)throw Error('Too many saved answers.');
    if(JSON.stringify(p).length>100000)throw Error('Export exceeds size limit.');
    const profile=normalizeProfile(p.profile),errors=validProfile(profile);
    if(errors.length)throw Error(errors.join(' '));
    return {format:VERSION,profile,answers:normalizeAnswers(p.answers).filter(x=>x.verifiedAt)};
  }
  function matchingAnswer(answers,question){
    if(isSensitiveQuestion(question))return null;
    const key=questionKey(question);
    if(!key)return null;
    const answer=normalizeAnswers(answers).find(a=>a.verifiedAt&&questionKey(a.question)===key);
    return answer?.answer||null;
  }
  return {VERSION,FIELDS,questionKey,isSensitiveQuestion,normalizeProfile,validProfile,normalizeAnswers,packageForExtension,parsePackage,matchingAnswer};
});