<?php
// api-backend/analisis_entrevistas.php
ini_set('display_errors', 0);
error_reporting(E_ALL);

require __DIR__ . '/cors.php'; // Tu archivo seguro de CORS
require __DIR__ . '/db.php';   // Tu conexión PDO

header("Content-Type: application/json; charset=UTF-8");

try {
    $pdo = getDB();
    
    // Consulta optimizada para traer todo el árbol jerárquico y los fragmentos
    $sql = "SELECT 
                f.id_fragmento,
                e.codigo_entrevista,
                e.profesion_estudios,
                f.hablante,
                f.texto,
                cap.nombre AS capacidad,
                d.nombre AS dimension,
                c.nombre AS categoria,
                f.orden_aparicion
            FROM entrev_fragmentos f
            JOIN entrev_entrevistados e ON f.id_entrevistado = e.id_entrevistado
            LEFT JOIN entrev_categorias c ON f.id_categoria = c.id_categoria
            LEFT JOIN entrev_dimensiones d ON c.id_dimension = d.id_dimension
            LEFT JOIN entrev_capacidades cap ON d.id_capacidad = cap.id_capacidad
            ORDER BY e.codigo_entrevista ASC, f.orden_aparicion ASC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $resultados = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        "success" => true, 
        "data" => $resultados
    ]);

} catch (PDOException $e) {
    // Seguridad: Nunca exponer $e->getMessage() en producción para evitar fuga de información estructural
    http_response_code(500);
    echo json_encode([
        "success" => false, 
        "error" => "Error interno al procesar los datos de las entrevistas."
    ]);
}
?>