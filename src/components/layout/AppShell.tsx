import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { useStore } from '@/store/useStore'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { Toaster } from '@/components/ui/Toaster'

export default function AppShell() {
  const theme = useStore(s => s.theme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
      <Toaster />
    </div>
  )
}
