'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

type Status = 'novo'|'contato'|'instalado'|'pendente'
interface Lead{id:string;chamado_id:string;empresa:string;cnpj:string;responsavel:string;telefone:string;celular:string;endereco:string;cidade:string;estado:string;cep:string;nome_fantasia:string;regime_tributario:string;email_cliente:string;status:Status;criado_em:string}
interface Chamado{id:string;lead_id:string;descricao:string;tipo:string;usuario:string;criado_em:string}

const SL:Record<Status,string>={novo:'Novo',contato:'Em Contato',instalado:'Instalado',pendente:'Pendente'}
const COLORS:Record<Status,string>={novo:'#00e5ff',contato:'#ffca28',instalado:'#00e676',pendente:'#ff5252'}
const BGCOLORS:Record<Status,string>={novo:'rgba(0,229,255,.12)',contato:'rgba(255,202,40,.12)',instalado:'rgba(0,230,118,.12)',pendente:'rgba(255,82,82,.12)'}

function waUrl(tel:string,nome:string,empresa:string){
  const c=(tel||'').replace(/\D/g,'');const n=c.startsWith('55')?c:`55${c}`
  return `https://wa.me/${n}?text=${encodeURIComponent(`Olá ${nome}, aqui é a OneClick Soluções! Recebemos a solicitação de instalação do Pedido Eletrônico Stock Farma de ${empresa}. Podemos agendar a instalação?`)}`
}
const fDate=(d:string)=>{if(!d)return '-';return new Date(d).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}
const fPhone=(t:string)=>{if(!t)return '';const c=t.replace(/\D/g,'');if(c.length===11)return `(${c.slice(0,2)}) ${c.slice(2,7)}-${c.slice(7)}`;if(c.length===10)return `(${c.slice(0,2)}) ${c.slice(2,6)}-${c.slice(6)}`;return t}

