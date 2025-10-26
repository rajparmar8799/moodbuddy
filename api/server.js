const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
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

CREATE TABLE chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  sender TEXT NOT NULL,
  message TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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

    // Check chat_history table
    const { error: chatError } = await supabase
      .from('chat_history')
      .select('id')
      .limit(1);

    if (chatError && chatError.code === 'PGRST116') {
      console.log('❌ Chat history table does not exist. Please create it manually in Supabase dashboard');
    } else {
      console.log('✅ Chat history table exists');
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

// Gemini AI client
let genAI = null;
try {
  if (process.env.GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    console.log('Gemini AI client initialized successfully');
  } else {
    console.log('Gemini API key not found');
  }
} catch (error) {
  console.error('Failed to initialize Gemini AI client:', error.message);
}

// Pre-defined suggestions database
const suggestionsDatabase = {
  '😢': [
    "Take a warm shower and let the water wash away your worries for a few minutes.",
    "Listen to your favorite sad song and let yourself feel the emotions - it's okay to cry.",
    "Call a close friend and talk about what's bothering you - sharing helps lighten the load.",
    "Write down three things you're grateful for, even on tough days.",
    "Take a 10-minute walk outside and focus on the sensation of your feet on the ground.",
    "Drink a cup of your favorite warm beverage and savor each sip mindfully.",
    "Look at old photos that make you smile and remember happier times.",
    "Do one small act of self-care, like putting on comfortable clothes or brushing your hair.",
    "Write a letter to yourself about how strong you've been through past challenges.",
    "Watch a funny video or movie that always makes you laugh, even if it's just for 5 minutes.",
    "Practice deep breathing: inhale for 4 counts, hold for 4, exhale for 4.",
    "Make a list of small things you can do tomorrow that might bring some joy.",
    "Hug a stuffed animal or pet if you have one - physical touch can be comforting.",
    "Light a scented candle and focus on the pleasant aroma.",
    "Read an inspirational quote or story about overcoming sadness.",
    "Take a break from social media and do something offline that you enjoy.",
    "Make yourself a comfort food that reminds you of happier times.",
    "Write down your feelings in a journal without judging yourself.",
    "Listen to nature sounds or calming music for 10 minutes.",
    "Remind yourself that this feeling is temporary and you've gotten through tough times before."
  ],
  '😟': [
    "Take 5 deep breaths and focus on the present moment.",
    "Write down your worries on paper, then tear it up or throw it away.",
    "Do a quick 5-minute meditation focusing on what you're grateful for.",
    "Go for a short walk and notice the world around you.",
    "Call someone you trust and talk through what's worrying you.",
    "Make a list of things you can control and things you can't.",
    "Practice progressive muscle relaxation - tense and release each muscle group.",
    "Listen to calming music or nature sounds.",
    "Do something creative like drawing or coloring for 10 minutes.",
    "Remind yourself of past worries that turned out okay.",
    "Drink a glass of water and eat something nourishing.",
    "Take a break from news or social media for a while.",
    "Do some light stretching or yoga poses.",
    "Write down three positive affirmations about yourself.",
    "Spend time with a pet or loved one.",
    "Clean or organize a small space to create a sense of control.",
    "Watch a funny video to shift your perspective.",
    "Practice mindfulness by eating a small treat very slowly.",
    "Take a warm bath or shower.",
    "Read an inspiring book or article."
  ],
  '😐': [
    "Try something new today, even if it's small like a different route to work.",
    "Connect with someone you haven't talked to in a while.",
    "Do a random act of kindness for someone else.",
    "Learn something new - watch a short educational video.",
    "Get outside and spend time in nature.",
    "Try a new recipe or cook something you've never made.",
    "Organize a small area of your home or workspace.",
    "Listen to music that energizes you.",
    "Do some light exercise like dancing in your room.",
    "Write down goals for the week ahead.",
    "Try a new hobby or revisit an old one.",
    "Spend time with friends or family.",
    "Read a book or article that interests you.",
    "Take photos of things that make you happy.",
    "Practice a skill you've been wanting to learn.",
    "Volunteer or help someone in need.",
    "Create something with your hands.",
    "Explore a new place in your city.",
    "Try meditation or mindfulness exercises.",
    "Plan something fun for the weekend."
  ],
  '😊': [
    "Share your good mood with someone else - tell a friend what made you happy.",
    "Do something kind for someone today.",
    "Take a moment to appreciate the good things in your life.",
    "Try to make someone else smile today.",
    "Celebrate your positive mood by doing something you enjoy.",
    "Write down what went well today.",
    "Share your happiness on social media or with loved ones.",
    "Do something creative that brings you joy.",
    "Spend time outdoors enjoying the day.",
    "Listen to upbeat music and dance around.",
    "Treat yourself to something small but special.",
    "Call a friend just to say hello and share your good mood.",
    "Do a random act of kindness.",
    "Take time to really enjoy a meal or snack.",
    "Practice gratitude by thanking someone in your life.",
    "Share a positive memory with someone.",
    "Do something that makes you laugh.",
    "Celebrate small wins and achievements.",
    "Spend time with people who make you happy.",
    "Create or maintain a positive habit."
  ],
  '😁': [
    "Share your joy with others - your positive energy is contagious!",
    "Celebrate this great mood by doing something fun and spontaneous.",
    "Use this energy to tackle something you've been putting off.",
    "Spread positivity by complimenting three people today.",
    "Do something adventurous or try something new.",
    "Share your happiness through laughter with friends or family.",
    "Use this great mood to help someone who needs cheering up.",
    "Create something beautiful or meaningful.",
    "Dance, sing, or express yourself creatively.",
    "Plan something exciting for the future.",
    "Share your enthusiasm with colleagues or classmates.",
    "Do something generous for someone else.",
    "Celebrate your good mood with your favorite treat.",
    "Use this energy to organize or clean something.",
    "Share funny stories or jokes with others.",
    "Do something physical and active.",
    "Create positive memories with loved ones.",
    "Try a new experience or adventure.",
    "Express gratitude for this wonderful feeling.",
    "Use your good mood to inspire others around you."
  ]
};

app.post('/api/suggestions', async (req, res) => {
   try {
     console.log('🤖 Suggestions API called');
     const { userId, recentMoods } = req.body;

     if (!userId || !recentMoods || recentMoods.length === 0) {
       console.log('❌ Missing required parameters');
       return res.status(400).json({ error: 'User ID and recent moods are required' });
     }

     console.log('📊 Recent moods:', recentMoods);

     // Use Gemini AI
     if (genAI) {
       try {
         console.log('🚀 Using Gemini for suggestions...');

         // Get more context from user's mood history
         const { data: userMoods, error: moodError } = await supabase
           .from('moods')
           .select('*')
           .eq('user_id', userId)
           .order('created_at', { ascending: false })
           .limit(10);

         let moodContext = '';
         if (!moodError && userMoods && userMoods.length > 0) {
           const moodCounts = {};
           userMoods.forEach(mood => {
             moodCounts[mood.mood] = (moodCounts[mood.mood] || 0) + 1;
           });

           const dominantMood = Object.entries(moodCounts)
             .sort(([,a], [,b]) => b - a)[0][0];

           moodContext = `This user has been experiencing ${dominantMood} frequently. `;
         }

         const currentMood = recentMoods[recentMoods.length - 1];
         const prompt = `${moodContext}Hey friend! Based on your recent mood ${currentMood}, here are 3 simple, friendly suggestions to help you feel better. Keep each one short and conversational, like advice from a good friend. Format as a numbered list.`;

         console.log('📤 Sending to Gemini:', prompt.substring(0, 100) + '...');

         const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
         const result = await model.generateContent({
           contents: [{ role: 'user', parts: [{ text: prompt }] }]
         });
         const response = result.response;
         const text = response.text();

         console.log('✅ Gemini response received');

         // Parse suggestions from response
         const suggestions = text
           .split('\n')
           .filter(line => line.trim() && (line.match(/^\d+\./) || line.match(/^[•\-*]/)))
           .slice(0, 3)
           .map(s => s.replace(/^\d+\.\s*/, '').replace(/^[•\-*]\s*/, '').trim());

         if (suggestions.length > 0) {
           console.log('✅ Returning Gemini suggestions:', suggestions);
           return res.json({ suggestions });
         }
       } catch (geminiError) {
         console.log('❌ Gemini failed:', geminiError.message);
         console.log('❌ Gemini error details:', geminiError);
       }
     } else {
       console.log('❌ Gemini client not available');
     }

     // No fallback - return error if Gemini fails
     console.log('❌ No AI service available for suggestions');
     return res.status(500).json({ error: 'AI service unavailable. Please try again later.' });

   } catch (error) {
     console.error('❌ Suggestions error:', error.message);
     console.error('❌ Suggestions error stack:', error.stack);
     return res.status(500).json({ error: 'Failed to get suggestions. Please try again.' });
   }
});

// Pre-defined chat responses database
const chatResponses = {
  greeting: [
    "Hello! I'm here to listen and support you. How are you feeling today?",
    "Hi there! I'm your Mood Buddy. What's on your mind today?",
    "Hello! I'm glad you reached out. I'm here to listen without judgment.",
    "Hi! I'm here for you. What's been going on lately?",
    "Hello! Thank you for trusting me with your thoughts. How can I support you today?"
  ],
  sad: [
    "I'm sorry you're feeling this way. It's completely okay to feel sad sometimes. You're not alone in this.",
    "I hear that you're feeling down, and that's valid. Sometimes we all need to acknowledge our sadness before we can move forward.",
    "It's brave of you to share how you're feeling. Sadness is a normal emotion, and it's okay to experience it.",
    "I'm here with you during this difficult time. Your feelings matter, and it's important to give yourself permission to feel them.",
    "Thank you for being honest about your sadness. Remember that this feeling won't last forever, and brighter days are ahead."
  ],
  anxious: [
    "Anxiety can be really overwhelming. Let's take a moment to breathe together. Try inhaling for 4 counts, holding for 4, and exhaling for 4.",
    "I understand anxiety can make everything feel uncertain. You're doing the right thing by reaching out. What specifically is worrying you right now?",
    "Anxiety is tough, but you're stronger than you realize. Let's focus on what you can control in this moment.",
    "It's okay to feel anxious. Many people experience this. What usually helps you feel more grounded?",
    "Thank you for sharing your anxiety with me. Remember that your feelings are valid, and you're taking positive steps by addressing them."
  ],
  happy: [
    "I'm so glad to hear you're feeling happy! That's wonderful. What brought this good mood?",
    "Your happiness is contagious! It's great to hear positive updates. What's been going well for you?",
    "I'm delighted you're feeling good! Celebrating these moments is important. What would you like to do to make this day even better?",
    "That's fantastic! Happiness is meant to be shared. Is there someone you'd like to share this joy with?",
    "I'm smiling just hearing about your good mood! What's one thing that always brings you happiness?"
  ],
  neutral: [
    "Sometimes feeling neutral is just what we need. How has your day been going so far?",
    "It's okay to have days where we feel neither here nor there. What's been on your mind lately?",
    "Neutral days can be a good opportunity for reflection. Is there anything you'd like to talk about?",
    "Every emotion has its place, including feeling neutral. How are you taking care of yourself today?",
    "Thank you for checking in. Sometimes just acknowledging how we feel is an important step."
  ],
  stressed: [
    "Stress can be really challenging. What aspects of your life are feeling most stressful right now?",
    "I understand stress can make everything feel overwhelming. What usually helps you manage stress?",
    "You're doing great by recognizing your stress and reaching out. What would help you feel more in control?",
    "Stress is a signal that something needs attention. What boundaries can you set to protect your well-being?",
    "Thank you for sharing your stress with me. Remember to be gentle with yourself during challenging times."
  ],
  grateful: [
    "Gratitude is such a powerful emotion! What are you feeling grateful for today?",
    "I'm glad you're experiencing gratitude. Focusing on positive aspects can really shift our perspective.",
    "That's beautiful! Gratitude helps us appreciate the good things in life. What's one thing you're especially thankful for?",
    "Gratitude is contagious! Sharing what you're thankful for can brighten someone's day.",
    "I'm happy to hear you're feeling grateful. What small joys have you noticed recently?"
  ],
  general: [
    "I'm here to listen. What's been on your mind lately?",
    "Thank you for sharing that with me. How else can I support you?",
    "I appreciate you opening up. Your feelings are important and valid.",
    "I'm listening without judgment. Please continue if you'd like.",
    "Your thoughts and feelings matter. I'm here for you.",
    "It's brave of you to share your thoughts. How are you feeling about that?",
    "I hear you, and I want to acknowledge how you're feeling right now.",
    "Thank you for trusting me with your thoughts. I'm here to support you.",
    "Your emotions are valid, and it's important to express them.",
    "I'm glad you reached out. Sometimes just talking about things helps."
  ]
};

// Function to analyze message and determine response type
function analyzeMessage(message) {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
    return 'greeting';
  } else if (lowerMessage.includes('sad') || lowerMessage.includes('depressed') || lowerMessage.includes('down') || lowerMessage.includes('cry')) {
    return 'sad';
  } else if (lowerMessage.includes('anxious') || lowerMessage.includes('worried') || lowerMessage.includes('nervous') || lowerMessage.includes('scared')) {
    return 'anxious';
  } else if (lowerMessage.includes('happy') || lowerMessage.includes('good') || lowerMessage.includes('great') || lowerMessage.includes('excited')) {
    return 'happy';
  } else if (lowerMessage.includes('stressed') || lowerMessage.includes('overwhelmed') || lowerMessage.includes('busy') || lowerMessage.includes('pressure')) {
    return 'stressed';
  } else if (lowerMessage.includes('grateful') || lowerMessage.includes('thankful') || lowerMessage.includes('thanks') || lowerMessage.includes('appreciate')) {
    return 'grateful';
  } else {
    return 'general';
  }
}

