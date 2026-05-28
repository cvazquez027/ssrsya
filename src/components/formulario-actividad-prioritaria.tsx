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

interface FormularioActividadPrioritariaProps {
  onClose: () => void
  editingItem?: any
  defaultOE?: number
}

export function FormularioActividadPrioritaria({
  onClose,
  editingItem,
  defaultOE,
}: FormularioActividadPrioritariaProps) {
  const [formData, setFormData] = useState({
    descripcion: "",
    id_oe: "",
    id_tipo_actividad_prioritaria: "",
  })
  const [loading, setLoading] = useState(false)
  const [objetivosEspecificos, setObjetivosEspecificos] = useState([])
  const [tiposActividad, setTiposActividad] = useState([])
  const [dataLoaded, setDataLoaded] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    Promise.all([fetch("/api/objetivo-especifico"), fetch("/api/tipo-actividad-prioritaria")])
      .then(([resOE, resTipo]) => Promise.all([resOE.json(), resTipo.json()]))
      .then(([dataOE, dataTipo]) => {
        setObjetivosEspecificos(dataOE)
        setTiposActividad(dataTipo)
        setDataLoaded(true)

        if (editingItem) {
          console.log("[v0] Cargando datos para editar:", editingItem)
          setFormData({
            descripcion: editingItem.descripcion || "",
            id_oe: editingItem.id_oe?.toString() || "",
            id_tipo_actividad_prioritaria: editingItem.id_tipo_actividad_prioritaria?.toString() || "",
          })
        } else if (defaultOE) {
          setFormData((prev) => ({
            ...prev,
            id_oe: defaultOE.toString(),
          }))
        }
      })
      .catch((error) => console.error("[v0] Error loading data:", error))
  }, [editingItem, defaultOE])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const method = editingItem ? "PUT" : "POST"
      const body = editingItem
        ? JSON.stringify({ id_actividad: editingItem.id_actividad, ...formData })
        : JSON.stringify(formData)

      const response = await fetch("/api/actividad", {
        method,
        headers: { "Content-Type": "application/json" },
        body,
      })

      if (!response.ok) throw new Error("Error al guardar")

      toast({
        title: "Éxito",
        description: `Actividad prioritaria ${editingItem ? "actualizada" : "creada"} correctamente`,
      })
      onClose()
    } catch (error) {
      console.error("[v0] Error saving actividad:", error)
      toast({
        title: "Error",
        description: "No se pudo guardar la actividad prioritaria",
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
            {editingItem ? "Editar" : "Nueva"} Actividad Prioritaria
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="id_oe" className="text-foreground">
                Objetivo Específico <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.id_oe}
                onValueChange={(value) => setFormData({ ...formData, id_oe: value })}
                required
              >
                <SelectTrigger className="bg-input border-border text-foreground">
                  <SelectValue placeholder="Seleccionar objetivo específico" />
                </SelectTrigger>
                <SelectContent>
                  {objetivosEspecificos.map((oe: any) => (
                    <SelectItem key={oe.id_oe} value={oe.id_oe.toString()}>
                      {oe.descripcion}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="id_tipo_actividad_prioritaria" className="text-foreground">
                Tipo de Actividad <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.id_tipo_actividad_prioritaria}
                onValueChange={(value) => setFormData({ ...formData, id_tipo_actividad_prioritaria: value })}
                required
              >
                <SelectTrigger className="bg-input border-border text-foreground">
                  <SelectValue placeholder="Seleccionar tipo de actividad" />
                </SelectTrigger>
                <SelectContent>
                  {tiposActividad.map((tipo: any) => (
                    <SelectItem
                      key={tipo.id_tipo_actividad_prioritaria}
                      value={tipo.id_tipo_actividad_prioritaria.toString()}
                    >
                      {tipo.descripcion}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
