<?php
// api-backend/abm_comu_actividades.php
ini_set('display_errors', 0);
error_reporting(E_ALL);

require __DIR__ . '/cors.php';
require __DIR__ . '/db.php';
require __DIR__ . '/session_config.php';
require __DIR__ . '/auth_utils.php';
require_once __DIR__ . '/mailer.php'; // <--- IMPORTANTE: Importamos el mailer

if (!isset($_SESSION['usuario_id'])) {
    http_response_code(401);
    echo json_encode(["error" => "No autorizado"]);
    exit;
}

header("Content-Type: application/json; charset=utf-8");
$method = $_SERVER['REQUEST_METHOD'];
$url_sistema = "https://ssrsya.my-board.org/login";

try {
    $pdo = getDB();
    $pdo->exec("SET NAMES 'utf8mb4'");

    // ================= GET =================
    if ($method === 'GET') {
        $id_usuario = $_SESSION['usuario_id'];
        
        $stmtRol = $pdo->prepare("SELECT rol FROM usuario_modulo WHERE id_usuario = ? AND id_modulo = (SELECT id_modulo FROM modulo WHERE clave = 'COMUNICACION')");
        $stmtRol->execute([$id_usuario]);
        $rol_comu = $stmtRol->fetchColumn() ?: 'consulta';

        if (isset($_GET['id'])) {
            $id = (int)$_GET['id'];
            $sql = "SELECT a.*, t.descripcion as tipo_actividad, e.descripcion as estado_actual,
                           COALESCE(v.check_comunicacion, 0) as check_comunicacion,
                           COALESCE(v.check_planificacion, 0) as check_planificacion
                    FROM comu_actividad a
                    JOIN comu_tipo_actividad t ON a.id_comu_tipo_actividad = t.id_comu_tipo_actividad
                    JOIN comu_estado e ON a.id_comu_estado = e.id_comu_estado
                    LEFT JOIN comu_actividad_validacion v ON a.id_comu_actividad = v.id_comu_actividad
                    WHERE a.id_comu_actividad = ?";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$id]);
            $act = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($act) {
                // Referentes
                $stmtR = $pdo->prepare("SELECT r.* FROM referente r JOIN comu_actividad_referente ar ON r.id_referente = ar.id_referente WHERE ar.id_comu_actividad = ?");
                $stmtR->execute([$id]);
                $act['referentes_detalle'] = $stmtR->fetchAll(PDO::FETCH_ASSOC);
                
                // URLs
                $stmtU = $pdo->prepare("SELECT * FROM comu_url WHERE id_comu_actividad = ?");
                $stmtU->execute([$id]);
                $act['urls'] = $stmtU->fetchAll(PDO::FETCH_ASSOC);

                // --- CIRUGÍA: Historial de Estados ---
                $stmtH = $pdo->prepare("SELECT h.*, e1.descripcion as estado_anterior, e2.descripcion as estado_nuevo, 
                                               CONCAT(u.nombre, ' ', u.apellido) as usuario_nombre 
                                        FROM comu_historial_estado h 
                                        JOIN comu_estado e1 ON h.id_estado_anterior = e1.id_comu_estado 
                                        JOIN comu_estado e2 ON h.id_estado_nuevo = e2.id_comu_estado 
                                        JOIN usuario u ON h.id_usuario = u.id_usuario 
                                        WHERE h.id_comu_actividad = ? 
                                        ORDER BY h.fecha_cambio DESC");
                $stmtH->execute([$id]);
                $act['historial'] = $stmtH->fetchAll(PDO::FETCH_ASSOC);
                
                echo json_encode(["success" => true, "data" => $act]);
            } else {
                throw new Exception("Actividad no encontrada");
            }
        } else {
            // Listado general
            $filtro = getSQLFilter($pdo, $id_usuario, $rol_comu, 'a.sigla');
            $sql = "SELECT a.*, t.descripcion as tipo_actividad, e.descripcion as estado_actual
                    FROM comu_actividad a
                    JOIN comu_tipo_actividad t ON a.id_comu_tipo_actividad = t.id_comu_tipo_actividad
                    JOIN comu_estado e ON a.id_comu_estado = e.id_comu_estado
                    WHERE 1=1 ";
            
            if (is_array($filtro)) {
                $sql .= $filtro['sql'];
            }
            $sql .= " ORDER BY a.id_comu_actividad DESC";
            
            $stmt = $pdo->prepare($sql);
            $stmt->execute(is_array($filtro) ? $filtro['params'] : []);
            echo json_encode(["success" => true, "data" => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
        }
        exit;
    }

    // ================= POST (CREAR) =================
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $pdo->beginTransaction();

        $stmtEstado = $pdo->prepare("SELECT id_comu_estado FROM comu_flujo_estado WHERE id_comu_tipo_actividad = ? AND orden = 1 LIMIT 1");
        $stmtEstado->execute([$input['id_comu_tipo_actividad']]);
        $id_estado_inicial = $stmtEstado->fetchColumn();

        if (!$id_estado_inicial) throw new Exception("No hay un flujo de estados configurado para este tipo de actividad.");

        $sql = "INSERT INTO comu_actividad (
                    sigla, descripcion, id_comu_tipo_actividad, id_comu_estado, 
                    id_actividad_prioritaria, fecha_inicio, fecha_est_fin, publicado
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            $input['sigla'],
            $input['descripcion'],
            $input['id_comu_tipo_actividad'],
            $id_estado_inicial,
            !empty($input['id_actividad_prioritaria']) ? $input['id_actividad_prioritaria'] : null,
            !empty($input['fecha_inicio']) ? $input['fecha_inicio'] : null,
            !empty($input['fecha_est_fin']) ? $input['fecha_est_fin'] : null,
            !empty($input['publicado']) ? 1 : 0
        ]);
        
        $idActividad = $pdo->lastInsertId();

        if (!empty($input['referentes']) && is_array($input['referentes'])) {
            $stmtRef = $pdo->prepare("INSERT INTO comu_actividad_referente (id_comu_actividad, id_referente) VALUES (?, ?)");
            foreach ($input['referentes'] as $idRef) {
                $stmtRef->execute([$idActividad, $idRef]);
            }
        }

        if (!empty($input['urls']) && is_array($input['urls'])) {
            $stmtUrl = $pdo->prepare("INSERT INTO comu_url (id_comu_actividad, etiqueta, url) VALUES (?, ?, ?)");
            foreach ($input['urls'] as $link) {
                if (!empty($link['url'])) {
                    $stmtUrl->execute([$idActividad, !empty($link['etiqueta']) ? $link['etiqueta'] : 'Enlace', $link['url']]);
                }
            }
        }

        $pdo->commit();

        // --- CIRUGÍA MAILER: Alta ---
        $stmtM = $pdo->prepare("SELECT dc.correo_electronico FROM comu_actividad_referente car JOIN datos_contacto dc ON car.id_referente = dc.id_referente WHERE car.id_comu_actividad = ? AND dc.vigente = 1 AND dc.correo_electronico IS NOT NULL AND dc.correo_electronico != ''");
        $stmtM->execute([$idActividad]);
        $emails = $stmtM->fetchAll(PDO::FETCH_COLUMN);

        if (!empty($emails)) {
            $asunto = "Nueva Actividad Asignada - SSRSyA";
            $cuerpo = "<h3>Se te ha asignado una nueva actividad de Comunicación</h3>";
            $cuerpo .= "<p><b>Área:</b> {$input['sigla']}</p>";
            $cuerpo .= "<p><b>Descripción:</b> {$input['descripcion']}</p>";
            $cuerpo .= "<p><a href='{$url_sistema}'>Hacé clic aquí para ingresar al sistema y ver los detalles.</a></p>";
            enviarCorreoBrevo($emails, $asunto, $cuerpo);
        }

        echo json_encode(["success" => true, "mensaje" => "Actividad dada de alta en su etapa inicial."]);
        exit;
    }

    // ================= PUT (ACTUALIZAR) =================
    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);
        $pdo->beginTransaction();

        $idActividad = $input['id_comu_actividad'];
        $modo = $input['modo'] ?? 'completo';
        $usuario_id = $_SESSION['usuario_id'];
        $observacion = $input['observacion'] ?? ''; // Para el historial
        $huboCambioEstado = false;

        // 1. AVANZAR ETAPA
        if ($modo === 'avanzar') {
            $stmtData = $pdo->prepare("SELECT ca.id_comu_estado, ca.id_comu_tipo_actividad, ce.descripcion FROM comu_actividad ca JOIN comu_estado ce ON ca.id_comu_estado = ce.id_comu_estado WHERE ca.id_comu_actividad = ?");
            $stmtData->execute([$idActividad]);
            $actActual = $stmtData->fetch(PDO::FETCH_ASSOC);
            $idEstadoAnterior = $actActual['id_comu_estado'];

            if (trim(strtolower($actActual['descripcion'])) === 'valida ssrsya') {
                $stmtCheck = $pdo->prepare("SELECT check_comunicacion, check_planificacion FROM comu_actividad_validacion WHERE id_comu_actividad = ?");
                $stmtCheck->execute([$idActividad]);
                $validaciones = $stmtCheck->fetch(PDO::FETCH_ASSOC);

                if (!$validaciones || $validaciones['check_comunicacion'] != 1 || $validaciones['check_planificacion'] != 1) {
                    throw new Exception("Para avanzar esta etapa, se requiere la validación de Comunicación y Planificación.");
                }
            }

            $stmtOrden = $pdo->prepare("SELECT orden FROM comu_flujo_estado WHERE id_comu_tipo_actividad = ? AND id_comu_estado = ?");
            $stmtOrden->execute([$actActual['id_comu_tipo_actividad'], $idEstadoAnterior]);
            $ordenActual = $stmtOrden->fetchColumn();

            $stmtSig = $pdo->prepare("SELECT id_comu_estado FROM comu_flujo_estado WHERE id_comu_tipo_actividad = ? AND orden = ?");
            $stmtSig->execute([$actActual['id_comu_tipo_actividad'], $ordenActual + 1]);
            $idEstadoNuevo = $stmtSig->fetchColumn();

            if (!$idEstadoNuevo) throw new Exception("La actividad ya se encuentra en su última etapa.");

            $pdo->prepare("UPDATE comu_actividad SET id_comu_estado = ? WHERE id_comu_actividad = ?")->execute([$idEstadoNuevo, $idActividad]);
            
            // --- CIRUGÍA: Guardar Historial ---
            $sqlH = "INSERT INTO comu_historial_estado (id_comu_actividad, id_estado_anterior, id_estado_nuevo, id_usuario, observacion) VALUES (?, ?, ?, ?, ?)";
            $pdo->prepare($sqlH)->execute([$idActividad, $idEstadoAnterior, $idEstadoNuevo, $usuario_id, $observacion]);

            $mensaje = "Etapa avanzada correctamente.";
            $huboCambioEstado = true;

        // 2. RETROCEDER ETAPA
        } elseif ($modo === 'retroceder') {
            $stmtData = $pdo->prepare("SELECT id_comu_estado, id_comu_tipo_actividad FROM comu_actividad WHERE id_comu_actividad = ?");
            $stmtData->execute([$idActividad]);
            $actActual = $stmtData->fetch(PDO::FETCH_ASSOC);
            $idEstadoAnterior = $actActual['id_comu_estado'];

            $stmtOrden = $pdo->prepare("SELECT orden FROM comu_flujo_estado WHERE id_comu_tipo_actividad = ? AND id_comu_estado = ?");
            $stmtOrden->execute([$actActual['id_comu_tipo_actividad'], $idEstadoAnterior]);
            $ordenActual = $stmtOrden->fetchColumn();

            if ($ordenActual <= 1) throw new Exception("La actividad ya se encuentra en la etapa inicial.");

            $stmtAnt = $pdo->prepare("SELECT id_comu_estado FROM comu_flujo_estado WHERE id_comu_tipo_actividad = ? AND orden = ?");
            $stmtAnt->execute([$actActual['id_comu_tipo_actividad'], $ordenActual - 1]);
            $idEstadoNuevo = $stmtAnt->fetchColumn();

            $pdo->prepare("UPDATE comu_actividad SET id_comu_estado = ? WHERE id_comu_actividad = ?")->execute([$idEstadoNuevo, $idActividad]);
            
            // --- CIRUGÍA: Guardar Historial ---
            $sqlH = "INSERT INTO comu_historial_estado (id_comu_actividad, id_estado_anterior, id_estado_nuevo, id_usuario, observacion) VALUES (?, ?, ?, ?, ?)";
            $pdo->prepare($sqlH)->execute([$idActividad, $idEstadoAnterior, $idEstadoNuevo, $usuario_id, $observacion]);

            $mensaje = "Se ha vuelto a la etapa anterior.";
            $huboCambioEstado = true;

        // 3. GUARDAR CHECKS
        } elseif ($modo === 'guardar_checks') {
            $chkComu = $input['check_comunicacion'] ?? 0;
            $chkPlan = $input['check_planificacion'] ?? 0;
            $usuarioLogueado = $_SESSION['sigla'] ?? (string)$_SESSION['usuario_id'];
            $fechaHoy = date('Y-m-d H:i:s');

            $sqlUpsert = "INSERT INTO comu_actividad_validacion (id_comu_actividad, check_comunicacion, check_planificacion, usuario_comu, usuario_plan, fecha_comu, fecha_plan)
                          VALUES (:id, :chkComu, :chkPlan, :userComu, :userPlan, :fComu, :fPlan)
                          ON DUPLICATE KEY UPDATE 
                          check_comunicacion = VALUES(check_comunicacion),
                          check_planificacion = VALUES(check_planificacion),
                          usuario_comu = CASE WHEN VALUES(check_comunicacion) = 1 THEN VALUES(usuario_comu) ELSE usuario_comu END,
                          fecha_comu = CASE WHEN VALUES(check_comunicacion) = 1 THEN VALUES(fecha_comu) ELSE fecha_comu END,
                          usuario_plan = CASE WHEN VALUES(check_planificacion) = 1 THEN VALUES(usuario_plan) ELSE usuario_plan END,
                          fecha_plan = CASE WHEN VALUES(check_planificacion) = 1 THEN VALUES(fecha_plan) ELSE fecha_plan END";

            $stmtUpsert = $pdo->prepare($sqlUpsert);
            $stmtUpsert->execute([
                ':id' => $idActividad, ':chkComu' => $chkComu, ':chkPlan' => $chkPlan,
                ':userComu' => ($chkComu == 1) ? $usuarioLogueado : null, ':userPlan' => ($chkPlan == 1) ? $usuarioLogueado : null,
                ':fComu' => ($chkComu == 1) ? $fechaHoy : null, ':fPlan' => ($chkPlan == 1) ? $fechaHoy : null
            ]);
            $mensaje = "Validaciones registradas.";

        // 4. PUBLICAR 
        } elseif ($modo === 'publicado') {
            $stmt = $pdo->prepare("UPDATE comu_actividad SET publicado = ? WHERE id_comu_actividad = ?");
            $stmt->execute([$input['publicado'], $idActividad]);
            $mensaje = "Estado de publicación actualizado.";

        // 5. EDICIÓN COMPLETA (DATOS BÁSICOS)
        } else {
            $sql = "UPDATE comu_actividad SET 
                        sigla = ?, descripcion = ?, id_comu_tipo_actividad = ?, 
                        id_actividad_prioritaria = ?, fecha_inicio = ?, fecha_est_fin = ?, publicado = ? 
                    WHERE id_comu_actividad = ?";
            
            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                $input['sigla'], $input['descripcion'], $input['id_comu_tipo_actividad'],
                !empty($input['id_actividad_prioritaria']) ? $input['id_actividad_prioritaria'] : null,
                !empty($input['fecha_inicio']) ? $input['fecha_inicio'] : null,
                !empty($input['fecha_est_fin']) ? $input['fecha_est_fin'] : null,
                !empty($input['publicado']) ? 1 : 0,
                $idActividad
            ]);

            $pdo->prepare("DELETE FROM comu_actividad_referente WHERE id_comu_actividad = ?")->execute([$idActividad]);
            if (!empty($input['referentes']) && is_array($input['referentes'])) {
                $stmtRef = $pdo->prepare("INSERT INTO comu_actividad_referente (id_comu_actividad, id_referente) VALUES (?, ?)");
                foreach ($input['referentes'] as $idRef) { $stmtRef->execute([$idActividad, $idRef]); }
            }

            $pdo->prepare("DELETE FROM comu_url WHERE id_comu_actividad = ?")->execute([$idActividad]);
            if (!empty($input['urls']) && is_array($input['urls'])) {
                $stmtUrl = $pdo->prepare("INSERT INTO comu_url (id_comu_actividad, etiqueta, url) VALUES (?, ?, ?)");
                foreach ($input['urls'] as $link) {
                    if (!empty($link['url'])) { $stmtUrl->execute([$idActividad, !empty($link['etiqueta']) ? $link['etiqueta'] : 'Enlace', $link['url']]); }
                }
            }
            $mensaje = "Actividad actualizada correctamente.";
        }

        $pdo->commit();

        // --- CIRUGÍA MAILER: Cambio de Estado ---
        if ($huboCambioEstado) {
            $stmtDesc = $pdo->prepare("SELECT a.descripcion, a.sigla, e.descripcion as estado_desc FROM comu_actividad a JOIN comu_estado e ON a.id_comu_estado = e.id_comu_estado WHERE a.id_comu_actividad = ?");
            $stmtDesc->execute([$idActividad]);
            $infoAct = $stmtDesc->fetch(PDO::FETCH_ASSOC);

            $stmtM = $pdo->prepare("SELECT dc.correo_electronico FROM comu_actividad_referente car JOIN datos_contacto dc ON car.id_referente = dc.id_referente WHERE car.id_comu_actividad = ? AND dc.vigente = 1 AND dc.correo_electronico IS NOT NULL AND dc.correo_electronico != ''");
            $stmtM->execute([$idActividad]);
            $emails = $stmtM->fetchAll(PDO::FETCH_COLUMN);

            if (!empty($emails)) {
                $asunto = "Cambio de Estado: Actividad de Comunicación";
                $cuerpo = "<h3>Actualización de Actividad</h3>";
                $cuerpo .= "<p>La actividad <b>{$infoAct['descripcion']}</b> del área <b>{$infoAct['sigla']}</b> ha cambiado de estado.</p>";
                $cuerpo .= "<p><b>Nuevo Estado:</b> <span style='color:#2563eb; font-weight:bold;'>{$infoAct['estado_desc']}</span></p>";
                $cuerpo .= "<p><b>Observación registrada:</b> <i>{$observacion}</i></p>"; // Agregamos la obs al mail
                $cuerpo .= "<p><a href='{$url_sistema}'>Hacé clic aquí para ingresar al sistema y ver los detalles.</a></p>";
                enviarCorreoBrevo($emails, $asunto, $cuerpo);
            }
        }

        echo json_encode(["success" => true, "mensaje" => $mensaje]);
        exit;
    }

    // ================= DELETE =================
    if ($method === 'DELETE') {
        if (!isset($_GET['id'])) throw new Exception("ID no especificado");
        $stmt = $pdo->prepare("DELETE FROM comu_actividad WHERE id_comu_actividad = ?");
        $stmt->execute([(int)$_GET['id']]);
        echo json_encode(["success" => true, "mensaje" => "Actividad eliminada"]);
        exit;
    }

    throw new Exception("Método no soportado");

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) { $pdo->rollBack(); }
    http_response_code(400);
    echo json_encode(["error" => $e->getMessage()]);
}
?>