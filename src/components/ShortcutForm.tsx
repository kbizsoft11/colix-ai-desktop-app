import { useEffect, useState } from 'react'
import { ShortcutInput } from '../types/shortcut'

interface ShortcutFormProps {
  onSubmit: (data: ShortcutInput) => void
  onCancel?: () => void
  initialData?: ShortcutInput
  isEditing?: boolean
}

const emptyForm: ShortcutInput = { name: '', label: '', content: '' }

export default function ShortcutForm({ onSubmit, onCancel, initialData, isEditing = false }: ShortcutFormProps) {
  const [formData, setFormData] = useState<ShortcutInput>(initialData || emptyForm)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    setFormData(initialData || emptyForm)
    setErrors({})
  }, [initialData])

  const handleChange = (field: keyof ShortcutInput, value: string) => {
    setFormData(previous => ({ ...previous, [field]: value }))
    if (errors[field]) setErrors(previous => ({ ...previous, [field]: '' }))
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const nextErrors: Record<string, string> = {}
    const trigger = formData.name.trim()
    if (!trigger) nextErrors.name = 'Shortcut trigger is required'
    else if (!trigger.startsWith('-') && !trigger.startsWith('@')) nextErrors.name = 'Use - or @ at the start'
    else if (trigger.length < 2) nextErrors.name = 'Add at least one character after the prefix'
    if (!formData.label.trim()) nextErrors.label = 'Label is required'
    if (!formData.content.trim()) nextErrors.content = 'Content is required'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length === 0) onSubmit({ ...formData, name: trigger })
  }

  return (
    <form className="shortcut-form" onSubmit={handleSubmit}>
      <div className="editor-topline">
        <button type="button" className="back-button" onClick={onCancel}>← Back</button>
        <div className="editor-actions">
          <button type="button" className="button button-light" onClick={onCancel}>Cancel</button>
          <button type="submit" className="button button-primary">{isEditing ? 'Save' : 'Create shortcut'}</button>
        </div>
      </div>
      <div className="form-fields">
        <label>
          <span>Label <em>(describes the shortcut)</em></span>
          <input value={formData.label} onChange={event => handleChange('label', event.target.value)} placeholder="e.g. Thank you message" />
          {errors.label && <small className="field-error">{errors.label}</small>}
        </label>
        <label>
          <span>Shortcut <em>(typed to insert)</em></span>
          <input className="trigger-input" value={formData.name} onChange={event => handleChange('name', event.target.value)} placeholder="-ty" />
          {errors.name && <small className="field-error">{errors.name}</small>}
        </label>
        <label className="content-field">
          <span>Expansion text</span>
          <textarea value={formData.content} onChange={event => handleChange('content', event.target.value)} placeholder="Text that will be inserted when the shortcut is typed..." />
          {errors.content && <small className="field-error">{errors.content}</small>}
        </label>
      </div>
    </form>
  )
}
