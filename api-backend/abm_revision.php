<?php
// api-backend/abm_revision.php
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
$pdo = getDB();

try {
    $input = json_decode(file_get_contents('php://input'), true);
    $usuarioId = $_SESSION['usuario_id'];
    $rol = $_SESSION['rol'];
    $esSsrya = ($rol === 'admin' || $rol === 'cargafull');

    $idTabla = $input['id_tabla_revisada'] ?? null;
    $idPk = $input['id_pk_tabla_revisada'] ?? null;

    if ($idTabla && $idPk) {
        $sqlEstado = "";
        switch ($idTabla) {
            case 1: $sqlEstado = "SELECT estado_proyecto FROM proyecto WHERE id_proyecto = ?"; break;
            case 3: $sqlEstado = "SELECT p.estado_proyecto FROM objetivo_especifico oe JOIN objetivo_general og ON oe.id_og=og.id_og JOIN proyecto p ON og.id_proyecto=p.id_proyecto WHERE oe.id_oe = ?"; break;
            case 4: $sqlEstado = "SELECT p.estado_proyecto FROM actividad_prioritaria a JOIN objetivo_especifico oe ON a.id_oe=oe.id_oe JOIN objetivo_general og ON oe.id_og=og.id_og JOIN proyecto p ON og.id_proyecto=p.id_proyecto WHERE a.id_actividad = ?"; break;
            case 5: $sqlEstado = "SELECT p.estado_proyecto FROM indicador i JOIN actividad_prioritaria a ON i.id_actividad=a.id_actividad JOIN objetivo_especifico oe ON a.id_oe=oe.id_oe JOIN objetivo_general og ON oe.id_og=og.id_og JOIN proyecto p ON og.id_proyecto=p.id_proyecto WHERE i.id_indicador = ?"; break;
        }
        if ($sqlEstado) {
            $stmtEst = $pdo->prepare($sqlEstado);
            $stmtEst->execute([$idPk]);
            $estadoProy = $stmtEst->fetchColumn();

            $esReapertura = ($method === 'PUT' && isset($input['cerrado']) && (int)$input['cerrado'] === 0);
            if ($estadoProy != 1 && ($method === 'POST' || $method === 'PATCH' || $esReapertura)) {
                throw new Exception("Operación denegada: El proyecto ya no está en etapa de Edición.");
            }
        }
    }

    if ($method === 'POST') {
        if (empty($idTabla) || empty($idPk) || empty($input['texto'])) throw new Exception("Faltan datos");

        $sqlLast = "SELECT * FROM revision_ssrsya WHERE id_tabla_revisada = ? AND id_pk_tabla_revisada = ? ORDER BY id_revision_ssrsya DESC LIMIT 1";
        $stmtLast = $pdo->prepare($sqlLast);
        $stmtLast->execute([$idTabla, $idPk]);
        $ultimo = $stmtLast->fetch(PDO::FETCH_ASSOC);

        $hiloCerrado = $ultimo && $ultimo['revision_cerrada'] == 1;
        $existeRegistro = $ultimo ? true : false;

        if ($esSsrya) {
            if (!$existeRegistro || $hiloCerrado || !empty($ultimo['respuesta_dependencia'])) {
                $sql = "INSERT INTO revision_ssrsya (id_usuario, id_tabla_revisada, id_pk_tabla_revisada, comentario_ssrsya, revision_cerrada, id_revision_ssrsya_asociado) VALUES (?, ?, ?, ?, 0, ?)";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([$usuarioId, $idTabla, $idPk, $input['texto'], $existeRegistro ? $ultimo['id_revision_ssrsya'] : null]);
                
                // Correos eliminados: Se manejarán con el Cron Diario
                
                echo json_encode(["success" => true, "mensaje" => "Comentario agregado"]);
            } else {
                http_response_code(400); throw new Exception("Ya existe un comentario pendiente. Edite el existente.");
            }
        } else {
            if (!$existeRegistro || $hiloCerrado) { http_response_code(403); throw new Exception("No hay revisión activa."); }
            if (!empty($ultimo['respuesta_dependencia'])) { http_response_code(400); throw new Exception("Ya respondiste. Edita tu respuesta."); }
            
            $sql = "UPDATE revision_ssrsya SET respuesta_dependencia = ? WHERE id_revision_ssrsya = ?";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$input['texto'], $ultimo['id_revision_ssrsya']]);

            // Correos eliminados: Se manejarán con el Cron Diario

            echo json_encode(["success" => true, "mensaje" => "Respuesta enviada"]);
        }

    } elseif ($method === 'PATCH') {
        $idRevision = $input['id_revision_ssrsya'];
        $textoNuevo = $input['texto'];
        $stmtCheck = $pdo->prepare("SELECT * FROM revision_ssrsya WHERE id_revision_ssrsya = ?");
        $stmtCheck->execute([$idRevision]);
        $registro = $stmtCheck->fetch(PDO::FETCH_ASSOC);

        if (!$registro) throw new Exception("Registro no encontrado");
        if ($registro['revision_cerrada'] == 1) throw new Exception("Revisión cerrada.");

        if ($esSsrya) {
            if (!empty($registro['respuesta_dependencia'])) throw new Exception("Ya respondieron.");
            $sql = "UPDATE revision_ssrsya SET comentario_ssrsya = ? WHERE id_revision_ssrsya = ?";
        } else {
            if (empty($registro['respuesta_dependencia'])) throw new Exception("Nada que editar.");
            $sql = "UPDATE revision_ssrsya SET respuesta_dependencia = ? WHERE id_revision_ssrsya = ?";
        }
        $pdo->prepare($sql)->execute([$textoNuevo, $idRevision]);
        echo json_encode(["success" => true, "mensaje" => "Editado"]);

    } elseif ($method === 'PUT') {
        if (!$esSsrya) throw new Exception("Solo SSRSyA puede cambiar el estado.");
        $nuevoEstado = isset($input['cerrado']) ? (int)$input['cerrado'] : 1; 
        
        $sql = "UPDATE revision_ssrsya SET revision_cerrada = ? WHERE id_tabla_revisada = ? AND id_pk_tabla_revisada = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$nuevoEstado, $idTabla, $idPk]);

        $accion = $nuevoEstado === 1 ? "cerrado" : "reabierto";
        echo json_encode(["success" => true, "mensaje" => "Hilo $accion correctamente"]);
    }

} catch (Exception $e) {
    if (http_response_code() == 200) http_response_code(400);
    echo json_encode(["error" => $e->getMessage()]);
}
?>