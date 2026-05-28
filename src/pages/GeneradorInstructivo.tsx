import { Button } from "@/components/ui/button";
import jsPDF from "jspdf";
import { FileDown } from "lucide-react";

export function GeneradorInstructivo() {
    
    const generarPDF = () => {
        // Inicializamos el documento A4
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        // ==========================================
        // PÁGINA 1: PORTADA
        // ==========================================
        // Logo central (Asegurate de que logo-msal.png esté en la carpeta public)
        doc.addImage('/logo-msal.png', 'PNG', (pageWidth - 60) / 2, 60, 60, 60);
        
        doc.setFontSize(18);
        doc.setTextColor(80, 80, 80);
        doc.setFont('helvetica', 'bold');
        doc.text("Subsecretaría de Relaciones Sectoriales y Articulación", pageWidth / 2, 150, { align: 'center' });
        
        doc.setFontSize(26);
        doc.setTextColor(15, 60, 120); // Azul institucional
        const title = doc.splitTextToSize("Instructivo de Solicitud de Acceso al Sistema de Gestión y Planificación", pageWidth - 40);
        doc.text(title, pageWidth / 2, 170, { align: 'center' });


        // ==========================================
        // PÁGINA 2: PASO 1
        // ==========================================
        doc.addPage();
        doc.setFontSize(20);
        doc.setTextColor(15, 60, 120);
        doc.setFont('helvetica', 'bold');
        doc.text("Paso 1: Ingreso al sitio", 20, 30);
        
        doc.setFontSize(12);
        doc.setTextColor(70, 70, 70);
        doc.setFont('helvetica', 'normal');
        doc.text("Abra su navegador web de preferencia (se recomienda Google Chrome o Mozilla Firefox)\ne ingrese a la siguiente dirección URL:", 20, 45);
        
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(2, 132, 199); // Azul enlace
        doc.text("https://ssrsya.my-board.org", 20, 58);

        // -- Simulación de Pantalla: Login --
        doc.setDrawColor(200, 200, 200);
        doc.setFillColor(245, 247, 250);
        doc.roundedRect(20, 75, 170, 120, 3, 3, 'FD'); // Ventana del navegador
        
        doc.setFillColor(220, 220, 220); 
        doc.rect(20, 75, 170, 10, 'F'); // Barra superior gris
        doc.setFillColor(255, 255, 255); 
        doc.rect(40, 77, 100, 6, 'F'); // Barra de URL
        
        doc.setFontSize(8); doc.setTextColor(100, 100, 100); doc.setFont('helvetica', 'normal');
        doc.text("ssrsya.my-board.org", 43, 81.5);
        
        // Caja de Login (Adaptada a la captura real)
        doc.setFillColor(255, 255, 255); 
        doc.roundedRect(60, 90, 90, 95, 2, 2, 'FD');
        
        // Logo Simulado
        doc.setFontSize(14); doc.setTextColor(15, 60, 120); doc.setFont('helvetica', 'bold');
        doc.text("SSRSyA", 105, 102, { align: 'center' });
        doc.setFontSize(7); doc.setTextColor(150, 150, 150); doc.setFont('helvetica', 'normal');
        doc.text("Gestión y Planificación", 105, 106, { align: 'center' });

        doc.setFontSize(12); doc.setTextColor(50, 50, 50); doc.setFont('helvetica', 'bold');
        doc.text("Iniciar Sesión", 105, 115, { align: 'center' });
        doc.setFontSize(8); doc.setTextColor(100, 100, 100); doc.setFont('helvetica', 'normal');
        doc.text("Ingrese sus credenciales para acceder al sistema", 105, 120, { align: 'center' });
        
        // Input Usuario
        doc.setFontSize(8); doc.setTextColor(50, 50, 50); doc.setFont('helvetica', 'bold');
        doc.text("Usuario", 70, 130);
        doc.setDrawColor(220, 220, 220); doc.setFillColor(255, 255, 255); 
        doc.rect(70, 132, 70, 8, 'FD');
        doc.setFont('helvetica', 'normal'); doc.setTextColor(150, 150, 150);
        doc.text("nombre.apellido", 72, 137.5);

        // Input Contraseña
        doc.setTextColor(50, 50, 50); doc.setFont('helvetica', 'bold');
        doc.text("Contraseña", 70, 146);
        doc.rect(70, 148, 70, 8, 'FD');
        doc.setFont('helvetica', 'normal'); doc.setTextColor(150, 150, 150);
        doc.text("********", 72, 153.5);
        
        // Botón Login
        doc.setFillColor(37, 99, 235); doc.rect(70, 160, 70, 9, 'F'); 
        doc.setFontSize(9); doc.setTextColor(255, 255, 255); doc.text("Ingresar", 105, 166, { align: 'center' });
        
        // Link Registro
        doc.setFontSize(8); doc.setTextColor(100, 100, 100); doc.setFont('helvetica', 'normal');
        doc.text("¿No tenés cuenta? ", 95, 175, { align: 'right' });
        doc.setTextColor(37, 99, 235); doc.text("Solicitá acceso aquí", 96, 175, { align: 'left' });

        // Recuadro rojo resaltando el link
        doc.setDrawColor(220, 38, 38);
        doc.setLineWidth(0.8);
        doc.rect(94, 171, 45, 6, 'S');

        doc.setFontSize(11);
        doc.setTextColor(50, 50, 50);
        const txtPaso1 = doc.splitTextToSize("En la pantalla de inicio, ubique y haga clic en la opción \"Solicitá acceso aquí\" que se encuentra resaltada debajo del botón de ingreso.", 170);
        doc.text(txtPaso1, 20, 210);


        // ==========================================
        // PÁGINA 3: PASO 2
        // ==========================================
        doc.addPage();
        doc.setFontSize(20);
        doc.setTextColor(15, 60, 120);
        doc.setFont('helvetica', 'bold');
        doc.text("Paso 2: Completar el formulario", 20, 30);

        doc.setFontSize(12);
        doc.setTextColor(70, 70, 70);
        doc.setFont('helvetica', 'normal');
        const txtPaso2 = doc.splitTextToSize("Se abrirá un formulario de registro. Complete todos los campos solicitados con sus datos reales e institucionales.", 170);
        doc.text(txtPaso2, 20, 45);

        // -- Simulación de Pantalla: Registro (Adaptada a la captura real) --
        doc.setDrawColor(200, 200, 200); 
        doc.setLineWidth(0.2);
        doc.setFillColor(245, 247, 250);
        doc.roundedRect(20, 60, 170, 165, 3, 3, 'FD'); 
        
        doc.setFillColor(220, 220, 220); 
        doc.rect(20, 60, 170, 10, 'F'); 
        
        doc.setFillColor(255, 255, 255); 
        doc.roundedRect(45, 75, 120, 140, 2, 2, 'FD');
        
        doc.setFontSize(14); doc.setTextColor(50, 50, 50); doc.setFont('helvetica', 'bold');
        doc.text("Solicitar Acceso", 105, 87, { align: 'center' });
        doc.setFontSize(8); doc.setTextColor(100, 100, 100); doc.setFont('helvetica', 'normal');
        doc.text("Complete sus datos institucionales para solicitar acceso al sistema.", 105, 92, { align: 'center' });

        // Nombre | Apellido
        doc.setFont('helvetica', 'bold'); doc.setTextColor(50, 50, 50);
        doc.text("Nombre", 55, 102); doc.rect(55, 104, 48, 8, 'S');
        doc.setFont('helvetica', 'normal'); doc.setTextColor(150, 150, 150); doc.text("Juan", 57, 109.5);

        doc.setFont('helvetica', 'bold'); doc.setTextColor(50, 50, 50);
        doc.text("Apellido", 107, 102); doc.rect(107, 104, 48, 8, 'S');
        doc.setFont('helvetica', 'normal'); doc.setTextColor(150, 150, 150); doc.text("Pérez", 109, 109.5);

        // CUIL
        doc.setFont('helvetica', 'bold'); doc.setTextColor(50, 50, 50);
        doc.text("CUIL", 55, 118); doc.rect(55, 120, 100, 8, 'S');
        doc.setFont('helvetica', 'normal'); doc.setTextColor(150, 150, 150); doc.text("Sin guiones, ej: 20123456789", 57, 125.5);

        // Correo Electrónico
        doc.setFont('helvetica', 'bold'); doc.setTextColor(50, 50, 50);
        doc.text("Correo Electrónico", 55, 134); doc.rect(55, 136, 100, 8, 'S');
        doc.setFont('helvetica', 'normal'); doc.setTextColor(150, 150, 150); doc.text("juan.perez@msal.gov.ar", 57, 141.5);

        // Contraseña | Confirmar
        doc.setFont('helvetica', 'bold'); doc.setTextColor(50, 50, 50);
        doc.text("Contraseña", 55, 150); doc.rect(55, 152, 48, 8, 'S');
        doc.setFont('helvetica', 'normal'); doc.setTextColor(150, 150, 150); doc.text("********", 57, 157.5);

        doc.setFont('helvetica', 'bold'); doc.setTextColor(50, 50, 50);
        doc.text("Confirmar Contraseña", 107, 150); doc.rect(107, 152, 48, 8, 'S');
        doc.setFont('helvetica', 'normal'); doc.setTextColor(150, 150, 150); doc.text("********", 109, 157.5);

        // Dependencia
        doc.setFont('helvetica', 'bold'); doc.setTextColor(50, 50, 50);
        doc.text("Dependencia", 55, 166); doc.rect(55, 168, 100, 8, 'S');
        doc.setFont('helvetica', 'normal'); doc.setTextColor(150, 150, 150); doc.text("Seleccione su dependencia...", 57, 173.5);
        doc.text("v", 150, 173.5); // Flechita del Select

        // Botón Enviar
        doc.setFillColor(22, 163, 74); 
        doc.rect(55, 182, 100, 10, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(255, 255, 255); 
        doc.text("Enviar Solicitud", 105, 188.5, { align: 'center' });

        // Link Login
        doc.setFontSize(8); doc.setTextColor(100, 100, 100); doc.setFont('helvetica', 'normal');
        doc.text("¿Ya tenés cuenta? ", 95, 202, { align: 'right' });
        doc.setTextColor(37, 99, 235); doc.text("Iniciá sesión", 96, 202, { align: 'left' });


        doc.setFontSize(11);
        doc.setTextColor(220, 38, 38);
        doc.setFont('helvetica', 'bold');
        doc.text("¡IMPORTANTE!", 20, 235);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(50, 50, 50);
        doc.text("El correo electrónico ingresado será su nombre de usuario. Debe ser obligatoriamente\nsu correo institucional con el dominio @msal.gov.ar.", 20, 242);


        // ==========================================
        // PÁGINA 4: PASO 3
        // ==========================================
        doc.addPage();
        doc.setFontSize(20);
        doc.setTextColor(15, 60, 120);
        doc.setFont('helvetica', 'bold');
        doc.text("Paso 3: Aguardar habilitación", 20, 30);

        doc.setFontSize(12);
        doc.setTextColor(70, 70, 70);
        doc.setFont('helvetica', 'normal');
        const txtPaso3 = doc.splitTextToSize("Una vez enviada la solicitud, el sistema registrará sus datos y quedarán pendientes de validación. Por motivos de seguridad, el ingreso no es automático.", 170);
        doc.text(txtPaso3, 20, 45);

        // -- Simulación de Pantalla: Alerta de Éxito --
        doc.setDrawColor(200, 200, 200);
        doc.setFillColor(245, 247, 250);
        doc.roundedRect(20, 70, 170, 60, 3, 3, 'FD'); 
        
        doc.setFillColor(220, 252, 231);
        doc.setDrawColor(34, 197, 94);
        doc.roundedRect(30, 85, 150, 30, 2, 2, 'FD');
        
        doc.setTextColor(21, 128, 61);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text("¡Solicitud enviada exitosamente!", 105, 96, { align: 'center' });
        
        doc.setTextColor(50, 50, 50);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text("Su petición será revisada por la Administración. Intente ingresar más tarde.", 105, 105, { align: 'center' });

        doc.setFontSize(11);
        doc.setTextColor(50, 50, 50);
        
        // MODIFICACIÓN QUIRÚRGICA: Ajuste de línea dinámico para el texto final
        const finalTxt = "El administrador del sistema constatará que usted pertenezca a la dependencia indicada y le asignará los módulos de trabajo y permisos correspondientes.\n\nUna vez que el administrador apruebe su cuenta, podrá dirigirse nuevamente a la pantalla inicial del paso 1 e ingresar directamente colocando su correo y la contraseña que haya elegido al momento de registrarse.";
        const splitFinalTxt = doc.splitTextToSize(finalTxt, 170);
        
        doc.text(splitFinalTxt, 20, 150);

        // ==========================================
        // NUMERACIÓN Y PIE DE PÁGINA GLOBAL
        // ==========================================
        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(9);
            doc.setTextColor(150, 150, 150);
            doc.setFont('helvetica', 'normal');
            doc.text(`Página ${i} de ${totalPages} - SSRSyA - Gestión y Planificación`, pageWidth / 2, pageHeight - 15, { align: 'center' });
        }

        // Descargamos el archivo
        doc.save("Instructivo_Acceso_Sistema.pdf");
    };

    return (
        <Button onClick={generarPDF} size="lg" className="bg-blue-600 hover:bg-blue-700 shadow-md">
            <FileDown className="mr-2 h-5 w-5" />
            Descargar Instructivo en PDF
        </Button>
    );
}