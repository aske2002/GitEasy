import { useEffect } from 'react'
import { useRepoStore } from './store/repoStore'
import { AppShell } from './components/Layout/AppShell'
import { WelcomeScreen } from './components/Layout/WelcomeScreen'
import { OperationDialog } from './components/Modals/OperationDialog'

export default function App() {
  const { repoPath, refresh, loadRecentRepos, openRepo } = useRepoStore()

  useEffect(() => {
    loadRecentRepos()

    const offChanged = window.git.onRepoChanged(() => refresh())
    const offOpen = window.git.onOpenRepo(() => openRepo())
    return () => { offChanged(); offOpen() }
  }, [])

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--color-bg-base)' }}>
      {repoPath ? <AppShell /> : <WelcomeScreen />}
      <OperationDialog />
    </div>
  )
}
