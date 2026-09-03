<?php
// api/users.php - с поддержкой access_enabled и TIME

require_once __DIR__ . '/security.php';
require_once __DIR__ . '/../includes/db.php';

$method = $_SERVER['REQUEST_METHOD'];

// ========== ТОЛЬКО ДЛЯ ADMIN ==========
function requireAdmin($pdo) {
    initSecureSession();
    if (!isset($_SESSION['authorized']) || $_SESSION['authorized'] !== true) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Не авторизован']);
        exit;
    }
    $userId = $_SESSION['user_id'] ?? null;
    if (!$userId || !hasRole($pdo, $userId, 'admin')) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Доступ запрещён. Только для администраторов']);
        exit;
    }
}

// ========== GET ==========
if ($method === 'GET') {
    requireAdmin($pdo);
    
    $action = $_GET['action'] ?? 'list';
    
    if ($action === 'list') {
        try {
            $stmt = $pdo->query("
                SELECT id, username, full_name, is_active, 
                       access_enabled, access_from_time, access_until_time, created_at 
                FROM users 
                ORDER BY id
            ");
            $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            foreach ($users as &$user) {
                $user['roles'] = getUserRoles($pdo, $user['id']);
            }
            
            echo json_encode(['success' => true, 'users' => $users]);
        } catch(PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        exit;
    }
    
    if ($action === 'get') {
        $id = $_GET['id'] ?? null;
        if (!$id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Не указан ID']);
            exit;
        }
        try {
            $stmt = $pdo->prepare("
                SELECT id, username, full_name, is_active, 
                       access_enabled, access_from_time, access_until_time 
                FROM users 
                WHERE id = ?
            ");
            $stmt->execute([$id]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($user) {
                $user['roles'] = getUserRoles($pdo, $id);
                echo json_encode(['success' => true, 'user' => $user]);
            } else {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Пользователь не найден']);
            }
        } catch(PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        exit;
    }
    
    if ($action === 'roles') {
        try {
            $stmt = $pdo->query("SELECT id, name, label, icon FROM roles ORDER BY id");
            $roles = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'roles' => $roles]);
        } catch(PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        exit;
    }
    
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Неизвестное действие']);
    exit;
}

// ========== POST ==========
if ($method === 'POST') {
    requireAdmin($pdo);
    
    $input = json_decode(file_get_contents('php://input'), true);
    $action = $input['action'] ?? 'create';
    $currentUserId = $_SESSION['user_id'];
    
    // ===== СОЗДАНИЕ =====
    if ($action === 'create') {
        $username = trim($input['username'] ?? '');
        $password = $input['password'] ?? '';
        $full_name = trim($input['full_name'] ?? '');
        $access_enabled = isset($input['access_enabled']) ? (int)$input['access_enabled'] : 0;
        $access_from_time = $input['access_from_time'] ?? null;
        $access_until_time = $input['access_until_time'] ?? null;
        $role_ids = $input['role_ids'] ?? [];
        
        if (!$username) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Введите логин']);
            exit;
        }
        
        if (strlen($password) < 4) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Пароль должен быть не менее 4 символов']);
            exit;
        }
        
        try {
            $pdo->beginTransaction();
            
            $stmt = $pdo->prepare("SELECT id FROM users WHERE username = ?");
            $stmt->execute([$username]);
            if ($stmt->fetch()) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Пользователь с таким логином уже существует']);
                exit;
            }
            
            $password_hash = password_hash($password, PASSWORD_DEFAULT);
            
            $stmt = $pdo->prepare("
                INSERT INTO users (username, password_hash, full_name, is_active, 
                                   access_enabled, access_from_time, access_until_time)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $username, $password_hash, $full_name, 1,
                $access_enabled, $access_from_time, $access_until_time
            ]);
            $userId = $pdo->lastInsertId();
            
            if (!empty($role_ids)) {
                updateUserRoles($pdo, $userId, $role_ids, $currentUserId);
            }
            
            $pdo->commit();
            
            echo json_encode([
                'success' => true,
                'id' => $userId,
                'message' => "Пользователь $username создан"
            ]);
        } catch(PDOException $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        exit;
    }
    
    // ===== ОБНОВЛЕНИЕ =====
    if ($action === 'update') {
        $id = $input['id'] ?? null;
        $full_name = trim($input['full_name'] ?? '');
        $is_active = isset($input['is_active']) ? (int)$input['is_active'] : null;
        $password = $input['password'] ?? '';
        $access_enabled = isset($input['access_enabled']) ? (int)$input['access_enabled'] : null;
        $access_from_time = $input['access_from_time'] ?? null;
        $access_until_time = $input['access_until_time'] ?? null;
        $role_ids = $input['role_ids'] ?? null;
        
        if (!$id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Не указан ID']);
            exit;
        }
        
        try {
            $pdo->beginTransaction();
            
            $updates = [];
            $params = [];
            
            if ($full_name !== '') {
                $updates[] = "full_name = ?";
                $params[] = $full_name;
            }
            
            if ($is_active !== null) {
                $updates[] = "is_active = ?";
                $params[] = $is_active;
            }
            
            if ($access_enabled !== null) {
                $updates[] = "access_enabled = ?";
                $params[] = $access_enabled;
            }
            
            if ($access_from_time !== null) {
                $updates[] = "access_from_time = ?";
                $params[] = $access_from_time;
            }
            
            if ($access_until_time !== null) {
                $updates[] = "access_until_time = ?";
                $params[] = $access_until_time;
            }
            
            if (!empty($password)) {
                if (strlen($password) < 4) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'Пароль должен быть не менее 4 символов']);
                    exit;
                }
                $updates[] = "password_hash = ?";
                $params[] = password_hash($password, PASSWORD_DEFAULT);
            }
            
            if (!empty($updates)) {
                $params[] = $id;
                $sql = "UPDATE users SET " . implode(', ', $updates) . " WHERE id = ?";
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
            }
            
            if ($role_ids !== null) {
                updateUserRoles($pdo, $id, $role_ids, $currentUserId);
            }
            
            $pdo->commit();
            
            echo json_encode(['success' => true, 'message' => 'Пользователь обновлён']);
        } catch(PDOException $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        exit;
    }
    
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Неизвестное действие']);
    exit;
}

// ========== DELETE ==========
if ($method === 'DELETE') {
    requireAdmin($pdo);
    
    $input = json_decode(file_get_contents('php://input'), true);
    $id = $input['id'] ?? null;
    
    if (!$id) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Не указан ID']);
        exit;
    }
    
    initSecureSession();
    $currentUser = $_SESSION['user'] ?? '';
    $stmt = $pdo->prepare("SELECT username FROM users WHERE id = ?");
    $stmt->execute([$id]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($user && $user['username'] === $currentUser) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Нельзя удалить самого себя']);
        exit;
    }
    
    try {
        $pdo->beginTransaction();
        
        $stmt = $pdo->prepare("DELETE FROM user_roles WHERE user_id = ?");
        $stmt->execute([$id]);
        
        $stmt = $pdo->prepare("DELETE FROM users WHERE id = ?");
        $stmt->execute([$id]);
        
        $pdo->commit();
        echo json_encode(['success' => true, 'message' => 'Пользователь удалён']);
    } catch(PDOException $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Метод не поддерживается']);
?>