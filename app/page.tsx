'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import styles from './page.module.css'

type Status = 'novo' | 'contato' | 'instalado' | 'pendente'

interface Lead {
  id: string
  chamado_id: string
  empresa: string
  cnpj: string
  responsavel: string
  telefone: string
  endereco: string
  cidade: string
  estado: string
  status: Status
  origem_email: string
  criado_em: string
}

interface Chamado {
  id: string
  lead_id: string
  descricao: string
  tipo: string
  usuario: string
  criado_em: string
}

const STATUS_LABEL: Record<Status, string> = {
  novo: 'Novo',
  contato: 'Em Contato',
  instalado: 'Instalado',
  pendente: 'Pendente',
}

const WA_SVG = (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.287 7.041L.785 23.216a.5.5 0 0 0 .619.619l4.175-1.502A11.948 11.948 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.82 9.82 0 0 1-5.007-1.371l-.359-.214-3.717 1.337 1.337-3.717-.214-.359A9.82 9.82 0 0 1 2.182 12C2.182 6.56 6.56 2.182 12 2.182c5.44 0 9.818 4.378 9.818 9.818 0 5.44-4.378 9.818-9.818 9.818z"/>
  </svg>
)

function waUrl(tel: string, nome: string, empresa: string) {
  const clean = tel?.replace(/\D/g, '') || ''
  const num = clean.startsWith('55') ? clean : `55${clean}`
  const msg = `Olá ${nome}, aqui é a OneClick Soluções! Recebemos a solicitação de instalação do Pedido Eletrônico Stock Farma de ${empresa}. Podemos agendar a instalação?`
  return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`
}

function formatDate(d: string) {
  if (!d) return '-'
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function formatPhone(tel: string) {
  if (!tel) return '-'
  const c = tel.replace(/\D/g, '')
  if (c.length === 11) return `(${c.slice(0,2)}) ${c.slice(2,7)}-${c.slice(7)}`
  if (c.length === 10) return `(${c.slice(0,2)}) ${c.slice(2,6)}-${c.slice(6)}`
  return tel
}

export default function CRMPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [chamados, setChamados] = useState<Chamado[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('todos')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Lead | null>(null)
  const [nota, setNota] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchLeads = useCallback(async () => {
    const { data } = await supabase
      .from('leads')
      .select('*')
      .order('criado_em', { ascending: false })
    if (data) setLeads(data)
    setLoading(false)
  }, [])

  const fetchChamados = useCallback(async (leadId: string) => {
    const { data } = await supabase
      .from('chamados')
      .select('*')
      .eq('lead_id', leadId)
      .order('criado_em', { ascending: false })
    if (data) setChamados(data)
  }, [])

  useEffect(() => {
    fetchLeads()
    const channel = supabase
      .channel('leads-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, fetchLeads)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchLeads])

  useEffect(() => {
    if (selected) fetchChamados(selected.id)
  }, [selected, fetchChamados])

  const updateStatus = async (id: string, status: Status) => {
    await supabase.from('leads').update({ status }).eq('id', id)
    await supabase.from('chamados').insert({
      lead_id: id,
      descricao: `Status atualizado para "${STATUS_LABEL[status]}"`,
      tipo: 'sistema',
      usuario: 'Atendente',
    })
    setSelected(prev => prev ? { ...prev, status } : null)
    fetchLeads()
    if (selected) fetchChamados(id)
  }

  const addNota = async () => {
    if (!nota.trim() || !selected) return
    setSaving(true)
    await supabase.from('chamados').insert({
      lead_id: selected.id,
      descricao: nota.trim(),
      tipo: 'nota',
      usuario: 'Atendente',
    })
    setNota('')
    fetchChamados(selected.id)
    setSaving(false)
  }

  const filtered = leads.filter(l => {
    const matchFilter = filter === 'todos' || l.status === filter
    const matchSearch = !search ||
      l.empresa?.toLowerCase().includes(search.toLowerCase()) ||
      l.cnpj?.includes(search) ||
      l.responsavel?.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  const counts = {
    total: leads.length,
    novo: leads.filter(l => l.status === 'novo').length,
    contato: leads.filter(l => l.status === 'contato').length,
    instalado: leads.filter(l => l.status === 'instalado').length,
    pendente: leads.filter(l => l.status === 'pendente').length,
  }

  return (
    <div className={styles.root}>
      <div className={styles.gridBg} />

      {/* HEADER */}
      <header className={styles.header}>
        <div className={styles.headerOC}>
          <svg width="36" height="40" viewBox="0 0 36 40" fill="none">
            <path d="M18 1L2 7.5v11C2 29 9 38 18 40 27 38 34 29 34 18.5v-11L18 1z" stroke="#00e5ff" strokeWidth="1.5" fill="none"/>
            <line x1="7" y1="15" x2="29" y2="15" stroke="rgba(0,229,255,.25)" strokeWidth=".8"/>
            <line x1="7" y1="20" x2="29" y2="20" stroke="rgba(0,229,255,.25)" strokeWidth=".8"/>
            <line x1="7" y1="25" x2="27" y2="25" stroke="rgba(0,229,255,.25)" strokeWidth=".8"/>
            <line x1="12" y1="9" x2="12" y2="33" stroke="rgba(0,229,255,.25)" strokeWidth=".8"/>
            <line x1="18" y1="7" x2="18" y2="35" stroke="rgba(0,229,255,.25)" strokeWidth=".8"/>
            <line x1="24" y1="9" x2="24" y2="33" stroke="rgba(0,229,255,.25)" strokeWidth=".8"/>
            <line x1="9" y1="20" x2="27" y2="20" stroke="#00e5ff" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="18" y1="11" x2="18" y2="29" stroke="#00e5ff" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="18" cy="20" r="2.5" stroke="#00ff99" strokeWidth="1.2" fill="none"/>
            <circle cx="18" cy="20" r="1" fill="#00ff99"/>
            <circle cx="12" cy="15" r="1.1" fill="rgba(0,229,255,.5)"/>
            <circle cx="24" cy="15" r="1.1" fill="rgba(0,229,255,.5)"/>
            <circle cx="12" cy="25" r="1.1" fill="rgba(0,229,255,.5)"/>
            <circle cx="24" cy="25" r="1.1" fill="rgba(0,229,255,.5)"/>
          </svg>
          <div>
            <div className={styles.ocName}>OneClick Soluções</div>
            <div className={styles.ocSub}>Tecnologia em TI</div>
          </div>
        </div>

        <div className={styles.headerCenter}>
          <div className={styles.aiTag}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00e5ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
            <span className={styles.aiLabel}><em>IA</em> lendo e processando emails em tempo real</span>
            <span className={styles.aiBadge}>⚡ AUTO</span>
          </div>
          <div className={styles.emailLine}>
            pedidosstockfarmasp@gmail.com
          </div>
        </div>

        <div className={styles.headerSF}>
          <div className={styles.sfLogoBox}>
            <svg width="100" height="42" viewBox="0 0 110 46" fill="none">
              <text x="0" y="30" fontFamily="'Impact','Arial Black',sans-serif" fontSize="28" fontWeight="900" fill="#1a5dab" letterSpacing="-2">ST</text>
              <text x="36" y="30" fontFamily="'Impact','Arial Black',sans-serif" fontSize="28" fontWeight="900" fill="#1a5dab" letterSpacing="-2">O</text>
              <circle cx="50" cy="18" r="8" fill="#e8192c"/>
              <text x="60" y="30" fontFamily="'Impact','Arial Black',sans-serif" fontSize="28" fontWeight="900" fill="#1a5dab" letterSpacing="-2">CK</text>
              <text x="30" y="44" fontFamily="'Georgia','Palatino',serif" fontSize="14" fontWeight="700" fill="#e8192c" fontStyle="italic" letterSpacing="1">farma</text>
            </svg>
          </div>
          <div>
            <div className={styles.sfCanal}>canal parceiro</div>
            <div className={styles.sfPortal}>Portal de Instalações</div>
          </div>
        </div>

        <div className={styles.headerRight}>
          <div className={styles.pulseDot} />
          <span className={styles.liveText}>AO VIVO</span>
          <span className={styles.notifBadge}>{counts.novo} novo{counts.novo !== 1 ? 's' : ''}</span>
        </div>
      </header>

      {/* STATS */}
      <div className={styles.stats}>
        {[
          { label: 'Total de Leads', val: counts.total, cls: styles.sc1, sub: 'todos os registros' },
          { label: 'Em Contato', val: counts.contato, cls: styles.sc2, sub: 'aguardando retorno' },
          { label: 'Instalados', val: counts.instalado, cls: styles.sc3, sub: 'sistema em produção' },
          { label: 'Pendentes', val: counts.pendente, cls: styles.sc4, sub: 'sem resposta' },
        ].map(s => (
          <div key={s.label} className={`${styles.statCard} ${s.cls}`}>
            <div className={styles.statBar} />
            <div className={styles.statLabel}>{s.label}</div>
            <div className={styles.statVal}>{s.val}</div>
            <div className={styles.statSub}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* TOOLBAR */}
      <div className={styles.toolbar}>
        {['todos', 'novo', 'contato', 'instalado', 'pendente'].map(f => (
          <button
            key={f}
            className={`${styles.tabBtn} ${filter === f ? styles.tabOn : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'todos' ? 'Todos' : STATUS_LABEL[f as Status]}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <input
          className={styles.search}
          placeholder="Buscar empresa, CNPJ, responsável..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* MAIN AREA */}
      <div className={styles.mainArea}>
        {/* TABLE */}
        <div className={styles.tableWrap}>
          {loading ? (
            <div className={styles.loadingMsg}>Carregando leads...</div>
          ) : filtered.length === 0 ? (
            <div className={styles.loadingMsg}>Nenhum lead encontrado.</div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Chamado</th>
                  <th>Empresa</th>
                  <th>Responsável</th>
                  <th>WhatsApp</th>
                  <th>Recebido</th>
                  <th>Status</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(l => (
                  <tr
                    key={l.id}
                    onClick={() => setSelected(l)}
                    className={selected?.id === l.id ? styles.rowSelected : ''}
                  >
                    <td>
                      <span className={styles.tagPE}>PE</span>
                      <span className={styles.tagId}>{l.chamado_id || l.id.slice(0,8)}</span>
                    </td>
                    <td>
                      <span className={styles.coName}>{l.empresa}</span>
                      <span className={styles.coCnpj}>{l.cnpj}</span>
                    </td>
                    <td className={styles.resp}>{l.responsavel}</td>
                    <td>
                      <a
                        className={styles.waBtn}
                        href={waUrl(l.telefone, l.responsavel, l.empresa)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={e => e.stopPropagation()}
                      >
                        {WA_SVG}
                        {formatPhone(l.telefone)}
                      </a>
                    </td>
                    <td className={styles.date}>{formatDate(l.criado_em)}</td>
                    <td>
                      <span className={`${styles.badge} ${styles['b_' + l.status]}`}>
                        {STATUS_LABEL[l.status]}
                      </span>
                    </td>
                    <td>
                      <button
                        className={styles.detBtn}
                        onClick={e => { e.stopPropagation(); setSelected(l) }}
                      >
                        Detalhes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* DETAIL PANEL */}
        {selected && (
          <div className={styles.detPanel}>
            <div className={styles.detHeader}>
              <div>
                <div className={styles.detCoName}>{selected.empresa}</div>
                <div className={styles.detCnpj}>{selected.cnpj}</div>
                <span className={`${styles.badge} ${styles['b_' + selected.status]}`} style={{ marginTop: 6, display: 'inline-flex' }}>
                  {STATUS_LABEL[selected.status]}
                </span>
              </div>
              <button className={styles.closeBtn} onClick={() => setSelected(null)}>✕</button>
            </div>

            <div className={styles.detDivider} />

            <div className={styles.detSection}>Dados do Chamado</div>
            <div className={styles.detRow}>
              <span className={styles.detLabel}>ID</span>
              <span className={styles.detValCyan}>{selected.chamado_id || selected.id.slice(0,8)}</span>
            </div>
            <div className={styles.detRow}>
              <span className={styles.detLabel}>Responsável</span>
              <span className={styles.detVal}>{selected.responsavel}</span>
            </div>
            <div className={styles.detRow}>
              <span className={styles.detLabel}>Telefone</span>
              <span className={styles.detVal}>{formatPhone(selected.telefone)}</span>
            </div>
            <div className={styles.detRow}>
              <span className={styles.detLabel}>Endereço</span>
              <span className={styles.detVal}>{selected.endereco}</span>
            </div>
            <div className={styles.detRow}>
              <span className={styles.detLabel}>Cidade/Estado</span>
              <span className={styles.detVal}>{selected.cidade}{selected.estado ? ` / ${selected.estado}` : ''}</span>
            </div>
            <div className={styles.detRow}>
              <span className={styles.detLabel}>Recebido</span>
              <span className={styles.detVal}>{formatDate(selected.criado_em)}</span>
            </div>

            <div className={styles.detDivider} />
            <div className={styles.detSection}>Atualizar Status</div>
            <select
              className={styles.sel}
              value={selected.status}
              onChange={e => updateStatus(selected.id, e.target.value as Status)}
            >
              <option value="novo">Novo</option>
              <option value="contato">Em Contato</option>
              <option value="instalado">Instalado</option>
              <option value="pendente">Pendente</option>
            </select>

            <a
              className={styles.waFull}
              href={waUrl(selected.telefone, selected.responsavel, selected.empresa)}
              target="_blank"
              rel="noreferrer"
            >
              {WA_SVG} Abrir WhatsApp
            </a>

            <div className={styles.detDivider} />
            <div className={styles.detSection}>Adicionar Nota</div>
            <textarea
              className={styles.notaInput}
              placeholder="Digite uma anotação sobre este cliente..."
              value={nota}
              onChange={e => setNota(e.target.value)}
              rows={3}
            />
            <button className={styles.notaBtn} onClick={addNota} disabled={saving}>
              {saving ? 'Salvando...' : '+ Registrar Nota'}
            </button>

            <div className={styles.detDivider} />
            <div className={styles.detSection}>Histórico</div>
            <div className={styles.timeline}>
              {chamados.length === 0 && (
                <div className={styles.tlEmpty}>Nenhum registro ainda.</div>
              )}
              {chamados.map((c, i) => (
                <div key={c.id} className={styles.tlItem}>
                  <div className={`${styles.tlDot} ${i === 0 ? styles.tlDotCyan : styles.tlDotGreen}`} />
                  <div className={styles.tlContent}>
                    <span className={styles.tlText}>{c.descricao}</span>
                    <span className={styles.tlDate}>{formatDate(c.criado_em)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <footer className={styles.footer}>
        <span className={styles.ftTxt}>Desenvolvido por</span>
        <span className={styles.ftOC}>OneClick Soluções</span>
        <span className={styles.ftX}>×</span>
        <div className={styles.ftSfBox}>
          <svg width="64" height="20" viewBox="0 0 110 46" fill="none">
            <text x="0" y="30" fontFamily="'Impact','Arial Black',sans-serif" fontSize="28" fontWeight="900" fill="#1a5dab" letterSpacing="-2">ST</text>
            <text x="36" y="30" fontFamily="'Impact','Arial Black',sans-serif" fontSize="28" fontWeight="900" fill="#1a5dab" letterSpacing="-2">O</text>
            <circle cx="50" cy="18" r="8" fill="#e8192c"/>
            <text x="60" y="30" fontFamily="'Impact','Arial Black',sans-serif" fontSize="28" fontWeight="900" fill="#1a5dab" letterSpacing="-2">CK</text>
            <text x="30" y="44" fontFamily="'Georgia','Palatino',serif" fontSize="14" fontWeight="700" fill="#e8192c" fontStyle="italic" letterSpacing="1">farma</text>
          </svg>
        </div>
        <div className={styles.ftPipe} />
        <span className={styles.ftTxt}>Pedido Eletrônico · Canal Parceiro · {new Date().getFullYear()}</span>
      </footer>
    </div>
  )
}
