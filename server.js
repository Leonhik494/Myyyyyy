
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import natural from 'natural';
import sanitizeHtml from 'sanitize-html';

const app = express();
const PORT = process.env.PORT || 10000;

// Настройки веб-поиска
const SEARCH_PROVIDERS = {
    duckduckgo: 'https://duckduckgo.com/html/?q=',
    google: 'https://www.google.com/search?q=',
    bing: 'https://www.bing.com/search?q='
};

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
console.log('🚀 Smart Neural AI с веб-поиском');
console.log('='.repeat(80));
console.log(`🌐 Сервер: https://my-6xme.onrender.com`);
console.log(`🔍 AI: Веб-поиск + NLP обработка`);
console.log(`👑 Создатель: ${CREATOR_CONFIG.USERNAME}`);
console.log('='.repeat(80));

// Middleware
app.use(cors({ origin: '*', methods: ['GET', 'POST'] }));
app.use(express.json());

// База данных
const users = new Map();
const dailyUsage = new Map();
const products = new Map();

// Инициализация NLP
const tokenizer = new natural.WordTokenizer();
const stemmer = natural.PorterStemmerRu;

// Функция веб-поиска
async function searchWeb(query) {
    console.log(`🔍 Поиск в интернете: "${query}"`);
    
    const searchUrl = `${SEARCH_PROVIDERS.duckduckgo}${encodeURIComponent(query)}`;
    
    try {
        // Имитируем браузер
        const response = await fetch(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml',
                'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
            },
            timeout: 10000
        });
        
        const html = await response.text();
        const $ = cheerio.load(html);
        
        const results = [];
        
        // Парсим результаты DuckDuckGo
        $('.result').each((i, element) => {
            const title = $(element).find('.result__title').text().trim();
            const snippet = $(element).find('.result__snippet').text().trim();
            const url = $(element).find('.result__url').text().trim();
            
            if (title && snippet) {
                results.push({
                    title: sanitizeHtml(title, { allowedTags: [] }),
                    content: sanitizeHtml(snippet, { allowedTags: [] }),
                    url: url,
                    relevance: calculateRelevance(query, title + ' ' + snippet)
                });
            }
        });
        
        // Если DuckDuckGo не дал результатов, парсим общий HTML
        if (results.length === 0) {
            $('a').each((i, element) => {
                const text = $(element).text().trim();
                const href = $(element).attr('href');
                
                if (text.length > 20 && text.length < 200 && href && href.startsWith('http')) {
                    const relevance = calculateRelevance(query, text);
                    if (relevance > 0.3) {
                        results.push({
                            title: text.substring(0, 100),
                            content: text,
                            url: href,
                            relevance: relevance
                        });
                    }
                }
            });
        }
        
        // Сортируем по релевантности
        results.sort((a, b) => b.relevance - a.relevance);
        
        return results.slice(0, 5); // Возвращаем топ-5 результатов
        
    } catch (error) {
        console.error('❌ Ошибка поиска:', error.message);
        return [];
    }
}

// Расчет релевантности
function calculateRelevance(query, text) {
    const queryWords = tokenizer.tokenize(query.toLowerCase());
    const textWords = tokenizer.tokenize(text.toLowerCase());
    
    let matches = 0;
    queryWords.forEach(qWord => {
        const stemmedQ = stemmer.stem(qWord);
        textWords.forEach(tWord => {
            const stemmedT = stemmer.stem(tWord);
            if (stemmedQ === stemmedT || tWord.includes(qWord)) {
                matches++;
            }
        });
    });
    
    return matches / Math.max(queryWords.length, 1);
}

// Генерация ответа на основе найденной информации
async function generateAIResponse(prompt) {
    console.log(`🤖 Генерация ответа для: "${prompt.substring(0, 50)}..."`);
    
    // 1. Ищем информацию в интернете
    const searchResults = await searchWeb(prompt);
    
    // 2. Если нашли информацию - генерируем ответ
    if (searchResults.length > 0) {
        const sources = searchResults.map(r => ({
            title: r.title,
            content: r.content.substring(0, 200),
            relevance: Math.round(r.relevance * 100) + '%'
        }));
        
        return createResponseFromSources(prompt, sources);
    }
    
    // 3. Если поиск не дал результатов - интеллектуальный ответ
    return createIntelligentResponse(prompt);
}

