<?php
// api-backend/abm_indicadores.php
ini_set('display_errors', 0);
error_reporting(E_ALL);

require __DIR__ . '/cors.php';
require __DIR__ . '/db.php';
require __DIR__ . '/session_config.php';

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

    $input = json_decode(file_get_contents('php://input'), true);

    // Función auxiliar para transformar strings vacíos en nulos para la BD
    function parseNum($val) {
        if ($val === "" || $val === null) return null;
        return is_numeric($val) ? (float)$val : null;
    }

    // ================= POST (CREAR) =================
    if ($method === 'POST') {
        $pdo->beginTransaction();

        try {
            // CIRUGÍA 1: Agregamos fecha_creacion = CURDATE() y manejamos los NOT NULL de tu esquema
            $sql = "INSERT INTO indicador (
                        id_actividad, nombre, construccion, tipo_meta, 
                        meta_anio1, meta_anio2, id_tipo_indicador, id_otro_sistema, 
                        fuente, linea_base, fecha_creacion
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE())";
            
            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                $input['id_actividad'],
                $input['nombre'],
                $input['construccion'] ?? '', // Se pasa vacío en vez de null por NOT NULL
                $input['tipo_meta'] ?? 'cantidad',
                parseNum($input['meta_anio1']) ?? '0',
                parseNum($input['meta_anio2']) ?? '0',
                $input['id_tipo_indicador'] ?? 0,
                $input['id_otro_sistema'] ?? 0,
                $input['fuente'] ?? '',
                $input['linea_base'] ?? ''
            ]);

            $id_indicador = $pdo->lastInsertId();

            // CIRUGÍA 2: Insertar los 4 períodos de monitoreo (Se incluye meta_propuesta = '0' para cumplir el NOT NULL)
            $periodos = [1, 2, 3, 4];
            $sqlMonitoreo = "INSERT INTO monitoreo (id_indicador, id_periodo_monitoreo, meta_propuesta) VALUES (?, ?, '0')";
            $stmtMonitoreo = $pdo->prepare($sqlMonitoreo);
            
            foreach ($periodos as $id_periodo) {
                $stmtMonitoreo->execute([$id_indicador, $id_periodo]);
            }

            $pdo->commit();
            echo json_encode(["success" => true, "mensaje" => "Indicador creado", "id" => $id_indicador]);
            exit;

        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    // ================= PUT (EDITAR) =================
    if ($method === 'PUT') {
        if (empty($input['id_indicador'])) throw new Exception("ID de indicador requerido");

        $sql = "UPDATE indicador SET 
                    id_actividad = ?, nombre = ?, construccion = ?, tipo_meta = ?, 
                    meta_anio1 = ?, meta_anio2 = ?, id_tipo_indicador = ?, id_otro_sistema = ?, 
                    fuente = ?, linea_base = ?
                WHERE id_indicador = ?";
                
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            $input['id_actividad'],
            $input['nombre'],
            $input['construccion'] ?? '',
            $input['tipo_meta'] ?? 'cantidad',
            parseNum($input['meta_anio1']) ?? '0',
            parseNum($input['meta_anio2']) ?? '0',
            $input['id_tipo_indicador'] ?? 0,
            $input['id_otro_sistema'] ?? 0,
            $input['fuente'] ?? '',
            $input['linea_base'] ?? '',
            $input['id_indicador']
        ]);

        echo json_encode(["success" => true, "mensaje" => "Indicador actualizado correctamente"]);
        exit;
    }

    // ================= DELETE (BORRAR) =================
    if ($method === 'DELETE') {
        if (empty($input['id_indicador'])) throw new Exception("ID de indicador requerido");
        
        $pdo->beginTransaction();
        try {
            // CIRUGÍA 3: Borramos primero los monitoreos hijos para evitar error de Llave Foránea
            $stmtHijos = $pdo->prepare("DELETE FROM monitoreo WHERE id_indicador = ?");
            $stmtHijos->execute([$input['id_indicador']]);

            // Luego borramos el indicador padre
            $stmtPadre = $pdo->prepare("DELETE FROM indicador WHERE id_indicador = ?");
            $stmtPadre->execute([$input['id_indicador']]);

            $pdo->commit();
            echo json_encode(["success" => true, "mensaje" => "Indicador eliminado"]);
            exit;

        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    throw new Exception("Método no soportado");

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(["error" => $e->getMessage()]);
}
?>