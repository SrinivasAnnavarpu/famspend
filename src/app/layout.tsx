import './globals.css'
import type { Metadata } from 'next'
import { ToastProvider } from '@/components/ToastProvider'

export const metadata: Metadata = {
  title: 'FamSpend',
  description: 'Family expense tracker',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}
