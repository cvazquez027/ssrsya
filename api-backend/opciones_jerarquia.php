<?php
// api-backend/opciones_jerarquia.php
ini_set('display_errors', 0);
error_reporting(E_ALL);
require __DIR__ . '/cors.php';
require __DIR__ . '/db.php';

require __DIR__ . '/session_config.php';
header("Content-Type: application/json; charset=utf-8");

try {
    $pdo = getDB();
    $pdo->exec("SET NAMES 'utf8mb4'");

    $tipo = $_GET['tipo'] ?? ''; 
    $id_padre = $_GET['id'] ?? null; 
    
    $rol = $_SESSION['rol'] ?? '';
    $sigla = $_SESSION['sigla'] ?? '';

    $data = [];

    switch ($tipo) {
        case 'proyectos':
            $sql = "SELECT id_proyecto, descripcion FROM proyecto";
            if ($rol !== 'admin') {
                $sql .= " WHERE sigla_dependencia = :sigla";
            }
            $sql .= " ORDER BY id_proyecto DESC";
            
            $stmt = $pdo->prepare($sql);
            if ($rol !== 'admin') $stmt->execute([':sigla' => $sigla]);
            else $stmt->execute();
            
            $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
            break;

        case 'oes':
            if (!$id_padre) throw new Exception("Falta ID Proyecto");
            $sql = "SELECT oe.id_oe, oe.descripcion 
                    FROM objetivo_especifico oe
                    INNER JOIN objetivo_general og ON oe.id_og = og.id_og
                    WHERE og.id_proyecto = ?
                    ORDER BY oe.id_oe ASC";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$id_padre]);
            $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
            break;

        case 'actividades':
            // MODIFICACIÓN QUIRÚRGICA: Ahora busca actividades por el ID del Objetivo Específico (id_oe)
            if (!$id_padre) throw new Exception("Falta ID Objetivo Específico");
            
            $sql = "SELECT id_actividad, descripcion 
                    FROM actividad_prioritaria 
                    WHERE id_oe = ?
                    ORDER BY id_actividad ASC";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$id_padre]);
            $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
            break;
    }

    echo json_encode($data);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}
?>