const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Supabase client - initialize with error handling
let supabase = null;
try {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    console.log('Supabase client initialized successfully');
  } else {
    console.log('Supabase environment variables not found');
  }
} catch (error) {
  console.error('Failed to initialize Supabase client:', error.message);
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Initialize Supabase tables if they don't exist
async function initializeSupabaseTables() {
  try {
    console.log('Initializing Supabase tables...');

    // First, try to create the tables directly using Supabase client
    // Create users table
    const { error: usersError } = await supabase
      .from('users')
      .select('id')
      .limit(1);

    if (usersError && usersError.code === 'PGRST116') {
      // Table doesn't exist, we need to create it manually in Supabase dashboard
      console.log('❌ Users table does not exist. Please create it manually in Supabase dashboard:');
      console.log(`
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT,
  google_id TEXT UNIQUE,
  avatar_url TEXT,
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
      `);
    } else {
      console.log('✅ Users table exists');
    }

    // Check moods table
    const { error: moodsError } = await supabase
      .from('moods')
      .select('id')
      .limit(1);

    if (moodsError && moodsError.code === 'PGRST116') {
      console.log('❌ Moods table does not exist. Please create it manually in Supabase dashboard');
    } else {
      console.log('✅ Moods table exists');
    }

  } catch (error) {
    console.log('Table check error:', error.message);
  }
}

// Use Supabase for storage (required for Vercel deployment)
const USE_SUPABASE = true;

// Root route for serving the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Routes
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (USE_SUPABASE) {
      // Check if user exists
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .or(`email.eq.${email},username.eq.${username}`)
        .single();

      if (existingUser) {
        return res.status(400).json({ error: 'User already exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
          id: uuidv4(),
          username,
          email,
          password: hashedPassword,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        console.error('Supabase insert error:', insertError);
        return res.status(500).json({ error: 'Failed to create user' });
      }

      res.status(201).json({ message: 'User created successfully', userId: newUser.id });
    } else {
      // Fallback to local storage
      const users = readUsers();
      const existingUser = users.find(user => user.email === email || user.username === username);

      if (existingUser) {
        return res.status(400).json({ error: 'User already exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = {
        id: uuidv4(),
        username,
        email,
        password: hashedPassword,
        createdAt: new Date().toISOString()
      };

      users.push(newUser);
      writeUsers(users);

      res.status(201).json({ message: 'User created successfully', userId: newUser.id });
    }
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (USE_SUPABASE) {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (error || !user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatar_url: user.avatar_url
        }
      });
    } else {
      // Fallback to local storage
      const users = readUsers();
      const user = users.find(u => u.email === email);

      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        }
      });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.post('/api/moods', async (req, res) => {
  try {
    const { userId, mood, note } = req.body;

    if (!userId || !mood) {
      return res.status(400).json({ error: 'User ID and mood are required' });
    }

    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }
      const { data: newMood, error } = await supabase
        .from('moods')
        .insert({
          id: uuidv4(),
          user_id: userId,
          mood,
          note: note || '',
          date: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase insert error:', error);
        return res.status(500).json({ error: 'Failed to save mood' });
      }

      res.status(201).json({ message: 'Mood logged successfully', mood: newMood });
  } catch (error) {
    console.error('Mood logging error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/moods/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }
      const { data: userMoods, error } = await supabase
        .from('moods')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase query error:', error);
        return res.status(500).json({ error: 'Failed to fetch moods' });
      }

      res.json(userMoods);
  } catch (error) {
    console.error('Get moods error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/dashboard/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }
      const { data: userMoods, error } = await supabase
        .from('moods')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: true });

      if (error) {
        console.error('Supabase query error:', error);
        return res.status(500).json({ error: 'Failed to fetch dashboard data' });
      }

      // Calculate mood statistics
      const moodCounts = {};
      const moodTrends = {};
      let streak = 0;
      let lastDate = null;

      userMoods.forEach(mood => {
        // Count moods
        moodCounts[mood.mood] = (moodCounts[mood.mood] || 0) + 1;

        // Trends by date
        moodTrends[mood.date] = mood.mood;

        // Calculate streak (consecutive days with mood entries)
        if (lastDate) {
          const currentDate = new Date(mood.date);
          const prevDate = new Date(lastDate);
          const diffTime = currentDate - prevDate;
          const diffDays = diffTime / (1000 * 60 * 60 * 24);

          if (diffDays === 1) {
            streak++;
          } else if (diffDays > 1) {
            streak = 1;
          }
        } else {
          streak = 1;
        }
        lastDate = mood.date;
      });

      const averageMood = userMoods.length > 0 ?
        Object.entries(moodCounts).reduce((sum, [mood, count]) => {
          const moodValue = { '😢': 1, '😟': 2, '😐': 3, '😊': 4, '😁': 5 }[mood] || 3;
          return sum + (moodValue * count);
        }, 0) / userMoods.length : 0;

      res.json({
        totalEntries: userMoods.length,
        moodCounts,
        moodTrends,
        currentStreak: streak,
        averageMood: averageMood.toFixed(1)
      });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// OpenAI client
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
}) : null;

app.post('/api/suggestions', async (req, res) => {
  try {
    const { userId, recentMoods } = req.body;

    if (!userId || !recentMoods) {
      return res.status(400).json({ error: 'User ID and recent moods are required' });
    }

    // Try OpenAI API only
    if (openai) {
      try {
        const prompt = `Based on these recent mood entries: ${recentMoods.join(', ')}, provide 3 personalized, actionable suggestions to improve mood. Keep each suggestion under 50 words and make them positive and encouraging. Format as a simple numbered list.`;

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: "system",
              content: "You are MoodBuddy, a professional emotional support AI. Always reply politely, in a comforting and empathetic tone, limited to 4 lines. Respond like a human counselor trained in positive psychology."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          max_tokens: 300,
          temperature: 0.8
        });

        const text = completion.choices[0].message.content;
        console.log('OpenAI API response received');

        // Parse suggestions from response
        const suggestions = text
          .split('\n')
          .filter(line => line.trim() && (line.match(/^\d+\./) || line.match(/^[•\-*]/)))
          .slice(0, 3)
          .map(s => s.replace(/^\d+\.\s*/, '').replace(/^[•\-*]\s*/, '').trim());

        if (suggestions.length > 0) {
          console.log('Returning OpenAI suggestions');
          return res.json({ suggestions });
        }
      } catch (openaiError) {
        console.log('OpenAI API failed for suggestions:', openaiError.message);
        console.log('Full error:', openaiError);
      }
    }

    // Return error if AI fails
    console.log('AI API failed, returning error');
    return res.status(500).json({ error: 'AI service temporarily unavailable. Please try again later.' });
  } catch (error) {
    console.error('AI suggestions error:', error.message);
    return res.status(500).json({ error: 'AI service temporarily unavailable. Please try again later.' });
  }
});

