<?php
// api-backend/auth_utils.php

/**
 * Retorna un array con las siglas de dependencias permitidas o NULL si tiene acceso global.
 */
function getDependenciasPermitidas($pdo, $id_usuario, $rol_modulo) {
    // Normalizamos el rol: quitamos espacios y pasamos a minúsculas
    $rol = strtolower(trim($rol_modulo));

    // =========================================================================
    // ROLES GLOBALES (Acceso total a la Secretaría)
    // =========================================================================
    // Solo 'admin' y 'consultafull' mantienen el acceso irrestricto.
    // Quitamos 'autorizante' y 'cargafull' de aquí para que respeten su área.
    if (in_array($rol, ['admin', 'consultafull'])) {
        return null; 
    }

    // =========================================================================
    // ROLES RESTRINGIDOS (carga, cargafull, consulta, autorizante)
    // =========================================================================
    
    // 1. Buscamos si tiene dependencias extra asignadas en la tabla RLS
    $stmt = $pdo->prepare("SELECT sigla_dependencia FROM usuario_dependencia WHERE id_usuario = ?");
    $stmt->execute([$id_usuario]);
    $siglas = $stmt->fetchAll(PDO::FETCH_COLUMN);

    // 2. Si no tiene nada en la tabla RLS, le damos por defecto su sigla base de la tabla usuario
    if (empty($siglas)) {
        $stmtU = $pdo->prepare("SELECT sigla FROM usuario WHERE id_usuario = ?");
        $stmtU->execute([$id_usuario]);
        $siglaBase = $stmtU->fetchColumn();
        
        if ($siglaBase) {
            return [trim($siglaBase)];
        }
        return []; // Si no tiene sigla ni RLS, no ve nada (seguridad total)
    }

    return $siglas;
}

/**
 * Genera el fragmento SQL "AND campo IN (...)" para filtrar grillas.
 */
function getSQLFilter($pdo, $id_usuario, $rol_modulo, $campo_tabla = 'sigla_dependencia') {
    $permitidas = getDependenciasPermitidas($pdo, $id_usuario, $rol_modulo);
    
    // Si es NULL, es un administrador, no filtramos nada
    if ($permitidas === null) {
        return ""; 
    }

    // Si el array está vacío, forzamos una condición falsa para que no vea datos ajenos
    if (empty($permitidas)) {
        return [
            "sql" => " AND 1=0 ",
            "params" => []
        ];
    }

    $inQuery = implode(',', array_fill(0, count($permitidas), '?'));
    return [
        "sql" => " AND $campo_tabla IN ($inQuery) ",
        "params" => $permitidas
    ];
}