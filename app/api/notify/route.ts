import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { empresa, responsavel, telefone, chamado_id } = await req.json()
    const apikey = process.env.CALLMEBOT_APIKEY
    const phone = process.env.CALLMEBOT_PHONE

    if (!apikey || !phone || apikey === 'COLOQUE_SUA_APIKEY_AQUI') {
      return NextResponse.json({ ok: false, msg: 'WhatsApp não configurado' })
    }

    const msg = `🔔 *NOVO LEAD - Pedido Eletrônico*\n\n` +
      `📋 Chamado: *${chamado_id}*\n` +
      `🏪 Empresa: *${empresa}*\n` +
      `👤 Responsável: ${responsavel}\n` +
      `📱 Telefone: ${telefone}\n\n` +
      `👉 Acesse o CRM: https://crm-pedido-eletronico.vercel.app`

    const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(msg)}&apikey=${apikey}`
    const res = await fetch(url)
    const text = await res.text()
    return NextResponse.json({ ok: true, response: text })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) })
  }
}
