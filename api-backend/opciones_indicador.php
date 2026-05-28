<?php
// api-backend/opciones_indicador.php
require __DIR__ . '/cors.php';
require __DIR__ . '/db.php';

header("Content-Type: application/json; charset=utf-8");

try {
    $pdo = getDB();
    $pdo->exec("SET NAMES 'utf8mb4'");
    
    // MODIFICACIÓN QUIRÚRGICA: Agregado el campo "nombre"
    $stmt = $pdo->query("SELECT id_tipo_indicador as id, nombre, descripcion FROM tipo_indicador ORDER BY nombre ASC");
    $tipos = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(["tipos" => $tipos]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}
?>