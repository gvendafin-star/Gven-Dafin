<?php
// api/check_auth.php - ДЛЯ API ЗАПРОСОВ

require_once __DIR__ . '/security.php';

initSecureSession();

header('Content-Type: application/json');

if (isset($_SESSION['authorized']) && $_SESSION['authorized'] === true) {
    echo json_encode([
        'authorized' => true,
        'user' => $_SESSION['user'] ?? 'admin',
        'role' => $_SESSION['role'] ?? 'admin'
    ]);
} else {
    echo json_encode(['authorized' => false]);
}