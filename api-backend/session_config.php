<?php
// api-backend/session_config.php

if (session_status() === PHP_SESSION_NONE) {
    // Configuración idéntica a la que usaste en Login
    session_set_cookie_params([
        'lifetime' => 86400,
        'path' => '/',
        'domain' => '', 
        'secure' => false, // false para localhost http
        'httponly' => true,
        'samesite' => 'Lax'
    ]);
    session_start();
}
?>