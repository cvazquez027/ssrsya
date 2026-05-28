<?php
// api-backend/lista_estados.php
require __DIR__ . '/cors.php';
require __DIR__ . '/db.php';
header("Content-Type: application/json");

try {
    $pdo = getDB();
    // Traemos los estados (Nuevo, Continúa, etc.)
    $stmt = $pdo->query("SELECT id_estado, descripcion FROM estado ORDER BY id_estado ASC");
    echo json_encode($stmt->fetchAll());
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}
?>