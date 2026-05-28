"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface FormularioDependenciaProps {
  onClose: () => void
  editingItem?: any
  userRole?: string
  userSigla?: string
}

export function FormularioDependencia({ onClose, editingItem, userRole, userSigla }: FormularioDependenciaProps) {
  const [formData, setFormData] = useState({
    sigla: "",
    descripcion: "",
    vigente: true,
    id_referente: "",
    sigla_superior: "",
  })
  const [loading, setLoading] = useState(false)
  const [referentes, setReferentes] = useState<any[]>([])
  const [dependencias, setDependencias] = useState<any[]>([])
  const { toast } = useToast()

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log("[v0] Cargando referentes y dependencias...")
        const [refResponse, depResponse] = await Promise.all([fetch("/api/referente"), fetch("/api/dependencia")])

        if (refResponse.ok) {
          const refData = await refResponse.json()
          console.log("[v0] Referentes cargados:", refData)
          setReferentes(Array.isArray(refData) ? refData : [])
        }

        if (depResponse.ok) {
          const depData = await depResponse.json()
          console.log("[v0] Dependencias cargadas:", depData)
          setDependencias(Array.isArray(depData) ? depData : [])
        }
      } catch (error) {
        console.error("[v0] Error loading data:", error)
      }
    }
    fetchData()
  }, [])

  useEffect(() => {
    if (editingItem) {
      console.log("[v0] Cargando editingItem:", editingItem)
      const newFormData = {
        sigla: editingItem.sigla || "",
        descripcion: editingItem.descripcion || "",
        vigente: editingItem.vigente === 1 || editingItem.vigente === "Sí" || editingItem.vigente === true,
        id_referente: editingItem.id_referente ? String(editingItem.id_referente) : "",
        sigla_superior: editingItem.sigla_superior || "",
      }
      console.log("[v0] Seteando formData:", newFormData)
      setFormData(newFormData)
    } else if (userRole === "carga" && userSigla) {
      console.log("[v0] Usuario con rol carga, seteando sigla_superior:", userSigla)
      setFormData((prev) => ({
        ...prev,
        sigla_superior: userSigla,
      }))
    }
  }, [editingItem, userRole, userSigla, referentes, dependencias])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const method = editingItem ? "PUT" : "POST"
      const body = {
        ...formData,
        vigente: formData.vigente,
        id_referente: Number.parseInt(formData.id_referente),
        sigla_superior: formData.sigla_superior,
      }

      console.log("[v0] Enviando datos:", body)

      const response = await fetch("/api/dependencia", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!response.ok) throw new Error("Error al guardar")

      toast({
        title: "Éxito",
        description: `Dependencia ${editingItem ? "actualizada" : "creada"} correctamente`,
      })

      onClose()
    } catch (error) {
      console.error("[v0] Error saving dependencia:", error)
      toast({
        title: "Error",
        description: "No se pudo guardar la dependencia",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="bg-card">
      <div className="p-4 lg:p-6">
        <div className="mb-4 lg:mb-6 flex items-center justify-between">
          <h2 className="text-xl lg:text-2xl font-semibold text-foreground">
            {editingItem ? "Editar" : "Nueva"} Dependencia
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 lg:space-y-6">
          <div className="grid gap-4 lg:gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sigla" className="text-foreground">
                Sigla <span className="text-destructive">*</span>
              </Label>
              <Input
                id="sigla"
                value={formData.sigla}
                onChange={(e) => setFormData({ ...formData, sigla: e.target.value })}
                required
                maxLength={10}
                disabled={!!editingItem}
                className="bg-input border-border text-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="descripcion" className="text-foreground">
                Descripción <span className="text-destructive">*</span>
              </Label>
              <Input
                id="descripcion"
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                required
                maxLength={250}
                className="bg-input border-border text-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="id_referente" className="text-foreground">
                Referente a Cargo <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.id_referente}
                onValueChange={(value) => setFormData({ ...formData, id_referente: value })}
                required
              >
                <SelectTrigger className="bg-input border-border text-foreground">
                  <SelectValue placeholder="Seleccione un referente" />
                </SelectTrigger>
                <SelectContent>
                  {referentes.map((ref) => (
                    <SelectItem key={ref.id_referente} value={String(ref.id_referente)}>
                      {ref.apellido}, {ref.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sigla_superior" className="text-foreground">
                Dependencia Superior <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.sigla_superior}
                onValueChange={(value) => setFormData({ ...formData, sigla_superior: value })}
                required
                disabled={userRole === "carga"}
              >
                <SelectTrigger className="bg-input border-border text-foreground">
                  <SelectValue placeholder="Seleccione dependencia superior" />
                </SelectTrigger>
                <SelectContent>
                  {dependencias
                    .filter((dep) => dep.sigla !== formData.sigla)
                    .map((dep) => (
                      <SelectItem key={dep.sigla} value={dep.sigla}>
                        {dep.sigla} - {dep.descripcion}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
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

          <div className="flex flex-col sm:flex-row justify-end gap-2 lg:gap-4">
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
