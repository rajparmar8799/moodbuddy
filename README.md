# Mood Buddy

A modern web application for tracking your daily moods with AI-powered suggestions. Built with Node.js, Express, Supabase, and OpenAI API. Deployed on Vercel.

## Features

- **Authentication**: Secure signup/login with hashed passwords stored in Supabase
- **Mood Logging**: Daily mood tracking with emoji selection and optional notes
- **Interactive Dashboard**: Charts showing mood trends, streaks, and statistics using Chart.js
- **AI Suggestions**: Personalized mood improvement suggestions powered by OpenAI GPT-4o-mini
- **AI Chat Assistant**: Emotional support chat with AI counselor
- **Modern UI**: Responsive design with gradients, shadows, animations, and mobile-friendly layout
- **Cloud Storage**: Supabase database for reliable data persistence
- **Notifications**: Browser notifications and toast messages for reminders

## Prerequisites

- Node.js (v14 or higher)
- npm
- OpenAI API key (for AI features)
- Supabase account (for database)

## Installation & Local Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/rajparmar8799/moodbuddy.git
   cd moodbuddy
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   - Copy `.env.example` to `.env`
   - Add your API keys:
     ```
     OPENAI_API_KEY=your_openai_api_key_here
     SUPABASE_URL=your_supabase_project_url
     SUPABASE_ANON_KEY=your_supabase_anon_key
     PORT=3000
     ```

4. **Get API keys:**
   - **OpenAI**: Visit [OpenAI Platform](https://platform.openai.com/api-keys) and create an API key
   - **Supabase**: Create a project at [Supabase](https://supabase.com) and get your project URL and anon key

5. **Set up Supabase database:**
   - Create a new project in Supabase
   - Go to SQL Editor and run:
     ```sql
     CREATE TABLE users (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       username TEXT NOT NULL,
       email TEXT UNIQUE NOT NULL,
       password TEXT NOT NULL,
       created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
     );

     CREATE TABLE moods (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       user_id UUID REFERENCES users(id) ON DELETE CASCADE,
       mood TEXT NOT NULL,
       note TEXT,
       date DATE NOT NULL,
       created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
     );
     ```

6. **Run locally:**
   ```bash
   npm start
   ```
   Or for development:
   ```bash
   npm run dev
   ```

7. **Open your browser:**
   ```
   http://localhost:3000
   ```



## Project Structure

```
moodbuddy/
├── server.js              # Express server with API routes
├── package.json           # Dependencies and scripts
├── vercel.json           # Vercel deployment configuration
├── .env                   # Environment variables (local development)
├── .env.example          # Example environment file
├── .gitignore            # Git ignore rules
├── README.md             # This file
└── public/
    ├── index.html        # Main HTML file
    ├── styles.css        # CSS styles
    ├── app.js           # Frontend JavaScript
    └── favicon.ico      # Favicon
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new account
- `POST /api/auth/login` - Login to account

### Mood Tracking
- `POST /api/moods` - Log a new mood entry
- `GET /api/moods/:userId` - Get user's mood history

### Dashboard
- `GET /api/dashboard/:userId` - Get dashboard statistics

### AI Features
- `POST /api/suggestions` - Get personalized mood improvement suggestions
- `POST /api/chat` - Chat with AI assistant for emotional support

## Usage

1. **Sign Up**: Create an account with username, email, and password
2. **Log Mood**: Select your current mood from the emoji options and add an optional note
3. **View Dashboard**: See your mood trends, statistics, and recent entries
4. **Get Suggestions**: Receive AI-powered recommendations for mood improvement
5. **Chat with AI Assistant**: Talk to your personal mood companion for emotional support
6. **Daily Reminders**: Get notified to log your mood if you haven't already today

