import { randomBytes, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { validateTestUrl, verifyTestDatabase } from "../integration/guard.js";
import { createSmtpSink } from "./smtp-sink.js";
const results=[]; let db,appDb,sink;
console.error=()=>{};
class Failure extends Error {}
const check=(value,message)=>{if(!value)throw new Failure(message);};
const status=(response,expected)=>check(response.status===expected,`HTTP_${response.status}_EXPECTED_${expected}`);
try {
    const url=validateTestUrl(process.env.TEST_DATABASE_URL);check(process.env.DATABASE_URL===url&&process.env.NODE_ENV==='test','ENV_REJECTED');
    db=new PrismaClient({datasources:{db:{url}},log:[]});await verifyTestDatabase(db);
    sink=await createSmtpSink();Object.assign(process.env,{JWT_SECRET:randomBytes(48).toString('hex'),CSRF_SECRET:randomBytes(48).toString('hex'),CLIENT_URL:'http://127.0.0.1:5174',SMTP_HOST:'127.0.0.1',SMTP_PORT:String(sink.port),MAIL_FROM:'qa@example.invalid'});
    const {default:app}=await import('../../src/app.js');appDb=(await import('../../src/config/prisma.js')).default;await verifyTestDatabase(appDb);
    const {default:request}=await import('supertest');const {default:bcrypt}=await import('bcryptjs');const {hashToken,createPasswordAuthSession}=await import('../../src/services/auth-session.service.js');
    const password=randomBytes(24).toString('hex')+'Aa1';const nextPassword=randomBytes(24).toString('hex')+'Bb2';const passwordHash=await bcrypt.hash(password,4);
    const user=(google=false)=>db.user.create({data:{name:'QA Akun',email:`${randomUUID()}@example.invalid`,passwordHash:google?null:passwordHash}});
    function call(method,path,body,auth,csrf=true){let q=request(app)[method]('/api/v1'+path).set('Origin',process.env.CLIENT_URL);if(auth){q=q.set('Cookie',auth.cookie);if(csrf)q=q.set('X-CSRF-Token',auth.csrf);}return body?q.send(body):q;}
    async function login(u,pass=password){const response=await call('post','/auth/login',{email:u.email,password:pass});status(response,200);const cookie=response.headers['set-cookie'].find(v=>v.startsWith('whylet_session=')).split(';')[0];const csrf=await call('get','/auth/csrf-token',null,{cookie,csrf:''});status(csrf,200);return{cookie,csrf:csrf.body.data.csrfToken};}
    const change={currentPassword:password,password:nextPassword,confirmPassword:nextPassword};
    async function run(id,evidence,fn){try{await fn();results.push({id,status:'PASS',evidence});}catch(error){results.push({id,status:'FAIL',reason:error instanceof Failure?error.message:'ACCOUNT_FAILURE_REDACTED'});}}
    await run('AC-01','Profil terisolasi, CSRF wajib, nama berubah; hash dan password tidak bocor.',async()=>{
        const a=await user(),b=await user();const auth=await login(a);
        status(await call('get','/account'),401);
        const response=await call('get','/account',null,auth);status(response,200);check(response.body.data.hasPassword===true&&!('passwordHash'in response.body.data),'PROFILE_SECRET_LEAK');
        status(await call('patch','/account',{name:'Nama QA Baru'},auth,false),403);
        status(await call('patch','/account',{name:'Nama QA Baru',userId:b.id},auth),400);
        status(await call('patch','/account',{name:'Nama QA Baru'},auth),200);
        check((await db.user.findUnique({where:{id:a.id}})).name==='Nama QA Baru'&&(await db.user.findUnique({where:{id:b.id}})).name==='QA Akun','PROFILE_OWNERSHIP_FAILED');
    });
    await run('AC-02','Ganti password menolak password lama salah; sukses mencabut sesi; login lama 401 dan baru 200.',async()=>{
        const a=await user(),auth=await login(a);
        status(await call('patch','/account/password',{...change,currentPassword:'Salah123'},auth),400);
        check(await db.authSession.count({where:{userId:a.id,revokedAt:null}})===1,'WRONG_PASSWORD_REVOKED_SESSION');
        status(await call('patch','/account/password',change,auth),200);
        status(await call('get','/auth/me',null,auth),401);
        status(await call('post','/auth/login',{email:a.email,password}),401);
        await login(a,nextPassword);
        check(await bcrypt.compare(nextPassword,(await db.user.findUnique({where:{id:a.id}})).passwordHash),'PASSWORD_NOT_CHANGED');
    });
    await run('AC-03','Forgot generik; SMTP lokal/token hash/TTL; reset sekali pakai mencabut sesi; Google-only tidak dikirimi reset.',async()=>{
        const a=await user(),auth=await login(a);const before=sink.messages.length;
        const response=await call('post','/auth/forgot-password',{email:a.email});status(response,200);
        const absent=await call('post','/auth/forgot-password',{email:`${randomUUID()}@example.invalid`});status(absent,200);check(absent.body.message===response.body.message,'ACCOUNT_ENUMERATION');
        const google=await user(true);status(await call('post','/auth/forgot-password',{email:google.email}),200);
        check(sink.messages.length===before+1,'GOOGLE_RESET_OR_EMAIL_MISSING');
        const decoded=sink.messages.at(-1).replace(/=\r?\n/g,'').replace(/=3D/gi,'=');const token=/\/reset-password\?token=([a-f0-9]{64})/.exec(decoded)?.[1];check(Boolean(token),'RESET_LINK_MISSING');
        const row=await db.passwordResetToken.findUnique({where:{tokenHash:hashToken(token)}});check(row?.userId===a.id&&row.tokenHash!==token&&row.expiresAt-Date.now()>29*60000,'RESET_TOKEN_INVALID');
        const body={token,password:nextPassword,confirmPassword:nextPassword};status(await call('post','/auth/reset-password',body),200);status(await call('post','/auth/reset-password',body),400);
        status(await call('get','/auth/me',null,auth),401);status(await call('post','/auth/login',{email:a.email,password}),401);await login(a,nextPassword);
        check(Boolean((await db.passwordResetToken.findUnique({where:{id:row.id}})).usedAt),'RESET_TOKEN_NOT_CONSUMED');
    });
    await run('AC-04','Token kedaluwarsa ditolak; dua reset bersamaan tepat satu 200 dan satu 400.',async()=>{
        const a=await user();const expired=randomBytes(32).toString('hex');await db.passwordResetToken.create({data:{userId:a.id,tokenHash:hashToken(expired),expiresAt:new Date(Date.now()-60000)}});
        status(await call('post','/auth/reset-password',{token:expired,password:nextPassword,confirmPassword:nextPassword}),400);
        check((await db.user.findUnique({where:{id:a.id}})).passwordHash===passwordHash,'EXPIRED_RESET_MUTATED');
        const token=randomBytes(32).toString('hex');await db.passwordResetToken.create({data:{userId:a.id,tokenHash:hashToken(token),expiresAt:new Date(Date.now()+1800000)}});
        const responses=await Promise.all([1,2].map(()=>call('post','/auth/reset-password',{token,password:nextPassword,confirmPassword:nextPassword})));
        check(responses.filter(r=>r.status===200).length===1&&responses.filter(r=>r.status===400).length===1,'RESET_REUSED_CONCURRENTLY_'+responses.map(r=>r.status).sort().join('_'));
    });
    await run('AC-05','Login menolak hash usang; akun Google-only menolak perubahan password biasa.',async()=>{
        const a=await user();await db.user.update({where:{id:a.id},data:{passwordHash:await bcrypt.hash(nextPassword,4)}});let rejected=false;
        try{await createPasswordAuthSession(a.id,{cookie:()=>{}},passwordHash);}catch(error){rejected=error.status===401;}check(rejected&&await db.authSession.count({where:{userId:a.id}})===0,'STALE_LOGIN_ALLOWED');
        const b=await user(),auth=await login(b);await db.user.update({where:{id:b.id},data:{passwordHash:null}});
        const profile=await call('get','/account',null,auth);status(profile,200);check(profile.body.data.hasPassword===false,'GOOGLE_PROFILE_PASSWORD_FLAG');
        status(await call('patch','/account/password',change,auth),400);
    });
    await run('AC-06','Origin asing ditolak; rate limit tetap aktif pada permintaan reset.',async()=>{
        status(await request(app).post('/api/v1/auth/forgot-password').set('Origin','https://untrusted.invalid').send({email:'qa@example.invalid'}),403);
        const statuses=[];for(let i=0;i<25;i++)statuses.push((await call('post','/auth/forgot-password',{email:`${randomUUID()}@example.invalid`})).status);
        check(statuses.includes(429)&&statuses.every(code=>[200,429].includes(code)),'SENSITIVE_RATE_LIMIT_MISSING');
    });
}catch{/* Tidak mencetak secret/SQL. */}finally{
    await sink?.close();await appDb?.$disconnect();await db?.$disconnect();
    for(let i=1;i<=6;i++){const id=`AC-0${i}`;if(!results.some(r=>r.id===id))results.push({id,status:'NOT TESTED',reason:'ACCOUNT_PREFLIGHT_FAILED'});}
    process.stdout.write('WHYLET_QA_RESULT='+JSON.stringify({results})+'\n');process.exitCode=results.every(r=>r.status==='PASS')?0:1;
}
