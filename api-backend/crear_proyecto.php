<?php
// api-backend/crear_proyecto.php
ini_set('display_errors', 1);
error_reporting(E_ALL);

require __DIR__ . '/cors.php';
require __DIR__ . '/db.php';
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["error" => "Método no permitido"]);
    exit;
}

try {
    $input = json_decode(file_get_contents('php://input'), true);

    // Validamos todos los campos obligatorios, incluyendo ahora el REFERENTE
    if (empty($input['descripcion']) || empty($input['sigla_dependencia']) || 
        empty($input['id_prioridad']) || empty($input['id_estado']) || 
        empty($input['id_referente'])) {
        throw new Exception("Faltan datos obligatorios");
    }

    $pdo = getDB();
    $pdo->beginTransaction();

    // Insertar Proyecto
    // Agregamos id_referente a la consulta
    $sqlProyecto = "INSERT INTO proyecto (descripcion, sigla_dependencia, id_prioridad, id_estado, id_referente, estado_proyecto) 
                    VALUES (?, ?, ?, ?, ?, 1)";
    
    $stmt = $pdo->prepare($sqlProyecto);
    
    if (!$stmt->execute([
        $input['descripcion'], 
        $input['sigla_dependencia'],
        $input['id_prioridad'],
        $input['id_estado'],
        $input['id_referente'] // <--- Nuevo campo guardado
    ])) {
        $error = $stmt->errorInfo();
        throw new Exception("Error SQL al insertar proyecto: " . $error[2]);
    }
    
    $id_proyecto = $pdo->lastInsertId();

    // Insertar Objetivo General
    if (!empty($input['objetivo_general'])) {
        $sqlOG = "INSERT INTO objetivo_general (descripcion, id_proyecto) VALUES (?, ?)";
        $stmtOG = $pdo->prepare($sqlOG);
        if (!$stmtOG->execute([$input['objetivo_general'], $id_proyecto])) {
            $pdo->rollBack();
            $error = $stmtOG->errorInfo();
            throw new Exception("Error SQL al insertar Objetivo General: " . $error[2]);
        }
    }

    $pdo->commit();

    echo json_encode([
        "success" => true, 
        "mensaje" => "Proyecto creado exitosamente",
        "id_proyecto" => $id_proyecto
    ]);

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}
?>