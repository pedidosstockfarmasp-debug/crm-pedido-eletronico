'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

const ADMIN_EMAIL = 'ronie@oneclicksolucoes.com.br'

interface Atendente {
  id: string
  email: string
  created_at: string
  user_metadata?: { nome?: string }
}

export default function AdminPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ email?: string } | null>(null)
  const [atendentes, setAtendentes] = useState<Atendente[]>([])
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [msg, setMsg] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingPage, setLoadingPage] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      if (data.user.email !== ADMIN_EMAIL) { router.push('/'); return }
      setUser(data.user)
      fetchAtendentes()
      setLoadingPage(false)
    })
  }, [router])

  async function fetchAtendentes() {
    const { data } = await supabase.from('atendentes').select('*').order('criado_em', { ascending: false })
    if (data) setAtendentes(data)
  }

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault()
    setErro(''); setMsg(''); setLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { data: { nome } }
    })
    if (error) { setErro(error.message); setLoading(false); return }
    if (data.user) {
      await supabase.from('atendentes').insert({ id: data.user.id, nome, email, criado_em: new Date().toISOString() })
      setMsg(`Atendente "${nome}" cadastrado com sucesso! Ele receberá um email de confirmação.`)
      setNome(''); setEmail(''); setSenha('')
      fetchAtendentes()
    }
    setLoading(false)
  }

  async function remover(id: string, nomeAt: string) {
    if (!confirm(`Remover atendente "${nomeAt}"?`)) return
    await supabase.from('atendentes').delete().eq('id', id)
    fetchAtendentes()
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loadingPage) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <span style={{color:'var(--cyan)',fontSize:13}}>Verificando acesso...</span>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',padding:'0 0 40px'}}>
      <div style={{position:'fixed',inset:0,opacity:.025,backgroundImage:'linear-gradient(var(--cyan) 1px,transparent 1px),linear-gradient(90deg,var(--cyan) 1px,transparent 1px)',backgroundSize:'40px 40px',pointerEvents:'none'}}/>

      {/* Header */}
      <header style={{display:'flex',alignItems:'center',gap:12,padding:'0 24px',borderBottom:'1px solid var(--border)',height:64,background:'rgba(1,7,18,.95)',backdropFilter:'blur(12px)',position:'sticky',top:0,zIndex:100}}>
        <Image src="/logo-oneclick.png" alt="OneClick" width={130} height={42} style={{objectFit:'contain'}}/>
        <div style={{flex:1}}/>
        <span style={{fontSize:11,color:'var(--muted)'}}>Admin: <span style={{color:'var(--cyan)'}}>{user?.email}</span></span>
        <button onClick={()=>router.push('/')} style={{background:'rgba(0,229,255,.07)',border:'1px solid var(--border)',color:'var(--cyan)',borderRadius:8,padding:'6px 14px',fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>← CRM</button>
        <button onClick={logout} style={{background:'rgba(255,59,95,.08)',border:'1px solid rgba(255,59,95,.2)',color:'var(--red)',borderRadius:8,padding:'6px 14px',fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>Sair</button>
      </header>

      <div style={{maxWidth:700,margin:'32px auto',padding:'0 20px',position:'relative',zIndex:1}}>
        <h1 style={{fontSize:20,fontWeight:700,color:'var(--cyan)',marginBottom:4}}>Gerenciar Atendentes</h1>
        <p style={{fontSize:12,color:'var(--muted)',marginBottom:28}}>Cadastre e gerencie os atendentes que terão acesso ao CRM.</p>

        {/* Form cadastro */}
        <div style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:14,padding:'24px',marginBottom:24}}>
          <h2 style={{fontSize:14,fontWeight:700,color:'var(--text)',marginBottom:18}}>Novo Atendente</h2>
          <form onSubmit={cadastrar} style={{display:'flex',flexDirection:'column',gap:14}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              <div style={{display:'flex',flexDirection:'column',gap:5}}>
                <label style={{fontSize:10,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.08em'}}>Nome completo</label>
                <input value={nome} onChange={e=>setNome(e.target.value)} required placeholder="João Silva"
                  style={{background:'rgba(0,0,0,.3)',border:'1px solid var(--border)',color:'var(--text)',borderRadius:8,padding:'9px 12px',fontSize:12,fontFamily:'inherit',outline:'none'}}/>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:5}}>
                <label style={{fontSize:10,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.08em'}}>Email</label>
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="atendente@email.com"
                  style={{background:'rgba(0,0,0,.3)',border:'1px solid var(--border)',color:'var(--text)',borderRadius:8,padding:'9px 12px',fontSize:12,fontFamily:'inherit',outline:'none'}}/>
              </div>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:5}}>
              <label style={{fontSize:10,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.08em'}}>Senha inicial</label>
              <input type="password" value={senha} onChange={e=>setSenha(e.target.value)} required placeholder="Mínimo 6 caracteres" minLength={6}
                style={{background:'rgba(0,0,0,.3)',border:'1px solid var(--border)',color:'var(--text)',borderRadius:8,padding:'9px 12px',fontSize:12,fontFamily:'inherit',outline:'none'}}/>
            </div>
            {erro && <div style={{background:'rgba(255,59,95,.1)',border:'1px solid rgba(255,59,95,.25)',color:'var(--red)',borderRadius:8,padding:'8px 12px',fontSize:12}}>{erro}</div>}
            {msg && <div style={{background:'rgba(0,255,153,.08)',border:'1px solid rgba(0,255,153,.2)',color:'var(--green)',borderRadius:8,padding:'8px 12px',fontSize:12}}>{msg}</div>}
            <button type="submit" disabled={loading}
              style={{background:'rgba(0,229,255,.12)',border:'1px solid rgba(0,229,255,.3)',color:'var(--cyan)',borderRadius:8,padding:'10px',fontSize:12,fontWeight:700,cursor:loading?'not-allowed':'pointer',fontFamily:'inherit',transition:'.15s'}}>
              {loading ? 'Cadastrando...' : '+ Cadastrar Atendente'}
            </button>
          </form>
        </div>

        {/* Lista atendentes */}
        <div style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:14,padding:'24px'}}>
          <h2 style={{fontSize:14,fontWeight:700,color:'var(--text)',marginBottom:18}}>Atendentes Cadastrados ({atendentes.length})</h2>
          {atendentes.length === 0 ? (
            <p style={{fontSize:12,color:'var(--muted)',fontStyle:'italic'}}>Nenhum atendente cadastrado ainda.</p>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {atendentes.map(a => (
                <div key={a.id} style={{display:'flex',alignItems:'center',gap:12,background:'rgba(0,0,0,.2)',border:'1px solid var(--border)',borderRadius:10,padding:'12px 16px'}}>
                  <div style={{width:36,height:36,borderRadius:'50%',background:'rgba(0,229,255,.1)',border:'1px solid rgba(0,229,255,.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'var(--cyan)',flexShrink:0}}>
                    {a.nome?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{a.nome}</div>
                    <div style={{fontSize:11,color:'var(--muted)'}}>{a.email}</div>
                  </div>
                  <span style={{fontSize:9,color:'var(--muted)',whiteSpace:'nowrap'}}>
                    {new Date(a.criado_em).toLocaleDateString('pt-BR')}
                  </span>
                  <button onClick={()=>remover(a.id, a.nome)}
                    style={{background:'rgba(255,59,95,.08)',border:'1px solid rgba(255,59,95,.2)',color:'var(--red)',borderRadius:6,padding:'5px 10px',fontSize:10,cursor:'pointer',fontFamily:'inherit',flexShrink:0}}>
                    Remover
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
