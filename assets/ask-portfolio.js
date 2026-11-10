/* Interactive, guided portfolio Q&A. All responses are authored and hosted locally: no network or AI requests. */
(()=>{
  'use strict';
  const root=document.querySelector('[data-portfolio-ask]');
  if(!root)return;
  const form=root.querySelector('[data-ask-form]'),
        input=root.querySelector('[data-ask-input]'),
        suggestions=[...root.querySelectorAll('[data-ask-topic]')],
        answer=root.querySelector('[data-ask-answer]'),
        title=root.querySelector('[data-ask-title]'),
        copy=root.querySelector('[data-ask-copy]'),
        links=root.querySelector('[data-ask-links]'),
        close=root.querySelector('[data-ask-close]');
  const topics={
    brief:{
      title:'The recruiter brief',
      paragraphs:[
        "I'm a cross-functional marketing and operations professional based in Wisconsin's Fox Valley. My background covers social media and content production, marketing analytics, business ownership, customer journeys, and practical digital systems.",
        "I've worked in fine-art manufacturing, founded and operated a jiu-jitsu studio, supported healthcare coaching and document operations, and built independent web and workflow projects. My strength is connecting what the customer sees with the systems and people delivering it."
      ],
      links:[['Full résumé','resume.html'],['Selected projects','#work'],['How I work','#approach']]
    },
    impact:{
      title:'Results, with the context that matters',
      paragraphs:[
        "One fine-art materials reel exceeded 115,000 views. That is evidence of reach, not proof of attributable sales or return on investment.",
        "At my former jiu-jitsu studio, membership rose from approximately 21 to 40 between June and September 2023. That is observed business growth, not a claim that any single marketing action caused it.",
        "For workflow projects, I describe what I designed and why, rather than inventing time-savings or performance figures that haven't been measured."
      ],
      links:[['Marketing analytics case study','projects/marketing-analytics.html'],['Studio operations case study','projects/studio-growth.html'],['Workflow case study','projects/publishing-systems.html']]
    },
    systems:{
      title:'Systems that make work easier',
      paragraphs:[
        "My workflow experience includes building an editorial queue with clear stages for planning, review, approval, publishing, and follow-up. I care about the human decision points, not just automating a process for its own sake.",
        "Outside paid work, I've built an interactive tabletop interface for my D&D group and developed a separate React/TypeScript campaign companion website. These are personal technical projects, not commercial deployments or a claim that the two systems are automatically synchronized."
      ],
      links:[['TableOS case study','projects/tableos.html'],['Publishing workflow case study','projects/publishing-systems.html'],['Skills and tools','resume.html#resume-tools']]
    },
    crossfunctional:{
      title:'How marketing and operations fit together',
      paragraphs:[
        "Marketing shapes what people expect. Operations determine what actually happens when they arrive, sign up, ask a question, or need support. Analytics helps us understand how that experience is working.",
        "Running a studio forced me to think about all three at once: finding potential members, helping them take a first class, onboarding them, and building a community they wanted to return to. I carry that whole-journey perspective into marketing and systems work."
      ],
      links:[['Customer journey case study','projects/studio-growth.html'],['My approach','#approach'],['Professional experience','resume.html']]
    },
    analytics:{
      title:'How I approach marketing analytics',
      paragraphs:[
        "I look at reach, engagement, audience behavior, and content patterns to guide future decisions, but I distinguish those indicators from conversion, revenue, and retention. They're related questions, not interchangeable metrics.",
        "I'm Google Analytics 4 certified and interested in reporting that answers a decision-makers' question, rather than producing a dashboard just because data is available."
      ],
      links:[['Analytics case study','projects/marketing-analytics.html'],['GA4 certification and tools','resume.html#resume-tools']]
    },
    creative:{
      title:'Creative production and strategy',
      paragraphs:[
        "I've handled the full content cycle: concepts, photography, filming, editing, graphics, captions, scheduling, and approval coordination. The work includes product education, artist stories, and short-form video.",
        "I try to make specialized subjects approachable while learning from audience response. My case studies now link to a published fine-art materials reel and three personal D&D editing examples made with Premiere Pro and AI-assisted techniques."
      ],
      links:[['Social and content case study','projects/social-content.html'],['Portfolio by discipline','work.html?category=content']]
    },
    business:{
      title:'Business ownership and customer experience',
      paragraphs:[
        "I founded and operated THEØRY Jiu-Jitsu Studio. I built campaigns around motivations like fitness, community, and confidence, used Zen Planner as the main CRM, and created email and text follow-up sequences for interested prospects and early members.",
        "I noticed early repeat attendance appeared related to whether people stayed, but I did not run a formal cohort analysis or calculate a retention threshold. The case study separates these operating observations from confirmed metrics."
      ],
      links:[['Studio case study','projects/studio-growth.html'],['Employment history','resume.html#resume-experience']]
    },
    career:{
      title:'Experience across different roles',
      paragraphs:[
        "My recent work includes social media coordination in fine-art manufacturing, independent marketing and systems projects, and running a martial arts studio.",
        "Earlier roles in document imaging at Thrivent, health coaching at ThedaCare, and martial arts instruction gave me additional experience in accurate information handling, sensitive communication, teaching, and reliable process execution."
      ],
      links:[['Full employment history','resume.html#resume-experience'],['Earlier roles','resume.html#resume-earlier']]
    },
    skills:{
      title:'Tools, platforms, and working skills',
      paragraphs:[
        "My toolkit includes Adobe Creative Suite / Creative Cloud, Microsoft Office Suite, Google Analytics 4, Hootsuite, Canva, HubSpot, Zen Planner, Make.com, and WordPress, where I have 10+ years of experience.",
        "I'm comfortable bridging creative software, measurement, spreadsheets, and automation. The résumé lists the tools and relevant disciplines in more detail."
      ],
      links:[['Tools and platforms','resume.html#resume-tools'],['How I work','#approach']]
    },
    personal:{
      title:'The person behind the portfolio',
      paragraphs:[
        "I grew up in the Fox Valley and have spent nearly 25 years practicing martial arts, including teaching and opening my own studio. I'm an advocate for the collaborative storytelling and community Dungeons & Dragons can create.",
        "My Danish heritage matters to me, including visits to Denmark and Scandinavian baking. I also enjoy hiking with my golden retriever, Nimbus, and building practical personal automation projects."
      ],
      links:[['Personal story and photo gallery','about.html'],['How that background shapes my work','#approach']]
    },
    contact:{
      title:'How to connect',
      paragraphs:[
        "I'm interested in opportunities involving marketing analytics, business analysis, content strategy, and digital operations. My experience is particularly relevant when a team needs someone who can connect communication, data, and practical execution.",
        "For an introduction, a relevant role, or a project conversation, email me through the contact link below."
      ],
      links:[['Contact information','contact.html'],['Email Levi','mailto:levivanstap@gmail.com'],['Résumé','resume.html']]
    },
    fallback:{
      title:"Let's find the relevant part of my background",
      paragraphs:[
        "I don't have a prepared answer for that exact question yet. This is a guided portfolio, not a live AI conversation, so I won't make up details to fill a gap.",
        "Try asking about marketing analytics, business ownership, content, automation, my professional experience, or personal projects. You can also browse the complete résumé and case studies."
      ],
      links:[['Browse case studies','work.html'],['Read full résumé','resume.html'],['Contact me directly','contact.html']]
    }
  };
  const matchers=[
    ['personal',/\b(dungeon|dnd|d&d|dog|nimbus|denmark|danish|baking|hiking|martial art|personal life|outside work|hobb(?:y|ies))\b/i],
    ['analytics',/\b(analytic|analytics|ga4|report|dashboard|data|insight|measure|measurement|attribution|kpi)\b/i],
    ['creative',/\b(social media|content|photography|photograph|video|reel|campaign|campaigns|creative|artist|storytelling)\b/i],
    ['business',/\b(studio|theory|theøry|owner|owning|founder|membership|customer journey|onboard|retention|crm)\b/i],
    ['systems',/\b(automation|automate|automating|system|systems|tableos|tabletop|software|programming|coding|code|coded|built|build|workflow|workflows|digital project|technical|engineering)\b/i],
    ['skills',/\b(skills?|adobe|office|software tools?|platform|platforms|technology|technologies|certification|certifications|competencies)\b/i],
    ['career',/\b(work history|previous jobs?|career|employment|thedacare|thrivent|karate america|background|roles?)\b/i],
    ['impact',/\b(impact|results?|outcomes?|numbers?|metrics?|growth|success|achievement|achievements|roi|performance|proof|evidence)\b/i],
    ['crossfunctional',/\b(cross.functional|connect|operations?|departments?|process|strategy|strategist|analyst|problem.solv)\b/i],
    ['contact',/\b(contact|email|hire|available|reach|recruit|job opportunity|linkedin|interview)\b/i],
    ['brief',/\b(recruiter brief|overview|summary|summari[sz]e|about levi|what do you do|who is levi|tell me about)\b/i]
  ];
  const classify=(raw)=>{
    const q=raw.toLowerCase().trim();
    if(!q)return 'fallback';
    const multi=matchers.filter(([,pattern])=>pattern.test(q));
    if(!multi.length)return 'fallback';
    if(multi.some(([key])=>key==='impact')&&/\b(marketing|campaign|social)\b/.test(q))return 'analytics';
    if(multi.some(([key])=>key==='systems')&&/\b(built|build|tableos|automation|tabletop)\b/.test(q))return 'systems';
    if(multi.some(([key])=>key==='contact')&&/\b(contact|email|reach)\b/.test(q))return 'contact';
    return multi[0][0];
  };
  const render=(key,question)=>{
    const topic=topics[key]||topics.fallback;
    title.textContent=topic.title;
    copy.replaceChildren();
    topic.paragraphs.forEach(message=>{const p=document.createElement('p');p.textContent=message;copy.append(p)});
    links.replaceChildren();
    topic.links.forEach(([label,href])=>{
      const a=document.createElement('a');a.href=href;a.textContent=label+' ↗';links.append(a);
    });
    answer.hidden=false;
    suggestions.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.askTopic===key)));
    answer.focus({preventScroll:true});
    answer.scrollIntoView({block:'nearest',behavior:'auto'});
  };
  form.addEventListener('submit',e=>{
    e.preventDefault();
    const question=input.value.trim();
    if(!question){input.focus();return;}
    render(classify(question),question);
  });
  input.addEventListener('keydown',e=>{
    if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){
      e.preventDefault();
      if(input.value.trim())form.requestSubmit();
    }
  });
  suggestions.forEach(button=>button.addEventListener('click',()=>{
    input.value=button.dataset.askQuestion||'';
    render(button.dataset.askTopic,input.value);
  }));
  close.addEventListener('click',()=>{
    answer.hidden=true;
    suggestions.forEach(button=>button.setAttribute('aria-pressed','false'));
    input.focus({preventScroll:true});
  });
})();