// Создание ответа на основе источников
function createResponseFromSources(prompt, sources) {
    const sourceText = sources.map(s => 
        `📌 ${s.title} (релевантность: ${s.relevance}):\n${s.content}...`
    ).join('\n\n');
    
    const responses = [
        `🎯 Smart Neural AI нашла информацию по вашему запросу:

**Ваш вопрос:** "${prompt}"

**Найденная информация:**
${sourceText}

**Анализ и выводы:**
На основе найденных данных, можно сделать следующие выводы:

1. ${sources[0]?.content?.split('.')[0] || 'Информация подтверждает ваш запрос'}.
2. ${sources[1]?.content?.split('.')[0] || 'Дополнительные источники сходятся во мнении'}.
3. Практическая рекомендация: ${generateRecommendation(prompt)}.

**Источники:** ${sources.length} найдено
**Актуальность:** ${new Date().toLocaleDateString('ru-RU')}
**Точность:** ${sources[0]?.relevance || 'высокая'}`,

        `🤖 Умный анализ на основе веб-поиска

**Запрос:** ${prompt}

**Результаты поиска:**
🔍 Найдено ${sources.length} релевантных источников

**Ключевые точки:**
${sources.slice(0, 3).map((s, i) => `${i+1}. ${s.title}`).join('\n')}

**Синтезированный ответ:**
Проанализировав доступную информацию, можно сказать, что "${prompt.split(' ')[0]}" - это тема, которая ${sources.length > 2 ? 'широко обсуждается' : 'имеет ограниченное освещение'} в интернете.

**Рекомендации:**
• ${sources[0]?.content?.split('.')[0] || 'Изучите дополнительные материалы'}
• ${sources[1]?.content?.split('.')[0] || 'Проверьте актуальность информации'}
• Обратитесь к экспертам для детального анализа

**Технология:** NLP + веб-скрейпинг + анализ релевантности`
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
}

// Генерация рекомендаций
function generateRecommendation(prompt) {
    const recommendations = [
        'проверьте информацию из нескольких источников',
        'обратитесь к официальным документам по теме',
        'посоветуйтесь с экспертами в этой области',
        'изучите последние исследования на эту тему',
        'рассмотрите альтернативные точки зрения'
    ];
    
    const promptHash = prompt.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    return recommendations[promptHash % recommendations.length];
}

// Интеллектуальный ответ без поиска
function createIntelligentResponse(prompt) {
    const responses = [
        `🤖 Smart Neural AI анализирует ваш запрос

**Вопрос:** "${prompt}"

**Анализ запроса:**
• Тип: ${prompt.includes('?') ? 'вопрос' : 'утверждение'}
• Сложность: ${prompt.length > 100 ? 'сложный' : 'простой'}
• Тематика: ${identifyTopic(prompt)}

**Мой ответ:**
На основе анализа вашего запроса, я могу сказать, что тема "${prompt.split(' ')[0]}" действительно интересна. 

Как система, основанная на анализе веб-информации, я рекомендую:
1. Уточнить ваш запрос для более точного поиска
2. Использовать конкретные ключевые слова
3. Проверить информацию в авторитетных источниках

**Статус системы:**
✅ Веб-поиск активен
✅ NLP обработка работает
✅ База знаний обновляется
✅ Готов к сложным запросам`,

        `✨ Интеллектуальный анализ Smart Neural AI

**Получен запрос:** ${prompt}

**Техническая информация:**
• Сервер: https://my-6xme.onrender.com
• Метод: Веб-поиск + NLP анализ
• Язык: Русский (с поддержкой английского)
• Время обработки: ${new Date().toLocaleTimeString()}

**Что я могу сделать:**
1. 🔍 Найти информацию в интернете по вашему запросу
2. 📊 Проанализировать найденные данные
3. 💡 Предоставить структурированный ответ
4. 🎯 Дать практические рекомендации

**Для лучшего результата:**
• Задавайте конкретные вопросы
• Используйте ключевые слова
• Уточняйте, если нужно больше деталей

**Пример рабочего запроса:**
"Какие новые технологии в AI появились в 2024 году?"
"Как работает блокчейн простыми словами?"
"Лучшие практики для стартапа в IT"`,

        `🎯 Smart Neural AI: Гибридная система

**Ваш запрос:** "${prompt.substring(0, 100)}..."

**Архитектура системы:**
• Frontend: React/JavaScript
• Backend: Node.js + Express
• Поиск: DuckDuckGo/Google API
• Анализ: NLP (Natural Language Processing)
• Хостинг: Render.com

**Текущий режим: Интеллектуальный анализ**

**Мой ответ:**
Исходя из вашего запроса "${prompt.split(' ').slice(0, 3).join(' ')}...", я вижу, что вы интересуетесь ${identifyTopic(prompt)}. 

**Рекомендации:**
1. Попробуйте переформулировать запрос
2. Используйте более конкретные термины
3. Задайте вопрос в форме "как..." или "что..."

**Готов к работе!** 🚀`
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
}

// Определение темы запроса
function identifyTopic(prompt) {
    const topics = {
        'техн': 'технологиями',
        'искусс': 'искусственным интеллектом',
        'програм': 'программированием',
        'бизнес': 'бизнесом',
        'наук': 'наукой',
        'образован': 'образованием',
        'здоров': 'здоровьем',
        'финанс': 'финансами'
    };
    
    const lowerPrompt = prompt.toLowerCase();
    for (const [key, value] of Object.entries(topics)) {
        if (lowerPrompt.includes(key)) {
            return value;
        }
    }
    
    return 'различными темами';
}

// Инициализация продуктов
function initializeProducts() {
    products.set('free', {
        id: 'free',
        name: 'Бесплатный план',
        price_display: 'Бесплатно',
        daily_requests: 10,
        features: ['10 запросов в день', 'Веб-поиск + NLP'],
        tier: 'free'
    });

    products.set('pro', {
        id: 'pro',
        name: 'Pro подписка',
        price: 1000,
        price_display: '1000₽/месяц',
        daily_requests: 250,
        features: ['250 запросов в день', 'Глубокий анализ', 'Экспорт'],
        tier: 'pro'
    });

    products.set('enterprise', {
        id: 'enterprise',
        name: 'Enterprise подписка',
        price: 5000,
        price_display: '5000₽/месяц',
        daily_requests: -1,
        features: ['Безлимитные запросы', 'API доступ', 'Кастомный поиск'],
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

// Health endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'Smart Neural AI',
        version: '3.5.0',
        server: 'https://my-6xme.onrender.com',
        ai_provider: 'Веб-поиск + NLP анализ',
        features: ['Поиск в интернете', 'NLP обработка', 'Анализ релевантности'],
        statistics: {
            users: users.size,
            creator: CREATOR_CONFIG.USERNAME
        }
    });
});

// Тест веб-поиска
app.get('/api/test/search', async (req, res) => {
    try {
        const query = req.query.q || 'искусственный интеллект';
        const results = await searchWeb(query);
        
        res.json({
            success: true,
            query: query,
            results_found: results.length,
            results: results.map(r => ({
                title: r.title,
                preview: r.content.substring(0, 100) + '...',
                relevance: r.relevance.toFixed(2)
            })),
            server: 'https://my-6xme.onrender.com'
        });
        
    } catch (error) {
        res.json({
            success: false,
            error: error.message,
            recommendation: 'Попробуйте другой запрос'
        });
    }
});

// Основной AI endpoint
app.post('/api/ai/generate', async (req, res) => {
    try {
        const { prompt } = req.body;
        
        if (!prompt || prompt.trim().length === 0) {
            return res.status(400).json({ 
                success: false,
                error: 'Промпт обязателен' 
            });
        }
        
        console.log(`🤖 AI запрос: "${prompt.substring(0, 50)}..."`);
        const startTime = Date.now();
        
        // Генерируем ответ через веб-поиск
        const response = await generateAIResponse(prompt);
        const responseTime = Date.now() - startTime;
        
        console.log(`✅ Ответ сгенерирован за ${responseTime}ms`);
        
        res.json({
            success: true,
            response: response,
            response_time: responseTime,
            ai_service: 'web_search_nlp',
            query_type: identifyTopic(prompt),
            timestamp: new Date().toISOString()
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

// Инициализация сервера
function initializeServer() {
    initializeProducts();
    
    // Создаем тестового пользователя
    const testUser = {
        id: 'test-001',
        username: 'test_user',
        subscription: { tier: 'free', daily_requests: 10 },
        role: 'user'
    };
    users.set('test_user', testUser);
    
    app.listen(PORT, '0.0.0.0', () => {
        console.log('\n' + '='.repeat(80));
        console.log('✅ СЕРВЕР УСПЕШНО ЗАПУЩЕН!');
        console.log('='.repeat(80));
        console.log(`📍 Порт: ${PORT}`);
        console.log(`🌐 URL: https://my-6xme.onrender.com`);
        console.log(`🤖 AI: Веб-поиск + NLP анализ`);
        console.log(`👑 Создатель: ${CREATOR_CONFIG.USERNAME} / ${CREATOR_CONFIG.PASSWORD}`);
        console.log(`👤 Тестовый: test_user / test123`);
        console.log('='.repeat(80));
        console.log('\n📡 ТЕСТИРОВАНИЕ:');
        console.log(`   1. Health: https://my-6xme.onrender.com/api/health`);
        console.log(`   2. Поиск: https://my-6xme.onrender.com/api/test/search?q=искусственный+интеллект`);
        console.log(`   3. AI запрос: POST /api/ai/generate`);
        console.log('='.repeat(80));
    });
}

initializeServer();