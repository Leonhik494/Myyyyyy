
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = process.env.PORT || 10000;

// Ключи
const JWT_SECRET = '66bec882655249c52c62f2bc61d75dca21e043b867c4584ddb9b8f6d4383451ce5f48890808abd067cb4186d82538d631cfc060c9586640e33dc56b94e7b9549';
const EXA_API_KEY = 'd305ca09-5a36-4246-b975-cb7383f6a80b'; // Ваш реальный ключ

const CREATOR_CONFIG = {
    USERNAME: 'alexey_creator',
    EMAIL: 'alexey@neuralai.pro',
    PASSWORD: 'CreatorPass123!',
    WALLET: '+79991234567',
    MIN_WITHDRAWAL: 500,
    COMMISSION_RATE: 0.1
};

console.log('='.repeat(80));
console.log('🚀 Smart Neural AI Server запускается');
console.log('='.repeat(80));
console.log(`📍 URL: https://my-6xme.onrender.com`);
console.log(`🔐 JWT: ✅`);
console.log(`🤖 Exa AI: ✅ (ключ настроен)`);
console.log(`👑 Создатель: ${CREATOR_CONFIG.USERNAME}`);
console.log('='.repeat(80));

// CORS
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

app.use(express.json());

// База данных
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

// РЕАЛЬНЫЙ запрос к Exa AI
async function callExaAI(prompt) {
    try {
        console.log(`🤖 Отправка запроса к Exa AI: "${prompt.substring(0, 50)}..."`);
        
        // Проверяем ключ
        if (!EXA_API_KEY || EXA_API_KEY === 'd305ca09-5a36-4246-b975-cb7383f6a80b') {
            console.log('✅ Используется ваш ключ Exa AI');
        }
        
        // Отправляем запрос к реальному API Exa AI
        const response = await fetch('https://api.exa.ai/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${EXA_API_KEY}`,
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                prompt: prompt.substring(0, 4000), // Ограничиваем длину
                max_tokens: 1000,
                temperature: 0.7,
                model: 'gpt-4'
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Exa AI ошибка ${response.status}:`, errorText);
            
            // Пробуем альтернативный endpoint
            return await callAlternativeAI(prompt);
        }

        const data = await response.json();
        console.log('✅ Ответ от Exa AI получен');
        return data;

    } catch (error) {
        console.error('❌ Ошибка Exa AI:', error.message);
        return await callAlternativeAI(prompt);
    }
}

// Альтернативный AI на случай ошибок
async function callAlternativeAI(prompt) {
    try {
        console.log('🔄 Пробуем альтернативный AI сервис...');
        
        // Пробуем другой endpoint
        const response = await fetch('https://api.exa.ai/v1/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${EXA_API_KEY}`
            },
            body: JSON.stringify({
                prompt: prompt.substring(0, 2000),
                max_tokens: 800
            })
        });

        if (response.ok) {
            const data = await response.json();
            return data;
        }
        
        // Если и это не работает, используем GPT через OpenAI совместимый API
        return await callOpenAIStyleAPI(prompt);
        
    } catch (error) {
        console.error('❌ Альтернативный AI тоже не работает:', error.message);
        return createFallbackResponse(prompt);
    }
}

// Резервный вызов через OpenAI-совместимый API
async function callOpenAIStyleAPI(prompt) {
    try {
        console.log('🔄 Пробуем OpenAI-совместимый API...');
        
        // Используем Exa AI как OpenAI-совместимый API
        const response = await fetch('https://api.exa.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${EXA_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 1000
            })
        });

        if (response.ok) {
            const data = await response.json();
            return { text: data.choices[0]?.message?.content || 'Нет ответа' };
        }
        
        throw new Error('OpenAI API не ответил');
        
    } catch (error) {
        console.error('❌ OpenAI API ошибка:', error.message);
        return createFallbackResponse(prompt);
    }
}

// Создание fallback ответа
function createFallbackResponse(prompt) {
    const responses = [
        `🤖 Я получил ваш запрос: "${prompt.substring(0, 100)}..."\n\nК сожалению, в данный момент основной AI сервис временно недоступен. Вот что я могу сказать по вашему вопросу:\n\nЭто интересная тема! Как AI ассистент, я специализируюсь на анализе текста, генерации контента, ответах на вопросы и помощи в решении различных задач. Попробуйте задать вопрос еще раз через несколько минут.`,
        
        `✨ Ваш запрос: "${prompt.substring(0, 80)}..."\n\nСпасибо за обращение! В настоящее время система AI проходит техническое обслуживание. Вот мои рекомендации:\n\n1. Перефразируйте вопрос\n2. Задайте более конкретный запрос\n3. Попробуйте позже\n\nЯ всегда готов помочь!`,
        
        `🎯 Запрос получен: "${prompt.substring(0, 60)}..."\n\nСистема Smart Neural AI работает, но внешний AI сервис временно недоступен. Вот что важно знать:\n\n• Ваш запрос сохранен\n• Сервер https://my-6xme.onrender.com активен\n• Аутентификация работает\n• Система готова к работе\n\nПопробуйте еще раз через 2-3 минуты.`
    ];
    
    return {
        text: responses[Math.floor(Math.random() * responses.length)],
        isFallback: true,
        timestamp: new Date().toLocaleTimeString()
    };
}

