import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface Task {
  id: string
  title: string
  description: string
  status: 'pending' | 'assigned' | 'in-progress' | 'review' | 'approved' | 'rejected' | 'done'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  assignee?: string
  createdAt: string
  updatedAt: string
  output?: string
  tags: string[]
}

async function api<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', ...opts?.headers } })
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json()
}

export function useTasks(status?: string) {
  return useQuery<Task[]>({
    queryKey: ['tasks', status],
    queryFn: () => api(`/api/tasks${status ? `?status=${status}` : ''}`),
  })
}

export function useTask(id: string) {
  return useQuery<Task>({
    queryKey: ['tasks', id],
    queryFn: () => api(`/api/tasks/${id}`),
  })
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Task>) => api<Task>('/api/tasks', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

export function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Task> & { id: string }) =>
      api<Task>(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api(`/api/tasks/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

export function useApproveTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<Task>(`/api/tasks/${id}/approve`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

export function useRejectTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<Task>(`/api/tasks/${id}/reject`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })
}
