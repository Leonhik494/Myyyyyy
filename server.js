
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = process.env.PORT || 10000;

// Конфигурация
const JWT_SECRET = '66bec882655249c52c62f2bc61d75dca21e043b867c4584ddb9b8f6d4383451ce5f48890808abd067cb4186d82538d631cfc060c9586640e33dc56b94e7b9549';
const EXA_API_KEY = 'd305ca09-5a36-4246-b975-cb7383f6a80b';

const CREATOR_CONFIG = {
    USERNAME: 'alexey_creator',
    EMAIL: 'alexey@neuralai.pro',
    PASSWORD: 'CreatorPass123!',
    WALLET: '+79991234567',
    MIN_WITHDRAWAL: 500,
    COMMISSION_RATE: 0.1
};

console.log('🚀 Smart Neural AI Server запускается...');
console.log(`🌐 URL: https://my-6xme.onrender.com`);
console.log(`👑 Создатель: ${CREATOR_CONFIG.USERNAME}`);

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// База данных в памяти
const users = new Map();
const subscriptions = new Map();
const dailyUsage = new Map();
const products = new Map();
const payments = new Map();
const withdrawals = new Map();

const systemBalance = {
    totalEarned: 0,
    availableBalance: 0,
    pendingWithdrawals: 0,
    withdrawn: 0,
    totalUsers: 0,
    totalPayments: 0,
    totalRequests: 0
};

// Инициализация создателя
async function initializeCreatorAccount() {
    const hashedPassword = await bcrypt.hash(CREATOR_CONFIG.PASSWORD, 10);
    
    const creator = {
        id: 'creator-001',
        username: CREATOR_CONFIG.USERNAME,
        email: CREATOR_CONFIG.EMAIL,
        password: hashedPassword,
        subscription: {
            status: 'active',
            tier: 'enterprise',
            daily_requests: -1,
            created: new Date().toISOString()
        },
        role: 'creator',
        isActive: true,
        wallet: CREATOR_CONFIG.WALLET,
        createdAt: new Date().toISOString()
    };
    
    users.set(creator.username, creator);
    users.set(creator.id, creator);
    systemBalance.totalUsers += 1;
    
    console.log(`✅ Создатель создан: ${creator.username}`);
    return creator;
}

// Инициализация продуктов
function initializeProducts() {
    products.set('free', {
        id: 'free',
        name: 'Бесплатный план',
        price: 0,
        price_display: 'Бесплатно',
        daily_requests: 10,
        features: ['10 запросов в день', 'Базовые модели AI'],
        tier: 'free'
    });

    products.set('pro_monthly', {
        id: 'pro_monthly',
        name: 'Pro подписка',
        price: 1000,
        price_display: '1000₽/месяц',
        daily_requests: 250,
        commission: 0.1,
        features: ['250 запросов в день', 'Приоритетная очередь'],
        tier: 'pro'
    });

    products.set('enterprise_monthly', {
        id: 'enterprise_monthly',
        name: 'Enterprise подписка',
        price: 5000,
        price_display: '5000₽/месяц',
        daily_requests: -1,
        commission: 0.1,
        features: ['Безлимитные запросы', 'API доступ'],
        tier: 'enterprise'
    });
}

// Health endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        version: '3.5.0',
        service: 'Smart Neural AI',
        server: 'https://my-6xme.onrender.com',
        timestamp: new Date().toISOString(),
        statistics: {
            users: users.size,
            total_earned: systemBalance.totalEarned,
            available_balance: systemBalance.availableBalance,
            creator: CREATOR_CONFIG.USERNAME
        }
    });
});

// Главная страница
app.get('/', (req, res) => {
    res.json({
        message: 'Smart Neural AI работает!',
        version: '3.5.0',
        endpoints: ['/api/health', '/api/auth/*', '/api/ai/*', '/api/subscriptions/*']
    });
});

// Регистрация
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        if (users.has(username)) {
            return res.status(409).json({ 
                success: false,
                error: 'Пользователь уже существует' 
            });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const user = {
            id: uuidv4(),
            username: username,
            email: email,
            password: hashedPassword,
            subscription: {
                status: 'active',
                tier: 'free',
                daily_requests: 10
            },
            role: 'user',
            createdAt: new Date().toISOString()
        };
        
        users.set(user.username, user);
        users.set(user.id, user);
        systemBalance.totalUsers += 1;
        
        const token = jwt.sign(
            { userId: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.json({
            success: true,
            token: token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                subscription: user.subscription,
                role: user.role
            }
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: 'Ошибка регистрации'
        });
    }
});

// Вход
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const user = users.get(username);
        
        if (!user) {
            return res.status(401).json({ 
                success: false,
                error: 'Пользователь не найден' 
            });
        }
        
        const validPassword = await bcrypt.compare(password, user.password);
        
        if (!validPassword) {
            return res.status(401).json({ 
                success: false,
                error: 'Неверный пароль' 
            });
        }
        
        const token = jwt.sign(
            { userId: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.json({
            success: true,
            token: token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                subscription: user.subscription,
                role: user.role
            }
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: 'Ошибка входа'
        });
    }
});

