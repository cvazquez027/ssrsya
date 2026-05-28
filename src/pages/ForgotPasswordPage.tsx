import { useState } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, Mail, Loader2 } from "lucide-react"

const API_BASE = "http://localhost/planificacion/api-backend";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("")
    const [loading, setLoading] = useState(false)
    const [enviado, setEnviado] = useState(false)
    const { toast } = useToast()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const res = await fetch(`${API_BASE}/recuperar_clave.php`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ accion: "solicitar", email })
            })
            const data = await res.json()
            if (res.ok) {
                setEnviado(true)
                toast({ title: "Correo enviado", description: data.mensaje })
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
                    <CardTitle>Recuperar Contraseña</CardTitle>
                    <CardDescription>Te enviaremos un enlace para restablecerla.</CardDescription>
                </CardHeader>
                <CardContent>
                    {enviado ? (
                        <div className="text-center space-y-4">
                            <div className="p-4 bg-green-50 text-green-700 rounded-md border border-green-200">
                                <p className="text-sm">Si el correo <b>{email}</b> existe en nuestro sistema, recibirás las instrucciones en breve.</p>
                            </div>
                            <Button variant="outline" asChild className="w-full">
                                <Link to="/login">Volver al Login</Link>
                            </Button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <div className="relative">
                                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                        type="email" 
                                        placeholder="tu.email@msal.gov.ar" 
                                        className="pl-9"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        required 
                                    />
                                </div>
                            </div>
                            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Enviar Enlace"}
                            </Button>
                            <div className="text-center">
                                <Link to="/login" className="text-sm text-muted-foreground hover:text-blue-600 flex items-center justify-center gap-1">
                                    <ArrowLeft className="h-3 w-3" /> Volver
                                </Link>
                            </div>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}