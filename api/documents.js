import { db, storage } from "hatchable";
import { requirePermission, audit } from "lib/authz.js";

export const access = "user";
export const methods = ["GET","POST"];

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg","image/png","image/webp","application/pdf"]);

function validMagic(buf,mime) {
  if (mime==="image/jpeg") return buf.length>3 && buf[0]===0xff && buf[1]===0xd8 && buf[2]===0xff;
  if (mime==="image/png") return buf.length>8 && buf[0]===0x89 && buf[1]===0x50 && buf[2]===0x4e && buf[3]===0x47;
  if (mime==="image/webp") return buf.length>12 && buf.toString("ascii",0,4)==="RIFF" && buf.toString("ascii",8,12)==="WEBP";
  if (mime==="application/pdf") return buf.length>5 && buf.toString("ascii",0,5)==="%PDF-";
  return false;
}
function str(v,n=240){return String(v??"").trim().slice(0,n);}
function amount(v){if(v===null||v===undefined||v==="")return null;const x=Number(String(v).replace(/,/g,""));return Number.isFinite(x)&&x>=0?Math.round(x*100)/100:null;}
function date(v){const s=str(v,10);return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:null;}

export default async function(req,res){
  if(req.method==="GET"){
    const profile=await requirePermission(req,res,"proof_view"); if(!profile)return;
    const q=str(req.query?.q,100);
    const params=[profile.workspace_id];
    let filter="";
    if(q){params.push("%"+q+"%");filter=" AND (title ILIKE $2 OR party_name ILIKE $2 OR reference_number ILIKE $2 OR provider_name ILIKE $2 OR document_type ILIKE $2 OR ocr_text ILIKE $2 OR extracted_data::text ILIKE $2)";}
    const rows=(await db.query(
      `SELECT id,document_type,title,document_date,due_date,party_name,reference_number,amount,paid_amount,balance_due,payment_status,provider_name,currency,original_filename,content_type,byte_size,extracted_data,ocr_text,created_at
       FROM financial_documents WHERE workspace_id=$1 ${filter}
       ORDER BY COALESCE(document_date,created_at::date) DESC,created_at DESC LIMIT 300`,params
    )).rows;
    return res.json({documents:rows});
  }

  const profile=await requirePermission(req,res,"proof_upload"); if(!profile)return;
  const file=(req.files||[]).find(f=>f.field==="file");
  if(!file)return res.status(400).json({error:"Attach the original bill or payment screenshot."});
  if(file.buffer.length>MAX_BYTES)return res.status(413).json({error:"File is over 5 MB. Compress it and try again."});
  if(!ALLOWED.has(file.contentType)||!validMagic(file.buffer,file.contentType))return res.status(415).json({error:"Only valid JPG, PNG, WebP or PDF documents are supported."});

  let data={};
  try{data=typeof req.body?.metadata==="string"?JSON.parse(req.body.metadata):(req.body?.metadata||{});}catch{return res.status(400).json({error:"Document scan data is not valid JSON."});}
  if(!data||typeof data!=="object"||Array.isArray(data))return res.status(400).json({error:"Document metadata must be an object."});

  const ref=str(data.transaction_reference||data.rrn_or_trace||data.bill_number||data.invoice_number||data.consumer_or_customer_reference,120);
  const party=str(data.merchant_or_biller||data.receiver_name||data.sender_name,180);
  const docType=str(data.document_type,60)||"other";
  const amountValue=amount(data.transaction_amount??data.invoice_total);
  const status=["successful","pending","failed","reversed","unpaid","partial","unknown"].includes(data.payment_status)?data.payment_status:"unknown";
  const serializedData=JSON.stringify(data);
  if(serializedData.length>50000)return res.status(413).json({error:"Extracted scan details are too large to save. Reduce the extra text and retry."});
  const key=`documents/${profile.workspace_id}/${crypto.randomUUID()}.${file.contentType==="image/jpeg"?"jpg":file.contentType==="application/pdf"?"pdf":file.contentType.split("/")[1]}`;
  await storage.put(key,file.buffer,file.contentType);
  try{
    const title=str(data.title||data.bill_number&&("Bill "+data.bill_number)||data.invoice_number&&("Invoice "+data.invoice_number)||party||file.filename||"Financial document",200);
    const row=(await db.query(
      `INSERT INTO financial_documents
       (workspace_id,document_type,title,document_date,due_date,party_name,reference_number,amount,paid_amount,balance_due,payment_status,provider_name,currency,extracted_data,ocr_text,storage_key,original_filename,content_type,byte_size,uploaded_by)
       VALUES ($1,$2,$3,$4::date,$5::date,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16,$17,$18,$19,$20)
       RETURNING id,document_type,title,document_date,due_date,party_name,reference_number,amount,paid_amount,balance_due,payment_status,provider_name,created_at`,
      [profile.workspace_id,docType,title,date(data.transaction_date),date(data.due_date),party,ref,amountValue,amount(data.transaction_amount),amount(data.balance_due),status,str(data.provider_name||data.merchant_or_biller,100),str(data.currency||"PKR",8),serializedData,str(data.full_text,30000),key,str(file.filename||"document",200),file.contentType,file.buffer.length,profile.user_id]
    )).rows[0];
    await audit(profile,"financial_document_saved","financial_document",row.id,{document_type:docType,title,reference_number:ref,payment_status:status});
    return res.status(201).json({document:row});
  }catch(error){
    await storage.del(key).catch(()=>{});
    throw error;
  }
}