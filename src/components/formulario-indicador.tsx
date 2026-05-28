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

interface FormularioIndicadorProps {
  onClose: () => void
  editingItem?: any
  defaultActividad?: number // Agregar prop para valor por defecto
}

export function FormularioIndicador({ onClose, editingItem, defaultActividad }: FormularioIndicadorProps) {
  const [formData, setFormData] = useState({
    nombre: "",
    construccion: "",
    id_tipo_indicador: "",
    id_otro_sistema: "",
    fuente: "",
    linea_base: "",
    meta_anio1: "",
    meta_anio2: "",
    id_actividad: "",
    meta_anio3: "0",
    meta_anio4: "0",
  })
  const [loading, setLoading] = useState(false)
  const [tiposIndicador, setTiposIndicador] = useState([])
  const [otrosSistemas, setOtrosSistemas] = useState([])
  const [actividades, setActividades] = useState([]) // Agregar estado para actividades
  const [dataLoaded, setDataLoaded] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    Promise.all([
      fetch("/api/tipo-indicador").then((res) => res.json()),
      fetch("/api/otro-sistema").then((res) => res.json()),
      fetch("/api/actividad").then((res) => res.json()), // Cargar también las actividades desde la API
    ])
      .then(([tipos, sistemas, acts]) => {
        setTiposIndicador(tipos)
        setOtrosSistemas(sistemas)
        setActividades(acts)
        setDataLoaded(true)

        if (editingItem) {
          console.log("[v0] Cargando datos para editar:", editingItem)
          setFormData({
            nombre: editingItem.nombre || "",
            construccion: editingItem.construccion || "",
            id_tipo_indicador: editingItem.id_tipo_indicador?.toString() || "",
            id_otro_sistema: editingItem.id_otro_sistema?.toString() || "",
            fuente: editingItem.fuente || "",
            linea_base: editingItem.linea_base || "",
            meta_anio1: editingItem.meta_anio1 || "",
            meta_anio2: editingItem.meta_anio2 || "",
            id_actividad: editingItem.id_actividad?.toString() || "",
            meta_anio3: editingItem.meta_anio3?.toString() || "0",
            meta_anio4: editingItem.meta_anio4?.toString() || "0",
          })
        } else if (defaultActividad) {
          setFormData((prev) => ({
            ...prev,
            id_actividad: defaultActividad.toString(),
          }))
        }
      })
      .catch((error) => console.error("[v0] Error loading data:", error))
  }, [editingItem, defaultActividad])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const method = editingItem ? "PUT" : "POST"
      const bodyData = {
        ...formData,
      }

      const body = editingItem
        ? JSON.stringify({ id_indicador: editingItem.id_indicador, ...bodyData })
        : JSON.stringify(bodyData)

      console.log("[v0] Enviando datos:", bodyData)

      const response = await fetch("/api/indicador", {
        method,
        headers: { "Content-Type": "application/json" },
        body,
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error("[v0] Error response:", errorData)
        throw new Error("Error al guardar")
      }

      toast({
        title: "Éxito",
        description: `Indicador ${editingItem ? "actualizado" : "creado"} correctamente`,
      })
      onClose()
    } catch (error) {
      console.error("[v0] Error saving indicador:", error)
      toast({
        title: "Error",
        description: "No se pudo guardar el indicador",
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
          <h2 className="text-2xl font-semibold text-foreground">{editingItem ? "Editar" : "Nuevo"} Indicador</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="id_tipo_indicador" className="text-foreground">
                Tipo de Indicador <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.id_tipo_indicador}
                onValueChange={(value) => setFormData({ ...formData, id_tipo_indicador: value })}
                required
              >
                <SelectTrigger className="bg-input border-border text-foreground">
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {tiposIndicador.map((tipo: any) => (
                    <SelectItem key={tipo.id_tipo_indicador} value={tipo.id_tipo_indicador.toString()}>
                      {tipo.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nombre" className="text-foreground">
                Nombre <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nombre"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                required
                maxLength={500}
                className="bg-input border-border text-foreground"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="construccion" className="text-foreground">
                Construcción <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="construccion"
                value={formData.construccion}
                onChange={(e) => setFormData({ ...formData, construccion: e.target.value })}
                required
                maxLength={500}
                rows={3}
                className="bg-input border-border text-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="id_otro_sistema" className="text-foreground">
                Otro Sistema <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.id_otro_sistema}
                onValueChange={(value) => setFormData({ ...formData, id_otro_sistema: value })}
                required
              >
                <SelectTrigger className="bg-input border-border text-foreground">
                  <SelectValue placeholder="Seleccionar sistema" />
                </SelectTrigger>
                <SelectContent>
                  {otrosSistemas.map((sistema: any) => (
                    <SelectItem key={sistema.id_otro_sistema} value={sistema.id_otro_sistema.toString()}>
                      {sistema.descripcion}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fuente" className="text-foreground">
                Fuente <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fuente"
                value={formData.fuente}
                onChange={(e) => setFormData({ ...formData, fuente: e.target.value })}
                required
                maxLength={250}
                className="bg-input border-border text-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="linea_base" className="text-foreground">
                Línea Base <span className="text-destructive">*</span>
              </Label>
              <Input
                id="linea_base"
                value={formData.linea_base}
                onChange={(e) => setFormData({ ...formData, linea_base: e.target.value })}
                required
                maxLength={250}
                className="bg-input border-border text-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="id_actividad" className="text-foreground">
                Actividad <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.id_actividad}
                onValueChange={(value) => setFormData({ ...formData, id_actividad: value })}
                required
              >
                <SelectTrigger className="bg-input border-border text-foreground">
                  <SelectValue placeholder="Seleccionar actividad" />
                </SelectTrigger>
                <SelectContent>
                  {actividades.map((actividad: any) => (
                    <SelectItem key={actividad.id_actividad} value={actividad.id_actividad.toString()}>
                      {actividad.descripcion}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4 border-t border-border pt-6">
            <h3 className="text-lg font-semibold text-foreground">Metas Anuales</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="meta_anio1" className="text-foreground">
                  Meta 2026
                </Label>
                <Input
                  id="meta_anio1"
                  value={formData.meta_anio1}
                  onChange={(e) => setFormData({ ...formData, meta_anio1: e.target.value })}
                  maxLength={250}
                  className="bg-input border-border text-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="meta_anio2" className="text-foreground">
                  Meta 2027
                </Label>
                <Input
                  id="meta_anio2"
                  value={formData.meta_anio2}
                  onChange={(e) => setFormData({ ...formData, meta_anio2: e.target.value })}
                  maxLength={250}
                  className="bg-input border-border text-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="meta_anio3" className="text-foreground">
                  Meta 2028
                </Label>
                <Input
                  id="meta_anio3"
                  value={formData.meta_anio3}
                  onChange={(e) => setFormData({ ...formData, meta_anio3: e.target.value })}
                  maxLength={250}
                  className="bg-input border-border text-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="meta_anio4" className="text-foreground">
                  Meta 2029
                </Label>
                <Input
                  id="meta_anio4"
                  value={formData.meta_anio4}
                  onChange={(e) => setFormData({ ...formData, meta_anio4: e.target.value })}
                  maxLength={250}
                  className="bg-input border-border text-foreground"
                />
              </div>
            </div>
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
