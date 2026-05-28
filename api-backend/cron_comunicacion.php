<?php
// api-backend/cron_comunicacion.php
ini_set('display_errors', 0);
error_reporting(E_ALL);

require __DIR__ . '/db.php';
require_once __DIR__ . '/mailer.php';

// 1. SEGURIDAD: Evitar ejecución pública
$tokenSeguridad = "TUK3Y_S3CR3T4_2026"; // Mismo token que usás para planificación
if (!isset($_GET['token']) || $_GET['token'] !== $tokenSeguridad) {
    http_response_code(403);
    die("Acceso denegado.");
}

$pdo = getDB();

try {
    // 2. BUSCAR ACTIVIDAD DE COMUNICACIÓN DE HOY
    // Buscamos actividades que fueron creadas o actualizadas hoy
    $sql = "SELECT a.sigla, a.descripcion, e.descripcion as estado_actual, a.fecha_creacion, a.fecha_actualizacion 
            FROM comu_actividad a 
            JOIN comu_estado e ON a.id_comu_estado = e.id_comu_estado 
            WHERE DATE(a.fecha_creacion) = CURDATE() OR DATE(a.fecha_actualizacion) = CURDATE()
            ORDER BY a.sigla ASC, a.fecha_actualizacion DESC";
            
    $stmt = $pdo->query($sql);
    $actividades = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($actividades)) {
        die("No hubo actividad hoy en el módulo de Comunicación. No se envían correos.");
    }

    // 3. ARMAR EL CUERPO DEL MAIL EN HTML
    $cuerpo = "<h2>Resumen Diario: Módulo de Comunicación</h2>";
    $cuerpo .= "<p>A continuación se detallan las actividades que han sido <b>creadas o que han cambiado de estado</b> en el día de la fecha:</p>";
    
    $cuerpo .= "<table border='1' cellpadding='8' cellspacing='0' style='border-collapse: collapse; width: 100%; font-family: Arial, sans-serif;'>";
    $cuerpo .= "<tr style='background-color: #f1f5f9; text-align: left;'>
                    <th style='width: 15%;'>Dependencia</th>
                    <th style='width: 60%;'>Descripción de la Actividad</th>
                    <th style='width: 25%;'>Estado Actual</th>
                </tr>";
    
    foreach ($actividades as $act) {
        $cuerpo .= "<tr>";
        $cuerpo .= "<td style='font-weight: bold; color: #475569;'>{$act['sigla']}</td>";
        $cuerpo .= "<td>{$act['descripcion']}</td>";
        $cuerpo .= "<td style='color: #2563eb; font-weight: bold;'>{$act['estado_actual']}</td>";
        $cuerpo .= "</tr>";
    }
    
    $cuerpo .= "</table>";
    $cuerpo .= "<p style='margin-top: 20px; color: #64748b; font-size: 12px;'>Este es un mensaje automático generado por el Sistema Integral SSRSyA.</p>";

    // 4. ENVIAR CORREO AL ÁREA DE COMUNICACIÓN
    $destinatarios = ['comunicacion.ssrsya@gmail.com'];
    
    enviarCorreoBrevo($destinatarios, "Resumen Diario de Actividades - Comunicación", $cuerpo);

    echo "Resumen diario de comunicación enviado con éxito a " . implode(", ", $destinatarios);

} catch (Exception $e) {
    echo "Error en el Cron de Comunicación: " . $e->getMessage();
}
?>