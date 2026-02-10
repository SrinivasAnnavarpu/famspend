import './globals.css'
import type { Metadata, Viewport } from 'next'
import { ToastProvider } from '@/components/ToastProvider'

export const metadata: Metadata = {
  title: 'FamSpend',
  description: 'Family expense tracker',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
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
