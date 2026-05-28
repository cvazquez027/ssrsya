<?php
// api-backend/objetivo_general.php
require __DIR__ . '/cors.php';
require __DIR__ . '/db.php';
header("Content-Type: application/json");

try {
    $pdo = getDB();
    $sql = "SELECT * FROM objetivo_general";
    $stmt = $pdo->query($sql);
    echo json_encode($stmt->fetchAll());
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}
?>