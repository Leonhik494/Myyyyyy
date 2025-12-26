
const CONFIG = {
    API_URL: 'https://my-6xme.onrender.com',
    
    CREATOR: {
        USERNAME: 'alexey_creator',
        MIN_WITHDRAWAL: 500
    },
    
    state: {
        isAuthenticated: false,
        user: null,
        token: localStorage.getItem('neural_token') || null,
        serverStatus: 'checking',
        subscription: null,
        usage: { today: 0, limit: 10, remaining: 10, unlimited: false },
        plans: [],
        chatHistory: []
    }
};

// ============ ИНИЦИАЛИЗАЦИЯ ============

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Smart Neural AI запускается...');
    console.log(`🌐 Сервер: ${CONFIG.API_URL}`);
    
    // Проверка сервера
    await checkServerStatus();
    
    // Проверка Exa AI
    await testExaAI();
    
    if (CONFIG.state.token) {
        await checkAuthentication();
    }
    
    await loadSubscriptionPlans();
    
    initUI();
    initEventListeners();
    
    console.log('✅ Приложение готово');
});

// ============ ПРОВЕРКА СЕРВЕРА ============

async function checkServerStatus() {
    try {
        console.log('🔍 Проверяем сервер...');
        
        const response = await fetch(`${CONFIG.API_URL}/api/health`, {
            method: 'GET',
            headers: { 
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Сервер онлайн:', data);
            CONFIG.state.serverStatus = 'online';
            
            const statusEl = document.getElementById('status-indicator');
            if (statusEl) {
                statusEl.innerHTML = `<i class="fas fa-circle"></i> Сервер онлайн`;
                statusEl.className = 'status-indicator status-online';
            }
            
            showNotification('✅ Сервер подключен', 'success');
            return true;
        } else {
            CONFIG.state.serverStatus = 'offline';
            showNotification('⚠️ Сервер недоступен', 'warning');
            return false;
        }
    } catch (error) {
        console.error('❌ Ошибка подключения:', error);
        CONFIG.state.serverStatus = 'offline';
        
        const statusEl = document.getElementById('status-indicator');
        if (statusEl) {
            statusEl.innerHTML = `<i class="fas fa-circle"></i> Сервер оффлайн`;
            statusEl.className = 'status-indicator status-offline';
        }
        return false;
    }
}

// ============ ТЕСТ EXA AI ============

async function testExaAI() {
    try {
        console.log('🤖 Тестируем Exa AI...');
        
        const response = await fetch(`${CONFIG.API_URL}/api/test/exa`);
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Exa AI тест:', data);
            
            if (data.success) {
                console.log('🎯 Exa AI работает!');
                
                // Показываем статус в чате
                const chat = document.getElementById('chat-messages');
                if (chat) {
                    const aiStatus = document.createElement('div');
                    aiStatus.className = 'message system';
                    aiStatus.innerHTML = `
                        <div class="avatar" style="background: #10b981">
                            <i class="fas fa-check-circle"></i>
                        </div>
                        <div class="content">
                            <p><strong>✅ Exa AI подключен и готов к работе!</strong></p>
                            <p>Тестовый ответ: "${data.response.substring(0, 100)}..."</p>
                            <small>Сервер: ${CONFIG.API_URL}</small>
                        </div>
                    `;
                    chat.appendChild(aiStatus);
                }
            } else {
                console.warn('⚠️ Exa AI не отвечает правильно');
            }
        }
    } catch (error) {
        console.warn('⚠️ Exa AI тест не прошел:', error);
    }
}

// ============ АУТЕНТИФИКАЦИЯ ============

async function checkAuthentication() {
    if (!CONFIG.state.token) return;
    
    try {
        const response = await fetch(`${CONFIG.API_URL}/api/auth/me`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${CONFIG.state.token}`,
                'Accept': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            CONFIG.state.isAuthenticated = true;
            CONFIG.state.user = data.user;
            CONFIG.state.usage = data.usage || CONFIG.state.usage;
            
            updateAuthUI();
            loadSubscriptionInfo();
            updateUsageUI();
            
            if (data.user.role === 'creator') {
                showCreatorFeatures();
            }
        }
    } catch (error) {
        console.error('Auth check error:', error);
        CONFIG.state.isAuthenticated = false;
    }
}

async function registerUser(username, email, password) {
    try {
        showNotification('Регистрируем...', 'info');
        
        const response = await fetch(`${CONFIG.API_URL}/api/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, password })
        });
        
        const data = await response.json();
        
        if (data.success && data.token) {
            localStorage.setItem('neural_token', data.token);
            CONFIG.state.token = data.token;
            CONFIG.state.isAuthenticated = true;
            CONFIG.state.user = data.user;
            
            showNotification('✅ Регистрация успешна!', 'success');
            updateAuthUI();
            updateUsageUI();
            switchSection('chat');
        } else {
            showNotification(data.error || 'Ошибка регистрации', 'error');
        }
    } catch (error) {
        showNotification('❌ Ошибка регистрации', 'error');
    }
}