// Store conversation history per user
const conversationHistories = new Map();

// AI Chat/Assistant endpoint
app.post('/api/chat', async (req, res) => {
   try {
     console.log('💬 Chat API called');
     const { userId, message } = req.body;

     if (!userId || !message) {
       console.log('❌ Missing userId or message');
       return res.status(400).json({ error: 'User ID and message are required' });
     }

     console.log('💬 User message:', message.substring(0, 100) + '...');

     // Get or create conversation history for this user
     if (!conversationHistories.has(userId)) {
       conversationHistories.set(userId, [
         {
           role: "user",
           content: "You are MoodBuddy, a friendly and emotionally intelligent AI companion. Always reply politely, in 3–4 lines, empathetic and comforting. Maintain conversation context and remember what the user has shared."
         }
       ]);
     }

     const conversationHistory = conversationHistories.get(userId);

     // Add user message to history
     conversationHistory.push({ role: "user", content: message });

     // Keep only last 15 messages to avoid token limits
     if (conversationHistory.length > 16) { // 1 system + 15 conversation pairs
       conversationHistory.splice(1, 2); // Remove oldest user-assistant pair
     }

     // Save user message to database
     try {
       await supabase
         .from('chat_history')
         .insert({
           user_id: userId,
           sender: 'user',
           message: message,
           timestamp: new Date().toISOString()
         });
       console.log('💾 User message saved to database');
     } catch (dbError) {
       console.log('⚠️ Failed to save user message to database:', dbError.message);
     }

     // Use Gemini AI
     if (genAI) {
       try {
         console.log('🚀 Using Gemini for chat with conversation history...');

         const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

         // Convert conversation history to Gemini format
         const contents = conversationHistory.map(msg => ({
           role: msg.role === 'user' ? 'user' : 'model',
           parts: [{ text: msg.content }]
         }));

         const result = await model.generateContent({
           contents: contents
         });

         const response = result.response;
         const aiResponse = response.text().trim();

         console.log('✅ Gemini chat response received:', aiResponse.substring(0, 50) + '...');

         // Add assistant response to history
         conversationHistory.push({ role: "model", content: aiResponse });

         // Save assistant response to database
         try {
           await supabase
             .from('chat_history')
             .insert({
               user_id: userId,
               sender: 'assistant',
               message: aiResponse,
               timestamp: new Date().toISOString()
             });
           console.log('💾 Assistant response saved to database');
         } catch (dbError) {
           console.log('⚠️ Failed to save assistant response to database:', dbError.message);
         }

         return res.json({ response: aiResponse });
       } catch (geminiError) {
         console.log('❌ Gemini chat failed:', geminiError.message);
         console.log('❌ Gemini error details:', geminiError);
       }
     } else {
       console.log('❌ Gemini client not available');
     }

     // Fallback response if AI fails
     const fallbackResponse = "I'm here to listen. What's been on your mind?";
     conversationHistory.push({ role: "model", content: fallbackResponse });

     // Save fallback response to database
     try {
       await supabase
         .from('chat_history')
         .insert({
           user_id: userId,
           sender: 'assistant',
           message: fallbackResponse,
           timestamp: new Date().toISOString()
         });
     } catch (dbError) {
       console.log('⚠️ Failed to save fallback response to database:', dbError.message);
     }

     return res.json({ response: fallbackResponse });

   } catch (error) {
     console.error('❌ Chat error:', error.message);
     console.error('❌ Chat error stack:', error.stack);
     return res.status(500).json({ error: 'I\'m experiencing some technical difficulties, but I\'m still here for you. Please try again in a moment.' });
   }
});

// Get chat history endpoint
app.get('/api/chat/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    console.log('📚 Fetching chat history for user:', userId);

    const { data: chatHistory, error } = await supabase
      .from('chat_history')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: true });

    if (error) {
      console.error('❌ Database error fetching chat history:', error);
      return res.status(500).json({ error: 'Failed to fetch chat history' });
    }

    console.log('✅ Chat history fetched:', chatHistory?.length || 0, 'messages');

    // Convert to frontend format
    const formattedHistory = chatHistory.map(msg => ({
      sender: msg.sender,
      message: msg.message,
      timestamp: msg.timestamp
    }));

    res.json({ history: formattedHistory });
  } catch (error) {
    console.error('❌ Chat history error:', error.message);
    res.status(500).json({ error: 'Failed to fetch chat history' });
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