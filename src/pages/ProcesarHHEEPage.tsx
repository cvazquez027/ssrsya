import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { Upload, FileSpreadsheet, Loader2, Download, CalendarCheck, Plus, Trash2, UserX, ShieldAlert } from "lucide-react"
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const API_BASE = "http://localhost/planificacion/api-backend";

interface Agent {
    cuil: string;
    nombre: string;
    rowIndex: number;
}

interface ManualLicense {
    cuil: string;
    nombre: string;
    dias: number[];
}

export default function ProcesarHHEEPage() {
    const { toast } = useToast()
    
    // --- CIRUGÍA DE SEGURIDAD ---
    const [verificandoAcceso, setVerificandoAcceso] = useState(true);
    const [accesoDenegado, setAccesoDenegado] = useState(false);

    // Estados generales
    const [step, setStep] = useState(1); 
    const [loading, setLoading] = useState(false)
    const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
    const [fileName, setFileName] = useState("")

    // Configuración Algoritmo
    const [ignorarFeriados, setIgnorarFeriados] = useState(false) 
    const [feriadosPermitidosInput, setFeriadosPermitidosInput] = useState("") 

    // Configuración Licencias Manuales
    const [agents, setAgents] = useState<Agent[]>([]);
    const [selectedAgentCuil, setSelectedAgentCuil] = useState("");
    const [manualDaysInput, setManualDaysInput] = useState("");
    const [manualLicenses, setManualLicenses] = useState<ManualLicense[]>([]);

    const COLOR_LICENCIA_HEX = 'FFFCE4D6'; 
    const COLOR_LICENCIA = ['FFFCE4D6', 'FCE4D6', 'FFE4C4', 'FFDAB9']; 
    const COLOR_FERIADO_COLUMNA = ['FFFFE699', 'FFE699', 'FFFACD'];

    useEffect(() => {
        const verificarSesion = async () => {
            try {
                const resUser = await fetch(`${API_BASE}/usuario.php`, { credentials: 'include' });
                const userData = await resUser.json();
                
                // CIRUGÍA: Validamos permisos de módulo RRHH
                if (!userData.permisos?.['RRHH']) {
                    setAccesoDenegado(true);
                }
            } catch (e) {
                console.error("Error al validar la sesión:", e);
                setAccesoDenegado(true);
            } finally {
                setVerificandoAcceso(false);
            }
        };
        
        verificarSesion();
    }, []);

    // --- PASO 1: ANÁLISIS DEL ARCHIVO ---
    const handleFileAnalyze = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setFileName(file.name);
        setLoading(true);

        try {
            const buffer = await file.arrayBuffer();
            setFileBuffer(buffer); 

            const workbook = new ExcelJS.Workbook();
            const data = new Uint8Array(buffer); 
            await workbook.xlsx.load(data as any);
            const ws = workbook.getWorksheet(1);
            if (!ws) throw new Error("No se encontró la hoja 1");

            let colCuil = 1; 
            let colNombre = 2;
            
            ws.getRow(3).eachCell((cell, colNum) => {
                const val = cell.value?.toString().toUpperCase() || "";
                if (val.includes("CUIL")) colCuil = colNum;
                if (val.includes("AGENTE") || val.includes("N Y G") || val.includes("NOMBRE")) colNombre = colNum;
            });

            const loadedAgents: Agent[] = [];
            ws.eachRow((row, rowNum) => {
                if (rowNum < 4) return;
                const cuil = row.getCell(colCuil).value?.toString();
                const nombre = row.getCell(colNombre).value?.toString();
                
                if (cuil && cuil.length > 5 && nombre) {
                    loadedAgents.push({ cuil, nombre, rowIndex: rowNum });
                }
            });

            setAgents(loadedAgents);
            setStep(2); 

        } catch (error: any) {
            console.error(error);
            toast({ title: "Error al leer", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    // --- PASO 2: GESTIÓN DE LICENCIAS ---
    const addManualLicense = () => {
        if (!selectedAgentCuil || !manualDaysInput) return;

        const agent = agents.find(a => a.cuil === selectedAgentCuil);
        if (!agent) return;

        const days = manualDaysInput.split(',').map(d => parseInt(d.trim())).filter(n => !isNaN(n) && n > 0 && n <= 31);
        
        if (days.length === 0) {
            toast({ title: "Error", description: "Ingrese días válidos separados por coma", variant: "destructive" });
            return;
        }

        const newLicense: ManualLicense = { cuil: agent.cuil, nombre: agent.nombre, dias: days };

        const existingIdx = manualLicenses.findIndex(l => l.cuil === agent.cuil);
        if (existingIdx >= 0) {
            const updated = [...manualLicenses];
            updated[existingIdx].dias = [...new Set([...updated[existingIdx].dias, ...days])].sort((a,b)=>a-b);
            setManualLicenses(updated);
        } else {
            setManualLicenses([...manualLicenses, newLicense]);
        }

        setManualDaysInput("");
        setSelectedAgentCuil("");
    };

    const removeLicense = (cuil: string) => {
        setManualLicenses(manualLicenses.filter(l => l.cuil !== cuil));
    };

    // --- PASO 3: PROCESAMIENTO FINAL ---
    const handleProcess = async () => {
        if (!fileBuffer) return;
        setLoading(true);

        try {
            const workbook = new ExcelJS.Workbook();
            const data = new Uint8Array(fileBuffer); 
            await workbook.xlsx.load(data as any);
            const ws = workbook.getWorksheet(1);
            if (!ws) throw new Error("Error inesperado en hoja de cálculo");

            procesarPlanilla(ws);

            const outBuffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([outBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
            saveAs(blob, `PROCESADO_${fileName}`);
            
            toast({ title: "Proceso Terminado", description: "Se han aplicado las licencias y calculado las horas." });
            setStep(3); 

        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const procesarPlanilla = (ws: ExcelJS.Worksheet) => {
        let colTope = -1;
        let colComidas = -1;
        let colNivel = 3; 
        const daysMap: any[] = []; 

        const diasFeriadosPermitidos = feriadosPermitidosInput.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));

        ws.getRow(2).eachCell((cell, colNumber) => {
            const val = cell.value?.toString().toUpperCase() || "";
            if (val.includes("LUNES") || val.includes("MARTES") || val.includes("MIÉRCOLES") || val.includes("MIERCOLES") || val.includes("JUEVES") || val.includes("VIERNES") || val.includes("SÁBADO") || val.includes("SABADO") || val.includes("DOMINGO")) {
                let tipo = 'simple';
                if (val.includes("50%")) tipo = '50';
                if (val.includes("100%")) tipo = '100';

                const cellRow1 = ws.getCell(1, colNumber);
                const esFeriadoHeader = cellRow1.value?.toString().toUpperCase().includes("FERIADO");
                const cellRow3 = ws.getCell(3, colNumber);
                const diaNum = parseInt(cellRow3.value?.toString() || "0");

                if (diaNum > 0) {
                    daysMap.push({ colIndex: colNumber, dia: diaNum, tipo, esFeriadoHeader });
                }
            }
        });

        ws.getRow(3).eachCell((cell, colNumber) => {
            const val = cell.value?.toString().toUpperCase().trim() || "";
            if (val.includes("CANTIDAD TOTAL PASADAS")) colTope = colNumber;
            if (val === "COMIDAS") colComidas = colNumber;
        });

        let colCuil = 1;
        ws.getRow(3).eachCell((c, i) => { if(c.value?.toString().toUpperCase().includes("CUIL")) colCuil = i; });

        ws.eachRow((row, rowNumber) => {
            if (rowNumber < 4) return;
            const cuilRow = row.getCell(colCuil).value?.toString();
            
            const lic = manualLicenses.find(l => l.cuil == cuilRow);
            if (lic) {
                lic.dias.forEach(dia => {
                    const colsDelDia = daysMap.filter(d => d.dia === dia);
                    colsDelDia.forEach(d => {
                        const cell = row.getCell(d.colIndex);
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: COLOR_LICENCIA_HEX }
                        };
                        cell.value = null;
                    });
                });
            }
        });

        ws.eachRow((row, rowNumber) => {
            if (rowNumber < 4) return; 

            const celdaNivel = row.getCell(colNivel).value?.toString() || "";
            const matchNivel = celdaNivel.match(/(?:GRAL|GENERAL)\s*([A-F])/i);
            if (!matchNivel) return; 
            
            const letraNivel = matchNivel[1].toUpperCase();
            const jornadaNormal = (letraNivel === 'E' || letraNivel === 'F') ? 7 : 8;
            const maxExtrasSemana = (12 - jornadaNormal); 
            const minParaComida = (9 - jornadaNormal); 

            const celdaTope = row.getCell(colTope);
            let tope = parseFloat(celdaTope.value?.toString() || "0");
            
            if (tope <= 0) return; 

            daysMap.forEach(d => {
                const cell = row.getCell(d.colIndex);
                const fill = cell.style.fill as any;
                const fgColor = fill?.fgColor?.argb;
                const esLic = fgColor && COLOR_LICENCIA.some(c => fgColor.includes(c));
                
                if (!esLic) {
                    cell.value = null;
                }
            });

            let horasAsignadasSimples = 0;

            const esLicencia = (colIndex: number) => {
                const cell = row.getCell(colIndex);
                const fill = cell.style.fill as any;
                const fgColor = fill?.fgColor?.argb; 
                return (fgColor && COLOR_LICENCIA.some(c => fgColor.includes(c)));
            }

            const esFeriado = (colIndex: number, esFeriadoHeader: boolean | undefined) => {
                if (esFeriadoHeader) return true;
                const cell = row.getCell(colIndex);
                const fill = cell.style.fill as any;
                const fgColor = fill?.fgColor?.argb; 
                if (fgColor && COLOR_FERIADO_COLUMNA.some(c => fgColor.includes(c))) return true;
                return false;
            }

            const getVal = (colIdx: number) => Number(row.getCell(colIdx).value) || 0;
            const setVal = (colIdx: number, val: number) => row.getCell(colIdx).value = val;

            for (const d of daysMap) {
                if (horasAsignadasSimples >= tope) break;
                if (esFeriado(d.colIndex, d.esFeriadoHeader) || esLicencia(d.colIndex)) continue;

                if (d.tipo === 'simple') {
                    const costo = 1;
                    const necesario = minParaComida;
                    if ((tope - horasAsignadasSimples) >= (necesario * costo)) {
                        setVal(d.colIndex, necesario);
                        horasAsignadasSimples += (necesario * costo);
                    }
                }
            }

            if (horasAsignadasSimples < tope) {
                const diasFinde = [...new Set(daysMap.filter(d => (d.tipo === '50' || d.tipo === '100')).map(d => d.dia))];
                for (const diaNum of diasFinde) {
                    if (horasAsignadasSimples >= tope) break;
                    const col50 = daysMap.find(d => d.dia === diaNum && d.tipo === '50');
                    const col100 = daysMap.find(d => d.dia === diaNum && d.tipo === '100');
                    const esLic = (col50 && esLicencia(col50.colIndex)) || (col100 && esLicencia(col100.colIndex));
                    const esFer = (col50 && esFeriado(col50.colIndex, col50.esFeriadoHeader)) || (col100 && esFeriado(col100.colIndex, col100.esFeriadoHeader));
                    if (esLic || esFer) continue;

                    if (col50 && col100) { 
                        const carga50 = 5; const costo50 = 1.5;
                        const carga100 = 4; const costo100 = 2.0;
                        const costoTotal = (carga50 * costo50) + (carga100 * costo100);
                        if ((tope - horasAsignadasSimples) >= costoTotal) {
                            setVal(col50.colIndex, carga50);
                            setVal(col100.colIndex, carga100);
                            horasAsignadasSimples += costoTotal;
                        }
                    } else if (col100 && !col50) { 
                         const carga = 9; const costo = 2.0;
                         if ((tope - horasAsignadasSimples) >= (carga * costo)) {
                             setVal(col100.colIndex, carga);
                             horasAsignadasSimples += (carga * costo);
                         }
                    }
                }
            }

            if (horasAsignadasSimples < tope) {
                for (const d of daysMap) {
                    if (horasAsignadasSimples >= tope) break;
                    if (d.tipo !== 'simple' || esFeriado(d.colIndex, d.esFeriadoHeader) || esLicencia(d.colIndex)) continue;
                    const actual = getVal(d.colIndex);
                    const espacio = maxExtrasSemana - actual;
                    if (espacio > 0) {
                        let carga = Math.min(espacio, (tope - horasAsignadasSimples)); 
                        carga = Math.floor(carga);
                        if (carga > 0) {
                            setVal(d.colIndex, actual + carga);
                            horasAsignadasSimples += carga;
                        }
                    }
                }
            }

            if (horasAsignadasSimples < tope) {
                const diasSabado = [...new Set(daysMap.filter(d => d.tipo === '50').map(d => d.dia))];
                for (const diaNum of diasSabado) {
                    if (horasAsignadasSimples >= tope) break;
                    const col50 = daysMap.find(d => d.dia === diaNum && d.tipo === '50');
                    const col100 = daysMap.find(d => d.dia === diaNum && d.tipo === '100');
                    if (!col50 || !col100) continue;
                    if (esLicencia(col50.colIndex) || esFeriado(col50.colIndex, col50.esFeriadoHeader)) continue;

                    let val50 = getVal(col50.colIndex);
                    if (val50 < 5) {
                        let espacio = 5 - val50;
                        let carga = Math.min(espacio, (tope - horasAsignadasSimples) / 1.5);
                        carga = Math.floor(carga);
                        if (carga > 0) {
                            setVal(col50.colIndex, val50 + carga);
                            horasAsignadasSimples += (carga * 1.5);
                            val50 += carga;
                        }
                    }
                    if (horasAsignadasSimples < tope) {
                        let val100 = getVal(col100.colIndex);
                        let totalDia = val50 + val100;
                        let espacioReal = Math.min(12 - totalDia, 11 - val100); 
                        if (espacioReal > 0) {
                            let carga = Math.min(espacioReal, (tope - horasAsignadasSimples) / 2.0);
                            carga = Math.floor(carga);
                            if (carga > 0) {
                                setVal(col100.colIndex, val100 + carga);
                                horasAsignadasSimples += (carga * 2.0);
                            }
                        }
                    }
                }
            }

            if (horasAsignadasSimples < tope) {
                const diasDomingo = daysMap.filter(d => d.tipo === '100' && !daysMap.find(x => x.dia === d.dia && x.tipo === '50'));
                for (const d of diasDomingo) {
                    if (horasAsignadasSimples >= tope) break;
                    if (esFeriado(d.colIndex, d.esFeriadoHeader) || esLicencia(d.colIndex)) continue;
                    const actual = getVal(d.colIndex);
                    const espacio = 12 - actual;
                    if (espacio > 0) {
                        let carga = Math.min(espacio, (tope - horasAsignadasSimples) / 2.0);
                        carga = Math.floor(carga);
                        if (carga > 0) {
                            setVal(d.colIndex, actual + carga);
                            horasAsignadasSimples += (carga * 2.0);
                        }
                    }
                }
            }

            if (horasAsignadasSimples < tope) {
                const diasSabado = [...new Set(daysMap.filter(d => d.tipo === '50').map(d => d.dia))];
                for (const diaNum of diasSabado) {
                    if (horasAsignadasSimples < 0.5) break; 
                    const col50 = daysMap.find(d => d.dia === diaNum && d.tipo === '50');
                    const col100 = daysMap.find(d => d.dia === diaNum && d.tipo === '100');
                    if (!col50 || !col100) continue;
                    if (esLicencia(col50.colIndex) || esFeriado(col50.colIndex, col50.esFeriadoHeader)) continue;

                    let val50 = getVal(col50.colIndex);
                    let val100 = getVal(col100.colIndex);
                    while (val50 > 0 && val100 < 11 && (tope - horasAsignadasSimples) >= 0.5) {
                        val50--; val100++; horasAsignadasSimples += 0.5; 
                    }
                    setVal(col50.colIndex, val50);
                    setVal(col100.colIndex, val100);
                }
            }

            if (horasAsignadasSimples < tope) {
                for (const d of daysMap) {
                    if (horasAsignadasSimples >= tope) break;
                    if (!esFeriado(d.colIndex, d.esFeriadoHeader)) continue; 
                    if (esLicencia(d.colIndex)) continue;
                    const permitido = ignorarFeriados || diasFeriadosPermitidos.includes(d.dia);
                    if (permitido) {
                        const actual = getVal(d.colIndex);
                        let cost = (d.tipo === '50') ? 1.5 : (d.tipo === '100' ? 2.0 : 1.0);
                        const espacio = 12 - actual;
                        if (espacio > 0) {
                            let carga = Math.min(espacio, (tope - horasAsignadasSimples) / cost);
                            carga = Math.floor(carga);
                            if (carga > 0) {
                                setVal(d.colIndex, actual + carga);
                                horasAsignadasSimples += (carga * cost);
                            }
                        }
                    }
                }
            }

            if (colComidas !== -1) {
                let recuentoComidas = 0;
                const diasUnicos = [...new Set(daysMap.map(d => d.dia))];
                diasUnicos.forEach(dia => {
                    const columnasDelDia = daysMap.filter(d => d.dia === dia);
                    let horasExtrasDia = 0;
                    let esDiaHabilSimple = false;
                    columnasDelDia.forEach(d => {
                        horasExtrasDia += getVal(d.colIndex);
                        if (d.tipo === 'simple' && !esFeriado(d.colIndex, d.esFeriadoHeader) && !esLicencia(d.colIndex)) {
                            esDiaHabilSimple = true;
                        }
                    });
                    let horasTotales = horasExtrasDia;
                    if (esDiaHabilSimple) horasTotales += jornadaNormal;
                    if (horasTotales >= 9) recuentoComidas++;
                });
                setVal(colComidas, recuentoComidas);
            }
        });
    }

    if (verificandoAcceso) {
        return (
            <DashboardLayout currentSection="Recursos Humanos">
                <div className="flex justify-center items-center h-[60vh]">
                    <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                </div>
            </DashboardLayout>
        );
    }

    if (accesoDenegado) {
        return (
            <DashboardLayout currentSection="Recursos Humanos">
                <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500 space-y-4">
                    <ShieldAlert className="h-16 w-16 text-red-500 mb-2" />
                    <h2 className="text-2xl font-bold text-slate-800">Acceso Denegado</h2>
                    <p>No tenés permisos para visualizar el módulo de Recursos Humanos.</p>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout currentSection="Recursos Humanos">
            <div className="max-w-3xl mx-auto space-y-6 animate-in slide-in-from-bottom-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileSpreadsheet className="h-6 w-6 text-green-600" />
                            Procesador de Horas Extras
                        </CardTitle>
                        <CardDescription>
                            Automatiza la carga, gestiona licencias faltantes y optimiza comidas.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">

                        {step === 1 && (
                            <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-10 hover:bg-slate-50 transition-colors">
                                {loading ? (
                                    <div className="text-center space-y-3">
                                        <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto" />
                                        <p className="text-sm text-muted-foreground">Analizando agentes...</p>
                                    </div>
                                ) : (
                                    <>
                                        <Input type="file" accept=".xlsx" onChange={handleFileAnalyze} className="hidden" id="file-upload" />
                                        <label htmlFor="file-upload" className="cursor-pointer text-center space-y-2">
                                            <div className="bg-blue-100 p-3 rounded-full w-fit mx-auto">
                                                <Upload className="h-6 w-6 text-blue-600" />
                                            </div>
                                            <div className="font-medium text-slate-900">1. Subir Planilla (.xlsx)</div>
                                            <p className="text-xs text-slate-500">Se analizarán los agentes para cargar licencias.</p>
                                        </label>
                                    </>
                                )}
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                                <div className="bg-blue-50 p-3 rounded text-sm text-blue-800 flex justify-between items-center">
                                    <span>Archivo: <strong>{fileName}</strong> ({agents.length} agentes encontrados)</span>
                                    <Button variant="ghost" size="sm" onClick={() => {setStep(1); setAgents([]); setManualLicenses([]);}}>Cambiar archivo</Button>
                                </div>

                                <div className="border rounded-lg p-4 space-y-4">
                                    <h3 className="font-semibold flex items-center gap-2"><UserX className="h-4 w-4 text-orange-500"/> Cargar Licencias Faltantes</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                                        <div className="md:col-span-2 space-y-1">
                                            <Label>Agente</Label>
                                            <Select value={selectedAgentCuil} onValueChange={setSelectedAgentCuil}>
                                                <SelectTrigger><SelectValue placeholder="Buscar Agente..." /></SelectTrigger>
                                                <SelectContent>
                                                    {agents.map(a => (
                                                        <SelectItem key={a.cuil} value={a.cuil}>{a.cuil} - {a.nombre}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="md:col-span-2 space-y-1">
                                            <Label>Días de Licencia (ej: 4, 5, 20)</Label>
                                            <Input 
                                                value={manualDaysInput} 
                                                onChange={e => setManualDaysInput(e.target.value)} 
                                                placeholder="Separados por coma"
                                            />
                                        </div>
                                        <div>
                                            <Button onClick={addManualLicense} className="w-full bg-orange-600 hover:bg-orange-700">
                                                <Plus className="h-4 w-4 mr-1"/> Agregar
                                            </Button>
                                        </div>
                                    </div>

                                    {manualLicenses.length > 0 && (
                                        <div className="bg-slate-50 rounded border max-h-40 overflow-y-auto">
                                            <Table>
                                                <TableHeader><TableRow><TableHead>CUIL</TableHead><TableHead>Agente</TableHead><TableHead>Días Marcados</TableHead><TableHead></TableHead></TableRow></TableHeader>
                                                <TableBody>
                                                    {manualLicenses.map(l => (
                                                        <TableRow key={l.cuil} className="h-10">
                                                            <TableCell className="py-2">{l.cuil}</TableCell>
                                                            <TableCell className="py-2">{l.nombre}</TableCell>
                                                            <TableCell className="py-2 font-bold text-orange-600">{l.dias.join(', ')}</TableCell>
                                                            <TableCell className="py-2 text-right">
                                                                <Button variant="ghost" size="sm" onClick={() => removeLicense(l.cuil)} className="h-6 w-6 p-0 text-red-500"><Trash2 className="h-4 w-4"/></Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                                </div>

                                <div className="border rounded-lg p-4 space-y-4 bg-slate-50">
                                    <h3 className="font-semibold flex items-center gap-2"><CalendarCheck className="h-4 w-4 text-purple-500"/> Configuración de Feriados</h3>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox id="feriados" checked={ignorarFeriados} onCheckedChange={(c) => setIgnorarFeriados(!!c)}/>
                                        <Label htmlFor="feriados">Usar TODOS los feriados si sobra tope</Label>
                                    </div>
                                    <div className="relative">
                                        <Label className="text-xs text-muted-foreground mb-1">O habilitar días puntuales:</Label>
                                        <Input placeholder="Ej: 8, 25, 31" className="bg-white" value={feriadosPermitidosInput} onChange={e => setFeriadosPermitidosInput(e.target.value)} disabled={ignorarFeriados} />
                                    </div>
                                </div>

                                <Button onClick={handleProcess} className="w-full h-12 text-lg bg-green-600 hover:bg-green-700" disabled={loading}>
                                    {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Download className="mr-2 h-5 w-5"/>}
                                    Confirmar y Procesar
                                </Button>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="text-center py-10 space-y-4 animate-in zoom-in-95">
                                <div className="bg-green-100 p-4 rounded-full w-fit mx-auto text-green-700"><Download className="h-10 w-10"/></div>
                                <h3 className="text-2xl font-bold text-green-800">¡Procesamiento Exitoso!</h3>
                                <p className="text-slate-600">El archivo se ha descargado en tu equipo.</p>
                                <Button variant="outline" onClick={() => {setStep(1); setAgents([]); setManualLicenses([]); setFileBuffer(null);}}>Procesar otro archivo</Button>
                            </div>
                        )}

                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    )
}