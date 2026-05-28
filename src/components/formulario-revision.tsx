"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface FormularioRevisionProps {
  onClose: () => void
  editingItem?: any
  respondiendo?: any
  userDependencia: string
  idTabla?: string
  idPk?: string
  editandoComentario?: any
  comentarioAsociado?: any
}

export function FormularioRevision({
  onClose,
  editingItem,
  respondiendo,
  userDependencia,
  idTabla,
  idPk,
  editandoComentario,
  comentarioAsociado,
}: FormularioRevisionProps) {
  const [formData, setFormData] = useState({
    id_tabla_revisada: comentarioAsociado ? comentarioAsociado.id_tabla_revisada : idTabla || "",
    id_pk_tabla_revisada: comentarioAsociado ? comentarioAsociado.id_pk_tabla_revisada : idPk || "",
    comentario_ssrsya: "",
    respuesta_dependencia: "",
  })
  const [userId, setUserId] = useState<number | null>(null)
  const [userRol, setUserRol] = useState<string>("")
  const { toast } = useToast()

  useEffect(() => {
    const fetchData = async () => {
      const userResponse = await fetch("/api/usuario")
      const userData = await userResponse.json()

      if (userData.id_usuario) {
        setUserId(userData.id_usuario)
        setUserRol(userData.rol || "")
      }

      if (editingItem) {
        setFormData({
          id_tabla_revisada: String(editingItem.id_tabla_revisada),
          id_pk_tabla_revisada: String(editingItem.id_pk_tabla_revisada),
          comentario_ssrsya: editingItem.comentario_ssrsya || "",
          respuesta_dependencia: editingItem.respuesta_dependencia || "",
        })
      } else if (respondiendo) {
        setFormData({
          id_tabla_revisada: String(respondiendo.id_tabla_revisada),
          id_pk_tabla_revisada: String(respondiendo.id_pk_tabla_revisada),
          comentario_ssrsya: respondiendo.comentario_ssrsya || "",
          respuesta_dependencia: "",
        })
      } else if (editandoComentario) {
        setFormData({
          id_tabla_revisada: String(editandoComentario.id_tabla_revisada),
          id_pk_tabla_revisada: String(editandoComentario.id_pk_tabla_revisada),
          comentario_ssrsya: editandoComentario.comentario_ssrsya || "",
          respuesta_dependencia: "",
        })
      }
    }
    fetchData()
  }, [editingItem, respondiendo, editandoComentario])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!userId) {
      toast({
        title: "Error",
        description: "No se pudo obtener el usuario",
        variant: "destructive",
      })
      return
    }

    const rolesPermitidos = ["admin", "carga", "cargafull"]

    if ((!respondiendo && !editingItem && !editandoComentario) || comentarioAsociado) {
      if (userDependencia !== "SSRSYA" || !rolesPermitidos.includes(userRol)) {
        toast({
          title: "No autorizado",
          description:
            "Solo usuarios con rol admin, carga o cargafull de la dependencia SSRSYA pueden crear comentarios",
          variant: "destructive",
        })
        return
      }
    }

    try {
      let response

      if (respondiendo && userDependencia !== "SSRSYA") {
        console.log("[v0] Dependencia respondiendo - haciendo UPDATE")
        console.log("[v0] Body:", {
          id_revision_ssrsya: respondiendo.id_revision_ssrsya,
          respuesta_dependencia: formData.respuesta_dependencia,
        })
        response = await fetch("/api/revision-ssrsya", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id_revision_ssrsya: respondiendo.id_revision_ssrsya,
            respuesta_dependencia: formData.respuesta_dependencia,
          }),
        })
      } else if (editingItem || editandoComentario) {
        const idRevision = editingItem?.id_revision_ssrsya || editandoComentario?.id_revision_ssrsya
        console.log("[v0] Editando comentario - haciendo UPDATE")
        console.log("[v0] Body:", {
          id_revision_ssrsya: idRevision,
          comentario_ssrsya: userDependencia === "SSRSYA" ? formData.comentario_ssrsya : undefined,
          respuesta_dependencia: userDependencia !== "SSRSYA" ? formData.respuesta_dependencia : undefined,
        })
        response = await fetch("/api/revision-ssrsya", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id_revision_ssrsya: idRevision,
            comentario_ssrsya: userDependencia === "SSRSYA" ? formData.comentario_ssrsya : undefined,
            respuesta_dependencia: userDependencia !== "SSRSYA" ? formData.respuesta_dependencia : undefined,
          }),
        })
      } else if (comentarioAsociado) {
        const id_tabla = comentarioAsociado.id_tabla_revisada || null
        const id_pk = comentarioAsociado.id_pk_tabla_revisada || null

        console.log("[v0] SSRSYA continuando hilo - haciendo INSERT con asociado")
        console.log("[v0] Body:", {
          id_usuario: userId,
          id_tabla_revisada: id_tabla,
          id_pk_tabla_revisada: id_pk,
          comentario_ssrsya: formData.comentario_ssrsya,
          respuesta_dependencia: null,
          id_revision_ssrsya_asociado: comentarioAsociado.id_revision_ssrsya,
        })
        response = await fetch("/api/revision-ssrsya", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id_usuario: userId,
            id_tabla_revisada: id_tabla,
            id_pk_tabla_revisada: id_pk,
            comentario_ssrsya: formData.comentario_ssrsya,
            respuesta_dependencia: null,
            id_revision_ssrsya_asociado: comentarioAsociado.id_revision_ssrsya,
          }),
        })
      } else {
        console.log("[v0] Creando nuevo comentario inicial - haciendo INSERT")
        console.log("[v0] Body:", {
          id_usuario: userId,
          id_tabla_revisada: formData.id_tabla_revisada,
          id_pk_tabla_revisada: formData.id_pk_tabla_revisada,
          comentario_ssrsya: userDependencia === "SSRSYA" ? formData.comentario_ssrsya : null,
          respuesta_dependencia: null,
          id_revision_ssrsya_asociado: null,
        })
        response = await fetch("/api/revision-ssrsya", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id_usuario: userId,
            id_tabla_revisada: formData.id_tabla_revisada,
            id_pk_tabla_revisada: formData.id_pk_tabla_revisada,
            comentario_ssrsya: userDependencia === "SSRSYA" ? formData.comentario_ssrsya : null,
            respuesta_dependencia: null,
            id_revision_ssrsya_asociado: null,
          }),
        })
      }

      if (response.ok) {
        toast({
          title: "Éxito",
          description: `Comentario ${editingItem || editandoComentario || respondiendo ? "actualizado" : "creado"} exitosamente`,
        })
        onClose()
      } else {
        console.error("[v0] Response status:", response.status)
        console.error("[v0] Response statusText:", response.statusText)

        const contentType = response.headers.get("content-type")
        console.error("[v0] Content-Type:", contentType)

        let errorMessage = "Error en la operación"

        try {
          if (contentType && contentType.includes("application/json")) {
            const errorData = await response.json()
            console.error("[v0] Error response JSON:", errorData)
            errorMessage = errorData.error || errorMessage
          } else {
            const errorText = await response.text()
            console.error("[v0] Error response text:", errorText)
            errorMessage = errorText || errorMessage
          }
        } catch (parseError) {
          console.error("[v0] Error parsing response:", parseError)
        }

        throw new Error(errorMessage)
      }
    } catch (error: any) {
      console.error("[v0] Error al guardar:", error)
      toast({
        title: "Error",
        description: error.message || "Error al guardar el comentario",
        variant: "destructive",
      })
    }
  }

  const mostrarComentarioReadOnly = respondiendo && respondiendo.comentario_ssrsya

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          {editingItem || editandoComentario
            ? "Editar Comentario"
            : respondiendo
              ? "Responder Comentario"
              : comentarioAsociado
                ? "Nuevo Comentario (Continuación)"
                : "Nuevo Comentario"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mostrarComentarioReadOnly && (
            <div>
              <Label>Comentario SSRSYA</Label>
              <Textarea value={respondiendo.comentario_ssrsya} readOnly disabled rows={3} className="bg-muted" />
            </div>
          )}

          {userDependencia === "SSRSYA" && (!respondiendo || comentarioAsociado) ? (
            <div>
              <Label htmlFor="comentario_ssrsya">
                Comentario SSRSYA <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="comentario_ssrsya"
                value={formData.comentario_ssrsya}
                onChange={(e) => setFormData({ ...formData, comentario_ssrsya: e.target.value })}
                required
                rows={5}
              />
            </div>
          ) : (userDependencia !== "SSRSYA" || respondiendo) && !comentarioAsociado ? (
            <div>
              <Label htmlFor="respuesta_dependencia">
                Respuesta <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="respuesta_dependencia"
                value={formData.respuesta_dependencia}
                onChange={(e) => setFormData({ ...formData, respuesta_dependencia: e.target.value })}
                required
                rows={5}
              />
            </div>
          ) : null}

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">Guardar</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
