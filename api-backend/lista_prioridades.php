<?php
// api-backend/lista_prioridades.php
require __DIR__ . '/cors.php';
require __DIR__ . '/db.php';
header("Content-Type: application/json");

try {
    $pdo = getDB();
    // Traemos ID y Descripción
    $stmt = $pdo->query("SELECT id_prioridad, descripcion FROM prioridad ORDER BY id_prioridad ASC");
    $data = $stmt->fetchAll();
    
    echo json_encode($data);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}
?>