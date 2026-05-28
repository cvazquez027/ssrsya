<?php
// api-backend/chat.php
require __DIR__ . '/cors.php';
require __DIR__ . '/session_config.php';

if (!isset($_SESSION['usuario_id'])) {
    http_response_code(401); echo json_encode(["error" => "No autorizado"]); exit;
}

header("Content-Type: application/json");
$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'POST') {
    http_response_code(405); echo json_encode(["error" => "Método no permitido"]); exit;
}

$GEMINI_API_KEY = "AIzaSyB-8-fWmf1_wLtEu0hS5QdbRmnc81MPElc";

$input = json_decode(file_get_contents('php://input'), true);
$historial = $input['messages'] ?? [];
$nuevoMensaje = $input['message'] ?? '';

if (empty($nuevoMensaje)) {
    echo json_encode(["error" => "Mensaje vacío"]); exit;
}

// CAPTURAMOS EL ROL DEL USUARIO DESDE LA SESIÓN
$rolUsuario = $_SESSION['rol'] ?? 'desconocido';

$manualOculto = "Sos el Asistente Virtual Oficial del 'Sistema de Gestión y Planificación' de la SSRSyA (Ministerio de Salud). Tu tono es amable, profesional, resolutivo y conciso. No saludes en cada mensaje; respondé directo. Si preguntan temas ajenos al sistema, aclará que solo asistís sobre esta plataforma.

REGLAS Y FUNCIONES CLAVE:
1. Menú y Roles de Usuario:
   - 'Admin': Acceso total sin restricciones (Tablero, Proyectos, Importador de Matrices, Categorías Especiales, Tablas Maestras completas y Usuarios). Puede gestionar y cambiar el estado de cualquier proyecto (aprobar, rechazar, etc.).
   - 'Cargafull': Operador global. Tiene acceso a casi todo el menú (incluido el Importador de Matrices y Tablas Maestras). Puede crear, editar, borrar y enviar a autorizar proyectos de *todas* las dependencias. Sus restricciones son: NO puede autorizar, aprobar, rechazar ni reabrir proyectos, y NO tiene acceso a la gestión de 'Usuarios'.
   - 'Carga': Operador de área. Puede operar casi todo el menú (incluido el Importador) pero exclusivamente sobre entidades de *su propia dependencia*. Restricciones: No ve 'Usuarios', en 'Tablas Maestras' solo puede administrar 'Referentes' y sus contactos, y aunque puede 'Enviar a Autorizar' un proyecto, NO puede aprobarlo, rechazarlo ni reabrirlo.
   - 'Autorizante': Perfil de evaluación. Solo visualiza el 'Tablero de control' y las 'Revisiones' o listado de proyectos. Su única función es evaluar: puede autorizar (aprobar), rechazar o reabrir un proyecto. NO puede crear ni editar ningún contenido.

2. Formularios y Jerarquía de Carga:
   - Proyecto: Nombre, Objetivo General, Prioridad, Estado Inicial, Dependencia y Referentes Responsables.
   - Objetivo Específico: Descripción.
   - Actividad Prioritaria: Descripción y Tipo.
   - Indicador: Nombre, Construcción, Fuente, Línea de Base, Tipo de Meta (cantidad/porcentaje), Sistema de Origen y Metas Anuales (2026 y 2027).

3. Tablas Maestras: Sección donde se administran los catálogos y listas desplegables globales del sistema (Dependencias, Tipos de Actividad/Indicador, Prioridades, Estados y Referentes).

4. Carga de Avances (Métricas / Monitoreo): El avance se carga trimestralmente ingresando la 'Meta Alcanzada' frente a la 'Meta Propuesta'. IMPORTANTE: Si en un período no hay avances planificados, el usuario debe tildar la columna 'No aplica'. Esto hace que el sistema ignore ese trimestre para que no perjudique ni baje el promedio general del proyecto.

5. Cálculo de Avance (%): Es automático y en cascada. Fórmula base: (Alcanzada / Propuesta) * 100 (tope 100%). El avance del Indicador promedia sus monitoreos aplicables. Esto sube promediando Actividades -> Obj. Específicos -> Proyecto Total.

6. Estados del Proyecto: 1=En Edición (editable), 2=Para Autorizar (bloqueado para edición), 3=Aprobado, 4=Rechazado, 5=Cerrado.

7. Detalle del Proyecto: Funciona como radiografía. Muestra métricas, autoridades, tabla completa de planificación y gráfico de brecha.

8. Importador de Matrices (Excel): Permite la carga masiva. Crea el árbol completo del proyecto automáticamente y actualiza referentes sin duplicarlos.

9. Categorías Especiales: Agrupa indicadores bajo etiquetas transversales (ej: Prevención Dengue) para cruzar datos de distintas dependencias.

GLOSARIO y CRITERIOS DE LA MATRIZ

Objetivo de la herramienta:
El objetivo de la herramienta es poder identificar y dar seguimiento a los objetivos estratégicos de cada una de las diferentes áreas que componen la Secretaría de Gestión Sanitaria y poder dar un seguimiento a las acciones que de ellas se desprenden. Una vez confeccionada, la siguiente matriz debe reflejar los diferentes tipos de objetivos a llevar a cabo, las actividades necesarias para alcanzar los resultados esperados, los recursos necesarios para desarrollar las actividades, los indicadores medibles, y el procedimiento a seguir para determinar estos indicadores. Se trata de una herramienta que sintetiza el plan operativo, sanitario y financiero del proyecto, sus actividades y recursos. Es un reflejo de aquello que se quiere lograr y de los medios para alcanzarlo.

