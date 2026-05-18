'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

type Status = 'novo'|'contato'|'instalado'|'pendente'
interface Lead{id:string;chamado_id:string;empresa:string;cnpj:string;responsavel:string;telefone:string;endereco:string;cidade:string;estado:string;status:Status;origem_email:string;criado_em:string}
interface Chamado{id:string;lead_id:string;descricao:string;tipo:string;usuario:string;criado_em:string}

const SL:Record<Status,string>={novo:'Novo',contato:'Em Contato',instalado:'Instalado',pendente:'Pendente'}
const SC:Record<Status,{bg:string;color:string;border:string}>={
  novo:{bg:'rgba(0,229,255,.12)',color:'#00e5ff',border:'rgba(0,229,255,.3)'},
  contato:{bg:'rgba(255,202,40,.12)',color:'#ffca28',border:'rgba(255,202,40,.3)'},
  instalado:{bg:'rgba(0,230,118,.12)',color:'#00e676',border:'rgba(0,230,118,.3)'},
  pendente:{bg:'rgba(255,82,82,.12)',color:'#ff5252',border:'rgba(255,82,82,.3)'},
}

function waUrl(tel:string,nome:string,empresa:string){
  const c=(tel||'').replace(/\D/g,'');const n=c.startsWith('55')?c:`55${c}`
  return `https://wa.me/${n}?text=${encodeURIComponent(`Olá ${nome}, aqui é a OneClick Soluções! Recebemos a solicitação de instalação do Pedido Eletrônico Stock Farma de ${empresa}. Podemos agendar a instalação?`)}`
}
function fDate(d:string){if(!d)return '-';return new Date(d).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}
function fPhone(t:string){if(!t)return '-';const c=t.replace(/\D/g,'');if(c.length===11)return `(${c.slice(0,2)}) ${c.slice(2,7)}-${c.slice(7)}`;if(c.length===10)return `(${c.slice(0,2)}) ${c.slice(2,6)}-${c.slice(6)}`;return t}

const WA16=<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.287 7.041L.785 23.216a.5.5 0 0 0 .619.619l4.175-1.502A11.948 11.948 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.82 9.82 0 0 1-5.007-1.371l-.359-.214-3.717 1.337 1.337-3.717-.214-.359A9.82 9.82 0 0 1 2.182 12C2.182 6.56 6.56 2.182 12 2.182c5.44 0 9.818 4.378 9.818 9.818 0 5.44-4.378 9.818-9.818 9.818z"/></svg>
const WA22=<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.287 7.041L.785 23.216a.5.5 0 0 0 .619.619l4.175-1.502A11.948 11.948 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.82 9.82 0 0 1-5.007-1.371l-.359-.214-3.717 1.337 1.337-3.717-.214-.359A9.82 9.82 0 0 1 2.182 12C2.182 6.56 6.56 2.182 12 2.182c5.44 0 9.818 4.378 9.818 9.818 0 5.44-4.378 9.818-9.818 9.818z"/></svg>

