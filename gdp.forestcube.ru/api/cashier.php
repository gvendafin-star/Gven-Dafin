<?php
// api/cashier.php - с поддержкой истории по датам

require_once __DIR__ . '/security.php';
requireAuthWithCSRF();
require_once __DIR__ . '/../includes/db.php';

$method = $_SERVER['REQUEST_METHOD'];

// ============================================================
// GET — получение данных текущей сессии
// ============================================================
if ($method === 'GET') {
    $action = $_GET['action'] ?? 'session';
    
    if ($action === 'session') {
        try {
            // Ищем активную (незакрытую) сессию
            $stmt = $pdo->prepare("
                SELECT * FROM cashier_sessions 
                WHERE user = ? AND closed = 0 
                ORDER BY id DESC LIMIT 1
            ");
            $stmt->execute([$_SESSION['user'] ?? 'admin']);
            $session = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$session) {
                // Если нет активной сессии — создаём
                $stmt = $pdo->prepare("
                    INSERT INTO cashier_sessions (user, start_balance) 
                    VALUES (?, 0)
                ");
                $stmt->execute([$_SESSION['user'] ?? 'admin']);
                $sessionId = $pdo->lastInsertId();
                
                $session = [
                    'id' => $sessionId,
                    'start_balance' => 0,
                    'actual_cash' => 0,
                    'expected_cash' => 0,
                    'difference' => 0,
                    'payments' => []
                ];
            } else {
                // Загружаем платежи этой сессии
                $stmt = $pdo->prepare("
                    SELECT tn_number, amount, type, comment, created_at 
                    FROM cashier_payments 
                    WHERE session_id = ? 
                    ORDER BY created_at DESC
                ");
                $stmt->execute([$session['id']]);
                $payments = $stmt->fetchAll(PDO::FETCH_ASSOC);
                $session['payments'] = $payments;
            }
            
            echo json_encode(['success' => true, 'session' => $session]);
            
        } catch(PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        exit;
    }
    
    // ⭐ ИСТОРИЯ ПО ПЕРИОДАМ
    if ($action === 'history') {
        $from = $_GET['from'] ?? '';
        $to = $_GET['to'] ?? '';
        
        if (!$from || !$to) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Укажите даты "от" и "до"']);
            exit;
        }
        
        try {
            $stmt = $pdo->prepare("
                SELECT p.tn_number, p.amount, p.type, p.comment, p.created_at, s.user 
                FROM cashier_payments p
                JOIN cashier_sessions s ON p.session_id = s.id
                WHERE DATE(p.created_at) BETWEEN ? AND ?
                ORDER BY p.created_at DESC
            ");
            $stmt->execute([$from, $to]);
            $history = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            echo json_encode(['success' => true, 'history' => $history]);
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

// ============================================================
// POST — принятие оплаты, списание, обновление остатка
// ============================================================
if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $action = $input['action'] ?? '';
    
    // ========== ПРИНЯТЬ ОПЛАТУ ПО ТН ==========
    if ($action === 'accept_payment') {
        $tn = trim($input['tn'] ?? '');
        $amount = intval($input['amount'] ?? 0);
        
        if (!$tn || $amount <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Неверные данные']);
            exit;
        }
        
        try {
            $pdo->beginTransaction();
            
            // Получаем или создаём активную сессию
            $stmt = $pdo->prepare("
                SELECT id, start_balance, expected_cash, actual_cash 
                FROM cashier_sessions 
                WHERE user = ? AND closed = 0 
                ORDER BY id DESC LIMIT 1
            ");
            $stmt->execute([$_SESSION['user'] ?? 'admin']);
            $session = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$session) {
                $stmt = $pdo->prepare("
                    INSERT INTO cashier_sessions (user, start_balance) 
                    VALUES (?, 0)
                ");
                $stmt->execute([$_SESSION['user'] ?? 'admin']);
                $sessionId = $pdo->lastInsertId();
                $session = ['id' => $sessionId, 'start_balance' => 0, 'expected_cash' => 0, 'actual_cash' => 0];
            } else {
                $sessionId = $session['id'];
            }
            
            // Сохраняем платёж
            $stmt = $pdo->prepare("
                INSERT INTO cashier_payments (session_id, tn_number, amount, type) 
                VALUES (?, ?, ?, 'payment')
            ");
            $stmt->execute([$sessionId, $tn, $amount]);
            
            // Обновляем и ожидаемую, и фактическую сумму
            $newExpected = $session['expected_cash'] + $amount;
            $newActual = $session['actual_cash'] + $amount;
            
            $stmt = $pdo->prepare("
                UPDATE cashier_sessions 
                SET expected_cash = ?,
                    actual_cash = ?,
                    difference = (start_balance + expected_cash) - actual_cash
                WHERE id = ?
            ");
            $stmt->execute([$newExpected, $newActual, $sessionId]);
            
            $pdo->commit();
            
            echo json_encode([
                'success' => true,
                'message' => "Оплата по ТН $tn на сумму $amount руб. принята"
            ]);
            
        } catch(PDOException $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        exit;
    }
    
    // ========== ВЗЯТЬ ИЗ КАССЫ ИЛИ ВНЕСТИ В КАССУ ==========
    if ($action === 'withdraw' || $action === 'deposit') {
        $amount = intval($input['amount'] ?? 0);
        $comment = trim($input['comment'] ?? '');
        $operationType = $action === 'withdraw' ? 'withdrawal' : 'deposit';
        $sign = ($action === 'withdraw') ? -1 : 1; // Взять: -, Внести: +
        
        if ($amount <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Введите корректную сумму']);
            exit;
        }
        
        if (empty($comment)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Обязательно укажите комментарий']);
            exit;
        }
        
        try {
            $pdo->beginTransaction();
            
            // Получаем активную сессию
            $stmt = $pdo->prepare("
                SELECT id, start_balance, expected_cash, actual_cash 
                FROM cashier_sessions 
                WHERE user = ? AND closed = 0 
                ORDER BY id DESC LIMIT 1
            ");
            $stmt->execute([$_SESSION['user'] ?? 'admin']);
            $session = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$session) {
                $pdo->rollBack();
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Нет активной сессии. Сначала внесите остаток.']);
                exit;
            }
            
            $sessionId = $session['id'];
            
            // Сохраняем операцию
            $stmt = $pdo->prepare("
                INSERT INTO cashier_payments (session_id, tn_number, amount, type, comment) 
                VALUES (?, ?, ?, ?, ?)
            ");
            $stmt->execute([$sessionId, 'ОПЕРАЦИЯ', $amount, $operationType, $comment]);
            
            // Обновляем и ожидаемую, и фактическую сумму
            $newExpected = $session['expected_cash'] + ($amount * $sign);
            $newActual = $session['actual_cash'] + ($amount * $sign);
            
            $stmt = $pdo->prepare("
                UPDATE cashier_sessions 
                SET expected_cash = ?,
                    actual_cash = ?,
                    difference = (start_balance + expected_cash) - actual_cash
                WHERE id = ?
            ");
            $stmt->execute([$newExpected, $newActual, $sessionId]);
            
            $pdo->commit();
            
            $actionLabel = ($action === 'withdraw') ? 'Взято' : 'Внесено';
            echo json_encode([
                'success' => true,
                'message' => "$actionLabel $amount руб. Комментарий: $comment"
            ]);
            
        } catch(PDOException $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        exit;
    }
    
    // ========== ОБНОВИТЬ ОСТАТОК ==========
    if ($action === 'update_balance') {
        $balance = intval($input['start_balance'] ?? 0);
        
        try {
            $pdo->beginTransaction();
            
            // Находим активную сессию
            $stmt = $pdo->prepare("
                SELECT id, start_balance, expected_cash, actual_cash 
                FROM cashier_sessions 
                WHERE user = ? AND closed = 0 
                ORDER BY id DESC LIMIT 1
            ");
            $stmt->execute([$_SESSION['user'] ?? 'admin']);
            $session = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$session) {
                // Если сессии нет — создаём с новым остатком
                $stmt = $pdo->prepare("
                    INSERT INTO cashier_sessions (user, start_balance) 
                    VALUES (?, ?)
                ");
                $stmt->execute([$_SESSION['user'] ?? 'admin', $balance]);
            } else {
                // Обновляем остаток существующей сессии
                $stmt = $pdo->prepare("
                    UPDATE cashier_sessions 
                    SET start_balance = ?,
                        difference = (start_balance + expected_cash) - actual_cash
                    WHERE id = ?
                ");
                $stmt->execute([$balance, $session['id']]);
            }
            
            $pdo->commit();
            
            echo json_encode(['success' => true, 'message' => 'Остаток обновлён']);
            
        } catch(PDOException $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        exit;
    }
    
    // ========== ОБНОВИТЬ ФАКТИЧЕСКУЮ СУММУ (ПОСЛЕ ПЕРЕСЧЁТА) ==========
    if ($action === 'update_actual') {
        $actual = intval($input['actual_cash'] ?? 0);
        
        try {
            $pdo->beginTransaction();
            
            $stmt = $pdo->prepare("
                SELECT id, start_balance, expected_cash, actual_cash 
                FROM cashier_sessions 
                WHERE user = ? AND closed = 0 
                ORDER BY id DESC LIMIT 1
            ");
            $stmt->execute([$_SESSION['user'] ?? 'admin']);
            $session = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$session) {
                // Если сессии нет — создаём
                $stmt = $pdo->prepare("
                    INSERT INTO cashier_sessions (user, start_balance, actual_cash, expected_cash) 
                    VALUES (?, 0, ?, 0)
                ");
                $stmt->execute([$_SESSION['user'] ?? 'admin', $actual]);
            } else {
                // Обновляем только фактическую сумму
                $stmt = $pdo->prepare("
                    UPDATE cashier_sessions 
                    SET actual_cash = ?,
                        difference = (start_balance + expected_cash) - actual_cash
                    WHERE id = ?
                ");
                $stmt->execute([$actual, $session['id']]);
            }
            
            $pdo->commit();
            
            echo json_encode(['success' => true, 'message' => 'Фактическая сумма обновлена']);
            
        } catch(PDOException $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        exit;
    }
    
    // ========== ЗАКРЫТЬ СМЕНУ ==========
    if ($action === 'close_session') {
        try {
            $pdo->beginTransaction();
            
            $stmt = $pdo->prepare("
                SELECT id FROM cashier_sessions 
                WHERE user = ? AND closed = 0 
                ORDER BY id DESC LIMIT 1
            ");
            $stmt->execute([$_SESSION['user'] ?? 'admin']);
            $session = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$session) {
                $pdo->rollBack();
                echo json_encode(['success' => false, 'error' => 'Нет активной сессии']);
                exit;
            }
            
            $stmt = $pdo->prepare("
                UPDATE cashier_sessions 
                SET closed = 1, closed_at = NOW() 
                WHERE id = ?
            ");
            $stmt->execute([$session['id']]);
            
            $pdo->commit();
            
            echo json_encode(['success' => true, 'message' => 'Смена закрыта']);
            
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

http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Метод не поддерживается']);
?>