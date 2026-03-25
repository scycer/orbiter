import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import TaskList from './pages/TaskList'
import TaskDetail from './pages/TaskDetail'
import Status from './pages/Status'
import Spec from './pages/Spec'
import Draw from './pages/Draw'
import CommandPalette from './components/CommandPalette'
import { useSSE } from './lib/useSSE'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5000, retry: 1 } },
})

function AppInner() {
  useSSE()

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/tasks" element={<TaskList />} />
            <Route path="/tasks/:id" element={<TaskDetail />} />
            <Route path="/status" element={<Status />} />
            <Route path="/spec" element={<Spec />} />
            <Route path="/draw" element={<Draw />} />
          </Route>
        </Routes>
        <CommandPalette />
      </BrowserRouter>
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: { background: '#16161e', border: '1px solid #2a2a3a', color: '#e0e0e0' },
        }}
      />
    </>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppInner />
    </QueryClientProvider>
  )
}
