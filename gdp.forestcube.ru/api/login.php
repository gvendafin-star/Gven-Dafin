<?php
// api/login.php - с множественными ролями

require_once __DIR__ . '/security.php';
require_once __DIR__ . '/../includes/db.php';

$input = json_decode(file_get_contents('php://input'), true);
$username = trim($input['username'] ?? '');
$password = $input['password'] ?? '';

if (!$username) {
    $username = 'admin';
}

// Ищем пользователя
$stmt = $pdo->prepare("SELECT id, username, password_hash, is_active FROM users WHERE username = ?");
$stmt->execute([$username]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$user) {
    echo json_encode(['success' => false, 'error' => 'Пользователь не найден']);
    exit;
}

if (!password_verify($password, $user['password_hash'])) {
    echo json_encode(['success' => false, 'error' => 'Неверный пароль']);
    exit;
}

if ($user['is_active'] != 1) {
    echo json_encode(['success' => false, 'error' => 'Аккаунт заблокирован']);
    exit;
}

// Получаем роли пользователя
$roles = getUserRoles($pdo, $user['id']);
$roleNames = array_column($roles, 'name');

// Авторизуем
initSecureSession();
session_regenerate_id(true);

$_SESSION['authorized'] = true;
$_SESSION['user'] = $user['username'];
$_SESSION['user_id'] = $user['id'];
$_SESSION['roles'] = $roleNames;
$_SESSION['login_time'] = time();
$_SESSION['csrf_token'] = bin2hex(random_bytes(32));

echo json_encode([
    'success' => true,
    'csrf_token' => $_SESSION['csrf_token'],
    'roles' => $roleNames
]);
?>