// UI-only localization. Game titles, JAR contents and engine storage stay untouched.
const I18n = {
  locale:'pt-BR', textSources:new WeakMap(), attributeSources:new WeakMap(), cache:new Map(), patterns:{},
  normalize(locale){return /^pt/i.test(locale)?'pt-BR':/^es/i.test(locale)?'es':/^en/i.test(locale)?'en':null;},
  init(){
    this.locale=this.normalize(Storage.get('jarumi_language')) || (navigator.languages||[navigator.language]).map(l=>this.normalize(l)).find(Boolean) || 'en';
    Storage.set('jarumi_language',this.locale);
    this.observer=new MutationObserver(()=>{if(!this.pending){this.pending=true;queueMicrotask(()=>{this.pending=false;this.apply();});}});
    document.getElementById('select-language').addEventListener('change',e=>this.setLocale(e.target.value));
    this.apply();
  },
  t(source){
    const catalog=JARUMI_LOCALES[this.locale]||{};
    if(this.locale==='pt-BR')return source;
    const cacheKey=this.locale+'\0'+source;
    if(this.cache.has(cacheKey))return this.cache.get(cacheKey);
    if(Object.hasOwn(catalog,source))return catalog[source];
    if(!this.patterns[this.locale])this.patterns[this.locale]=Object.entries(catalog).filter(([key])=>key.includes('{')).map(([key,value])=>{
      const names=[];const pattern=key.split(/(\{\w+\})/).map(part=>{
        if(/^\{\w+\}$/.test(part)){names.push(part.slice(1,-1));return '(.+?)';}
        return part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      }).join('');
      return {regex:new RegExp('^'+pattern+'$'),names,value};
    });
    for(const {regex,names,value} of this.patterns[this.locale]){
      const match=source.match(regex);
      if(match){const result=value.replace(/\{(\w+)\}/g,(_,name)=>match[names.indexOf(name)+1]);this.cache.set(cacheKey,result);return result;}
    }
    if(this.cache.size>2000)this.cache.clear();this.cache.set(cacheKey,source);
    return source;
  },
  setLocale(locale){
    this.locale=this.normalize(locale)||'pt-BR';Storage.set('jarumi_language',this.locale);this.apply();
    window.dispatchEvent(new CustomEvent('jarumi-language-changed',{detail:this.locale}));
  },
  apply(){
    this.observer?.disconnect();
    document.documentElement.lang=this.locale;
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    let node;
    while(node=walker.nextNode()){
      const parent=node.parentElement;
      if(!parent||parent.closest('script,style,svg,textarea,.game-card-title,.recent-card-title,#active-game-title,.device-name'))continue;
      const value=node.nodeValue;
      let record=this.textSources.get(node);
      if(!record||value!==record.rendered){record={source:value,rendered:value};this.textSources.set(node,record);}
      const trimmed=record.source.trim();if(!trimmed)continue;
      const translated=this.t(trimmed);record.rendered=record.source.replace(trimmed,translated);
      if(node.nodeValue!==record.rendered)node.nodeValue=record.rendered;
    }
    for(const el of document.querySelectorAll('[title],[aria-label],[placeholder]')){
      if(el.closest('svg,script,style,.game-card-title,.recent-card-title,#active-game-title,.device-name'))continue;
      let records=this.attributeSources.get(el);if(!records){records={};this.attributeSources.set(el,records);}
      for(const attr of ['title','aria-label','placeholder']){
        const value=el.getAttribute(attr);if(value===null)continue;
        let rec=records[attr];if(!rec||value!==rec.rendered)rec=records[attr]={source:value,rendered:value};
        rec.rendered=this.t(rec.source);if(value!==rec.rendered)el.setAttribute(attr,rec.rendered);
      }
    }
    const select=document.getElementById('select-language');if(select)select.value=this.locale;
    this.observer?.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','aria-label','placeholder']});
  }
};
