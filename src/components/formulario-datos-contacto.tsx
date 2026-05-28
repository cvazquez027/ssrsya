"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface FormularioDatosContactoProps {
  onClose: () => void
  editingItem?: any
  userRole?: string
  userSigla?: string
}

export function FormularioDatosContacto({ onClose, editingItem, userRole, userSigla }: FormularioDatosContactoProps) {
  const [formData, setFormData] = useState({
    telefono: "",
    correo_electronico: "",
    direccion: "",
    id_referente: "",
    vigente: true,
  })
  const [loading, setLoading] = useState(false)
  const [referentes, setReferentes] = useState([])
  const [dataLoaded, setDataLoaded] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetch("/api/referente")
      .then((res) => res.json())
      .then((data) => {
        const filteredReferentes = userRole === "carga" ? data.filter((ref: any) => ref.sigla === userSigla) : data
        setReferentes(filteredReferentes)
        setDataLoaded(true)

        if (editingItem) {
          console.log("[v0] Cargando datos para editar:", editingItem)
          setFormData({
            telefono: editingItem.telefono || "",
            correo_electronico: editingItem.correo_electronico || "",
            direccion: editingItem.direccion || "",
            id_referente: editingItem.id_referente?.toString() || "",
            vigente: editingItem.vigente === 1 || editingItem.vigente === true,
          })
        }
      })
      .catch((error) => console.error("[v0] Error loading referentes:", error))
  }, [editingItem, userRole, userSigla])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const method = editingItem ? "PUT" : "POST"
      const body = editingItem
        ? JSON.stringify({
            id_datos_contacto: editingItem.id_datos_contacto,
            ...formData,
            vigente: formData.vigente ? 1 : 0,
          })
        : JSON.stringify({ ...formData, vigente: formData.vigente ? 1 : 0 })

      const response = await fetch("/api/datos-contacto", {
        method,
        headers: { "Content-Type": "application/json" },
        body,
      })

      if (!response.ok) throw new Error("Error al guardar")

      toast({
        title: "Éxito",
        description: `Datos de contacto ${editingItem ? "actualizados" : "creados"} correctamente`,
      })
      onClose()
    } catch (error) {
      console.error("[v0] Error saving datos contacto:", error)
      toast({
        title: "Error",
        description: "No se pudieron guardar los datos de contacto",
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
            {editingItem ? "Editar" : "Nuevos"} Datos de Contacto
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="id_referente" className="text-foreground">
                Referente <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.id_referente}
                onValueChange={(value) => setFormData({ ...formData, id_referente: value })}
                required
              >
                <SelectTrigger className="bg-input border-border text-foreground">
                  <SelectValue placeholder="Seleccionar referente" />
                </SelectTrigger>
                <SelectContent>
                  {referentes.map((ref: any) => (
                    <SelectItem key={ref.id_referente} value={ref.id_referente.toString()}>
                      {ref.apellido}, {ref.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefono" className="text-foreground">
                Teléfono
              </Label>
              <Input
                id="telefono"
                type="tel"
                value={formData.telefono}
                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                maxLength={20}
                className="bg-input border-border text-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="correo_electronico" className="text-foreground">
                Correo Electrónico
              </Label>
              <Input
                id="correo_electronico"
                type="email"
                value={formData.correo_electronico}
                onChange={(e) => setFormData({ ...formData, correo_electronico: e.target.value })}
                maxLength={200}
                className="bg-input border-border text-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="direccion" className="text-foreground">
                Dirección
              </Label>
              <Input
                id="direccion"
                value={formData.direccion}
                onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                maxLength={200}
                className="bg-input border-border text-foreground"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="vigente"
                checked={formData.vigente}
                onCheckedChange={(checked) => setFormData({ ...formData, vigente: checked })}
              />
              <Label htmlFor="vigente" className="text-foreground">
                Vigente <span className="text-destructive">*</span>
              </Label>
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
