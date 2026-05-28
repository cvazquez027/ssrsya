<?php
// api-backend/lista_referentes.php
require __DIR__ . '/cors.php';
require __DIR__ . '/db.php';
header("Content-Type: application/json");

try {
    $pdo = getDB();
    // Traemos ID y concatenamos nombre completo
    $sql = "SELECT id_referente, apellido, nombre, sigla 
            FROM referente 
            ORDER BY apellido ASC, nombre ASC";
    
    $stmt = $pdo->query($sql);
    echo json_encode($stmt->fetchAll());
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}
?>