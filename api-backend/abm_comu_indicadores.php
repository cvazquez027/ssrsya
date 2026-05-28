<?php
// api-backend/abm_comu_indicadores.php
ini_set('display_errors', 0);
error_reporting(E_ALL);

require __DIR__ . '/cors.php';
require __DIR__ . '/db.php';
require __DIR__ . '/session_config.php';

// Seguridad: Solo usuarios autenticados
if (!isset($_SESSION['usuario_id'])) {
    http_response_code(401);
    echo json_encode(["error" => "No autorizado"]);
    exit;
}

header("Content-Type: application/json; charset=utf-8");
$method = $_SERVER['REQUEST_METHOD'];

try {
    $pdo = getDB();
    $pdo->exec("SET NAMES 'utf8mb4'");

    // Función auxiliar para limpiar números
    function limpiarNumero($val) {
        if ($val === "" || $val === null) return null;
        $val = str_replace(',', '.', (string)$val);
        $val = preg_replace('/[^0-9.-]/', '', $val);
        return is_numeric($val) ? (float)$val : null;
    }

    // ==========================================
    // GET: LISTAR INDICADORES O UNO ESPECÍFICO
    // ==========================================
    if ($method === 'GET') {
        if (isset($_GET['id'])) {
            $id = (int)$_GET['id'];
            $sql = "SELECT i.*, tm.descripcion as tipo_meta_desc 
                    FROM comu_indicador i
                    JOIN comu_tipo_meta tm ON i.id_comu_tipo_meta = tm.id_comu_tipo_meta
                    WHERE i.id_comu_indicador = ?";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$id]);
            echo json_encode(["success" => true, "data" => $stmt->fetch(PDO::FETCH_ASSOC)]);
            exit;
        }

        $sql = "SELECT i.*, tm.descripcion as tipo_meta_desc 
                FROM comu_indicador i
                JOIN comu_tipo_meta tm ON i.id_comu_tipo_meta = tm.id_comu_tipo_meta
                ORDER BY i.fecha_creacion DESC";
        $stmt = $pdo->query($sql);
        echo json_encode(["success" => true, "data" => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
        exit;
    }

    // ==========================================
    // POST: CREAR NUEVO INDICADOR
    // ==========================================
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);

        if (empty($input['sigla']) || empty($input['nombre']) || empty($input['id_comu_tipo_meta'])) {
            throw new Exception("Faltan campos obligatorios (Dependencia, Nombre o Tipo de Meta).");
        }

        $sql = "INSERT INTO comu_indicador 
                (sigla, id_comu_tipo_meta, nombre, construccion, periodo, meta_propuesta, desc_meta_propuesta, observaciones) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            $input['sigla'],
            $input['id_comu_tipo_meta'],
            $input['nombre'],
            $input['construccion'] ?? null,
            $input['periodo'] ?? null,
            limpiarNumero($input['meta_propuesta']),
            $input['desc_meta_propuesta'] ?? null,
            $input['observaciones'] ?? null
        ]);

        echo json_encode(["success" => true, "mensaje" => "Indicador creado con éxito", "id" => $pdo->lastInsertId()]);
        exit;
    }

    // ==========================================
    // PUT: ACTUALIZAR INDICADOR (COMPLETO O AVANCE)
    // ==========================================
    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);

        if (empty($input['id_comu_indicador'])) {
            throw new Exception("Falta el ID del indicador.");
        }

        $sql = "UPDATE comu_indicador SET 
                sigla = ?, 
                id_comu_tipo_meta = ?, 
                nombre = ?, 
                construccion = ?, 
                periodo = ?, 
                meta_propuesta = ?, 
                desc_meta_propuesta = ?, 
                meta_alcanzada = ?, 
                desc_meta_alcanzada = ?, 
                observaciones = ?
                WHERE id_comu_indicador = ?";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            $input['sigla'],
            $input['id_comu_tipo_meta'],
            $input['nombre'],
            $input['construccion'] ?? null,
            $input['periodo'] ?? null,
            limpiarNumero($input['meta_propuesta']),
            $input['desc_meta_propuesta'] ?? null,
            limpiarNumero($input['meta_alcanzada']),
            $input['desc_meta_alcanzada'] ?? null,
            $input['observaciones'] ?? null,
            $input['id_comu_indicador']
        ]);

        echo json_encode(["success" => true, "mensaje" => "Indicador actualizado correctamente."]);
        exit;
    }

    // ==========================================
    // DELETE: ELIMINAR INDICADOR
    // ==========================================
    if ($method === 'DELETE') {
        if (!isset($_GET['id'])) throw new Exception("ID no especificado para eliminar.");
        
        $stmt = $pdo->prepare("DELETE FROM comu_indicador WHERE id_comu_indicador = ?");
        $stmt->execute([(int)$_GET['id']]);
        
        echo json_encode(["success" => true, "mensaje" => "Indicador eliminado."]);
        exit;
    }

    throw new Exception("Método no soportado.");

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => $e->getMessage()]);
}
?>