export default function CRMPage(){
  const router=useRouter()
  const [user,setUser]=useState<{email?:string;user_metadata?:{nome?:string}}|null>(null)
  const [leads,setLeads]=useState<Lead[]>([])
  const [chamados,setChamados]=useState<Chamado[]>([])
  const [loading,setLoading]=useState(true)
  const [filter,setFilter]=useState('todos')
  const [search,setSearch]=useState('')
  const [selected,setSelected]=useState<Lead|null>(null)
  const [nota,setNota]=useState('')
  const [saving,setSaving]=useState(false)
  const [showSearch,setShowSearch]=useState(false)
  const [menuOpen,setMenuOpen]=useState(false)

  useEffect(()=>{
    supabase.auth.getUser().then(({data})=>{
      if(!data.user){router.push('/login');return}
      setUser(data.user)
    })
  },[router])

  const fetchLeads=useCallback(async()=>{
    const{data}=await supabase.from('leads').select('*').order('criado_em',{ascending:false})
    if(data)setLeads(data)
    setLoading(false)
  },[])

  useEffect(()=>{
    if(!user)return
    fetchLeads()
    const ch=supabase.channel('leads-rt')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'leads'},async(payload)=>{
        fetchLeads()
        try{await fetch('/api/notify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({empresa:payload.new.empresa,responsavel:payload.new.responsavel,telefone:payload.new.telefone,chamado_id:payload.new.chamado_id})})}catch(e){console.log(e)}
      })
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'leads'},fetchLeads)
      .subscribe()
    return()=>{supabase.removeChannel(ch)}
  },[user,fetchLeads])

  useEffect(()=>{
    if(!selected)return
    supabase.from('chamados').select('*').eq('lead_id',selected.id).order('criado_em',{ascending:false}).then(({data})=>{if(data)setChamados(data)})
  },[selected])

  async function updateStatus(id:string,status:Status){
    const nu=user?.user_metadata?.nome||user?.email||'Atendente'
    await supabase.from('leads').update({status}).eq('id',id)
    await supabase.from('chamados').insert({lead_id:id,descricao:`Status → "${SL[status]}"`,tipo:'sistema',usuario:nu})
    setSelected(p=>p?{...p,status}:null)
    fetchLeads()
    const{data}=await supabase.from('chamados').select('*').eq('lead_id',id).order('criado_em',{ascending:false})
    if(data)setChamados(data)
  }

  async function addNota(){
    if(!nota.trim()||!selected)return
    setSaving(true)
    const nu=user?.user_metadata?.nome||user?.email||'Atendente'
    await supabase.from('chamados').insert({lead_id:selected.id,descricao:nota.trim(),tipo:'nota',usuario:nu})
    setNota('')
    const{data}=await supabase.from('chamados').select('*').eq('lead_id',selected.id).order('criado_em',{ascending:false})
    if(data)setChamados(data)
    setSaving(false)
  }

  async function logout(){await supabase.auth.signOut();router.push('/login')}

  const filtered=leads.filter(l=>(filter==='todos'||l.status===filter)&&(!search||l.empresa?.toLowerCase().includes(search.toLowerCase())||l.cnpj?.includes(search)||l.responsavel?.toLowerCase().includes(search.toLowerCase())))
  const counts={total:leads.length,novo:leads.filter(l=>l.status==='novo').length,contato:leads.filter(l=>l.status==='contato').length,instalado:leads.filter(l=>l.status==='instalado').length,pendente:leads.filter(l=>l.status==='pendente').length}
  const nomeUser=user?.user_metadata?.nome||user?.email?.split('@')[0]||'Atendente'
  const isAdmin=user?.email==='ronie@oneclicksolucoes.com.br'

  if(!user)return<div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{width:32,height:32,border:'3px solid rgba(0,229,255,.15)',borderTop:'3px solid #00e5ff',borderRadius:'50%',animation:'spin .8s linear infinite'}}/></div>

  return(
    <div style={{minHeight:'100vh',width:'100%',maxWidth:'100vw',overflowX:'hidden',display:'flex',flexDirection:'column'}}>

      {/* HEADER */}
      <header style={{position:'sticky',top:0,zIndex:100,background:'rgba(10,31,58,.98)',backdropFilter:'blur(20px)',WebkitBackdropFilter:'blur(20px)',borderBottom:'1px solid var(--border2)'}}>

        {/* Row 1: logos + controls */}
        <div style={{display:'flex',alignItems:'center',padding:'10px 14px',gap:8,width:'100%'}}>

          {/* OneClick logo - bigger */}
          <div style={{flexShrink:0,display:'flex',alignItems:'center'}}>
            <Image src="/logo-oneclick.png" alt="OneClick" width={130} height={42} style={{objectFit:'contain',filter:'brightness(1.1)'}}/>
          </div>

          <div style={{flex:1}}/>

          {/* Live + badge */}
          <div style={{display:'flex',alignItems:'center',gap:4,background:'rgba(0,230,118,.1)',border:'1px solid rgba(0,230,118,.25)',borderRadius:20,padding:'4px 9px',flexShrink:0}}>
            <div style={{width:6,height:6,borderRadius:'50%',background:'#00e676',animation:'pulse 2s infinite'}}/>
            <span style={{fontSize:10,color:'#00e676',fontWeight:700,letterSpacing:'.04em'}}>VIVO</span>
          </div>

          {counts.novo>0&&<div style={{background:'#ff5252',color:'#fff',borderRadius:20,fontSize:10,padding:'3px 8px',fontWeight:800,flexShrink:0}}>{counts.novo}</div>}

          {/* Search */}
          <button onClick={()=>setShowSearch(p=>!p)} aria-label="Buscar" style={{background:'rgba(0,229,255,.08)',border:'1px solid var(--border)',color:'var(--cyan)',borderRadius:8,width:34,height:34,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          </button>

          {/* User menu */}
          <button onClick={()=>setMenuOpen(p=>!p)} style={{background:'rgba(0,229,255,.12)',border:'1px solid var(--border)',color:'var(--cyan)',borderRadius:8,width:34,height:34,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontWeight:800,fontSize:14,flexShrink:0}}>
            {nomeUser.charAt(0).toUpperCase()}
          </button>
        </div>

        {/* Row 2: Stock Farma + AI tag */}
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'0 14px 10px',borderTop:'1px solid var(--border2)'}}>
          <div style={{background:'#fff',borderRadius:8,padding:'4px 12px',height:36,display:'flex',alignItems:'center',flexShrink:0}}>
            <Image src="/logo-stockfarma.png" alt="Stock Farma" width={100} height={28} style={{objectFit:'contain'}}/>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:6,flex:1,minWidth:0}}>
            <span style={{fontSize:11,color:'#00e5ff',fontWeight:700,flexShrink:0}}>⚡ IA</span>
            <span style={{fontSize:10,color:'var(--muted)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>lendo emails automaticamente</span>
          </div>
          <span style={{background:'rgba(0,229,255,.12)',border:'1px solid rgba(0,229,255,.25)',color:'var(--cyan)',borderRadius:10,fontSize:8,padding:'2px 7px',fontWeight:800,letterSpacing:'.06em',flexShrink:0}}>AUTO</span>
        </div>

        {/* Search bar */}
        {showSearch&&(
          <div style={{padding:'0 14px 10px'}}>
            <input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar empresa, CNPJ ou responsável..."
              style={{width:'100%',background:'rgba(255,255,255,.06)',border:'1px solid rgba(0,229,255,.3)',color:'var(--text)',borderRadius:10,padding:'10px 14px',fontSize:14,fontFamily:'inherit',outline:'none'}}/>
          </div>
        )}

        {/* Filter tabs */}
        <div style={{display:'flex',gap:6,padding:'0 14px 10px',overflowX:'auto',WebkitOverflowScrolling:'touch',scrollbarWidth:'none'}}>
          {([
            {k:'todos',l:'Todos',n:counts.total,c:'var(--cyan)'},
            {k:'novo',l:'Novos',n:counts.novo,c:'var(--cyan)'},
            {k:'contato',l:'Contato',n:counts.contato,c:'var(--yellow)'},
            {k:'instalado',l:'Instalado',n:counts.instalado,c:'var(--green)'},
            {k:'pendente',l:'Pendente',n:counts.pendente,c:'var(--red)'},
          ] as const).map(f=>(
            <button key={f.k} onClick={()=>setFilter(f.k)}
              style={{flexShrink:0,padding:'6px 14px',borderRadius:20,fontSize:12,fontWeight:filter===f.k?700:400,cursor:'pointer',fontFamily:'inherit',transition:'all .15s',border:filter===f.k?`1px solid ${f.c}`:'1px solid rgba(255,255,255,.1)',background:filter===f.k?`${f.c}20`:'rgba(255,255,255,.04)',color:filter===f.k?f.c:'var(--muted)',whiteSpace:'nowrap'}}>
              {f.l}{f.n>0?` (${f.n})`:''}
            </button>
          ))}
        </div>
      </header>

      {/* DROPDOWN MENU */}
      {menuOpen&&<>
        <div onClick={()=>setMenuOpen(false)} style={{position:'fixed',inset:0,zIndex:190}}/>
        <div style={{position:'fixed',top:70,right:14,zIndex:200,background:'#102a4a',border:'1px solid var(--border)',borderRadius:14,padding:10,minWidth:200,boxShadow:'0 12px 40px rgba(0,0,0,.6)'}}>
          <div style={{padding:'8px 12px 12px',borderBottom:'1px solid var(--border2)',marginBottom:8}}>
            <div style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>{nomeUser}</div>
            <div style={{fontSize:11,color:'var(--muted)',marginTop:2}}>{user?.email}</div>
          </div>
          {isAdmin&&<button onClick={()=>{router.push('/admin');setMenuOpen(false)}} style={{width:'100%',background:'none',border:'none',color:'var(--cyan)',fontSize:13,padding:'9px 12px',textAlign:'left',cursor:'pointer',fontFamily:'inherit',borderRadius:8,display:'flex',alignItems:'center',gap:8}}>
            <span>⚙️</span> Gerenciar Atendentes
          </button>}
          <button onClick={()=>{logout();setMenuOpen(false)}} style={{width:'100%',background:'none',border:'none',color:'var(--red)',fontSize:13,padding:'9px 12px',textAlign:'left',cursor:'pointer',fontFamily:'inherit',borderRadius:8,display:'flex',alignItems:'center',gap:8}}>
            <span>🚪</span> Sair
          </button>
        </div>
      </>}

      {/* STATS */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,padding:'12px 14px 4px'}}>
        {[
          {l:'Total',v:counts.total,c:'#00e5ff'},
          {l:'Contato',v:counts.contato,c:'#ffca28'},
          {l:'Instal.',v:counts.instalado,c:'#00e676'},
          {l:'Pend.',v:counts.pendente,c:'#ff5252'},
        ].map(s=>(
          <div key={s.l} style={{background:'var(--card)',border:'1px solid var(--border2)',borderRadius:10,padding:'10px 6px',textAlign:'center',position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',top:0,left:0,right:0,height:2,background:s.c,borderRadius:'2px 2px 0 0'}}/>
            <div style={{fontSize:24,fontWeight:800,color:s.c,lineHeight:1,fontVariantNumeric:'tabular-nums'}}>{s.v}</div>
            <div style={{fontSize:9,color:'var(--muted)',marginTop:3,textTransform:'uppercase',letterSpacing:'.04em'}}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* LEADS CARDS */}
      <div style={{flex:1,padding:'10px 14px 24px',display:'flex',flexDirection:'column',gap:10}}>
        {loading?(
          <div style={{padding:48,textAlign:'center'}}>
            <div style={{width:36,height:36,border:'3px solid rgba(0,229,255,.15)',borderTop:'3px solid #00e5ff',borderRadius:'50%',animation:'spin .8s linear infinite',margin:'0 auto 14px'}}/>
            <span style={{fontSize:13,color:'var(--muted)'}}>Carregando leads...</span>
          </div>
        ):filtered.length===0?(
          <div style={{padding:48,textAlign:'center',color:'var(--muted)',fontSize:14}}>Nenhum lead encontrado.</div>
        ):filtered.map((l,i)=>{
          const s=SC[l.status]
          return(
            <div key={l.id} onClick={()=>setSelected(l)}
              style={{background:'var(--card)',border:`1px solid ${selected?.id===l.id?'var(--cyan)':'var(--border2)'}`,borderLeft:`4px solid ${s.color}`,borderRadius:12,padding:'14px 14px 12px',cursor:'pointer',animation:`fadeUp .25s ease ${Math.min(i,8)*0.04}s both`,WebkitTapHighlightColor:'transparent'}}>

              {/* Top: chamado + status */}
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                <span style={{background:'rgba(26,93,171,.2)',border:'1px solid rgba(100,160,245,.3)',color:'#7ab5f5',borderRadius:4,fontSize:8,padding:'2px 6px',fontWeight:800,letterSpacing:'.06em',flexShrink:0}}>PE</span>
                <span style={{fontSize:13,color:'#00e5ff',fontWeight:800,flexShrink:0}}>{l.chamado_id||l.id.slice(0,8)}</span>
                <div style={{flex:1}}/>
                <span style={{background:s.bg,color:s.color,border:`1px solid ${s.border}`,borderRadius:20,fontSize:10,padding:'3px 10px',fontWeight:700,flexShrink:0}}>{SL[l.status]}</span>
              </div>

              {/* Company */}
              <div style={{fontSize:15,fontWeight:700,color:'var(--text)',marginBottom:2,lineHeight:1.3}}>{l.empresa}</div>
              <div style={{fontSize:11,color:'var(--muted)',marginBottom:10}}>{l.cnpj}</div>

              {/* Bottom: responsavel + data + WA */}
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,color:'var(--text2)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.responsavel}</div>
                  <div style={{fontSize:10,color:'var(--muted)',marginTop:1}}>{fDate(l.criado_em)}</div>
                </div>
                <a href={waUrl(l.telefone,l.responsavel,l.empresa)} target="_blank" rel="noreferrer"
                  onClick={e=>e.stopPropagation()}
                  style={{display:'flex',alignItems:'center',gap:5,background:'rgba(0,230,118,.12)',border:'1px solid rgba(0,230,118,.3)',color:'#00e676',borderRadius:10,padding:'7px 12px',fontSize:12,fontWeight:700,textDecoration:'none',flexShrink:0}}>
                  {WA16} WA
                </a>
              </div>
            </div>
          )
        })}
      </div>

      {/* DETAIL — slide up full screen */}
      {selected&&(
        <div style={{position:'fixed',inset:0,zIndex:300,background:'linear-gradient(180deg,#0e2642,#091829)',overflowY:'auto',WebkitOverflowScrolling:'touch',animation:'slideUp .3s ease'}}>

          {/* Detail header */}
          <div style={{position:'sticky',top:0,background:'rgba(10,27,48,.98)',backdropFilter:'blur(20px)',WebkitBackdropFilter:'blur(20px)',borderBottom:'1px solid var(--border2)',padding:'12px 14px',display:'flex',alignItems:'center',gap:10,zIndex:10}}>
            <button onClick={()=>setSelected(null)} style={{background:'rgba(0,229,255,.1)',border:'1px solid var(--border)',color:'var(--cyan)',borderRadius:8,padding:'7px 14px',fontSize:14,cursor:'pointer',fontFamily:'inherit',fontWeight:700,flexShrink:0}}>← Voltar</button>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:700,color:'var(--cyan)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{selected.empresa}</div>
              <div style={{fontSize:10,color:'var(--muted)'}}>{selected.chamado_id}</div>
            </div>
            <span style={{background:SC[selected.status].bg,color:SC[selected.status].color,border:`1px solid ${SC[selected.status].border}`,borderRadius:20,fontSize:10,padding:'3px 10px',fontWeight:700,flexShrink:0}}>{SL[selected.status]}</span>
          </div>

          <div style={{padding:'16px 14px',display:'flex',flexDirection:'column',gap:12}}>

            {/* Info */}
            <div style={{background:'rgba(255,255,255,.04)',border:'1px solid var(--border2)',borderRadius:14,padding:16,display:'flex',flexDirection:'column',gap:12}}>
              {[
                {l:'Responsável',v:selected.responsavel},
                {l:'Telefone',v:fPhone(selected.telefone)},
                {l:'CNPJ',v:selected.cnpj},
                {l:'Endereço',v:selected.endereco},
                {l:'Cidade / Estado',v:`${selected.cidade||''}${selected.estado?` / ${selected.estado}`:''}`},
                {l:'Recebido em',v:fDate(selected.criado_em)},
              ].map(r=>(
                <div key={r.l}>
                  <div style={{fontSize:9,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:3}}>{r.l}</div>
                  <div style={{fontSize:14,color:'var(--text)',lineHeight:1.4}}>{r.v||'—'}</div>
                </div>
              ))}
            </div>

            {/* WhatsApp */}
            <a href={waUrl(selected.telefone,selected.responsavel,selected.empresa)} target="_blank" rel="noreferrer"
              style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10,background:'rgba(0,230,118,.12)',border:'1px solid rgba(0,230,118,.3)',color:'#00e676',borderRadius:14,padding:'15px',fontSize:16,fontWeight:800,textDecoration:'none'}}>
              {WA22} Abrir WhatsApp
            </a>

            {/* Status */}
            <div style={{background:'rgba(255,255,255,.04)',border:'1px solid var(--border2)',borderRadius:14,padding:16}}>
              <div style={{fontSize:10,color:'var(--cyan)',fontWeight:800,letterSpacing:'.08em',textTransform:'uppercase',marginBottom:12}}>Atualizar Status</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {(['novo','contato','instalado','pendente'] as Status[]).map(s=>{
                  const sc=SC[s];const active=selected.status===s
                  return(
                    <button key={s} onClick={()=>updateStatus(selected.id,s)}
                      style={{padding:'12px 8px',borderRadius:10,fontSize:13,fontWeight:active?800:500,cursor:'pointer',fontFamily:'inherit',transition:'all .15s',border:`1px solid ${active?sc.color:sc.border}`,background:active?sc.bg:'rgba(0,0,0,.2)',color:sc.color}}>
                      {SL[s]}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Nota */}
            <div style={{background:'rgba(255,255,255,.04)',border:'1px solid var(--border2)',borderRadius:14,padding:16}}>
              <div style={{fontSize:10,color:'var(--cyan)',fontWeight:800,letterSpacing:'.08em',textTransform:'uppercase',marginBottom:12}}>Adicionar Nota</div>
              <textarea value={nota} onChange={e=>setNota(e.target.value)} placeholder="Digite uma anotação sobre este cliente..." rows={3}
                style={{width:'100%',background:'rgba(0,0,0,.3)',border:'1px solid var(--border)',color:'var(--text)',borderRadius:10,padding:'11px 13px',fontSize:14,fontFamily:'inherit',resize:'none',outline:'none',marginBottom:10}}/>
              <button onClick={addNota} disabled={saving}
                style={{width:'100%',background:'rgba(0,229,255,.1)',border:'1px solid rgba(0,229,255,.3)',color:'var(--cyan)',borderRadius:10,padding:'12px',fontSize:14,fontWeight:700,cursor:saving?'not-allowed':'pointer',fontFamily:'inherit'}}>
                {saving?'Salvando...':'+ Registrar Nota'}
              </button>
            </div>

            {/* Histórico */}
            <div style={{background:'rgba(255,255,255,.04)',border:'1px solid var(--border2)',borderRadius:14,padding:16}}>
              <div style={{fontSize:10,color:'var(--cyan)',fontWeight:800,letterSpacing:'.08em',textTransform:'uppercase',marginBottom:14}}>Histórico</div>
              {chamados.length===0?<span style={{fontSize:13,color:'var(--muted)',fontStyle:'italic'}}>Nenhum registro ainda.</span>:chamados.map((c,i)=>(
                <div key={c.id} style={{display:'flex',gap:10,marginBottom:i<chamados.length-1?14:0}}>
                  <div style={{width:8,height:8,borderRadius:'50%',background:i===0?'var(--cyan)':'var(--green)',flexShrink:0,marginTop:5}}/>
                  <div>
                    <div style={{fontSize:13,color:'var(--text)',lineHeight:1.4,marginBottom:3}}>{c.descricao}</div>
                    <div style={{fontSize:11,color:'var(--muted)'}}>{fDate(c.criado_em)} · {c.usuario}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{height:20}}/>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10,padding:'10px 14px',borderTop:'1px solid var(--border2)',background:'rgba(0,0,0,.3)',flexWrap:'wrap'}}>
        <span style={{fontSize:9,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.06em'}}>Desenvolvido por</span>
        <span style={{fontSize:10,fontWeight:700,color:'var(--cyan)'}}>OneClick Soluções</span>
        <span style={{fontSize:10,color:'var(--muted)'}}>×</span>
        <div style={{background:'#fff',borderRadius:5,padding:'2px 8px',height:22,display:'flex',alignItems:'center'}}>
          <Image src="/logo-stockfarma.png" alt="Stock Farma" width={60} height={16} style={{objectFit:'contain'}}/>
        </div>
      </footer>
    </div>
  )
}
