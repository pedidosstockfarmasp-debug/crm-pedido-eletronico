'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

type Status = 'novo'|'contato'|'instalado'|'pendente'
interface Lead{id:string;chamado_id:string;empresa:string;cnpj:string;responsavel:string;telefone:string;celular:string;endereco:string;cidade:string;estado:string;cep:string;nome_fantasia:string;regime_tributario:string;email_cliente:string;status:Status;criado_em:string}
interface Chamado{id:string;lead_id:string;descricao:string;tipo:string;usuario:string;criado_em:string}

const SL:Record<Status,string>={novo:'Novo',contato:'Em Contato',instalado:'Instalado',pendente:'Pendente'}
const SC:Record<Status,{c:string;bg:string}>={
  novo:{c:'#00e5ff',bg:'rgba(0,229,255,.12)'},
  contato:{c:'#ffca28',bg:'rgba(255,202,40,.12)'},
  instalado:{c:'#00e676',bg:'rgba(0,230,118,.12)'},
  pendente:{c:'#ff5252',bg:'rgba(255,82,82,.12)'},
}
const waUrl=(tel:string,nome:string,emp:string)=>{const c=(tel||'').replace(/\D/g,'');const n=c.startsWith('55')?c:`55${c}`;return `https://wa.me/${n}?text=${encodeURIComponent(`Olá ${nome}, aqui é a OneClick Soluções! Recebemos a solicitação de instalação do Pedido Eletrônico Stock Farma de ${emp}. Podemos agendar a instalação?`)}`}
const fD=(d:string)=>{if(!d)return '-';return new Date(d).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}
const fP=(t:string)=>{if(!t)return '';const c=t.replace(/\D/g,'');if(c.length===11)return `(${c.slice(0,2)}) ${c.slice(2,7)}-${c.slice(7)}`;if(c.length===10)return `(${c.slice(0,2)}) ${c.slice(2,6)}-${c.slice(6)}`;return t}
const IcoWA=(s=14)=><svg viewBox="0 0 24 24" width={s} height={s} fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.287 7.041L.785 23.216a.5.5 0 0 0 .619.619l4.175-1.502A11.948 11.948 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.82 9.82 0 0 1-5.007-1.371l-.359-.214-3.717 1.337 1.337-3.717-.214-.359A9.82 9.82 0 0 1 2.182 12C2.182 6.56 6.56 2.182 12 2.182c5.44 0 9.818 4.378 9.818 9.818 0 5.44-4.378 9.818-9.818 9.818z"/></svg>

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
  const [drawer,setDrawer]=useState(false)
  const [srchOpen,setSrchOpen]=useState(false)

  useEffect(()=>{supabase.auth.getUser().then(({data})=>{if(!data.user){router.push('/login');return};setUser(data.user)})},[router])

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

  useEffect(()=>{if(!selected)return;supabase.from('chamados').select('*').eq('lead_id',selected.id).order('criado_em',{ascending:false}).then(({data})=>{if(data)setChamados(data)})},[selected])

  const updateStatus=async(id:string,status:Status)=>{
    const nu=user?.user_metadata?.nome||user?.email||'Atendente'
    await supabase.from('leads').update({status}).eq('id',id)
    await supabase.from('chamados').insert({lead_id:id,descricao:`Status → "${SL[status]}"`,tipo:'sistema',usuario:nu})
    setSelected(p=>p?{...p,status}:null);fetchLeads()
    const{data}=await supabase.from('chamados').select('*').eq('lead_id',id).order('criado_em',{ascending:false});if(data)setChamados(data)
  }

  const addNota=async()=>{
    if(!nota.trim()||!selected)return;setSaving(true)
    const nu=user?.user_metadata?.nome||user?.email||'Atendente'
    await supabase.from('chamados').insert({lead_id:selected.id,descricao:nota.trim(),tipo:'nota',usuario:nu})
    setNota('');const{data}=await supabase.from('chamados').select('*').eq('lead_id',selected.id).order('criado_em',{ascending:false});if(data)setChamados(data);setSaving(false)
  }

  const logout=async()=>{await supabase.auth.signOut();router.push('/login')}
  const filtered=leads.filter(l=>(filter==='todos'||l.status===filter)&&(!search||l.empresa?.toLowerCase().includes(search.toLowerCase())||l.cnpj?.includes(search)||l.responsavel?.toLowerCase().includes(search.toLowerCase())||l.nome_fantasia?.toLowerCase().includes(search.toLowerCase())))
  const counts={total:leads.length,novo:leads.filter(l=>l.status==='novo').length,contato:leads.filter(l=>l.status==='contato').length,instalado:leads.filter(l=>l.status==='instalado').length,pendente:leads.filter(l=>l.status==='pendente').length}
  const nome=user?.user_metadata?.nome||user?.email?.split('@')[0]||'Atendente'
  const isAdmin=user?.email==='ronie@oneclicksolucoes.com.br'
  const tel=(l:Lead)=>l.celular||l.telefone||''

  if(!user)return<div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0a1929'}}><div style={{width:32,height:32,border:'3px solid rgba(0,229,255,.1)',borderTop:'3px solid #00e5ff',borderRadius:'50%',animation:'spin .8s linear infinite'}}/></div>

  const S={
    hdrBtn:{background:'rgba(255,255,255,.06)',border:'1px solid rgba(0,229,255,.1)',borderRadius:9,width:38,height:38,display:'flex' as const,alignItems:'center' as const,justifyContent:'center' as const,cursor:'pointer',flexShrink:0,color:'#a8ccee'},
    sec:{background:'rgba(255,255,255,.03)',border:'1px solid rgba(0,229,255,.07)',borderRadius:14,overflow:'hidden' as const},
    secHdr:{background:'rgba(0,229,255,.06)',padding:'10px 16px',borderBottom:'1px solid rgba(0,229,255,.07)',fontSize:10,fontWeight:700,color:'#00e5ff',letterSpacing:'.08em',textTransform:'uppercase' as const},
  }

  return(
    <div style={{minHeight:'100vh',width:'100%',maxWidth:'100vw',overflowX:'hidden',display:'flex',flexDirection:'column',background:'#0a1929'}}>

      {/* DRAWER OVERLAY */}
      {drawer&&<div onClick={()=>setDrawer(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.65)',zIndex:200,animation:'fadeIn .2s'}}/>}

      {/* DRAWER */}
      <div style={{position:'fixed',top:0,left:0,bottom:0,width:270,background:'#0c1e33',borderRight:'1px solid rgba(0,229,255,.1)',zIndex:201,transform:drawer?'translateX(0)':'translateX(-100%)',transition:'transform .26s cubic-bezier(.4,0,.2,1)',display:'flex',flexDirection:'column',overflowY:'auto'}}>
        <div style={{background:'linear-gradient(160deg,#0d2137,#163354)',padding:'18px 16px 16px',borderBottom:'1px solid rgba(0,229,255,.07)'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
            <Image src="/logo-oneclick.png" alt="OneClick" width={120} height={38} style={{objectFit:'contain'}}/>
            <button onClick={()=>setDrawer(false)} style={{background:'rgba(255,255,255,.08)',border:'none',color:'#a8ccee',borderRadius:8,width:30,height:30,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:16,fontFamily:'inherit'}}>✕</button>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div style={{width:44,height:44,borderRadius:'50%',background:'linear-gradient(135deg,#00b8d4,#7c4dff)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:800,color:'#fff',flexShrink:0}}>{nome.charAt(0).toUpperCase()}</div>
            <div style={{minWidth:0}}>
              <div style={{fontSize:14,fontWeight:700,color:'#e8f4ff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{nome}</div>
              <div style={{fontSize:10,color:'#5a8aaa',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user?.email}</div>
              {isAdmin&&<div style={{fontSize:9,color:'#00e5ff',marginTop:2,fontWeight:700,letterSpacing:'.05em'}}>⭐ ADMINISTRADOR</div>}
            </div>
          </div>
        </div>
        <div style={{padding:'14px 16px',borderBottom:'1px solid rgba(0,229,255,.07)',display:'flex',alignItems:'center',gap:12}}>
          <div style={{background:'#fff',borderRadius:8,padding:'4px 10px',height:34,display:'flex',alignItems:'center',flexShrink:0}}>
            <Image src="/logo-stockfarma.png" alt="Stock Farma" width={88} height={26} style={{objectFit:'contain'}}/>
          </div>
          <div><div style={{fontSize:9,color:'#5a8aaa',textTransform:'uppercase',letterSpacing:'.08em'}}>Canal Parceiro</div><div style={{fontSize:11,color:'#a8ccee',fontWeight:600}}>Portal de Instalações</div></div>
        </div>
        <div style={{padding:'12px 16px',borderBottom:'1px solid rgba(0,229,255,.07)',display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:8,height:8,borderRadius:'50%',background:'#00e676',animation:'pulse2 2s infinite',flexShrink:0}}/>
          <div><div style={{fontSize:11,color:'#00e676',fontWeight:700}}>IA Ativa — Monitorando</div><div style={{fontSize:9,color:'#5a8aaa',marginTop:1}}>pedidosstockfarmasp@gmail.com</div></div>
          <div style={{marginLeft:'auto',background:'rgba(0,229,255,.1)',border:'1px solid rgba(0,229,255,.2)',borderRadius:10,fontSize:8,color:'#00e5ff',padding:'2px 7px',fontWeight:800,flexShrink:0}}>AUTO</div>
        </div>
        <div style={{padding:'12px 16px',borderBottom:'1px solid rgba(0,229,255,.07)'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            {[{l:'Total',v:counts.total,c:'#00e5ff'},{l:'Novos',v:counts.novo,c:'#00e5ff'},{l:'Instalados',v:counts.instalado,c:'#00e676'},{l:'Pendentes',v:counts.pendente,c:'#ff5252'}].map(s=>(
              <div key={s.l} style={{background:'rgba(0,0,0,.2)',borderRadius:10,padding:'8px 10px',textAlign:'center',border:'1px solid rgba(0,229,255,.06)'}}>
                <div style={{fontSize:22,fontWeight:800,color:s.c,lineHeight:1}}>{s.v}</div>
                <div style={{fontSize:9,color:'#5a8aaa',marginTop:2,textTransform:'uppercase',letterSpacing:'.04em'}}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{flex:1,padding:'8px 10px',display:'flex',flexDirection:'column',gap:2}}>
          <button onClick={()=>setDrawer(false)} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',borderRadius:10,border:'1px solid rgba(0,229,255,.15)',background:'rgba(0,229,255,.08)',color:'#00e5ff',cursor:'pointer',fontFamily:'inherit',fontSize:14,fontWeight:700,textAlign:'left',width:'100%'}}>
            <span style={{fontSize:18}}>🏠</span> Dashboard
          </button>
          {isAdmin&&<button onClick={()=>{router.push('/admin');setDrawer(false)}} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',borderRadius:10,border:'none',background:'none',color:'#a8ccee',cursor:'pointer',fontFamily:'inherit',fontSize:14,textAlign:'left',width:'100%'}}>
            <span style={{fontSize:18}}>⚙️</span> Gerenciar Atendentes
          </button>}
        </div>
        <div style={{padding:'10px',borderTop:'1px solid rgba(0,229,255,.07)'}}>
          <button onClick={logout} style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10,padding:'12px',borderRadius:10,border:'1px solid rgba(255,82,82,.2)',background:'rgba(255,82,82,.06)',color:'#ff5252',cursor:'pointer',fontFamily:'inherit',fontSize:14,fontWeight:700,width:'100%'}}>
            🚪 Sair do Sistema
          </button>
        </div>
      </div>

      {/* HEADER — apenas 4 elementos em linha */}
      <header style={{position:'sticky',top:0,zIndex:100,background:'rgba(10,25,41,.98)',backdropFilter:'blur(20px)',WebkitBackdropFilter:'blur(20px)',borderBottom:'1px solid rgba(0,229,255,.07)'}}>
        <div style={{display:'flex',alignItems:'center',padding:'10px 14px',gap:10,width:'100%',boxSizing:'border-box'}}>
          <button onClick={()=>setDrawer(true)} style={S.hdrBtn}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <div style={{flex:1,minWidth:0,display:'flex',alignItems:'center',gap:8}}>
            <Image src="/logo-oneclick.png" alt="OneClick" width={130} height={40} style={{objectFit:'contain',flexShrink:0}}/>
            <div style={{display:'flex',alignItems:'center',gap:4}}>
              <div style={{width:6,height:6,borderRadius:'50%',background:'#00e676',animation:'pulse2 2s infinite',flexShrink:0}}/>
              <span style={{fontSize:9,color:'#00e676',fontWeight:800,letterSpacing:'.05em',whiteSpace:'nowrap'}}>IA</span>
            </div>
          </div>
          {counts.novo>0&&<div style={{background:'#ff5252',color:'#fff',borderRadius:20,fontSize:12,padding:'3px 10px',fontWeight:800,flexShrink:0}}>{counts.novo}</div>}
          <button onClick={()=>setSrchOpen(p=>!p)} style={{...S.hdrBtn,...(srchOpen?{background:'rgba(0,229,255,.12)',borderColor:'rgba(0,229,255,.3)',color:'#00e5ff'}:{})}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          </button>
        </div>
        {srchOpen&&(
          <div style={{padding:'0 14px 10px'}}>
            <input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar empresa, CNPJ, responsável..."
              style={{width:'100%',boxSizing:'border-box',background:'rgba(255,255,255,.05)',border:'1px solid rgba(0,229,255,.25)',color:'#e8f4ff',borderRadius:10,padding:'10px 14px',fontSize:14,fontFamily:'inherit',outline:'none'}}/>
          </div>
        )}
        <div style={{display:'flex',gap:6,padding:'0 14px 10px',overflowX:'auto',WebkitOverflowScrolling:'touch',scrollbarWidth:'none',msOverflowStyle:'none'}}>
          {[{k:'todos',l:'Todos',n:counts.total},{k:'novo',l:'Novos',n:counts.novo},{k:'contato',l:'Contato',n:counts.contato},{k:'instalado',l:'Instalado',n:counts.instalado},{k:'pendente',l:'Pendente',n:counts.pendente}].map(f=>(
            <button key={f.k} onClick={()=>setFilter(f.k)} style={{flexShrink:0,padding:'5px 14px',borderRadius:20,fontSize:12,fontWeight:filter===f.k?700:400,cursor:'pointer',fontFamily:'inherit',transition:'all .15s',whiteSpace:'nowrap',border:filter===f.k?'1px solid #00e5ff':'1px solid rgba(255,255,255,.1)',background:filter===f.k?'rgba(0,229,255,.12)':'rgba(255,255,255,.04)',color:filter===f.k?'#00e5ff':'#5a8aaa'}}>
              {f.l}{f.n>0?` (${f.n})`:''}
            </button>
          ))}
        </div>
      </header>

      {/* STATS */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,padding:'12px 14px 4px'}}>
        {[{l:'Total',v:counts.total,c:'#00e5ff',f:'todos'},{l:'Contato',v:counts.contato,c:'#ffca28',f:'contato'},{l:'Instal.',v:counts.instalado,c:'#00e676',f:'instalado'},{l:'Pend.',v:counts.pendente,c:'#ff5252',f:'pendente'}].map(s=>(
          <div key={s.l} onClick={()=>setFilter(s.f)} style={{background:'rgba(13,33,55,.95)',border:'1px solid rgba(0,229,255,.07)',borderRadius:12,padding:'10px 6px',textAlign:'center',position:'relative',overflow:'hidden',cursor:'pointer'}}>
            <div style={{position:'absolute',top:0,left:0,right:0,height:2,background:s.c}}/>
            <div style={{fontSize:26,fontWeight:800,color:s.c,lineHeight:1}}>{s.v}</div>
            <div style={{fontSize:9,color:'#5a8aaa',marginTop:3,textTransform:'uppercase',letterSpacing:'.04em'}}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* CARDS */}
      <div style={{flex:1,padding:'10px 14px 24px',display:'flex',flexDirection:'column',gap:10}}>
        {loading?<div style={{padding:48,textAlign:'center'}}><div style={{width:36,height:36,border:'3px solid rgba(0,229,255,.1)',borderTop:'3px solid #00e5ff',borderRadius:'50%',animation:'spin .8s linear infinite',margin:'0 auto 14px'}}/><div style={{fontSize:13,color:'#5a8aaa'}}>Carregando leads...</div></div>
        :filtered.length===0?<div style={{padding:48,textAlign:'center'}}><div style={{fontSize:32,marginBottom:10}}>🔍</div><div style={{fontSize:14,color:'#5a8aaa'}}>Nenhum lead encontrado</div></div>
        :filtered.map((l,i)=>{const s=SC[l.status];return(
          <div key={l.id} onClick={()=>setSelected(l)} style={{background:'rgba(13,33,55,.95)',border:`1px solid ${selected?.id===l.id?'rgba(0,229,255,.4)':'rgba(0,229,255,.07)'}`,borderLeft:`4px solid ${s.c}`,borderRadius:14,padding:'14px',cursor:'pointer',animation:`fadeUp .22s ease ${Math.min(i,10)*0.03}s both`,transition:'border-color .15s'}}>
            <div style={{display:'flex',alignItems:'flex-start',gap:10,marginBottom:10}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:15,fontWeight:800,color:'#e8f4ff',lineHeight:1.3,marginBottom:2}}>{l.empresa}</div>
                {l.nome_fantasia&&l.nome_fantasia!==l.empresa&&<div style={{fontSize:11,color:'#00e5ff',marginBottom:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>✦ {l.nome_fantasia}</div>}
                <div style={{fontSize:11,color:'#5a8aaa'}}>{l.cnpj}</div>
              </div>
              <span style={{background:s.bg,color:s.c,border:`1px solid ${s.c}33`,borderRadius:20,fontSize:10,padding:'3px 10px',fontWeight:700,flexShrink:0,whiteSpace:'nowrap'}}>{SL[l.status]}</span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8,borderTop:'1px solid rgba(0,229,255,.07)',paddingTop:10}}>
              <span style={{background:'rgba(26,93,171,.2)',border:'1px solid rgba(100,160,245,.25)',color:'#7ab5f5',borderRadius:4,fontSize:8,padding:'2px 6px',fontWeight:800,flexShrink:0}}>PE</span>
              <span style={{fontSize:11,color:'#00e5ff',fontWeight:700,flexShrink:0}}>{l.chamado_id||l.id.slice(0,8)}</span>
              <span style={{fontSize:11,color:'#a8ccee',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.responsavel}</span>
              <span style={{fontSize:10,color:'#5a8aaa',flexShrink:0,whiteSpace:'nowrap'}}>{fD(l.criado_em)}</span>
              <a href={waUrl(tel(l),l.responsavel,l.empresa)} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{display:'flex',alignItems:'center',gap:4,background:'rgba(0,230,118,.1)',border:'1px solid rgba(0,230,118,.3)',color:'#00e676',borderRadius:9,padding:'6px 10px',fontSize:11,fontWeight:700,textDecoration:'none',flexShrink:0}}>
                {IcoWA(13)} WA
              </a>
            </div>
          </div>
        )})}
      </div>

      {/* DETAIL */}
      {selected&&(
        <div style={{position:'fixed',inset:0,zIndex:300,background:'linear-gradient(180deg,#0e2642,#091829)',overflowY:'auto',WebkitOverflowScrolling:'touch',animation:'slideUp .3s cubic-bezier(.4,0,.2,1)'}}>
          <div style={{position:'sticky',top:0,background:'rgba(10,27,48,.98)',backdropFilter:'blur(20px)',borderBottom:'1px solid rgba(0,229,255,.07)',padding:'12px 14px',display:'flex',alignItems:'center',gap:10,zIndex:10}}>
            <button onClick={()=>setSelected(null)} style={{background:'rgba(0,229,255,.08)',border:'1px solid rgba(0,229,255,.2)',color:'#00e5ff',borderRadius:9,width:38,height:38,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            </button>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:800,color:'#00e5ff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{selected.empresa}</div>
              <div style={{fontSize:10,color:'#5a8aaa'}}>{selected.chamado_id} · {fD(selected.criado_em)}</div>
            </div>
            <span style={{background:SC[selected.status].bg,color:SC[selected.status].c,border:`1px solid ${SC[selected.status].c}44`,borderRadius:20,fontSize:10,padding:'4px 11px',fontWeight:700,flexShrink:0}}>{SL[selected.status]}</span>
          </div>
          <div style={{padding:'16px 14px',display:'flex',flexDirection:'column',gap:12}}>
            <div style={S.sec}>
              <div style={S.secHdr}>Dados da Empresa</div>
              <div style={{padding:'14px 16px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                {[{l:'CNPJ',v:selected.cnpj},{l:'Nome Fantasia',v:selected.nome_fantasia},{l:'Regime Tributário',v:selected.regime_tributario,full:true},{l:'CEP',v:selected.cep},{l:'Endereço',v:selected.endereco,full:true},{l:'Cidade / Estado',v:`${selected.cidade||''}${selected.estado?` — ${selected.estado}`:''}`,full:true}].filter(r=>r.v).map(r=>(
                  <div key={r.l} style={r.full?{gridColumn:'1/-1'}:{}}>
                    <div style={{fontSize:9,color:'#5a8aaa',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:3}}>{r.l}</div>
                    <div style={{fontSize:13,color:'#e8f4ff',lineHeight:1.4}}>{r.v}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={S.sec}>
              <div style={S.secHdr}>Contato</div>
              <div style={{padding:'14px 16px',display:'flex',flexDirection:'column',gap:10}}>
                {[{l:'Responsável',v:selected.responsavel},{l:'Email',v:selected.email_cliente},{l:'Telefone',v:fP(selected.telefone)},{l:'Celular',v:fP(selected.celular)}].filter(r=>r.v).map(r=>(
                  <div key={r.l}>
                    <div style={{fontSize:9,color:'#5a8aaa',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:2}}>{r.l}</div>
                    <div style={{fontSize:13,color:'#e8f4ff'}}>{r.v}</div>
                  </div>
                ))}
              </div>
            </div>
            <a href={waUrl(tel(selected),selected.responsavel,selected.empresa)} target="_blank" rel="noreferrer" style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10,background:'rgba(0,230,118,.1)',border:'1px solid rgba(0,230,118,.3)',color:'#00e676',borderRadius:14,padding:'15px',fontSize:16,fontWeight:800,textDecoration:'none'}}>
              {IcoWA(22)} Abrir WhatsApp
            </a>
            <div style={S.sec}>
              <div style={S.secHdr}>Atualizar Status</div>
              <div style={{padding:'12px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {(['novo','contato','instalado','pendente'] as Status[]).map(s=>{const active=selected.status===s;const sc=SC[s];return(
                  <button key={s} onClick={()=>updateStatus(selected.id,s)} style={{padding:'12px 8px',borderRadius:10,fontSize:13,fontWeight:active?800:500,cursor:'pointer',fontFamily:'inherit',transition:'all .15s',border:`1px solid ${active?sc.c:sc.c+'33'}`,background:active?sc.bg:'rgba(0,0,0,.2)',color:sc.c,display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                    {active&&<span style={{width:6,height:6,borderRadius:'50%',background:sc.c,display:'inline-block'}}/>}{SL[s]}
                  </button>
                )})}
              </div>
            </div>
            <div style={S.sec}>
              <div style={S.secHdr}>Adicionar Nota</div>
              <div style={{padding:'12px',display:'flex',flexDirection:'column',gap:8}}>
                <textarea value={nota} onChange={e=>setNota(e.target.value)} placeholder="Digite uma anotação..." rows={3} style={{width:'100%',boxSizing:'border-box',background:'rgba(0,0,0,.3)',border:'1px solid rgba(0,229,255,.15)',color:'#e8f4ff',borderRadius:10,padding:'11px 13px',fontSize:14,fontFamily:'inherit',resize:'none',outline:'none'}}/>
                <button onClick={addNota} disabled={saving} style={{background:'rgba(0,229,255,.1)',border:'1px solid rgba(0,229,255,.3)',color:'#00e5ff',borderRadius:10,padding:'12px',fontSize:14,fontWeight:700,cursor:saving?'not-allowed':'pointer',fontFamily:'inherit'}}>{saving?'Salvando...':'+ Registrar Nota'}</button>
              </div>
            </div>
            <div style={S.sec}>
              <div style={S.secHdr}>Histórico ({chamados.length})</div>
              <div style={{padding:'14px 16px',display:'flex',flexDirection:'column',gap:12}}>
                {chamados.length===0?<div style={{fontSize:13,color:'#5a8aaa',fontStyle:'italic'}}>Nenhum registro ainda.</div>:chamados.map((c,i)=>(
                  <div key={c.id} style={{display:'flex',gap:10}}>
                    <div style={{display:'flex',flexDirection:'column',alignItems:'center',flexShrink:0}}>
                      <div style={{width:8,height:8,borderRadius:'50%',background:i===0?'#00e5ff':'#00e676',marginTop:3}}/>
                      {i<chamados.length-1&&<div style={{width:1,flex:1,background:'rgba(0,229,255,.07)',marginTop:4,minHeight:16}}/>}
                    </div>
                    <div style={{flex:1,paddingBottom:i<chamados.length-1?4:0}}>
                      <div style={{fontSize:13,color:'#e8f4ff',lineHeight:1.4,marginBottom:3}}>{c.descricao}</div>
                      <div style={{fontSize:10,color:'#5a8aaa'}}>{fD(c.criado_em)} · <span style={{color:'rgba(0,229,255,.5)'}}>{c.usuario}</span></div>
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
