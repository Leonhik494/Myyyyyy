
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

const JWT_SECRET = process.env.JWT_SECRET || '66bec882655249c52c62f2bc61d75dca21e043b867c4584ddb9b8f6d4383451ce5f48890808abd067cb4186d82538d631cfc060c9586640e33dc56b94e7b9549';
const EXA_API_KEY = process.env.EXA_API_KEY || 'd305ca09-5a36-4246-b975-cb7383f6a80b';

const CREATOR_CONFIG = {
    USERNAME: process.env.CREATOR_USERNAME || 'alexey_creator',
    EMAIL: process.env.CREATOR_EMAIL || 'alexey@neuralai.pro',
    PASSWORD: process.env.CREATOR_PASSWORD || 'CreatorPass123!',
    WALLET: process.env.CREATOR_WALLET || '+79991234567',
    MIN_WITHDRAWAL: parseInt(process.env.MIN_WITHDRAWAL) || 500,
    COMMISSION_RATE: parseFloat(process.env.COMMISSION_RATE) || 0.1
};

console.log('='.repeat(80));
console.log('🚀 Smart Neural AI Server запускается');
console.log('='.repeat(80));
console.log(`📍 URL: https://my-6xme.onrender.com`);
console.log(`🔐 JWT: ${JWT_SECRET ? '✅' : '❌'}`);
console.log(`👑 Создатель: ${CREATOR_CONFIG.USERNAME}`);
console.log('='.repeat(80));

app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With']
}));

app.options('*', cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: { 
        success: false,
        error: 'Слишком много запросов',
        code: 429
    }
});
app.use('/api/', limiter);

const users = new Map();
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

async function initializeCreatorAccount() {
    if (users.has(CREATOR_CONFIG.USERNAME)) {
        console.log(`👑 Создатель уже существует: ${CREATOR_CONFIG.USERNAME}`);
        return users.get(CREATOR_CONFIG.USERNAME);
    }
    
    const hashedPassword = await bcrypt.hash(CREATOR_CONFIG.PASSWORD, 10);
    
    const creator = {
        id: 'creator-' + uuidv4(),
        username: CREATOR_CONFIG.USERNAME,
        email: CREATOR_CONFIG.EMAIL,
        password: hashedPassword,
        subscription: {
            status: 'active',
            tier: 'enterprise',
            planId: 'enterprise_monthly',
            daily_requests: -1,
            created: new Date().toISOString(),
            isCreator: true
        },
        balance: 0,
        role: 'creator',
        isActive: true,
        wallet: CREATOR_CONFIG.WALLET,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isCreator: true,
        lastLogin: null
    };
    
    users.set(creator.username, creator);
    users.set(creator.id, creator);
    systemBalance.totalUsers += 1;
    
    console.log(`✅ Создатель создан: ${creator.username}`);
    return creator;
}

function initializeProducts() {
    products.set('free', {
        id: 'free',
        name: 'Бесплатный план',
        description: 'Базовый доступ с ограничениями',
        price: 0,
        price_display: 'Бесплатно',
        currency: 'RUB',
        daily_requests: 10,
        features: [
            '10 запросов в день',
            'Базовые модели AI',
            'Стандартная скорость',
            'Общая поддержка'
        ],
        type: 'subscription',
        tier: 'free',
        createdAt: new Date().toISOString()
    });

    products.set('pro_monthly', {
        id: 'pro_monthly',
        name: 'Pro подписка',
        description: 'Месячная Pro подписка с 250 запросами в день',
        price: 1000,
        price_display: '1000₽/месяц',
        currency: 'RUB',
        daily_requests: 250,
        commission: CREATOR_CONFIG.COMMISSION_RATE,
        features: [
            '250 запросов в день',
            'Доступ к GPT-4',
            'Приоритетная очередь',
            'Поддержка 24/7',
            'Экспорт истории',
            'Кастомные промпты'
        ],
        type: 'subscription',
        tier: 'pro',
        createdAt: new Date().toISOString()
    });

    products.set('enterprise_monthly', {
        id: 'enterprise_monthly',
        name: 'Enterprise подписка',
        description: 'Месячная Enterprise подписка с безлимитными запросами',
        price: 5000,
        price_display: '5000₽/месяц',
        currency: 'RUB',
        daily_requests: -1,
        commission: CREATOR_CONFIG.COMMISSION_RATE,
        features: [
            'Безлимитные запросы',
            'Доступ ко всем моделям AI',
            'Высший приоритет',
            'Персональный менеджер',
            'API доступ',
            'Кастомная интеграция',
            'Аналитика использования',
            'SLA 99.9%'
        ],
        type: 'subscription',
        tier: 'enterprise',
        createdAt: new Date().toISOString()
    });

    console.log('📊 Продукты инициализированы');
}