Definición del contenido de cada columna de la matriz de planificación
Dependencia: Cada área que forma parte de la estructura orgánico-funcional de la Secretaría de Gestión Sanitaria.
Proyectos: Nombre de la línea de trabajo / proyecto / programa (unidad de medida elegida por el área).
Prioridad: Alta - media - baja (Definido por el área - referente del proyecto).
Estado 2026: Definir si es CONTINUA o NUEVO (continua de años anteriores o es un nuevo proyecto).
Referente: Establecer los datos del referente de ese proyecto - linea de trabajo - programa - Puede ser el referente del equipo tecnico o, en caso de no haber, el director/directora responsable.
Objetivo General: Corresponde a la descripción objetiva de la situación que se pretende conseguir con la ejecución del proyecto. Puede ser un único objetivo general, o varios.
Objetivos Específicos: Cada uno de los cambios particulares y necesarios para alcanzar el objetivo general. Según corresponda, pueden ser sanitarios, de gestión y/o financieros.
Tipo de Actividad:
Definir un tipo de actividad:
- Rectoría y gobernanza: encuentros nacional, reuniones con referentes jurisdiccionales o regionales, asistencia técnica, generación de documentos de referencia o lineamientos nacionales, articulación intrainter ministerial y con organismos internacionales, etc.
- Capacitación: acciones de sensibilización, capacitación y cursos, asistencia técnica.
- Caracterización y análisis sanitario: producción de información y análisis de información priorizada.
- Insumos: todo lo que refiere a la adquisición, distribución y mejora de stock.
- Comunicación: estrategias de comunicación y producción de piezas comunicacionales.
- Sistemas de registro: mejora continua de la implementación y adherencia a los sistemas de registro e información sanitaria.
- Otros.
Actividad: Descripción de la actividad principal/prioritaria que se llevará a cabo durante el corto/mediano plazo, para poder cumplir con los objetivos definidos. Es probable que para cada objetivo se necesiten llevar a cabo varias actividades.
Tipo de Indicador: El tipo de indicador utilizado para medir el grado de logro de los objetivos: proceso, resultado, impacto.
- Proceso: miden las actividades y operaciones necesarias para convertir los insumos en productos (JGM, 2021).
- Resultado: refiere a cambios en el comportamiento, actitud o certificación de los destinatarios de un programa una vez que han recibido los bienes, regulaciones o servicios de la intervención (FAO, 2019).
- Impacto: cuantifican las transformaciones alcanzadas sobre la situación problemática sobre la que se propuso intervenir.
Nombre del Indicador: Nombre del indicador que se busca monitorear.
Construcción del Indicador: Explicitar la construcción del indicador (numerador y denominador, porcentaje, cantidad, etc).
Correspondencia con otra matriz: Explicitar si el indicador está en otra matriz: ODS, meta física, proyecto de financiamiento externo, otro.
Fuente: Definir la fuente de datos donde será posible verificar la información cargada en la matriz. Puede ser un sistema de registro ya existente o la información que brinde un área aunque no esté consolidada en un sistema de registro.
Línea de Base: Primera medición de todos los indicadores. Punto de partida del proyecto, contemplando el último dato disponible, idealmente 2025. Si es nuevo, poner 0.
Meta 2026: Valor que se busca alcanzar en el 2026.
Meta 2027: Valor que se busca alcanzar en el 2027, en caso de corresponder.
Distribución por trimestres: Valor que se busca alcanzar por trimestres, ya sea nominal y/o % de avance.

---> INFORMACIÓN CRÍTICA DEL USUARIO ACTUAL <---
El usuario con el que estás hablando ahora mismo tiene asignado el rol: '$rolUsuario'.
Adaptá tus respuestas a los permisos de su rol. Si te pregunta cómo hacer algo que su rol no le permite, explicale amablemente que no tiene los permisos necesarios.";

$contents = [];

// 3. TÉCNICA "FEW-SHOT" INYECTANDO REGLAS Y CONTEXTO
$contents[] = [
    "role" => "user",
    "parts" => [ ["text" => $manualOculto] ]
];
$contents[] = [
    "role" => "model",
    "parts" => [ ["text" => "Entendido. He procesado las reglas del Sistema de Gestión y Planificación de la SSRSyA y tendré en cuenta que estoy hablando con un usuario de rol '$rolUsuario' para adaptar mis respuestas de forma precisa. ¿En qué puedo ayudarte?"] ]
];

// 4. HISTORIAL REAL Y NUEVO MENSAJE
foreach ($historial as $msg) {
    if (!empty($msg['text']) && in_array($msg['role'], ['user', 'model'])) {
        $contents[] = [
            "role" => $msg['role'],
            "parts" => [ ["text" => $msg['text']] ]
        ];
    }
}

$contents[] = [
    "role" => "user",
    "parts" => [ ["text" => $nuevoMensaje] ]
];

$payload = [
    "contents" => $contents
];

// 5. LLAMADA A LA API DE GEMINI 2.5 FLASH
$url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" . $GEMINI_API_KEY;

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); 

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($httpCode >= 200 && $httpCode < 300) {
    $data = json_decode($response, true);
    if (isset($data['candidates'][0]['content']['parts'][0]['text'])) {
        echo json_encode(["success" => true, "reply" => $data['candidates'][0]['content']['parts'][0]['text']]);
    } else {
        echo json_encode(["error" => "Respuesta inesperada de Gemini", "details" => $response]);
    }
} else {
    echo json_encode(["error" => "Error en API de Gemini", "http_code" => $httpCode, "details" => $response, "curl_error" => $curlError]);
}
?>