// AI Chat/Assistant endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { userId, message } = req.body;

    if (!userId || !message) {
      return res.status(400).json({ error: 'User ID and message are required' });
    }

    // Try OpenAI API only
    if (openai) {
      try {
        // Create comforting prompt by appending the comfort instruction
        const comfortingPrompt = `${message} try to make me comfortable and send appropriate answer to boost my self`;

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: "system",
              content: "You are MoodBuddy, a professional emotional support AI. Always reply politely, in a comforting and empathetic tone, limited to 4 lines. Respond like a human counselor trained in positive psychology."
            },
            {
              role: "user",
              content: comfortingPrompt
            }
          ],
          max_tokens: 300,
          temperature: 0.8
        });

        const aiResponse = completion.choices[0].message.content.trim();
        console.log('OpenAI API chat response received');
        return res.json({ response: aiResponse });
      } catch (openaiError) {
        console.log('OpenAI API failed for chat:', openaiError.message);
        console.log('Full error:', openaiError);
      }
    }

    // Return error if AI fails
    console.log('AI API failed for chat, returning error');
    return res.status(500).json({ error: 'AI service temporarily unavailable. Please try again later.' });
  } catch (error) {
    console.error('AI chat error:', error.message);

    // Return error if AI fails
    console.log('AI API failed for chat, returning error');
    return res.status(500).json({ error: 'AI service temporarily unavailable. Please try again later.' });
  }
});

// Vercel serverless function handler
module.exports = app;

// For local development
if (require.main === module) {
  app.listen(PORT, async () => {
    console.log(`Mood Buddy server running on http://localhost:${PORT}`);
    console.log(`Using Supabase storage`);

    // Initialize Supabase tables
    await initializeSupabaseTables();
  });
}