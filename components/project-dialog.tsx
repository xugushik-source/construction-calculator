"use client";

import {useState} from "react";
import {Plus,X} from "lucide-react";

type Client={id:string;name:string};
type Payload=Record<string,unknown>;

export function ProjectDialog({clients,currency,close,save}:{clients:Client[];currency:string;close:()=>void;save:(payload:Payload)=>Promise<void>}){
 const [projectName,setProjectName]=useState(""),[clientChoice,setClientChoice]=useState(clients[0]?.id||"__new__"),[newClientName,setNewClientName]=useState(""),[newClientPhone,setNewClientPhone]=useState(""),[newClientEmail,setNewClientEmail]=useState(""),[newClientAddress,setNewClientAddress]=useState(""),[projectType,setProjectType]=useState("Renovation"),[area,setArea]=useState(0),[address,setAddress]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const addingClient=clientChoice==="__new__";
 const submit=async(event:React.FormEvent)=>{event.preventDefault();setBusy(true);setError("");try{await save({name:projectName.trim(),clientId:addingClient||clientChoice==="__none__"?null:clientChoice,newClientName:addingClient?newClientName.trim():"",newClientPhone,newClientEmail,newClientAddress,projectType,area,address,currency});close()}catch(cause){setError(cause instanceof Error?cause.message:"Could not create estimate")}finally{setBusy(false)}};
 return <div className="modal-backdrop" onMouseDown={()=>!busy&&close()}><form className="modal project-modal" onMouseDown={event=>event.stopPropagation()} onSubmit={submit}>
  <button type="button" className="modal-x" onClick={close} disabled={busy} aria-label="Close"><X/></button>
  <span className="eyebrow">BUILD ESTIMATE</span><h2>New estimate</h2>
  <div className="form-grid project-form">
   <label className="wide">Project name<input autoFocus required value={projectName} placeholder="Kitchen renovation" onChange={event=>setProjectName(event.target.value)}/></label>
   <label className="wide">Client<select value={clientChoice} onChange={event=>setClientChoice(event.target.value)}><option value="__new__">Add new client</option><option value="__none__">No client</option>{clients.map(client=><option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
   {addingClient&&<div className="inline-client wide"><strong>New client</strong><div className="form-grid">
    <label className="wide">Client name<input required value={newClientName} onChange={event=>setNewClientName(event.target.value)}/></label>
    <label>Phone<input value={newClientPhone} onChange={event=>setNewClientPhone(event.target.value)}/></label>
    <label>Email<input type="email" value={newClientEmail} onChange={event=>setNewClientEmail(event.target.value)}/></label>
    <label className="wide">Client address<input value={newClientAddress} onChange={event=>setNewClientAddress(event.target.value)}/></label>
   </div></div>}
   <label>Project type<select value={projectType} onChange={event=>setProjectType(event.target.value)}><option value="Renovation">Renovation</option><option value="New construction">New construction</option><option value="Commercial fit-out">Commercial fit-out</option></select></label>
   <label>Area, m²<input min="0" step="any" type="number" value={area||""} onChange={event=>setArea(Number(event.target.value))}/></label>
   <label className="wide">Project address<input value={address} onChange={event=>setAddress(event.target.value)}/></label>
  </div>
  {error&&<p className="form-error" role="alert">{error}</p>}
  <button className="primary wide-button" disabled={busy}><Plus/>{busy?"Saving…":"Create"}</button>
 </form></div>
}
