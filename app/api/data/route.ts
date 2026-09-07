import {env} from "cloudflare:workers";
import {headers} from "next/headers";
import {z} from "zod";
import {catalogSeed} from "@/lib/catalog-seed";

const categories=["Demolition","Plastering","Painting","Drywall","Electrical","Plumbing","Tiling","Flooring","Doors","Windows","Roofing","Facade","Insulation","Concrete","Masonry","HVAC","Other"];
const uid=()=>crypto.randomUUID();

async function identity(){
 const h=await headers();
 const userId=h.get("oai-authenticated-user-id")??"preview-owner";
 const email=h.get("oai-authenticated-user-email")??"owner@buildestimate.app";
 return {userId,email};
}

async function tenant(){
 const {userId,email}=await identity();
 const db=env.DB;
 let company=await db.prepare("SELECT c.* FROM companies c JOIN users u ON u.company_id=c.id WHERE u.id=?").bind(userId).first<Record<string,unknown>>();
 if(!company){
  const cid=uid(),sid=uid(),subid=uid();
  const categoryIds=new Map(categories.map(name=>[name,uid()]));
  await db.batch([
   db.prepare("INSERT INTO companies(id,name,owner_user_id) VALUES(?,?,?)").bind(cid,"My Construction Company",userId),
   db.prepare("INSERT INTO users(id,company_id,email,name,role) VALUES(?,?,?,?,?)").bind(userId,cid,email,email.split("@")[0],"owner"),
   db.prepare("INSERT INTO settings(id,company_id) VALUES(?,?)").bind(sid,cid),
   db.prepare("INSERT INTO subscriptions(id,company_id,plan,status) VALUES(?,?,?,?)").bind(subid,cid,"business","active"),
   ...categories.map(name=>db.prepare("INSERT INTO work_categories(id,company_id,name) VALUES(?,?,?)").bind(categoryIds.get(name),cid,name)),
   ...catalogSeed.map(([category,name,unit,labor,material])=>db.prepare("INSERT INTO work_items(id,company_id,category_id,name,unit,labor_cost,material_cost,default_markup,active) VALUES(?,?,?,?,?,?,?,?,1)").bind(uid(),cid,categoryIds.get(category),name,unit,labor,material,.3)),
  ]);
  company=await db.prepare("SELECT * FROM companies WHERE id=?").bind(cid).first<Record<string,unknown>>();
 }
 return {db,companyId:String(company!.id),company};
}

export async function GET(){
 try{
  const {db,companyId,company}=await tenant();
  const [clients,projects,estimates,items,settings,materials,catalog,proposals,subscription]=await Promise.all([
   db.prepare("SELECT * FROM clients WHERE company_id=? ORDER BY created_at DESC").bind(companyId).all(),
   db.prepare("SELECT * FROM projects WHERE company_id=? ORDER BY created_at DESC").bind(companyId).all(),
   db.prepare("SELECT * FROM estimates WHERE company_id=? ORDER BY created_at DESC").bind(companyId).all(),
   db.prepare("SELECT * FROM estimate_items WHERE company_id=? ORDER BY created_at").bind(companyId).all(),
   db.prepare("SELECT * FROM settings WHERE company_id=?").bind(companyId).first(),
   db.prepare("SELECT * FROM materials WHERE company_id=? ORDER BY name").bind(companyId).all(),
   db.prepare("SELECT wi.*,wc.name category FROM work_items wi LEFT JOIN work_categories wc ON wc.id=wi.category_id WHERE wi.company_id=? ORDER BY wi.name").bind(companyId).all(),
   db.prepare("SELECT * FROM proposals WHERE company_id=?").bind(companyId).all(),
   db.prepare("SELECT * FROM subscriptions WHERE company_id=?").bind(companyId).first(),
  ]);
  return Response.json({company,clients:clients.results,projects:projects.results,estimates:estimates.results,items:items.results,settings,materials:materials.results,catalog:catalog.results,proposals:proposals.results,subscription});
 }catch(error){return Response.json({error:error instanceof Error?error.message:"Data unavailable"},{status:500})}
}

const actionSchema=z.object({action:z.string(),payload:z.record(z.string(),z.unknown()).default({})});

