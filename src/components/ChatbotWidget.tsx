import { useState, useRef, useEffect } from "react"
import { MessageCircle, X, Send, Bot } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

const API_BASE = "http://localhost/planificacion/api-backend";

interface ChatMessage {
  role: 'user' | 'bot';
  text: string;
}

// MODIFICACIÓN QUIRÚRGICA: Función para interpretar negritas y saltos de línea
const formatBotMessage = (text: string) => {
  return text.split('\n').map((line, i) => {
    // Separa el texto cuando encuentra **algo**
    const parts = line.split(/(\*\*.*?\*\*)/g);
    return (
      <span key={i} className="block mb-1">
        {parts.map((part, j) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            // Le saca los asteriscos y lo envuelve en la etiqueta de negrita
            return <strong key={j} className="font-bold text-slate-800">{part.slice(2, -2)}</strong>;
          }
          return part;
        })}
      </span>
    );
  });
};

export function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'bot', text: '¡Hola! Soy tu asistente de IA. ¿Tenés alguna duda sobre cómo cargar proyectos o monitorear indicadores?' }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userText = input.trim();
    const currentMessages = [...messages];
    
    const newMessages = [...currentMessages, { role: 'user', text: userText } as ChatMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const historyToAPI = currentMessages.filter(m => m.text !== '¡Hola! Soy tu asistente de IA. ¿Tenés alguna duda sobre cómo cargar proyectos o monitorear indicadores?').map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          text: m.text
      }));

      const response = await fetch(`${API_BASE}/asistente_ia.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ 
            message: userText,
            messages: historyToAPI 
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setMessages([...newMessages, { role: 'bot', text: data.reply }]);
      } else {
        setMessages([...newMessages, { role: 'bot', text: "Perdón, hubo un error de conexión. Intenta de nuevo." }]);
      }
    } catch (error) {
      setMessages([...newMessages, { role: 'bot', text: "Error de red. Verificá tu conexión." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {isOpen && (
        <Card className="w-80 sm:w-96 h-[500px] mb-4 shadow-2xl flex flex-col border-blue-200">
          <CardHeader className="bg-blue-600 text-white rounded-t-xl p-4 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <CardTitle className="text-sm font-bold">Asistente SSRSyA</CardTitle>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-white hover:bg-blue-700" onClick={() => setIsOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          
          <CardContent className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-4 custom-scrollbar">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {/* MODIFICACIÓN QUIRÚRGICA: Agregamos whitespace-pre-wrap y llamamos a la funcion de formateo */}
                <div className={`max-w-[85%] rounded-lg p-3 text-sm shadow-sm whitespace-pre-wrap leading-relaxed ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none'}`}>
                  {msg.role === 'bot' ? formatBotMessage(msg.text) : msg.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-lg p-3 text-sm shadow-sm bg-white border border-slate-200 text-slate-500 rounded-bl-none flex items-center gap-2">
                  <span className="animate-pulse">●</span><span className="animate-pulse animation-delay-200">●</span><span className="animate-pulse animation-delay-400">●</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </CardContent>

          <CardFooter className="p-3 bg-white border-t border-slate-100">
            <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex w-full gap-2">
              <Input 
                value={input} 
                onChange={(e) => setInput(e.target.value)} 
                placeholder="Escribí tu duda..." 
                className="flex-1"
                disabled={isLoading}
              />
              <Button type="submit" size="icon" className="bg-blue-600 hover:bg-blue-700" disabled={isLoading || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </CardFooter>
        </Card>
      )}

      <Button 
        onClick={() => setIsOpen(!isOpen)}
        className={`h-14 w-14 rounded-full shadow-xl transition-transform hover:scale-110 ${isOpen ? 'bg-slate-700 hover:bg-slate-800' : 'bg-blue-600 hover:bg-blue-700'}`}
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </Button>
    </div>
  );
}