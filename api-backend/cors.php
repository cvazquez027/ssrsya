<?php
// api-backend/cors.php

// 1. Capturamos el dominio que está haciendo la petición
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

// 2. Lista blanca de dominios permitidos (Tu localhost y tu dominio en producción)
$allowed_domains = [
    'http://localhost:5173',
    'http://localhost',
    'https://ssrsya.my-board.org'
];

// 3. Si el origen está en nuestra lista blanca, le damos acceso personalizado
if (in_array($origin, $allowed_domains)) {
    header("Access-Control-Allow-Origin: $origin");
    header("Access-Control-Allow-Credentials: true");
} else {
    // Fallback por si acaso (aunque no mande credenciales)
    header("Access-Control-Allow-Origin: https://ssrsya.my-board.org");
    header("Access-Control-Allow-Credentials: true");
}

// 4. Cabeceras estándar de seguridad y métodos
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

// 5. Interceptar peticiones preflight (OPTIONS) del navegador y responder OK al instante
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit(0);
}
?>