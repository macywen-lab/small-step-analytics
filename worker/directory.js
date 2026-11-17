function employeeLoginState(user,person){
 if(!person)return '不在員工名單';
 const status=employmentStatus(person);if(status!=='在職')return status;
 if(user.directoryEmployment){const status=employmentStatus(user.directoryEmployment);if(status!=='在職')return status}
 if(!user||user.enabled===false||!user.hash||!user.salt)return '未設定密碼';
 return '已啟用';
}
async function prepareEmployeeAccounts(input,roster,existing,preview=false){
 if(!Array.isArray(input.accounts)||!input.accounts.length||input.accounts.length>5000)fail('請提供 1～5,000 筆員工帳號。',422);
 const ids=new Set(),names=new Set(),rows=[];
 for(const a of input.accounts){
  const name=String(a.name??'').trim(),id=String(a.id??'').trim(),password=a.password??'';
  if(!name||!roster.some(e=>e.name===name))fail(`「${name}」不在網站保留名冊，請先更新員工資料。`,422);
  if(names.has(name)||(id&&ids.has(id)))fail('檔案中工號或姓名重複，請先核對。',422);names.add(name);if(id)ids.add(id);
  if(id&&!/^[A-Za-z0-9._-]{1,30}$/.test(id))fail('工號請填 1～30 位英數字、點、底線或減號。',422);
  if(typeof password!=='string')fail(`「${name}」密碼格式不正確。`,422);
  const hasPassword=password.trim().length>0;
  if(hasPassword&&(!id||password.length<4||password.length>128))fail(`「${name}」需有工號，初始密碼請填 4～128 個字元。`,422);
  if(id&&existing.some(u=>(u.id===id&&u.name!==name)||(u.name===name&&u.id!==id)))fail(`「${name}」工號與既有帳號對應不一致，請先核對。`,409);
  let directoryEmployment;
  if(a.hireDate!==undefined||a.leaveDate!==undefined){const person=roster.find(e=>e.name===name);directoryEmployment={status:person.status||'未註記',hireDate:employmentDate(a.hireDate,`${name}到職日`),leaveDate:employmentDate(a.leaveDate,`${name}離職日`),...(person.knownActiveBy?{knownActiveBy:person.knownActiveBy}:{})};if(directoryEmployment.hireDate&&directoryEmployment.leaveDate&&directoryEmployment.leaveDate<directoryEmployment.hireDate)fail(`${name}離職日不得早於到職日。`,422)}
  rows.push({id,name,password,hasPassword,directoryEmployment});
 }
 const users=structuredClone(existing),counts={created:0,reset:0,kept:0,disabled:0,withoutId:0};
 for(const a of rows){
  let old=users.find(u=>u.name===a.name),person=roster.find(e=>e.name===a.name);
  if(!a.id){counts.withoutId++;if(old){Object.assign(old,{enabled:false,hash:null,salt:null,revision:crypto.randomUUID(),updatedAt:new Date().toISOString(),...(a.directoryEmployment?{directoryEmployment:a.directoryEmployment}:{})});counts.disabled++}continue}
  const enabled=a.hasPassword&&employmentStatus(a.directoryEmployment||person)==='在職'&&employmentStatus(person)==='在職';
  if(!enabled){
   const next={id:a.id,name:a.name,enabled:false,salt:null,hash:null,revision:crypto.randomUUID(),createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),...(a.directoryEmployment?{directoryEmployment:a.directoryEmployment}:{})};
   if(old)Object.assign(old,next);else users.push(next);counts.disabled++;continue;
  }
  if(old&&old.enabled!==false&&old.hash&&input.resetPasswords!==true){if(a.directoryEmployment)old.directoryEmployment=a.directoryEmployment;old.enabled=true;counts.kept++;continue}
  const salt=preview?'':authHex(crypto.getRandomValues(new Uint8Array(16))),hash=preview?'':await authPassword(a.password,salt),next={id:a.id,name:a.name,enabled:true,salt,hash,revision:crypto.randomUUID(),createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),...(a.directoryEmployment?{directoryEmployment:a.directoryEmployment}:{})};
  if(old){Object.assign(old,next);counts.reset++}else{users.push(next);counts.created++}
 }
 const enabled=users.filter(u=>employeeLoginState(u,roster.find(e=>e.name===u.name))==='已啟用'||(preview&&u.enabled===true)).length;
 return {users,summary:{...counts,total:users.length,enabled,blocked:users.length-enabled}};
}
async function employeeDirectorySync(request,bucket){
 writeGuard(request);const input=await employeeBody(request,1024*1024),current=await readCurrent(bucket),auth=await employeeUsers(bucket);
 if(input.preview!==true&&input.expectedRevision!==current.record.revision)fail('名單已變更，請重新預覽再更新。',409);
 if(!Array.isArray(input.employees)||!input.employees.length)fail('請提供完整員工名單。',422);
 const raw=normalizedRaw({records:[],employees:input.employees,rosterOnly:true}),merged=mergeEmployees(current.record.snapshot.roster||[],raw.employees);
 if(input.accounts?.length!==raw.employees.length||input.accounts.some(a=>!raw.employees.some(e=>e.name===a.name)))fail('帳號與員工名單必須逐人對應。',422);
 const prepared=await prepareEmployeeAccounts(input,merged.roster,auth.users,input.preview===true);
 const summary={...prepared.summary,roster:merged.roster.length,rosterChanges:merged.changes.length,departed:merged.roster.filter(e=>employmentStatus(e)==='離職').length};
 if(input.preview===true)return json({preview:true,revision:current.record.revision,summary});
 // Both the new roster and the credential directory become current with one conditional pointer write.
 const key=EMP_ROOT+'directories/'+crypto.randomUUID()+'.json';await bucket.put(key,JSON.stringify({users:prepared.users,importedAt:new Date().toISOString(),filename:textValue(input.filename||'員工名單.xlsx','檔名',240)}));
 const snapshot={...current.record.snapshot,roster:merged.roster};let next;
 try{next=await publishVersion(bucket,current,{action:'employee-directory',filename:textValue(input.filename||'員工名單.xlsx','檔名',240),hasOriginal:false,quarter:null,employeeDirectoryKey:key,snapshot})}catch(e){await bucket.delete(key);throw e}
 return json({updated:true,revision:next.revision,summary},201);
}
