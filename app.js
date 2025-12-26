[file name]: app.js
const CONFIG = {
    API_URL: 'https://my-6xme.onrender.com'
};

// Супер простая проверка сервера
async function checkServer() {
    console.log('🔄 Проверка сервера...');
    
    try {
        const response = await fetch(CONFIG.API_URL + '/api/health');
        
        if (response.ok) {
            document.getElementById('status-indicator').innerHTML = 
                '<i class="fas fa-circle"></i> ✅ Сервер онлайн';
            document.getElementById('status-indicator').className = 
                'status-indicator status-online';
            console.log('✅ Сервер работает');
            return true;
        }
    } catch (error) {
        console.log('❌ Сервер недоступен');
    }
    
    document.getElementById('status-indicator').innerHTML = 
        '<i class="fas fa-circle"></i> ❌ Сервер оффлайн';
    document.getElementById('status-indicator').className = 
        'status-indicator status-offline';
    return false;
}

// Базовая инициализация
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Приложение запускается...');
    
    // Проверяем сервер сразу
    checkServer();
    
    // Включаем поля ввода
    document.getElementById('prompt-input').disabled = false;
    document.getElementById('send-prompt').disabled = false;
    
    // Добавляем тестовое сообщение
    const chat = document.getElementById('chat-messages');
    if (chat) {
        chat.innerHTML = `
            <div class="message system">
                <div class="avatar"><i class="fas fa-robot"></i></div>
                <div class="content">
                    <p>Привет! Сервер: ${CONFIG.API_URL}</p>
                    <p>👑 Создатель: alexey_creator / CreatorPass123!</p>
                    <p>👤 Тестовый: test_user / test123</p>
                </div>
            </div>
        `;
    }
    
    // Обработчики событий
    document.getElementById('refresh-status').addEventListener('click', checkServer);
    
    // Вход
    document.getElementById('login-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        
        try {
            const response = await fetch(CONFIG.API_URL + '/api/auth/login', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({username, password})
            });
            
            const data = await response.json();
            
            if (data.success) {
                alert('✅ Вход выполнен: ' + data.user.username);
                document.getElementById('user-info').classList.remove('hidden');
                document.getElementById('auth-forms').classList.add('hidden');
                document.getElementById('username').textContent = data.user.username;
            } else {
                alert('❌ Ошибка: ' + data.error);
            }
        } catch (error) {
            alert('❌ Ошибка подключения');
        }
    });
    
    // Отправка сообщения
    document.getElementById('send-prompt').addEventListener('click', async function() {
        const prompt = document.getElementById('prompt-input').value;
        if (!prompt) return;
        
        // Добавляем сообщение пользователя
        const chat = document.getElementById('chat-messages');
        chat.innerHTML += `
            <div class="message user">
                <div class="avatar"><i class="fas fa-user"></i></div>
                <div class="content"><p>${prompt}</p></div>
            </div>
        `;
        
        // Очищаем поле
        document.getElementById('prompt-input').value = '';
        
        // Получаем ответ
        try {
            const response = await fetch(CONFIG.API_URL + '/api/ai/generate', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({prompt})
            });
            
            const data = await response.json();
            
            if (data.success) {
                chat.innerHTML += `
                    <div class="message system">
                        <div class="avatar"><i class="fas fa-robot"></i></div>
                        <div class="content"><p>${data.response}</p></div>
                    </div>
                `;
            }
        } catch (error) {
            chat.innerHTML += `
                <div class="message system">
                    <div class="avatar"><i class="fas fa-robot"></i></div>
                    <div class="content"><p>❌ Ошибка подключения к серверу</p></div>
                </div>
            `;
        }
        
        // Прокрутка вниз
        chat.scrollTop = chat.scrollHeight;
    });
});