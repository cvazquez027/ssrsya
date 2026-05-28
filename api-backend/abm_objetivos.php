<?php
// api-backend/abm_objetivos.php
require __DIR__ . '/cors.php';
require __DIR__ . '/db.php';

// Iniciar sesión para validar permisos (opcional pero recomendado)
require __DIR__ . '/session_config.php';

header("Content-Type: application/json");
$method = $_SERVER['REQUEST_METHOD'];
$pdo = getDB();

try {
    $input = json_decode(file_get_contents('php://input'), true);

    switch ($method) {
        case 'POST': // CREAR
            // Recibimos id_proyecto y descripción
            if (empty($input['id_proyecto']) || empty($input['descripcion'])) {
                throw new Exception("Datos incompletos");
            }

            // 1. Buscamos el ID del Objetivo General de este proyecto
            $stmtOG = $pdo->prepare("SELECT id_og FROM objetivo_general WHERE id_proyecto = ?");
            $stmtOG->execute([$input['id_proyecto']]);
            $og = $stmtOG->fetch(PDO::FETCH_ASSOC);

            if (!$og) {
                throw new Exception("El proyecto no tiene un Objetivo General creado aún.");
            }

            // 2. Insertamos el Objetivo Específico
            $sql = "INSERT INTO objetivo_especifico (id_og, descripcion) VALUES (?, ?)";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$og['id_og'], $input['descripcion']]);

            echo json_encode(["success" => true, "mensaje" => "Objetivo creado"]);
            break;

        case 'PUT': // EDITAR
            if (empty($input['id_oe']) || empty($input['descripcion'])) {
                throw new Exception("Datos incompletos");
            }

            $sql = "UPDATE objetivo_especifico SET descripcion = ? WHERE id_oe = ?";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$input['descripcion'], $input['id_oe']]);

            echo json_encode(["success" => true, "mensaje" => "Objetivo actualizado"]);
            break;

        case 'DELETE': // BORRAR
            // En DELETE, a veces el input viene en query param o body. Asumimos body para JSON.
            // Si usas axios.delete(url, { data: { ... } }) funciona.
            if (empty($input['id_oe'])) {
                throw new Exception("ID requerido");
            }

            // 1. Validar que NO tenga actividades hijas
            $check = $pdo->prepare("SELECT COUNT(*) FROM actividad_prioritaria WHERE id_oe = ?");
            $check->execute([$input['id_oe']]);
            if ($check->fetchColumn() > 0) {
                throw new Exception("No se puede borrar: Tiene actividades asociadas.");
            }

            // 2. Borrar
            $stmt = $pdo->prepare("DELETE FROM objetivo_especifico WHERE id_oe = ?");
            $stmt->execute([$input['id_oe']]);

            echo json_encode(["success" => true, "mensaje" => "Objetivo eliminado"]);
            break;

        default:
            throw new Exception("Método no permitido");
    }

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(["error" => $e->getMessage()]);
}
?>