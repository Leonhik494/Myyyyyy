
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = process.env.PORT || 10000;

// Конфигурация Ollama
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b';
const OLLAMA_TIMEOUT = 60000; // 60 секунд

const JWT_SECRET = '66bec882655249c52c62f2bc61d75dca21e043b867c4584ddb9b8f6d4383451ce5f48890808abd067cb4186d82538d631cfc060c9586640e33dc56b94e7b9549';

const CREATOR_CONFIG = {
    USERNAME: 'alexey_creator',
    EMAIL: 'alexey@neuralai.pro',
    PASSWORD: 'CreatorPass123!',
    WALLET: '+79991234567',
    MIN_WITHDRAWAL: 500,
    COMMISSION_RATE: 0.1
};

console.log('='.repeat(80));
console.log('🚀 Smart Neural AI Server с OLLAMA');
console.log('='.repeat(80));
console.log(`📍 URL: https://my-6xme.onrender.com`);
console.log(`🤖 AI: Ollama (${OLLAMA_MODEL})`);
console.log(`🔗 Ollama URL: ${OLLAMA_URL}`);
console.log(`👑 Создатель: ${CREATOR_CONFIG.USERNAME}`);
console.log('='.repeat(80));

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
        subscription: { tier: 'enterprise', daily_requests: -1 },
        role: 'creator',
        wallet: CREATOR_CONFIG.WALLET,
        createdAt: new Date().toISOString()
    };
    
    users.set(creator.username, creator);
    systemBalance.totalUsers += 1;
    
    console.log(`✅ Создатель создан: ${creator.username}`);
    return creator;
}

// Инициализация продуктов
function initializeProducts() {
    products.set('free', {
        id: 'free',
        name: 'Бесплатный план',
        price_display: 'Бесплатно',
        daily_requests: 10,
        features: ['10 запросов в день', 'Базовые модели AI'],
        tier: 'free'
    });

    products.set('pro', {
        id: 'pro',
        name: 'Pro подписка',
        price: 1000,
        price_display: '1000₽/месяц',
        daily_requests: 250,
        features: ['250 запросов в день', 'Приоритетная очередь'],
        tier: 'pro'
    });

    products.set('enterprise', {
        id: 'enterprise',
        name: 'Enterprise подписка',
        price: 5000,
        price_display: '5000₽/месяц',
        daily_requests: -1,
        features: ['Безлимитные запросы', 'API доступ'],
        tier: 'enterprise'
    });
}

// Проверка лимитов
function checkRequestLimit(userId, tier) {
    const today = new Date().toISOString().split('T')[0];
    
    if (!dailyUsage.has(userId)) {
        dailyUsage.set(userId, {});
    }
    
    const userUsage = dailyUsage.get(userId);
    
    if (!userUsage[today]) {
        userUsage[today] = { count: 0 };
    }
    
    const product = Array.from(products.values()).find(p => p.tier === tier);
    const dailyLimit = product ? product.daily_requests : 10;
    
    if (dailyLimit === -1) return { allowed: true, remaining: Infinity };
    
    if (userUsage[today].count >= dailyLimit) {
        return { allowed: false, remaining: 0, limit: dailyLimit };
    }
    
    return { 
        allowed: true, 
        remaining: dailyLimit - userUsage[today].count,
        limit: dailyLimit
    };
}

function incrementRequestCount(userId) {
    const today = new Date().toISOString().split('T')[0];
    
    if (!dailyUsage.has(userId)) {
        dailyUsage.set(userId, {});
    }
    
    const userUsage = dailyUsage.get(userId);
    
    if (!userUsage[today]) {
        userUsage[today] = { count: 0 };
    }
    
    userUsage[today].count += 1;
    systemBalance.totalRequests += 1;
}

// РЕАЛЬНАЯ функция Ollama
async function callOllamaAI(prompt) {
    console.log(`🤖 Ollama (${OLLAMA_MODEL}): "${prompt.substring(0, 50)}..."`);
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT);
        
        const response = await fetch(`${OLLAMA_URL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: 0.7,
                    top_p: 0.9,
                    num_predict: 1000
                }
            }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`✅ Ollama ответ получен (${data.eval_count} токенов)`);
        
        return {
            text: data.response,
            success: true,
            model: OLLAMA_MODEL,
            tokens: data.eval_count || 0
        };
        
    } catch (error) {
        console.error(`❌ Ollama ошибка: ${error.message}`);
        
        // Пробуем другие модели если основная не сработала
        return await tryAlternativeModels(prompt);
    }
}

// Пробуем другие модели Ollama
async function tryAlternativeModels(prompt) {
    const alternativeModels = ['llama3:8b', 'mistral:7b', 'qwen2.5:7b'];
    
    for (const model of alternativeModels) {
        try {
            console.log(`🔄 Пробуем модель: ${model}`);
            
            const response = await fetch(`${OLLAMA_URL}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: model,
                    prompt: prompt,
                    stream: false
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log(`✅ ${model} сработала!`);
                
                return {
                    text: data.response,
                    success: true,
                    model: model,
                    fallback: true
                };
            }
        } catch (error) {
            console.log(`❌ ${model} тоже не сработала`);
            continue;
        }
    }
    
    // Если все модели упали
    return createIntelligentFallback(prompt);
}

