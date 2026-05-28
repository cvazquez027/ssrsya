<?php
// api-backend/abm_maestras.php
ini_set('display_errors', 0);
error_reporting(E_ALL);
require __DIR__ . '/cors.php';
require __DIR__ . '/db.php';

if (session_status() === PHP_SESSION_NONE) session_start();
if (!isset($_SESSION['usuario_id'])) {
    http_response_code(401); echo json_encode(["error" => "No autorizado"]); exit;
}

$rol = $_SESSION['rol'];
$siglaUsuario = $_SESSION['sigla'];

if ($rol === 'autorizante') {
    http_response_code(403); echo json_encode(["error" => "No tiene permisos de edición"]); exit;
}

header("Content-Type: application/json");
$method = $_SERVER['REQUEST_METHOD'];
$pdo = getDB();

try {
    $input = json_decode(file_get_contents('php://input'), true);
    $tabla = $input['tabla'] ?? '';

    if ($rol === 'carga') {
        if (!in_array($tabla, ['referente', 'datos_contacto'])) {
            throw new Exception("No tiene permisos para editar esta tabla.");
        }
    }

    if ($method === 'DELETE') {
        $id = $input['id'];
        $pk = $input['pk_field']; 
        
        if (empty($id) || empty($pk)) throw new Exception("Datos incompletos");

        // Reglas específicas de borrado y permisos
        if ($rol === 'carga' && $tabla === 'referente') {
            $stmtCheck = $pdo->prepare("SELECT sigla FROM referente WHERE id_referente = ?");
            $stmtCheck->execute([$id]);
            if ($stmtCheck->fetchColumn() !== $siglaUsuario) throw new Exception("No puede borrar referentes de otra dependencia");
        }
        
        if ($rol === 'carga' && $tabla === 'datos_contacto') {
             $stmtCheck = $pdo->prepare("SELECT r.sigla FROM datos_contacto dc JOIN referente r ON dc.id_referente = r.id_referente WHERE dc.id_datos_contacto = ?");
             $stmtCheck->execute([$id]);
             if ($stmtCheck->fetchColumn() !== $siglaUsuario) throw new Exception("No puede borrar contactos ajenos");
        }

        // MODIFICACIÓN QUIRÚRGICA: Impedir borrado de categoría si tiene indicadores
        if ($tabla === 'categoria') {
            $stmtCat = $pdo->prepare("SELECT COUNT(*) FROM indicador_categoria WHERE id_categoria = ?");
            $stmtCat->execute([$id]);
            if ($stmtCat->fetchColumn() > 0) {
                throw new Exception("No se puede eliminar la categoría porque tiene indicadores asociados.");
            }
        }

        // LÓGICA DE BORRADO TRANSACCIONAL PARA REFERENTE (Cascada Segura)
        if ($tabla === 'referente') {
            try {
                // 1. Iniciamos la transacción
                $pdo->beginTransaction();

                // 2. Eliminamos primero los datos de contacto (registro hijo)
                $sqlContactos = "DELETE FROM datos_contacto WHERE id_referente = ?";
                $pdo->prepare($sqlContactos)->execute([$id]);

                // 3. Intentamos eliminar el referente (registro padre)
                $sqlReferente = "DELETE FROM referente WHERE id_referente = ?";
                $pdo->prepare($sqlReferente)->execute([$id]);

                // 4. Si todo salió bien, guardamos definitivamente
                $pdo->commit();

            } catch (PDOException $e) {
                // Si MySQL salta por llave foránea en otra tabla (ej: organizaciones), revertimos el borrado del contacto
                $pdo->rollBack();
                
                if ($e->getCode() == '23000') { // 23000 = Violación de Integridad Referencial
                    throw new Exception("No se puede eliminar el referente porque ya se encuentra vinculado a una entidad del sistema.");
                }
                
                throw new Exception("Error interno al intentar eliminar el referente.");
            }

        } else {
            // LÓGICA GENÉRICA PARA EL RESTO DE LAS TABLAS
            try {
                $sql = "DELETE FROM $tabla WHERE $pk = ?";
                $pdo->prepare($sql)->execute([$id]);
            } catch (PDOException $e) {
                if ($e->getCode() == '23000') {
                    throw new Exception("No se puede eliminar este registro porque está siendo utilizado en otra parte del sistema.");
                }
                throw new Exception("Error de base de datos al intentar eliminar.");
            }
        }

        echo json_encode(["success" => true, "mensaje" => "Registro eliminado correctamente"]);
        exit;
    }

    // ALTA Y MODIFICACIÓN
    switch ($tabla) {
        case 'estado': case 'prioridad': case 'periodo_monitoreo': case 'otro_sistema': case 'tipo_actividad_prioritaria':
            $pkField = "id_$tabla";
            $id = $input[$pkField] ?? 0;
            $desc = $input['descripcion'];
            if ($id == 0) {
                $pdo->prepare("INSERT INTO $tabla (descripcion) VALUES (?)")->execute([$desc]);
            } else {
                $pdo->prepare("UPDATE $tabla SET descripcion = ? WHERE $pkField = ?")->execute([$desc, $id]);
            }
            break;

        case 'modulo':
            $id = $input['id_modulo'] ?? 0;
            $descripcion = $input['descripcion'];
            $clave = strtoupper($input['clave']); 
            $vigente = $input['vigente'] ?? 1;

            if ($id == 0) {
                $pdo->prepare("INSERT INTO modulo (descripcion, clave, vigente) VALUES (?, ?, ?)")
                    ->execute([$descripcion, $clave, $vigente]);
            } else {
                $pdo->prepare("UPDATE modulo SET descripcion = ?, clave = ?, vigente = ? WHERE id_modulo = ?")
                    ->execute([$descripcion, $clave, $vigente, $id]);
            }
            break;

        case 'tipo_indicador': 
            $id = $input['id_tipo_indicador'] ?? 0;
            $nombre = $input['nombre'];
            $descripcion = $input['descripcion'];
            if ($id == 0) {
                $pdo->prepare("INSERT INTO tipo_indicador (nombre, descripcion) VALUES (?, ?)")
                    ->execute([$nombre, $descripcion]);
            } else {
                $pdo->prepare("UPDATE tipo_indicador SET nombre = ?, descripcion = ? WHERE id_tipo_indicador = ?")
                    ->execute([$nombre, $descripcion, $id]);
            }
            break;

        // MODIFICACIÓN QUIRÚRGICA: Lógica de ABM para categorías
        case 'categoria': 
            $id = $input['id_categoria'] ?? 0;
            $nombre = $input['nombre'];
            $detalle = $input['detalle'] ?? '';
            $vigente = isset($input['vigente']) ? $input['vigente'] : 1;
            
            if ($id == 0) {
                $pdo->prepare("INSERT INTO categoria (nombre, detalle, vigente) VALUES (?, ?, ?)")
                    ->execute([$nombre, $detalle, $vigente]);
            } else {
                $pdo->prepare("UPDATE categoria SET nombre = ?, detalle = ?, vigente = ? WHERE id_categoria = ?")
                    ->execute([$nombre, $detalle, $vigente, $id]);
            }
            break;

        case 'dependencia':
            $sigla = $input['sigla']; 
            $esAlta = $input['es_alta'] ?? false; 
            if ($esAlta) {
                $chk = $pdo->prepare("SELECT count(*) FROM dependencia WHERE sigla = ?");
                $chk->execute([$sigla]);
                if ($chk->fetchColumn() > 0) throw new Exception("La sigla ya existe");
                $pdo->prepare("INSERT INTO dependencia (sigla, descripcion, sigla_superior, id_referente, vigente) VALUES (?, ?, ?, ?, ?)")
                    ->execute([$sigla, $input['descripcion'], $input['sigla_superior'] ?: null, $input['id_referente'] ?: null, $input['vigente']]);
            } else {
                $pdo->prepare("UPDATE dependencia SET descripcion=?, sigla_superior=?, id_referente=?, vigente=? WHERE sigla=?")
                    ->execute([$input['descripcion'], $input['sigla_superior'] ?: null, $input['id_referente'] ?: null, $input['vigente'], $sigla]);
            }
            break;

        case 'referente':
            $id = $input['id_referente'] ?? 0;
            $siglaGuardar = $input['sigla'];
            if ($rol === 'carga') {
                $siglaGuardar = $siglaUsuario; 
                if ($id != 0) {
                    $stmtCheck = $pdo->prepare("SELECT sigla FROM referente WHERE id_referente = ?");
                    $stmtCheck->execute([$id]);
                    if ($stmtCheck->fetchColumn() !== $siglaUsuario) throw new Exception("No es su referente");
                }
            }
            if ($id == 0) {
                $sql = "INSERT INTO referente (nombre, apellido, cuil, sigla) VALUES (?, ?, ?, ?)";
                $pdo->prepare($sql)->execute([$input['nombre'], $input['apellido'], $input['cuil'], $siglaGuardar]);
            } else {
                $sql = "UPDATE referente SET nombre=?, apellido=?, cuil=?, sigla=? WHERE id_referente=?";
                $pdo->prepare($sql)->execute([$input['nombre'], $input['apellido'], $input['cuil'], $siglaGuardar, $id]);
            }
            break;

        case 'datos_contacto':
            $id = $input['id_datos_contacto'] ?? 0;
            $idRef = $input['id_referente'];
            $stmtCheck = $pdo->prepare("SELECT sigla FROM referente WHERE id_referente = ?");
            $stmtCheck->execute([$idRef]);
            $dueno = $stmtCheck->fetchColumn();
            if ($rol === 'carga' && $dueno !== $siglaUsuario) {
                throw new Exception("No puede editar contactos de otra dependencia");
            }
            if ($id == 0) {
                $sql = "INSERT INTO datos_contacto (id_referente, telefono, correo_electronico, direccion, vigente) VALUES (?, ?, ?, ?, 1)";
                $pdo->prepare($sql)->execute([$idRef, $input['telefono'], $input['correo_electronico'], $input['direccion']]);
            } else {
                $sql = "UPDATE datos_contacto SET telefono=?, correo_electronico=?, direccion=?, vigente=? WHERE id_datos_contacto=?";
                $pdo->prepare($sql)->execute([$input['telefono'], $input['correo_electronico'], $input['direccion'], $input['vigente'], $id]);
            }
            break;

        default:
            throw new Exception("Tabla no soportada");
    }

    echo json_encode(["success" => true, "mensaje" => "Guardado correctamente"]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(["error" => $e->getMessage()]);
}
?>