async function loginUser(username, password) {
    try {
        showNotification('Входим...', 'info');
        
        const response = await fetch(`${CONFIG.API_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success && data.token) {
            localStorage.setItem('neural_token', data.token);
            CONFIG.state.token = data.token;
            CONFIG.state.isAuthenticated = true;
            CONFIG.state.user = data.user;
            
            showNotification(`✅ Добро пожаловать, ${data.user.username}!`, 'success');
            updateAuthUI();
            loadSubscriptionInfo();
            updateUsageUI();
            
            if (data.user.role === 'creator') {
                showCreatorFeatures();
            }
            
            switchSection('chat');
        } else {
            showNotification(data.error || 'Ошибка входа', 'error');
        }
    } catch (error) {
        showNotification('❌ Ошибка входа', 'error');
    }
}

function logoutUser() {
    localStorage.removeItem('neural_token');
    CONFIG.state.token = null;
    CONFIG.state.isAuthenticated = false;
    CONFIG.state.user = null;
    CONFIG.state.usage = { today: 0, limit: 10, remaining: 10, unlimited: false };
    
    showNotification('Вы вышли из системы', 'info');
    updateAuthUI();
    clearChat();
    hideCreatorFeatures();
    switchSection('chat');
}

// ============ ПОДПИСКИ ============

async function loadSubscriptionPlans() {
    try {
        const response = await fetch(`${CONFIG.API_URL}/api/subscriptions/plans`);
        if (response.ok) {
            const data = await response.json();
            CONFIG.state.plans = data.plans;
            updatePlansUI();
        }
    } catch (error) {
        console.error('Error loading plans:', error);
    }
}

async function loadSubscriptionInfo() {
    if (!CONFIG.state.isAuthenticated) return;
    
    try {
        const response = await fetch(`${CONFIG.API_URL}/api/subscriptions/my`, {
            headers: {
                'Authorization': `Bearer ${CONFIG.state.token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            CONFIG.state.subscription = data.subscription;
            CONFIG.state.usage = data.usage || CONFIG.state.usage;
            
            updateSubscriptionUI();
            updateUsageUI();
        }
    } catch (error) {
        console.error('Error loading subscription:', error);
    }
}

// ============ AI ЗАПРОС ============

async function sendAIRequest(prompt) {
    if (!CONFIG.state.isAuthenticated) {
        showNotification('Войдите в систему для использования AI', 'warning');
        return;
    }
    
    if (CONFIG.state.usage.remaining <= 0 && !CONFIG.state.usage.unlimited) {
        showNotification('Дневной лимит запросов исчерпан!', 'error');
        return;
    }
    
    try {
        addMessageToChat(prompt, 'user');
        showNotification('🤖 Генерируем ответ через Exa AI...', 'info');
        
        console.log('🔄 Отправляем запрос к Exa AI...');
        const response = await fetch(`${CONFIG.API_URL}/api/ai/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CONFIG.state.token}`
            },
            body: JSON.stringify({ prompt })
        });
        
        const data = await response.json();
        console.log('📥 Ответ от сервера:', data);
        
        if (data.success) {
            const aiResponse = data.response;
            
            // Форматируем ответ
            let formattedResponse = aiResponse;
            if (typeof aiResponse === 'string') {
                formattedResponse = aiResponse
                    .replace(/\\n/g, '\n')
                    .replace(/\\"/g, '"');
            }
            
            addMessageToChat(formattedResponse, 'system');
            
            if (data.usage) {
                CONFIG.state.usage = data.usage;
                updateUsageUI();
            }
            
            showNotification(`✅ Ответ получен! (${data.response_time || 0}ms)`, 'success');
            
            CONFIG.state.chatHistory.push({
                prompt,
                response: formattedResponse,
                timestamp: new Date().toISOString(),
                tier: CONFIG.state.subscription?.tier || 'free'
            });
            
        } else if (response.status === 429) {
            showNotification('Дневной лимит запросов исчерпан', 'error');
            addMessageToChat('⚠️ Дневной лимит запросов исчерпан.', 'system');
        } else {
            showNotification(data.error || 'Ошибка генерации', 'error');
            addMessageToChat(`❌ Ошибка: ${data.error || 'Неизвестная ошибка'}`, 'system');
        }
    } catch (error) {
        console.error('AI request error:', error);
        showNotification('❌ Ошибка подключения к AI', 'error');
        addMessageToChat('❌ Ошибка подключения к AI сервису. Попробуйте позже.', 'system');
    }
}