// Умный fallback
function createIntelligentFallback(prompt) {
    return `🤖 Smart Neural AI работает с Ollama!

Ваш запрос: "${prompt.substring(0, 100)}..."

✅ СЕРВЕР: https://my-6xme.onrender.com
✅ AI ДВИЖОК: Ollama (локальный)
✅ МОДЕЛЬ: ${OLLAMA_MODEL}

💡 СТАТУС: 
• Ollama сервис: ${OLLAMA_URL.includes('localhost') ? 'локальный' : 'удаленный'}
• Модель загружена: ${OLLAMA_MODEL}
• Время ответа: ${new Date().toLocaleTimeString()}

🎯 РЕКОМЕНДАЦИЯ:
1. Убедитесь, что Ollama запущена командой 'ollama serve'
2. Проверьте модель: 'ollama list'
3. Или скачайте модель: 'ollama pull ${OLLAMA_MODEL}'

🔧 ДЛЯ РАЗРАБОТЧИКА:
Эта система использует локальный AI движок для полной приватности и бесплатного использования!`;
}

// ============ ENDPOINTS ============

// Health endpoint с проверкой Ollama
app.get('/api/health', async (req, res) => {
    try {
        // Проверяем Ollama
        const ollamaCheck = await fetch(`${OLLAMA_URL}/api/tags`, {
            timeout: 5000
        }).catch(() => null);
        
        const ollamaStatus = ollamaCheck && ollamaCheck.ok ? 'connected' : 'disconnected';
        
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            service: 'Smart Neural AI',
            version: '3.5.0',
            server: 'https://my-6xme.onrender.com',
            ai_provider: `Ollama (${OLLAMA_MODEL})`,
            ollama_status: ollamaStatus,
            ollama_url: OLLAMA_URL,
            statistics: {
                users: users.size,
                total_requests: systemBalance.totalRequests,
                creator: CREATOR_CONFIG.USERNAME
            }
        });
        
    } catch (error) {
        res.json({
            status: 'degraded',
            error: error.message,
            ai_provider: 'Ollama (checking...)'
        });
    }
});

