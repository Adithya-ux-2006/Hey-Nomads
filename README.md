# Hey Roomie - Roommate Matchmaking Platform

A simple web application to find compatible roommates based on lifestyle preferences.

---

## Project Structure

```
hey-roomie/
│
├── backend/
│   ├── server.js         # Express server with all API routes
│   ├── db.js             # MySQL database connection
│   └── package.json      # Node dependencies
│
├── frontend/
│   ├── login.html        # Login & Register page
│   ├── profile.html      # Create/Edit profile
│   ├── matches.html      # View matched roommates
│   └── style.css         # All styling
│
└── database/
    └── schema.sql        # MySQL database schema
```

---

## Setup Instructions

### Step 1: Install MySQL Workbench 8.0

1. Download and install MySQL Workbench from: https://dev.mysql.com/downloads/workbench/
2. During setup, set your **root password** (remember this!)
3. Start MySQL server

### Step 2: Create the Database

1. Open MySQL Workbench
2. Connect to your local MySQL server (localhost:3306)
3. Click **File → Open SQL Script**
4. Select `database/schema.sql`
5. Click the **Execute** button (lightning bolt icon)
6. Verify the tables were created by running: `SHOW TABLES;`

### Step 3: Configure Database Credentials

1. Open `backend/db.js` in a text editor
2. Update the password field with your MySQL root password:

```javascript
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'YOUR_MYSQL_PASSWORD_HERE',  // <-- CHANGE THIS
    database: 'hey_roomie',
    // ...
};
```

### Step 4: Install Node.js Dependencies

1. Open Command Prompt or Terminal
2. Navigate to the backend folder:
   ```
   cd backend
   ```
3. Install dependencies:
   ```
   npm install
   ```

### Step 5: Start the Server

1. In the same terminal (backend folder), run:
   ```
   npm start
   ```
   
   Or for development with auto-restart:
   ```
   npm run dev
   ```

2. You should see:
   ```
   Database connected successfully
   Hey Roomie server running on http://localhost:3000
   ```

### Step 6: Open the Application

1. Open your web browser
2. Go to: `http://localhost:3000/login.html`
3. Start using the app!

---

## How to Use

### 1. Register / Login
- Enter your name, email, and password
- If you already have an account, switch to the Login tab

### 2. Complete Your Profile
- Fill in your lifestyle preferences:
  - Sleep schedule (Early bird, Night owl, Flexible)
  - Cleanliness level (1-5)
  - Diet preference
  - Noise tolerance
  - Monthly budget
  - Income bracket
  - Languages you speak
- Click **Save Profile**

### 3. View Your Matches
- Go to "Find Matches" page
- See ranked list of compatible roommates
- Compatibility score (0-100) based on:
  - Sleep match: +25 points
  - Budget similarity: +20 points
  - Cleanliness match: +20 points
  - Diet match: +15 points
  - Noise tolerance: +10 points
  - Common languages: +10 points

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/register` | Create new user |
| POST | `/api/login` | Authenticate user |
| POST | `/api/profile` | Save/update profile |
| GET | `/api/profile/:userId` | Get user profile |
| GET | `/api/users` | Get all users with profiles |
| GET | `/api/languages` | Get all languages |
| GET | `/api/matches/:userId` | Get ranked matches |

---

## Troubleshooting

### "Database connection failed"
- Check that MySQL server is running
- Verify your password in `db.js` is correct
- Try connecting in MySQL Workbench first

### "Cannot find module"
- Make sure you ran `npm install` in the backend folder

### "Port already in use"
- Change the PORT in `server.js` (e.g., to 3001)
- Or kill the process using port 3000

### CORS errors
- Make sure you're accessing via `http://localhost:3000`, not file://

---

## Technologies Used

- **Frontend**: HTML, CSS, Vanilla JavaScript
- **Backend**: Node.js, Express
- **Database**: MySQL

---

## Features

- User registration & login
- Detailed profile creation
- Smart matching algorithm
- Language preferences
- Clean, responsive UI
- No external dependencies (except Node packages)