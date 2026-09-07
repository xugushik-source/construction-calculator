"use client";

import {useMemo,useState} from "react";
import {Pencil,Plus,Search,Trash2,X} from "lucide-react";

export type CatalogEntry={id:string;section:string;category:string;name:string;unit:string;laborCost:number;materialCost:number;defaultMarkup:number;active:boolean};
type Payload=Record<string,unknown>;

export function CatalogPanel({rows,currency,act}:{rows:CatalogEntry[];currency:string;act:(action:string,payload:Payload)=>Promise<void>}){
 const [search,setSearch]=useState(""),[section,setSection]=useState("all"),[editing,setEditing]=useState<CatalogEntry|null|undefined>(undefined);
 const sections=useMemo(()=>[...new Set(rows.map(row=>row.section))].sort(),[rows]);
 const filtered=rows.filter(row=>(section==="all"||row.section===section)&&`${row.section} ${row.category} ${row.name}`.toLowerCase().includes(search.toLowerCase()));
 return <div className="page catalog-page">
  <div className="catalog-heading"><div><h2>Work and price catalog</h2><p>Choose a work in an estimate and your saved unit and prices will be filled in automatically.</p></div><button className="primary" onClick={()=>setEditing(null)}><Plus/>Add work</button></div>
  <div className="toolbar catalog-toolbar"><label><Search/><input value={search} placeholder="Search works" onChange={event=>setSearch(event.target.value)}/></label><select value={section} onChange={event=>setSection(event.target.value)}><option value="all">All sections</option>{sections.map(value=><option key={value} value={value}>{value}</option>)}</select></div>
  <div className="table-wrap"><table><thead><tr><th>Section</th><th>Work type</th><th>Work</th><th>Unit</th><th>Labor</th><th>Material</th><th>Markup</th><th/></tr></thead><tbody>{filtered.map(row=><tr key={row.id}><td>{row.section}</td><td>{row.category}</td><td><b>{row.name}</b></td><td>{row.unit}</td><td>{money(row.laborCost,currency)}</td><td>{money(row.materialCost,currency)}</td><td>{Math.round(row.defaultMarkup*100)}%</td><td className="row-actions"><button className="icon" title="Edit" onClick={()=>setEditing(row)}><Pencil/></button><button className="icon danger" title="Delete" onClick={()=>confirm("Delete this catalog work?")&&act("catalog.delete",{id:row.id})}><Trash2/></button></td></tr>)}</tbody></table>{!filtered.length&&<div className="empty"><b>No works found</b></div>}</div>
  {editing!==undefined&&<CatalogDialog rows={rows} item={editing} close={()=>setEditing(undefined)} save={async payload=>{await act(editing?"catalog.update":"catalog.create",editing?{...payload,id:editing.id}:payload);setEditing(undefined)}}/>}
 </div>
}

function CatalogDialog({rows,item,close,save}:{rows:CatalogEntry[];item:CatalogEntry|null;close:()=>void;save:(payload:Payload)=>Promise<void>}){
 const [section,setSection]=useState(item?.section||"Interior works"),[category,setCategory]=useState(item?.category||"Flooring"),[name,setName]=useState(item?.name||""),[unit,setUnit]=useState(item?.unit||"m²"),[labor,setLabor]=useState(item?String(item.laborCost):""),[material,setMaterial]=useState(item?String(item.materialCost):""),[markup,setMarkup]=useState(item?String(Math.round(item.defaultMarkup*100)):""),[active,setActive]=useState(item?.active??true),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const sections=[...new Set(rows.map(row=>row.section))],categories=[...new Set(rows.filter(row=>row.section===section).map(row=>row.category))];
 const submit=async(event:React.FormEvent)=>{event.preventDefault();setBusy(true);setError("");try{await save({section:section.trim(),category:category.trim(),name:name.trim(),unit:unit.trim(),laborCost:Number(labor||0),materialCost:Number(material||0),defaultMarkup:Number(markup||0)/100,active});close()}catch(cause){setError(cause instanceof Error?cause.message:"Could not save catalog work")}finally{setBusy(false)}};
 return <div className="modal-backdrop" onMouseDown={()=>!busy&&close()}><form className="modal catalog-modal" onMouseDown={event=>event.stopPropagation()} onSubmit={submit}>
  <button type="button" className="modal-x" onClick={close} disabled={busy} aria-label="Close"><X/></button><span className="eyebrow">PRICE CATALOG</span><h2>{item?"Edit work":"Add work"}</h2>
  <div className="form-grid item-form"><label>Section<input required list="catalog-sections" value={section} onChange={event=>setSection(event.target.value)}/><datalist id="catalog-sections">{sections.map(value=><option key={value} value={value}/>)}</datalist></label><label>Work type<input required list="catalog-categories" value={category} onChange={event=>setCategory(event.target.value)}/><datalist id="catalog-categories">{categories.map(value=><option key={value} value={value}/>)}</datalist></label><label className="wide">Work name<input autoFocus required value={name} onChange={event=>setName(event.target.value)}/></label><label>Unit<input required value={unit} onChange={event=>setUnit(event.target.value)}/></label><label>Labor cost per unit<input inputMode="decimal" min="0" step="any" type="number" value={labor} placeholder="0" onChange={event=>setLabor(event.target.value)} onFocus={event=>event.currentTarget.select()}/></label><label>Material cost per unit<input inputMode="decimal" min="0" step="any" type="number" value={material} placeholder="0" onChange={event=>setMaterial(event.target.value)} onFocus={event=>event.currentTarget.select()}/></label><label>Markup %<input inputMode="decimal" min="0" step="any" type="number" value={markup} placeholder="0" onChange={event=>setMarkup(event.target.value)} onFocus={event=>event.currentTarget.select()}/></label><label className="active-check"><input type="checkbox" checked={active} onChange={event=>setActive(event.target.checked)}/>Active</label></div>
  {error&&<p className="form-error" role="alert">{error}</p>}<button className="primary wide-button" disabled={busy}>{busy?"Saving…":"Save work"}</button>
 </form></div>
}

function money(value:number,currency:string){return new Intl.NumberFormat("en-US",{style:"currency",currency,maximumFractionDigits:2}).format(value||0)}