// ============ UI ФУНКЦИИ ============

function updateAuthUI() {
    const userInfo = document.getElementById('user-info');
    const authForms = document.getElementById('auth-forms');
    const usernameElement = document.getElementById('username');
    const userRoleElement = document.getElementById('user-role');
    const promptInput = document.getElementById('prompt-input');
    const sendButton = document.getElementById('send-prompt');
    
    if (CONFIG.state.isAuthenticated && CONFIG.state.user) {
        userInfo.classList.remove('hidden');
        authForms.classList.add('hidden');
        
        usernameElement.textContent = CONFIG.state.user.username;
        
        if (userRoleElement) {
            if (CONFIG.state.user.role === 'creator') {
                userRoleElement.innerHTML = '<span class="creator-badge"><i class="fas fa-crown"></i> СОЗДАТЕЛЬ</span>';
                userRoleElement.classList.remove('hidden');
            } else {
                userRoleElement.classList.add('hidden');
            }
        }
        
        if (promptInput) promptInput.disabled = false;
        if (sendButton) sendButton.disabled = false;
        
    } else {
        userInfo.classList.add('hidden');
        authForms.classList.remove('hidden');
        if (promptInput) promptInput.disabled = true;
        if (sendButton) sendButton.disabled = true;
    }
}

function updateSubscriptionUI() {
    const subscriptionInfo = document.getElementById('current-subscription');
    if (!subscriptionInfo) return;
    
    const tier = CONFIG.state.subscription?.tier || 'free';
    const infoElement = subscriptionInfo.querySelector('.subscription-info');
    
    let planName = 'Бесплатный';
    let requests = '10 запросов/день';
    
    if (tier === 'pro') {
        planName = 'Pro подписка';
        requests = '250 запросов/день';
    } else if (tier === 'enterprise') {
        planName = 'Enterprise подписка';
        requests = 'Безлимитные запросы';
    }
    
    infoElement.innerHTML = `
        <div class="subscription-details">
            <div class="detail"><strong>Тариф:</strong> ${planName}</div>
            <div class="detail"><strong>Лимит:</strong> ${requests}</div>
            <div class="detail"><strong>Статус:</strong> Активен</div>
        </div>
    `;
}

