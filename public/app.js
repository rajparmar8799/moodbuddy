// Mood Buddy App JavaScript
class MoodBuddyApp {
    constructor() {
        this.currentUser = null;
        this.currentPage = 'dashboard';
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkAuth();
        this.requestNotificationPermission();
        this.loadTheme();
        this.initializeCalendar();
        this.loadDailyQuote();
        this.loadChallenges();
        this.initializeBadges();
        this.initializeThemeToggle();
        this.initializeProfileEditing();
    }

    bindEvents() {
        // Auth tabs
        document.getElementById('login-tab').addEventListener('click', () => this.switchAuthTab('login'));
        document.getElementById('signup-tab').addEventListener('click', () => this.switchAuthTab('signup'));


        // Auth forms
        document.getElementById('login-form').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('signup-form').addEventListener('submit', (e) => this.handleSignup(e));

        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                if (e.target.id === 'logout-btn') {
                    this.logout();
                } else {
                    this.switchPage(e.target.dataset.page);
                }
            });
        });

        // Mobile menu toggle
        this.initMobileMenu();

        // Mood logging
        document.querySelectorAll('.mood-option').forEach(option => {
            option.addEventListener('click', () => this.selectMood(option));
        });
        document.getElementById('save-mood-btn').addEventListener('click', () => this.saveMood());

        // Suggestions
        document.getElementById('refresh-suggestions-btn').addEventListener('click', () => this.getSuggestions());

        // Chat/Assistant
        document.getElementById('send-message-btn').addEventListener('click', () => this.sendMessage());
        document.getElementById('chat-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Profile dropdown
        document.getElementById('user-profile-btn').addEventListener('click', () => this.toggleProfileDropdown());
        document.getElementById('view-profile-btn').addEventListener('click', () => this.viewProfile());
        document.getElementById('dropdown-logout-btn').addEventListener('click', () => this.logout());

        // Avatar upload
        this.initAvatarUpload();

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            const profileBtn = document.getElementById('user-profile-btn');
            const dropdown = document.getElementById('profile-dropdown');
            if (!profileBtn.contains(e.target)) {
                dropdown.classList.remove('show');
            }
        });

        // Handle window resize for responsive behavior
        window.addEventListener('resize', () => this.handleResize());
    }

    switchAuthTab(tab) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));

        document.getElementById(`${tab}-tab`).classList.add('active');
        document.getElementById(`${tab}-form`).classList.add('active');
    }

    async handleLogin(e) {
        e.preventDefault();
        console.log('🔐 Attempting login...');

        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        if (!email || !password) {
            this.showToast('Please fill in all fields', 'error');
            return;
        }

        try {
            console.log('📡 Making login API call...');
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            console.log('📡 Login response status:', response.status);
            const data = await response.json();
            console.log('📡 Login response data:', data);

            if (response.ok) {
                console.log('✅ Login successful, setting user data');
                this.currentUser = data.user;
                localStorage.setItem('currentUser', JSON.stringify(data.user));
                this.showMainApp();
                this.showToast('Welcome back!', 'success');
                this.loadDashboard();
                console.log('✅ Login flow completed');
            } else {
                console.log('❌ Login failed:', data.error);
                this.showToast(data.error || 'Login failed', 'error');
            }
        } catch (error) {
            console.error('❌ Login error:', error);
            this.showToast('Network error. Please try again.', 'error');
        }
    }

    async handleSignup(e) {
        e.preventDefault();
        console.log('👤 Attempting signup...');

        const username = document.getElementById('signup-username').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;

        if (!username || !email || !password) {
            this.showToast('Please fill in all fields', 'error');
            return;
        }

        if (password.length < 6) {
            this.showToast('Password must be at least 6 characters', 'error');
            return;
        }

        try {
            console.log('📡 Making signup API call...');
            const response = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });

            console.log('📡 Signup response status:', response.status);
            const data = await response.json();
            console.log('📡 Signup response data:', data);

            if (response.ok) {
                console.log('✅ Signup successful');
                this.showToast('Account created successfully! Please login.', 'success');
                this.switchAuthTab('login');
            } else {
                console.log('❌ Signup failed:', data.error);
                this.showToast(data.error || 'Signup failed', 'error');
            }
        } catch (error) {
            console.error('❌ Signup error:', error);
            this.showToast('Network error. Please try again.', 'error');
        }
    }

    checkAuth() {
        const user = localStorage.getItem('currentUser');
        if (user) {
            this.currentUser = JSON.parse(user);
            this.showMainApp();
            this.loadDashboard();
        }
    }

    showMainApp() {
        document.getElementById('auth-screen').classList.remove('active');
        document.getElementById('main-screen').classList.add('active');

        // Handle mobile/desktop sidebar behavior
        this.handleResize();

        // Update user profile in top nav
        if (this.currentUser) {
            document.getElementById('user-display-name').textContent = this.currentUser.username;

            // Update top nav avatar
            this.updateTopNavAvatar();
        }
    }

    updateTopNavAvatar() {
        const topNavAvatar = document.querySelector('.user-avatar');
        const savedAvatar = localStorage.getItem(`avatar_${this.currentUser.id}`);
        if (savedAvatar) {
            topNavAvatar.innerHTML = `<img src="${savedAvatar}" alt="Avatar" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
        } else {
            topNavAvatar.innerHTML = '<i class="fas fa-user"></i>';
        }
    }

    switchPage(page) {
        console.log(`📄 Switching to page: ${page}`);

        // Validate page parameter
        if (!page || typeof page !== 'string') {
            console.error('❌ Invalid page parameter:', page);
            this.showToast('Invalid page requested', 'error');
            return;
        }

        // Hide all pages first
        document.querySelectorAll('.page').forEach(p => {
            p.classList.remove('active');
            p.style.display = 'none';
        });

        // Remove active state from all nav links
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

        // Show the target page
        const targetPage = document.getElementById(`${page}-page`);
        if (targetPage) {
            targetPage.classList.add('active');
            targetPage.style.display = 'block';
            console.log(`✅ Page ${page} activated`);
        } else {
            console.error(`❌ Page ${page} not found`);
            this.showToast(`Page "${page}" not found`, 'error');
            return;
        }

        // Activate the corresponding nav link
        const targetLink = document.querySelector(`[data-page="${page}"]`);
        if (targetLink) {
            targetLink.classList.add('active');
        }

        this.currentPage = page;

        // Load page-specific data
        if (page === 'dashboard') {
            this.loadDashboard();
        } else if (page === 'suggestions') {
            this.getSuggestions();
        } else if (page === 'assistant') {
            this.loadChatHistory();
        } else if (page === 'profile') {
            this.viewProfile();
        }

        // Close mobile sidebar after navigation
        if (this.closeMobileSidebar) {
            this.closeMobileSidebar();
        }
    }

    async loadDashboard() {
        console.log('📊 Loading dashboard for user:', this.currentUser?.id);

        if (!this.currentUser) {
            console.log('❌ No current user, skipping dashboard load');
            return;
        }

        try {
            console.log('📡 Fetching dashboard data...');
            const response = await fetch(`/api/dashboard/${this.currentUser.id}`);
            console.log('📡 Dashboard response status:', response.status);

            const data = await response.json();
            console.log('📡 Dashboard response data:', data);

            if (response.ok) {
                console.log('✅ Dashboard data loaded successfully');
                document.getElementById('total-entries').textContent = data.totalEntries || 0;
                document.getElementById('current-streak').textContent = data.currentStreak || 0;
                document.getElementById('average-mood').textContent = data.averageMood || '0.0';

                this.renderMoodChart(data.moodTrends || {});
                this.renderRecentMoods();
                console.log('✅ Dashboard rendering completed');
            } else {
                console.log('❌ Dashboard load failed:', data.error);
                this.showToast('Failed to load dashboard data', 'error');
            }
        } catch (error) {
            console.error('❌ Dashboard load error:', error);
            this.showToast('Network error loading dashboard', 'error');
        }
    }

    renderMoodChart(moodTrends) {
        const ctx = document.getElementById('mood-chart');

        // Destroy existing chart if it exists
        if (this.moodChart) {
            this.moodChart.destroy();
        }

        // Convert mood emojis to numerical values
        const moodValues = { '😢': 1, '😟': 2, '😐': 3, '😊': 4, '😁': 5 };
        const dates = Object.keys(moodTrends).sort();
        const values = dates.map(date => moodValues[moodTrends[date]] || 3);

        this.moodChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Mood Level',
                    data: values,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 5,
                        ticks: {
                            callback: function(value) {
                                const moods = ['', '😢', '😟', '😐', '😊', '😁'];
                                return moods[value] || '';
                            }
                        }
                    }
                }
            }
        });
    }

    async renderRecentMoods() {
        console.log('📝 Rendering recent moods for user:', this.currentUser?.id);

        if (!this.currentUser) {
            console.log('❌ No current user, skipping recent moods render');
            return;
        }

        try {
            console.log('📡 Fetching recent moods...');
            const response = await fetch(`/api/moods/${this.currentUser.id}`);
            console.log('📡 Recent moods response status:', response.status);

            const moods = await response.json();
            console.log('📡 Recent moods data:', moods);

            const recentMoods = moods.slice(-5).reverse();
            console.log('📝 Recent moods to display:', recentMoods.length);

            const container = document.getElementById('recent-moods-list');

            if (recentMoods.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">
                            <i class="fas fa-plus-circle"></i>
                        </div>
                        <h4>Start Your Journey</h4>
                        <p>Log your first mood to see your emotional patterns emerge</p>
                    </div>
                `;
                console.log('📝 No moods found, showing empty state');
            } else {
                container.innerHTML = recentMoods.map(mood => `
                    <div class="mood-item">
                        <div class="mood-emoji">${mood.mood}</div>
                        <div class="mood-info">
                            <div class="mood-date">${new Date(mood.date).toLocaleDateString()}</div>
                            ${mood.note ? `<div class="mood-note">${mood.note}</div>` : ''}
                        </div>
                    </div>
                `).join('');
                console.log('✅ Recent moods rendered successfully');
            }
        } catch (error) {
            console.error('❌ Failed to load recent moods:', error);
            const container = document.getElementById('recent-moods-list');
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <h4>Unable to Load Moods</h4>
                    <p>Please check your connection and try again</p>
                </div>
            `;
        }
    }

    selectMood(option) {
        document.querySelectorAll('.mood-option').forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
        this.selectedMood = option.dataset.mood;
    }

    async saveMood() {
        console.log('😊 Attempting to save mood...');

        if (!this.currentUser || !this.selectedMood) {
            console.log('❌ No user or mood selected');
            this.showToast('Please select a mood', 'warning');
            return;
        }

        const note = document.getElementById('mood-note').value;
        console.log('📝 Mood data:', { userId: this.currentUser.id, mood: this.selectedMood, note });

        try {
            console.log('📡 Making mood save API call...');
            const response = await fetch('/api/moods', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: this.currentUser.id,
                    mood: this.selectedMood,
                    note
                })
            });

            console.log('📡 Mood save response status:', response.status);
            const data = await response.json();
            console.log('📡 Mood save response data:', data);

            if (response.ok) {
                console.log('✅ Mood saved successfully');
                this.showToast('Mood logged successfully!', 'success');
                document.getElementById('mood-note').value = '';
                document.querySelectorAll('.mood-option').forEach(opt => opt.classList.remove('selected'));
                this.selectedMood = null;
                this.switchPage('dashboard');
                this.loadDashboard();
            } else {
                console.log('❌ Mood save failed:', data.error);
                this.showToast(data.error || 'Failed to save mood', 'error');
            }
        } catch (error) {
            console.error('❌ Mood save error:', error);
            this.showToast('Network error. Please try again.', 'error');
        }
    }

    async getSuggestions() {
        console.log('💡 Getting AI suggestions for user:', this.currentUser?.id);

        if (!this.currentUser) {
            console.log('❌ No current user, skipping suggestions');
            return;
        }

        try {
            console.log('📡 Fetching recent moods for context...');
            // Get recent moods for context
            const response = await fetch(`/api/moods/${this.currentUser.id}`);
            const moods = await response.json();
            const recentMoods = moods.slice(-7).map(m => m.mood);

            console.log('📝 Recent moods for suggestions:', recentMoods);

            if (recentMoods.length === 0) {
                console.log('⚠️ No moods logged yet');
                this.showToast('Log some moods first to get personalized suggestions', 'warning');
                return;
            }

            console.log('🤖 Making suggestions API call...');
            const suggestionsResponse = await fetch('/api/suggestions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: this.currentUser.id,
                    recentMoods
                })
            });

            console.log('🤖 Suggestions response status:', suggestionsResponse.status);
            const data = await suggestionsResponse.json();
            console.log('🤖 Suggestions response data:', data);

            if (suggestionsResponse.ok) {
                console.log('✅ Suggestions received successfully');
                this.renderSuggestions(data.suggestions);
            } else {
                console.log('❌ Suggestions API failed:', data.error);
                this.showToast('Failed to get suggestions', 'error');
            }
        } catch (error) {
            console.error('❌ Suggestions error:', error);
            this.showToast('Network error getting suggestions', 'error');
        }
    }

    renderSuggestions(suggestions) {
        const container = document.getElementById('suggestions-container');

        container.innerHTML = suggestions.map((suggestion, index) => `
            <div class="suggestion-card" style="animation-delay: ${index * 0.1}s">
                <i class="fas fa-lightbulb"></i>
                <p>${suggestion}</p>
            </div>
        `).join('');
    }

    async sendMessage() {
        console.log('💬 Sending chat message...');

        const input = document.getElementById('chat-input');
        const message = input.value.trim();

        if (!message || !this.currentUser) {
            console.log('❌ No message or user');
            return;
        }

        console.log('💬 User message:', message);

        // Add user message to chat with timestamp
        this.addMessageToChat(message, 'user');

        // Clear input
        input.value = '';

        // Disable send button while processing
        const sendBtn = document.getElementById('send-message-btn');
        sendBtn.disabled = true;

        // Show typing indicator
        this.showTypingIndicator();

        try {
            console.log('🤖 Making chat API call...');
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: this.currentUser.id,
                    message
                })
            });

            console.log('🤖 Chat response status:', response.status);
            const data = await response.json();
            console.log('🤖 Chat response data:', data);

            // Hide typing indicator
            this.hideTypingIndicator();

            if (response.ok) {
                console.log('✅ Chat response received');
                // Add assistant response to chat with timestamp
                this.addMessageToChat(data.response, 'assistant');
            } else {
                console.log('❌ Chat API failed:', data.error);
                this.addMessageToChat('I\'m here to listen. Please try again.', 'assistant');
            }
        } catch (error) {
            console.error('❌ Chat error:', error);
            this.hideTypingIndicator();
            this.addMessageToChat('I\'m experiencing some technical difficulties, but I\'m still here for you. Please try again in a moment.', 'assistant');
        }

        // Re-enable send button
        sendBtn.disabled = false;

        // Scroll to bottom
        this.scrollChatToBottom();
    }

    addMessageToChat(message, type) {
        const chatMessages = document.getElementById('chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}-message`;

        // Format timestamp
        const now = new Date();
        const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        messageDiv.innerHTML = `
            <div class="message-avatar">
                ${type === 'assistant' ? '<i class="fas fa-heart"></i>' : '<i class="fas fa-user"></i>'}
            </div>
            <div class="message-content">
                <p>${this.escapeHtml(message)}</p>
                <span class="message-time">${timeString}</span>
            </div>
        `;

        chatMessages.appendChild(messageDiv);
        this.scrollChatToBottom();
    }

    showTypingIndicator() {
        const chatMessages = document.getElementById('chat-messages');
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message assistant-message typing-indicator';
        typingDiv.id = 'typing-indicator';

        typingDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-heart"></i>
            </div>
            <div class="message-content">
                <div class="typing-dots">
                    <span class="typing-dot"></span>
                    <span class="typing-dot"></span>
                    <span class="typing-dot"></span>
                </div>
            </div>
        `;

        chatMessages.appendChild(typingDiv);
        this.scrollChatToBottom();
    }

    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    scrollChatToBottom() {
        const chatMessages = document.getElementById('chat-messages');
        setTimeout(() => {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 100);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async loadChatHistory() {
        console.log('📚 Loading chat history for user:', this.currentUser?.id);

        if (!this.currentUser) {
            console.log('❌ No current user for chat history');
            return;
        }

        try {
            console.log('📡 Fetching chat history...');
            const response = await fetch(`/api/chat/${this.currentUser.id}`);
            console.log('📡 Chat history response status:', response.status);

            const data = await response.json();
            console.log('📡 Chat history data:', data);

            if (response.ok && data.history) {
                console.log('✅ Chat history loaded successfully');
                this.renderChatHistory(data.history);
            } else {
                console.log('❌ Chat history load failed:', data.error);
                // Show welcome message if no history
                this.showWelcomeMessage();
            }
        } catch (error) {
            console.error('❌ Chat history load error:', error);
            this.showWelcomeMessage();
        }
    }

    renderChatHistory(history) {
        const chatMessages = document.getElementById('chat-messages');

        // Clear existing messages except welcome message
        const existingMessages = chatMessages.querySelectorAll('.message');
        existingMessages.forEach(msg => {
            if (!msg.classList.contains('welcome-message')) {
                msg.remove();
            }
        });

        // Add historical messages
        history.forEach(chatMsg => {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${chatMsg.sender}-message`;

            // Format timestamp
            const msgTime = new Date(chatMsg.timestamp);
            const timeString = msgTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            messageDiv.innerHTML = `
                <div class="message-avatar">
                    ${chatMsg.sender === 'assistant' ? '<i class="fas fa-heart"></i>' : '<i class="fas fa-user"></i>'}
                </div>
                <div class="message-content">
                    <p>${this.escapeHtml(chatMsg.message)}</p>
                    <span class="message-time">${timeString}</span>
                </div>
            `;

            chatMessages.appendChild(messageDiv);
        });

        this.scrollChatToBottom();
    }

    showWelcomeMessage() {
        const chatMessages = document.getElementById('chat-messages');

        // Clear any existing messages
        chatMessages.innerHTML = '';

        // Add welcome message
        const welcomeDiv = document.createElement('div');
        welcomeDiv.className = 'message assistant-message welcome-message';

        welcomeDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-heart"></i>
            </div>
            <div class="message-content">
                <p>Hello! I'm your Mood Buddy assistant. I'm here to listen to whatever is on your mind. Feel free to share your thoughts, feelings, or anything you'd like to talk about. I'm here to support you with kindness and understanding.</p>
                <span class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
        `;

        chatMessages.appendChild(welcomeDiv);
        this.scrollChatToBottom();
    }

    toggleProfileDropdown() {
        const dropdown = document.getElementById('profile-dropdown');
        dropdown.classList.toggle('show');
    }

    viewProfile() {
        console.log('👤 Viewing profile for user:', this.currentUser?.id);

        this.switchPage('profile');
        document.getElementById('profile-dropdown').classList.remove('show');

        // Load profile data
        if (this.currentUser) {
            console.log('📊 Loading profile data...');

            // Show real user data immediately
            document.getElementById('profile-username').textContent = this.currentUser.username;
            document.getElementById('profile-email').textContent = this.currentUser.email;
            document.getElementById('profile-joined').textContent = this.currentUser.created_at ?
                new Date(this.currentUser.created_at).toLocaleDateString() : 'Unknown';

            // Load saved avatar
            this.loadSavedAvatar();

            // Load additional stats
            this.loadProfileStats();

            console.log('✅ Profile data loaded');
        } else {
            console.log('❌ No current user for profile');
        }
    }

    toggleEditField(fieldId) {
        const field = document.getElementById(fieldId);
        if (!field) return;

        const isEditable = field.getAttribute('contenteditable') === 'true';
        field.setAttribute('contenteditable', !isEditable);

        if (!isEditable) {
            field.focus();
            field.classList.add('editing');
        } else {
            field.classList.remove('editing');
        }
    }

    saveField(type) {
        const field = document.getElementById(`profile-${type}`);
        if (!field) return;

        const newValue = field.textContent.trim();
        field.setAttribute('contenteditable', 'false');
        field.classList.remove('editing');

        // Here you could save to backend if needed
        // For now, just show success feedback
        this.showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} updated successfully`, 'success');
    }

    cancelEdit(fieldId) {
        const field = document.getElementById(fieldId);
        if (!field) return;

        field.setAttribute('contenteditable', 'false');
        field.classList.remove('editing');
        // Reset to original value if needed
    }

    loadSavedAvatar() {
        const savedAvatar = localStorage.getItem(`avatar_${this.currentUser.id}`);
        const avatarDisplay = document.getElementById('profile-avatar-display');
        const removeBtn = document.getElementById('remove-avatar-btn');

        if (savedAvatar) {
            avatarDisplay.innerHTML = `<img src="${savedAvatar}" alt="Profile Avatar" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
            removeBtn.style.display = 'inline-block';
        } else {
            avatarDisplay.innerHTML = '<i class="fas fa-user"></i>';
            removeBtn.style.display = 'none';
        }
    }

    initAvatarUpload() {
        const changeBtn = document.getElementById('change-avatar-btn');
        const removeBtn = document.getElementById('remove-avatar-btn');
        const fileInput = document.getElementById('avatar-upload');

        // Modal elements
        const cropModal = document.getElementById('avatar-crop-modal');
        const cropImage = document.getElementById('crop-image');
        const cropModalClose = document.getElementById('crop-modal-close');
        const cropCancel = document.getElementById('crop-cancel');
        const cropSave = document.getElementById('crop-save');
        const cropZoomIn = document.getElementById('crop-zoom-in');
        const cropZoomOut = document.getElementById('crop-zoom-out');
        const cropRotate = document.getElementById('crop-rotate');

        let cropper = null;
        let selectedFile = null;

        changeBtn.addEventListener('click', () => {
            fileInput.click();
        });

        removeBtn.addEventListener('click', () => {
            if (this.currentUser) {
                localStorage.removeItem(`avatar_${this.currentUser.id}`);
                this.loadSavedAvatar();
                this.updateTopNavAvatar();
                this.showToast('Avatar removed successfully', 'success');
            }
        });

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                selectedFile = file;
                this.showCropModal(file);
            }
        });

        // Modal event listeners
        cropModalClose.addEventListener('click', () => this.hideCropModal());
        cropCancel.addEventListener('click', () => this.hideCropModal());

        cropSave.addEventListener('click', () => {
            if (cropper) {
                this.saveCroppedAvatar(cropper);
            }
        });

        cropZoomIn.addEventListener('click', () => {
            if (cropper) cropper.zoom(0.1);
        });

        cropZoomOut.addEventListener('click', () => {
            if (cropper) cropper.zoom(-0.1);
        });

        cropRotate.addEventListener('click', () => {
            if (cropper) cropper.rotate(90);
        });

        // Close modal when clicking outside
        cropModal.addEventListener('click', (e) => {
            if (e.target === cropModal) {
                this.hideCropModal();
            }
        });
    }

    showCropModal(file) {
        const cropModal = document.getElementById('avatar-crop-modal');
        const cropImage = document.getElementById('crop-image');

        // Load Cropper.js library dynamically
        if (!window.Cropper) {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.12/cropper.min.js';
            script.onload = () => this.initializeCropper(file);
            document.head.appendChild(script);

            // Also load CSS
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.12/cropper.min.css';
            document.head.appendChild(link);
        } else {
            this.initializeCropper(file);
        }

        cropModal.style.display = 'flex';
    }

    hideCropModal() {
        const cropModal = document.getElementById('avatar-crop-modal');
        cropModal.style.display = 'none';

        if (window.cropper) {
            window.cropper.destroy();
            window.cropper = null;
        }
    }

    initializeCropper(file) {
        const cropImage = document.getElementById('crop-image');

        const reader = new FileReader();
        reader.onload = (e) => {
            cropImage.src = e.target.result;

            // Initialize Cropper
            window.cropper = new Cropper(cropImage, {
                aspectRatio: 1, // Square crop
                viewMode: 1,
                dragMode: 'move',
                responsive: true,
                restore: false,
                checkCrossOrigin: false,
                checkOrientation: false,
                modal: true,
                guides: true,
                center: true,
                highlight: true,
                background: false,
                autoCrop: true,
                autoCropArea: 0.8,
                minCropBoxWidth: 100,
                minCropBoxHeight: 100
            });
        };
        reader.readAsDataURL(file);
    }

    async saveCroppedAvatar(cropper) {
        try {
            // Get cropped canvas
            const canvas = cropper.getCroppedCanvas({
                width: 200,
                height: 200,
                imageSmoothingEnabled: true,
                imageSmoothingQuality: 'high'
            });

            // Convert to base64
            const croppedImage = canvas.toDataURL('image/jpeg', 0.9);

            // Save to localStorage
            if (this.currentUser) {
                localStorage.setItem(`avatar_${this.currentUser.id}`, croppedImage);
                this.loadSavedAvatar();
                this.updateTopNavAvatar();
                this.showToast('Avatar updated successfully', 'success');
            }

            this.hideCropModal();
        } catch (error) {
            console.error('Avatar crop error:', error);
            this.showToast('Failed to save avatar', 'error');
        }
    }

    // Old method - keeping for fallback, but now using cropper
    async processAvatarUpload(file) {
        // This method is now replaced by the cropper functionality
        // Keeping for backward compatibility
        console.log('Using legacy avatar upload method');
    }

    async loadProfileStats() {
        console.log('📈 Loading profile stats for user:', this.currentUser?.id);

        if (!this.currentUser) {
            console.log('❌ No current user for stats');
            return;
        }

        try {
            console.log('📡 Fetching profile stats...');
            const response = await fetch(`/api/dashboard/${this.currentUser.id}`);
            console.log('📡 Profile stats response status:', response.status);

            const data = await response.json();
            console.log('📡 Profile stats data:', data);

            if (response.ok) {
                console.log('✅ Profile stats loaded successfully');
                document.getElementById('profile-entries').textContent = data.totalEntries || 0;
                document.getElementById('profile-streak').textContent = `${data.currentStreak || 0} days`;

                // Update average mood if element exists
                const avgMoodElement = document.getElementById('profile-avg-mood');
                if (avgMoodElement) {
                    avgMoodElement.textContent = data.averageMood || '0.0';
                }
            } else {
                console.log('❌ Profile stats load failed:', data.error);
                this.showToast('Failed to load profile statistics', 'error');
                document.getElementById('profile-entries').textContent = '0';
                document.getElementById('profile-streak').textContent = '0 days';
            }
        } catch (error) {
            console.error('❌ Profile stats error:', error);
            this.showToast('Network error loading profile stats', 'error');
            document.getElementById('profile-entries').textContent = '0';
            document.getElementById('profile-streak').textContent = '0 days';
        }
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem('currentUser');
        document.getElementById('main-screen').classList.remove('active');
        document.getElementById('auth-screen').classList.add('active');
        document.querySelector('.sidebar').classList.remove('open');
        this.showToast('Logged out successfully', 'success');
    }

    // New Features Implementation
    initializeNewFeatures() {
        this.initializeCalendar();
        this.loadDailyQuote();
        this.loadChallenges();
        this.initializeBadges();
        this.initializeThemeToggle();
        this.initializeProfileEditing();
        this.addMicroAnimations();
    }

    initializeCalendar() {
        this.currentCalendarDate = new Date();
        this.renderCalendar();
        this.updateCalendarData();
    }

    renderCalendar() {
        const calendarGrid = document.getElementById('calendar-grid');
        const monthYear = document.getElementById('calendar-month-year');

        if (!calendarGrid || !monthYear) return;

        const year = this.currentCalendarDate.getFullYear();
        const month = this.currentCalendarDate.getMonth();

        monthYear.textContent = new Date(year, month).toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric'
        });

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());

        calendarGrid.innerHTML = '';

        for (let i = 0; i < 42; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);

            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day';
            dayElement.textContent = date.getDate();

            if (date.getMonth() !== month) {
                dayElement.classList.add('other-month');
            }

            const today = new Date();
            if (date.toDateString() === today.toDateString()) {
                dayElement.classList.add('today');
            }

            // Add mood data if available
            const dateStr = date.toISOString().split('T')[0];
            if (this.moodData && this.moodData[dateStr]) {
                const mood = this.moodData[dateStr];
                dayElement.classList.add(`mood-${mood.replace('😢', 'very-sad').replace('😟', 'sad').replace('😐', 'neutral').replace('😊', 'happy').replace('😁', 'very-happy').replace(' ', '-')}`);
                dayElement.setAttribute('data-tooltip', `${mood} on ${date.toLocaleDateString()}`);
            }

            calendarGrid.appendChild(dayElement);
        }
    }

    navigateCalendar(direction) {
        this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() + direction);
        this.renderCalendar();
        this.updateCalendarData();
    }

    async updateCalendarData() {
        if (!this.currentUser) return;

        try {
            const response = await fetch(`/api/moods/${this.currentUser.id}`);
            const moods = await response.json();

            this.moodData = {};
            moods.forEach(mood => {
                this.moodData[mood.date] = mood.mood;
            });

            this.renderCalendar();
        } catch (error) {
            console.error('Failed to load calendar data:', error);
        }
    }

    async loadDailyQuote() {
        try {
            console.log('📝 Loading daily quote...');
            const response = await fetch('https://api.quotable.io/random?tags=inspirational,motivational');

            if (!response.ok) {
                throw new Error(`Quote API failed with status: ${response.status}`);
            }

            const data = await response.json();

            if (data && data.content && data.author) {
                document.getElementById('daily-quote').textContent = `"${data.content}"`;
                document.getElementById('quote-author').textContent = `- ${data.author}`;
                console.log('✅ Quote loaded successfully');
            } else {
                throw new Error('Invalid quote data received');
            }
        } catch (error) {
            console.error('❌ Failed to load quote:', error.message);
            // Fallback quote - never crash the app
            document.getElementById('daily-quote').textContent = '"The only way to do great work is to love what you do."';
            document.getElementById('quote-author').textContent = '- Steve Jobs';
            console.log('✅ Using fallback quote');
        }
    }

    loadChallenges() {
        const challenges = [
            { id: 'drink-water', text: 'Drink 8 glasses of water', completed: false },
            { id: 'walk-10min', text: 'Take a 10-minute walk', completed: false },
            { id: 'gratitude', text: 'Write 3 things you\'re grateful for', completed: false },
            { id: 'deep-breath', text: 'Practice deep breathing for 2 minutes', completed: false }
        ];

        const challengesList = document.getElementById('challenges-list');
        if (!challengesList) return;

        challengesList.innerHTML = challenges.map(challenge => `
            <div class="challenge-item" data-challenge="${challenge.id}">
                <div class="challenge-checkbox">
                    <i class="fas fa-check"></i>
                </div>
                <div class="challenge-content">
                    <span>${challenge.text}</span>
                    <small>${this.getChallengeDescription(challenge.id)}</small>
                </div>
            </div>
        `).join('');

        // Add click handlers
        document.querySelectorAll('.challenge-item').forEach(item => {
            item.addEventListener('click', () => this.toggleChallenge(item));
        });
    }

    getChallengeDescription(id) {
        const descriptions = {
            'drink-water': 'Stay hydrated for better mood',
            'walk-10min': 'Get some fresh air and movement',
            'gratitude': 'Practice positive thinking',
            'deep-breath': 'Reduce stress and anxiety'
        };
        return descriptions[id] || '';
    }

    toggleChallenge(item) {
        item.classList.toggle('completed');
        const checkbox = item.querySelector('.challenge-checkbox');
        checkbox.classList.toggle('checked');

        // Add animation
        item.style.transform = 'scale(0.95)';
        setTimeout(() => {
            item.style.transform = '';
        }, 150);
    }

    initializeBadges() {
        const badges = [
            { id: 'first-steps', name: 'First Steps', description: 'Log your first mood entry', unlocked: false },
            { id: 'week-warrior', name: 'Week Warrior', description: 'Log moods for 7 consecutive days', unlocked: false },
            { id: 'month-master', name: 'Month Master', description: 'Log moods for 30 consecutive days', unlocked: false },
            { id: 'century-club', name: 'Century Club', description: 'Log 100 mood entries', unlocked: false }
        ];

        const badgesContainer = document.getElementById('badges-container');
        if (!badgesContainer) return;

        badgesContainer.innerHTML = badges.map(badge => `
            <div class="badge-item ${badge.unlocked ? 'unlocked' : 'locked'}" data-tooltip="${badge.description}">
                <i class="fas ${this.getBadgeIcon(badge.id)}"></i>
                <span>${badge.name}</span>
            </div>
        `).join('');
    }

    getBadgeIcon(id) {
        const icons = {
            'first-steps': 'fa-star',
            'week-warrior': 'fa-fire',
            'month-master': 'fa-crown',
            'century-club': 'fa-medal'
        };
        return icons[id] || 'fa-award';
    }

    initializeThemeToggle() {
        const themeToggle = document.getElementById('theme-toggle');
        if (!themeToggle) return;

        themeToggle.addEventListener('click', () => this.toggleTheme());
    }

    toggleTheme() {
        console.log('🎨 Toggling theme...');

        const body = document.body;
        const themeToggle = document.getElementById('theme-toggle');

        if (!themeToggle) {
            console.log('❌ Theme toggle button not found');
            return;
        }

        // Force a reflow to ensure CSS variables are applied
        body.offsetHeight;

        const currentTheme = body.classList.contains('dark-mode') ? 'dark' : 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        console.log(`🎨 Switching from ${currentTheme} to ${newTheme}`);

        // Remove current theme class first
        body.classList.remove('dark-mode');

        // Force another reflow
        body.offsetHeight;

        // Apply the new theme
        if (newTheme === 'dark') {
            body.classList.add('dark-mode');
        }

        // Save to localStorage
        localStorage.setItem('theme', newTheme);

        // Update toggle icon
        const icon = themeToggle.querySelector('i');
        if (icon) {
            icon.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }

        // Add transition effect
        body.style.transition = 'background-color 0.3s ease, color 0.3s ease';
        setTimeout(() => {
            body.style.transition = '';
        }, 300);

        console.log(`✅ Theme switched to ${newTheme}`);
        this.showToast(`Switched to ${newTheme} mode`, 'success');
    }

    loadTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-mode');
            const themeToggle = document.getElementById('theme-toggle');
            if (themeToggle) {
                const icon = themeToggle.querySelector('i');
                if (icon) {
                    icon.className = 'fas fa-sun';
                }
            }
        }
    }

    initializeProfileEditing() {
        // Theme toggle
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }

        // Calendar navigation
        const prevMonth = document.getElementById('prev-month');
        const nextMonth = document.getElementById('next-month');
        if (prevMonth) prevMonth.addEventListener('click', () => this.navigateCalendar(-1));
        if (nextMonth) nextMonth.addEventListener('click', () => this.navigateCalendar(1));

        // Quote refresh
        const refreshQuote = document.getElementById('refresh-quote');
        if (refreshQuote) refreshQuote.addEventListener('click', () => this.loadDailyQuote());

        // Avatar upload
        const changeAvatarBtn = document.getElementById('change-avatar-btn');
        const removeAvatarBtn = document.getElementById('remove-avatar-btn');
        const avatarUpload = document.getElementById('avatar-upload');

        if (changeAvatarBtn) changeAvatarBtn.addEventListener('click', () => avatarUpload.click());
        if (avatarUpload) avatarUpload.addEventListener('change', (e) => this.handleAvatarUpload(e));
        if (removeAvatarBtn) removeAvatarBtn.addEventListener('click', () => this.removeAvatar());

        // Avatar crop modal
        const cropModalClose = document.getElementById('crop-modal-close');
        const cropCancel = document.getElementById('crop-cancel');
        const cropSave = document.getElementById('crop-save');
        const cropZoomIn = document.getElementById('crop-zoom-in');
        const cropZoomOut = document.getElementById('crop-zoom-out');
        const cropRotate = document.getElementById('crop-rotate');

        if (cropModalClose) cropModalClose.addEventListener('click', () => this.closeCropModal());
        if (cropCancel) cropCancel.addEventListener('click', () => this.closeCropModal());
        if (cropSave) cropSave.addEventListener('click', () => this.saveCroppedAvatar());
        if (cropZoomIn) cropZoomIn.addEventListener('click', () => this.adjustCrop('zoomIn'));
        if (cropZoomOut) cropZoomOut.addEventListener('click', () => this.adjustCrop('zoomOut'));
        if (cropRotate) cropRotate.addEventListener('click', () => this.adjustCrop('rotate'));

        // Editable field events
        const profileUsername = document.getElementById('profile-username');
        const profileBio = document.getElementById('profile-bio');

        if (profileUsername) {
            profileUsername.addEventListener('blur', () => this.saveField('username'));
            profileUsername.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.saveField('username');
                } else if (e.key === 'Escape') {
                    this.cancelEdit('profile-username');
                }
            });
        }

        if (profileBio) {
            profileBio.addEventListener('blur', () => this.saveField('bio'));
            profileBio.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.saveField('bio');
                } else if (e.key === 'Escape') {
                    this.cancelEdit('profile-bio');
                }
            });
        }
    }

    handleAvatarUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            this.showToast('Please select a valid image file', 'error');
            return;
        }

        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            this.showToast('Image size should be less than 5MB', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            this.originalImageData = e.target.result;
            this.openCropModal(e.target.result);
        };
        reader.readAsDataURL(file);
    }

    openCropModal(imageData) {
        const modal = document.getElementById('avatar-crop-modal');
        const cropImage = document.getElementById('crop-image');

        if (!modal || !cropImage) return;

        cropImage.src = imageData;
        modal.style.display = 'flex';

        // Initialize crop variables
        this.cropScale = 1;
        this.cropRotation = 0;
        this.updateCropDisplay();
    }

    closeCropModal() {
        const modal = document.getElementById('avatar-crop-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        // Reset file input
        const avatarUpload = document.getElementById('avatar-upload');
        if (avatarUpload) avatarUpload.value = '';
    }

    adjustCrop(action) {
        const cropImage = document.getElementById('crop-image');
        if (!cropImage) return;

        switch (action) {
            case 'zoomIn':
                this.cropScale = Math.min(this.cropScale + 0.1, 3);
                break;
            case 'zoomOut':
                this.cropScale = Math.max(this.cropScale - 0.1, 0.5);
                break;
            case 'rotate':
                this.cropRotation = (this.cropRotation + 90) % 360;
                break;
        }

        this.updateCropDisplay();
    }

    updateCropDisplay() {
        const cropImage = document.getElementById('crop-image');
        if (!cropImage) return;

        cropImage.style.transform = `scale(${this.cropScale}) rotate(${this.cropRotation}deg)`;
    }

    saveCroppedAvatar() {
        const cropImage = document.getElementById('crop-image');
        if (!cropImage) return;

        // Create canvas for cropping
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const size = 200; // Avatar size

        canvas.width = size;
        canvas.height = size;

        // Calculate crop area (center square)
        const img = cropImage;
        const imgSize = Math.min(img.naturalWidth, img.naturalHeight);
        const startX = (img.naturalWidth - imgSize) / 2;
        const startY = (img.naturalHeight - imgSize) / 2;

        // Apply transformations and draw
        ctx.save();
        ctx.translate(size / 2, size / 2);
        ctx.rotate((this.cropRotation * Math.PI) / 180);
        ctx.scale(this.cropScale, this.cropScale);
        ctx.drawImage(img, -size / 2, -size / 2, size, size);
        ctx.restore();

        const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.9);

        // Update avatar display
        const avatarDisplay = document.getElementById('profile-avatar-display');
        const userAvatar = document.querySelector('.user-avatar');

        if (avatarDisplay) {
            avatarDisplay.style.backgroundImage = `url(${croppedDataUrl})`;
            avatarDisplay.style.backgroundSize = 'cover';
            avatarDisplay.style.backgroundPosition = 'center';
            avatarDisplay.innerHTML = ''; // Remove default icon
        }

        if (userAvatar) {
            userAvatar.style.backgroundImage = `url(${croppedDataUrl})`;
            userAvatar.style.backgroundSize = 'cover';
            userAvatar.style.backgroundPosition = 'center';
            userAvatar.innerHTML = ''; // Remove default icon
        }

        // Show remove button
        const removeBtn = document.getElementById('remove-avatar-btn');
        if (removeBtn) removeBtn.style.display = 'inline-block';

        // Save to localStorage
        localStorage.setItem('userAvatar', croppedDataUrl);

        this.closeCropModal();
        this.showToast('Avatar updated successfully!', 'success');
    }

    removeAvatar() {
        const avatarDisplay = document.getElementById('profile-avatar-display');
        const userAvatar = document.querySelector('.user-avatar');
        const removeBtn = document.getElementById('remove-avatar-btn');

        if (avatarDisplay) {
            avatarDisplay.style.backgroundImage = '';
            avatarDisplay.innerHTML = '<i class="fas fa-user"></i>';
        }

        if (userAvatar) {
            userAvatar.style.backgroundImage = '';
            userAvatar.innerHTML = '<i class="fas fa-user"></i>';
        }

        if (removeBtn) removeBtn.style.display = 'none';

        localStorage.removeItem('userAvatar');
        this.showToast('Avatar removed', 'success');
    }

    loadSavedAvatar() {
        const savedAvatar = localStorage.getItem('userAvatar');
        if (savedAvatar) {
            const avatarDisplay = document.getElementById('profile-avatar-display');
            const userAvatar = document.querySelector('.user-avatar');

            if (avatarDisplay) {
                avatarDisplay.style.backgroundImage = `url(${savedAvatar})`;
                avatarDisplay.style.backgroundSize = 'cover';
                avatarDisplay.style.backgroundPosition = 'center';
                avatarDisplay.innerHTML = '';
            }

            if (userAvatar) {
                userAvatar.style.backgroundImage = `url(${savedAvatar})`;
                userAvatar.style.backgroundSize = 'cover';
                userAvatar.style.backgroundPosition = 'center';
                userAvatar.innerHTML = '';
            }

            // Show remove button
            const removeBtn = document.getElementById('remove-avatar-btn');
            if (removeBtn) removeBtn.style.display = 'inline-block';
        }
    }

    addMicroAnimations() {
        // Add hover animations to interactive elements
        document.querySelectorAll('button, .mood-option, .challenge-item, .badge-item, .calendar-day').forEach(el => {
            el.addEventListener('mouseenter', () => {
                el.classList.add('animate-pulse');
            });
            el.addEventListener('mouseleave', () => {
                el.classList.remove('animate-pulse');
            });
        });

        // Add click animations
        document.addEventListener('click', (e) => {
            const target = e.target.closest('button, .mood-option, .challenge-item, .badge-item');
            if (target) {
                target.classList.add('animate-bounce');
                setTimeout(() => {
                    target.classList.remove('animate-bounce');
                }, 300);
            }
        });
    }

    initMobileMenu() {
        // Create hamburger menu button for mobile
        const topNav = document.querySelector('.top-nav');
        const navSpacer = document.querySelector('.nav-spacer');

        // Create hamburger button
        const hamburgerBtn = document.createElement('button');
        hamburgerBtn.id = 'hamburger-btn';
        hamburgerBtn.className = 'hamburger-btn';
        hamburgerBtn.innerHTML = '<i class="fas fa-bars"></i>';
        hamburgerBtn.style.cssText = `
            display: none;
            background: none;
            border: none;
            color: var(--text-primary);
            font-size: 1.25rem;
            cursor: pointer;
            padding: 0.5rem;
            border-radius: var(--border-radius);
            transition: var(--transition);
        `;

        hamburgerBtn.addEventListener('click', () => this.toggleSidebar());
        navSpacer.appendChild(hamburgerBtn);

        // Handle initial state
        this.handleResize();
    }

    toggleSidebar() {
        const sidebar = document.querySelector('.sidebar');
        sidebar.classList.toggle('open');
    }

    handleResize() {
        const sidebar = document.querySelector('.sidebar');
        const hamburgerBtn = document.getElementById('hamburger-btn');

        if (window.innerWidth <= 768) {
            // Mobile: sidebar hidden by default, show hamburger
            sidebar.classList.remove('open');
            if (hamburgerBtn) hamburgerBtn.style.display = 'block';
        } else {
            // Desktop: sidebar always visible, hide hamburger
            sidebar.classList.add('open');
            if (hamburgerBtn) hamburgerBtn.style.display = 'none';
        }
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;

        document.getElementById('toast-container').appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 5000);
    }

    requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    showNotification(title, body) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body, icon: '/favicon.ico' });
        }
    }

    // Daily reminder function (call this periodically)
    checkDailyReminder() {
        const lastReminder = localStorage.getItem('lastMoodReminder');
        const today = new Date().toDateString();

        if (lastReminder !== today) {
            // Check if user has logged mood today
            if (this.currentUser) {
                fetch(`/api/moods/${this.currentUser.id}`)
                    .then(res => res.json())
                    .then(moods => {
                        const todayMoods = moods.filter(m => m.date === new Date().toISOString().split('T')[0]);
                        if (todayMoods.length === 0) {
                            this.showNotification('Mood Buddy', 'Don\'t forget to log your mood today!');
                            this.showToast('Time to log your mood!', 'warning');
                            localStorage.setItem('lastMoodReminder', today);
                        }
                    });
            }
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.moodBuddyApp = new MoodBuddyApp();

    // Check for daily reminders every hour
    setInterval(() => {
        window.moodBuddyApp.checkDailyReminder();
    }, 3600000); // 1 hour in milliseconds

    // Add micro-animations to interactive elements
    document.addEventListener('DOMContentLoaded', () => {
        // Add hover animations to buttons
        document.querySelectorAll('button, .mood-option, .challenge-item, .badge-item').forEach(el => {
            el.addEventListener('mouseenter', () => el.classList.add('animate-pulse'));
            el.addEventListener('mouseleave', () => el.classList.remove('animate-pulse'));
        });

        // Add click animations
        document.addEventListener('click', (e) => {
            if (e.target.matches('button, .mood-option, .challenge-item')) {
                e.target.classList.add('animate-bounce');
                setTimeout(() => e.target.classList.remove('animate-bounce'), 300);
            }
        });
    });
});

// Initialize new features after app is ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.moodBuddyApp) {
            window.moodBuddyApp.initializeNewFeatures();
        }
    }, 100);
});

// Add micro-animations to interactive elements
document.addEventListener('DOMContentLoaded', () => {
    // Add hover animations to buttons
    document.querySelectorAll('button, .mood-option, .challenge-item, .badge-item').forEach(el => {
        el.addEventListener('mouseenter', () => el.classList.add('animate-pulse'));
        el.addEventListener('mouseleave', () => el.classList.remove('animate-pulse'));
    });

    // Add click animations
    document.addEventListener('click', (e) => {
        if (e.target.matches('button, .mood-option, .challenge-item')) {
            e.target.classList.add('animate-bounce');
            setTimeout(() => e.target.classList.remove('animate-bounce'), 300);
        }
    });
});

// Initialize new features after app is ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.moodBuddyApp) {
            window.moodBuddyApp.initializeNewFeatures();
        }
    }, 100);
});

// Add micro-animations to interactive elements
document.addEventListener('DOMContentLoaded', () => {
    // Add hover animations to buttons
    document.querySelectorAll('button, .mood-option, .challenge-item, .badge-item').forEach(el => {
        el.addEventListener('mouseenter', () => el.classList.add('animate-pulse'));
        el.addEventListener('mouseleave', () => el.classList.remove('animate-pulse'));
    });

    // Add click animations
    document.addEventListener('click', (e) => {
        if (e.target.matches('button, .mood-option, .challenge-item')) {
            e.target.classList.add('animate-bounce');
            setTimeout(() => e.target.classList.remove('animate-bounce'), 300);
        }
    });
});

// Initialize new features after app is ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.moodBuddyApp) {
            window.moodBuddyApp.initializeNewFeatures();
        }
    }, 100);
});

// Add micro-animations to interactive elements
document.addEventListener('DOMContentLoaded', () => {
    // Add hover animations to buttons
    document.querySelectorAll('button, .mood-option, .challenge-item, .badge-item').forEach(el => {
        el.addEventListener('mouseenter', () => el.classList.add('animate-pulse'));
        el.addEventListener('mouseleave', () => el.classList.remove('animate-pulse'));
    });

    // Add click animations
    document.addEventListener('click', (e) => {
        if (e.target.matches('button, .mood-option, .challenge-item')) {
            e.target.classList.add('animate-bounce');
            setTimeout(() => e.target.classList.remove('animate-bounce'), 300);
        }
    });
});

// Initialize new features after app is ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.moodBuddyApp) {
            window.moodBuddyApp.initializeNewFeatures();
        }
    }, 100);
});

// Add micro-animations to interactive elements
document.addEventListener('DOMContentLoaded', () => {
    // Add hover animations to buttons
    document.querySelectorAll('button, .mood-option, .challenge-item, .badge-item').forEach(el => {
        el.addEventListener('mouseenter', () => el.classList.add('animate-pulse'));
        el.addEventListener('mouseleave', () => el.classList.remove('animate-pulse'));
    });

    // Add click animations
    document.addEventListener('click', (e) => {
        if (e.target.matches('button, .mood-option, .challenge-item')) {
            e.target.classList.add('animate-bounce');
            setTimeout(() => e.target.classList.remove('animate-bounce'), 300);
        }
    });
});

// Initialize new features after app is ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.moodBuddyApp) {
            window.moodBuddyApp.initializeNewFeatures();
        }
    }, 100);
});

// Add micro-animations to interactive elements
document.addEventListener('DOMContentLoaded', () => {
    // Add hover animations to buttons
    document.querySelectorAll('button, .mood-option, .challenge-item, .badge-item').forEach(el => {
        el.addEventListener('mouseenter', () => el.classList.add('animate-pulse'));
        el.addEventListener('mouseleave', () => el.classList.remove('animate-pulse'));
    });

    // Add click animations
    document.addEventListener('click', (e) => {
        if (e.target.matches('button, .mood-option, .challenge-item')) {
            e.target.classList.add('animate-bounce');
            setTimeout(() => e.target.classList.remove('animate-bounce'), 300);
        }
    });
});

// Initialize new features after app is ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.moodBuddyApp) {
            window.moodBuddyApp.initializeNewFeatures();
        }
    }, 100);
});

// Add micro-animations to interactive elements
document.addEventListener('DOMContentLoaded', () => {
    // Add hover animations to buttons
    document.querySelectorAll('button, .mood-option, .challenge-item, .badge-item').forEach(el => {
        el.addEventListener('mouseenter', () => el.classList.add('animate-pulse'));
        el.addEventListener('mouseleave', () => el.classList.remove('animate-pulse'));
    });

    // Add click animations
    document.addEventListener('click', (e) => {
        if (e.target.matches('button, .mood-option, .challenge-item')) {
            e.target.classList.add('animate-bounce');
            setTimeout(() => e.target.classList.remove('animate-bounce'), 300);
        }
    });
});

// Initialize new features after app is ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.moodBuddyApp) {
            window.moodBuddyApp.initializeNewFeatures();
        }
    }, 100);
});

// Add micro-animations to interactive elements
document.addEventListener('DOMContentLoaded', () => {
    // Add hover animations to buttons
    document.querySelectorAll('button, .mood-option, .challenge-item, .badge-item').forEach(el => {
        el.addEventListener('mouseenter', () => el.classList.add('animate-pulse'));
        el.addEventListener('mouseleave', () => el.classList.remove('animate-pulse'));
    });

    // Add click animations
    document.addEventListener('click', (e) => {
        if (e.target.matches('button, .mood-option, .challenge-item')) {
            e.target.classList.add('animate-bounce');
            setTimeout(() => e.target.classList.remove('animate-bounce'), 300);
        }
    });
});

// Initialize new features after app is ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.moodBuddyApp) {
            window.moodBuddyApp.initializeNewFeatures();
        }
    }, 100);
});

// Add micro-animations to interactive elements
document.addEventListener('DOMContentLoaded', () => {
    // Add hover animations to buttons
    document.querySelectorAll('button, .mood-option, .challenge-item, .badge-item').forEach(el => {
        el.addEventListener('mouseenter', () => el.classList.add('animate-pulse'));
        el.addEventListener('mouseleave', () => el.classList.remove('animate-pulse'));
    });

    // Add click animations
    document.addEventListener('click', (e) => {
        if (e.target.matches('button, .mood-option, .challenge-item')) {
            e.target.classList.add('animate-bounce');
            setTimeout(() => e.target.classList.remove('animate-bounce'), 300);
        }
    });
});