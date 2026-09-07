"use client";

import {useMemo,useState} from "react";
import {Plus,X} from "lucide-react";

export type EstimateCatalogItem={id:string;section:string;category:string;name:string;unit:string;laborCost:number;materialCost:number;defaultMarkup:number;active:boolean};
type Payload=Record<string,unknown>;

export function EstimateItemDialog({estimateId,defaultMarkup,catalog,close,save}:{estimateId:string;defaultMarkup:number;catalog:EstimateCatalogItem[];close:()=>void;save:(payload:Payload)=>Promise<void>}){
 const activeCatalog=useMemo(()=>catalog.filter(item=>item.active),[catalog]);
 const initialSection=activeCatalog.find(item=>item.section==="Interior works")?.section||activeCatalog[0]?.section||"Other works";
 const initialCategory=activeCatalog.find(item=>item.section===initialSection)?.category||"Other";
 const [section,setSection]=useState(initialSection),[category,setCategory]=useState(initialCategory),[catalogId,setCatalogId]=useState(""),[name,setName]=useState(""),[quantity,setQuantity]=useState(""),[unit,setUnit]=useState(""),[laborCost,setLaborCost]=useState(""),[materialCost,setMaterialCost]=useState(""),[markup,setMarkup]=useState(String(Math.round((defaultMarkup||.25)*100))),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const sections=[...new Set(activeCatalog.map(item=>item.section))];
 const categories=[...new Set(activeCatalog.filter(item=>item.section===section).map(item=>item.category))];
 const works=activeCatalog.filter(item=>item.section===section&&item.category===category);
 const chooseSection=(value:string)=>{const nextCategory=activeCatalog.find(item=>item.section===value)?.category||"";setSection(value);setCategory(nextCategory);setCatalogId("");setName("")};
 const chooseCategory=(value:string)=>{setCategory(value);setCatalogId("");setName("")};
 const chooseWork=(id:string)=>{setCatalogId(id);const item=activeCatalog.find(row=>row.id===id);if(!item){setName("");return}setName(item.name);setUnit(item.unit);setLaborCost(String(item.laborCost));setMaterialCost(String(item.materialCost));setMarkup(String(Math.round(item.defaultMarkup*100)))};
 const submit=async(event:React.FormEvent)=>{event.preventDefault();setBusy(true);setError("");try{await save({estimateId,category,name:name.trim(),quantity:Number(quantity||1),unit:unit.trim()||"unit",laborCost:Number(laborCost||0),materialCost:Number(materialCost||0),markup:Number(markup||0)/100});close()}catch(cause){setError(cause instanceof Error?cause.message:"Could not save this item")}finally{setBusy(false)}};
 return <div className="modal-backdrop" onMouseDown={()=>!busy&&close()}><form className="modal item-modal" onMouseDown={event=>event.stopPropagation()} onSubmit={submit}>
  <button type="button" className="modal-x" onClick={close} disabled={busy} aria-label="Close"><X/></button>
  <span className="eyebrow">DETAILED ESTIMATE</span><h2>New estimate item</h2>
  <div className="catalog-path"><label>Section<select value={section} onChange={event=>chooseSection(event.target.value)}>{sections.map(value=><option key={value} value={value}>{value}</option>)}</select></label><label>Work type<select value={category} onChange={event=>chooseCategory(event.target.value)}>{categories.map(value=><option key={value} value={value}>{value}</option>)}</select></label><label>Work<select value={catalogId} onChange={event=>chooseWork(event.target.value)}><option value="">Custom item</option>{works.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>
  <div className="form-grid item-form">
   <label className="wide">Item name<input autoFocus={!catalogId} required value={name} placeholder="Choose a work or enter your own" onChange={event=>setName(event.target.value)}/></label>
   <label>Quantity<input required inputMode="decimal" min="0.01" step="any" type="number" value={quantity} placeholder="1" onChange={event=>setQuantity(event.target.value)} onFocus={event=>event.currentTarget.select()}/></label>
   <label>Unit<input required value={unit} placeholder="m², kg, pcs" onChange={event=>setUnit(event.target.value)}/></label>
   <label>Labor cost per unit<input inputMode="decimal" min="0" step="any" type="number" value={laborCost} placeholder="0" onChange={event=>setLaborCost(event.target.value)} onFocus={event=>event.currentTarget.select()}/></label>
   <label>Material cost per unit<input inputMode="decimal" min="0" step="any" type="number" value={materialCost} placeholder="0" onChange={event=>setMaterialCost(event.target.value)} onFocus={event=>event.currentTarget.select()}/></label>
   <label>Markup %<input inputMode="decimal" min="0" step="any" type="number" value={markup} placeholder="0" onChange={event=>setMarkup(event.target.value)} onFocus={event=>event.currentTarget.select()}/></label>
  </div>
  {error&&<p className="form-error" role="alert">{error}</p>}
  <button className="primary wide-button" disabled={busy}><Plus/>{busy?"Saving…":"Add item"}</button>
 </form></div>
}
