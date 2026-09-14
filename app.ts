
import express, { Request, Response } from "express";
import path from "path";
import crypto from "crypto";

const app = express();
const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT) || 5000;

type Level = { id:number; name:string; seconds:number };
type PublicQuestion = { id:string; type:string; text:string; options:string[]; meta?:string };
type Question = PublicQuestion & { answer:string };
type Session = {
  startedAt:number; remaining:number; currentLevel:number; retries:number[];
  questions: Question[]; questionIndex:number; levelStartedAt:number;
  used: Set<string>; failed:boolean; completed:boolean;
};

const LEVELS:Level[]=[
 {id:0,name:"EASY",seconds:30},{id:1,name:"MEDIUM",seconds:60},
 {id:2,name:"HARD",seconds:75},{id:3,name:"EXTRA HARD",seconds:105},
 {id:4,name:"COMPLEX",seconds:120}
];
const GLOBAL_LIMIT=600, RETRY_PENALTY=60;
const sessions=new Map<string,Session>();

const pick=<T,>(a:T[])=>a[Math.floor(Math.random()*a.length)];
const shuffle=<T,>(a:T[])=>{const x=[...a];for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]];}return x};
const id=()=>crypto.randomUUID();
const nums=(n:number,min:number,max:number)=>shuffle(Array.from({length:max-min+1},(_,i)=>i+min)).slice(0,n);
const options=(answer:string, distractors:string[])=>shuffle([answer,...[...new Set(distractors.filter(x=>x!==answer))].slice(0,4)]);

function q(text:string, answer:string, distractors:string[], type="logic", meta?:string):Question {
  return {id:id(),type,text,options:options(answer,distractors),answer,meta};
}
function generate(level:number):Question[] {
  const out:Question[]=[];
  if(level===0){
    const people=shuffle([
      "ALICE — has a laptop","BOB — has a desktop computer","CHARLIE — has a phone",
      "DIANA — has a calculator","ETHAN — has a tablet"
    ]);
    out.push(q("SELECT ALL? No. Select the person who definitely has a COMPUTER.",people.find(x=>x.includes("computer"))!,people));
    const a=pick(nums(1,20,40)),b=pick(nums(1,2,20)),ans=String(a+b);
    out.push(q(`What is ${a} + ${b}?`,ans,[String(+ans-1),String(+ans+1),String(+ans+2),String(+ans+5)],"math"));
    const choices=["True","False","Both","Neither","Cannot be determined"];
    out.push(q("Are you human?\n\nPython lists can contain values of different data types.", "True", choices,"human-check"));
  } else if(level===1){
    const rows=shuffle(["Alex — drank coffee today","Brian — drank tea today","Chris — drank water today","David — drank juice today","Evan — drank nothing today"]);
    const target=pick(rows);
    out.push(q("SELECT THE PERSON WHO MATCHES THE STATEMENT:\n\nDRANK COFFEE TODAY.",rows[0].includes("coffee")?rows[0]:target,rows));
    const a=pick(nums(1,10,40)),b=pick(nums(1,2,15)),ans=String(a*b);
    out.push(q(`Calculate: ${a} × ${b}`,ans,[String(+ans-1),String(+ans+1),String(+ans+b),String(+ans-b)],"math"));
    const words=shuffle(["human","robot","human","bot","human"]);
    const targetWord=pick(["human","robot"]); const count=words.filter(x=>x===targetWord).length;
    out.push(q(`How many times does "${targetWord}" appear?\n\n[ ${words.join(", ")} ]`,String(count),[String(count+1),String(Math.max(0,count-1)),"2","3"],"count"));
  } else if(level===2){
    const rows=["A — slept exactly 8 hours","B — slept 7 hours 59 minutes","C — slept 8 hours 1 minute","D — slept 7 hours 58 minutes","E — slept 8 hours 2 minutes"];
    out.push(q("SELECT THE PROGRAMMER WHO SLEPT FOR EXACTLY 8 HOURS.","A — slept exactly 8 hours",rows));
    const a=pick(nums(1,10,25)),b=pick(nums(1,2,9)),c=pick(nums(1,1,8)),ans=String(a*b-c);
    out.push(q(`Calculate: (${a} × ${b}) − ${c}`,ans,[String(+ans+1),String(+ans-1),String(+ans+c),String(+ans-c)],"math"));
    const ns=nums(5,10,50),ans2=String(Math.max(...ns));
    out.push(q(`Select the LARGEST number:\n\n[ ${ns.join(", ")} ]`,ans2,ns.map(String),"precision"));
  } else if(level===3){
    const times=["09:59:58","09:59:59","10:00:00","10:00:01","10:00:02"];
    out.push(q("A system unlocks at exactly 10:00:00.\n\nSELECT THE EXACT UNLOCK TIME.","10:00:00",times));
    const a=pick(nums(1,5,12)),b=pick(nums(1,5,12)),c=pick(nums(1,2,6)),ans=String((a+b)*c);
    out.push(q(`Calculate precisely: (${a} + ${b}) × ${c}`,ans,[String(a+b*c),String(a*b+c),String(+ans+c),String(+ans-c)],"math"));
    const ns=nums(5,20,80),sorted=[...ns].sort((a,b)=>a-b),s=JSON.stringify(sorted);
    out.push(q("Which option lists these numbers in ASCENDING order?",s,[JSON.stringify([...sorted].reverse()),JSON.stringify(ns),JSON.stringify(sorted.map(x=>x+1)),JSON.stringify(sorted.map(x=>x-1))],"ordering"));
  } else {
    const a=pick(nums(1,3,12)),b=pick(nums(1,3,12)),c=pick(nums(1,1,5));
    const answer=a*b+c;
    out.push(q(`FINAL TECHNICAL CHALLENGE\n\nWhat will this Python code print?\n\nx = ${a}\ny = ${b}\nz = ${c}\nprint(x * y + z)`,String(answer),[String(answer-1),String(answer+1),String(a+b+c),String(a*b-c)],"code"));
    const A=pick([true,false]),B=pick([true,false]),C=pick([true,false]),bool=String((A&&B)||C);
    out.push(q(`Evaluate using Python boolean logic:\n\n(${A} AND ${B}) OR ${C}`,bool,["True","False","0","1"].filter(x=>x!==bool),"code"));
    const ns=nums(5,10,40),idx=Math.floor(Math.random()*5),ans2=String(ns[idx]);
    out.push(q(`numbers = [${ns.join(", ")}]\n\nWhat is numbers[${idx}]?`,ans2,ns.map(String),"code"));
  }
  return shuffle(out);
}

