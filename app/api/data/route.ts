import {env} from "cloudflare:workers";
import {headers} from "next/headers";
import {z} from "zod";
import {catalogSeed} from "@/lib/catalog-seed";

const categories=[...new Set(catalogSeed.map(([,category])=>category))];
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
   ...catalogSeed.map(([section,category,name,unit,labor,material])=>db.prepare("INSERT INTO work_items(id,company_id,category_id,section,name,unit,labor_cost,material_cost,default_markup,active) VALUES(?,?,?,?,?,?,?,?,?,1)").bind(uid(),cid,categoryIds.get(category),section,name,unit,labor,material,.3)),
  ]);
  company=await db.prepare("SELECT * FROM companies WHERE id=?").bind(cid).first<Record<string,unknown>>();
 }
 const companyId=String(company!.id);
 const seedState=await db.prepare("SELECT catalog_version FROM settings WHERE company_id=?").bind(companyId).first<{catalog_version:number}>();
 if(Number(seedState?.catalog_version||0)<1){
  const storedCategories=await db.prepare("SELECT id,name FROM work_categories WHERE company_id=?").bind(companyId).all<{id:string;name:string}>();
  const categoryIds=new Map(storedCategories.results.map(row=>[row.name,row.id]));
  const categoryStatements=[];
  for(const category of categories)if(!categoryIds.has(category)){const categoryId=uid();categoryIds.set(category,categoryId);categoryStatements.push(db.prepare("INSERT INTO work_categories(id,company_id,name) VALUES(?,?,?)").bind(categoryId,companyId,category))}
  for(let offset=0;offset<categoryStatements.length;offset+=50)await db.batch(categoryStatements.slice(offset,offset+50));
  const storedItems=await db.prepare("SELECT id,name FROM work_items WHERE company_id=?").bind(companyId).all<{id:string;name:string}>();
  const itemIds=new Map(storedItems.results.map(row=>[row.name,row.id]));
  const itemStatements=catalogSeed.map(([section,category,name,unit,labor,material])=>{
   const existingId=itemIds.get(name);
   if(existingId)return db.prepare("UPDATE work_items SET section=?,category_id=? WHERE id=? AND company_id=?").bind(section,categoryIds.get(category),existingId,companyId);
   return db.prepare("INSERT INTO work_items(id,company_id,category_id,section,name,unit,labor_cost,material_cost,default_markup,active) VALUES(?,?,?,?,?,?,?,?,?,1)").bind(uid(),companyId,categoryIds.get(category),section,name,unit,labor,material,.3);
  });
  for(let offset=0;offset<itemStatements.length;offset+=50)await db.batch(itemStatements.slice(offset,offset+50));
  await db.prepare("UPDATE settings SET catalog_version=1 WHERE company_id=?").bind(companyId).run();
 }
 return {db,companyId,company};
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
  const categoryIdFor=async(name:string)=>{
   const safeName=name.trim()||"Other";
   const existing=await db.prepare("SELECT id FROM work_categories WHERE company_id=? AND name=?").bind(companyId,safeName).first<{id:string}>();
   if(existing)return existing.id;
   const categoryId=uid();
   await db.prepare("INSERT INTO work_categories(id,company_id,name) VALUES(?,?,?)").bind(categoryId,companyId,safeName).run();
   return categoryId;
  };

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

  if(action==="catalog.create"){
   const name=String(p.name||"").trim();
   if(!name)throw new Error("Work name is required");
   const category=String(p.category||"Other");
   const categoryId=await categoryIdFor(category);
   const catalogItemId=uid();
   await db.prepare("INSERT INTO work_items(id,company_id,category_id,section,name,unit,labor_cost,material_cost,default_markup,active) VALUES(?,?,?,?,?,?,?,?,?,1)").bind(catalogItemId,companyId,categoryId,String(p.section||"Other works"),name,String(p.unit||"unit"),Number(p.laborCost||0),Number(p.materialCost||0),Number(p.defaultMarkup||0)).run();
   return Response.json({ok:true,catalogItemId});
  }

  if(action==="catalog.update"){
   const id=String(p.id||"");
   const name=String(p.name||"").trim();
   if(!id||!name)throw new Error("Work name is required");
   const categoryId=await categoryIdFor(String(p.category||"Other"));
   await db.prepare("UPDATE work_items SET category_id=?,section=?,name=?,unit=?,labor_cost=?,material_cost=?,default_markup=?,active=? WHERE id=? AND company_id=?").bind(categoryId,String(p.section||"Other works"),name,String(p.unit||"unit"),Number(p.laborCost||0),Number(p.materialCost||0),Number(p.defaultMarkup||0),p.active===false?0:1,id,companyId).run();
   return Response.json({ok:true});
  }

  if(action==="catalog.delete"){
   await db.prepare("DELETE FROM work_items WHERE id=? AND company_id=?").bind(String(p.id||""),companyId).run();
   return Response.json({ok:true});
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