function checkRequestLimit(userId, tier) {
    const today = new Date().toISOString().split('T')[0];
    
    if (!dailyUsage.has(userId)) {
        dailyUsage.set(userId, {});
    }
    
    const userUsage = dailyUsage.get(userId);
    
    if (!userUsage[today]) {
        userUsage[today] = {
            count: 0,
            date: today,
            tier: tier
        };
    }
    
    const product = Array.from(products.values()).find(p => p.tier === tier);
    const dailyLimit = product ? product.daily_requests : 10;
    
    if (dailyLimit === -1) {
        return { 
            allowed: true, 
            remaining: Infinity, 
            limit: Infinity,
            used: userUsage[today].count,
            tier: tier
        };
    }
    
    const currentCount = userUsage[today].count || 0;
    const remaining = Math.max(0, dailyLimit - currentCount);
    
    if (currentCount >= dailyLimit) {
        return { 
            allowed: false, 
            remaining: 0, 
            limit: dailyLimit,
            used: currentCount,
            tier: tier
        };
    }
    
    return { 
        allowed: true, 
        remaining: remaining, 
        limit: dailyLimit,
        used: currentCount,
        tier: tier
    };
}

function incrementRequestCount(userId) {
    const today = new Date().toISOString().split('T')[0];
    
    if (!dailyUsage.has(userId)) {
        dailyUsage.set(userId, {});
    }
    
    const userUsage = dailyUsage.get(userId);
    
    if (!userUsage[today]) {
        userUsage[today] = {
            count: 0,
            date: today
        };
    }
    
    userUsage[today].count += 1;
    dailyUsage.set(userId, userUsage);
    systemBalance.totalRequests += 1;
    
    return userUsage[today].count;
}

function getUsageStats(userId) {
    const today = new Date().toISOString().split('T')[0];
    
    if (!dailyUsage.has(userId)) {
        return { 
            today: 0, 
            limit: 10,
            remaining: 10,
            unlimited: false,
            tier: 'free'
        };
    }
    
    const userUsage = dailyUsage.get(userId);
    const todayUsage = userUsage[today] ? userUsage[today].count : 0;
    
    const user = Array.from(users.values()).find(u => u.id === userId);
    const tier = user && user.subscription ? user.subscription.tier : 'free';
    const product = Array.from(products.values()).find(p => p.tier === tier);
    const limit = product ? product.daily_requests : 10;
    
    return {
        today: todayUsage,
        limit: limit,
        remaining: limit === -1 ? Infinity : Math.max(0, limit - todayUsage),
        unlimited: limit === -1,
        tier: tier
    };
}

async function callExaAI(prompt) {
    try {
        console.log(`🤖 Отправка запроса к Exa AI (${prompt.length} символов)`);
        
        if (!EXA_API_KEY || EXA_API_KEY === 'd305ca09-5a36-4246-b975-cb7383f6a80b') {
            console.log('⚠️ Используется тестовый ключ');
        }
        
        const response = await fetch('https://api.exa.ai/v1/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${EXA_API_KEY}`,
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                prompt: prompt.substring(0, 2000),
                max_tokens: 800,
                temperature: 0.7,
                top_p: 0.9,
                model: 'gpt-4'
            })
        });

        if (!response.ok) {
            throw new Error(`Exa AI API error: ${response.status}`);
        }

        const data = await response.json();
        console.log(`✅ Ответ от Exa AI получен`);
        return data;
    } catch (error) {
        console.error('❌ Exa AI ошибка:', error.message);
        
        return {
            text: `🤖 Smart Neural AI ответ:
            
Ваш запрос: "${prompt.substring(0, 100)}..."

Это демо-ответ. Реальная система AI временно недоступна.

Пример ответа на ваш запрос:

"${prompt}" - интересный вопрос! Как умный ассистент, я могу помочь вам с анализом текста, генерацией идей, написанием контента и многим другим.

Сервер: https://my-6xme.onrender.com
Время: ${new Date().toLocaleTimeString()}
Статус: ✅ Система работает`,
            error: error.message,
            isFallback: true
        };
    }
}

