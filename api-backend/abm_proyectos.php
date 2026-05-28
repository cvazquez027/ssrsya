<?php
// api-backend/abm_proyectos.php
require __DIR__ . '/cors.php';
require __DIR__ . '/db.php';
require_once __DIR__ . '/mailer.php'; 

require __DIR__ . '/session_config.php';
if (!isset($_SESSION['usuario_id'])) {
    http_response_code(401); echo json_encode(["error" => "No autorizado"]); exit;
}

header("Content-Type: application/json");
$method = $_SERVER['REQUEST_METHOD'];
$pdo = getDB();

try {
    $input = json_decode(file_get_contents('php://input'), true);
    $siglaUsuario = $_SESSION['sigla'] ?? null;
    $rolUsuario = $_SESSION['rol'] ?? '';

    if ($method === 'POST') {
        if (empty($input['descripcion']) || empty($input['og_descripcion'])) throw new Exception("Datos incompletos");
        $siglaGuardar = ($rolUsuario === 'admin' && !empty($input['sigla_dependencia'])) ? $input['sigla_dependencia'] : $siglaUsuario;
        
        $pdo->beginTransaction();
        try {
            $stmtP = $pdo->prepare("INSERT INTO proyecto (descripcion, sigla_dependencia, id_prioridad, id_estado, estado_proyecto) VALUES (?, ?, ?, ?, 1)");
            $stmtP->execute([$input['descripcion'], $siglaGuardar, $input['id_prioridad']??null, $input['id_estado']??null]);
            $idProyecto = $pdo->lastInsertId();
            
            $pdo->prepare("INSERT INTO objetivo_general (id_proyecto, descripcion) VALUES (?, ?)")->execute([$idProyecto, $input['og_descripcion']]);
            
            if (!empty($input['id_referentes']) && is_array($input['id_referentes'])) {
                $stmtRef = $pdo->prepare("INSERT INTO proyecto_referente (id_proyecto, id_referente) VALUES (?, ?)");
                foreach ($input['id_referentes'] as $idRef) {
                    $stmtRef->execute([$idProyecto, $idRef]);
                }
            }

            $pdo->commit();
            echo json_encode(["success" => true, "mensaje" => "Proyecto creado"]);
        } catch (Exception $e) { $pdo->rollBack(); throw $e; }

    } elseif ($method === 'PUT') {
        if (empty($input['id_proyecto'])) throw new Exception("ID requerido");

        if (isset($input['estado_proyecto']) && (int)$input['estado_proyecto'] === 2) {
            $idProy = $input['id_proyecto'];
            $sqlCheck = "SELECT COUNT(*) FROM revision_ssrsya r 
                         JOIN tabla_revisada tr ON r.id_tabla_revisada = tr.id_tabla_revisada
                         LEFT JOIN proyecto p ON tr.tabla_revisada = 'proyecto' AND p.id_proyecto = r.id_pk_tabla_revisada
                         LEFT JOIN objetivo_especifico oe ON tr.tabla_revisada = 'objetivo_especifico' AND oe.id_oe = r.id_pk_tabla_revisada
                         LEFT JOIN actividad_prioritaria ap ON tr.tabla_revisada = 'actividad_prioritaria' AND ap.id_actividad = r.id_pk_tabla_revisada
                         LEFT JOIN indicador i ON tr.tabla_revisada = 'indicador' AND i.id_indicador = r.id_pk_tabla_revisada
                         LEFT JOIN objetivo_general og_oe ON oe.id_og = og_oe.id_og
                         LEFT JOIN objetivo_especifico oe_ap ON ap.id_oe = oe_ap.id_oe
                         LEFT JOIN objetivo_general og_ap ON oe_ap.id_og = og_ap.id_og
                         LEFT JOIN actividad_prioritaria ap_i ON i.id_actividad = ap_i.id_actividad
                         LEFT JOIN objetivo_especifico oe_i ON ap_i.id_oe = oe_i.id_oe
                         LEFT JOIN objetivo_general og_i ON oe_i.id_og = og_i.id_og
                         WHERE r.revision_cerrada = 0
                         AND (p.id_proyecto = ? OR og_oe.id_proyecto = ? OR og_ap.id_proyecto = ? OR og_i.id_proyecto = ?)";
            
            $stmtCheck = $pdo->prepare($sqlCheck);
            $stmtCheck->execute([$idProy, $idProy, $idProy, $idProy]);
            if ($stmtCheck->fetchColumn() > 0) throw new Exception("No se puede enviar a autorizar: Existen revisiones/hilos abiertos.");
        }

        $pdo->beginTransaction();
        try {
            $sqlP = "UPDATE proyecto SET descripcion = ?, id_prioridad = ?, id_estado = ? ";
            $params = [$input['descripcion'], $input['id_prioridad']??null, $input['id_estado']??null];

            if ($rolUsuario === 'admin' && isset($input['sigla_dependencia'])) {
                $sqlP .= ", sigla_dependencia = ? ";
                $params[] = $input['sigla_dependencia'];
            }
            
            if (isset($input['estado_proyecto'])) {
                $sqlP .= ", estado_proyecto = ? ";
                $params[] = $input['estado_proyecto'];
            }

            $sqlP .= " WHERE id_proyecto = ?";
            $params[] = $input['id_proyecto'];

            $stmtP = $pdo->prepare($sqlP);
            $stmtP->execute($params);

            if (!empty($input['og_descripcion'])) {
                $pdo->prepare("UPDATE objetivo_general SET descripcion = ? WHERE id_proyecto = ?")->execute([$input['og_descripcion'], $input['id_proyecto']]);
            }

            // Actualizar Referentes Múltiples
            if (!isset($input['estado_proyecto'])) {
                $pdo->prepare("DELETE FROM proyecto_referente WHERE id_proyecto = ?")->execute([$input['id_proyecto']]);
                if (!empty($input['id_referentes']) && is_array($input['id_referentes'])) {
                    $stmtRef = $pdo->prepare("INSERT INTO proyecto_referente (id_proyecto, id_referente) VALUES (?, ?)");
                    foreach ($input['id_referentes'] as $idRef) {
                        $stmtRef->execute([$input['id_proyecto'], $idRef]);
                    }
                }
            }

            $pdo->commit();

            try {
                if (isset($input['estado_proyecto'])) {
                    $nuevoEstado = (int)$input['estado_proyecto'];
                    $infoProy = getInfoProyectoPadre(1, $input['id_proyecto']); 

                    if ($infoProy) {
                        if ($nuevoEstado == 2) {
                            $autorizantes = getEmailsPorRol('autorizante', $infoProy['sigla']);
                            if (!empty($autorizantes)) {
                                $asunto = "Proyecto Para Autorizar - {$infoProy['sigla']}";
                                $cuerpo = "<p>El proyecto <b>{$infoProy['nombre']}</b> está listo para su autorización.</p>";
                                enviarCorreoBrevo($autorizantes, $asunto, $cuerpo);
                            }
                        }
                        elseif (in_array($nuevoEstado, [1, 3, 4])) {
                            $cargas = getEmailsPorRol('carga', $infoProy['sigla']);
                            
                            // Consulta Quirúrgica: Prioriza el mail de la tabla usuario si existe vinculación.
                            $sqlCorreosRef = "
                                SELECT COALESCE(u.email, c.correo_electronico) as email
                                FROM proyecto_referente pr
                                JOIN referente ref ON pr.id_referente = ref.id_referente
                                LEFT JOIN usuario u ON ref.id_usuario = u.id_usuario
                                LEFT JOIN datos_contacto c ON ref.id_referente = c.id_referente AND c.vigente = 1
                                WHERE pr.id_proyecto = ?
                                AND (u.email IS NOT NULL OR c.correo_electronico IS NOT NULL)
                            ";
                            $stmtRefs = $pdo->prepare($sqlCorreosRef);
                            $stmtRefs->execute([$input['id_proyecto']]);
                            // Array_unique evita que si un mismo usuario es referente dos veces, le lleguen 2 correos
                            $correosRefs = array_unique($stmtRefs->fetchAll(PDO::FETCH_COLUMN));

                            $destinatarios = array_merge($cargas, $correosRefs);
                            $estados = [1 => 'REABIERTO', 3 => 'APROBADO', 4 => 'RECHAZADO'];
                            $estadoTxt = $estados[$nuevoEstado];

                            if (!empty($destinatarios)) {
                                $asunto = "Proyecto $estadoTxt - {$infoProy['sigla']}";
                                $cuerpo = "<p>El proyecto <b>{$infoProy['nombre']}</b> ha cambiado de estado a <b>$estadoTxt</b>.</p>";
                                enviarCorreoBrevo($destinatarios, $asunto, $cuerpo);
                            }
                        }
                    }
                }
            } catch (Exception $eMail) { /* Silent fail */ }

            echo json_encode(["success" => true, "mensaje" => "Proyecto actualizado"]);

        } catch (Exception $e) { $pdo->rollBack(); throw $e; }

    } elseif ($method === 'DELETE') {
        if (empty($input['id_proyecto'])) throw new Exception("ID requerido");
        $pdo->beginTransaction();
        try {
            $pdo->prepare("DELETE FROM objetivo_general WHERE id_proyecto = ?")->execute([$input['id_proyecto']]);
            $pdo->prepare("DELETE FROM proyecto WHERE id_proyecto = ?")->execute([$input['id_proyecto']]);
            $pdo->commit();
            echo json_encode(["success" => true]);
        } catch (Exception $e) { $pdo->rollBack(); throw $e; }
    }

} catch (Exception $e) {
    if (http_response_code() == 200) http_response_code(400);
    echo json_encode(["error" => $e->getMessage()]);
}
?>