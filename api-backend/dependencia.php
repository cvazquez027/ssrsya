<?php
// api-backend/dependencia.php
ini_set('display_errors', 1);
error_reporting(E_ALL);

require __DIR__ . '/cors.php';
require __DIR__ . '/db.php';

try {
    $pdo = getDB();
    
    // CORRECCIÓN: Tablas en minúscula (dependencia, referente)
    $sql = "SELECT 
        d.sigla, 
        d.descripcion, 
        d.vigente,
        d.id_referente,
        d.sigla_superior,
        CONCAT(r.apellido, ', ', r.nombre) as referente_nombre,
        ds.descripcion as dependencia_superior_nombre
      FROM dependencia d
      LEFT JOIN referente r ON d.id_referente = r.id_referente
      LEFT JOIN dependencia ds ON d.sigla_superior = ds.sigla
      ORDER BY d.sigla";

    $stmt = $pdo->query($sql);
    $dependencias = $stmt->fetchAll();

    // DEBUG: Si el array está vacío, forzamos un mensaje para saberlo
    if (empty($dependencias)) {
        // Esto no es un error, pero nos avisa si la base está vacía
        // echo json_encode(["mensaje" => "Tablas leídas pero vacías"]); 
        // Mejor devolvemos array vacío estándar:
        echo json_encode([]);
    } else {
        echo json_encode($dependencias);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => "Error SQL: " . $e->getMessage()]);
}
?>