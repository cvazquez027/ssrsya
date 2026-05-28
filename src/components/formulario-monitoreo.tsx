"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface FormularioMonitoreoProps {
  onClose: () => void
  editingItem?: any
  defaultIndicador?: number
}

export function FormularioMonitoreo({ onClose, editingItem, defaultIndicador }: FormularioMonitoreoProps) {
  const [formData, setFormData] = useState({
    id_periodo_monitoreo: "",
    meta_propuesta: "",
    meta_alcanzada: "",
    detalle_meta_alcanzada: "",
    observaciones: "",
    id_indicador: "",
  })
  const [loading, setLoading] = useState(false)
  const [indicadores, setIndicadores] = useState([])
  const [periodos, setPeriodos] = useState([])
  const [dataLoaded, setDataLoaded] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    Promise.all([
      fetch("/api/indicador").then((res) => res.json()),
      fetch("/api/periodo-monitoreo").then((res) => res.json()),
    ])
      .then(([indicadoresData, periodosData]) => {
        setIndicadores(indicadoresData)
        setPeriodos(periodosData)
        setDataLoaded(true)

        if (editingItem) {
          console.log("[v0] Cargando datos para editar:", editingItem)
          setFormData({
            id_periodo_monitoreo: editingItem.id_periodo_monitoreo?.toString() || "",
            meta_propuesta: editingItem.meta_propuesta || "",
            meta_alcanzada: editingItem.meta_alcanzada || "",
            detalle_meta_alcanzada: editingItem.detalle_meta_alcanzada || "",
            observaciones: editingItem.observaciones || "",
            id_indicador: editingItem.id_indicador?.toString() || "",
          })
        } else if (defaultIndicador) {
          setFormData((prev) => ({
            ...prev,
            id_indicador: defaultIndicador.toString(),
          }))
        }
      })
      .catch((error) => console.error("[v0] Error loading data:", error))
  }, [editingItem, defaultIndicador])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const method = editingItem ? "PUT" : "POST"
      const body = editingItem
        ? JSON.stringify({ id_monitoreo: editingItem.id_monitoreo, ...formData })
        : JSON.stringify(formData)

      const response = await fetch("/api/monitoreo", {
        method,
        headers: { "Content-Type": "application/json" },
        body,
      })

      if (!response.ok) throw new Error("Error al guardar")

      toast({
        title: "Éxito",
        description: `Monitoreo ${editingItem ? "actualizado" : "creado"} correctamente`,
      })
      onClose()
    } catch (error) {
      console.error("[v0] Error saving monitoreo:", error)
      toast({
        title: "Error",
        description: "No se pudo guardar el monitoreo",
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
          <h2 className="text-2xl font-semibold text-foreground">{editingItem ? "Editar" : "Nuevo"} Monitoreo</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="id_indicador" className="text-foreground">
              Indicador <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.id_indicador}
              onValueChange={(value) => setFormData({ ...formData, id_indicador: value })}
              required
            >
              <SelectTrigger className="bg-input border-border text-foreground">
                <SelectValue placeholder="Seleccionar indicador" />
              </SelectTrigger>
              <SelectContent>
                {indicadores.map((indicador: any) => (
                  <SelectItem key={indicador.id_indicador} value={indicador.id_indicador.toString()}>
                    {indicador.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="id_periodo_monitoreo" className="text-foreground">
              Período de Monitoreo <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.id_periodo_monitoreo}
              onValueChange={(value) => setFormData({ ...formData, id_periodo_monitoreo: value })}
              required
            >
              <SelectTrigger className="bg-input border-border text-foreground">
                <SelectValue placeholder="Seleccionar período" />
              </SelectTrigger>
              <SelectContent>
                {periodos.map((periodo: any) => (
                  <SelectItem key={periodo.id_periodo_monitoreo} value={periodo.id_periodo_monitoreo.toString()}>
                    {periodo.descripcion}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="meta_propuesta" className="text-foreground">
                Meta Propuesta <span className="text-destructive">*</span>
              </Label>
              <Input
                id="meta_propuesta"
                value={formData.meta_propuesta}
                onChange={(e) => setFormData({ ...formData, meta_propuesta: e.target.value })}
                required
                maxLength={250}
                className="bg-input border-border text-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="meta_alcanzada" className="text-foreground">
                Meta Alcanzada <span className="text-destructive">*</span>
              </Label>
              <Input
                id="meta_alcanzada"
                value={formData.meta_alcanzada}
                onChange={(e) => setFormData({ ...formData, meta_alcanzada: e.target.value })}
                required
                maxLength={250}
                className="bg-input border-border text-foreground"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="detalle_meta_alcanzada" className="text-foreground">
              Detalle Meta Alcanzada
            </Label>
            <Textarea
              id="detalle_meta_alcanzada"
              value={formData.detalle_meta_alcanzada}
              onChange={(e) => setFormData({ ...formData, detalle_meta_alcanzada: e.target.value })}
              maxLength={500}
              rows={3}
              className="bg-input border-border text-foreground"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="observaciones" className="text-foreground">
              Observaciones
            </Label>
            <Textarea
              id="observaciones"
              value={formData.observaciones}
              onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
              maxLength={500}
              rows={3}
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
