'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) {
      setErro('Email ou senha incorretos. Verifique suas credenciais.')
      setLoading(false)
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:'20px',position:'relative'}}>
      <div style={{position:'fixed',inset:0,opacity:.025,backgroundImage:'linear-gradient(var(--cyan) 1px,transparent 1px),linear-gradient(90deg,var(--cyan) 1px,transparent 1px)',backgroundSize:'40px 40px',pointerEvents:'none'}}/>
      <div style={{width:'100%',maxWidth:'400px',animation:'fadeIn .4s ease'}}>
        {/* Logos */}
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:16,marginBottom:32}}>
          <Image src="/logo-oneclick.png" alt="OneClick Soluções" width={220} height={70} style={{objectFit:'contain'}}/>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{height:1,width:50,background:'var(--border)'}}/>
            <span style={{fontSize:10,color:'var(--muted)',letterSpacing:'.1em',textTransform:'uppercase'}}>Canal Parceiro</span>
            <div style={{height:1,width:50,background:'var(--border)'}}/>
          </div>
          <div style={{background:'#fff',borderRadius:8,padding:'4px 14px',height:40,display:'flex',alignItems:'center'}}>
            <Image src="/logo-stockfarma.png" alt="Stock Farma" width={110} height={32} style={{objectFit:'contain'}}/>
          </div>
        </div>

        {/* Card login */}
        <div style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:16,padding:'32px 28px'}}>
          <h1 style={{fontSize:18,fontWeight:700,color:'var(--cyan)',marginBottom:4,textAlign:'center'}}>Acesso ao CRM</h1>
          <p style={{fontSize:11,color:'var(--muted)',textAlign:'center',marginBottom:24}}>Pedido Eletrônico — Portal de Instalações</p>

          <form onSubmit={handleLogin} style={{display:'flex',flexDirection:'column',gap:14}}>
            <div style={{display:'flex',flexDirection:'column',gap:5}}>
              <label style={{fontSize:10,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.08em'}}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e=>setEmail(e.target.value)}
                placeholder="seu@email.com.br"
                required
                style={{background:'rgba(0,0,0,.3)',border:'1px solid var(--border)',color:'var(--text)',borderRadius:8,padding:'10px 14px',fontSize:13,fontFamily:'inherit',outline:'none',transition:'border-color .15s'}}
                onFocus={e=>e.target.style.borderColor='rgba(0,229,255,.4)'}
                onBlur={e=>e.target.style.borderColor='var(--border)'}
              />
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:5}}>
              <label style={{fontSize:10,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.08em'}}>Senha</label>
              <input
                type="password"
                value={senha}
                onChange={e=>setSenha(e.target.value)}
                placeholder="••••••••"
                required
                style={{background:'rgba(0,0,0,.3)',border:'1px solid var(--border)',color:'var(--text)',borderRadius:8,padding:'10px 14px',fontSize:13,fontFamily:'inherit',outline:'none',transition:'border-color .15s'}}
                onFocus={e=>e.target.style.borderColor='rgba(0,229,255,.4)'}
                onBlur={e=>e.target.style.borderColor='var(--border)'}
              />
            </div>
            {erro && <div style={{background:'rgba(255,59,95,.1)',border:'1px solid rgba(255,59,95,.25)',color:'var(--red)',borderRadius:8,padding:'8px 12px',fontSize:12}}>{erro}</div>}
            <button
              type="submit"
              disabled={loading}
              style={{background:loading?'rgba(0,229,255,.1)':'rgba(0,229,255,.15)',border:'1px solid rgba(0,229,255,.35)',color:'var(--cyan)',borderRadius:8,padding:'11px',fontSize:13,fontWeight:700,cursor:loading?'not-allowed':'pointer',fontFamily:'inherit',transition:'.15s',marginTop:4,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}
            >
              {loading ? (
                <><span style={{width:14,height:14,border:'2px solid rgba(0,229,255,.3)',borderTop:'2px solid var(--cyan)',borderRadius:'50%',display:'inline-block',animation:'spin .8s linear infinite'}}/>Entrando...</>
              ) : 'Entrar no CRM'}
            </button>
          </form>
        </div>

        <p style={{textAlign:'center',fontSize:10,color:'var(--muted)',marginTop:20}}>
          Desenvolvido por <span style={{color:'var(--cyan)'}}>OneClick Soluções</span> · TI Enterprise
        </p>
      </div>
    </div>
  )
}
