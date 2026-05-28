"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface FormularioPrioridadProps {
  onClose: () => void
  editingItem?: any
}

export function FormularioPrioridad({ onClose, editingItem }: FormularioPrioridadProps) {
  const [descripcion, setDescripcion] = useState("")
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (editingItem) {
      setDescripcion(editingItem.descripcion || "")
    }
  }, [editingItem])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const method = editingItem ? "PUT" : "POST"
      const body = editingItem
        ? JSON.stringify({ id_prioridad: editingItem.id_prioridad, descripcion })
        : JSON.stringify({ descripcion })

      const response = await fetch("/api/prioridad", {
        method,
        headers: { "Content-Type": "application/json" },
        body,
      })

      if (!response.ok) throw new Error("Error al guardar")

      toast({
        title: "Éxito",
        description: `Prioridad ${editingItem ? "actualizada" : "creada"} correctamente`,
      })
      onClose()
    } catch (error) {
      console.error("[v0] Error saving prioridad:", error)
      toast({
        title: "Error",
        description: "No se pudo guardar la prioridad",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="bg-card">
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-foreground">{editingItem ? "Editar" : "Nueva"} Prioridad</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="descripcion" className="text-foreground">
              Descripción <span className="text-destructive">*</span>
            </Label>
            <Input
              id="descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              required
              maxLength={20}
              className="bg-input border-border text-foreground"
            />
          </div>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={loading}>
              {loading ? "Guardando..." : editingItem ? "Actualizar" : "Guardar"}
            </Button>
          </div>
        </form>
      </div>
    </Card>
  )
}
