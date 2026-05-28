<?php
// api-backend/opciones_otros_sistemas.php
require __DIR__ . '/cors.php';
require __DIR__ . '/db.php';

header("Content-Type: application/json; charset=utf-8");

try {
    $pdo = getDB();
    $pdo->exec("SET NAMES 'utf8mb4'");
    
    $stmt = $pdo->query("SELECT id_otro_sistema as id, descripcion FROM otro_sistema ORDER BY descripcion ASC");
    $sistemas = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(["sistemas" => $sistemas]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}
?>