export async function POST(req:Request){
 try{
  const {action,payload}=actionSchema.parse(await req.json());
  const {db,companyId}=await tenant();
  const p=payload as Record<string,unknown>;

  if(action==="client.create"){
   const clientId=uid();
   await db.prepare("INSERT INTO clients(id,company_id,name,phone,email,address,notes) VALUES(?,?,?,?,?,?,?)").bind(clientId,companyId,String(p.name||"New client"),String(p.phone||""),String(p.email||""),String(p.address||""),String(p.notes||"")).run();
   return Response.json({ok:true,clientId});
  }

  if(action==="project.create"){
   const projectName=String(p.name||"").trim();
   if(!projectName)throw new Error("Project name is required");
   const newClientName=String(p.newClientName||"").trim();
   let clientId:string|null=null;
   const statements=[];
   if(newClientName){
    clientId=uid();
    statements.push(db.prepare("INSERT INTO clients(id,company_id,name,phone,email,address,notes) VALUES(?,?,?,?,?,?,?)").bind(clientId,companyId,newClientName,String(p.newClientPhone||""),String(p.newClientEmail||""),String(p.newClientAddress||""),""));
   }else if(p.clientId){
    const client=await db.prepare("SELECT id FROM clients WHERE id=? AND company_id=?").bind(String(p.clientId),companyId).first<{id:string}>();
    clientId=client?.id??null;
   }
   const projectId=uid(),estimateId=uid();
   statements.push(
    db.prepare("INSERT INTO projects(id,company_id,client_id,name,address,project_type,area,currency,status) VALUES(?,?,?,?,?,?,?,?,?)").bind(projectId,companyId,clientId,projectName,String(p.address||""),String(p.projectType||"Renovation"),Number(p.area||0),String(p.currency||"USD"),"draft"),
    db.prepare("INSERT INTO estimates(id,company_id,project_id,number,status) VALUES(?,?,?,?,?)").bind(estimateId,companyId,projectId,`EST-${Date.now().toString().slice(-6)}`,"draft"),
   );
   await db.batch(statements);
   return Response.json({ok:true,projectId,estimateId,clientId});
  }

  if(action==="item.create"){
   const estimateId=String(p.estimateId||"");
   const estimate=await db.prepare("SELECT id FROM estimates WHERE id=? AND company_id=?").bind(estimateId,companyId).first();
   if(!estimate)throw new Error("Estimate not found");
   await db.prepare("INSERT INTO estimate_items(id,company_id,estimate_id,category,name,quantity,unit,labor_cost,material_cost,markup,selling_price) VALUES(?,?,?,?,?,?,?,?,?,?,?)").bind(uid(),companyId,estimateId,String(p.category||"Other"),String(p.name||"New item"),Number(p.quantity||1),String(p.unit||"unit"),Number(p.laborCost||0),Number(p.materialCost||0),Number(p.markup||.25),Number(p.sellingPrice||0)).run();
  }else if(action==="item.delete"){
   await db.prepare("DELETE FROM estimate_items WHERE id=? AND company_id=?").bind(String(p.id),companyId).run();
  }else if(action==="material.create"){
   await db.prepare("INSERT INTO materials(id,company_id,name,category,unit,purchase_price,selling_price,supplier,active) VALUES(?,?,?,?,?,?,?,?,1)").bind(uid(),companyId,String(p.name||"Material"),String(p.category||"Other"),String(p.unit||"unit"),Number(p.purchasePrice||0),Number(p.sellingPrice||0),String(p.supplier||"")).run();
  }else if(action==="settings.update"){
   await db.prepare("UPDATE settings SET currency=?,default_markup=?,default_margin=?,quick_prices=?,phone=?,email=?,address=? WHERE company_id=?").bind(String(p.currency||"USD"),Number(p.defaultMarkup||.25),Number(p.defaultMargin||.2),JSON.stringify(p.quickPrices||{}),String(p.phone||""),String(p.email||""),String(p.address||""),companyId).run();
  }else if(action==="proposal.create"){
   const estimateId=String(p.estimateId||"");
   const estimate=await db.prepare("SELECT id FROM estimates WHERE id=? AND company_id=?").bind(estimateId,companyId).first();
   if(!estimate)throw new Error("Estimate not found");
   await db.prepare("INSERT INTO proposals(id,company_id,estimate_id,status,public_token,sent_at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP)").bind(uid(),companyId,estimateId,"sent",uid()).run();
  }else{
   return Response.json({error:"Unknown action"},{status:400});
  }
  return Response.json({ok:true});
 }catch(error){return Response.json({error:error instanceof Error?error.message:"Request failed"},{status:400})}
}
