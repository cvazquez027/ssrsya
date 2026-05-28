<?php
// api-backend/revisiones_detalle.php
require __DIR__ . '/cors.php';
require __DIR__ . '/db.php';

header("Content-Type: application/json");
$pdo = getDB();

$id = $_GET['id'] ?? null;
$tipo = $_GET['tipo'] ?? null; // 'proyecto', 'objetivo_especifico', 'actividad', 'indicador'

if (!$id || !$tipo) {
    http_response_code(400);
    echo json_encode(["error" => "Faltan parámetros"]);
    exit;
}

try {
    $data = [];
    
    switch ($tipo) {
        case 'proyecto':
            // Traemos proyecto y su objetivo general (si tiene)
            $sql = "SELECT p.*, og.descripcion as obj_gral_desc 
                    FROM proyecto p 
                    LEFT JOIN objetivo_general og ON p.id_proyecto = og.id_proyecto 
                    WHERE p.id_proyecto = ?";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$id]);
            $res = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($res) {
                $data = [
                    'tipo' => 'proyecto',
                    'nombre' => $res['descripcion'],
                    'detalle' => $res, // Todos los campos
                    'contexto' => [] // No tiene padres
                ];
            }
            break;

        case 'objetivo_especifico':
            // Traemos OE + Proyecto Padre
            $sql = "SELECT oe.*, p.descripcion as proyecto_nombre 
                    FROM objetivo_especifico oe
                    JOIN objetivo_general og ON oe.id_og = og.id_og
                    JOIN proyecto p ON og.id_proyecto = p.id_proyecto
                    WHERE oe.id_oe = ?";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$id]);
            $res = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($res) {
                $data = [
                    'tipo' => 'objetivo_especifico',
                    'nombre' => $res['descripcion'],
                    'detalle' => $res,
                    'contexto' => [
                        ['label' => 'Proyecto', 'val' => $res['proyecto_nombre']]
                    ]
                ];
            }
            break;

        case 'actividad_prioritaria':
            // Traemos Actividad + OE + Proyecto
            $sql = "SELECT a.*, oe.descripcion as oe_nombre, p.descripcion as proyecto_nombre
                    FROM actividad_prioritaria a
                    JOIN objetivo_especifico oe ON a.id_oe = oe.id_oe
                    JOIN objetivo_general og ON oe.id_og = og.id_og
                    JOIN proyecto p ON og.id_proyecto = p.id_proyecto
                    WHERE a.id_actividad = ?";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$id]);
            $res = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($res) {
                $data = [
                    'tipo' => 'actividad',
                    'nombre' => $res['descripcion'],
                    'detalle' => $res,
                    'contexto' => [
                        ['label' => 'Proyecto', 'val' => $res['proyecto_nombre']],
                        ['label' => 'Obj. Específico', 'val' => $res['oe_nombre']]
                    ]
                ];
            }
            break;

        case 'indicador':
            // Traemos Indicador + Actividad + OE + Proyecto
            $sql = "SELECT i.*, a.descripcion as act_nombre, oe.descripcion as oe_nombre, p.descripcion as proyecto_nombre
                    FROM indicador i
                    JOIN actividad_prioritaria a ON i.id_actividad = a.id_actividad
                    JOIN objetivo_especifico oe ON a.id_oe = oe.id_oe
                    JOIN objetivo_general og ON oe.id_og = og.id_og
                    JOIN proyecto p ON og.id_proyecto = p.id_proyecto
                    WHERE i.id_indicador = ?";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$id]);
            $res = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($res) {
                $data = [
                    'tipo' => 'indicador',
                    'nombre' => $res['nombre'],
                    'detalle' => $res,
                    'contexto' => [
                        ['label' => 'Proyecto', 'val' => $res['proyecto_nombre']],
                        ['label' => 'Obj. Específico', 'val' => $res['oe_nombre']],
                        ['label' => 'Actividad', 'val' => $res['act_nombre']]
                    ]
                ];
            }
            break;
    }

    echo json_encode($data);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}
?>