function updateUsageUI() {
    const usedElement = document.getElementById('daily-used');
    const totalElement = document.getElementById('total-requests');
    const remainingElement = document.getElementById('remaining-requests');
    const progressFill = document.getElementById('progress-fill');
    
    if (!usedElement || !totalElement || !progressFill) return;
    
    const used = CONFIG.state.usage.today || 0;
    const limit = CONFIG.state.usage.limit || 10;
    const remaining = CONFIG.state.usage.remaining || (limit - used);
    const percentage = Math.min(100, (used / limit) * 100);
    
    usedElement.textContent = used;
    totalElement.textContent = limit === -1 ? '∞' : limit;
    remainingElement.textContent = limit === -1 ? '∞' : remaining;
    progressFill.style.width = `${percentage}%`;
    
    // Меняем цвет прогресса
    if (percentage > 80) {
        progressFill.style.backgroundColor = '#f39c12';
    } else if (percentage > 95) {
        progressFill.style.backgroundColor = '#e74c3c';
    } else {
        progressFill.style.backgroundColor = '#2ecc71';
    }
}

function updatePlansUI() {
    const plansContainer = document.querySelector('.plans-container');
    if (!plansContainer) return;
    
    if (!CONFIG.state.plans.length) {
        plansContainer.innerHTML = `
            <div class="loading-plans">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Загрузка тарифных планов...</p>
            </div>
        `;
        return;
    }
    
    plansContainer.innerHTML = CONFIG.state.plans.map(plan => `
        <div class="plan-card ${plan.tier === 'pro' ? 'popular' : ''}">
            ${plan.tier === 'pro' ? '<div class="popular-badge">ПОПУЛЯРНЫЙ</div>' : ''}
            <div class="plan-header">
                <h3>${plan.name}</h3>
                <div class="plan-price">${plan.price_display}</div>
            </div>
            <div class="plan-features">
                ${plan.features.map(feature => `
                    <div class="feature">
                        <i class="fas fa-check"></i>
                        <span>${feature}</span>
                    </div>
                `).join('')}
            </div>
            ${plan.tier === 'free' ? `
                <button class="btn btn-outline" disabled>Текущий план</button>
            ` : `
                <button class="btn btn-primary test-payment-btn" data-plan-id="${plan.id}">
                    <i class="fas fa-credit-card"></i> Тестовый платеж
                </button>
            `}
        </div>
    `).join('');
}

function addMessageToChat(message, type = 'system') {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    
    const messageElement = document.createElement('div');
    messageElement.className = `message ${type}`;
    
    const avatarIcon = type === 'user' ? 'fas fa-user' : 'fas fa-robot';
    const avatarColor = type === 'user' ? '#3498db' : '#9b59b6';
    
    messageElement.innerHTML = `
        <div class="avatar" style="background: ${avatarColor}">
            <i class="${avatarIcon}"></i>
        </div>
        <div class="content">
            <p>${escapeHtml(message)}</p>
            <small>${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</small>
        </div>
    `;
    
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function clearChat() {
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages) {
        chatMessages.innerHTML = `
            <div class="message system">
                <div class="avatar"><i class="fas fa-robot"></i></div>
                <div class="content">
                    <p>Чат очищен. Задайте мне вопрос!</p>
                    <p><strong>Сервер:</strong> ${CONFIG.API_URL}</p>
                    <p><strong>AI:</strong> Exa AI подключен</p>
                </div>
            </div>
        `;
        CONFIG.state.chatHistory = [];
    }
}

function switchSection(sectionId) {
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const targetSection = document.getElementById(`${sectionId}-section`);
    const targetButton = document.querySelector(`.nav-btn[data-section="${sectionId}"]`);
    
    if (targetSection) targetSection.classList.add('active');
    if (targetButton) targetButton.classList.add('active');
}

function showCreatorFeatures() {
    const navMenu = document.querySelector('.nav-menu');
    if (navMenu && !document.getElementById('admin-nav-btn')) {
        const adminBtn = document.createElement('button');
        adminBtn.id = 'admin-nav-btn';
        adminBtn.className = 'nav-btn';
        adminBtn.setAttribute('data-section', 'admin');
        adminBtn.innerHTML = '<i class="fas fa-crown"></i> Панель создателя';
        navMenu.appendChild(adminBtn);
    }
}

function hideCreatorFeatures() {
    const adminBtn = document.getElementById('admin-nav-btn');
    if (adminBtn) adminBtn.remove();
}

function showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container');
    if (!container) return;
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    
    container.appendChild(notification);
    
    setTimeout(() => notification.remove(), 3000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============ ИНИЦИАЛИЗАЦИЯ UI ============

function initUI() {
    // Счетчик символов
    const promptInput = document.getElementById('prompt-input');
    const charCount = document.getElementById('char-count');
    
    if (promptInput && charCount) {
        promptInput.addEventListener('input', () => {
            charCount.textContent = promptInput.value.length;
        });
    }
    
    // Инициализация чата
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages) {
        chatMessages.innerHTML = `
            <div class="message system">
                <div class="avatar"><i class="fas fa-robot"></i></div>
                <div class="content">
                    <p>🤖 <strong>Smart Neural AI v3.5</strong></p>
                    <p>Сервер: ${CONFIG.API_URL}</p>
                    <p>AI: Exa AI (GPT-4)</p>
                    <p>👑 Создатель: alexey_creator / CreatorPass123!</p>
                    <p>👤 Тестовый: test_user / test123</p>
                    <small>Отправьте запрос для тестирования AI</small>
                </div>
            </div>
        `;
    }
}

// ============ ОБРАБОТЧИКИ СОБЫТИЙ ============

function initEventListeners() {
    // Проверка статуса
    const refreshBtn = document.getElementById('refresh-status');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', checkServerStatus);
    }
    
    // Переключение табов авторизации
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
            const form = document.getElementById(`${tab}-form`);
            if (form) form.classList.add('active');
        });
    });
    
    // Регистрация
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('register-username').value.trim();
            const email = document.getElementById('register-email').value.trim();
            const password = document.getElementById('register-password').value;
            
            if (password.length < 6) {
                showNotification('Пароль от 6 символов', 'error');
                return;
            }
            
            await registerUser(username, email, password);
        });
    }
    
    // Вход
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('login-username').value.trim();
            const password = document.getElementById('login-password').value;
            
            await loginUser(username, password);
        });
    }
    
    // Выход
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logoutUser);
    }
    
    // Отправка промпта
    const sendBtn = document.getElementById('send-prompt');
    if (sendBtn) {
        sendBtn.addEventListener('click', () => {
            const promptInput = document.getElementById('prompt-input');
            if (promptInput) {
                const prompt = promptInput.value.trim();
                if (prompt) {
                    sendAIRequest(prompt);
                    promptInput.value = '';
                    const charCount = document.getElementById('char-count');
                    if (charCount) charCount.textContent = '0';
                }
            }
        });
    }
    
    // Enter для отправки
    const promptInput = document.getElementById('prompt-input');
    if (promptInput) {
        promptInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const sendBtn = document.getElementById('send-prompt');
                if (sendBtn) sendBtn.click();
            }
        });
    }
    
    // Очистка чата
    const clearBtn = document.getElementById('clear-chat');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearChat);
    }
    
    // Навигация
    document.addEventListener('click', (e) => {
        if (e.target.closest('.nav-btn')) {
            const btn = e.target.closest('.nav-btn');
            const section = btn.dataset.section;
            if (section) switchSection(section);
        }
    });
    
    // Тестовые платежи
    document.addEventListener('click', async (e) => {
        if (e.target.closest('.test-payment-btn')) {
            const planId = e.target.closest('.test-payment-btn').dataset.planId;
            if (planId && CONFIG.state.user?.role === 'creator') {
                try {
                    showNotification('Обрабатываем тестовый платеж...', 'info');
                    
                    const response = await fetch(`${CONFIG.API_URL}/api/payments/create-test`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${CONFIG.state.token}`
                        },
                        body: JSON.stringify({ planId })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        showNotification('✅ Тестовый платеж успешен!', 'success');
                        loadSubscriptionInfo();
                    } else {
                        showNotification(data.error || 'Ошибка платежа', 'error');
                    }
                } catch (error) {
                    showNotification('❌ Ошибка платежа', 'error');
                }
            } else if (!CONFIG.state.isAuthenticated) {
                showNotification('Войдите в систему для оплаты', 'warning');
            }
        }
    });
}

console.log('✅ Smart Neural AI frontend загружен');