<?php
// api-backend/1109_gestion.php
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

$accion = $_GET['accion'] ?? '';
$pdo = getDB();

try {
    switch ($accion) {
        
        case 'listar_todo':
            $periodos = $pdo->query("SELECT * FROM 1109_periodo_facturacion ORDER BY anio DESC, mes DESC")->fetchAll(PDO::FETCH_ASSOC);
            $agentes = $pdo->query("SELECT * FROM 1109_agente ORDER BY nombre ASC")->fetchAll(PDO::FETCH_ASSOC);

            $res = [
                "periodos" => $periodos,
                "agentes" => $agentes,
                "auxiliares" => [
                    "convenios" => $pdo->query("SELECT * FROM 1109_convenio")->fetchAll(PDO::FETCH_ASSOC),
                    "niveles" => $pdo->query("SELECT * FROM 1109_nivel_grado")->fetchAll(PDO::FETCH_ASSOC),
                    "tipos" => $pdo->query("SELECT * FROM 1109_tipo_solicitud")->fetchAll(PDO::FETCH_ASSOC),
                    "urs" => $pdo->query("SELECT * FROM 1109_ur ORDER BY fecha_desde DESC")->fetchAll(PDO::FETCH_ASSOC),
                    "dependencias" => $pdo->query("SELECT sigla, descripcion FROM dependencia WHERE vigente = 1")->fetchAll(PDO::FETCH_ASSOC)
                ]
            ];
            echo json_encode($res);
            break;

        case 'get_facturacion':
            $idPeriodo = $_GET['id_periodo'] ?? 0;
            $sql = "SELECT a.id_1109_agente, a.nombre, a.cuil, a.celular, a.id_1109_tipo_solicitud, a.cant_urs, a.activo, a.sigla,
                           f.id_1109_facturacion as id_fact, f.facturado, f.nro_comprobante, f.fecha_presentacion, f.en_nota
                    FROM 1109_agente a
                    LEFT JOIN 1109_facturacion f ON a.id_1109_agente = f.id_1109_agente AND f.id_1109_periodo_facturacion = ?
                    ORDER BY a.nombre ASC";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$idPeriodo]);
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
            break;

        case 'marcar_en_nota':
            $data = json_decode(file_get_contents('php://input'), true);
            if (!empty($data['ids'])) {
                $inQuery = implode(',', array_fill(0, count($data['ids']), '?'));
                $sql = "UPDATE 1109_facturacion SET en_nota = 1 WHERE id_1109_facturacion IN ($inQuery)";
                $pdo->prepare($sql)->execute($data['ids']);
            }
            echo json_encode(["status" => "ok"]);
            break;

        case 'crear_periodo':
            $data = json_decode(file_get_contents('php://input'), true);
            if (empty($data['mes']) || empty($data['anio'])) throw new Exception("Datos incompletos");

            $check = $pdo->prepare("SELECT id_1109_periodo_facturacion FROM 1109_periodo_facturacion WHERE mes = ? AND anio = ?");
            $check->execute([$data['mes'], $data['anio']]);
            if ($check->fetch()) {
                http_response_code(400);
                echo json_encode(["error" => "El período ya existe."]);
                exit;
            }

            $pdo->beginTransaction();
            try {
                $stmt = $pdo->prepare("INSERT INTO 1109_periodo_facturacion (mes, anio) VALUES (?, ?)");
                $stmt->execute([$data['mes'], $data['anio']]);
                $idNuevoPeriodo = $pdo->lastInsertId();

                $agentesActivos = $pdo->query("SELECT id_1109_agente FROM 1109_agente WHERE activo = 1")->fetchAll(PDO::FETCH_COLUMN);
                $stmtFact = $pdo->prepare("INSERT INTO 1109_facturacion (id_1109_agente, id_1109_periodo_facturacion, facturado) VALUES (?, ?, 0)");
                foreach ($agentesActivos as $idAgente) $stmtFact->execute([$idAgente, $idNuevoPeriodo]);

                $pdo->commit();
                echo json_encode(["success" => true, "id_periodo" => $idNuevoPeriodo]);
            } catch (Exception $e) {
                $pdo->rollBack();
                throw $e;
            }
            break;

        case 'asignar_periodo':
            $data = json_decode(file_get_contents('php://input'), true);
            $stmt = $pdo->prepare("INSERT IGNORE INTO 1109_facturacion (id_1109_agente, id_1109_periodo_facturacion, facturado) VALUES (?, ?, 0)");
            $stmt->execute([$data['id_agente'], $data['id_periodo']]);
            echo json_encode(["status" => "ok"]);
            break;

        case 'update_celda_auxiliar':
            $data = json_decode(file_get_contents('php://input'), true);
            $tablaValida = preg_replace('/[^a-zA-Z0-9_]/', '', $data['tabla']);
            $campoValido = preg_replace('/[^a-zA-Z0-9_]/', '', $data['campo']);
            $pkCampoValida = preg_replace('/[^a-zA-Z0-9_]/', '', $data['pk_campo']);
            $valor = $data['valor'] === '' ? null : $data['valor'];
            $sql = "UPDATE {$tablaValida} SET {$campoValido} = ? WHERE {$pkCampoValida} = ?";
            $pdo->prepare($sql)->execute([$valor, $data['pk_valor']]);
            echo json_encode(["status" => "ok"]);
            break;

        case 'nuevo_auxiliar':
            $data = json_decode(file_get_contents('php://input'), true);
            $tabla = preg_replace('/[^a-zA-Z0-9_]/', '', $data['tabla']);
            if ($tabla === '1109_ur') $sql = "INSERT INTO 1109_ur (valor, fecha_desde, fecha_hasta) VALUES (0, CURDATE(), NULL)";
            else $sql = "INSERT INTO {$tabla} (descripcion, vigente) VALUES ('Nuevo registro', 1)";
            $pdo->query($sql);
            echo json_encode(["status" => "ok", "id" => $pdo->lastInsertId()]);
            break;

        case 'guardar_agente':
            $data = json_decode(file_get_contents('php://input'), true);
            if (empty($data['nombre']) || empty($data['cuil'])) throw new Exception("Nombre y CUIL obligatorios");

            $id_tipo = !empty($data['id_1109_tipo_solicitud']) ? $data['id_1109_tipo_solicitud'] : null;
            $sigla = !empty($data['sigla']) ? $data['sigla'] : null;
            $id_convenio = !empty($data['id_1109_convenio']) ? $data['id_1109_convenio'] : null;
            $id_nivel = !empty($data['id_1109_nivel_grado']) ? $data['id_1109_nivel_grado'] : null;
            $cant_urs = !empty($data['cant_urs']) ? $data['cant_urs'] : null;
            $dedicacion = !empty($data['dedicacion']) ? $data['dedicacion'] : null;
            $celular = !empty($data['celular']) ? $data['celular'] : null;
            $correo = !empty($data['correo_electronico']) ? $data['correo_electronico'] : null;

            if (empty($data['id_1109_agente']) || $data['id_1109_agente'] == 0) {
                $sql = "INSERT INTO 1109_agente (id_1109_tipo_solicitud, sigla, nombre, cuil, id_1109_convenio, id_1109_nivel_grado, cant_urs, dedicacion, celular, correo_electronico) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
                $pdo->prepare($sql)->execute([$id_tipo, $sigla, $data['nombre'], $data['cuil'], $id_convenio, $id_nivel, $cant_urs, $dedicacion, $celular, $correo]);
                echo json_encode(["status" => "ok", "id" => $pdo->lastInsertId()]);
            } else {
                $sql = "UPDATE 1109_agente SET id_1109_tipo_solicitud = ?, sigla = ?, nombre = ?, cuil = ?, id_1109_convenio = ?, id_1109_nivel_grado = ?, cant_urs = ?, dedicacion = ?, celular = ?, correo_electronico = ? WHERE id_1109_agente = ?";
                $pdo->prepare($sql)->execute([$id_tipo, $sigla, $data['nombre'], $data['cuil'], $id_convenio, $id_nivel, $cant_urs, $dedicacion, $celular, $correo, $data['id_1109_agente']]);
                echo json_encode(["status" => "ok"]);
            }
            break;

        case 'subir_factura_unificada':
            if (!isset($_FILES['pdf']) || !isset($_POST['id_facturacion'])) {
                throw new Exception("Faltan datos o el archivo PDF.");
            }

            $directorio = __DIR__ . '/facturas/';
            if (!is_dir($directorio)) mkdir($directorio, 0777, true);

            $nombreArchivo = basename($_POST['nombre_archivo']);
            $rutaDestino = $directorio . $nombreArchivo;
            $nroComprobante = $_POST['nro_comprobante'] ?? null;

            if (move_uploaded_file($_FILES['pdf']['tmp_name'], $rutaDestino)) {
                $sql = "UPDATE 1109_facturacion SET facturado = 1, nro_comprobante = ?, fecha_presentacion = CURDATE() WHERE id_1109_facturacion = ?";
                $pdo->prepare($sql)->execute([$nroComprobante, $_POST['id_facturacion']]);
                
                echo json_encode(["status" => "ok", "mensaje" => "Archivo guardado y agente actualizado."]);
            } else {
                throw new Exception("Error al mover el archivo al directorio.");
            }
            break;

        case 'obtener_archivo':
            $nombreArchivo = basename($_GET['nombre'] ?? '');
            $rutaDestino = __DIR__ . '/facturas/' . $nombreArchivo;
            
            if (!empty($nombreArchivo) && file_exists($rutaDestino)) {
                header('Content-Type: application/pdf');
                header('Content-Disposition: attachment; filename="' . $nombreArchivo . '"');
                header('Content-Length: ' . filesize($rutaDestino));
                readfile($rutaDestino);
                exit;
            } else {
                http_response_code(404);
                echo json_encode(["error" => "Archivo no encontrado en el servidor"]);
                exit;
            }
            break;

        default:
            http_response_code(404);
            echo json_encode(["error" => "Acción no definida"]);
            break;
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}
?>