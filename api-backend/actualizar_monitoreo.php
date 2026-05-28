<?php
// api-backend/actualizar_monitoreo.php
require __DIR__ . '/cors.php';
require __DIR__ . '/db.php';

require __DIR__ . '/session_config.php';
if (!isset($_SESSION['usuario_id'])) {
    http_response_code(401);
    echo json_encode(["error" => "No autorizado"]);
    exit;
}

header("Content-Type: application/json");
$method = $_SERVER['REQUEST_METHOD'];

try {
    $pdo = getDB();
    $input = json_decode(file_get_contents('php://input'), true);

    if ($method !== 'POST' && $method !== 'PUT') {
        throw new Exception("Método no permitido");
    }

    // CIRUGÍA: Soporte para procesar en Lote (Batch) o individual
    $updates = isset($input['updates']) ? $input['updates'] : [$input];

    if (empty($updates)) {
        throw new Exception("No hay datos para actualizar");
    }

    $pdo->beginTransaction();

    foreach ($updates as $row) {
        if (empty($row['id_monitoreo'])) continue;

        $sqlCheck = "SELECT p.estado_proyecto 
                     FROM monitoreo m
                     JOIN indicador i ON m.id_indicador = i.id_indicador
                     JOIN actividad_prioritaria a ON i.id_actividad = a.id_actividad
                     JOIN objetivo_especifico oe ON a.id_oe = oe.id_oe
                     JOIN objetivo_general og ON oe.id_og = og.id_og
                     JOIN proyecto p ON og.id_proyecto = p.id_proyecto
                     WHERE m.id_monitoreo = ?";
        
        $stmtCheck = $pdo->prepare($sqlCheck);
        $stmtCheck->execute([$row['id_monitoreo']]);
        $estadoActual = (int)$stmtCheck->fetchColumn();

        // Si alguna fila no está en estado válido (1 o 3), la saltamos silenciosamente 
        // para no bloquear el resto del lote.
        if ($estadoActual !== 1 && $estadoActual !== 3) {
            continue;
        }

        $noAplica = isset($row['no_aplica']) ? (int)$row['no_aplica'] : 0;
        $obs = $row['observaciones'] ?? null;

        if ($estadoActual === 1) {
            // MODO EDICIÓN: El usuario está corrigiendo la meta propuesta
            $sql = "UPDATE monitoreo SET meta_propuesta = ?, observaciones = ?, no_aplica = ? WHERE id_monitoreo = ?";
            $stmt = $pdo->prepare($sql);
            $metaPropuesta = isset($row['meta_propuesta']) && $row['meta_propuesta'] !== "" ? $row['meta_propuesta'] : null;
            $stmt->execute([$metaPropuesta, $obs, $noAplica, $row['id_monitoreo']]);
        } else {
            // MODO APROBADO: El usuario está reportando el avance ejecutado
            $sql = "UPDATE monitoreo SET meta_alcanzada = ?, observaciones = ?, no_aplica = ? WHERE id_monitoreo = ?";
            $stmt = $pdo->prepare($sql);
            $metaAlcanzada = isset($row['meta_alcanzada']) && $row['meta_alcanzada'] !== "" ? $row['meta_alcanzada'] : null;
            $stmt->execute([$metaAlcanzada, $obs, $noAplica, $row['id_monitoreo']]);
        }
    }

    $pdo->commit();
    echo json_encode(["success" => true, "mensaje" => "Datos guardados correctamente"]);

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(400);
    echo json_encode(["error" => $e->getMessage()]);
}
?>