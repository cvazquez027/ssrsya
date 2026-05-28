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

interface FormularioProyectoProps {
  onClose: () => void
  editingItem?: any
}

export function FormularioProyecto({ onClose, editingItem }: FormularioProyectoProps) {
  const [formData, setFormData] = useState({
    descripcion: "",
    detalle: "",
    sigla_dependencia: "",
    id_prioridad: "",
    id_estado: "",
    id_referente: "",
  })
  const [loading, setLoading] = useState(false)
  const [dependencias, setDependencias] = useState([])
  const [prioridades, setPrioridades] = useState([])
  const [estados, setEstados] = useState([])
  const [referentes, setReferentes] = useState([])
  const [dataLoaded, setDataLoaded] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    Promise.all([
      fetch("/api/dependencia").then((res) => res.json()),
      fetch("/api/prioridad").then((res) => res.json()),
      fetch("/api/estado").then((res) => res.json()),
      fetch("/api/referente").then((res) => res.json()),
    ])
      .then(([deps, prios, ests, refs]) => {
        setDependencias(deps)
        setPrioridades(prios)
        setEstados(ests)
        setReferentes(refs)
        setDataLoaded(true)

        if (editingItem) {
          console.log("[v0] Cargando datos para editar:", editingItem)
          setFormData({
            descripcion: editingItem.descripcion || "",
            detalle: editingItem.detalle || "",
            sigla_dependencia: editingItem.sigla_dependencia || "",
            id_prioridad: editingItem.id_prioridad?.toString() || "",
            id_estado: editingItem.id_estado?.toString() || "",
            id_referente: editingItem.id_referente?.toString() || "",
          })
        }
      })
      .catch((error) => console.error("[v0] Error loading data:", error))
  }, [editingItem])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const method = editingItem ? "PUT" : "POST"
      const body = editingItem
        ? JSON.stringify({ id_proyecto: editingItem.id_proyecto, ...formData })
        : JSON.stringify(formData)

      const response = await fetch("/api/proyecto", {
        method,
        headers: { "Content-Type": "application/json" },
        body,
      })

      if (!response.ok) throw new Error("Error al guardar")

      toast({
        title: "Éxito",
        description: `Proyecto ${editingItem ? "actualizado" : "creado"} correctamente`,
      })

      setTimeout(() => {
        onClose()
      }, 500)
    } catch (error) {
      console.error("[v0] Error saving proyecto:", error)
      toast({
        title: "Error",
        description: "No se pudo guardar el proyecto",
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
      <div className="p-4 lg:p-6">
        <div className="mb-4 lg:mb-6 flex items-center justify-between">
          <h2 className="text-xl lg:text-2xl font-semibold text-foreground">
            {editingItem ? "Editar" : "Nuevo"} Proyecto
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 lg:space-y-6">
          <div className="space-y-2">
            <Label htmlFor="descripcion" className="text-sm lg:text-base text-foreground">
              Descripción <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="descripcion"
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              required
              maxLength={500}
              rows={4}
              className="bg-input border-border text-foreground text-sm lg:text-base"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="detalle" className="text-sm lg:text-base text-foreground">
              Detalle
            </Label>
            <Textarea
              id="detalle"
              value={formData.detalle}
              onChange={(e) => setFormData({ ...formData, detalle: e.target.value })}
              maxLength={500}
              rows={4}
              className="bg-input border-border text-foreground text-sm lg:text-base"
            />
          </div>

          <div className="grid gap-4 lg:gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sigla_dependencia" className="text-sm lg:text-base text-foreground">
                Dependencia <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.sigla_dependencia}
                onValueChange={(value) => setFormData({ ...formData, sigla_dependencia: value })}
                required
              >
                <SelectTrigger className="bg-input border-border text-foreground text-sm lg:text-base">
                  <SelectValue placeholder="Seleccionar dependencia" />
                </SelectTrigger>
                <SelectContent>
                  {dependencias.map((dep: any) => (
                    <SelectItem key={dep.sigla} value={dep.sigla}>
                      {dep.sigla} - {dep.descripcion}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="id_prioridad" className="text-sm lg:text-base text-foreground">
                Prioridad <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.id_prioridad}
                onValueChange={(value) => setFormData({ ...formData, id_prioridad: value })}
                required
              >
                <SelectTrigger className="bg-input border-border text-foreground text-sm lg:text-base">
                  <SelectValue placeholder="Seleccionar prioridad" />
                </SelectTrigger>
                <SelectContent>
                  {prioridades.map((prioridad: any) => (
                    <SelectItem key={prioridad.id_prioridad} value={prioridad.id_prioridad.toString()}>
                      {prioridad.descripcion}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="id_estado" className="text-sm lg:text-base text-foreground">
                Estado <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.id_estado}
                onValueChange={(value) => setFormData({ ...formData, id_estado: value })}
                required
              >
                <SelectTrigger className="bg-input border-border text-foreground text-sm lg:text-base">
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  {estados.map((estado: any) => (
                    <SelectItem key={estado.id_estado} value={estado.id_estado.toString()}>
                      {estado.descripcion}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="id_referente" className="text-sm lg:text-base text-foreground">
                Referente <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.id_referente}
                onValueChange={(value) => setFormData({ ...formData, id_referente: value })}
                required
              >
                <SelectTrigger className="bg-input border-border text-foreground text-sm lg:text-base">
                  <SelectValue placeholder="Seleccionar referente" />
                </SelectTrigger>
                <SelectContent>
                  {referentes.map((referente: any) => (
                    <SelectItem key={referente.id_referente} value={referente.id_referente.toString()}>
                      {referente.apellido}, {referente.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 lg:gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="w-full sm:w-auto bg-transparent"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto"
              disabled={loading}
            >
              {loading ? "Guardando..." : editingItem ? "Actualizar" : "Guardar"}
            </Button>
          </div>
        </form>
      </div>
    </Card>
  )
}
