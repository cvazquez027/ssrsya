"use client"

import { useState, useEffect } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { User, KeyRound, LogOut } from "lucide-react"

interface UserMenuProps {
  userName: string
  userApellido: string
  userEmail: string
  userCuil: string
  onLogout: () => void
}

export function UserMenu({ userName, userApellido, userEmail, userCuil, onLogout }: UserMenuProps) {
  const [editarDatosOpen, setEditarDatosOpen] = useState(false)
  const [cambiarPasswordOpen, setCambiarPasswordOpen] = useState(false)
  const { toast } = useToast()

  const [datosForm, setDatosForm] = useState({
    nombre: userName,
    apellido: userApellido,
    email: userEmail,
    cuil: userCuil,
  })

  const [passwordForm, setPasswordForm] = useState({
    passwordActual: "",
    passwordNuevo: "",
    confirmarPassword: "",
  })

  const getInitials = () => {
    const firstInitial = userName?.charAt(0) || ""
    const lastInitial = userApellido?.charAt(0) || ""
    return `${firstInitial}${lastInitial}`.toUpperCase()
  }

  const handleActualizarDatos = async () => {
    try {
      const response = await fetch("/api/usuario/actualizar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(datosForm),
      })

      if (!response.ok) throw new Error("Error al actualizar datos")

      toast({
        title: "Datos actualizados",
        description: "Tus datos han sido actualizados correctamente",
      })
      setEditarDatosOpen(false)
      window.location.reload()
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron actualizar los datos",
        variant: "destructive",
      })
    }
  }

  const handleCambiarPassword = async () => {
    if (passwordForm.passwordNuevo !== passwordForm.confirmarPassword) {
      toast({
        title: "Error",
        description: "Las contraseñas no coinciden",
        variant: "destructive",
      })
      return
    }

    if (passwordForm.passwordNuevo.length < 6) {
      toast({
        title: "Error",
        description: "La contraseña debe tener al menos 6 caracteres",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch("/api/usuario/cambiar-password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          passwordActual: passwordForm.passwordActual,
          passwordNuevo: passwordForm.passwordNuevo,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Error al cambiar contraseña")
      }

      toast({
        title: "Contraseña actualizada",
        description: "Tu contraseña ha sido cambiada correctamente",
      })
      setCambiarPasswordOpen(false)
      setPasswordForm({ passwordActual: "", passwordNuevo: "", confirmarPassword: "" })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo cambiar la contraseña",
        variant: "destructive",
      })
    }
  }

  useEffect(() => {
    if (editarDatosOpen) {
      setDatosForm({
        nombre: userName,
        apellido: userApellido,
        email: userEmail,
        cuil: userCuil,
      })
    }
  }, [editarDatosOpen, userName, userApellido, userEmail, userCuil])

  useEffect(() => {
    if (!cambiarPasswordOpen) {
      setPasswordForm((prev) => ({
        passwordActual: prev.passwordActual,
        passwordNuevo: "",
        confirmarPassword: "",
      }))
    }
  }, [cambiarPasswordOpen])

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <span className="text-xs lg:text-sm text-muted-foreground font-medium hidden sm:block">
              {userName} {userApellido}
            </span>
            <Avatar className="h-8 w-8 cursor-pointer">
              <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Mi cuenta</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setEditarDatosOpen(true)}>
            <User className="mr-2 h-4 w-4" />
            Editar mis datos
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setCambiarPasswordOpen(true)}>
            <KeyRound className="mr-2 h-4 w-4" />
            Cambiar contraseña
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onLogout} className="text-red-600 focus:text-red-600">
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialog: Editar Datos */}
      <Dialog open={editarDatosOpen} onOpenChange={setEditarDatosOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar mis datos</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="nombre">Nombre</Label>
              <Input
                id="nombre"
                value={datosForm.nombre}
                onChange={(e) => setDatosForm({ ...datosForm, nombre: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="apellido">Apellido</Label>
              <Input
                id="apellido"
                value={datosForm.apellido}
                onChange={(e) => setDatosForm({ ...datosForm, apellido: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                value={datosForm.email}
                onChange={(e) => setDatosForm({ ...datosForm, email: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="cuil">CUIL</Label>
              <Input id="cuil" value={datosForm.cuil} disabled className="bg-muted" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditarDatosOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleActualizarDatos}>Guardar cambios</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Cambiar Contraseña */}
      <Dialog open={cambiarPasswordOpen} onOpenChange={setCambiarPasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar contraseña</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="passwordActual">Contraseña actual</Label>
              <Input
                id="passwordActual"
                type="password"
                value={passwordForm.passwordActual}
                onChange={(e) => setPasswordForm({ ...passwordForm, passwordActual: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="passwordNuevo">Nueva contraseña</Label>
              <Input
                id="passwordNuevo"
                type="password"
                value={passwordForm.passwordNuevo}
                onChange={(e) => setPasswordForm({ ...passwordForm, passwordNuevo: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="confirmarPassword">Confirmar nueva contraseña</Label>
              <Input
                id="confirmarPassword"
                type="password"
                value={passwordForm.confirmarPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmarPassword: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCambiarPasswordOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCambiarPassword}>Cambiar contraseña</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
