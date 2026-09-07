"use client";

import {createContext,useContext,useEffect,useMemo,useState} from "react";
import {Languages} from "lucide-react";
import {translatePage,type Language} from "@/lib/i18n";

type LanguageContextValue={language:Language;setLanguage:(language:Language)=>void};
const LanguageContext=createContext<LanguageContextValue|undefined>(undefined);

export function LanguageProvider({initialLanguage,children}:{initialLanguage:Language;children:React.ReactNode}){
 const [language,setLanguage]=useState<Language>(initialLanguage);
 const value=useMemo(()=>({language,setLanguage}),[language]);
 useEffect(()=>{
  document.documentElement.lang=language;
  document.cookie=`buildestimate_lang=${language}; path=/; max-age=31536000; SameSite=Lax`;
  translatePage(document.body,language);
  let scheduled=false;
  const observer=new MutationObserver(()=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;translatePage(document.body,language)})});
  observer.observe(document.body,{childList:true,subtree:true});
  return()=>observer.disconnect();
 },[language]);
 return <LanguageContext.Provider value={value}>{children}<LanguageSwitcher className="floating-language" compact/></LanguageContext.Provider>
}

export function useLanguage(){const value=useContext(LanguageContext);if(!value)throw new Error("LanguageProvider is missing");return value}

export function LanguageSwitcher({className="",compact=false}:{className?:string;compact?:boolean}){
 const {language,setLanguage}=useLanguage();
 return <div className={`language-switcher ${compact?"compact":""} ${className}`} role="group" aria-label="Language"><Languages/>{(["en","ru","es"] as const).map(code=><button type="button" key={code} className={language===code?"active":""} onClick={()=>setLanguage(code)} aria-pressed={language===code}>{code.toUpperCase()}</button>)}</div>
}
