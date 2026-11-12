'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import '../admin.css';
export default function AdminLoginPage(){
 const router=useRouter(); const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [message,setMessage]=useState(''); const [busy,setBusy]=useState(false);
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setMessage('');if(!supabase){setMessage('Website connection is not configured.');return;}setBusy(true);
 const {data,error}=await supabase.auth.signInWithPassword({email,password});
 if(error||!data.user){setMessage(error?.message||'Login failed.');setBusy(false);return;}
 const {data:profile,error:profileError}=await supabase.from('profiles').select('role').eq('id',data.user.id).maybeSingle();
 if(profileError||profile?.role!=='admin'){await supabase.auth.signOut();setMessage('This account does not have administrator access.');setBusy(false);return;}
 router.replace('/admin/dashboard');router.refresh();
 }
 return <main className="admin-auth-page"><a className="admin-back" href="/">← Back to EduAxis India</a><section className="admin-auth-card"><div className="admin-logo">E</div><div className="admin-kicker">EDUAXIS INDIA</div><h1>Administrator login</h1><p className="admin-muted">Sign in with your authorised administrator account.</p><form onSubmit={submit} className="admin-form"><label htmlFor="admin-email">Email address</label><input id="admin-email" type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="Enter your admin email"/><label htmlFor="admin-password">Password</label><input id="admin-password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password"/>{message&&<div className="admin-error" role="alert">{message}</div>}<button className="admin-primary" disabled={busy}>{busy?'Signing in…':'Sign in securely'}</button></form><div className="admin-auth-foot">Administrator access only · EduAxis India</div></section></main>;
}