function publicQ(x:Question):PublicQuestion { const {answer,...rest}=x; return rest; }
function elapsed(s:Session){return Math.floor((Date.now()-s.startedAt)/1000)}
function levelElapsed(s:Session){return Math.floor((Date.now()-s.levelStartedAt)/1000)}
function totalRemaining(s:Session){return Math.max(0,s.remaining-elapsed(s))}
function levelRemaining(s:Session){return Math.max(0,LEVELS[s.currentLevel].seconds-levelElapsed(s))}
function status(s:Session){
  const rem=totalRemaining(s);
  if(rem<=0){s.failed=true;}
  return {level:s.currentLevel,levelName:LEVELS[s.currentLevel].name,levelLimit:LEVELS[s.currentLevel].seconds,
    levelRemaining:Math.min(levelRemaining(s),rem),totalRemaining:rem,retries:s.retries,
    questionNumber:s.questionIndex+1,totalQuestions:s.questions.length,failed:s.failed,completed:s.completed};
}

app.use(express.json());
app.use(express.static(path.join(__dirname,"..","public")));

app.post("/api/start",(_req,res)=>{
  const token=id(), now=Date.now();
  const s:Session={startedAt:now,remaining:GLOBAL_LIMIT,currentLevel:0,retries:[0,0,0,0,0],
    questions:generate(0),questionIndex:0,levelStartedAt:now,used:new Set(),failed:false,completed:false};
  sessions.set(token,s);
  res.json({token,...status(s),question:publicQ(s.questions[0])});
});

app.post("/api/answer",(req,res)=>{
  const s=sessions.get(req.body?.token);
  if(!s) return res.status(401).json({error:"Session expired. Start again."});
  if(s.failed||s.completed) return res.status(400).json({error:"This session is no longer active.",...status(s)});
  const st=status(s);
  if(st.totalRemaining<=0 || st.levelRemaining<=0) return res.status(408).json({error:"Time expired.",...status(s)});
  const qn=s.questions[s.questionIndex];
  const correct=String(req.body?.answer??"")===qn.answer;
  if(!correct){
    s.failed=true;
    return res.json({correct:false,reason:"Incorrect verification. Restart required.",...status(s)});
  }
  s.questionIndex++;
  if(s.questionIndex>=s.questions.length){
    if(s.currentLevel===4){
      s.completed=true;
      return res.json({correct:true,complete:true,reward:"🤖 HUMAN VERIFICATION COMPLETE",key:"R",...status(s)});
    }
    s.currentLevel++;
    s.questions=generate(s.currentLevel); s.questionIndex=0; s.levelStartedAt=Date.now();
  }
  res.json({correct:true,complete:false,...status(s),question:publicQ(s.questions[s.questionIndex])});
});

app.post("/api/retry",(req,res)=>{
  const s=sessions.get(req.body?.token);
  if(!s) return res.status(401).json({error:"Session expired."});
  if(!s.failed) return res.status(400).json({error:"Retry is only available after a failed level."});
  const penalty=RETRY_PENALTY;
  const before=totalRemaining(s);
  if(before<=penalty) return res.status(400).json({error:"Not enough global time left to retry this level.",...status(s)});
  s.remaining = before-penalty; s.failed=false; s.questions=generate(s.currentLevel); s.questionIndex=0; s.levelStartedAt=Date.now(); s.retries[s.currentLevel]++;
  res.json({message:"Level restarted. 60-second penalty applied.",...status(s),question:publicQ(s.questions[0])});
});

app.post("/api/restart",(req,res)=>{
  const old=sessions.get(req.body?.token); if(old) sessions.delete(req.body.token);
  const token=id(),now=Date.now();
  const s:Session={startedAt:now,remaining:GLOBAL_LIMIT,currentLevel:0,retries:[0,0,0,0,0],
    questions:generate(0),questionIndex:0,levelStartedAt:now,used:new Set(),failed:false,completed:false};
  sessions.set(token,s); res.json({token,...status(s),question:publicQ(s.questions[0])});
});
app.get("/api/config",(_req,res)=>res.json({levels:LEVELS,globalLimit:GLOBAL_LIMIT,retryPenalty:RETRY_PENALTY}));
app.listen(PORT,HOST,()=>console.log(`Are You Human? verifier: http://${HOST}:${PORT}`));
