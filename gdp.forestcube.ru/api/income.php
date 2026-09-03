<?php
// api/income.php - с поддержкой таблицы income

require_once __DIR__ . '/security.php';
require_once __DIR__ . '/../includes/db.php';

$method = $_SERVER['REQUEST_METHOD'];

// ========== GET - получение приходов ==========
if ($method === 'GET') {
    requireAuth();
    
    $action = $_GET['action'] ?? '';
    $id = $_GET['id'] ?? null;
    
    if ($action === 'get' && $id) {
        try {
            $stmt = $pdo->prepare("SELECT * FROM income WHERE id = ?");
            $stmt->execute([$id]);
            $income = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$income) {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Приход не найден']);
                exit;
            }
            
            $stmt = $pdo->prepare("SELECT * FROM income_items WHERE income_id = ? ORDER BY id");
            $stmt->execute([$id]);
            $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            $income['items'] = $items;
            
            echo json_encode(['success' => true, 'income' => $income]);
        } catch(PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        exit;
    }
    
    if ($action === 'list' || !$action) {
        try {
            $limit = $_GET['limit'] ?? 50;
            $offset = $_GET['offset'] ?? 0;
            
            $stmt = $pdo->prepare("
                SELECT id, supplier, income_date, total_volume, total_quantity, total_items, note, user, created_at, updated_at
                FROM income 
                ORDER BY income_date DESC, created_at DESC 
                LIMIT ? OFFSET ?
            ");
            $stmt->execute([$limit, $offset]);
            $income = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            echo json_encode(['success' => true, 'income' => $income]);
        } catch(PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        exit;
    }
    
    if ($action === 'suppliers') {
        try {
            $stmt = $pdo->query("
                SELECT DISTINCT supplier 
                FROM income 
                ORDER BY supplier
            ");
            $suppliers = $stmt->fetchAll(PDO::FETCH_COLUMN);
            echo json_encode(['success' => true, 'suppliers' => $suppliers]);
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

// ========== POST - создание/обновление прихода ==========
if ($method === 'POST') {
    requireAuthWithCSRF();
    
    $input = json_decode(file_get_contents('php://input'), true);
    $action = $input['action'] ?? 'create';
    
    if ($action === 'update') {
        $id = $input['id'] ?? null;
        $supplier = trim($input['supplier'] ?? '');
        $income_date = $input['income_date'] ?? date('Y-m-d');
        $note = trim($input['note'] ?? '');
        $items = $input['items'] ?? [];
        
        if (!$id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Не указан ID прихода']);
            exit;
        }
        
        if (!$supplier) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Укажите поставщика']);
            exit;
        }
        
        if (empty($items)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Добавьте хотя бы одну позицию']);
            exit;
        }
        
        try {
            $pdo->beginTransaction();
            
            $stmt = $pdo->prepare("SELECT * FROM income WHERE id = ? FOR UPDATE");
            $stmt->execute([$id]);
            $existing = $stmt->fetch();
            
            if (!$existing) {
                $pdo->rollBack();
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Приход не найден']);
                exit;
            }
            
            $total_volume = 0;
            $total_quantity = 0;
            $total_items = count($items);
            
            foreach ($items as $item) {
                $total_quantity += $item['quantity'];
                $total_volume += $item['volume'];
            }
            $total_volume = round($total_volume, 3);
            
            $stmt = $pdo->prepare("
                UPDATE income SET 
                    supplier = ?,
                    income_date = ?,
                    total_volume = ?,
                    total_quantity = ?,
                    total_items = ?,
                    note = ?
                WHERE id = ?
            ");
            $stmt->execute([$supplier, $income_date, $total_volume, $total_quantity, $total_items, $note, $id]);
            
            $stmt = $pdo->prepare("DELETE FROM income_items WHERE income_id = ?");
            $stmt->execute([$id]);
            
            $stmt = $pdo->prepare("
                INSERT INTO income_items (income_id, product_id, product_name, quantity, volume)
                VALUES (?, ?, ?, ?, ?)
            ");
            
            foreach ($items as $item) {
                $stmt->execute([
                    $id,
                    $item['product_id'],
                    $item['product_name'],
                    $item['quantity'],
                    $item['volume']
                ]);
            }
            
            $pdo->commit();
            
            echo json_encode([
                'success' => true,
                'id' => $id,
                'message' => 'Приход обновлён',
                'total_volume' => $total_volume,
                'total_quantity' => $total_quantity,
                'total_items' => $total_items
            ]);
            
        } catch(PDOException $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        exit;
    }
    
    // ===== СОЗДАНИЕ НОВОГО ПРИХОДА =====
    $supplier = trim($input['supplier'] ?? '');
    $income_date = $input['income_date'] ?? date('Y-m-d');
    $note = trim($input['note'] ?? '');
    $items = $input['items'] ?? [];
    
    if (!$supplier) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Укажите поставщика']);
        exit;
    }
    
    if (empty($items)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Добавьте хотя бы одну позицию']);
        exit;
    }
    
    try {
        $pdo->beginTransaction();
        
        $total_volume = 0;
        $total_quantity = 0;
        $total_items = count($items);
        
        foreach ($items as $item) {
            $total_quantity += $item['quantity'];
            $total_volume += $item['volume'];
        }
        $total_volume = round($total_volume, 3);
        
        $stmt = $pdo->prepare("
            INSERT INTO income (supplier, income_date, total_volume, total_quantity, total_items, note, user)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$supplier, $income_date, $total_volume, $total_quantity, $total_items, $note, $_SESSION['user'] ?? 'admin']);
        $income_id = $pdo->lastInsertId();
        
        $stmt = $pdo->prepare("
            INSERT INTO income_items (income_id, product_id, product_name, quantity, volume)
            VALUES (?, ?, ?, ?, ?)
        ");
        
        foreach ($items as $item) {
            $stmt->execute([
                $income_id,
                $item['product_id'],
                $item['product_name'],
                $item['quantity'],
                $item['volume']
            ]);
        }
        
        // Обновляем остатки
        $stmt = $pdo->prepare("SELECT stock_available FROM stocks WHERE product_id = ? FOR UPDATE");
        $stmtUpdate = $pdo->prepare("UPDATE stocks SET stock_available = ? WHERE product_id = ?");
        $stmtInsert = $pdo->prepare("INSERT INTO stocks (product_id, product_name, stock_available) VALUES (?, ?, ?)");
        
        foreach ($items as $item) {
            $stmt->execute([$item['product_id']]);
            $stock = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($stock) {
                $new_stock = $stock['stock_available'] + $item['quantity'];
                $stmtUpdate->execute([$new_stock, $item['product_id']]);
            } else {
                $stmtInsert->execute([$item['product_id'], $item['product_name'], $item['quantity']]);
            }
        }
        
        $pdo->commit();
        
        echo json_encode([
            'success' => true,
            'id' => $income_id,
            'message' => "Приход от $supplier сохранён",
            'total_volume' => $total_volume,
            'total_quantity' => $total_quantity,
            'total_items' => $total_items
        ]);
        
    } catch(PDOException $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    exit;
}

// ========== DELETE - удаление прихода ==========
if ($method === 'DELETE') {
    requireAuthWithCSRF();
    
    $input = json_decode(file_get_contents('php://input'), true);
    $id = $input['id'] ?? null;
    
    if (!$id) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Не указан ID прихода']);
        exit;
    }
    
    try {
        $pdo->beginTransaction();
        
        $stmt = $pdo->prepare("SELECT * FROM income WHERE id = ? FOR UPDATE");
        $stmt->execute([$id]);
        $income = $stmt->fetch();
        
        if (!$income) {
            $pdo->rollBack();
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Приход не найден']);
            exit;
        }
        
        $stmt = $pdo->prepare("SELECT * FROM income_items WHERE income_id = ?");
        $stmt->execute([$id]);
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $stmtUpdate = $pdo->prepare("UPDATE stocks SET stock_available = ? WHERE product_id = ?");
        
        foreach ($items as $item) {
            $stmt = $pdo->prepare("SELECT stock_available FROM stocks WHERE product_id = ? FOR UPDATE");
            $stmt->execute([$item['product_id']]);
            $stock = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($stock) {
                $new_stock = $stock['stock_available'] - $item['quantity'];
                $stmtUpdate->execute([$new_stock, $item['product_id']]);
            }
        }
        
        $stmt = $pdo->prepare("DELETE FROM income_items WHERE income_id = ?");
        $stmt->execute([$id]);
        
        $stmt = $pdo->prepare("DELETE FROM income WHERE id = ?");
        $stmt->execute([$id]);
        
        $pdo->commit();
        
        echo json_encode([
            'success' => true,
            'message' => 'Приход удалён, остатки возвращены'
        ]);
        
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