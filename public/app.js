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
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.currentUser = data.user;
                localStorage.setItem('currentUser', JSON.stringify(data.user));
                this.showMainApp();
                this.showToast('Welcome back!', 'success');
                this.loadDashboard();
            } else {
                this.showToast(data.error, 'error');
            }
        } catch (error) {
            this.showToast('Login failed', 'error');
        }
    }

    async handleSignup(e) {
        e.preventDefault();
        const username = document.getElementById('signup-username').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;

        try {
            const response = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.showToast('Account created successfully! Please login.', 'success');
                this.switchAuthTab('login');
            } else {
                this.showToast(data.error, 'error');
            }
        } catch (error) {
            this.showToast('Signup failed', 'error');
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
        }
    }

    switchPage(page) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

        document.getElementById(`${page}-page`).classList.add('active');
        document.querySelector(`[data-page="${page}"]`).classList.add('active');

        this.currentPage = page;

        if (page === 'dashboard') {
            this.loadDashboard();
        } else if (page === 'suggestions') {
            this.getSuggestions();
        }
    }

    async loadDashboard() {
        if (!this.currentUser) return;

        try {
            const response = await fetch(`/api/dashboard/${this.currentUser.id}`);
            const data = await response.json();

            if (response.ok) {
                document.getElementById('total-entries').textContent = data.totalEntries;
                document.getElementById('current-streak').textContent = data.currentStreak;
                document.getElementById('average-mood').textContent = data.averageMood;

                this.renderMoodChart(data.moodTrends);
                this.renderRecentMoods();
            }
        } catch (error) {
            console.error('Failed to load dashboard:', error);
        }
    }

    renderMoodChart(moodTrends) {
        const ctx = document.getElementById('mood-chart').getContext('2d');

        // Convert mood emojis to numerical values
        const moodValues = { '😢': 1, '😟': 2, '😐': 3, '😊': 4, '😁': 5 };
        const dates = Object.keys(moodTrends).sort();
        const values = dates.map(date => moodValues[moodTrends[date]] || 3);

        new Chart(ctx, {
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
        if (!this.currentUser) return;

        try {
            const response = await fetch(`/api/moods/${this.currentUser.id}`);
            const moods = await response.json();

            const recentMoods = moods.slice(-5).reverse();
            const container = document.getElementById('recent-moods-list');

            container.innerHTML = recentMoods.map(mood => `
                <div class="mood-item">
                    <div class="mood-emoji">${mood.mood}</div>
                    <div class="mood-info">
                        <div class="mood-date">${new Date(mood.date).toLocaleDateString()}</div>
                        ${mood.note ? `<div class="mood-note">${mood.note}</div>` : ''}
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Failed to load recent moods:', error);
        }
    }

    selectMood(option) {
        document.querySelectorAll('.mood-option').forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
        this.selectedMood = option.dataset.mood;
    }

    async saveMood() {
        if (!this.currentUser || !this.selectedMood) {
            this.showToast('Please select a mood', 'warning');
            return;
        }

        const note = document.getElementById('mood-note').value;

        try {
            const response = await fetch('/api/moods', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: this.currentUser.id,
                    mood: this.selectedMood,
                    note
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.showToast('Mood logged successfully!', 'success');
                document.getElementById('mood-note').value = '';
                document.querySelectorAll('.mood-option').forEach(opt => opt.classList.remove('selected'));
                this.selectedMood = null;
                this.switchPage('dashboard');
                this.loadDashboard();
            } else {
                this.showToast(data.error, 'error');
            }
        } catch (error) {
            this.showToast('Failed to save mood', 'error');
        }
    }

    async getSuggestions() {
        if (!this.currentUser) return;

        try {
            // Get recent moods for context
            const response = await fetch(`/api/moods/${this.currentUser.id}`);
            const moods = await response.json();
            const recentMoods = moods.slice(-7).map(m => m.mood);

            if (recentMoods.length === 0) {
                this.showToast('Log some moods first to get personalized suggestions', 'warning');
                return;
            }

            const suggestionsResponse = await fetch('/api/suggestions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: this.currentUser.id,
                    recentMoods
                })
            });

            const data = await suggestionsResponse.json();

            if (suggestionsResponse.ok) {
                this.renderSuggestions(data.suggestions);
            } else {
                this.showToast('Failed to get suggestions', 'error');
            }
        } catch (error) {
            this.showToast('Failed to get suggestions', 'error');
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
        const input = document.getElementById('chat-input');
        const message = input.value.trim();

        if (!message || !this.currentUser) return;

        // Add user message to chat
        this.addMessageToChat(message, 'user');

        // Clear input
        input.value = '';

        // Disable send button while processing
        const sendBtn = document.getElementById('send-message-btn');
        sendBtn.disabled = true;

        // Show typing indicator
        this.showTypingIndicator();

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: this.currentUser.id,
                    message
                })
            });

            const data = await response.json();

            // Hide typing indicator
            this.hideTypingIndicator();

            if (response.ok) {
                // Add assistant response to chat
                this.addMessageToChat(data.response, 'assistant');
            } else {
                this.addMessageToChat('I\'m here to listen. Please try again.', 'assistant');
            }
        } catch (error) {
            console.error('Chat error:', error);
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

        messageDiv.innerHTML = `
            <div class="message-avatar">
                ${type === 'assistant' ? '<i class="fas fa-heart"></i>' : '<i class="fas fa-user"></i>'}
            </div>
            <div class="message-content">
                <p>${this.escapeHtml(message)}</p>
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

    toggleProfileDropdown() {
        const dropdown = document.getElementById('profile-dropdown');
        dropdown.classList.toggle('show');
    }

    viewProfile() {
        this.switchPage('profile');
        document.getElementById('profile-dropdown').classList.remove('show');

        // Load profile data
        if (this.currentUser) {
            document.getElementById('profile-username').textContent = this.currentUser.username || 'Loading...';
            document.getElementById('profile-email').textContent = this.currentUser.email || 'Loading...';
            document.getElementById('profile-joined').textContent = this.currentUser.created_at ?
                new Date(this.currentUser.created_at).toLocaleDateString() : 'Loading...';

            // Load additional stats
            this.loadProfileStats();
        }
    }

    async loadProfileStats() {
        if (!this.currentUser) return;

        try {
            const response = await fetch(`/api/dashboard/${this.currentUser.id}`);
            const data = await response.json();

            if (response.ok) {
                document.getElementById('profile-entries').textContent = data.totalEntries || 0;
                document.getElementById('profile-streak').textContent = `${data.currentStreak || 0} days`;
            } else {
                document.getElementById('profile-entries').textContent = '0';
                document.getElementById('profile-streak').textContent = '0 days';
            }
        } catch (error) {
            console.error('Failed to load profile stats:', error);
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
});