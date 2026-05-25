# Hey Nomads - Design Document

## 📋 Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Tech Stack](#tech-stack)
4. [Folder Structure](#folder-structure)
5. [Data Model](#data-model)
6. [API Design](#api-design)
7. [Frontend Architecture](#frontend-architecture)
8. [Matching Algorithm](#matching-algorithm)
9. [Authentication & Security](#authentication--security)
10. [User Flows](#user-flows)
11. [Design System](#design-system)
12. [Development Guide](#development-guide)

---

## 📱 Project Overview

**Hey Nomads** is a roommate matchmaking platform designed to help users find compatible roommates based on lifestyle preferences, budget, and living habits.

### Core Value Proposition
- **Smart Matching**: Algorithm-based compatibility scoring
- **User-Centric**: Detailed profile creation and preferences
- **Safe Communication**: In-app messaging and agreement generation
- **Transparency**: Clear financial and lifestyle expectations

### Target Users
- Students looking for housing
- Young professionals seeking roommates
- People relocating to new cities

---

## 🏗️ Architecture

### High-Level System Design

```
┌─────────────────┐
│   Frontend      │
│  React + Vite   │
│ (Port 5173)     │
└────────┬────────┘
         │
         │ HTTP/REST
         ▼
┌─────────────────────────────┐
│   Backend API               │
│  Node.js + Express          │
│  (Port 3000)                │
└────────┬────────────────────┘
         │
         │ MySQL Protocol
         ▼
┌─────────────────────────────┐
│   Database                  │
│  MySQL 8.0                  │
│  (localhost:3306)           │
│  Database: hey_roomie       │
└─────────────────────────────┘
```

### Component Layers

**Frontend (React)**
- Pages: Registration, Profile, Discovery, Messaging, Shortlist
- Components: Reusable UI elements (Cards, Navbar, Avatar)
- State Management: Local state + API integration
- Routing: React Router v6 for SPA navigation
- Styling: Tailwind CSS + Framer Motion animations

**Backend (Node.js/Express)**
- REST API endpoints for all operations
- Database abstraction via MySQL2 pool
- Authentication: Password hashing with bcryptjs
- File handling: Image uploads via Multer
- Middleware: CORS, JSON parsing, authentication

**Database (MySQL)**
- Relational schema with foreign keys
- User & Profile separation (1:1)
- Junction tables for many-to-many relationships
- Transaction support for data integrity

---

## 🛠️ Tech Stack

### Frontend
| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | React 18 | UI library |
| **Build Tool** | Vite 5 | Fast bundling & HMR |
| **Router** | React Router v6 | Client-side routing |
| **Styling** | Tailwind CSS | Utility-first CSS |
| **Animations** | Framer Motion | Smooth transitions |
| **Icons** | Lucide React | Icon library |
| **Confetti** | Canvas Confetti | Celebration effects |
| **HTTP** | Fetch API | Server communication |

### Backend
| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Runtime** | Node.js | JavaScript runtime |
| **Framework** | Express 4 | Web framework |
| **Database** | MySQL2/Promise | Async MySQL driver |
| **Auth** | bcryptjs | Password hashing |
| **File Upload** | Multer 2 | File handling |
| **CORS** | cors 2.8 | Cross-origin requests |
| **Environment** | dotenv | Config management |

### Database
| Feature | Details |
|---------|---------|
| **Database** | MySQL 8.0 |
| **Charset** | UTF-8 (default) |
| **Approach** | Schema auto-creation on startup |
| **Migrations** | Programmatic (db.js) |

---

## 📂 Folder Structure

```
hey-nomads/
│
├── backend/                          # Node.js Express API
│   ├── server.js                     # Main server (927 lines)
│   ├── db.js                         # MySQL connection & schema
│   ├── migrate.js                    # Migration utilities
│   ├── upload.js                     # Image upload handler
│   │
│   ├── middleware/
│   │   └── upload.js                 # Multer configuration
│   │
│   ├── utils/
│   │   └── matchEngine.js            # Compatibility scoring
│   │
│   ├── uploads/                      # User profile images
│   │   └── profile_image-*.jpg|png
│   │
│   ├── package.json                  # Node dependencies
│   └── .env                          # Configuration (gitignored)
│
├── frontend-react/                   # React Vite application
│   ├── src/
│   │   ├── main.jsx                  # Entry point
│   │   ├── App.jsx                   # Router & auth logic
│   │   ├── index.css                 # Global styles
│   │   │
│   │   ├── pages/                    # Full-page components
│   │   │   ├── RegisterPage.jsx      # Auth page
│   │   │   ├── ProfilePage.jsx       # View own profile
│   │   │   ├── EditProfilePage.jsx   # Edit profile
│   │   │   ├── DiscoverPage.jsx      # Browse matches
│   │   │   ├── ComparePage.jsx       # Compare two users
│   │   │   ├── ShortlistPage.jsx     # Saved matches
│   │   │   ├── InboxPage.jsx         # Messaging
│   │   │   └── AgreementEditor.jsx   # Contract generation
│   │   │
│   │   ├── components/               # Reusable components
│   │   │   ├── Navbar.jsx            # Header navigation
│   │   │   ├── Layout.jsx            # Page wrapper
│   │   │   ├── MatchCard.jsx         # Match preview card
│   │   │   └── UserAvatar.jsx        # Avatar display
│   │   │
│   │   ├── utils/
│   │   │   ├── api.js                # API client & auth
│   │   │   └── formatters.js         # Data formatting
│   │   │
│   │   └── assets/                   # Images and icons
│   │       ├── favicon.svg
│   │       ├── icons.svg
│   │       ├── hero.png
│   │       └── ...
│   │
│   ├── public/                       # Static files
│   │   ├── index.html
│   │   └── _redirects
│   │
│   ├── vite.config.js                # Vite configuration
│   ├── tailwind.config.js            # Tailwind setup
│   ├── postcss.config.js             # PostCSS plugins
│   ├── eslint.config.js              # Linting rules
│   ├── package.json                  # Dependencies
│   └── .env                          # Frontend config
│
├── database/                         # Database files
│   ├── schema.sql                    # Initial schema creation
│   ├── migrate.sql                   # Legacy migrations (reference)
│   ├── additon.sql                   # Example queries
│   ├── migrate.js                    # Legacy migration script
│   ├── run_migration.js              # Legacy runner
│   └── MIGRATION_NOTES.md            # Maintenance guide
│
├── .git/                             # Version control
├── .gitignore                        # Git ignore patterns
├── README.md                         # User setup guide
├── DESIGN.md                         # This file
├── netlify.toml                      # Netlify deployment
└── package-lock.json                 # Lock file (root)
```

---

## 🗄️ Data Model

### Database Schema

#### 1. Users Table
Primary user authentication and identification.

```sql
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    gender VARCHAR(20) DEFAULT NULL,
    age INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Fields:**
- `id`: Unique user identifier
- `email`: Login credential (unique)
- `password`: Hashed with bcryptjs (10 rounds)
- `is_verified`: Email verification flag
- `gender`, `age`: Optional profile info

**Indexes:**
- Primary: `id`
- Unique: `email`

---

#### 2. Profiles Table
Extended user profile with lifestyle preferences.

```sql
CREATE TABLE profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    bio TEXT DEFAULT NULL,
    occupation VARCHAR(100) DEFAULT NULL,
    city VARCHAR(100) DEFAULT NULL,
    profile_image VARCHAR(255) DEFAULT NULL,
    move_in_date DATE DEFAULT NULL,
    sleep_time ENUM('early', 'late', 'flexible') NOT NULL DEFAULT 'flexible',
    cleanliness INT NOT NULL DEFAULT 3,
    diet ENUM('veg', 'nonveg', 'eggetarian', 'vegan') NOT NULL DEFAULT 'veg',
    noise_tolerance ENUM('quiet', 'moderate', 'loud') NOT NULL DEFAULT 'moderate',
    noise_level INT DEFAULT 3,
    budget INT NOT NULL DEFAULT 15000,
    tax_bracket ENUM('low', 'medium', 'high') DEFAULT 'medium',
    deposit INT DEFAULT 5000,
    flat_type ENUM('1BHK', '2BHK', '3BHK', 'shared', 'studio', 'other') DEFAULT 'shared',
    occupants INT DEFAULT 1,
    smoking ENUM('yes', 'no') DEFAULT 'no',
    drinking ENUM('yes', 'no') DEFAULT 'no',
    partying ENUM('low', 'medium', 'high') DEFAULT 'low',
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uq_profiles_user UNIQUE (user_id)
);
```

**Key Fields:**
- **Housing**: city, flat_type, occupants, budget, deposit
- **Lifestyle**: sleep_time, cleanliness, noise_tolerance, diet
- **Habits**: smoking, drinking, partying
- **Profile**: bio, occupation, profile_image, move_in_date

**Relationships:**
- 1:1 with users table

---

#### 3. Languages Table
Supported languages for user communication.

```sql
CREATE TABLE languages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);
```

**Default Languages:**
- English
- Hindi
- Spanish
- Mandarin
- French
- German
- Tamil
- Telugu
- Kannada
- Malayalam

---

#### 4. User Languages Table (Junction)
Many-to-many relationship between users and languages.

```sql
CREATE TABLE user_languages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    language_id INT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (language_id) REFERENCES languages(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_language (user_id, language_id)
);
```

**Purpose:** Allows users to specify multiple languages they speak.

---

#### 5. Preferences Table
User-defined matching preferences.

```sql
CREATE TABLE preferences (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    preferred_gender VARCHAR(20) DEFAULT NULL,
    preferred_budget_min INT DEFAULT NULL,
    preferred_budget_max INT DEFAULT NULL,
    preferred_location_radius INT DEFAULT 10,
    prefers_smoking VARCHAR(20) DEFAULT 'no_preference',
    prefers_drinking VARCHAR(20) DEFAULT 'no_preference',
    prefers_cleanliness_min INT DEFAULT 1,
    prefers_sleep_schedule VARCHAR(20) DEFAULT 'no_preference',
    prefers_same_diet BOOLEAN DEFAULT FALSE,
    prefers_same_sleep BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Purpose:** Store user's preferences for discovering matches.

---

#### 6. Messages Table
Direct messaging between users.

```sql
CREATE TABLE messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sender_id INT NOT NULL,
    receiver_id INT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_sender_receiver (sender_id, receiver_id),
    INDEX idx_created_at (created_at)
);
```

**Indexes:**
- Composite index on (sender_id, receiver_id) for fast thread lookups
- Index on created_at for sorting

---

#### 7. Shortlists Table
Saved/favorited matches.

```sql
CREATE TABLE shortlists (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    target_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY user_target (user_id, target_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (target_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Purpose:** Track user's saved/favorite matches for later review.

---

#### 8. Agreements Table
Generated roommate agreements.

```sql
CREATE TABLE agreements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userA_id INT NOT NULL,
    userB_id INT NOT NULL,
    content TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'draft',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY u1_u2 (userA_id, userB_id),
    FOREIGN KEY (userA_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (userB_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Statuses:**
- `draft`: Not yet finalized
- `signed`: Both parties agreed
- `archived`: Old agreement

---

### Data Flow

```
User Registration
  ↓
users table (core auth)
  ↓
profiles table (lifestyle, housing)
  ↓
user_languages table (communication)
  ↓
preferences table (matching criteria)
  ↓
Available for Discovery

Discovery & Matching
  ↓
matchEngine.calculateCompatibilityScore()
  ↓
Ranked matches returned to frontend
  ↓
User can shortlist (shortlists table)
  ↓
User can message (messages table)
  ↓
User can generate agreement (agreements table)
```

---

## 🔌 API Design

### Base URL
```
http://localhost:3000
```

### Authentication
- **Method**: Stateless (token stored in localStorage)
- **Header**: Not required for REST (userId in localStorage)
- **Session**: Frontend manages via localStorage

---

### Endpoint Categories

#### 1. Authentication Endpoints

**POST /api/register**
```javascript
Request:
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepass123"
}

Response: 201 Created
{
  "message": "User registered successfully",
  "userId": 1
}
```

**POST /api/login**
```javascript
Request:
{
  "email": "john@example.com",
  "password": "securepass123"
}

Response: 200 OK
{
  "message": "Login successful",
  "userId": 1,
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

---

#### 2. Profile Endpoints

**GET /api/profile/:userId**
```javascript
Response: 200 OK
{
  "id": 1,
  "name": "John Doe",
  "email": "john@example.com",
  "profile_id": 1,
  "bio": "Looking for a roommate...",
  "occupation": "Software Engineer",
  "city": "Mumbai",
  "profile_image": "/uploads/profile_image-xxx.jpg",
  "sleep_time": "late",
  "cleanliness": 4,
  "diet": "veg",
  "noise_tolerance": "moderate",
  "budget": 25000,
  "languages": [
    { "id": 1, "name": "English" },
    { "id": 2, "name": "Hindi" }
  ],
  "is_verified": false
}
```

**POST /api/profile** (multipart/form-data)
```javascript
FormData:
- userId: 1
- bio: "Looking for peaceful roommate"
- occupation: "Software Engineer"
- city: "Mumbai"
- sleepTime: "late"
- cleanliness: 4
- diet: "veg"
- noiseTolerance: "moderate"
- budget: 25000
- profile_image: <file>
- languages: ["1", "2"]

Response: 200 OK
{
  "message": "Profile saved successfully"
}
```

---

#### 3. Discovery/Matching Endpoints

**GET /api/matches/:userId?city=Mumbai**
```javascript
Response: 200 OK
[
  {
    "user_id": 5,
    "name": "Jane Smith",
    "city": "Mumbai",
    "budget": 23000,
    "compatibility_score": 85,
    "profile_image": "/uploads/profile_image-yyy.jpg"
  },
  {
    "user_id": 7,
    "name": "Alice Johnson",
    "city": "Mumbai",
    "budget": 26000,
    "compatibility_score": 72,
    "profile_image": "/uploads/profile_image-zzz.jpg"
  }
]
```

**GET /api/users**
```javascript
Response: 200 OK
[
  {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com"
  },
  { ... }
]
```

---

#### 4. Shortlist Endpoints

**GET /api/shortlist/:userId**
```javascript
Response: 200 OK
[
  {
    "target_id": 5,
    "name": "Jane Smith",
    "city": "Mumbai",
    "created_at": "2025-05-24T10:30:00Z"
  }
]
```

**POST /api/shortlist**
```javascript
Request:
{
  "userId": 1,
  "targetId": 5
}

Response: 200 OK
{
  "message": "Added to shortlist"
}
```

---

#### 5. Messaging Endpoints

**GET /api/messages/:user1/:user2**
```javascript
Response: 200 OK
[
  {
    "id": 1,
    "sender_id": 1,
    "receiver_id": 5,
    "message": "Hi Jane, interested in viewing the apartment?",
    "created_at": "2025-05-24T10:15:00Z"
  },
  {
    "id": 2,
    "sender_id": 5,
    "receiver_id": 1,
    "message": "Yes, when are you free?",
    "created_at": "2025-05-24T10:20:00Z"
  }
]
```

**POST /api/send-message**
```javascript
Request:
{
  "sender_id": 1,
  "receiver_id": 5,
  "message": "Let's schedule a meeting"
}

Response: 201 Created
{
  "id": 3,
  "message": "Message sent successfully"
}
```

---

#### 6. Agreement Endpoints

**GET /api/agreement/:u1/:u2**
```javascript
Response: 200 OK
{
  "content": "ROOMMATE AGREEMENT\n\nThis agreement is entered into by John Doe and Jane Smith...",
  "status": "template"
}
```

**POST /api/agreement**
```javascript
Request:
{
  "userA_id": 1,
  "userB_id": 5,
  "content": "[Agreement text...]"
}

Response: 200 OK
{
  "message": "Agreement saved"
}
```

---

#### 7. Utility Endpoints

**GET /api/languages**
```javascript
Response: 200 OK
[
  { "id": 1, "name": "English" },
  { "id": 2, "name": "Hindi" },
  { "id": 3, "name": "Spanish" }
]
```

**GET /api/health**
```javascript
Response: 200 OK
{
  "ok": true,
  "status": "Hey Nomads API Running",
  "version": "2.0.0"
}
```

---

### Error Responses

All errors follow this format:

```javascript
400 Bad Request
{
  "error": "Valid userId is required"
}

401 Unauthorized
{
  "error": "Invalid credentials"
}

404 Not Found
{
  "error": "User not found"
}

500 Internal Server Error
{
  "error": "Database error"
}
```

---

## 🎨 Frontend Architecture

### Routing Structure

```
/                          → Login Page (default redirect)
/login                     → Login & Register (combined)
/discover                  → Browse matches (protected)
/profile/:userId           → View user profile (protected)
/profile/edit              → Edit own profile (protected)
/compare/:userId1/:userId2 → Compare two profiles (protected)
/shortlist                 → Saved matches (protected)
/inbox                     → Messaging (protected)
/agreement/:u1/:u2         → Generate agreement (protected)
```

### State Management

**Global Auth State:**
```javascript
// utils/api.js - auth object
{
  getUserId()     // Get stored userId
  setUserId(id)   // Store userId
  getUserName()   // Get cached name
  setUserName(n)  // Store name
  logout()        // Clear storage
}
```

**Component State:**
- Each page manages its own state with `useState`
- Form data, loading states, errors handled locally
- API data fetched with custom `apiFetch()` helper

---

### Page Components

#### RegisterPage
- Combined login & registration UI
- Toggle between modes
- Password visibility toggle
- Error handling & validation
- Redirects to `/discover` on success

#### DiscoverPage
- Browse all matches
- City filter dropdown
- Sorted by compatibility score (descending)
- Infinite scroll or pagination
- "View Profile" → `/profile/:userId`
- "Compare" → `/compare/:userId/:myId`
- "Shortlist" button

#### ProfilePage
- View any user's full profile
- Display: bio, occupation, city, image
- Lifestyle preferences: sleep, cleanliness, diet, noise, budget
- Languages spoken
- Compatibility score (vs logged-in user)
- Action buttons: Message, Shortlist, Generate Agreement

#### EditProfilePage
- Form to update profile
- File upload for profile image
- Multi-select for languages
- Save button with loading state
- Success/error notifications

#### ComparePage
- Side-by-side comparison of two profiles
- Key metrics highlighted (budget, cleanliness, etc.)
- Compatibility breakdown
- Quick action buttons

#### ShortlistPage
- Grid/List of saved matches
- Sort by date added
- Remove from shortlist option
- Quick access to message or view

#### InboxPage
- List of conversations
- Click to open chat thread
- Message input at bottom
- Real-time message rendering
- Timestamps

#### AgreementEditor
- Template display
- Editable agreement text
- Save/Download options
- Sign status tracking

---

### Reusable Components

**Navbar**
- Logo and title
- User menu (Profile, Logout)
- Active page indicator
- Responsive mobile menu

**Layout**
- Wrapper component
- Navbar included
- Padding/spacing
- Dark mode styles

**MatchCard**
- Compact match preview
- Name, city, photo, score
- Quick action buttons
- Hover effects

**UserAvatar**
- Circular image display
- Fallback initials
- Size variants

---

## 🎯 Matching Algorithm

### Compatibility Score Calculation

**File:** `backend/utils/matchEngine.js`

```javascript
function calculateCompatibilityScore(u1, u2) {
  const weights = {
    city: 30,           // Geographic location
    budget: 25,         // Financial compatibility
    cleanliness: 20,    // Cleanliness standards
    timeline: 25        // Move-in date alignment
  };
  
  let score = 0;
  
  // 1. City Match (30 points)
  // Exact match gets full points
  
  // 2. Budget Compatibility (25 points)
  // Points scale inversely with difference
  // Formula: 25 * (1 - (diff / maxBudget))
  
  // 3. Cleanliness Match (20 points)
  // Scale-based comparison (1-5 scale)
  // Formula: 20 * (1 - (diff / 5))
  
  // 4. Timeline Compatibility (25 points)
  // ≤7 days: 25 points (excellent)
  // ≤30 days: 15 points (moderate)
  // >30 days: 5 points (poor)
  
  return Math.round(score);
}
```

### Score Ranges
- **90-100**: Excellent match
- **75-89**: Good match
- **60-74**: Moderate match
- **Below 60**: Low compatibility

### Future Enhancements
- Weight customization per user
- Lifestyle preference matching (sleep, diet, noise)
- Language common matching
- Noise tolerance alignment
- Habit compatibility (smoking, drinking, partying)

---

## 🔐 Authentication & Security

### Password Security
- **Algorithm**: bcryptjs with 10 salt rounds
- **Hashing**: Done before storage
- **Verification**: `bcrypt.compare()` on login
- **Never logged**: Plaintext passwords never exposed (security fix applied)

### Frontend Auth Storage
```javascript
// localStorage
{
  "userId": "1",
  "userName": "John Doe"
}
```

### Session Management
- **Stateless**: No server-side sessions
- **Frontend-managed**: localStorage persists across page refresh
- **Protected routes**: PrivateRoute component checks userId
- **Logout**: Clears localStorage, redirects to /login

### CORS Configuration
```javascript
{
  origin: 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}
```

### File Upload Security
- **Storage**: `/backend/uploads/` (local filesystem)
- **Naming**: Timestamp + random ID (prevents collision)
- **Validation**: File size limits via Multer config
- **Access**: Served via `/uploads/` static route

### Production Considerations
- [ ] HTTPS enforcement
- [ ] JWT tokens for API auth
- [ ] Rate limiting on auth endpoints
- [ ] Refresh token rotation
- [ ] CSRF protection
- [ ] Input sanitization
- [ ] SQL injection prevention (parameterized queries used)

---

## 👥 User Flows

### 1. Registration Flow
```
User visits app
  ↓
Sees login form (no userId in localStorage)
  ↓
Clicks "Create Account" tab
  ↓
Enters: name, email, password
  ↓
Validates input (frontend)
  ↓
POST /api/register
  ↓
Backend creates user + default profile
  ↓
Returns userId
  ↓
Frontend stores userId in localStorage
  ↓
Redirects to /discover
  ↓
Prompts to complete profile
```

### 2. Profile Completion Flow
```
User in /discover (empty profile)
  ↓
Clicks "Edit Profile"
  ↓
Navigates to /profile/edit
  ↓
Fills out form:
  - Bio, occupation, city
  - Lifestyle: sleep, cleanliness, diet, noise
  - Financial: budget, deposit, flat type
  - Habits: smoking, drinking, partying
  - Image upload
  - Languages (multi-select)
  ↓
Submits form
  ↓
POST /api/profile (multipart/form-data)
  ↓
Backend validates & saves
  ↓
Shows success message
  ↓
Redirect to /discover
```

### 3. Discovery & Matching Flow
```
User in /discover
  ↓
Sees list of matches (sorted by compatibility score)
  ↓
Optional: Filter by city
  ↓
Clicks on match card
  ↓
Navigates to /profile/:userId
  ↓
Views full profile
  ↓
Actions available:
  - "Message" → /inbox (open chat)
  - "Compare" → /compare/:userId/:myId
  - "Shortlist" → Saves to shortlists table
  ↓
Can repeat for other matches
```

### 4. Shortlist & Comparison Flow
```
User shortlists several matches
  ↓
Navigates to /shortlist
  ↓
Views all saved matches
  ↓
Selects two for detailed comparison
  ↓
Navigates to /compare/:u1/:u2
  ↓
Sees side-by-side attributes
  ↓
Can message either user
```

### 5. Messaging Flow
```
User views profile of interest
  ↓
Clicks "Message"
  ↓
Navigates to /inbox
  ↓
Chat thread opens with target user
  ↓
Types message in input field
  ↓
POST /api/send-message
  ↓
Message stored in database
  ↓
GET /api/messages/:user1/:user2 (polling)
  ↓
New messages displayed in real-time
  ↓
User can respond
```

### 6. Agreement Generation Flow
```
User finds potential roommate
  ↓
Navigates to /agreement/:u1/:u2
  ↓
GET /api/agreement/:u1/:u2
  ↓
Backend generates template with both user info
  ↓
Template rendered with editable text
  ↓
User customizes if needed
  ↓
POST /api/agreement (save)
  ↓
Stored in agreements table
  ↓
Can be viewed/edited later
```

---

## 🎨 Design System

### Color Palette

**Brand Colors:**
```css
--brand-primary:    #FF6B6B    /* Vibrant Red */
--brand-secondary:  #FFB266    /* Warm Orange */
--brand-accent:     #FFA858    /* Coral */
--surface-bg:       #F8F7FF    /* Light Purple Tint */
--text-dark:        #1A1A2E    /* Near Black */
--text-light:       #7A7A8E    /* Gray */
```

**Semantic Colors:**
```css
--success:  #2ECC71    /* Green */
--warning:  #F39C12    /* Orange */
--error:    #E74C3C    /* Red */
--info:     #3498DB    /* Blue */
--neutral:  #ECF0F1    /* Light Gray */
```

### Typography

**Font Stack:**
```
Font Family: System fonts (no external font files)
Primary: -apple-system, BlinkMacSystemFont, 'Segoe UI'
Fallback: Arial, sans-serif
```

**Sizes:**
```
h1:  text-4xl (36px)
h2:  text-3xl (30px)
h3:  text-2xl (24px)
h4:  text-xl  (20px)
p:   text-base (16px)
small: text-sm (14px)
```

### Spacing Scale
```
xs: 4px
sm: 8px
md: 16px
lg: 24px
xl: 32px
2xl: 48px
```

### Components

**Button Variants:**
- Primary (red bg, white text)
- Secondary (outline, red border)
- Tertiary (ghost, no bg)
- Disabled state

**Card:**
- Rounded corners (12px)
- Shadow on hover
- Padding: 16px
- Background: white/light

**Input:**
- Border: 1px solid #ddd
- Focus: Red outline
- Padding: 12px
- Rounded: 8px

### Animations

**Framer Motion:**
- Page transitions: fade + slide
- Card hover: lift + shadow
- Loading: spinner animation
- Success: confetti burst

---

## 💻 Development Guide

### Setup Instructions

**Prerequisites:**
- Node.js 14+ with npm
- MySQL 8.0+
- A text editor (VS Code recommended)

**Steps:**

1. **Clone & Install**
```bash
cd backend
npm install

cd ../frontend-react
npm install
```

2. **Configure Backend**
```bash
cd backend
cp .env.example .env
# Edit .env with your MySQL credentials
```

3. **Start MySQL**
```bash
# Windows: Open MySQL Workbench
# macOS: brew services start mysql
# Linux: sudo systemctl start mysql
```

4. **Run Servers**
```bash
# Terminal 1 - Backend
cd backend
npm start        # or npm run dev (with nodemon)

# Terminal 2 - Frontend
cd frontend-react
npm run dev
```

5. **Access Application**
```
Frontend: http://localhost:5173
API: http://localhost:3000
Database: localhost:3306 (hey_roomie)
```

---

### Development Workflow

**Code Style:**
- ESLint configured for frontend
- Consistent indentation (2 spaces)
- Prefer const/let over var
- Arrow functions for callbacks

**Testing:**
- Manual testing via browser
- API testing via curl/Postman
- Database queries via MySQL Workbench

**Common Tasks:**

```bash
# Backend
npm start              # Start production
npm run dev            # Start with auto-reload
node migrate.js        # Run migrations

# Frontend
npm run dev            # Start dev server
npm run build          # Production build
npm run preview        # Preview build
npm run lint           # Run ESLint
```

---

### Debugging

**Backend:**
- Enable request logging: Add `app.use(express.static(...))`
- Database errors printed to console
- Use `console.log()` for tracing
- Check `backend/server.log` for runtime issues

**Frontend:**
- Browser DevTools (F12)
- React DevTools extension
- Framer Motion DevTools
- Network tab for API calls

**Common Issues:**

```
CORS Error:
  ✓ Verify FRONTEND_ORIGIN in .env
  ✓ Check backend is running
  ✓ Ensure credentials: true

DB Connection Error:
  ✓ Verify MySQL is running
  ✓ Check password in .env
  ✓ Ensure database exists

Port Already in Use:
  ✓ Check what's running: lsof -i :3000
  ✓ Kill process: kill -9 <PID>
  ✓ Change PORT in .env
```

---

### Performance Optimization

**Frontend:**
- [ ] Code splitting (React lazy)
- [ ] Image optimization
- [ ] CSS minification (Vite)
- [ ] Caching strategies

**Backend:**
- [ ] Database query indexing
- [ ] Connection pooling (already done: 10 connections)
- [ ] API response caching
- [ ] Compression middleware

**Database:**
- [ ] Composite indexes on foreign keys
- [ ] Query optimization for large datasets
- [ ] Archive old messages

---

## 📦 Deployment

### Frontend Deployment (Netlify)

**Configuration:** `netlify.toml`
```toml
[build]
  base = "frontend-react"
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

**Steps:**
1. Push to GitHub
2. Connect to Netlify
3. Auto-deploys on push
4. Environment variables: `VITE_API_URL=<backend-url>`

### Backend Deployment

**Options:**
- Heroku (with MySQL addon)
- DigitalOcean (VPS)
- AWS (EC2 + RDS)
- Railway (simple, git-based)

**Requirements:**
- Node.js runtime
- MySQL database
- Environment variables

**Process:**
1. Build and test locally
2. Push to Git
3. Deploy via CI/CD
4. Set production environment variables

---

## 📚 Additional Resources

- **React Docs**: https://react.dev
- **Express Docs**: https://expressjs.com
- **Tailwind CSS**: https://tailwindcss.com
- **Framer Motion**: https://www.framer.com/motion
- **MySQL Docs**: https://dev.mysql.com/doc

---

## 🔄 Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0.0 | 2025-05-24 | Production release with React refactor |
| 1.0.0 | Earlier | Initial vanilla JS version |

---

## 📝 License

MIT License - See repository for details.

---

**Last Updated**: 2025-05-24  
**Maintainers**: Hey Nomads Team
