import { useState } from "react"
import { useSearchParams, useNavigate, Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Loader2, CheckCircle } from "lucide-react"

const API_BASE = "http://localhost/planificacion/api-backend";

export default function ResetPasswordPage() {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const token = searchParams.get("token")
    const { toast } = useToast()

    const [password, setPassword] = useState("")
    const [confirm, setConfirm] = useState("")
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)

    if (!token) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
                <Card className="w-full max-w-md text-center p-6">
                    <h2 className="text-xl font-bold text-red-600 mb-2">Enlace inválido</h2>
                    <p className="text-muted-foreground mb-4">No se encontró el token de seguridad.</p>
                    <Button asChild><Link to="/login">Ir al Login</Link></Button>
                </Card>
            </div>
        )
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (password !== confirm) {
            toast({ title: "Error", description: "Las contraseñas no coinciden", variant: "destructive" })
            return
        }
        if (password.length < 8) {
             toast({ title: "Error", description: "Mínimo 8 caracteres", variant: "destructive" })
             return
        }

        setLoading(true)
        try {
            const res = await fetch(`${API_BASE}/recuperar_clave.php`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ accion: "resetear", token, password })
            })
            const data = await res.json()
            if (res.ok) {
                setSuccess(true)
                setTimeout(() => navigate("/login"), 3000)
            } else {
                throw new Error(data.error)
            }
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle>Restablecer Contraseña</CardTitle>
                    <CardDescription>Ingresa tu nueva clave de acceso.</CardDescription>
                </CardHeader>
                <CardContent>
                    {success ? (
                        <div className="text-center py-6 animate-in zoom-in">
                            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                            <h3 className="text-lg font-bold text-green-700">¡Contraseña Actualizada!</h3>
                            <p className="text-sm text-gray-500 mt-2">Redirigiendo al login...</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label>Nueva Contraseña</Label>
                                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                            </div>
                            <div className="space-y-2">
                                <Label>Repetir Contraseña</Label>
                                <Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
                            </div>
                            <Button type="submit" className="w-full bg-blue-600" disabled={loading}>
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Cambiar Contraseña"}
                            </Button>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}