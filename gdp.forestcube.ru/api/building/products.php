<?php
// api/building/products.php - Управление номенклатурой стройматериалов

require_once __DIR__ . '/../security.php';
require_once __DIR__ . '/../../includes/db.php';

$method = $_SERVER['REQUEST_METHOD'];

// ========== ПРОВЕРКА АВТОРИЗАЦИИ И РОЛИ ==========
function requireAdminBuilding() {
    global $pdo;
    
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
    
    if (!hasRole($pdo, $userId, 'admin')) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Доступ запрещён. Только для администраторов']);
        exit;
    }
}

// ========== GET (ДЛЯ ВСЕХ АВТОРИЗОВАННЫХ) ==========
if ($method === 'GET') {
    requireAuthOnly();
    
    $action = $_GET['action'] ?? 'list';
    $id = $_GET['id'] ?? null;
    
    if ($action === 'list' || $action === 'all') {
        try {
            $sql = "SELECT id, name, `group`, unit, price, weight_kg, is_active FROM building_products ORDER BY id";
            $stmt = $pdo->query($sql);
            $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            foreach ($products as &$p) {
                $stmt2 = $pdo->prepare("SELECT stock_available FROM building_stocks WHERE product_id = ?");
                $stmt2->execute([$p['id']]);
                $stock = $stmt2->fetch(PDO::FETCH_ASSOC);
                $p['stock'] = $stock ? (int)$stock['stock_available'] : 0;
            }
            
            echo json_encode(['success' => true, 'products' => $products]);
        } catch(PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        exit;
    }
    
    if ($action === 'get' && $id) {
        try {
            $stmt = $pdo->prepare("SELECT id, name, `group`, unit, price, weight_kg, is_active FROM building_products WHERE id = ?");
            $stmt->execute([$id]);
            $product = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$product) {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Товар не найден']);
                exit;
            }
            
            $stmt2 = $pdo->prepare("SELECT stock_available FROM building_stocks WHERE product_id = ?");
            $stmt2->execute([$id]);
            $stock = $stmt2->fetch(PDO::FETCH_ASSOC);
            $product['stock'] = $stock ? (int)$stock['stock_available'] : 0;
            
            echo json_encode(['success' => true, 'product' => $product]);
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

// ========== POST (ТОЛЬКО АДМИН) ==========
if ($method === 'POST') {
    requireAdminBuilding();
    
    $input = json_decode(file_get_contents('php://input'), true);
    $action = $input['action'] ?? 'create';
    
    if ($action === 'create') {
        $name = trim($input['name'] ?? '');
        $group = trim($input['group'] ?? 'стройматериалы');
        $unit = trim($input['unit'] ?? 'шт');
        $price = floatval($input['price'] ?? 0);
        $weight_kg = floatval($input['weight_kg'] ?? 0);
        $is_active = isset($input['is_active']) ? (int)$input['is_active'] : 1;
        
        if (!$name) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Введите название товара']);
            exit;
        }
        
        try {
            $pdo->beginTransaction();
            
            $stmt = $pdo->prepare("
                INSERT INTO building_products (name, `group`, unit, price, weight_kg, is_active)
                VALUES (?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([$name, $group, $unit, $price, $weight_kg, $is_active]);
            $productId = $pdo->lastInsertId();
            
            $stmt2 = $pdo->prepare("INSERT INTO building_stocks (product_id, stock_available) VALUES (?, 0)");
            $stmt2->execute([$productId]);
            
            $pdo->commit();
            
            echo json_encode([
                'success' => true,
                'id' => $productId,
                'message' => "Товар '$name' создан"
            ]);
        } catch(PDOException $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        exit;
    }
    
    if ($action === 'update') {
        $id = $input['id'] ?? null;
        $name = trim($input['name'] ?? '');
        $group = trim($input['group'] ?? 'стройматериалы');
        $unit = trim($input['unit'] ?? 'шт');
        $price = floatval($input['price'] ?? 0);
        $weight_kg = floatval($input['weight_kg'] ?? 0);
        $is_active = isset($input['is_active']) ? (int)$input['is_active'] : 1;
        $stock = isset($input['stock']) ? (int)$input['stock'] : null;
        
        if (!$id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Не указан ID']);
            exit;
        }
        
        try {
            $pdo->beginTransaction();
            
            $stmt = $pdo->prepare("
                UPDATE building_products 
                SET name = ?, `group` = ?, unit = ?, price = ?, weight_kg = ?, is_active = ?
                WHERE id = ?
            ");
            $stmt->execute([$name, $group, $unit, $price, $weight_kg, $is_active, $id]);
            
            if ($stock !== null) {
                $stmt2 = $pdo->prepare("UPDATE building_stocks SET stock_available = ? WHERE product_id = ?");
                $stmt2->execute([$stock, $id]);
            }
            
            $pdo->commit();
            
            echo json_encode(['success' => true, 'message' => 'Товар обновлён']);
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

// ========== DELETE (ТОЛЬКО АДМИН) ==========
if ($method === 'DELETE') {
    requireAdminBuilding();
    
    $input = json_decode(file_get_contents('php://input'), true);
    $id = $input['id'] ?? null;
    
    if (!$id) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Не указан ID']);
        exit;
    }
    
    try {
        $pdo->beginTransaction();
        
        $stmt = $pdo->prepare("DELETE FROM building_stocks WHERE product_id = ?");
        $stmt->execute([$id]);
        
        $stmt = $pdo->prepare("DELETE FROM building_products WHERE id = ?");
        $stmt->execute([$id]);
        
        $pdo->commit();
        
        echo json_encode(['success' => true, 'message' => 'Товар удалён']);
    } catch(PDOException $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Метод не поддерживается']);


// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
function requireAuthOnly() {
    initSecureSession();
    if (!isset($_SESSION['authorized']) || $_SESSION['authorized'] !== true) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Не авторизован']);
        exit;
    }
}
?>