// Icons
const IconMenu=()=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
const IconWA=({size=14}:{size?:number})=><svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.287 7.041L.785 23.216a.5.5 0 0 0 .619.619l4.175-1.502A11.948 11.948 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.82 9.82 0 0 1-5.007-1.371l-.359-.214-3.717 1.337 1.337-3.717-.214-.359A9.82 9.82 0 0 1 2.182 12C2.182 6.56 6.56 2.182 12 2.182c5.44 0 9.818 4.378 9.818 9.818 0 5.44-4.378 9.818-9.818 9.818z"/></svg>
const IconSearch=()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
const IconClose=()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
const IconBack=()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
const IconAdmin=()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
const IconLogout=()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
const IconBot=()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M12 2v3M8 11V7a4 4 0 018 0v4M8 15h0M16 15h0"/></svg>

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
  const [drawerOpen,setDrawerOpen]=useState(false)
  const [searchOpen,setSearchOpen]=useState(false)

  useEffect(()=>{
    supabase.auth.getUser().then(({data})=>{
      if(!data.user){router.push('/login');return}
      setUser(data.user)
    })
  },[router])

  const fetchLeads=useCallback(async()=>{
    const{data}=await supabase.from('leads').select('*').order('criado_em',{ascending:false})
    if(data)setLeads(data as Lead[])
    setLoading(false)
  },[])

  useEffect(()=>{
    if(!user)return
    fetchLeads()
    const ch=supabase.channel('leads-rt')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'leads'},async(p)=>{
        fetchLeads()
        try{await fetch('/api/notify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({empresa:p.new.empresa,responsavel:p.new.responsavel,telefone:p.new.telefone||p.new.celular,chamado_id:p.new.chamado_id})})}catch(e){console.log(e)}
      })
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'leads'},fetchLeads)
      .subscribe()
    return()=>{supabase.removeChannel(ch)}
  },[user,fetchLeads])

  useEffect(()=>{
    if(!selected)return
    supabase.from('chamados').select('*').eq('lead_id',selected.id).order('criado_em',{ascending:false}).then(({data})=>{if(data)setChamados(data)})
  },[selected])

  const updateStatus=async(id:string,status:Status)=>{
    const nu=user?.user_metadata?.nome||user?.email||'Atendente'
    await supabase.from('leads').update({status}).eq('id',id)
    await supabase.from('chamados').insert({lead_id:id,descricao:`Status → "${SL[status]}"`,tipo:'sistema',usuario:nu})
    setSelected(p=>p?{...p,status}:null)
    fetchLeads()
    const{data}=await supabase.from('chamados').select('*').eq('lead_id',id).order('criado_em',{ascending:false})
    if(data)setChamados(data)
  }

  const addNota=async()=>{
    if(!nota.trim()||!selected)return
    setSaving(true)
    const nu=user?.user_metadata?.nome||user?.email||'Atendente'
    await supabase.from('chamados').insert({lead_id:selected.id,descricao:nota.trim(),tipo:'nota',usuario:nu})
    setNota('')
    const{data}=await supabase.from('chamados').select('*').eq('lead_id',selected.id).order('criado_em',{ascending:false})
    if(data)setChamados(data)
    setSaving(false)
  }

  const logout=async()=>{await supabase.auth.signOut();router.push('/login')}

  const filtered=leads.filter(l=>(filter==='todos'||l.status===filter)&&(!search||l.empresa?.toLowerCase().includes(search.toLowerCase())||l.cnpj?.includes(search)||l.responsavel?.toLowerCase().includes(search.toLowerCase())||l.nome_fantasia?.toLowerCase().includes(search.toLowerCase())))
  const counts={total:leads.length,novo:leads.filter(l=>l.status==='novo').length,contato:leads.filter(l=>l.status==='contato').length,instalado:leads.filter(l=>l.status==='instalado').length,pendente:leads.filter(l=>l.status==='pendente').length}
  const nomeUser=user?.user_metadata?.nome||user?.email?.split('@')[0]||'Atendente'
  const isAdmin=user?.email==='ronie@oneclicksolucoes.com.br'
  const telPrincipal=(l:Lead)=>l.celular||l.telefone||''

  if(!user)return<div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--bg)'}}><div style={{width:32,height:32,border:'3px solid rgba(0,229,255,.15)',borderTop:'3px solid #00e5ff',borderRadius:'50%',animation:'spin .8s linear infinite'}}/></div>

  return(
    <div style={{minHeight:'100vh',width:'100%',maxWidth:'100vw',overflowX:'hidden',display:'flex',flexDirection:'column',background:'var(--bg)'}}>

      {/* ===== DRAWER MENU ===== */}
      {drawerOpen&&<div onClick={()=>setDrawerOpen(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',zIndex:200,animation:'fadeIn .2s ease'}}/>}
      <div style={{position:'fixed',top:0,left:0,bottom:0,width:280,background:'var(--drawer)',borderRight:'1px solid var(--border)',zIndex:201,transform:drawerOpen?'translateX(0)':'translateX(-100%)',transition:'transform .28s cubic-bezier(.4,0,.2,1)',display:'flex',flexDirection:'column'}}>

        {/* Drawer header — user info */}
        <div style={{background:'linear-gradient(135deg,#0d2137,#163354)',padding:'20px 18px 18px',borderBottom:'1px solid var(--bord2)'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
            <Image src="/logo-oneclick.png" alt="OneClick" width={120} height={38} style={{objectFit:'contain',filter:'brightness(1.1)'}}/>
            <button onClick={()=>setDrawerOpen(false)} style={{background:'rgba(255,255,255,.08)',border:'none',color:'var(--text2)',borderRadius:8,width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}><IconClose/></button>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div style={{width:44,height:44,borderRadius:'50%',background:'linear-gradient(135deg,var(--cyan2),var(--purple))',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:800,color:'#fff',flexShrink:0}}>
              {nomeUser.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{fontSize:14,fontWeight:700,color:'var(--text)'}}>{nomeUser}</div>
              <div style={{fontSize:10,color:'var(--muted)',marginTop:2}}>{user?.email}</div>
              {isAdmin&&<div style={{fontSize:9,color:'var(--cyan)',marginTop:3,letterSpacing:'.06em',textTransform:'uppercase',fontWeight:700}}>⭐ Administrador</div>}
            </div>
          </div>
        </div>

        {/* Stock Farma parceria */}
        <div style={{padding:'14px 18px',borderBottom:'1px solid var(--bord2)',display:'flex',alignItems:'center',gap:12}}>
          <div style={{background:'#fff',borderRadius:8,padding:'4px 10px',height:34,display:'flex',alignItems:'center',flexShrink:0}}>
            <Image src="/logo-stockfarma.png" alt="Stock Farma" width={90} height={26} style={{objectFit:'contain'}}/>
          </div>
          <div>
            <div style={{fontSize:9,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.08em'}}>Canal Parceiro</div>
            <div style={{fontSize:11,color:'var(--text2)',fontWeight:600}}>Portal de Instalações</div>
          </div>
        </div>

        {/* Status IA */}
        <div style={{padding:'12px 18px',borderBottom:'1px solid var(--bord2)',display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:8,height:8,borderRadius:'50%',background:'#00e676',animation:'pulse2 2s infinite',flexShrink:0}}/>
          <div>
            <div style={{fontSize:11,color:'#00e676',fontWeight:700}}>IA Ativa — Monitorando</div>
            <div style={{fontSize:9,color:'var(--muted)'}}>pedidosstockfarmasp@gmail.com</div>
          </div>
        </div>

        {/* Nav items */}
        <div style={{flex:1,padding:'8px 10px',display:'flex',flexDirection:'column',gap:2}}>
          {[
            {icon:'🏠',label:'Dashboard',action:()=>setDrawerOpen(false),active:true},
            ...(isAdmin?[{icon:'⚙️',label:'Gerenciar Atendentes',action:()=>{router.push('/admin');setDrawerOpen(false)},active:false}]:[]),
          ].map((item,i)=>(
            <button key={i} onClick={item.action}
              style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',borderRadius:10,border:'none',background:item.active?'rgba(0,229,255,.1)':'none',color:item.active?'var(--cyan)':'var(--text2)',cursor:'pointer',fontFamily:'inherit',fontSize:14,fontWeight:item.active?600:400,textAlign:'left',width:'100%',transition:'.15s'}}>
              <span style={{fontSize:18,lineHeight:1}}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>

        {/* Logout */}
        <div style={{padding:'10px',borderTop:'1px solid var(--bord2)'}}>
          <button onClick={logout}
            style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',borderRadius:10,border:'1px solid rgba(255,82,82,.2)',background:'rgba(255,82,82,.06)',color:'#ff5252',cursor:'pointer',fontFamily:'inherit',fontSize:14,fontWeight:600,width:'100%',transition:'.15s'}}>
            <IconLogout/> Sair do Sistema
          </button>
        </div>
      </div>

      {/* ===== HEADER ===== */}
      <header style={{position:'sticky',top:0,zIndex:100,background:'rgba(10,25,41,.98)',backdropFilter:'blur(20px)',WebkitBackdropFilter:'blur(20px)',borderBottom:'1px solid var(--bord2)'}}>
        <div style={{display:'flex',alignItems:'center',padding:'10px 14px',gap:10}}>

          {/* Menu button */}
          <button onClick={()=>setDrawerOpen(true)} style={{background:'rgba(255,255,255,.06)',border:'1px solid var(--bord2)',color:'var(--text2)',borderRadius:9,width:38,height:38,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}>
            <IconMenu/>
          </button>

          {/* Logo OneClick — maior */}
          <Image src="/logo-oneclick.png" alt="OneClick" width={140} height={44} style={{objectFit:'contain',filter:'brightness(1.15)',flexShrink:0}}/>

          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:11,color:'var(--cyan)',fontWeight:700,letterSpacing:'.04em'}}>Pedido Eletrônico</div>
            <div style={{display:'flex',alignItems:'center',gap:5,marginTop:1}}>
              <div style={{width:6,height:6,borderRadius:'50%',background:'#00e676',animation:'pulse2 2s infinite',flexShrink:0}}/>
              <span style={{fontSize:9,color:'#00e676',fontWeight:700,letterSpacing:'.06em'}}>IA AUTO</span>
              <IconBot/>
            </div>
          </div>

          {/* Novos badge */}
          {counts.novo>0&&<div style={{background:'var(--red)',color:'#fff',borderRadius:20,fontSize:11,padding:'3px 10px',fontWeight:800,flexShrink:0,minWidth:28,textAlign:'center'}}>{counts.novo}</div>}

          {/* Search button */}
          <button onClick={()=>setSearchOpen(p=>!p)} style={{background:searchOpen?'rgba(0,229,255,.12)':'rgba(255,255,255,.06)',border:`1px solid ${searchOpen?'var(--border)':'var(--bord2)'}`,color:searchOpen?'var(--cyan)':'var(--text2)',borderRadius:9,width:38,height:38,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}>
            <IconSearch/>
          </button>
        </div>

        {/* Search bar expandível */}
        {searchOpen&&(
          <div style={{padding:'0 14px 10px',animation:'fadeIn .15s ease'}}>
            <div style={{position:'relative'}}>
              <div style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'var(--muted)',pointerEvents:'none'}}><IconSearch/></div>
              <input autoFocus value={search} onChange={e=>setSearch(e.target.value)}
                placeholder="Buscar empresa, CNPJ, responsável..."
                style={{width:'100%',background:'rgba(255,255,255,.05)',border:'1px solid var(--border)',color:'var(--text)',borderRadius:10,padding:'10px 14px 10px 38px',fontSize:14,fontFamily:'inherit',outline:'none'}}/>
              {search&&<button onClick={()=>setSearch('')} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:'var(--muted)',cursor:'pointer',display:'flex'}}><IconClose/></button>}
            </div>
          </div>
        )}

        {/* Filter pills */}
        <div style={{display:'flex',gap:6,padding:'0 14px 10px',overflowX:'auto',WebkitOverflowScrolling:'touch',msOverflowStyle:'none',scrollbarWidth:'none'}}>
          {([
            {k:'todos',l:'Todos',n:counts.total},
            {k:'novo',l:'Novos',n:counts.novo},
            {k:'contato',l:'Contato',n:counts.contato},
            {k:'instalado',l:'Instalado',n:counts.instalado},
            {k:'pendente',l:'Pendente',n:counts.pendente},
          ]).map(f=>(
            <button key={f.k} onClick={()=>setFilter(f.k)}
              style={{flexShrink:0,padding:'6px 14px',borderRadius:20,fontSize:12,fontWeight:filter===f.k?700:400,cursor:'pointer',fontFamily:'inherit',transition:'all .15s',whiteSpace:'nowrap',border:filter===f.k?'1px solid var(--cyan)':'1px solid rgba(255,255,255,.1)',background:filter===f.k?'rgba(0,229,255,.12)':'rgba(255,255,255,.04)',color:filter===f.k?'var(--cyan)':'var(--muted)'}}>
              {f.l}{f.n>0?` (${f.n})`:''}
            </button>
          ))}
        </div>
      </header>

      {/* ===== STATS ===== */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,padding:'12px 14px 4px'}}>
        {[
          {l:'Total',v:counts.total,c:'#00e5ff'},
          {l:'Contato',v:counts.contato,c:'#ffca28'},
          {l:'Instal.',v:counts.instalado,c:'#00e676'},
          {l:'Pend.',v:counts.pendente,c:'#ff5252'},
        ].map(s=>(
          <div key={s.l} style={{background:'var(--card)',border:'1px solid var(--bord2)',borderRadius:12,padding:'10px 6px',textAlign:'center',position:'relative',overflow:'hidden',cursor:'pointer'}} onClick={()=>setFilter(s.l==='Total'?'todos':s.l==='Contato'?'contato':s.l==='Instal.'?'instalado':'pendente')}>
            <div style={{position:'absolute',top:0,left:0,right:0,height:2,background:s.c,borderRadius:'2px 2px 0 0'}}/>
            <div style={{fontSize:26,fontWeight:800,color:s.c,lineHeight:1,fontVariantNumeric:'tabular-nums'}}>{s.v}</div>
            <div style={{fontSize:9,color:'var(--muted)',marginTop:3,textTransform:'uppercase',letterSpacing:'.04em'}}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* ===== LEADS CARDS ===== */}
      <div style={{flex:1,padding:'10px 14px 90px',display:'flex',flexDirection:'column',gap:10}}>
        {loading?(
          <div style={{padding:48,textAlign:'center'}}>
            <div style={{width:36,height:36,border:'3px solid rgba(0,229,255,.1)',borderTop:'3px solid #00e5ff',borderRadius:'50%',animation:'spin .8s linear infinite',margin:'0 auto 14px'}}/>
            <div style={{fontSize:13,color:'var(--muted)'}}>Carregando leads...</div>
          </div>
        ):filtered.length===0?(
          <div style={{padding:48,textAlign:'center'}}>
            <div style={{fontSize:32,marginBottom:12}}>🔍</div>
            <div style={{fontSize:14,color:'var(--muted)'}}>Nenhum lead encontrado</div>
          </div>
        ):filtered.map((l,i)=>(
          <div key={l.id} onClick={()=>setSelected(l)}
            style={{background:'var(--card)',border:`1px solid ${selected?.id===l.id?'rgba(0,229,255,.4)':'var(--bord2)'}`,borderLeft:`4px solid ${COLORS[l.status]}`,borderRadius:14,padding:'14px',cursor:'pointer',animation:`fadeUp .22s ease ${Math.min(i,10)*0.035}s both`,transition:'border-color .15s'}}>

            <div style={{display:'flex',alignItems:'flex-start',gap:10,marginBottom:8}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:15,fontWeight:800,color:'var(--text)',lineHeight:1.3,marginBottom:3}}>{l.empresa}</div>
                {l.nome_fantasia&&l.nome_fantasia!==l.empresa&&<div style={{fontSize:11,color:'var(--cyan)',marginBottom:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>✦ {l.nome_fantasia}</div>}
                <div style={{fontSize:11,color:'var(--muted)'}}>{l.cnpj}</div>
              </div>
              <span style={{background:BGCOLORS[l.status],color:COLORS[l.status],border:`1px solid ${COLORS[l.status]}33`,borderRadius:20,fontSize:10,padding:'3px 10px',fontWeight:700,flexShrink:0,whiteSpace:'nowrap'}}>{SL[l.status]}</span>
            </div>

            <div style={{display:'flex',alignItems:'center',gap:8,borderTop:'1px solid var(--bord2)',paddingTop:10}}>
              <span style={{background:'rgba(26,93,171,.2)',border:'1px solid rgba(100,160,245,.25)',color:'#7ab5f5',borderRadius:4,fontSize:8,padding:'2px 6px',fontWeight:800,letterSpacing:'.06em',flexShrink:0}}>PE</span>
              <span style={{fontSize:11,color:'var(--cyan)',fontWeight:700,flexShrink:0}}>{l.chamado_id||l.id.slice(0,8)}</span>
              <span style={{fontSize:11,color:'var(--text2)',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.responsavel}</span>
              <span style={{fontSize:10,color:'var(--muted)',flexShrink:0,whiteSpace:'nowrap'}}>{fDate(l.criado_em)}</span>
              <a href={waUrl(telPrincipal(l),l.responsavel,l.empresa)} target="_blank" rel="noreferrer"
                onClick={e=>e.stopPropagation()}
                style={{display:'flex',alignItems:'center',gap:4,background:'rgba(0,230,118,.12)',border:'1px solid rgba(0,230,118,.3)',color:'#00e676',borderRadius:9,padding:'6px 10px',fontSize:11,fontWeight:700,textDecoration:'none',flexShrink:0}}>
                <IconWA size={13}/> WA
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* ===== DETAIL PANEL — slide up ===== */}
      {selected&&(
        <div style={{position:'fixed',inset:0,zIndex:300,background:'linear-gradient(180deg,#0e2642 0%,#091829 100%)',overflowY:'auto',WebkitOverflowScrolling:'touch',animation:'slideUp .3s cubic-bezier(.4,0,.2,1)'}}>

          <div style={{position:'sticky',top:0,background:'rgba(10,27,48,.98)',backdropFilter:'blur(20px)',WebkitBackdropFilter:'blur(20px)',borderBottom:'1px solid var(--bord2)',padding:'12px 14px',display:'flex',alignItems:'center',gap:10,zIndex:10}}>
            <button onClick={()=>setSelected(null)} style={{background:'rgba(0,229,255,.08)',border:'1px solid var(--border)',color:'var(--cyan)',borderRadius:9,width:38,height:38,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}>
              <IconBack/>
            </button>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:800,color:'var(--cyan)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{selected.empresa}</div>
              <div style={{fontSize:10,color:'var(--muted)'}}>{selected.chamado_id} · {fDate(selected.criado_em)}</div>
            </div>
            <span style={{background:BGCOLORS[selected.status],color:COLORS[selected.status],border:`1px solid ${COLORS[selected.status]}44`,borderRadius:20,fontSize:10,padding:'4px 11px',fontWeight:700,flexShrink:0}}>{SL[selected.status]}</span>
          </div>

          <div style={{padding:'16px 14px',display:'flex',flexDirection:'column',gap:12}}>

            {/* Info card */}
            <div style={{background:'rgba(255,255,255,.03)',border:'1px solid var(--bord2)',borderRadius:14,overflow:'hidden'}}>
              <div style={{background:'rgba(0,229,255,.06)',padding:'10px 16px',borderBottom:'1px solid var(--bord2)',fontSize:10,fontWeight:700,color:'var(--cyan)',letterSpacing:'.08em',textTransform:'uppercase'}}>Dados da Empresa</div>
              <div style={{padding:'14px 16px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                {[
                  {l:'CNPJ',v:selected.cnpj},
                  {l:'Nome Fantasia',v:selected.nome_fantasia},
                  {l:'Regime Tributário',v:selected.regime_tributario},
                  {l:'CEP',v:selected.cep},
                  {l:'Endereço',v:selected.endereco,full:true},
                  {l:'Cidade / Estado',v:`${selected.cidade||''}${selected.estado?` — ${selected.estado}`:''}`,full:true},
                ].filter(r=>r.v).map(r=>(
                  <div key={r.l} style={r.full?{gridColumn:'1/-1'}:{}}>
                    <div style={{fontSize:9,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:3}}>{r.l}</div>
                    <div style={{fontSize:13,color:'var(--text)',lineHeight:1.4}}>{r.v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Contato card */}
            <div style={{background:'rgba(255,255,255,.03)',border:'1px solid var(--bord2)',borderRadius:14,overflow:'hidden'}}>
              <div style={{background:'rgba(0,229,255,.06)',padding:'10px 16px',borderBottom:'1px solid var(--bord2)',fontSize:10,fontWeight:700,color:'var(--cyan)',letterSpacing:'.08em',textTransform:'uppercase'}}>Contato</div>
              <div style={{padding:'14px 16px',display:'flex',flexDirection:'column',gap:10}}>
                {[
                  {l:'Responsável',v:selected.responsavel},
                  {l:'Email',v:selected.email_cliente},
                  {l:'Telefone',v:fPhone(selected.telefone)},
                  {l:'Celular',v:fPhone(selected.celular)},
                ].filter(r=>r.v).map(r=>(
                  <div key={r.l} style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div>
                      <div style={{fontSize:9,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:2}}>{r.l}</div>
                      <div style={{fontSize:13,color:'var(--text)'}}>{r.v}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* WhatsApp */}
            <a href={waUrl(telPrincipal(selected),selected.responsavel,selected.empresa)} target="_blank" rel="noreferrer"
              style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10,background:'rgba(0,230,118,.1)',border:'1px solid rgba(0,230,118,.3)',color:'#00e676',borderRadius:14,padding:'15px',fontSize:16,fontWeight:800,textDecoration:'none'}}>
              <IconWA size={22}/> Abrir WhatsApp
            </a>

            {/* Status */}
            <div style={{background:'rgba(255,255,255,.03)',border:'1px solid var(--bord2)',borderRadius:14,overflow:'hidden'}}>
              <div style={{background:'rgba(0,229,255,.06)',padding:'10px 16px',borderBottom:'1px solid var(--bord2)',fontSize:10,fontWeight:700,color:'var(--cyan)',letterSpacing:'.08em',textTransform:'uppercase'}}>Atualizar Status</div>
              <div style={{padding:'12px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {(['novo','contato','instalado','pendente'] as Status[]).map(s=>{
                  const active=selected.status===s
                  return(
                    <button key={s} onClick={()=>updateStatus(selected.id,s)}
                      style={{padding:'12px 8px',borderRadius:10,fontSize:13,fontWeight:active?800:500,cursor:'pointer',fontFamily:'inherit',transition:'all .15s',border:`1px solid ${active?COLORS[s]:COLORS[s]+'33'}`,background:active?BGCOLORS[s]:'rgba(0,0,0,.2)',color:COLORS[s],display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                      {active&&<span style={{width:6,height:6,borderRadius:'50%',background:COLORS[s],display:'inline-block'}}/>}
                      {SL[s]}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Nota */}
            <div style={{background:'rgba(255,255,255,.03)',border:'1px solid var(--bord2)',borderRadius:14,overflow:'hidden'}}>
              <div style={{background:'rgba(0,229,255,.06)',padding:'10px 16px',borderBottom:'1px solid var(--bord2)',fontSize:10,fontWeight:700,color:'var(--cyan)',letterSpacing:'.08em',textTransform:'uppercase'}}>Adicionar Nota</div>
              <div style={{padding:'12px'}}>
                <textarea value={nota} onChange={e=>setNota(e.target.value)} placeholder="Digite uma anotação sobre este cliente..." rows={3}
                  style={{width:'100%',background:'rgba(0,0,0,.3)',border:'1px solid var(--border)',color:'var(--text)',borderRadius:10,padding:'11px 13px',fontSize:14,fontFamily:'inherit',resize:'none',outline:'none',marginBottom:10}}/>
                <button onClick={addNota} disabled={saving}
                  style={{width:'100%',background:'rgba(0,229,255,.1)',border:'1px solid rgba(0,229,255,.3)',color:'var(--cyan)',borderRadius:10,padding:'12px',fontSize:14,fontWeight:700,cursor:saving?'not-allowed':'pointer',fontFamily:'inherit'}}>
                  {saving?'Salvando...':'+ Registrar Nota'}
                </button>
              </div>
            </div>

            {/* Histórico */}
            <div style={{background:'rgba(255,255,255,.03)',border:'1px solid var(--bord2)',borderRadius:14,overflow:'hidden'}}>
              <div style={{background:'rgba(0,229,255,.06)',padding:'10px 16px',borderBottom:'1px solid var(--bord2)',fontSize:10,fontWeight:700,color:'var(--cyan)',letterSpacing:'.08em',textTransform:'uppercase'}}>Histórico ({chamados.length})</div>
              <div style={{padding:'14px 16px',display:'flex',flexDirection:'column',gap:12}}>
                {chamados.length===0?<div style={{fontSize:13,color:'var(--muted)',fontStyle:'italic'}}>Nenhum registro ainda.</div>:chamados.map((c,i)=>(
                  <div key={c.id} style={{display:'flex',gap:10}}>
                    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:0,flexShrink:0}}>
                      <div style={{width:8,height:8,borderRadius:'50%',background:i===0?'var(--cyan)':'var(--green)',flexShrink:0,marginTop:3}}/>
                      {i<chamados.length-1&&<div style={{width:1,flex:1,background:'var(--bord2)',marginTop:4}}/>}
                    </div>
                    <div style={{flex:1,paddingBottom:i<chamados.length-1?4:0}}>
                      <div style={{fontSize:13,color:'var(--text)',lineHeight:1.4,marginBottom:3}}>{c.descricao}</div>
                      <div style={{fontSize:10,color:'var(--muted)'}}>{fDate(c.criado_em)} · <span style={{color:'rgba(0,229,255,.5)'}}>{c.usuario}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{height:20}}/>
          </div>
        </div>
      )}
    </div>
  )
}
