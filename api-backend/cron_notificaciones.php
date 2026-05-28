<?php
// api-backend/cron_notificaciones.php
ini_set('display_errors', 0);
error_reporting(E_ALL);

require __DIR__ . '/db.php';
require_once __DIR__ . '/mailer.php';

// 1. SEGURIDAD: Evitar ejecución pública no autorizada
$tokenSeguridad = "TUK3Y_S3CR3T4_2026"; // Cambiá esto por una clave tuya
if (!isset($_GET['token']) || $_GET['token'] !== $tokenSeguridad) {
    http_response_code(403);
    die("Acceso denegado.");
}

$pdo = getDB();

try {
    // 2. BUSCAR ACTIVIDAD DE HOY
    // Buscamos todas las revisiones que se crearon o actualizaron hoy
    $sql = "SELECT r.*, tr.tabla_revisada 
            FROM revision_ssrsya r
            JOIN tabla_revisada tr ON r.id_tabla_revisada = tr.id_tabla_revisada
            WHERE DATE(r.fecha_actualizacion) = CURDATE()";
            
    $stmt = $pdo->query($sql);
    $actividadHoy = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($actividadHoy)) {
        die("No hubo actividad hoy. No se envían correos.");
    }

    // 3. AGRUPAR LA INFORMACIÓN
    $avisosDependencia = []; // Correos para rol 'carga'
    $avisosSsrsya = [];      // Correos para 'admin' y 'cargafull'

    foreach ($actividadHoy as $fila) {
        // Necesitamos saber a qué proyecto pertenece esta revisión para sacar la sigla
        $infoProy = getInfoProyectoPadre($fila['id_tabla_revisada'], $fila['id_pk_tabla_revisada']);
        if (!$infoProy) continue;

        $sigla = $infoProy['sigla'];
        $nombreProy = $infoProy['nombre'];

        // Si hay respuesta_dependencia, es un aviso para la SSRSyA
        // Si no la hay, es un comentario nuevo de la SSRSyA para la Dependencia
        if (!empty($fila['respuesta_dependencia'])) {
            $avisosSsrsya[$sigla][$nombreProy][] = "Respuesta de la dependencia recibida.";
        } else {
            $avisosDependencia[$sigla][$nombreProy][] = "Nuevo comentario o corrección de la SSRSyA.";
        }
    }

    // 4. ENVIAR CORREOS A DEPENDENCIAS (Rol Carga + Referentes vinculados)
    foreach ($avisosDependencia as $sigla => $proyectos) {
        $destinatarios = getEmailsPorRol('carga', $sigla);
        
        $cuerpo = "<h3>Resumen Diario de Revisiones</h3>";
        $cuerpo .= "<p>Hola equipo de <b>{$sigla}</b>, hoy hubo actividad en sus proyectos:</p><ul>";
        foreach ($proyectos as $nombre => $mensajes) {
            $cantidad = count($mensajes);
            $cuerpo .= "<li><b>{$nombre}</b>: {$cantidad} nueva(s) observación/es.</li>";
        }
        $cuerpo .= "</ul><p>Por favor, ingresen al sistema para revisar los detalles.</p>";

        if (!empty($destinatarios)) {
            enviarCorreoBrevo($destinatarios, "Nuevas Observaciones en sus Proyectos - SSRSyA", $cuerpo);
        }
    }

    // 5. ENVIAR CORREOS A SSRSyA (Admins y Cargafull)
    if (!empty($avisosSsrsya)) {
        $destinatariosSsrsya = array_merge(getEmailsPorRol('admin'), getEmailsPorRol('cargafull'));
        $destinatariosSsrsya = array_unique($destinatariosSsrsya);

        $cuerpo = "<h3>Resumen Diario de Respuestas</h3>";
        $cuerpo .= "<p>Las siguientes dependencias han contestado observaciones hoy:</p><ul>";
        foreach ($avisosSsrsya as $sigla => $proyectos) {
            foreach ($proyectos as $nombre => $mensajes) {
                $cantidad = count($mensajes);
                $cuerpo .= "<li><b>[{$sigla}]</b> {$nombre}: {$cantidad} respuesta(s).</li>";
            }
        }
        $cuerpo .= "</ul><p>Ingrese al panel de control para continuar con la evaluación.</p>";

        if (!empty($destinatariosSsrsya)) {
            enviarCorreoBrevo($destinatariosSsrsya, "Respuestas de Dependencias - Sistema SSRSyA", $cuerpo);
        }
    }

    echo "Correos de resumen enviados con éxito.";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>