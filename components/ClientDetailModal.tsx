'use client'

import { useEffect, useState } from 'react'
import { X, Save, Calendar, Phone, FileText, Plus, CheckCircle2, Circle, Loader2 } from 'lucide-react'
import { Client } from '@/lib/types'

interface ClientDetailModalProps {
  client: Client | null
  isOpen: boolean
  onClose: () => void
  onSave: (client: Client) => Promise<void>
}

interface TodoItem {
  id: string
  title: string
  status: string | null
  priority: string | null
  todoFlag: boolean
}

export default function ClientDetailModal({
  client,
  isOpen,
  onClose,
  onSave,
}: ClientDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState<Client | null>(client)

  const [todos, setTodos] = useState<TodoItem[]>([])
  const [todosLoading, setTodosLoading] = useState(false)
  const [todosError, setTodosError] = useState<string | null>(null)
  const [newTodoTitle, setNewTodoTitle] = useState('')
  const [newTodoPriority, setNewTodoPriority] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  useEffect(() => {
    setFormData(client)
  }, [client])

  useEffect(() => {
    if (!isOpen || !client?.id) return
    let cancelled = false
    const load = async () => {
      setTodosLoading(true)
      setTodosError(null)
      try {
        const res = await fetch(`/api/clients/${client.
