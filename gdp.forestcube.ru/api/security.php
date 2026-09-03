<?php
// api/security.php - ПОЛНАЯ ВЕРСИЯ С ПОДДЕРЖКОЙ МНОЖЕСТВЕННЫХ РОЛЕЙ

// ========== НАСТРОЙКА СЕССИЙ ==========
ini_set('session.cookie_httponly', 1);
ini_set('session.cookie_samesite', 'Lax');
ini_set('session.use_only_cookies', 1);

if (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') {
    ini_set('session.cookie_secure', 1);
}

function initSecureSession() {
    if (session_status() === PHP_SESSION_NONE) {
        session_set_cookie_params([
            'lifetime' => 86400,
            'path' => '/',
            'domain' => '',
            'secure' => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on',
            'httponly' => true,
            'samesite' => 'Lax'
        ]);
        session_start();
    }
}

// ========== CSRF-ТОКЕНЫ ==========
function generateCSRFToken() {
    initSecureSession();
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function getCSRFToken() {
    initSecureSession();
    return $_SESSION['csrf_token'] ?? null;
}

function validateCSRFToken($token) {
    initSecureSession();
    if (empty($token)) return false;
    if (empty($_SESSION['csrf_token'])) return false;
    return hash_equals($_SESSION['csrf_token'], $token);
}

// ========== РАБОТА С РОЛЯМИ ==========
function getUserRoles($pdo, $userId) {
    $stmt = $pdo->prepare("
        SELECT r.name, r.label, r.icon 
        FROM roles r
        JOIN user_roles ur ON r.id = ur.role_id
        WHERE ur.user_id = ?
    ");
    $stmt->execute([$userId]);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function hasRole($pdo, $userId, $roleName) {
    $stmt = $pdo->prepare("
        SELECT 1 FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = ? AND r.name = ?
    ");
    $stmt->execute([$userId, $roleName]);
    return $stmt->fetchColumn() ? true : false;
}

function hasAnyRole($pdo, $userId, $roleNames) {
    if (empty($roleNames)) return false;
    $placeholders = implode(',', array_fill(0, count($roleNames), '?'));
    $stmt = $pdo->prepare("
        SELECT 1 FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = ? AND r.name IN ($placeholders)
        LIMIT 1
    ");
    $params = array_merge([$userId], $roleNames);
    $stmt->execute($params);
    return $stmt->fetchColumn() ? true : false;
}

function requireRole($pdo, $requiredRole) {
    initSecureSession();
    
    if (!isset($_SESSION['authorized']) || $_SESSION['authorized'] !== true) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Не авторизован']);
        exit;
    }
    
    $userId = $_SESSION['user_id'] ?? null;
    if (!$userId) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Пользователь не найден']);
        exit;
    }
    
    if (!hasRole($pdo, $userId, $requiredRole)) {
        http_response_code(403);
        echo json_encode([
            'success' => false, 
            'error' => 'Недостаточно прав. Требуется роль: ' . $requiredRole
        ]);
        exit;
    }
    
    return true;
}

function requireAnyRole($pdo, $roleNames) {
    initSecureSession();
    
    if (!isset($_SESSION['authorized']) || $_SESSION['authorized'] !== true) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Не авторизован']);
        exit;
    }
    
    $userId = $_SESSION['user_id'] ?? null;
    if (!$userId) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Пользователь не найден']);
        exit;
    }
    
    if (!hasAnyRole($pdo, $userId, $roleNames)) {
        http_response_code(403);
        echo json_encode([
            'success' => false, 
            'error' => 'Недостаточно прав. Требуется одна из ролей: ' . implode(', ', $roleNames)
        ]);
        exit;
    }
    
    return true;
}

// ========== ОБНОВЛЕНИЕ РОЛЕЙ ПОЛЬЗОВАТЕЛЯ ==========
function updateUserRoles($pdo, $userId, $roleIds, $assignedBy) {
    // Удаляем старые роли
    $stmt = $pdo->prepare("DELETE FROM user_roles WHERE user_id = ?");
    $stmt->execute([$userId]);
    
    // Добавляем новые
    if (!empty($roleIds)) {
        $stmt = $pdo->prepare("INSERT INTO user_roles (user_id, role_id, assigned_by) VALUES (?, ?, ?)");
        foreach ($roleIds as $roleId) {
            $stmt->execute([$userId, $roleId, $assignedBy]);
        }
    }
}

// ========== ПРОВЕРКА АВТОРИЗАЦИИ ==========
function requireAuth() {
    initSecureSession();
    if (!isset($_SESSION['authorized']) || $_SESSION['authorized'] !== true) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Не авторизован']);
        exit;
    }
    return true;
}

function requireAuthWithCSRF() {
    initSecureSession();
    
    if (!isset($_SESSION['authorized']) || $_SESSION['authorized'] !== true) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Не авторизован']);
        exit;
    }
    
    $method = $_SERVER['REQUEST_METHOD'];
    if (in_array($method, ['POST', 'PUT', 'DELETE', 'PATCH'])) {
        $headers = getallheaders();
        $token = $headers['X-CSRF-Token'] ?? null;
        
        if (!$token) {
            $input = json_decode(file_get_contents('php://input'), true);
            $token = $input['csrf_token'] ?? null;
        }
        
        if (!validateCSRFToken($token)) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Недействительный CSRF-токен']);
            exit;
        }
    }
    
    return true;
}

function isAuthorized() {
    initSecureSession();
    return isset($_SESSION['authorized']) && $_SESSION['authorized'] === true;
}

// ========== ПОЛУЧИТЬ ТЕКУЩИЕ ДАННЫЕ ПОЛЬЗОВАТЕЛЯ ==========
function getCurrentUserId() {
    initSecureSession();
    return $_SESSION['user_id'] ?? null;
}

function getCurrentUser() {
    initSecureSession();
    return $_SESSION['user'] ?? null;
}

function getCurrentUserFull($pdo) {
    initSecureSession();
    $userId = $_SESSION['user_id'] ?? null;
    return [
        'authorized' => isAuthorized(),
        'user' => $_SESSION['user'] ?? null,
        'user_id' => $userId,
        'roles' => $userId ? getUserRoles($pdo, $userId) : []
    ];
}

// ========== API ЭНДПОИНТЫ ==========
if (basename($_SERVER['PHP_SELF']) == 'security.php') {
    require_once __DIR__ . '/../includes/db.php';
    header('Content-Type: application/json');
    $action = $_GET['action'] ?? '';
    
    if ($action === 'token') {
        $token = generateCSRFToken();
        echo json_encode(['success' => true, 'csrf_token' => $token]);
        exit;
    }
    
    if ($action === 'me') {
        echo json_encode(getCurrentUserFull($pdo));
        exit;
    }
    
    if ($action === 'check' && isset($_GET['role'])) {
        $userId = getCurrentUserId();
        echo json_encode([
            'has_role' => $userId ? hasRole($pdo, $userId, $_GET['role']) : false,
            'required' => $_GET['role'],
            'authorized' => isAuthorized()
        ]);
        exit;
    }
    
    echo json_encode(['authorized' => isAuthorized()]);
    exit;
}