// Информация о пользователе
app.get('/api/auth/me', authenticateToken, (req, res) => {
    try {
        const user = users.get(req.user.id);
        
        res.json({
            success: true,
            user: user,
            usage: {
                today: 0,
                limit: user.subscription.daily_requests,
                remaining: user.subscription.daily_requests,
                unlimited: user.subscription.daily_requests === -1
            }
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: 'Ошибка получения информации'
        });
    }
});

// AI запрос
app.post('/api/ai/generate', authenticateToken, async (req, res) => {
    try {
        const { prompt } = req.body;
        const user = users.get(req.user.id);
        
        const responseText = `🤖 AI ответ на: "${prompt.substring(0, 50)}..."
        
Это демо-ответ от Smart Neural AI. Система работает правильно!

Ваш запрос был получен и обработан. В реальной системе здесь был бы ответ от Exa AI.

Пользователь: ${user.username}
Тариф: ${user.subscription.tier}
Время: ${new Date().toLocaleTimeString()}`;

        res.json({
            success: true,
            response: responseText,
            usage: {
                today: 1,
                limit: user.subscription.daily_requests,
                remaining: user.subscription.daily_requests - 1,
                unlimited: user.subscription.daily_requests === -1
            }
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: 'Ошибка генерации'
        });
    }
});

// Подписки
app.get('/api/subscriptions/plans', (req, res) => {
    const plans = Array.from(products.values());
    
    res.json({
        success: true,
        plans: plans
    });
});

app.get('/api/subscriptions/my', authenticateToken, (req, res) => {
    const user = users.get(req.user.id);
    
    res.json({
        success: true,
        subscription: user.subscription,
        usage: {
            today: 0,
            limit: user.subscription.daily_requests,
            remaining: user.subscription.daily_requests,
            unlimited: user.subscription.daily_requests === -1
        }
    });
});

// Админ баланс
app.get('/api/admin/balance', authenticateToken, (req, res) => {
    const user = users.get(req.user.id);
    
    if (user.role !== 'creator') {
        return res.status(403).json({ 
            success: false,
            error: 'Доступ запрещен' 
        });
    }
    
    res.json({
        success: true,
        balance: systemBalance
    });
});

// Вывод средств
app.post('/api/admin/withdraw', authenticateToken, (req, res) => {
    const user = users.get(req.user.id);
    
    if (user.role !== 'creator') {
        return res.status(403).json({ 
            success: false,
            error: 'Доступ запрещен' 
        });
    }
    
    const { amount, wallet, method } = req.body;
    
    if (amount < CREATOR_CONFIG.MIN_WITHDRAWAL) {
        return res.status(400).json({ 
            success: false,
            error: `Минимальная сумма: ${CREATOR_CONFIG.MIN_WITHDRAWAL}₽`
        });
    }
    
    const withdrawal = {
        id: 'WD-' + Date.now(),
        amount: amount,
        wallet: wallet,
        method: method || 'qiwi',
        status: 'pending',
        createdAt: new Date().toISOString()
    };
    
    withdrawals.set(withdrawal.id, withdrawal);
    
    res.json({
        success: true,
        withdrawal: withdrawal
    });
});

// Тестовый платеж
app.post('/api/payments/create-test', authenticateToken, (req, res) => {
    const { planId } = req.body;
    const user = users.get(req.user.id);
    
    const plan = products.get(planId);
    if (!plan) {
        return res.status(404).json({ 
            success: false,
            error: 'План не найден' 
        });
    }
    
    user.subscription = {
        status: 'active',
        tier: plan.tier,
        daily_requests: plan.daily_requests
    };
    
    users.set(user.username, user);
    
    const payment = {
        id: 'PAY-' + Date.now(),
        username: user.username,
        tier: plan.tier,
        amount: plan.price,
        status: 'paid',
        createdAt: new Date().toISOString()
    };
    
    payments.set(payment.id, payment);
    systemBalance.totalEarned += plan.price;
    systemBalance.availableBalance += plan.price;
    
    res.json({
        success: true,
        payment: payment,
        subscription: user.subscription
    });
});

// Middleware аутентификации
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ 
            success: false,
            error: 'Токен отсутствует' 
        });
    }
    
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ 
                success: false,
                error: 'Неверный токен' 
            });
        }
        
        req.user = decoded;
        next();
    });
}

// Запуск сервера
async function startServer() {
    initializeProducts();
    await initializeCreatorAccount();
    
    // Тестовый пользователь
    const testPassword = await bcrypt.hash('test123', 10);
    const testUser = {
        id: 'test-001',
        username: 'test_user',
        email: 'test@example.com',
        password: testPassword,
        subscription: {
            status: 'active',
            tier: 'free',
            daily_requests: 10
        },
        role: 'user',
        createdAt: new Date().toISOString()
    };
    
    if (!users.has('test_user')) {
        users.set('test_user', testUser);
        systemBalance.totalUsers += 1;
    }
    
    app.listen(PORT, () => {
        console.log(`✅ Сервер запущен на порту ${PORT}`);
        console.log(`🌐 Доступен по: https://my-6xme.onrender.com`);
        console.log(`👑 Создатель: ${CREATOR_CONFIG.USERNAME} / ${CREATOR_CONFIG.PASSWORD}`);
        console.log(`👤 Тестовый: test_user / test123`);
    });
}

startServer();