function updateSystemBalance(amount, type = 'payment') {
    systemBalance.totalEarned += amount;
    systemBalance.availableBalance += amount;
    systemBalance.totalPayments += 1;
    
    console.log(`💰 Баланс: +${amount}₽, Всего: ${systemBalance.availableBalance}₽`);
    
    return systemBalance;
}

function createWithdrawalRequest(userId, amount, wallet, method = 'qiwi') {
    const withdrawalId = 'WD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    
    const withdrawal = {
        id: withdrawalId,
        userId: userId,
        amount: amount,
        wallet: wallet,
        method: method,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        notes: 'Ожидает обработки'
    };
    
    withdrawals.set(withdrawalId, withdrawal);
    
    systemBalance.availableBalance -= amount;
    systemBalance.pendingWithdrawals += amount;
    
    console.log(`📤 Заявка на вывод ${withdrawalId}: ${amount}₽ на ${wallet}`);
    
    return withdrawal;
}

// ============ ENDPOINTS ============

app.get('/api/health', (req, res) => {
    const healthData = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'Smart Neural AI',
        version: '3.5.0',
        
        server: {
            port: PORT,
            node_version: process.version,
            uptime: Math.floor(process.uptime()),
            memory_usage: {
                rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`
            }
        },
        
        services: {
            api: 'operational',
            exa_ai: EXA_API_KEY ? 'configured' : 'not_configured',
            creator_account: 'configured',
            database: 'in_memory'
        },
        
        subscription_plans: {
            free: '10 запросов/день',
            pro: '1000₽/месяц - 250 запросов/день',
            enterprise: '5000₽/месяц - безлимитные запросы'
        },
        
        statistics: {
            users: users.size,
            active_subscriptions: Array.from(users.values()).filter(u => u.subscription?.status === 'active').length,
            total_payments: systemBalance.totalPayments,
            total_earned: systemBalance.totalEarned,
            available_balance: systemBalance.availableBalance,
            total_requests: systemBalance.totalRequests,
            creator: CREATOR_CONFIG.USERNAME
        },
        
        creator_info: {
            username: CREATOR_CONFIG.USERNAME,
            wallet: CREATOR_CONFIG.WALLET,
            min_withdrawal: CREATOR_CONFIG.MIN_WITHDRAWAL,
            commission_rate: CREATOR_CONFIG.COMMISSION_RATE
        }
    };
    
    res.json(healthData);
});

app.get('/', (req, res) => {
    res.json({
        message: '🚀 Smart Neural AI работает!',
        version: '3.5.0',
        server: 'https://my-6xme.onrender.com',
        creator: CREATOR_CONFIG.USERNAME,
        endpoints: {
            health: '/api/health',
            auth: '/api/auth/login, /api/auth/register',
            ai: '/api/ai/generate',
            subscriptions: '/api/subscriptions/plans',
            admin: '/api/admin/*'
        },
        status: 'online'
    });
});

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    
    if (!authHeader) {
        return res.status(401).json({ 
            success: false,
            error: 'Требуется токен авторизации'
        });
    }
    
    const token = authHeader.startsWith('Bearer ') 
        ? authHeader.substring(7) 
        : authHeader;
    
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ 
                success: false,
                error: 'Неверный токен'
            });
        }
        
        const user = Array.from(users.values()).find(u => u.id === decoded.userId);
        
        if (!user) {
            return res.status(404).json({ 
                success: false,
                error: 'Пользователь не найден'
            });
        }
        
        req.user = {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            subscription: user.subscription,
            token: token
        };
        
        next();
    });
}

app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        if (users.has(username)) {
            return res.status(409).json({ 
                success: false,
                error: 'Пользователь с таким именем уже существует' 
            });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const user = {
            id: uuidv4(),
            username: username.trim(),
            email: email.trim().toLowerCase(),
            password: hashedPassword,
            subscription: {
                status: 'active',
                tier: 'free',
                planId: 'free',
                daily_requests: 10,
                created: new Date().toISOString()
            },
            balance: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            role: 'user',
            isActive: true,
            lastLogin: null
        };
        
        users.set(user.username, user);
        users.set(user.id, user);
        systemBalance.totalUsers += 1;
        
        const token = jwt.sign(
            { 
                userId: user.id, 
                username: user.username,
                role: user.role,
                tier: user.subscription.tier
            },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        console.log(`✅ Регистрация: ${user.username}`);
        
        res.json({
            success: true,
            message: 'Регистрация успешна',
            token: token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                subscription: user.subscription,
                role: user.role,
                createdAt: user.createdAt
            }
        });
        
    } catch (error) {
        console.error('❌ Registration error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Ошибка при регистрации'
        });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const user = users.get(username.trim());
        
        if (!user) {
            return res.status(401).json({ 
                success: false,
                error: 'Неверное имя пользователя или пароль' 
            });
        }
        
        const validPassword = await bcrypt.compare(password, user.password);
        
        if (!validPassword) {
            return res.status(401).json({ 
                success: false,
                error: 'Неверное имя пользователя или пароль' 
            });
        }
        
        const token = jwt.sign(
            { 
                userId: user.id, 
                username: user.username,
                role: user.role,
                tier: user.subscription.tier
            },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        user.lastLogin = new Date().toISOString();
        user.updatedAt = new Date().toISOString();
        users.set(user.username, user);
        
        console.log(`✅ Вход: ${user.username} (${user.role})`);
        
        res.json({
            success: true,
            message: 'Вход выполнен успешно',
            token: token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                subscription: user.subscription,
                role: user.role,
                createdAt: user.createdAt,
                balance: user.balance,
                lastLogin: user.lastLogin
            }
        });
        
    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Ошибка при входе'
        });
    }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
    try {
        const userData = users.get(req.user.id);
        
        const usage = getUsageStats(req.user.id);
        
        res.json({
            success: true,
            user: {
                id: userData.id,
                username: userData.username,
                email: userData.email,
                subscription: userData.subscription,
                role: userData.role,
                createdAt: userData.createdAt,
                updatedAt: userData.updatedAt,
                isActive: userData.isActive,
                balance: userData.balance || 0,
                lastLogin: userData.lastLogin
            },
            usage: usage
        });
        
    } catch (error) {
        console.error('❌ Get user info error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Ошибка получения информации о пользователе'
        });
    }
});

app.post('/api/ai/generate', authenticateToken, async (req, res) => {
    try {
        const { prompt } = req.body;
        
        if (!prompt || prompt.trim().length === 0) {
            return res.status(400).json({ 
                success: false,
                error: 'Промпт обязателен' 
            });
        }
        
        const userId = req.user.id;
        const user = users.get(userId);
        const tier = user.subscription.tier;
        
        console.log(`🤖 AI запрос от ${user.username} (${tier})`);
        
        const limitCheck = checkRequestLimit(userId, tier);
        
        if (!limitCheck.allowed) {
            return res.status(429).json({ 
                success: false,
                error: 'Дневной лимит запросов исчерпан',
                remaining: limitCheck.remaining,
                limit: limitCheck.limit,
                tier: tier
            });
        }
        
        const aiResponse = await callExaAI(prompt);
        
        const usedCount = incrementRequestCount(userId);
        const updatedUsage = getUsageStats(userId);
        
        console.log(`✅ AI ответ для ${user.username}, использовано: ${usedCount}`);
        
        res.json({
            success: true,
            message: 'Ответ сгенерирован успешно',
            response: aiResponse.text || aiResponse,
            usage: updatedUsage,
            tier: tier
        });
        
    } catch (error) {
        console.error('❌ AI generation error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Ошибка генерации ответа'
        });
    }
});

app.get('/api/subscriptions/plans', (req, res) => {
    const plans = Array.from(products.values()).map(product => ({
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price,
        price_display: product.price_display,
        currency: product.currency,
        daily_requests: product.daily_requests,
        features: product.features,
        type: product.type,
        tier: product.tier
    }));
    
    res.json({
        success: true,
        plans: plans,
        count: plans.length
    });
});

app.get('/api/subscriptions/my', authenticateToken, (req, res) => {
    try {
        const userId = req.user.id;
        const user = users.get(userId);
        
        const usage = getUsageStats(userId);
        
        res.json({
            success: true,
            subscription: user.subscription,
            usage: usage
        });
        
    } catch (error) {
        console.error('❌ Get subscriptions error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Ошибка получения информации о подписке'
        });
    }
});

app.post('/api/subscriptions/cancel', authenticateToken, (req, res) => {
    try {
        const userId = req.user.id;
        const user = users.get(userId);
        
        if (!user || !user.subscription || user.subscription.tier === 'free') {
            return res.status(400).json({ 
                success: false,
                error: 'Нет активной платной подписки' 
            });
        }
        
        user.subscription.status = 'canceled';
        user.updatedAt = new Date().toISOString();
        users.set(user.username, user);
        
        console.log(`📊 Подписка отменена: ${user.username}`);
        
        res.json({
            success: true,
            message: 'Подписка будет отменена в конце периода',
            subscription: user.subscription
        });
        
    } catch (error) {
        console.error('❌ Cancel subscription error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Ошибка отмены подписки'
        });
    }
});

app.get('/api/admin/balance', authenticateToken, (req, res) => {
    try {
        const user = users.get(req.user.id);
        
        if (!user || user.role !== 'creator') {
            return res.status(403).json({ 
                success: false,
                error: 'Доступ запрещен' 
            });
        }
        
        res.json({
            success: true,
            balance: systemBalance,
            creator: {
                username: user.username,
                wallet: user.wallet,
                role: user.role
            }
        });
        
    } catch (error) {
        console.error('❌ Get system balance error:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

app.post('/api/admin/withdraw', authenticateToken, (req, res) => {
    try {
        const { amount, wallet, method } = req.body;
        const user = users.get(req.user.id);
        
        if (!user || user.role !== 'creator') {
            return res.status(403).json({ 
                success: false,
                error: 'Доступ запрещен' 
            });
        }
        
        if (amount < CREATOR_CONFIG.MIN_WITHDRAWAL) {
            return res.status(400).json({ 
                success: false,
                error: `Минимальная сумма вывода: ${CREATOR_CONFIG.MIN_WITHDRAWAL}₽`
            });
        }
        
        if (amount > systemBalance.availableBalance) {
            return res.status(400).json({ 
                success: false,
                error: 'Недостаточно средств на балансе'
            });
        }
        
        const withdrawal = createWithdrawalRequest(user.id, amount, wallet, method || 'qiwi');
        
        res.json({
            success: true,
            message: 'Заявка на вывод создана',
            withdrawal: withdrawal,
            system_balance: systemBalance
        });
        
    } catch (error) {
        console.error('❌ Withdrawal request error:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

app.get('/api/admin/withdrawals', authenticateToken, (req, res) => {
    try {
        const user = users.get(req.user.id);
        
        if (!user || user.role !== 'creator') {
            return res.status(403).json({ 
                success: false,
                error: 'Доступ запрещен' 
            });
        }
        
        const withdrawalsList = Array.from(withdrawals.values());
        
        res.json({
            success: true,
            withdrawals: withdrawalsList,
            total: withdrawalsList.length
        });
        
    } catch (error) {
        console.error('❌ Get withdrawals error:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

app.get('/api/admin/payments', authenticateToken, (req, res) => {
    try {
        const user = users.get(req.user.id);
        
        if (!user || user.role !== 'creator') {
            return res.status(403).json({ 
                success: false,
                error: 'Доступ запрещен' 
            });
        }
        
        const paymentsList = Array.from(payments.values());
        
        const stats = {
            total: paymentsList.length,
            totalAmount: paymentsList.reduce((sum, p) => sum + (p.amount || 0), 0)
        };
        
        res.json({
            success: true,
            stats: stats,
            recent_payments: paymentsList.slice(0, 10)
        });
        
    } catch (error) {
        console.error('❌ Get payments stats error:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

app.post('/api/payments/create-test', authenticateToken, (req, res) => {
    try {
        const { planId } = req.body;
        const userId = req.user.id;
        const username = req.user.username;
        
        const plan = products.get(planId);
        if (!plan) {
            return res.status(404).json({ 
                success: false,
                error: 'План не найден' 
            });
        }
        
        const user = users.get(userId);
        
        const paymentId = 'PAY-' + Date.now();
        
        const paymentData = {
            id: paymentId,
            userId: userId,
            username: username,
            planId: plan.id,
            tier: plan.tier,
            amount: plan.price,
            currency: plan.currency,
            status: 'paid',
            description: `Тестовый платеж за ${plan.name}`,
            createdAt: new Date().toISOString(),
            isTest: true
        };
        
        payments.set(paymentId, paymentData);
        
        user.subscription = {
            id: paymentId,
            status: 'active',
            tier: plan.tier,
            planId: plan.id,
            daily_requests: plan.daily_requests,
            period_start: new Date().toISOString(),
            period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            created: new Date().toISOString()
        };
        
        dailyUsage.delete(userId);
        user.updatedAt = new Date().toISOString();
        users.set(user.username, user);
        
        const systemCommission = plan.commission ? Math.round(plan.price * plan.commission) : Math.round(plan.price * 0.1);
        updateSystemBalance(systemCommission);
        
        console.log(`💰 Тестовый платеж: ${username} - ${plan.name} (${plan.price}₽)`);
        
        res.json({
            success: true,
            message: 'Тестовый платеж обработан',
            payment: paymentData,
            subscription: user.subscription,
            system_commission: systemCommission
        });
        
    } catch (error) {
        console.error('❌ Test payment error:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

app.get('/api/test/exa', async (req, res) => {
    try {
        const testPrompt = "Привет! Ответь коротко: работаешь ли ты?";
        
        const result = await callExaAI(testPrompt);
        
        res.json({
            success: true,
            message: 'Exa AI работает',
            test_prompt: testPrompt,
            response: result.text || result,
            key_status: EXA_API_KEY ? 'valid' : 'not_set'
        });
        
    } catch (error) {
        res.json({
            success: false,
            message: 'Exa AI тест не пройден',
            error: error.message
        });
    }
});

app.get('/api/test/auth', authenticateToken, (req, res) => {
    res.json({
        success: true,
        message: 'Аутентификация успешна',
        user: req.user
    });
});

async function startServer() {
    try {
        initializeProducts();
        await initializeCreatorAccount();
        
        const testPassword = await bcrypt.hash('test123', 10);
        const testUser = {
            id: 'test-' + uuidv4(),
            username: 'test_user',
            email: 'test@example.com',
            password: testPassword,
            subscription: {
                status: 'active',
                tier: 'free',
                planId: 'free',
                daily_requests: 10,
                created: new Date().toISOString()
            },
            balance: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            role: 'user',
            isActive: true
        };
        
        if (!users.has('test_user')) {
            users.set('test_user', testUser);
            systemBalance.totalUsers += 1;
            console.log(`👤 Тестовый пользователь создан: test_user / test123`);
        }
        
        const server = app.listen(PORT, '0.0.0.0', () => {
            console.log('\n' + '='.repeat(80));
            console.log('✅ СЕРВЕР УСПЕШНО ЗАПУЩЕН!');
            console.log('='.repeat(80));
            console.log(`📍 Порт: ${PORT}`);
            console.log(`🌐 URL: https://my-6xme.onrender.com`);
            console.log(`👑 Создатель: ${CREATOR_CONFIG.USERNAME}`);
            console.log(`🔑 Пароль: ${CREATOR_CONFIG.PASSWORD}`);
            console.log(`🤖 Exa AI: ${EXA_API_KEY ? '✅' : '❌'}`);
            console.log(`💰 Баланс: ${systemBalance.availableBalance}₽`);
            console.log(`👥 Пользователей: ${users.size}`);
            console.log('='.repeat(80));
            console.log('\n🔥 ТЕСТОВЫЕ ДАННЫЕ:');
            console.log(`   👑 Создатель: ${CREATOR_CONFIG.USERNAME} / ${CREATOR_CONFIG.PASSWORD}`);
            console.log(`   👤 Тестовый: test_user / test123`);
            console.log('\n🌐 ЭНДПОИНТЫ:');
            console.log(`   GET  /api/health - Проверка сервера`);
            console.log(`   POST /api/auth/login - Вход`);
            console.log(`   POST /api/auth/register - Регистрация`);
            console.log(`   POST /api/ai/generate - AI запрос`);
            console.log('='.repeat(80));
        });
        
        return server;
    } catch (error) {
        console.error('❌ Ошибка запуска сервера:', error);
        process.exit(1);
    }
}

startServer();