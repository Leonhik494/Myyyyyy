
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 10000;

// Разрешаем ВСЕ CORS запросы
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['*']
}));

app.use(express.json());

// Самый простой health endpoint
app.get('/api/health', (req, res) => {
    console.log('✅ Health check received');
    res.json({
        status: 'healthy',
        message: 'Smart Neural AI работает!',
        timestamp: new Date().toISOString(),
        server: 'https://my-6xme.onrender.com'
    });
});

// Главная страница
app.get('/', (req, res) => {
    res.json({
        message: '🚀 Smart Neural AI Server работает!',
        endpoints: {
            health: '/api/health',
            frontend: '/frontend.html'
        }
    });
});

// Тестовый эндпоинт
app.get('/api/test', (req, res) => {
    res.json({
        success: true,
        message: 'Тест пройден!'
    });
});

// Простая аутентификация
const users = {
    'alexey_creator': { password: 'CreatorPass123!', role: 'creator' },
    'test_user': { password: 'test123', role: 'user' }
};

app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!users[username] || users[username].password !== password) {
        return res.status(401).json({
            success: false,
            error: 'Неверные данные'
        });
    }
    
    res.json({
        success: true,
        token: 'demo-token-' + username,
        user: {
            username: username,
            role: users[username].role
        }
    });
});

// AI endpoint
app.post('/api/ai/generate', (req, res) => {
    const { prompt } = req.body;
    
    res.json({
        success: true,
        response: `🤖 AI ответ на: "${prompt}"
        
Это демо-ответ. Система работает!

Ваш запрос: ${prompt}
Время: ${new Date().toLocaleTimeString()}
Статус: ✅ Сервер подключен`,
        usage: {
            today: 1,
            limit: 10,
            remaining: 9
        }
    });
});

// Подписки
app.get('/api/subscriptions/plans', (req, res) => {
    res.json({
        success: true,
        plans: [
            {
                id: 'free',
                name: 'Бесплатный план',
                price_display: 'Бесплатно',
                features: ['10 запросов в день'],
                tier: 'free'
            },
            {
                id: 'pro',
                name: 'Pro подписка',
                price_display: '1000₽/месяц',
                features: ['250 запросов в день'],
                tier: 'pro'
            }
        ]
    });
});

// Статический файл фронтенда
app.get('/frontend.html', (req, res) => {
    res.sendFile('frontend.html', { root: '.' });
});

// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
    console.log('========================================');
    console.log('🚀 Сервер запущен!');
    console.log(`📍 Порт: ${PORT}`);
    console.log(`🌐 URL: https://my-6xme.onrender.com`);
    console.log('========================================');
    console.log('👑 Создатель: alexey_creator / CreatorPass123!');
    console.log('👤 Тестовый: test_user / test123');
    console.log('========================================');
});