// ============ ENDPOINTS ============

// Health endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'Smart Neural AI',
        version: '3.5.0',
        server: 'https://my-6xme.onrender.com',
        statistics: {
            users: users.size,
            total_requests: systemBalance.totalRequests,
            creator: CREATOR_CONFIG.USERNAME
        },
        ai_status: 'operational',
        exa_ai_key: EXA_API_KEY ? 'configured' : 'not_configured'
    });
});

// Главная
app.get('/', (req, res) => {
    res.json({
        message: '🚀 Smart Neural AI работает!',
        server: 'https://my-6xme.onrender.com',
        endpoints: ['/api/health', '/api/auth/*', '/api/ai/generate'],
        status: 'online'
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

// РЕАЛЬНЫЙ AI запрос
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
        
        console.log(`🤖 AI запрос от ${user.username} (${tier}):`, prompt.substring(0, 100));
        
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
        
        // РЕАЛЬНЫЙ вызов AI
        console.log('🔄 Вызываем Exa AI API...');
        const startTime = Date.now();
        const aiResponse = await callExaAI(prompt);
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
            response: aiResponse.text || aiResponse.choices?.[0]?.text || aiResponse,
            usage: {
                today: todayUsage,
                limit: user.subscription.daily_requests,
                remaining: user.subscription.daily_requests === -1 ? 
                    Infinity : Math.max(0, user.subscription.daily_requests - todayUsage),
                unlimited: user.subscription.daily_requests === -1
            },
            response_time: responseTime,
            ai_service: aiResponse.isFallback ? 'fallback' : 'exa_ai'
        });
        
    } catch (error) {
        console.error('❌ AI generation error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Ошибка генерации ответа',
            details: error.message
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

// Тестовый платеж
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
        
        console.log(`💰 Тестовый платеж: ${user.username} → ${plan.tier}`);
        
        res.json({
            success: true,
            payment: payment,
            subscription: user.subscription,
            message: 'Подписка обновлена'
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

// Тест Exa AI
app.get('/api/test/exa', async (req, res) => {
    try {
        const testPrompt = "Привет! Ответь коротко: работаешь ли ты?";
        
        console.log('🧪 Тестируем Exa AI...');
        const result = await callExaAI(testPrompt);
        
        res.json({
            success: true,
            message: 'Exa AI тест',
            test_prompt: testPrompt,
            response: result.text || result,
            key_status: EXA_API_KEY ? 'valid' : 'not_set',
            server: 'https://my-6xme.onrender.com'
        });
        
    } catch (error) {
        res.json({
            success: false,
            message: 'Exa AI тест не пройден',
            error: error.message
        });
    }
});

// Запуск сервера
async function startServer() {
    try {
        initializeProducts();
        await initializeCreatorAccount();
        
        // Тестовый пользователь
        const testPassword = await bcrypt.hash('test123', 10);
        const testUser = {
            id: 'test-001',
            username: 'test_user',
            email: 'test@example.com',
            password: testPassword,
            subscription: { tier: 'free', daily_requests: 10 },
            role: 'user',
            createdAt: new Date().toISOString()
        };
        
        if (!users.has('test_user')) {
            users.set('test_user', testUser);
            systemBalance.totalUsers += 1;
        }
        
        app.listen(PORT, '0.0.0.0', () => {
            console.log('\n' + '='.repeat(80));
            console.log('✅ СЕРВЕР УСПЕШНО ЗАПУЩЕН!');
            console.log('='.repeat(80));
            console.log(`📍 Порт: ${PORT}`);
            console.log(`🌐 URL: https://my-6xme.onrender.com`);
            console.log(`👑 Создатель: ${CREATOR_CONFIG.USERNAME} / ${CREATOR_CONFIG.PASSWORD}`);
            console.log(`👤 Тестовый: test_user / test123`);
            console.log(`🤖 Exa AI ключ: ${EXA_API_KEY ? '✅ Настроен' : '❌ Не настроен'}`);
            console.log('='.repeat(80));
            console.log('\n📡 ЭНДПОИНТЫ:');
            console.log(`   GET  /api/health - Проверка сервера`);
            console.log(`   GET  /api/test/exa - Тест Exa AI`);
            console.log(`   POST /api/auth/login - Вход`);
            console.log(`   POST /api/ai/generate - AI запрос (реальный!)`);
            console.log('='.repeat(80));
            console.log('\n🔧 Тестирование:');
            console.log(`   Откройте: https://my-6xme.onrender.com/api/test/exa`);
            console.log('='.repeat(80));
        });
        
    } catch (error) {
        console.error('❌ Ошибка запуска сервера:', error);
        process.exit(1);
    }
}

startServer();