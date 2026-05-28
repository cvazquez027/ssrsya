<?php
// api-backend/importar_confirmar.php
ini_set('display_errors', 0);
ini_set('max_execution_time', 600); 
error_reporting(E_ALL);

require __DIR__ . '/cors.php';
require __DIR__ . '/db.php';

if (session_status() === PHP_SESSION_NONE) session_start();
if (!isset($_SESSION['usuario_id'])) {
    http_response_code(401); echo json_encode(["error" => "No autorizado"]); exit;
}

header("Content-Type: application/json");
$pdo = getDB();

$pdo->exec("SET sql_mode=''");

$input = json_decode(file_get_contents('php://input'), true);
$datos = $input['datos'] ?? [];
$accionRef = $input['accion_referente'] ?? 'actualizar';

if (empty($datos)) {
    echo json_encode(["success" => false, "error" => "No hay datos seleccionados para importar."]); exit;
}

try {
    $pdo->beginTransaction();
    $stats = ['proyectos' => 0, 'referentes' => 0, 'actividades' => 0, 'indicadores' => 0];
    
    $cacheProyectos = []; $cachePrioridad = []; $cacheOG = []; $cacheOE = []; $cacheAct = [];

    function normalizarKey($txt) {
        $key = strtolower(trim($txt ?? ''));
        return str_replace(['á','é','í','ó','ú','Á','É','Í','Ó','Ú','ñ','Ñ'], ['a','e','i','o','u','a','e','i','o','u','n','n'], $key);
    }

    $mapaTiposActividad = [];
    $stmt = $pdo->query("SELECT id_tipo_actividad_prioritaria, descripcion FROM tipo_actividad_prioritaria");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) { $mapaTiposActividad[normalizarKey($row['descripcion'])] = $row['id_tipo_actividad_prioritaria']; }

    $mapaTiposIndicador = [];
    $stmt = $pdo->query("SELECT id_tipo_indicador, nombre as descripcion FROM tipo_indicador");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) { $mapaTiposIndicador[normalizarKey($row['descripcion'])] = $row['id_tipo_indicador']; }

    $mapaOtroSistema = [];
    $stmt = $pdo->query("SELECT id_otro_sistema, descripcion FROM otro_sistema");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) { $mapaOtroSistema[normalizarKey($row['descripcion'])] = $row['id_otro_sistema']; }

    function getIdSmart($desc, $mapa) {
        if (!$desc) return null;
        return $mapa[normalizarKey($desc)] ?? null;
    }

    function getPrioridadId($pdo, $desc, &$cache) {
        if (!$desc) return 2; 
        if (isset($cache[$desc])) return $cache[$desc];
        $stmt = $pdo->prepare("SELECT id_prioridad FROM prioridad WHERE LOWER(TRIM(descripcion)) LIKE ? LIMIT 1");
        $stmt->execute([strtolower(trim($desc))]);
        $id = $stmt->fetchColumn();
        if ($id) $cache[$desc] = $id;
        return $id ?: 2;
    }

    foreach ($datos as $fila) {
        $siglaDep = $fila['dependencia'] ?? '';

        $idReferente = null;
        if (!empty($fila['referente']['cuil'])) {
            $cuil = $fila['referente']['cuil'];
            $stmtRef = $pdo->prepare("SELECT id_referente FROM referente WHERE cuil = ?");
            $stmtRef->execute([$cuil]);
            $idReferente = $stmtRef->fetchColumn();

            $nombreRef = $fila['referente']['nombre'] ?? '';
            $apellidoRef = $fila['referente']['apellido'] ?? '';

            if ($idReferente) {
                $pdo->prepare("UPDATE referente SET nombre=?, apellido=?, sigla=? WHERE id_referente=?")
                    ->execute([$nombreRef, $apellidoRef, $siglaDep, $idReferente]);
                
                if (!empty($fila['referente']['email']) || !empty($fila['referente']['telefono'])) {
                    if ($accionRef === 'historial') {
                        $pdo->prepare("UPDATE datos_contacto SET vigente=0 WHERE id_referente=?")->execute([$idReferente]);
                        $pdo->prepare("INSERT INTO datos_contacto (id_referente, correo_electronico, telefono, direccion, vigente) VALUES (?, ?, ?, ?, 1)")
                            ->execute([$idReferente, $fila['referente']['email'], $fila['referente']['telefono'], '']);
                    } else {
                        $stmtCheckC = $pdo->prepare("SELECT id_datos_contacto FROM datos_contacto WHERE id_referente=? AND vigente=1 ORDER BY id_datos_contacto DESC LIMIT 1");
                        $stmtCheckC->execute([$idReferente]);
                        $idCont = $stmtCheckC->fetchColumn();
                        if ($idCont) {
                            $pdo->prepare("UPDATE datos_contacto SET correo_electronico=?, telefono=? WHERE id_datos_contacto=?")
                                ->execute([$fila['referente']['email'], $fila['referente']['telefono'], $idCont]);
                        } else {
                            $pdo->prepare("INSERT INTO datos_contacto (id_referente, correo_electronico, telefono, vigente) VALUES (?, ?, ?, 1)")
                                ->execute([$idReferente, $fila['referente']['email'], $fila['referente']['telefono']]);
                        }
                    }
                }
            } else {
                $pdo->prepare("INSERT INTO referente (nombre, apellido, cuil, sigla) VALUES (?, ?, ?, ?)")
                    ->execute([$nombreRef, $apellidoRef, $cuil, $siglaDep]);
                $idReferente = $pdo->lastInsertId();
                $stats['referentes']++;
                if (!empty($fila['referente']['email'])) {
                    $pdo->prepare("INSERT INTO datos_contacto (id_referente, correo_electronico, telefono, vigente) VALUES (?, ?, ?, 1)")
                        ->execute([$idReferente, $fila['referente']['email'], $fila['referente']['telefono']]);
                }
            }
        }

        $proyNombre = $fila['proyecto']['nombre'] ?? '';
        if (empty($proyNombre)) continue; 

        $keyProy = $siglaDep . '|' . strtolower(trim($proyNombre));
        if (isset($cacheProyectos[$keyProy])) {
            $idProyecto = $cacheProyectos[$keyProy];
        } else {
            $stmtP = $pdo->prepare("SELECT id_proyecto FROM proyecto WHERE descripcion = ? AND sigla_dependencia = ?");
            $stmtP->execute([$proyNombre, $siglaDep]);
            $idProyecto = $stmtP->fetchColumn();

            if (!$idProyecto) {
                $idPrio = getPrioridadId($pdo, $fila['proyecto']['prioridad'], $cachePrioridad);
                $stmtInsP = $pdo->prepare("INSERT INTO proyecto (descripcion, sigla_dependencia, id_prioridad, id_estado, estado_proyecto) VALUES (?, ?, ?, 1, 1)");
                $stmtInsP->execute([$proyNombre, $siglaDep, $idPrio]);
                $idProyecto = $pdo->lastInsertId();
                $stats['proyectos']++;
                
                if ($idReferente) {
                    $pdo->prepare("INSERT INTO proyecto_referente (id_proyecto, id_referente) VALUES (?, ?)")->execute([$idProyecto, $idReferente]);
                }
            } else {
                if ($idReferente) {
                    $pdo->prepare("INSERT IGNORE INTO proyecto_referente (id_proyecto, id_referente) VALUES (?, ?)")->execute([$idProyecto, $idReferente]);
                }
            }
            $cacheProyectos[$keyProy] = $idProyecto;
        }

        $idOG = null;
        $descOG = $fila['objetivo_general'] ?? '';
        if (!empty($descOG)) {
            $keyOG = $idProyecto . '|' . md5(trim($descOG));
            if (isset($cacheOG[$keyOG])) $idOG = $cacheOG[$keyOG];
            else {
                $stmtOG = $pdo->prepare("SELECT id_og FROM objetivo_general WHERE id_proyecto=? AND descripcion=?");
                $stmtOG->execute([$idProyecto, $descOG]);
                $idOG = $stmtOG->fetchColumn();
                if (!$idOG) {
                    $pdo->prepare("INSERT INTO objetivo_general (id_proyecto, descripcion) VALUES (?, ?)")->execute([$idProyecto, $descOG]);
                    $idOG = $pdo->lastInsertId();
                }
                $cacheOG[$keyOG] = $idOG;
            }
        }
        if (!$idOG) continue;

        $idOE = null;
        $descOE = $fila['objetivo_especifico'] ?? '';
        if (!empty($descOE)) {
            $keyOE = $idOG . '|' . md5(trim($descOE));
            if (isset($cacheOE[$keyOE])) $idOE = $cacheOE[$keyOE];
            else {
                $stmtOE = $pdo->prepare("SELECT id_oe FROM objetivo_especifico WHERE id_og=? AND descripcion=?");
                $stmtOE->execute([$idOG, $descOE]);
                $idOE = $stmtOE->fetchColumn();
                if (!$idOE) {
                    $pdo->prepare("INSERT INTO objetivo_especifico (id_og, descripcion) VALUES (?, ?)")->execute([$idOG, $descOE]);
                    $idOE = $pdo->lastInsertId();
                }
                $cacheOE[$keyOE] = $idOE;
            }
        } else { continue; }

        $idAct = null;
        if (!empty($fila['actividad']['descripcion'])) {
            $descAct = $fila['actividad']['descripcion'];
            $tipoActDesc = $fila['actividad']['tipo'] ?? ''; 
            
            $idTipoAct = getIdSmart($tipoActDesc, $mapaTiposActividad) ?: 5; 

            $keyAct = $idOE . '|' . md5(trim($descAct));
            if (isset($cacheAct[$keyAct])) {
                $idAct = $cacheAct[$keyAct];
            } else {
                $stmtAct = $pdo->prepare("SELECT id_actividad FROM actividad_prioritaria WHERE id_oe=? AND descripcion=?");
                $stmtAct->execute([$idOE, $descAct]);
                $idAct = $stmtAct->fetchColumn();
                
                if (!$idAct) {
                    $pdo->prepare("INSERT INTO actividad_prioritaria (id_oe, descripcion, id_tipo_actividad_prioritaria, id_estado) VALUES (?, ?, ?, 1)")
                        ->execute([$idOE, $descAct, $idTipoAct]);
                    $idAct = $pdo->lastInsertId();
                    $stats['actividades']++;
                }
                $cacheAct[$keyAct] = $idAct;
            }
        } else { continue; }

        if (!empty($fila['indicador']['nombre'])) {
            $ind = $fila['indicador'];
            
            // Usamos el idTipoInd original que el usuario cargó
            $idTipoInd = getIdSmart($ind['tipo'], $mapaTiposIndicador) ?: 1;
            $idOtroSis = getIdSmart($ind['otro_sistema'], $mapaOtroSistema) ?: 1;
            
            // CIRUGÍA DE ARQUITECTURA: Rescatamos el tipo_meta que detectó nuestro Frontend
            $tipoMeta = $ind['tipo_meta'] ?? 'cantidad'; // Por defecto cantidad por si el frontend no lo envía

            $stmtInd = $pdo->prepare("SELECT id_indicador FROM indicador WHERE id_actividad=? AND nombre=?");
            $stmtInd->execute([$idAct, $ind['nombre']]);
            $idInd = $stmtInd->fetchColumn();

            if (!$idInd) {
                // Modificamos el query para inyectar el campo tipo_meta
                $sqlInd = "INSERT INTO indicador (
                                id_actividad, nombre, construccion, fuente, linea_base, 
                                meta_anio1, meta_anio2, id_tipo_indicador, id_otro_sistema,
                                tipo_meta, fecha_creacion
                           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())";
                
                $pdo->prepare($sqlInd)->execute([
                    $idAct, $ind['nombre'], $ind['construccion'], $ind['fuente'], 
                    $ind['linea_base'], $ind['meta_anio1'], $ind['meta_anio2'],
                    $idTipoInd, $idOtroSis, $tipoMeta
                ]);
                $idInd = $pdo->lastInsertId();
                $stats['indicadores']++;
            }

            $trim = [1=>$fila['monitoreo']['t1'], 2=>$fila['monitoreo']['t2'], 3=>$fila['monitoreo']['t3'], 4=>$fila['monitoreo']['t4']];
            foreach ($trim as $p => $v) {
                if ($v === "" || $v === null) continue;
                $stmtM = $pdo->prepare("SELECT id_monitoreo FROM monitoreo WHERE id_indicador=? AND id_periodo_monitoreo=?");
                $stmtM->execute([$idInd, $p]);
                if ($stmtM->fetchColumn()) {
                    $pdo->prepare("UPDATE monitoreo SET meta_propuesta=? WHERE id_indicador=? AND id_periodo_monitoreo=?")->execute([$v, $idInd, $p]);
                } else {
                    $pdo->prepare("INSERT INTO monitoreo (id_indicador, id_periodo_monitoreo, meta_propuesta) VALUES (?,?,?)")->execute([$idInd, $p, $v]);
                }
            }
        }
    }

    $pdo->commit();
    echo json_encode(["success" => true, "procesados" => count($datos), "resumen" => $stats]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    http_response_code(500);
    echo json_encode(["success" => false, "errores" => [$e->getMessage()]]);
}
?>