"use client";

import {useState} from "react";
import {Plus,X} from "lucide-react";

const categories=["Demolition","Plastering","Painting","Drywall","Electrical","Plumbing","Tiling","Flooring","Doors","Windows","Roofing","Facade","Insulation","Concrete","Masonry","HVAC","Other"];
type Payload=Record<string,unknown>;

export function EstimateItemDialog({estimateId,defaultMarkup,close,save}:{estimateId:string;defaultMarkup:number;close:()=>void;save:(payload:Payload)=>Promise<void>}){
 const [category,setCategory]=useState("Other"),[name,setName]=useState(""),[quantity,setQuantity]=useState(1),[unit,setUnit]=useState("m²"),[laborCost,setLaborCost]=useState(0),[materialCost,setMaterialCost]=useState(0),[markup,setMarkup]=useState(Math.round((defaultMarkup||.25)*100)),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const submit=async(event:React.FormEvent)=>{event.preventDefault();setBusy(true);setError("");try{await save({estimateId,category,name:name.trim(),quantity,unit:unit.trim(),laborCost,materialCost,markup:markup/100});close()}catch(cause){setError(cause instanceof Error?cause.message:"Could not save this item")}finally{setBusy(false)}};
 return <div className="modal-backdrop" onMouseDown={()=>!busy&&close()}><form className="modal item-modal" onMouseDown={event=>event.stopPropagation()} onSubmit={submit}>
  <button type="button" className="modal-x" onClick={close} disabled={busy} aria-label="Close"><X/></button>
  <span className="eyebrow">DETAILED ESTIMATE</span><h2>New estimate item</h2>
  <div className="form-grid item-form">
   <label>Category<select value={category} onChange={event=>setCategory(event.target.value)}>{categories.map(item=><option key={item} value={item}>{item}</option>)}</select></label>
   <label>Unit<input required value={unit} placeholder="m², kg, pcs" onChange={event=>setUnit(event.target.value)}/></label>
   <label className="wide">Item name<input autoFocus required value={name} placeholder="Interior wall painting" onChange={event=>setName(event.target.value)}/></label>
   <label>Quantity<input required min="0.01" step="any" type="number" value={quantity} onChange={event=>setQuantity(Number(event.target.value))}/></label>
   <label>Labor cost per unit<input min="0" step="any" type="number" value={laborCost} onChange={event=>setLaborCost(Number(event.target.value))}/></label>
   <label>Material cost per unit<input min="0" step="any" type="number" value={materialCost} onChange={event=>setMaterialCost(Number(event.target.value))}/></label>
   <label>Markup %<input min="0" step="any" type="number" value={markup} onChange={event=>setMarkup(Number(event.target.value))}/></label>
  </div>
  {error&&<p className="form-error" role="alert">{error}</p>}
  <button className="primary wide-button" disabled={busy}><Plus/>{busy?"Saving…":"Add item"}</button>
 </form></div>
}
