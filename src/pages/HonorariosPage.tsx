import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MessageSquare, CheckCircle2, XCircle, Loader2, CalendarPlus, Plus, Save, UserPlus, Play, StepForward, XOctagon, UploadCloud, FileText, Check, AlertCircle, FileOutput, ShieldAlert } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import { PDFDocument } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType } from "docx"
import { saveAs } from "file-saver"
import JSZip from "jszip"

// @ts-ignore
const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const PDF_JS_VERSION = '5.5.207'; 

if (isLocal) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
} else {
    const workerUrl = `https://unpkg.com/pdfjs-dist@${PDF_JS_VERSION}/build/pdf.worker.min.mjs`;
    fetch(workerUrl)
        .then(res => {
            if (!res.ok) throw new Error("Fallo al descargar worker del CDN");
            return res.blob();
        })
        .then(blob => {
            const blobUrl = URL.createObjectURL(blob);
            pdfjsLib.GlobalWorkerOptions.workerSrc = blobUrl;
        })
        .catch(err => {
            console.error("Error en carga de Blob Worker, aplicando respaldo directo:", err);
            pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
        });
}

const API_BASE = isLocal 
    ? "http://localhost/planificacion/api-backend" 
    : "https://ssrsya.my-board.org/api-backend";

export default function HonorariosPage() {
    const { toast } = useToast()
    
    // --- CIRUGÍA DE SEGURIDAD ---
    const [accesoDenegado, setAccesoDenegado] = useState(false);

    const [loading, setLoading] = useState(true)
    const [progress, setProgress] = useState(0)
    
    const [agentes, setAgentes] = useState<any[]>([])
    const [facturaciones, setFacturaciones] = useState<any[]>([]) 
    const [aux, setAux] = useState<any>({ periodos: [], convenios: [], niveles: [], tipos: [], urs: [], dependencias: [] })
    const [selectedPeriodoId, setSelectedPeriodoId] = useState<number | null>(null)
    
    const [isModalPeriodo, setIsModalPeriodo] = useState(false)
    const [isModalAgente, setIsModalAgente] = useState(false)
    const [nuevoPeriodo, setNuevoPeriodo] = useState({ mes: new Date().getMonth() + 1, anio: 2026 })
    
    const [queueState, setQueueState] = useState({ isActive: false, pendientes: [] as any[], currentIndex: 0 })

    const [agenteData, setAgenteData] = useState({
        id_1109_agente: 0, nombre: "", cuil: "", celular: "", correo_electronico: "", id_1109_tipo_solicitud: "", sigla: "", id_1109_convenio: "", id_1109_nivel_grado: "", cant_urs: "", dedicacion: ""
    })

    const [isFileModalOpen, setIsFileModalOpen] = useState(false)
    const [agentToUpload, setAgentToUpload] = useState<any>(null)
    const [facturaFile, setFacturaFile] = useState<File | null>(null)
    const [comprobanteFile, setComprobanteFile] = useState<File | null>(null)
    const [nroComprobanteForm, setNroComprobanteForm] = useState("")
    const [fechaPeriodoInfo, setFechaPeriodoInfo] = useState({ start: '', end: '' })
    const [isProcessingPdf, setIsProcessingPdf] = useState(false)
    const [validationFlags, setValidationFlags] = useState({ cuitOk: false, cuitAgenteOk: false, montoOk: false, periodoOk: false, leido: false })

    const [isWordModalOpen, setIsWordModalOpen] = useState(false);
    const [isZipping, setIsZipping] = useState(false);

    const [filtroFacturado, setFiltroFacturado] = useState("todos")
    const [filtroEnNota, setFiltroEnNota] = useState("todos")

    useEffect(() => { fetchAll(); }, [])

    const fetchAll = async () => {
        setLoading(true); setProgress(10);
        try {
            // CIRUGÍA: Validar permisos de RRHH
            const resUser = await fetch(`${API_BASE}/usuario.php`, { credentials: 'include' });
            const userData = await resUser.json();
            if (!userData.permisos?.['RRHH']) {
                setAccesoDenegado(true);
                setLoading(false);
                return;
            }

            setProgress(30);
            const res = await fetch(`${API_BASE}/1109_gestion.php?accion=listar_todo`, { credentials: 'include' });
            const data = await res.json();
            setProgress(60);
            setAgentes(data.agentes || []);
            setAux(data.auxiliares || {});
            setAux((prev: any) => ({ ...prev, periodos: data.periodos }));
            if (data.periodos && data.periodos.length > 0) setSelectedPeriodoId(data.periodos[0].id_1109_periodo_facturacion);
            setProgress(100);
        } catch (e) { 
            toast({ title: "Error", description: "No se pudieron cargar los datos", variant: "destructive" }); 
        } finally { setTimeout(() => setLoading(false), 500); }
    }

    useEffect(() => { if (selectedPeriodoId) fetchFacturacion(selectedPeriodoId); }, [selectedPeriodoId])

    const fetchFacturacion = async (id_periodo: number) => {
        try {
            const res = await fetch(`${API_BASE}/1109_gestion.php?accion=get_facturacion&id_periodo=${id_periodo}`, { credentials: 'include' });
            setFacturaciones(await res.json() || []);
        } catch (e) { console.error(e) }
    }

    const handleUpdateCelda = async (tabla: string, pk: string, id: number, campo: string, valor: any) => {
        try {
            await fetch(`${API_BASE}/1109_gestion.php?accion=update_celda_auxiliar`, { method: 'POST', headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tabla, pk_campo: pk, pk_valor: id, campo, valor }), credentials: 'include' });
            toast({ title: "Cambio guardado" });
        } catch (e) { toast({ title: "Error", variant: "destructive" }); }
    }

    const crearPeriodoMasivo = async () => {
        try {
            const res = await fetch(`${API_BASE}/1109_gestion.php?accion=crear_periodo`, { method: 'POST', headers: { "Content-Type": "application/json" }, body: JSON.stringify(nuevoPeriodo), credentials: 'include' });
            if (!res.ok) throw new Error((await res.json()).error || "Error al crear período");
            setIsModalPeriodo(false); fetchAll(); 
            toast({ title: "Período creado", description: "Se incluyeron los agentes activos." });
        } catch (e: any) { toast({ title: "Atención", description: e.message, variant: "destructive" }); }
    }

    const asignarPeriodoManual = async (idAgente: number) => {
        try {
            await fetch(`${API_BASE}/1109_gestion.php?accion=asignar_periodo`, { method: 'POST', headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id_agente: idAgente, id_periodo: selectedPeriodoId }), credentials: 'include' });
            toast({ title: "Agente asignado al período actual" }); fetchFacturacion(selectedPeriodoId as number);
        } catch (e) { toast({ title: "Error", variant: "destructive" }); }
    }

    const guardarAgente = async () => {
        try {
            const res = await fetch(`${API_BASE}/1109_gestion.php?accion=guardar_agente`, { method: 'POST', headers: { "Content-Type": "application/json" }, body: JSON.stringify(agenteData), credentials: 'include' });
            if (res.ok) { setIsModalAgente(false); fetchAll(); toast({ title: "Agente registrado con éxito" }); }
        } catch (e) { toast({ title: "Error", variant: "destructive" }); }
    }

    const handleNuevoAuxiliar = async (tabla: string) => {
        try {
            await fetch(`${API_BASE}/1109_gestion.php?accion=nuevo_auxiliar`, { method: 'POST', headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tabla }), credentials: 'include' });
            fetchAll();
        } catch (e) { console.error(e); }
    }

    const enviarWhatsApp = (agente: any) => {
        if (!agente.celular) { toast({ title: "Sin número", variant: "destructive" }); return; }
        const numeroLimpio = String(agente.celular).replace(/\D/g, '');
        const periodoObj = aux.periodos?.find((p:any) => p.id_1109_periodo_facturacion === selectedPeriodoId);
        const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
        const mesNombre = periodoObj ? meses[periodoObj.mes - 1] : 'marzo';
        const anio = periodoObj ? periodoObj.anio : 2026;
        
        const mesVto = periodoObj ? (periodoObj.mes === 12 ? 1 : periodoObj.mes + 1) : 4;
        const anioVto = periodoObj ? (periodoObj.mes === 12 ? periodoObj.anio + 1 : periodoObj.anio) : 2026;
        const fechaVto = `10/${String(mesVto).padStart(2, '0')}/${anioVto}`;
        
        const mensaje = `Buenas, cómo estás? Soy Christian de la Subsecretaría de Relaciones Sectoriales y Articulación. Te escribo para solicitarte la remisión de la factura de honorarios correspondientes al mes de ${mesNombre} ${anio} y el comprobante de monotributo correspondientes, en lo posible hasta el día miércoles de esta semana. El monto a facturar es el mismo del período anterior y la fecha de vencimiento para el pago podés ponerle ${fechaVto}. Cualquier cosa, estoy a disposición! Saludos.`;
        window.open(`https://wa.me/${numeroLimpio}?text=${encodeURIComponent(mensaje)}`, '_blank');
    }

    const iniciarEnvioMasivo = () => {
        const pendientes = facturaciones.filter(ag => !ag.facturado && ag.id_1109_tipo_solicitud == 1 && ag.id_fact && ag.celular);
        if (pendientes.length === 0) { toast({ title: "Nada por enviar" }); return; }
        setQueueState({ isActive: true, pendientes, currentIndex: 0 });
    }

    const procesarPasoQueue = () => {
        enviarWhatsApp(queueState.pendientes[queueState.currentIndex]);
        if (queueState.currentIndex + 1 < queueState.pendientes.length) setQueueState(prev => ({ ...prev, currentIndex: prev.currentIndex + 1 }));
        else { setQueueState({ isActive: false, pendientes: [], currentIndex: 0 }); toast({ title: "¡Completado!" }); }
    }

    const urVigente = aux.urs?.find((u: any) => !u.fecha_hasta || u.fecha_hasta === "") || aux.urs?.[0];
    const valorUrActual = urVigente ? parseFloat(urVigente.valor) : 0;

    const abrirModalArchivos = (agente: any) => {
        setAgentToUpload(agente);
        setFacturaFile(null);
        setComprobanteFile(null);
        setNroComprobanteForm(agente.nro_comprobante || "");
        setValidationFlags({ cuitOk: false, cuitAgenteOk: false, montoOk: false, periodoOk: false, leido: false });
        setIsFileModalOpen(true);
    }

    const procesarValidacionFactura = async (file: File) => {
        if (!file || file.type !== 'application/pdf') return;
        setIsProcessingPdf(true);

        const periodoObj = aux.periodos?.find((p:any) => p.id_1109_periodo_facturacion === selectedPeriodoId);
        const pMes = periodoObj ? periodoObj.mes : new Date().getMonth() + 1;
        const pAnio = periodoObj ? periodoObj.anio : new Date().getFullYear();
        
        const strMes = String(pMes).padStart(2, '0');
        const strAnio = String(pAnio);
        const ultDia = new Date(pAnio, pMes, 0).getDate();
        
        const fechaDesdeStr = `01/${strMes}/${strAnio}`;
        const fechaHastaStr = `${ultDia}/${strMes}/${strAnio}`;
        setFechaPeriodoInfo({ start: fechaDesdeStr, end: fechaHastaStr });

        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
            
            let cuitOk = false;
            let cuitAgenteOk = false;
            let pto = "";
            let nro = "";
            let fullTextClean = "";

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                // @ts-ignore
                const rawItems = textContent.items.map(item => item.str.trim()).filter(Boolean);
                const joinedText = rawItems.join(' ');
                
                fullTextClean += joinedText.replace(/\s+/g, ''); 
                const soloNumeros = fullTextClean.replace(/\D/g, ''); 
                
                if (!cuitOk) cuitOk = soloNumeros.includes('30546663422');
                if (!cuitAgenteOk) {
                    const cuilAgenteLimpio = agentToUpload?.cuil ? String(agentToUpload.cuil).replace(/\D/g, '') : '';
                    cuitAgenteOk = cuilAgenteLimpio !== '' && soloNumeros.includes(cuilAgenteLimpio);
                }

                if (!pto || !nro) {
                    for(let j=0; j<rawItems.length; j++) {
                        if(/Punto\s*de\s*Venta/i.test(rawItems[j]) || /PTO\s*VTA/i.test(rawItems[j])) {
                            const matchIn = rawItems[j].match(/\d{4,5}/);
                            if (matchIn) pto = matchIn[0];
                            else if (rawItems[j+1] && /^\d{4,5}$/.test(rawItems[j+1])) pto = rawItems[j+1];
                            else if (rawItems[j+2] && /^\d{4,5}$/.test(rawItems[j+2])) pto = rawItems[j+2];
                        }
                        if(/Comp\.?\s*Nro/i.test(rawItems[j]) || /Comprobante\s*Nro/i.test(rawItems[j])) {
                            const matchIn = rawItems[j].match(/\d{8}/);
                            if (matchIn) nro = matchIn[0];
                            else if (rawItems[j+1] && /^\d{8}$/.test(rawItems[j+1])) nro = rawItems[j+1];
                            else if (rawItems[j+2] && /^\d{8}$/.test(rawItems[j+2])) nro = rawItems[j+2];
                        }
                    }
                }
                if (cuitOk && cuitAgenteOk && pto && nro) break;
            }

            const montoCalculado = (agentToUpload.cant_urs || 0) * valorUrActual;
            const montoStrComa = montoCalculado.toFixed(2).replace('.', ','); 
            const montoStrPuntos = montoCalculado.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\s+/g, ''); 
            const montoOk = fullTextClean.includes(montoStrComa) || fullTextClean.includes(montoStrPuntos);

            const fechaDesdeLimpia = fechaDesdeStr.replace(/\//g, '');
            const fechaHastaLimpia = fechaHastaStr.replace(/\//g, '');
            const textSinBarras = fullTextClean.replace(/\//g, '');
            const periodoOk = textSinBarras.includes(fechaDesdeLimpia) && textSinBarras.includes(fechaHastaLimpia);

            let extractedNro = "";
            if (pto && nro) {
                extractedNro = `${pto.padStart(5, '0')}-${nro.padStart(8, '0')}`;
            } else {
                const fileNameMatch = file.name.match(/_(\d{4,5})_(\d{8})\.pdf/i);
                if (fileNameMatch) extractedNro = `${fileNameMatch[1].padStart(5, '0')}-${fileNameMatch[2].padStart(8, '0')}`;
            }
            
            setNroComprobanteForm(extractedNro);
            setValidationFlags({ cuitOk, cuitAgenteOk, montoOk, periodoOk, leido: true });

        } catch (error) {
            toast({ title: "Lectura manual", description: "No se pudo leer el texto del PDF.", variant: "destructive" });
            setValidationFlags({ cuitOk: false, cuitAgenteOk: false, montoOk: false, periodoOk: false, leido: true });
        }
        setIsProcessingPdf(false);
    }

    const procesarYUnificar = async () => {
        if (!facturaFile) return;
        if (agentToUpload?.id_1109_tipo_solicitud != 2 && !comprobanteFile) return;
        
        setIsProcessingPdf(true);
        
        try {
            let blobParaSubir: Blob;

            if (agentToUpload?.id_1109_tipo_solicitud == 2) {
                blobParaSubir = facturaFile;
            } else {
                const finalPdf = await PDFDocument.create();

                const facturaArrayBuffer = await facturaFile.arrayBuffer();
                const pdfToRender = await pdfjsLib.getDocument({ data: new Uint8Array(facturaArrayBuffer) }).promise;
                const renderPage = await pdfToRender.getPage(1);
                
                const viewport = renderPage.getViewport({ scale: 2.0 }); 
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                
                // @ts-ignore
                await renderPage.render({ canvasContext: ctx, viewport }).promise;
                const facturaDataUrl = canvas.toDataURL('image/jpeg', 0.95);

                const facturaImage = await finalPdf.embedJpg(facturaDataUrl);
                const a4Page = finalPdf.addPage([595.28, 841.89]); 
                a4Page.drawImage(facturaImage, { x: 0, y: 0, width: 595.28, height: 841.89 });

                const comprobanteBytes = await comprobanteFile!.arrayBuffer();
                if (comprobanteFile!.type === 'application/pdf') {
                    const comprobanteDoc = await PDFDocument.load(comprobanteBytes, { ignoreEncryption: true });
                    const copiedPages = await finalPdf.copyPages(comprobanteDoc, comprobanteDoc.getPageIndices());
                    copiedPages.forEach(p => finalPdf.addPage(p));
                } else if (comprobanteFile!.type.startsWith('image/')) {
                    let image;
                    if (comprobanteFile!.type === 'image/jpeg') image = await finalPdf.embedJpg(comprobanteBytes);
                    else image = await finalPdf.embedPng(comprobanteBytes);
                    
                    const imgDims = image.scaleToFit(595.28, 841.89);
                    const page2 = finalPdf.addPage([595.28, 841.89]);
                    page2.drawImage(image, { x: (595.28 - imgDims.width) / 2, y: 841.89 - imgDims.height - 20, width: imgDims.width, height: imgDims.height });
                }

                const mergedPdfBytes = await finalPdf.save();
                blobParaSubir = new Blob([mergedPdfBytes as any], { type: 'application/pdf' });
            }

            const apellido = agentToUpload.nombre.split(',')[0].trim().replace(/\s+/g, '_').toUpperCase();
            const periodoObj = aux.periodos?.find((p:any) => p.id_1109_periodo_facturacion === selectedPeriodoId);
            const meses = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
            const mesNombre = periodoObj ? meses[periodoObj.mes - 1] : 'MES';
            const anio = periodoObj ? periodoObj.anio : new Date().getFullYear();
            const nombreFinal = `1109_${apellido}_${mesNombre}_${anio}.pdf`;

            const formData = new FormData();
            formData.append("pdf", blobParaSubir, nombreFinal);
            formData.append("nombre_archivo", nombreFinal);
            formData.append("id_facturacion", agentToUpload.id_fact);
            formData.append("nro_comprobante", nroComprobanteForm);

            const res = await fetch(`${API_BASE}/1109_gestion.php?accion=subir_factura_unificada`, {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });

            if (res.ok) {
                toast({ title: "¡Éxito!", description: "Archivo procesado y guardado. Datos actualizados." });
                setIsFileModalOpen(false);
                fetchFacturacion(selectedPeriodoId as number);
            } else { throw new Error("Error del servidor"); }

        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Ocurrió un problema al procesar los documentos.", variant: "destructive" });
        }
        setIsProcessingPdf(false);
    }

    const agentesListosParaNota = facturaciones.filter(ag => ag.facturado == 1 && ag.en_nota == 0 && ag.nro_comprobante);

    const generarWordYMarcar = async () => {
        if (agentesListosParaNota.length === 0) return;
        setIsZipping(true);

        const periodoObj = aux.periodos?.find((p:any) => p.id_1109_periodo_facturacion === selectedPeriodoId);
        const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        const mesesUpper = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
        
        const mesNombre = periodoObj ? meses[periodoObj.mes - 1] : 'Mes';
        const mesNombreUpper = periodoObj ? mesesUpper[periodoObj.mes - 1] : 'MES';
        const anio = periodoObj ? periodoObj.anio : new Date().getFullYear();

        const tableRows = [
            new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "APELLIDO Y NOMBRE", bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "CUIT", bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "NRO. FACTURA", bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "MES", bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "ÁREA", bold: true })] })] }),
                ]
            }),
            ...agentesListosParaNota.map(ag => new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph({ text: String(ag.nombre) })] }),
                    new TableCell({ children: [new Paragraph({ text: String(ag.cuil) })] }),
                    new TableCell({ children: [new Paragraph({ text: String(ag.nro_comprobante) })] }),
                    new TableCell({ children: [new Paragraph({ text: mesNombre })] }),
                    new TableCell({ children: [new Paragraph({ text: String(ag.sigla || "Subsecretaría de Relaciones Sectoriales y Articulación") })] }),
                ]
            }))
        ];

        const doc = new Document({
            sections: [{
                properties: {},
                children: [
                    new Paragraph({ children: [new TextRun({ text: `Referencia: FACTURACIÓN DECRETO 1109/17 - ${mesNombre.toUpperCase()} ${anio} – SSRSYA`, bold: true })], spacing: { after: 200 } }),
                    new Paragraph({ text: "A: LIFERNANDEZ, AGUZMAN, HTRIMARCHI, LUCLOPEZ, RCFERNANDEZ" }),
                    new Paragraph({ text: "CC: IFINELLI, MACAPRIO", spacing: { after: 200 } }),
                    new Paragraph({ text: `Por medio de la presente me dirijo a Ud. a efectos de solicitarle tenga a bien arbitrar los medios necesarios a su alcance, para efectuar el pago de los honorarios correspondientes al mes de ${mesNombre.toLowerCase()} ${anio}, de los agentes que a continuación se detallan, pertenecientes a este nivel y contratados bajo la modalidad establecida por Decreto 1109/2017.`, spacing: { after: 200 } }),
                    new Paragraph({ text: "Obran como archivos embebidos, las respectivas facturas.", spacing: { after: 400 } }),
                    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: tableRows })
                ]
            }]
        });

        try {
            const zip = new JSZip();
            const wordBlob = await Packer.toBlob(doc);
            zip.file(`Nota_Facturacion_${mesNombre}_${anio}.docx`, wordBlob);

            toast({ title: "Empaquetando...", description: `Descargando las facturas de ${agentesListosParaNota.length} agentes. Por favor esperá...` });

            for (const ag of agentesListosParaNota) {
                const apellido = ag.nombre.split(',')[0].trim().replace(/\s+/g, '_').toUpperCase();
                const nombrePdf = `1109_${apellido}_${mesNombreUpper}_${anio}.pdf`;
                
                try {
                    const response = await fetch(`${API_BASE}/1109_gestion.php?accion=obtener_archivo&nombre=${nombrePdf}`, { credentials: 'include' });
                    if (response.ok) {
                        const pdfBlob = await response.blob();
                        zip.file(nombrePdf, pdfBlob);
                    } else {
                        console.warn(`No se pudo encontrar el PDF de: ${ag.nombre}`);
                    }
                } catch (err) {
                    console.error(`Error de red al descargar PDF de: ${ag.nombre}`, err);
                }
            }

            const zipContent = await zip.generateAsync({ type: "blob" });
            saveAs(zipContent, `Tanda_Exportacion_${mesNombre}_${anio}.zip`);

            const ids = agentesListosParaNota.map(ag => ag.id_fact);
            const res = await fetch(`${API_BASE}/1109_gestion.php?accion=marcar_en_nota`, {
                method: 'POST',
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids }),
                credentials: 'include'
            });

            if (res.ok) {
                toast({ title: "¡Tanda Generada!", description: "Se descargó el paquete y las facturas fueron marcadas como enviadas." });
                setIsWordModalOpen(false);
                fetchFacturacion(selectedPeriodoId as number); 
            }
        } catch (error) {
            toast({ title: "Error", description: "No se pudo generar el documento.", variant: "destructive" });
        } finally {
            setIsZipping(false);
        }
    };

    const facturacionesFiltradas = facturaciones.filter(ag => {
        let mostrarPorFacturado = true;
        if (filtroFacturado === "si") mostrarPorFacturado = ag.facturado == 1;
        if (filtroFacturado === "no") mostrarPorFacturado = ag.facturado == 0;

        let mostrarPorEnNota = true;
        if (filtroEnNota === "si") mostrarPorEnNota = ag.en_nota == 1;
        if (filtroEnNota === "no") mostrarPorEnNota = ag.en_nota == 0;

        return mostrarPorFacturado && mostrarPorEnNota;
    });

    if (loading) {
        return (
            <DashboardLayout currentSection="Honorarios">
                <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
                    <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                    <div className="w-full max-w-md space-y-2 text-center">
                        <Progress value={progress} className="h-2" />
                        <p className="text-xs text-slate-400">Cargando módulo de honorarios ({progress}%)...</p>
                    </div>
                </div>
            </DashboardLayout>
        )
    }

    if (accesoDenegado) {
        return (
            <DashboardLayout currentSection="Honorarios">
                <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500 space-y-4">
                    <ShieldAlert className="h-16 w-16 text-red-500 mb-2" />
                    <h2 className="text-2xl font-bold text-slate-800">Acceso Denegado</h2>
                    <p>No tenés permisos para visualizar el módulo de Recursos Humanos.</p>
                </div>
            </DashboardLayout>
        );
    }

    const agentesPendientesMensaje = facturaciones.filter(ag => !ag.facturado && ag.id_1109_tipo_solicitud == 1 && ag.id_fact && ag.celular).length;

    return (
        <DashboardLayout currentSection="Honorarios">
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Gestión Honorarios 1109</h2>
                        <p className="text-muted-foreground text-sm">Control de facturación mensual y nómina de agentes.</p>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={() => setIsModalPeriodo(true)} variant="outline" size="sm"><CalendarPlus className="mr-2 h-4 w-4" /> Abrir Nuevo Mes</Button>
                        <Button onClick={() => { setAgenteData({id_1109_agente: 0, nombre: "", cuil: "", celular: "", correo_electronico: "", id_1109_tipo_solicitud: "", sigla: "", id_1109_convenio: "", id_1109_nivel_grado: "", cant_urs: "", dedicacion: ""}); setIsModalAgente(true); }} className="bg-blue-600" size="sm"><UserPlus className="mr-2 h-4 w-4" /> Nuevo Agente</Button>
                    </div>
                </div>

                <Tabs defaultValue="facturacion" className="w-full">
                    <TabsList className="w-full justify-start border-b rounded-none bg-transparent h-auto p-0 mb-4">
                        <TabsTrigger value="facturacion" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-4 py-2">Facturación y Archivos</TabsTrigger>
                        <TabsTrigger value="agentes" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-4 py-2">Nómina (Modo Excel)</TabsTrigger>
                        <TabsTrigger value="auxiliares" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-4 py-2">Configuraciones</TabsTrigger>
                    </TabsList>

                    {/* TABS: FACTURACIÓN */}
                    <TabsContent value="facturacion">
                        <Card>
                            <CardHeader className="flex flex-col xl:flex-row items-start xl:items-center justify-between pb-4 gap-4">
                                <div className="flex flex-wrap items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <Label className="whitespace-nowrap font-bold text-slate-700">Período visible:</Label>
                                        <Select value={String(selectedPeriodoId)} onValueChange={v => setSelectedPeriodoId(Number(v))}>
                                            <SelectTrigger className="w-[180px] bg-slate-50"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                                            <SelectContent>
                                                {aux.periodos?.map((p:any) => <SelectItem key={p.id_1109_periodo_facturacion} value={String(p.id_1109_periodo_facturacion)}>Mes {p.mes} - Año {p.anio}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                        <Label className="whitespace-nowrap font-bold text-slate-700">Facturado:</Label>
                                        <Select value={filtroFacturado} onValueChange={setFiltroFacturado}>
                                            <SelectTrigger className="w-[120px] bg-slate-50"><SelectValue placeholder="Todos" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="todos">Todos</SelectItem>
                                                <SelectItem value="si">Sí</SelectItem>
                                                <SelectItem value="no">No</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Label className="whitespace-nowrap font-bold text-slate-700">En Nota:</Label>
                                        <Select value={filtroEnNota} onValueChange={setFiltroEnNota}>
                                            <SelectTrigger className="w-[120px] bg-slate-50"><SelectValue placeholder="Todos" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="todos">Todos</SelectItem>
                                                <SelectItem value="si">Sí</SelectItem>
                                                <SelectItem value="no">No</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                
                                <div className="flex gap-2 w-full xl:w-auto">
                                    <Button onClick={() => setIsWordModalOpen(true)} disabled={agentesListosParaNota.length === 0} className="bg-purple-600 hover:bg-purple-700 text-white w-full xl:w-auto">
                                        <FileOutput className="mr-2 h-4 w-4" /> Exportar Nota ({agentesListosParaNota.length})
                                    </Button>
                                    <Button onClick={iniciarEnvioMasivo} disabled={agentesPendientesMensaje === 0} className="bg-green-600 hover:bg-green-700 w-full xl:w-auto">
                                        <Play className="mr-2 h-4 w-4" /> Avisos ({agentesPendientesMensaje})
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 border-b">
                                        <tr>
                                            <th className="p-4 text-left font-semibold">Agente</th>
                                            <th className="p-4 text-center font-semibold">Dependencia</th>
                                            <th className="p-4 text-center font-semibold">Monto ($)</th>
                                            <th className="p-4 text-center font-semibold">Estado Factura</th>
                                            <th className="p-4 text-right font-semibold">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {facturacionesFiltradas.length > 0 ? (
                                            facturacionesFiltradas.map((ag) => {
                                                const montoCalculado = (ag.cant_urs || 0) * valorUrActual;
                                                const noAsignado = !ag.id_fact;

                                                return (
                                                <tr key={ag.id_1109_agente} className={`border-b transition-colors ${noAsignado ? 'bg-amber-50/30' : 'hover:bg-slate-50/40'}`}>
                                                    <td className="p-4">
                                                        <div className="font-bold flex items-center gap-2">
                                                            {ag.nombre}
                                                            {ag.activo == 0 && <span className="text-[10px] px-2 py-0.5 bg-red-100 text-red-600 rounded">Inactivo</span>}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">{ag.cuil}</div>
                                                    </td>
                                                    
                                                    {noAsignado ? (
                                                        <td colSpan={4} className="p-4 text-right">
                                                            <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50" onClick={() => asignarPeriodoManual(ag.id_1109_agente)}>
                                                                <Plus className="h-4 w-4 mr-2" /> Incluir en este mes
                                                            </Button>
                                                        </td>
                                                    ) : (
                                                        <>
                                                            <td className="p-4 text-center text-slate-600 font-medium text-xs">
                                                                {ag.sigla ? <span className="bg-slate-100 px-2 py-1 rounded border">{ag.sigla}</span> : <span className="text-slate-300">-</span>}
                                                            </td>
                                                            <td className="p-4 text-center font-medium text-slate-700">
                                                                ${montoCalculado.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </td>
                                                            <td className="p-4 text-center">
                                                                {ag.facturado ? (
                                                                    <div className="flex flex-col items-center">
                                                                        <span className="inline-flex items-center gap-1 text-green-600 font-medium text-xs bg-green-50 px-2 py-1 rounded-full"><CheckCircle2 className="h-4 w-4" /> Recibido</span>
                                                                        
                                                                        {ag.en_nota == 1 ? (
                                                                            <span onClick={() => handleUpdateCelda('1109_facturacion', 'id_1109_facturacion', ag.id_fact, 'en_nota', 0).then(()=>fetchFacturacion(selectedPeriodoId as number))} className="text-[10px] text-purple-600 font-bold bg-purple-100 px-2 py-0.5 mt-1 rounded cursor-pointer hover:bg-purple-200" title="Hacer clic para quitar de la tanda">
                                                                                Incluido en Nota
                                                                            </span>
                                                                        ) : (
                                                                            ag.nro_comprobante && <span className="text-[10px] text-slate-400 mt-1">Fac: {ag.nro_comprobante}</span>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1 text-slate-400 text-xs"><XCircle className="h-4 w-4" /> Pendiente</span>
                                                                )}
                                                            </td>
                                                            <td className="p-4 text-right space-x-2">
                                                                <Button size="sm" variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100" onClick={() => abrirModalArchivos(ag)}>
                                                                    <UploadCloud className="h-4 w-4 mr-2" /> {ag.facturado ? 'Reemplazar Archivos' : 'Subir Archivos'}
                                                                </Button>
                                                                {ag.id_1109_tipo_solicitud == 1 && (
                                                                    <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => enviarWhatsApp(ag)}>
                                                                        <MessageSquare className="h-4 w-4 mr-2" /> Aviso
                                                                    </Button>
                                                                )}
                                                            </td>
                                                        </>
                                                    )}
                                                </tr>
                                            )})
                                        ) : (
                                            <tr>
                                                <td colSpan={5} className="p-8 text-center text-slate-500">
                                                    No hay agentes que coincidan con los filtros seleccionados.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* TABS: AGENTES EXCEL */}
                    <TabsContent value="agentes">
                        <Card>
                            <CardContent className="p-0 overflow-x-auto">
                                <table className="w-full text-xs min-w-[850px]">
                                    <thead className="bg-slate-50 border-b text-slate-600">
                                        <tr>
                                            <th className="px-3 py-3 font-semibold text-left w-[22%]">Nombre / Email</th>
                                            <th className="px-3 py-3 font-semibold text-left w-[15%]">CUIL / Celular</th>
                                            <th className="px-3 py-3 font-semibold text-left w-[20%]">Tipo / Dependencia</th>
                                            <th className="px-3 py-3 font-semibold text-left w-[23%]">Convenio / Nivel</th>
                                            <th className="px-3 py-3 font-semibold text-left w-[15%]">URs / Dedic.</th>
                                            <th className="px-2 py-3 font-semibold text-center w-[5%]">Activo</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {agentes.map((ag) => (
                                            <tr key={ag.id_1109_agente} className="border-b hover:bg-slate-50/50">
                                                <td className="p-2 space-y-1 align-top">
                                                    <Input className="h-7 text-xs px-2 border-transparent bg-transparent hover:bg-white hover:border-slate-200 focus-visible:ring-1 focus-visible:bg-white transition-all placeholder:text-slate-300" placeholder="Nombre completo" defaultValue={ag.nombre} onBlur={(e) => handleUpdateCelda('1109_agente', 'id_1109_agente', ag.id_1109_agente, 'nombre', e.target.value)} />
                                                    <Input className="h-7 text-xs px-2 border-transparent bg-transparent hover:bg-white hover:border-slate-200 focus-visible:ring-1 focus-visible:bg-white transition-all placeholder:text-slate-300" placeholder="Correo electrónico" defaultValue={ag.correo_electronico} onBlur={(e) => handleUpdateCelda('1109_agente', 'id_1109_agente', ag.id_1109_agente, 'correo_electronico', e.target.value)} />
                                                </td>
                                                <td className="p-2 space-y-1 align-top">
                                                    <Input className="h-7 text-xs px-2 border-transparent bg-transparent hover:bg-white hover:border-slate-200 focus-visible:ring-1 focus-visible:bg-white transition-all placeholder:text-slate-300" placeholder="CUIL" defaultValue={ag.cuil} onBlur={(e) => handleUpdateCelda('1109_agente', 'id_1109_agente', ag.id_1109_agente, 'cuil', e.target.value)} />
                                                    <Input className="h-7 text-xs px-2 border-transparent bg-transparent hover:bg-white hover:border-slate-200 focus-visible:ring-1 focus-visible:bg-white transition-all placeholder:text-slate-300" placeholder="Celular" defaultValue={ag.celular} onBlur={(e) => handleUpdateCelda('1109_agente', 'id_1109_agente', ag.id_1109_agente, 'celular', e.target.value)} />
                                                </td>
                                                <td className="p-2 space-y-1 align-top">
                                                    <select className="w-full h-7 text-xs px-1 border border-transparent rounded bg-transparent hover:bg-white hover:border-slate-200 focus:ring-1 cursor-pointer transition-all" defaultValue={ag.id_1109_tipo_solicitud ? String(ag.id_1109_tipo_solicitud) : ""} onChange={(e) => handleUpdateCelda('1109_agente', 'id_1109_agente', ag.id_1109_agente, 'id_1109_tipo_solicitud', e.target.value)}>
                                                        <option value="" className="text-slate-300">[Tipo Solicitud]</option>
                                                        {aux.tipos?.map((t:any) => <option key={t.id_1109_tipo_solicitud} value={String(t.id_1109_tipo_solicitud)}>{t.descripcion}</option>)}
                                                    </select>
                                                    <select className="w-full h-7 text-xs px-1 border border-transparent rounded bg-transparent hover:bg-white hover:border-slate-200 focus:ring-1 cursor-pointer transition-all" defaultValue={ag.sigla || ""} onChange={(e) => handleUpdateCelda('1109_agente', 'id_1109_agente', ag.id_1109_agente, 'sigla', e.target.value)}>
                                                        <option value="" className="text-slate-300">[Dependencia]</option>
                                                        {aux.dependencias?.map((d:any) => <option key={d.sigla} value={d.sigla}>{d.sigla}</option>)}
                                                    </select>
                                                </td>
                                                <td className="p-2 space-y-1 align-top">
                                                    <select className="w-full h-7 text-xs px-1 border border-transparent rounded bg-transparent hover:bg-white hover:border-slate-200 focus:ring-1 cursor-pointer transition-all" defaultValue={ag.id_1109_convenio ? String(ag.id_1109_convenio) : ""} onChange={(e) => handleUpdateCelda('1109_agente', 'id_1109_agente', ag.id_1109_agente, 'id_1109_convenio', e.target.value)}>
                                                        <option value="" className="text-slate-300">[Convenio]</option>
                                                        {aux.convenios?.map((c:any) => <option key={c.id_1109_convenio} value={String(c.id_1109_convenio)}>{c.descripcion}</option>)}
                                                    </select>
                                                    <select className="w-full h-7 text-xs px-1 border border-transparent rounded bg-transparent hover:bg-white hover:border-slate-200 focus:ring-1 cursor-pointer transition-all" defaultValue={ag.id_1109_nivel_grado ? String(ag.id_1109_nivel_grado) : ""} onChange={(e) => handleUpdateCelda('1109_agente', 'id_1109_agente', ag.id_1109_agente, 'id_1109_nivel_grado', e.target.value)}>
                                                        <option value="" className="text-slate-300">[Nivel/Grado]</option>
                                                        {aux.niveles?.map((n:any) => <option key={n.id_1109_nivel_grado} value={String(n.id_1109_nivel_grado)}>{n.descripcion}</option>)}
                                                    </select>
                                                </td>
                                                <td className="p-2 space-y-1 align-top">
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-[10px] text-slate-400 w-6">URs:</span>
                                                        <Input type="number" className="h-7 text-xs px-2 border-transparent bg-transparent hover:bg-white hover:border-slate-200 focus-visible:ring-1 focus-visible:bg-white transition-all w-full" defaultValue={ag.cant_urs} onBlur={(e) => handleUpdateCelda('1109_agente', 'id_1109_agente', ag.id_1109_agente, 'cant_urs', e.target.value)} />
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-[10px] text-slate-400 w-6">Ded:</span>
                                                        <select className="w-full h-7 text-xs px-1 border border-transparent rounded bg-transparent hover:bg-white hover:border-slate-200 focus:ring-1 cursor-pointer transition-all" defaultValue={ag.dedicacion ? String(ag.dedicacion) : ""} onChange={(e) => handleUpdateCelda('1109_agente', 'id_1109_agente', ag.id_1109_agente, 'dedicacion', e.target.value)}>
                                                            <option value="" className="text-slate-300">-</option>
                                                            <option value="100">100%</option>
                                                            <option value="50">50%</option>
                                                        </select>
                                                    </div>
                                                </td>
                                                <td className="p-2 text-center align-middle">
                                                    <input 
                                                        type="checkbox" 
                                                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer mx-auto"
                                                        defaultChecked={ag.activo == 1} 
                                                        onChange={(e) => handleUpdateCelda('1109_agente', 'id_1109_agente', ag.id_1109_agente, 'activo', e.target.checked ? 1 : 0)} 
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* TABS: AUXILIARES */}
                    <TabsContent value="auxiliares">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <UrGrid title="Unidades Retributivas (UR)" data={aux.urs} pk="id_1109_ur" tabla="1109_ur" onUpdate={handleUpdateCelda} onAdd={() => handleNuevoAuxiliar('1109_ur')} />
                            <AuxiliarGrid title="Convenios" data={aux.convenios} pk="id_1109_convenio" tabla="1109_convenio" campo="descripcion" onUpdate={handleUpdateCelda} onAdd={() => handleNuevoAuxiliar('1109_convenio')} />
                            <AuxiliarGrid title="Niveles y Grados" data={aux.niveles} pk="id_1109_nivel_grado" tabla="1109_nivel_grado" campo="descripcion" onUpdate={handleUpdateCelda} onAdd={() => handleNuevoAuxiliar('1109_nivel_grado')} />
                            <AuxiliarGrid title="Tipos de Solicitud" data={aux.tipos} pk="id_1109_tipo_solicitud" tabla="1109_tipo_solicitud" campo="descripcion" onUpdate={handleUpdateCelda} onAdd={() => handleNuevoAuxiliar('1109_tipo_solicitud')} />
                        </div>
                    </TabsContent>
                </Tabs>
            </div>

            {/* MODAL: SUBIR Y PROCESAR FACTURAS */}
            <Dialog open={isFileModalOpen} onOpenChange={setIsFileModalOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-blue-700">
                            <FileText className="h-5 w-5" /> 
                            Procesar Archivos: {agentToUpload?.nombre}
                        </DialogTitle>
                        <DialogDescription>
                            {agentToUpload?.id_1109_tipo_solicitud == 2 
                                ? 'Agente de Dirección Nacional. Sube únicamente la factura en PDF. El sistema validará los datos y lo guardará directamente en la carpeta del mes.'
                                : 'Sube el PDF original de ARCA y el comprobante de pago. El sistema validará los datos, extraerá una "fotografía" en alta calidad de la factura para evitar corrupción y anexará el comprobante.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className={`grid grid-cols-1 ${agentToUpload?.id_1109_tipo_solicitud == 2 ? '' : 'md:grid-cols-2'} gap-6 py-4`}>
                        <div className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
                            <Label className="text-sm font-bold block mb-2">1. Factura ARCA (PDF)</Label>
                            <Input 
                                type="file" 
                                accept="application/pdf" 
                                className="bg-white"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) { setFacturaFile(file); procesarValidacionFactura(file); }
                                }} 
                            />
                            {validationFlags.leido && (
                                <div className="text-xs space-y-2 mt-3 bg-white p-3 rounded border shadow-sm">
                                    <div className="flex items-center gap-1">
                                        {validationFlags.cuitAgenteOk ? <Check className="text-green-500 h-4 w-4" /> : <XCircle className="text-red-500 h-4 w-4" />}
                                        <span className={validationFlags.cuitAgenteOk ? "text-green-700 font-medium" : "text-red-600 font-medium"}>CUIT Agente ({agentToUpload?.cuil})</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {validationFlags.cuitOk ? <Check className="text-green-500 h-4 w-4" /> : <XCircle className="text-red-500 h-4 w-4" />}
                                        <span className={validationFlags.cuitOk ? "text-green-700 font-medium" : "text-red-600 font-medium"}>CUIT Ministerio (30-54666342-2)</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {validationFlags.periodoOk ? <Check className="text-green-500 h-4 w-4" /> : <XCircle className="text-red-500 h-4 w-4" />}
                                        <span className={validationFlags.periodoOk ? "text-green-700 font-medium" : "text-red-600 font-medium"}>Período: {fechaPeriodoInfo.start} al {fechaPeriodoInfo.end}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {validationFlags.montoOk ? <Check className="text-green-500 h-4 w-4" /> : <AlertCircle className="text-amber-500 h-4 w-4" />}
                                        <span className={validationFlags.montoOk ? "text-green-700 font-medium" : "text-amber-600 font-medium"}>
                                            Monto Esperado: ${((agentToUpload?.cant_urs || 0) * valorUrActual).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                    <div className="pt-2 border-t mt-2">
                                        <Label className="text-[11px] font-bold text-slate-500 mb-1 block">Nro. Comprobante Extraído (Editable):</Label>
                                        <Input className="h-7 text-xs border-slate-300" value={nroComprobanteForm} onChange={e => setNroComprobanteForm(e.target.value)} placeholder="00000-00000000" />
                                    </div>
                                </div>
                            )}
                        </div>

                        {agentToUpload?.id_1109_tipo_solicitud != 2 && (
                            <div className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
                                <Label className="text-sm font-bold block mb-2">2. Comprobante Pago</Label>
                                <Input 
                                    type="file" 
                                    accept="application/pdf, image/jpeg, image/png" 
                                    className="bg-white"
                                    onChange={(e) => setComprobanteFile(e.target.files?.[0] || null)} 
                                />
                                <p className="text-[10px] text-slate-500">PDF o Imágenes (JPG/PNG). Se adjuntará como página 2.</p>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsFileModalOpen(false)}>Cancelar</Button>
                        <Button 
                            onClick={procesarYUnificar} 
                            disabled={!facturaFile || (agentToUpload?.id_1109_tipo_solicitud != 2 && !comprobanteFile) || isProcessingPdf} 
                            className="bg-blue-600"
                        >
                            {isProcessingPdf ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                            {isProcessingPdf ? "Procesando..." : (agentToUpload?.id_1109_tipo_solicitud == 2 ? "Validar y Guardar" : "Validar, Unificar y Guardar")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* MODAL: GENERAR WORD Y ZIP */}
            <Dialog open={isWordModalOpen} onOpenChange={(open) => { if (!isZipping) setIsWordModalOpen(open); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-purple-700">
                            <FileOutput className="h-5 w-5" /> 
                            Generar Paquete de Remisión (Word + PDFs)
                        </DialogTitle>
                        <DialogDescription>
                            Hay <b>{agentesListosParaNota.length}</b> facturas que fueron controladas y aún no se han incluido en ninguna tanda enviada a contabilidad.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 text-sm text-slate-600">
                        <ul className="list-disc pl-4 space-y-1 max-h-[150px] overflow-y-auto mb-4 border p-2 rounded bg-slate-50">
                            {agentesListosParaNota.map(ag => (
                                <li key={ag.id_1109_agente}><b>{ag.nombre}</b> - {ag.nro_comprobante}</li>
                            ))}
                        </ul>
                        <p>Al hacer clic, el sistema empaquetará la Nota de Remisión en Word junto con todas las facturas de la lista en un único archivo <b>.zip</b> y las marcará como enviadas.</p>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsWordModalOpen(false)} disabled={isZipping}>Cancelar</Button>
                        <Button onClick={generarWordYMarcar} disabled={isZipping} className="bg-purple-600 hover:bg-purple-700">
                            {isZipping ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                            {isZipping ? "Empaquetando..." : "Descargar ZIP y Marcar Enviadas"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={queueState.isActive} onOpenChange={() => {}}>
                <DialogContent onInteractOutside={(e) => e.preventDefault()} className="sm:max-w-md">
                    <DialogHeader><DialogTitle className="text-blue-700 flex items-center gap-2"><MessageSquare className="h-5 w-5" />Asistente de Envío Masivo</DialogTitle><DialogDescription>Abriendo WhatsApp Web uno por uno. Una vez que presiones "Enter" o enviar en tu WhatsApp, vuelve aquí y haz clic en Siguiente.</DialogDescription></DialogHeader>
                    {queueState.isActive && queueState.pendientes.length > 0 && (<div className="py-6 flex flex-col items-center justify-center space-y-4"><div className="text-3xl font-bold text-slate-800">{queueState.currentIndex + 1} / {queueState.pendientes.length}</div><div className="text-sm font-medium bg-slate-100 px-4 py-2 rounded-full">Siguiente destino: <span className="text-blue-600">{queueState.pendientes[queueState.currentIndex].nombre}</span></div></div>)}
                    <DialogFooter className="flex flex-row justify-between sm:justify-between w-full"><Button variant="ghost" className="text-slate-400" onClick={() => setQueueState({ isActive: false, pendientes: [], currentIndex: 0 })}><XOctagon className="mr-2 h-4 w-4" /> Cancelar Envío</Button><Button onClick={procesarPasoQueue} className="bg-green-600 hover:bg-green-700">{queueState.currentIndex === 0 ? "Abrir el Primero" : "Abrir Siguiente"} <StepForward className="ml-2 h-4 w-4" /></Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isModalPeriodo} onOpenChange={setIsModalPeriodo}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Abrir Período de Facturación</DialogTitle><DialogDescription>Se creará la nómina de control incluyendo únicamente a los agentes <b>Activos</b>.</DialogDescription></DialogHeader>
                    <div className="grid grid-cols-2 gap-4 py-4"><div className="space-y-2"><Label>Mes (1-12)</Label><Input type="number" min="1" max="12" value={nuevoPeriodo.mes} onChange={e => setNuevoPeriodo({...nuevoPeriodo, mes: parseInt(e.target.value)})}/></div><div className="space-y-2"><Label>Año</Label><Input type="number" value={nuevoPeriodo.anio} onChange={e => setNuevoPeriodo({...nuevoPeriodo, anio: parseInt(e.target.value)})}/></div></div>
                    <DialogFooter><Button onClick={crearPeriodoMasivo} className="w-full bg-blue-600">Crear Período</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isModalAgente} onOpenChange={setIsModalAgente}>
                <DialogContent className="max-w-4xl overflow-y-auto max-h-[90vh]">
                    <DialogHeader><DialogTitle>Alta de Agente 1109</DialogTitle><DialogDescription>El agente ingresará al sistema automáticamente con estado <b>Activo</b>.</DialogDescription></DialogHeader>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4">
                        <div className="space-y-2"><Label>Nombre Completo</Label><Input value={agenteData.nombre} onChange={e => setAgenteData({...agenteData, nombre: e.target.value})}/></div>
                        <div className="space-y-2"><Label>CUIL (sin guiones)</Label><Input value={agenteData.cuil} onChange={e => setAgenteData({...agenteData, cuil: e.target.value})}/></div>
                        <div className="space-y-2"><Label>Tipo de Solicitud</Label><Select value={String(agenteData.id_1109_tipo_solicitud)} onValueChange={v => setAgenteData({...agenteData, id_1109_tipo_solicitud: v})}><SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger><SelectContent>{aux.tipos?.map((t: any) => <SelectItem key={t.id_1109_tipo_solicitud} value={String(t.id_1109_tipo_solicitud)}>{t.descripcion}</SelectItem>)}</SelectContent></Select></div>
                        <div className="space-y-2"><Label>Dependencia</Label><Select value={agenteData.sigla} onValueChange={v => setAgenteData({...agenteData, sigla: v})}><SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger><SelectContent>{aux.dependencias?.map((d: any) => <SelectItem key={d.sigla} value={d.sigla}>{d.sigla}</SelectItem>)}</SelectContent></Select></div>
                        <div className="space-y-2"><Label>Convenio</Label><Select value={String(agenteData.id_1109_convenio)} onValueChange={v => setAgenteData({...agenteData, id_1109_convenio: v})}><SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger><SelectContent>{aux.convenios?.map((c: any) => <SelectItem key={c.id_1109_convenio} value={String(c.id_1109_convenio)}>{c.descripcion}</SelectItem>)}</SelectContent></Select></div>
                        <div className="space-y-2"><Label>Nivel / Grado</Label><Select value={String(agenteData.id_1109_nivel_grado)} onValueChange={v => setAgenteData({...agenteData, id_1109_nivel_grado: v})}><SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger><SelectContent>{aux.niveles?.map((n: any) => <SelectItem key={n.id_1109_nivel_grado} value={String(n.id_1109_nivel_grado)}>{n.descripcion}</SelectItem>)}</SelectContent></Select></div>
                        <div className="space-y-2"><Label>Cant. URs</Label><Input type="number" value={agenteData.cant_urs} onChange={e => setAgenteData({...agenteData, cant_urs: e.target.value})}/></div>
                        <div className="space-y-2"><Label>Dedicación (%)</Label><Select value={String(agenteData.dedicacion)} onValueChange={v => setAgenteData({...agenteData, dedicacion: v})}><SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger><SelectContent><SelectItem value="100">100</SelectItem><SelectItem value="50">50</SelectItem></SelectContent></Select></div>
                        <div className="space-y-2"><Label>Celular</Label><Input value={agenteData.celular} onChange={e => setAgenteData({...agenteData, celular: e.target.value})}/></div>
                        <div className="space-y-2 md:col-span-3"><Label>Email</Label><Input value={agenteData.correo_electronico} onChange={e => setAgenteData({...agenteData, correo_electronico: e.target.value})}/></div>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setIsModalAgente(false)}>Cancelar</Button><Button onClick={guardarAgente} className="bg-blue-600"><Save className="mr-2 h-4 w-4" /> Guardar Agente</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    )
}

function UrGrid({ title, data, pk, tabla, onUpdate, onAdd }: any) {
    return (
        <Card className="md:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2 border-b"><CardTitle className="text-sm font-bold uppercase">{title}</CardTitle><Button size="sm" variant="ghost" onClick={onAdd}><Plus className="h-4 w-4" /></Button></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b text-left"><tr><th className="p-2 w-12">ID</th><th className="p-2">Valor ($)</th><th className="p-2">Fecha Desde</th><th className="p-2">Fecha Hasta</th></tr></thead>
                    <tbody>
                        {data?.map((item: any) => (
                            <tr key={item[pk]} className="border-b last:border-0">
                                <td className="p-2 text-slate-400">#{item[pk]}</td>
                                <td className="p-1"><Input type="number" className="h-7 border-none text-xs focus-visible:ring-1" defaultValue={item.valor} onBlur={(e) => onUpdate(tabla, pk, item[pk], 'valor', e.target.value)} /></td>
                                <td className="p-1"><Input type="date" className="h-7 border-none text-xs focus-visible:ring-1" defaultValue={item.fecha_desde} onBlur={(e) => onUpdate(tabla, pk, item[pk], 'fecha_desde', e.target.value)} /></td>
                                <td className="p-1"><Input type="date" className="h-7 border-none text-xs focus-visible:ring-1" defaultValue={item.fecha_hasta || ''} onBlur={(e) => onUpdate(tabla, pk, item[pk], 'fecha_hasta', e.target.value)} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </CardContent>
        </Card>
    )
}

function AuxiliarGrid({ title, data, pk, tabla, campo, onUpdate, onAdd }: any) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 border-b"><CardTitle className="text-sm font-bold uppercase">{title}</CardTitle><Button size="sm" variant="ghost" onClick={onAdd}><Plus className="h-4 w-4" /></Button></CardHeader>
            <CardContent className="p-0">
                <table className="w-full text-xs">
                    <tbody>
                        {data?.map((item: any) => (
                            <tr key={item[pk]} className="border-b last:border-0">
                                <td className="p-2 text-slate-400 w-10">#{item[pk]}</td>
                                <td className="p-1"><Input className="h-7 border-none text-xs focus-visible:ring-1" defaultValue={item[campo]} onBlur={(e) => onUpdate(tabla, pk, item[pk], campo, e.target.value)} /></td>
                                <td className="p-1 text-center w-12"><input type="checkbox" className="rounded border-gray-300" defaultChecked={item.vigente == 1} onChange={(e) => onUpdate(tabla, pk, item[pk], 'vigente', e.target.checked ? 1 : 0)} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </CardContent>
        </Card>
    )
}