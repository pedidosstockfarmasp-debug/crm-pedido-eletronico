'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

type Status = 'novo' | 'contato' | 'instalado' | 'pendente'
interface Lead { id:string;chamado_id:string;empresa:string;cnpj:string;responsavel:string;telefone:string;endereco:string;cidade:string;estado:string;status:Status;origem_email:string;criado_em:string }
interface Chamado { id:string;lead_id:string;descricao:string;tipo:string;usuario:string;criado_em:string }

const SL:Record<Status,string> = {novo:'Novo',contato:'Em Contato',instalado:'Instalado',pendente:'Pendente'}

function waUrl(tel:string,nome:string,empresa:string){
  const c=(tel||'').replace(/\D/g,'');const n=c.startsWith('55')?c:`55${c}`
  return `https://wa.me/${n}?text=${encodeURIComponent(`Olá ${nome}, aqui é a OneClick Soluções! Recebemos a solicitação de instalação do Pedido Eletrônico Stock Farma de ${empresa}. Podemos agendar a instalação?`)}`
}
function fDate(d:string){if(!d)return '-';return new Date(d).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}
function fPhone(t:string){if(!t)return '-';const c=t.replace(/\D/g,'');if(c.length===11)return `(${c.slice(0,2)}) ${c.slice(2,7)}-${c.slice(7)}`;if(c.length===10)return `(${c.slice(0,2)}) ${c.slice(2,6)}-${c.slice(6)}`;return t}

const WA=<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.287 7.041L.785 23.216a.5.5 0 0 0 .619.619l4.175-1.502A11.948 11.948 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.82 9.82 0 0 1-5.007-1.371l-.359-.214-3.717 1.337 1.337-3.717-.214-.359A9.82 9.82 0 0 1 2.182 12C2.182 6.56 6.56 2.182 12 2.182c5.44 0 9.818 4.378 9.818 9.818 0 5.44-4.378 9.818-9.818 9.818z"/></svg>

