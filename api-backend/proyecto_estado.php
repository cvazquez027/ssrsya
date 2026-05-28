<?php
// api-backend/proyecto_estado.php
require __DIR__ . '/cors.php';
require __DIR__ . '/db.php';
require_once __DIR__ . '/mailer.php'; 

header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405); echo json_encode(["error" => "Método no permitido"]); exit;
}

try {
    $input = json_decode(file_get_contents('php://input'), true);
    $id_proyecto = $input['id_proyecto'] ?? null;
    $nuevo_estado = $input['estado'] ?? null;

    if (!$id_proyecto || !isset($nuevo_estado)) throw new Exception("Faltan datos (ID o Estado)");
    $pdo = getDB();

    if ($nuevo_estado == 2) {
        $sqlCheck = "SELECT COUNT(i.id_indicador) as total FROM proyecto p INNER JOIN objetivo_general og ON p.id_proyecto = og.id_proyecto INNER JOIN objetivo_especifico oe ON og.id_og = oe.id_og INNER JOIN actividad_prioritaria ap ON oe.id_oe = ap.id_oe INNER JOIN indicador i ON ap.id_actividad = i.id_actividad WHERE p.id_proyecto = ?";
        $stmtCheck = $pdo->prepare($sqlCheck);
        $stmtCheck->execute([$id_proyecto]);
        if ($stmtCheck->fetchColumn() == 0) throw new Exception("No se puede enviar a autorizar: El proyecto debe tener al menos un Indicador cargado (con sus O.E. y Actividades).");

        $sqlHilos = "SELECT COUNT(*) as abiertas FROM revision_ssrsya r WHERE r.revision_cerrada = 0 AND ( (r.id_tabla_revisada = 1 AND r.id_pk_tabla_revisada = ?) OR (r.id_tabla_revisada = 3 AND r.id_pk_tabla_revisada IN ( SELECT oe.id_oe FROM objetivo_especifico oe JOIN objetivo_general og ON oe.id_og = og.id_og WHERE og.id_proyecto = ? )) OR (r.id_tabla_revisada = 4 AND r.id_pk_tabla_revisada IN ( SELECT ap.id_actividad FROM actividad_prioritaria ap JOIN objetivo_especifico oe ON ap.id_oe = oe.id_oe JOIN objetivo_general og ON oe.id_og = og.id_og WHERE og.id_proyecto = ? )) OR (r.id_tabla_revisada = 5 AND r.id_pk_tabla_revisada IN ( SELECT i.id_indicador FROM indicador i JOIN actividad_prioritaria ap ON i.id_actividad = ap.id_actividad JOIN objetivo_especifico oe ON ap.id_oe = oe.id_oe JOIN objetivo_general og ON oe.id_og = og.id_og WHERE og.id_proyecto = ? )) )";
        $stmtHilos = $pdo->prepare($sqlHilos);
        $stmtHilos->execute([$id_proyecto, $id_proyecto, $id_proyecto, $id_proyecto]);
        if ($stmtHilos->fetchColumn() > 0) throw new Exception("No se puede enviar a autorizar: Existen revisiones de la SSRSyA pendientes de cerrar.");
    }

    $sql = "UPDATE proyecto SET estado_proyecto = ? WHERE id_proyecto = ?";
    if ($pdo->prepare($sql)->execute([$nuevo_estado, $id_proyecto])) {
        
        try {
            $infoProy = getInfoProyectoPadre(1, $id_proyecto);
            if ($infoProy) {
                $destinatarios = []; $asunto = ""; $cuerpo = ""; $estadoTexto = "";

                if ($nuevo_estado == 2) { 
                    $destinatarios = getEmailsPorRol('autorizante', $infoProy['sigla']);
                    $asunto = "Proyecto Pendiente de Autorización - " . $infoProy['sigla'];
                    $cuerpo = "<h3>Requiere su atención</h3><p>El proyecto <b>{$infoProy['nombre']}</b> ha sido enviado para su autorización.</p><p>Por favor, ingrese al sistema para revisarlo y emitir un dictamen.</p>";
                } 
                elseif (in_array($nuevo_estado, [1, 3, 4])) {
                    if ($nuevo_estado == 1) $estadoTexto = "REABIERTO (En Edición)";
                    if ($nuevo_estado == 3) $estadoTexto = "APROBADO";
                    if ($nuevo_estado == 4) $estadoTexto = "RECHAZADO";

                    $cargas = getEmailsPorRol('carga', $infoProy['sigla']);
                    
                    // Consulta Quirúrgica: Integración con ID_Usuario
                    $sqlCorreosRef = "
                        SELECT COALESCE(u.email, c.correo_electronico) as email
                        FROM proyecto_referente pr
                        JOIN referente ref ON pr.id_referente = ref.id_referente
                        LEFT JOIN usuario u ON ref.id_usuario = u.id_usuario
                        LEFT JOIN datos_contacto c ON ref.id_referente = c.id_referente AND c.vigente = 1
                        WHERE pr.id_proyecto = ?
                        AND (u.email IS NOT NULL OR c.correo_electronico IS NOT NULL)
                    ";
                    $stmtRefs = $pdo->prepare($sqlCorreosRef);
                    $stmtRefs->execute([$id_proyecto]);
                    $correosRefs = array_unique($stmtRefs->fetchAll(PDO::FETCH_COLUMN));

                    $destinatarios = array_merge($cargas, $correosRefs);
                    $color = ($nuevo_estado == 3) ? "green" : (($nuevo_estado == 4) ? "red" : "orange");
                    
                    $asunto = "Veredicto de Proyecto: $estadoTexto - " . $infoProy['sigla'];
                    $cuerpo = "<h3>Actualización de Estado</h3><p>El proyecto <b>{$infoProy['nombre']}</b> ha cambiado su estado a <b style='color: $color;'>$estadoTexto</b>.</p><p>Ingrese al sistema para ver los detalles correspondientes.</p>";
                }

                if (!empty($destinatarios)) enviarCorreoBrevo($destinatarios, $asunto, $cuerpo);
            }
        } catch (Exception $eMail) {}

        echo json_encode(["success" => true, "mensaje" => "Estado actualizado correctamente"]);
    } else { throw new Exception("No se pudo actualizar la base de datos"); }

} catch (Exception $e) { http_response_code(400); echo json_encode(["error" => $e->getMessage()]); }
?>