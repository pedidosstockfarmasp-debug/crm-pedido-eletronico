import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CRM Pedido Eletrônico | OneClick × Stock Farma',
  description: 'Portal de gestão de instalações — Canal Parceiro Stock Farma',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
