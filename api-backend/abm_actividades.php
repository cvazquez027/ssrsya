<?php
// api-backend/abm_actividades.php
require __DIR__ . '/cors.php';
require __DIR__ . '/db.php';

// Validar sesión básica
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

    switch ($method) {
        case 'POST': // CREAR NUEVA ACTIVIDAD
            if (empty($input['id_oe']) || empty($input['descripcion'])) {
                throw new Exception("Datos incompletos: Se requiere Objetivo Específico y Descripción.");
            }

            $sql = "INSERT INTO actividad_prioritaria 
                    (id_oe, descripcion, id_tipo_actividad_prioritaria, id_estado) 
                    VALUES (?, ?, ?, ?)";
            
            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                $input['id_oe'], 
                $input['descripcion'],
                // Si viene vacío o null, guardamos NULL en la BD
                !empty($input['id_tipo_actividad_prioritaria']) ? $input['id_tipo_actividad_prioritaria'] : null,
                !empty($input['id_estado']) ? $input['id_estado'] : null
            ]);

            echo json_encode(["success" => true, "mensaje" => "Actividad creada correctamente"]);
            break;

        case 'PUT': // EDITAR ACTIVIDAD EXISTENTE
            if (empty($input['id_actividad']) || empty($input['descripcion'])) {
                throw new Exception("Datos incompletos: ID y Descripción son obligatorios.");
            }

            $sql = "UPDATE actividad_prioritaria 
                    SET descripcion = ?, 
                        id_tipo_actividad_prioritaria = ?, 
                        id_estado = ? 
                    WHERE id_actividad = ?";
            
            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                $input['descripcion'], 
                !empty($input['id_tipo_actividad_prioritaria']) ? $input['id_tipo_actividad_prioritaria'] : null,
                !empty($input['id_estado']) ? $input['id_estado'] : null,
                $input['id_actividad']
            ]);

            echo json_encode(["success" => true, "mensaje" => "Actividad actualizada correctamente"]);
            break;

        case 'DELETE': // BORRAR ACTIVIDAD
            if (empty($input['id_actividad'])) {
                throw new Exception("ID de actividad requerido para eliminar.");
            }

            // 1. Validar que no tenga Indicadores hijos (Integridad Referencial)
            $check = $pdo->prepare("SELECT COUNT(*) FROM indicador WHERE id_actividad = ?");
            $check->execute([$input['id_actividad']]);
            if ($check->fetchColumn() > 0) {
                throw new Exception("No se puede borrar: Esta actividad tiene indicadores asociados. Bórralos primero.");
            }

            // 2. Ejecutar borrado
            $stmt = $pdo->prepare("DELETE FROM actividad_prioritaria WHERE id_actividad = ?");
            $stmt->execute([$input['id_actividad']]);

            echo json_encode(["success" => true, "mensaje" => "Actividad eliminada correctamente"]);
            break;

        default:
            throw new Exception("Método HTTP no permitido: " . $_SERVER['REQUEST_METHOD']);
    }

} catch (Exception $e) {
    http_response_code(400); // Bad Request
    echo json_encode(["error" => $e->getMessage()]);
}
?>