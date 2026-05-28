<?php
// api-backend/proyecto.php
require __DIR__ . '/cors.php';
require __DIR__ . '/db.php';
header("Content-Type: application/json");

try {
    $pdo = getDB();
    
    // MODIFICACIÓN QUIRÚRGICA: Agregamos el JOIN de tipo_estado_proyecto
    $sql = "SELECT p.*, og.descripcion AS objetivo_general, tep.descripcion as estado_descripcion
            FROM proyecto p 
            LEFT JOIN objetivo_general og ON p.id_proyecto = og.id_proyecto
            LEFT JOIN tipo_estado_proyecto tep ON p.estado_proyecto = tep.id_tipo_estado_proyecto"; 
    
    $stmt = $pdo->query($sql);
    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}
?>