const fs=require('fs');
const mysql=require('/Applications/XAMPP/xamppfiles/htdocs/lms/backend/node_modules/mysql2/promise');
const env=Object.fromEntries(fs.readFileSync('/Applications/XAMPP/xamppfiles/htdocs/lms/backend/.env','utf8').split('\n').filter(l=>/^[A-Z_]+=/.test(l)).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).replace(/^["']|["']$/g,'')]}));
const mk=(limit)=>mysql.createPool({host:env.DB_HOST,port:+env.DB_PORT||3306,user:env.DB_USER,password:env.DB_PASSWORD,database:env.DB_NAME,connectionLimit:limit,queueLimit:100,waitForConnections:true});
const stat=async(p)=>{const [r]=await p.query("SHOW GLOBAL STATUS WHERE Variable_name IN ('Questions','Max_used_connections')");return Object.fromEntries(r.map(x=>[x.Variable_name,+x.Value]))};
const SQL=`SELECT us.id FROM user_subscriptions us WHERE us.user_id = ? AND us.status='active' AND us.start_date <= CURDATE() AND us.end_date >= CURDATE() AND (us.access_expires_at IS NULL OR us.access_expires_at > UTC_TIMESTAMP()) LIMIT 1`;
(async()=>{
 const adm=mk(1);
 const [[c]]=await adm.query('SELECT (SELECT COUNT(*) FROM lessons) lessons,(SELECT COUNT(*) FROM user_subscriptions) subs,(SELECT COUNT(*) FROM users) users,(SELECT COUNT(*) FROM student_answers) answers,(SELECT COUNT(*) FROM quiz_attempts) attempts');
 console.log('local table sizes',c);
 // A: listQuizzes feature checks, 10 students at once, pool 4
 for (const [label,calls] of [['BEFORE (3 identical checks)',3],['AFTER (1 check)',1]]) {
  const p=mk(4); const s0=await stat(adm); const t=Date.now();
  await Promise.all(Array.from({length:10},(_,u)=>Promise.all(Array.from({length:calls},()=>p.execute(SQL,[u+1])))));
  const ms=Date.now()-t; const s1=await stat(adm);
  console.log(`A ${label}: 10 students -> queries≈${s1.Questions-s0.Questions-1}, ${ms}ms`); await p.end();
 }
 // B: reorder, N parallel single-row statements on pool 4 / queueLimit 100
 for (const N of [50,100,150,300]) {
  const p=mk(4); let ok=0,fail=0,msg='';
  const t=Date.now();
  await Promise.all(Array.from({length:N},(_,i)=>p.execute('SELECT id FROM lessons WHERE id = ?',[i+1]).then(()=>ok++,e=>{fail++;msg=e.message})));
  console.log(`B reorder N=${N}: ok=${ok} failed=${fail} ${msg} (${Date.now()-t}ms)`); await p.end();
 }
 await adm.end();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