export default function CRMPage() {
  const router = useRouter()
  const [user, setUser] = useState<{email?:string;user_metadata?:{nome?:string}}|null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [chamados, setChamados] = useState<Chamado[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('todos')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Lead|null>(null)
  const [nota, setNota] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(()=>{
    supabase.auth.getUser().then(({data})=>{
      if(!data.user){router.push('/login');return}
      setUser(data.user)
    })
  },[router])

  const fetchLeads = useCallback(async()=>{
    const {data}=await supabase.from('leads').select('*').order('criado_em',{ascending:false})
    if(data)setLeads(data)
    setLoading(false)
  },[])

  useEffect(()=>{
    if(!user)return
    fetchLeads()
    const ch=supabase.channel('leads-rt')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'leads'},async(payload)=>{
        fetchLeads()
        try{
          await fetch('/api/notify',{method:'POST',headers:{'Content-Type':'application/json'},
            body:JSON.stringify({empresa:payload.new.empresa,responsavel:payload.new.responsavel,telefone:payload.new.telefone,chamado_id:payload.new.chamado_id})})
        }catch(e){console.log('notify error',e)}
      })
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'leads'},fetchLeads)
      .subscribe()
    return()=>{supabase.removeChannel(ch)}
  },[user,fetchLeads])

  useEffect(()=>{
    if(!selected)return
    supabase.from('chamados').select('*').eq('lead_id',selected.id).order('criado_em',{ascending:false}).then(({data})=>{if(data)setChamados(data)})
  },[selected])

  async function updateStatus(id:string,status:Status,nomeUser:string){
    await supabase.from('leads').update({status}).eq('id',id)
    await supabase.from('chamados').insert({lead_id:id,descricao:`Status → "${SL[status]}"`,tipo:'sistema',usuario:nomeUser})
    setSelected(p=>p?{...p,status}:null)
    fetchLeads()
    const {data}=await supabase.from('chamados').select('*').eq('lead_id',id).order('criado_em',{ascending:false})
    if(data)setChamados(data)
  }

  async function addNota(){
    if(!nota.trim()||!selected)return
    setSaving(true)
    const nomeUser=user?.user_metadata?.nome||user?.email||'Atendente'
    await supabase.from('chamados').insert({lead_id:selected.id,descricao:nota.trim(),tipo:'nota',usuario:nomeUser})
    setNota('')
    const {data}=await supabase.from('chamados').select('*').eq('lead_id',selected.id).order('criado_em',{ascending:false})
    if(data)setChamados(data)
    setSaving(false)
  }

  async function logout(){await supabase.auth.signOut();router.push('/login')}

  const filtered=leads.filter(l=>(filter==='todos'||l.status===filter)&&(!search||l.empresa?.toLowerCase().includes(search.toLowerCase())||l.cnpj?.includes(search)||l.responsavel?.toLowerCase().includes(search.toLowerCase())))
  const counts={total:leads.length,novo:leads.filter(l=>l.status==='novo').length,contato:leads.filter(l=>l.status==='contato').length,instalado:leads.filter(l=>l.status==='instalado').length,pendente:leads.filter(l=>l.status==='pendente').length}
  const nomeUser=user?.user_metadata?.nome||user?.email||'Atendente'
  const isAdmin=user?.email==='ronie@oneclicksolucoes.com.br'

  const S={
    root:{minHeight:'100vh',display:'flex',flexDirection:'column' as const,position:'relative' as const},
    grid:{position:'fixed' as const,inset:0,opacity:.025,backgroundImage:'linear-gradient(var(--cyan) 1px,transparent 1px),linear-gradient(90deg,var(--cyan) 1px,transparent 1px)',backgroundSize:'40px 40px',pointerEvents:'none' as const},
    hdr:{display:'flex',alignItems:'center',borderBottom:'1px solid var(--border)',position:'sticky' as const,top:0,zIndex:100,background:'rgba(1,7,18,.97)',backdropFilter:'blur(12px)',minHeight:64,gap:0},
    hdrOC:{display:'flex',alignItems:'center',padding:'0 16px',borderRight:'1px solid var(--border)',height:64,flexShrink:0},
    hdrCenter:{flex:1,display:'flex',flexDirection:'column' as const,alignItems:'center',justifyContent:'center',gap:3,padding:'0 12px'},
    aiTag:{display:'flex',alignItems:'center',gap:7},
    aiLabel:{fontSize:13,fontWeight:600,color:'#fff'},
    aiBadge:{background:'linear-gradient(90deg,rgba(0,229,255,.18),rgba(0,255,153,.12))',border:'1px solid rgba(0,229,255,.3)',color:'var(--cyan)',borderRadius:20,fontSize:9,fontWeight:700,padding:'2px 10px',letterSpacing:'.1em'},
    emailLine:{fontSize:10,color:'rgba(0,229,255,.5)'},
    hdrSF:{display:'flex',alignItems:'center',gap:10,padding:'0 14px',borderLeft:'1px solid var(--border)',height:64,flexShrink:0},
    sfBox:{background:'#fff',borderRadius:8,padding:'3px 10px',height:38,display:'flex',alignItems:'center'},
    sfInfo:{display:'flex',flexDirection:'column' as const},
    sfCanal:{fontSize:8,color:'var(--muted)',letterSpacing:'.1em',textTransform:'uppercase' as const},
    sfPortal:{fontSize:10,color:'rgba(255,255,255,.6)',fontWeight:600},
    hdrRight:{display:'flex',alignItems:'center',gap:8,padding:'0 14px',borderLeft:'1px solid var(--border)',height:64,flexShrink:0},
    pulse:{width:7,height:7,borderRadius:'50%',background:'var(--green)',animation:'pulse 2s infinite'},
    live:{fontSize:9,color:'var(--green)',fontWeight:700,letterSpacing:'.1em'},
    notif:{background:'rgba(255,59,95,.18)',border:'1px solid rgba(255,59,95,.35)',color:'var(--red)',borderRadius:20,fontSize:10,padding:'3px 10px',fontWeight:700},
    userArea:{display:'flex',alignItems:'center',gap:8,padding:'0 14px',borderLeft:'1px solid var(--border)',height:64,flexShrink:0},
    userName:{fontSize:11,color:'var(--muted)'},
    stats:{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,padding:'14px 16px',position:'relative' as const,zIndex:1},
    sc:{background:'var(--card)',border:'1px solid var(--border)',borderRadius:12,padding:'12px 16px',position:'relative' as const,overflow:'hidden'},
    scBar:{position:'absolute' as const,top:0,left:0,width:'100%',height:2,borderRadius:'2px 2px 0 0'},
    scLbl:{fontSize:9,color:'var(--muted)',letterSpacing:'.1em',textTransform:'uppercase' as const,marginBottom:4},
    scVal:{fontSize:28,fontWeight:700,lineHeight:1},
    scSub:{fontSize:9,marginTop:3},
    toolbar:{display:'flex',alignItems:'center',gap:6,padding:'0 16px 12px',position:'relative' as const,zIndex:1,flexWrap:'wrap' as const},
    tab:{padding:'5px 14px',borderRadius:20,fontSize:11,cursor:'pointer',border:'1px solid transparent',background:'none',color:'var(--muted)',fontFamily:'inherit',transition:'.15s'},
    tabOn:{background:'rgba(0,229,255,.1)',borderColor:'rgba(0,229,255,.25)',color:'var(--cyan)',fontWeight:600},
    srch:{background:'rgba(255,255,255,.04)',border:'1px solid var(--border)',color:'var(--text)',borderRadius:8,padding:'6px 14px',fontSize:11,fontFamily:'inherit',width:260,outline:'none'},
    main:{display:'flex',flex:1,position:'relative' as const,zIndex:1,minHeight:0},
    tblWrap:{flex:1,overflow:'auto',minWidth:0},
    loadMsg:{padding:40,textAlign:'center' as const,color:'var(--muted)',fontSize:13},
    tbl:{width:'100%',borderCollapse:'collapse' as const,fontSize:11},
    tagPE:{display:'inline-block',background:'rgba(26,93,171,.22)',border:'1px solid rgba(26,93,171,.4)',color:'#6ab0f5',borderRadius:3,fontSize:8,padding:'1px 5px',fontWeight:700,letterSpacing:'.06em',marginRight:4},
    tagId:{fontSize:11,color:'var(--cyan)',fontWeight:700},
    coName:{display:'block',fontWeight:600,color:'var(--text)',fontSize:12},
    coCnpj:{display:'block',fontSize:9,color:'var(--muted)'},
    wa:{display:'inline-flex',alignItems:'center',gap:4,background:'rgba(0,255,153,.1)',border:'1px solid rgba(0,255,153,.22)',color:'var(--green)',borderRadius:7,padding:'3px 8px',fontSize:10,fontWeight:600,textDecoration:'none',whiteSpace:'nowrap' as const,transition:'.15s'},
    detBtn:{background:'rgba(0,229,255,.07)',border:'1px solid var(--border)',color:'var(--cyan)',borderRadius:6,padding:'4px 10px',fontSize:9,cursor:'pointer',fontFamily:'inherit',transition:'.15s',whiteSpace:'nowrap' as const},
    det:{width:300,flexShrink:0,background:'linear-gradient(180deg,#071b30,#030e1a)',borderLeft:'1px solid var(--border)',padding:'18px 16px',overflowY:'auto' as const,display:'flex',flexDirection:'column' as const,gap:10,animation:'slideIn .25s ease'},
    detHdr:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8},
    detCo:{fontSize:14,fontWeight:700,color:'var(--cyan)',lineHeight:1.3},
    detCnpj:{fontSize:10,color:'var(--muted)',marginTop:2},
    div:{height:1,background:'var(--border)',flexShrink:0},
    sec:{fontSize:9,fontWeight:700,color:'var(--cyan)',letterSpacing:'.1em',textTransform:'uppercase' as const},
    row:{display:'flex',flexDirection:'column' as const,gap:2},
    lbl:{fontSize:8,color:'var(--muted)',textTransform:'uppercase' as const,letterSpacing:'.08em'},
    val:{fontSize:11,color:'var(--text)',lineHeight:1.4},
    valCyan:{fontSize:14,color:'var(--cyan)',fontWeight:700},
    sel:{background:'rgba(0,0,0,.4)',border:'1px solid var(--border)',color:'var(--text)',borderRadius:7,padding:'6px 10px',fontSize:11,fontFamily:'inherit',width:'100%',cursor:'pointer',outline:'none'},
    waFull:{display:'flex',alignItems:'center',justifyContent:'center',gap:6,background:'rgba(0,255,153,.1)',border:'1px solid rgba(0,255,153,.25)',color:'var(--green)',borderRadius:8,padding:8,fontSize:12,fontWeight:700,textDecoration:'none',transition:'.15s'},
    notaInp:{background:'rgba(0,0,0,.3)',border:'1px solid var(--border)',color:'var(--text)',borderRadius:8,padding:'8px 10px',fontSize:11,fontFamily:'inherit',width:'100%',resize:'none' as const,outline:'none',lineHeight:1.5},
    notaBtn:{background:'rgba(0,229,255,.1)',border:'1px solid rgba(0,229,255,.25)',color:'var(--cyan)',borderRadius:8,padding:7,fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'inherit',width:'100%'},
    tl:{display:'flex',flexDirection:'column' as const,gap:8},
    tlItem:{display:'flex',gap:8,alignItems:'flex-start'},
    tlDot:{width:7,height:7,borderRadius:'50%',flexShrink:0,marginTop:3},
    tlCo:{display:'flex',flexDirection:'column' as const,gap:2},
    tlTxt:{fontSize:11,color:'var(--text)',lineHeight:1.4},
    tlDate:{fontSize:9,color:'var(--muted)'},
    tlUser:{fontSize:9,color:'rgba(0,229,255,.5)'},
    foot:{display:'flex',alignItems:'center',justifyContent:'center',gap:12,padding:'9px 16px',borderTop:'1px solid var(--border)',background:'rgba(0,0,0,.2)',position:'relative' as const,zIndex:1,flexWrap:'wrap' as const},
    closeBtn:{background:'none',border:'1px solid var(--border)',color:'var(--muted)',width:26,height:26,borderRadius:6,cursor:'pointer',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit',flexShrink:0},
  }

  const badgeStyle=(st:Status)=>{
    const map={novo:{bg:'rgba(0,229,255,.1)',color:'var(--cyan)',border:'1px solid rgba(0,229,255,.22)'},contato:{bg:'rgba(255,211,77,.1)',color:'var(--yellow)',border:'1px solid rgba(255,211,77,.22)'},instalado:{bg:'rgba(0,255,153,.1)',color:'var(--green)',border:'1px solid rgba(0,255,153,.22)'},pendente:{bg:'rgba(255,59,95,.1)',color:'var(--red)',border:'1px solid rgba(255,59,95,.22)'}}
    return{display:'inline-flex',alignItems:'center',gap:4,padding:'3px 9px',borderRadius:20,fontSize:9,fontWeight:700,...{background:map[st].bg,color:map[st].color,border:map[st].border}}
  }

  const statColors=['var(--cyan)','var(--yellow)','var(--green)','var(--red)']
  const statData=[{l:'Total de Leads',v:counts.total,s:'todos os registros'},{l:'Em Contato',v:counts.contato,s:'aguardando retorno'},{l:'Instalados',v:counts.instalado,s:'sistema em produção'},{l:'Pendentes',v:counts.pendente,s:'sem resposta'}]

  if(!user)return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{color:'var(--cyan)',fontSize:13}}>Verificando acesso...</span></div>

  return (
    <div style={S.root}>
      <div style={S.grid}/>
      <header style={S.hdr}>
        <div style={S.hdrOC}>
          <Image src="/logo-oneclick.png" alt="OneClick Soluções" width={150} height={48} style={{objectFit:'contain'}}/>
        </div>
        <div style={S.hdrCenter}>
          <div style={S.aiTag}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00e5ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            <span style={S.aiLabel}><em style={{color:'var(--cyan)',fontStyle:'normal'}}>IA</em> lendo e processando emails em tempo real</span>
            <span style={S.aiBadge}>⚡ AUTO</span>
          </div>
          <div style={S.emailLine}>pedidosstockfarmasp@gmail.com</div>
        </div>
        <div style={S.hdrSF}>
          <div style={S.sfBox}>
            <Image src="/logo-stockfarma.png" alt="Stock Farma" width={110} height={34} style={{objectFit:'contain'}}/>
          </div>
          <div style={S.sfInfo}>
            <span style={S.sfCanal}>canal parceiro</span>
            <span style={S.sfPortal}>Portal de Instalações</span>
          </div>
        </div>
        <div style={S.hdrRight}>
          <div style={S.pulse}/>
          <span style={S.live}>AO VIVO</span>
          <span style={S.notif}>{counts.novo} novo{counts.novo!==1?'s':''}</span>
        </div>
        <div style={S.userArea}>
          <div style={{width:28,height:28,borderRadius:'50%',background:'rgba(0,229,255,.1)',border:'1px solid rgba(0,229,255,.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'var(--cyan)',flexShrink:0}}>
            {nomeUser.charAt(0).toUpperCase()}
          </div>
          <div style={{display:'flex',flexDirection:'column'}}>
            <span style={{fontSize:11,color:'var(--text)',fontWeight:600,maxWidth:100,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{nomeUser}</span>
            {isAdmin&&<a href="/admin" style={{fontSize:9,color:'var(--cyan)',textDecoration:'none',letterSpacing:'.05em'}}>⚙ Admin</a>}
          </div>
          <button onClick={logout} style={{background:'rgba(255,59,95,.08)',border:'1px solid rgba(255,59,95,.2)',color:'var(--red)',borderRadius:6,padding:'4px 8px',fontSize:9,cursor:'pointer',fontFamily:'inherit',flexShrink:0}}>Sair</button>
        </div>
      </header>

      <div style={S.stats}>
        {statData.map((s,i)=>(
          <div key={s.l} style={S.sc}>
            <div style={{...S.scBar,background:statColors[i]}}/>
            <div style={S.scLbl}>{s.l}</div>
            <div style={{...S.scVal,color:statColors[i]}}>{s.v}</div>
            <div style={{...S.scSub,color:statColors[i].replace(')',', .45)')}}>{s.s}</div>
          </div>
        ))}
      </div>

      <div style={S.toolbar}>
        {['todos','novo','contato','instalado','pendente'].map(f=>(
          <button key={f} style={{...S.tab,...(filter===f?S.tabOn:{})}} onClick={()=>setFilter(f)}>
            {f==='todos'?'Todos':SL[f as Status]}
          </button>
        ))}
        <div style={{flex:1}}/>
        <input style={S.srch} placeholder="Buscar empresa, CNPJ, responsável..." value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>

      <div style={S.main}>
        <div style={S.tblWrap}>
          {loading?<div style={S.loadMsg}>Carregando leads...</div>:filtered.length===0?<div style={S.loadMsg}>Nenhum lead encontrado.</div>:(
            <table style={S.tbl}>
              <thead>
                <tr>{['Chamado','Empresa','Responsável','WhatsApp','Recebido','Status','Ação'].map(h=>(
                  <th key={h} style={{padding:'8px 12px',textAlign:'left',color:'var(--muted)',fontSize:9,letterSpacing:'.1em',textTransform:'uppercase',borderBottom:'1px solid var(--border)',background:'rgba(0,0,0,.25)',fontWeight:500,whiteSpace:'nowrap',position:'sticky',top:0}}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {filtered.map(l=>(
                  <tr key={l.id} onClick={()=>setSelected(l)} style={{borderBottom:'1px solid rgba(255,255,255,.025)',cursor:'pointer',background:selected?.id===l.id?'rgba(0,229,255,.08)':'transparent',transition:'background .12s'}}>
                    <td style={{padding:'9px 12px'}}><span style={S.tagPE}>PE</span><span style={S.tagId}>{l.chamado_id||l.id.slice(0,8)}</span></td>
                    <td style={{padding:'9px 12px',maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}><span style={S.coName}>{l.empresa}</span><span style={S.coCnpj}>{l.cnpj}</span></td>
                    <td style={{padding:'9px 12px',fontSize:11,maxWidth:130,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.responsavel}</td>
                    <td style={{padding:'9px 12px'}}>
                      <a style={S.wa} href={waUrl(l.telefone,l.responsavel,l.empresa)} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}>{WA}{fPhone(l.telefone)}</a>
                    </td>
                    <td style={{padding:'9px 12px',fontSize:10,color:'var(--muted)',whiteSpace:'nowrap'}}>{fDate(l.criado_em)}</td>
                    <td style={{padding:'9px 12px'}}><span style={badgeStyle(l.status)}>{SL[l.status]}</span></td>
                    <td style={{padding:'9px 12px'}}><button style={S.detBtn} onClick={e=>{e.stopPropagation();setSelected(l)}}>Detalhes</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {selected&&(
          <div style={S.det}>
            <div style={S.detHdr}>
              <div>
                <div style={S.detCo}>{selected.empresa}</div>
                <div style={S.detCnpj}>{selected.cnpj}</div>
                <span style={{...badgeStyle(selected.status),marginTop:6,display:'inline-flex'}}>{SL[selected.status]}</span>
              </div>
              <button style={S.closeBtn} onClick={()=>setSelected(null)}>✕</button>
            </div>
            <div style={S.div}/>
            <div style={S.sec}>Dados do Chamado</div>
            <div style={S.row}><span style={S.lbl}>ID</span><span style={S.valCyan}>{selected.chamado_id||selected.id.slice(0,8)}</span></div>
            <div style={S.row}><span style={S.lbl}>Responsável</span><span style={S.val}>{selected.responsavel}</span></div>
            <div style={S.row}><span style={S.lbl}>Telefone</span><span style={S.val}>{fPhone(selected.telefone)}</span></div>
            <div style={S.row}><span style={S.lbl}>Endereço</span><span style={S.val}>{selected.endereco}</span></div>
            <div style={S.row}><span style={S.lbl}>Cidade/Estado</span><span style={S.val}>{selected.cidade}{selected.estado?` / ${selected.estado}`:''}</span></div>
            <div style={S.row}><span style={S.lbl}>Recebido</span><span style={S.val}>{fDate(selected.criado_em)}</span></div>
            <div style={S.div}/>
            <div style={S.sec}>Atualizar Status</div>
            <select style={S.sel} value={selected.status} onChange={e=>updateStatus(selected.id,e.target.value as Status,nomeUser)}>
              <option value="novo">Novo</option>
              <option value="contato">Em Contato</option>
              <option value="instalado">Instalado</option>
              <option value="pendente">Pendente</option>
            </select>
            <a style={S.waFull} href={waUrl(selected.telefone,selected.responsavel,selected.empresa)} target="_blank" rel="noreferrer">{WA} Abrir WhatsApp</a>
            <div style={S.div}/>
            <div style={S.sec}>Adicionar Nota</div>
            <textarea style={S.notaInp} placeholder="Digite uma anotação..." value={nota} onChange={e=>setNota(e.target.value)} rows={3}/>
            <button style={S.notaBtn} onClick={addNota} disabled={saving}>{saving?'Salvando...':'+ Registrar Nota'}</button>
            <div style={S.div}/>
            <div style={S.sec}>Histórico</div>
            <div style={S.tl}>
              {chamados.length===0&&<span style={{fontSize:10,color:'var(--muted)',fontStyle:'italic'}}>Nenhum registro ainda.</span>}
              {chamados.map((c,i)=>(
                <div key={c.id} style={S.tlItem}>
                  <div style={{...S.tlDot,background:i===0?'var(--cyan)':'var(--green)'}}/>
                  <div style={S.tlCo}>
                    <span style={S.tlTxt}>{c.descricao}</span>
                    <span style={S.tlDate}>{fDate(c.criado_em)} · <span style={S.tlUser}>{c.usuario}</span></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <footer style={S.foot}>
        <span style={{fontSize:9,color:'var(--muted)',letterSpacing:'.06em',textTransform:'uppercase'}}>Desenvolvido por</span>
        <span style={{fontSize:10,fontWeight:700,color:'var(--cyan)'}}>OneClick Soluções</span>
        <span style={{fontSize:10,color:'var(--muted)'}}>×</span>
        <div style={{background:'#fff',borderRadius:5,padding:'2px 8px',height:22,display:'flex',alignItems:'center'}}>
          <Image src="/logo-stockfarma.png" alt="Stock Farma" width={56} height={16} style={{objectFit:'contain'}}/>
        </div>
        <div style={{width:1,height:12,background:'var(--border)'}}/>
        <span style={{fontSize:9,color:'var(--muted)',letterSpacing:'.06em',textTransform:'uppercase'}}>Pedido Eletrônico · Canal Parceiro · {new Date().getFullYear()}</span>
      </footer>
    </div>
  )
}