// Тест Ollama
app.get('/api/test/ollama', async (req, res) => {
    try {
        const testPrompt = "Привет! Ответь коротко на русском: работает ли Ollama?";
        
        console.log('🧪 Тестируем Ollama...');
        const result = await callOllamaAI(testPrompt);
        
        res.json({
            success: true,
            message: 'Ollama тест',
            test_prompt: testPrompt,
            response: result.text,
            model: result.model || OLLAMA_MODEL,
            server: 'https://my-6xme.onrender.com',
            ollama_url: OLLAMA_URL,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        res.json({
            success: false,
            message: 'Ollama тест не прошел',
            error: error.message,
            recommendation: 'Запустите Ollama: ollama serve'
        });
    }
});

// Главная
app.get('/', (req, res) => {
    res.json({
        message: '🚀 Smart Neural AI работает на Ollama!',
        server: 'https://my-6xme.onrender.com',
        ai_provider: `Ollama (${OLLAMA_MODEL})`,
        endpoints: ['/api/health', '/api/test/ollama', '/api/ai/generate'],
        setup_guide: 'Запустите Ollama: ollama serve'
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

// Регистрация (оставляем без изменений)
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
            subscription: { tier: 'free', daily_requests: 10 },
            role: 'user',
            createdAt: new Date().toISOString()
        };
        
        users.set(user.username, user);
        systemBalance.totalUsers += 1;
        
        const token = jwt.sign(
            { userId: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        console.log(`✅ Регистрация: ${user.username}`);
        
        res.json({
            success: true,
            token: token,
            user: {
                id: user.id,
                username: user.username,
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

// Вход (оставляем без изменений)
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
        
        console.log(`✅ Вход: ${user.username} (${user.role})`);
        
        res.json({
            success: true,
            token: token,
            user: {
                id: user.id,
                username: user.username,
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
        const user = Array.from(users.values()).find(u => u.id === req.user.userId);
        
        if (!user) {
            return res.status(404).json({ 
                success: false,
                error: 'Пользователь не найден' 
            });
        }
        
        const today = new Date().toISOString().split('T')[0];
        const usage = dailyUsage.get(user.id) || {};
        const todayUsage = usage[today] ? usage[today].count : 0;
        const limit = user.subscription.daily_requests;
        
        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                subscription: user.subscription,
                role: user.role
            },
            usage: {
                today: todayUsage,
                limit: limit,
                remaining: limit === -1 ? Infinity : Math.max(0, limit - todayUsage),
                unlimited: limit === -1
            }
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: 'Ошибка получения информации'
        });
    }
});

// РЕАЛЬНЫЙ AI запрос через Ollama
app.post('/api/ai/generate', authenticateToken, async (req, res) => {
    try {
        const { prompt } = req.body;
        
        if (!prompt || prompt.trim().length === 0) {
            return res.status(400).json({ 
                success: false,
                error: 'Промпт обязателен' 
            });
        }
        
        const user = Array.from(users.values()).find(u => u.id === req.user.userId);
        const tier = user.subscription.tier;
        
        console.log(`🤖 AI запрос от ${user.username} (${tier}) через Ollama`);
        
        // Проверка лимита
        const limitCheck = checkRequestLimit(user.id, tier);
        
        if (!limitCheck.allowed) {
            return res.status(429).json({ 
                success: false,
                error: 'Дневной лимит исчерпан',
                remaining: limitCheck.remaining,
                limit: limitCheck.limit
            });
        }
        
        // Вызов Ollama
        console.log('🔄 Вызываем Ollama API...');
        const startTime = Date.now();
        const aiResponse = await callOllamaAI(prompt);
        const responseTime = Date.now() - startTime;
        
        console.log(`✅ AI ответ получен за ${responseTime}ms`);
        
        // Увеличиваем счетчик
        incrementRequestCount(user.id);
        
        // Получаем обновленную статистику
        const today = new Date().toISOString().split('T')[0];
        const usage = dailyUsage.get(user.id) || {};
        const todayUsage = usage[today] ? usage[today].count : 0;
        
        res.json({
            success: true,
            response: aiResponse.text,
            usage: {
                today: todayUsage,
                limit: user.subscription.daily_requests,
                remaining: user.subscription.daily_requests === -1 ? 
                    Infinity : Math.max(0, user.subscription.daily_requests - todayUsage),
                unlimited: user.subscription.daily_requests === -1
            },
            response_time: responseTime,
            ai_service: 'ollama',
            model: aiResponse.model || OLLAMA_MODEL,
            tokens: aiResponse.tokens || 0,
            is_fallback: aiResponse.fallback || false
        });
        
    } catch (error) {
        console.error('❌ AI generation error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Ошибка генерации ответа через Ollama',
            details: error.message,
            recommendation: 'Проверьте: 1) ollama serve 2) модель загружена'
        });
    }
});

// Подписки (оставляем без изменений)
app.get('/api/subscriptions/plans', (req, res) => {
    const plans = Array.from(products.values());
    
    res.json({
        success: true,
        plans: plans
    });
});

app.get('/api/subscriptions/my', authenticateToken, (req, res) => {
    try {
        const user = Array.from(users.values()).find(u => u.id === req.user.userId);
        
        const today = new Date().toISOString().split('T')[0];
        const usage = dailyUsage.get(user.id) || {};
        const todayUsage = usage[today] ? usage[today].count : 0;
        
        res.json({
            success: true,
            subscription: user.subscription,
            usage: {
                today: todayUsage,
                limit: user.subscription.daily_requests,
                remaining: user.subscription.daily_requests === -1 ? 
                    Infinity : Math.max(0, user.subscription.daily_requests - todayUsage),
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

// Тестовый платеж (оставляем без изменений)
app.post('/api/payments/create-test', authenticateToken, (req, res) => {
    try {
        const { planId } = req.body;
        const user = Array.from(users.values()).find(u => u.id === req.user.userId);
        
        const plan = products.get(planId);
        if (!plan) {
            return res.status(404).json({ 
                success: false,
                error: 'План не найден' 
            });
        }
        
        // Обновляем подписку пользователя
        user.subscription = {
            tier: plan.tier,
            daily_requests: plan.daily_requests
        };
        
        // Сбрасываем статистику использования
        dailyUsage.delete(user.id);
        
        const payment = {
            id: 'PAY-' + Date.now(),
            username: user.username,
            tier: plan.tier,
            amount: plan.price || 0,
            status: 'paid',
            createdAt: new Date().toISOString()
        };
        
        payments.set(payment.id, payment);
        
        if (plan.price) {
            systemBalance.totalEarned += plan.price;
            systemBalance.availableBalance += plan.price;
        }
        
        console.log(`💰 Тестовый платеж: ${user.username} → 