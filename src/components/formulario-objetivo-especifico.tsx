"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface FormularioObjetivoEspecificoProps {
  onClose: () => void
  editingItem?: any
  defaultOG?: number // Agregar prop para valor por defecto desde navegación
}

export function FormularioObjetivoEspecifico({ onClose, editingItem, defaultOG }: FormularioObjetivoEspecificoProps) {
  const [formData, setFormData] = useState({
    descripcion: "",
    id_og: "",
  })
  const [loading, setLoading] = useState(false)
  const [objetivosGenerales, setObjetivosGenerales] = useState([])
  const [dataLoaded, setDataLoaded] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetch("/api/objetivo-general")
      .then((res) => res.json())
      .then((data) => {
        setObjetivosGenerales(data)
        setDataLoaded(true)

        if (editingItem) {
          console.log("[v0] Cargando datos para editar:", editingItem)
          setFormData({
            descripcion: editingItem.descripcion || "",
            id_og: editingItem.id_og?.toString() || "",
          })
        } else if (defaultOG) {
          setFormData((prev) => ({
            ...prev,
            id_og: defaultOG.toString(),
          }))
        }
      })
      .catch((error) => console.error("[v0] Error loading objetivos generales:", error))
  }, [editingItem, defaultOG])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const method = editingItem ? "PUT" : "POST"
      const body = editingItem ? JSON.stringify({ id_oe: editingItem.id_oe, ...formData }) : JSON.stringify(formData)

      const response = await fetch("/api/objetivo-especifico", {
        method,
        headers: { "Content-Type": "application/json" },
        body,
      })

      if (!response.ok) throw new Error("Error al guardar")

      toast({
        title: "Éxito",
        description: `Objetivo específico ${editingItem ? "actualizado" : "creado"} correctamente`,
      })
      onClose()
    } catch (error) {
      console.error("[v0] Error saving objetivo especifico:", error)
      toast({
        title: "Error",
        description: "No se pudo guardar el objetivo específico",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  if (!dataLoaded) {
    return (
      <Card className="bg-card">
        <div className="p-6">
          <div className="text-center text-muted-foreground">Cargando...</div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="bg-card">
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-foreground">
            {editingItem ? "Editar" : "Nuevo"} Objetivo Específico
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="id_og" className="text-foreground">
              Objetivo General <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.id_og}
              onValueChange={(value) => setFormData({ ...formData, id_og: value })}
              required
            >
              <SelectTrigger className="bg-input border-border text-foreground">
                <SelectValue placeholder="Seleccionar objetivo general" />
              </SelectTrigger>
              <SelectContent>
                {objetivosGenerales.map((og: any) => (
                  <SelectItem key={og.id_og} value={og.id_og.toString()}>
                    {og.descripcion}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion" className="text-foreground">
              Descripción <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="descripcion"
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              required
              maxLength={500}
              rows={4}
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
