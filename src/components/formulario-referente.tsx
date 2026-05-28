"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { validarCuil } from "@/lib/validar-cuil"

interface FormularioReferenteProps {
  onClose: () => void
  editingItem?: any
  userRole?: string
  userSigla?: string
}

export function FormularioReferente({ onClose, editingItem, userRole, userSigla }: FormularioReferenteProps) {
  const [formData, setFormData] = useState({
    cuil: "",
    apellido: "",
    nombre: "",
    sigla: "",
  })
  const [loading, setLoading] = useState(false)
  const [dependencias, setDependencias] = useState([])
  const [dataLoaded, setDataLoaded] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetch("/api/dependencia")
      .then((res) => res.json())
      .then((data) => {
        setDependencias(data)
        setDataLoaded(true)

        if (editingItem) {
          console.log("[v0] Cargando datos para editar:", editingItem)
          setFormData({
            cuil: editingItem.cuil || "",
            apellido: editingItem.apellido || "",
            nombre: editingItem.nombre || "",
            sigla: editingItem.sigla || "",
          })
        } else if (userRole === "carga" && userSigla) {
          setFormData((prev) => ({
            ...prev,
            sigla: userSigla,
          }))
        }
      })
      .catch((error) => console.error("[v0] Error loading dependencias:", error))
  }, [editingItem, userRole, userSigla])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validarCuil(formData.cuil)) {
      toast({
        title: "Error de validación",
        description: "El CUIL ingresado no es válido",
        variant: "destructive",
      })
      return
    }

    setLoading(true)

    try {
      const method = editingItem ? "PUT" : "POST"
      const body = editingItem
        ? JSON.stringify({ id_referente: editingItem.id_referente, ...formData })
        : JSON.stringify(formData)

      const response = await fetch("/api/referente", {
        method,
        headers: { "Content-Type": "application/json" },
        body,
      })

      if (!response.ok) throw new Error("Error al guardar")

      toast({
        title: "Éxito",
        description: `Referente ${editingItem ? "actualizado" : "creado"} correctamente`,
      })
      onClose()
    } catch (error) {
      console.error("[v0] Error saving referente:", error)
      toast({
        title: "Error",
        description: "No se pudo guardar el referente",
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
          <h2 className="text-2xl font-semibold text-foreground">{editingItem ? "Editar" : "Nuevo"} Referente</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cuil" className="text-foreground">
                CUIL <span className="text-destructive">*</span>
              </Label>
              <Input
                id="cuil"
                type="text"
                value={formData.cuil}
                onChange={(e) => setFormData({ ...formData, cuil: e.target.value })}
                required
                maxLength={11}
                className="bg-input border-border text-foreground"
                placeholder="20123456789"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="apellido" className="text-foreground">
                Apellido <span className="text-destructive">*</span>
              </Label>
              <Input
                id="apellido"
                value={formData.apellido}
                onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                required
                maxLength={50}
                className="bg-input border-border text-foreground"
              />
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
                maxLength={50}
                className="bg-input border-border text-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sigla" className="text-foreground">
                Dependencia <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.sigla}
                onValueChange={(value) => setFormData({ ...formData, sigla: value })}
                disabled={userRole === "carga"}
              >
                <SelectTrigger className="bg-input border-border text-foreground">
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
