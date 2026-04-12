/**
 * Hey Roomie - Main Application JavaScript
 * Handles dynamic rendering of matches and user interactions
 */

const API_URL = 'http://localhost:3000/api';

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get the currently logged-in user ID from localStorage
 * @returns {string|null} userId or null if not logged in
 */
function getCurrentUserId() {
    return localStorage.getItem('userId');
}

/**
 * Get the currently logged-in user name from localStorage
 * @returns {string|null} userName or null if not set
 */
function getCurrentUserName() {
    return localStorage.getItem('userName');
}

/**
 * Check if user is authenticated, redirect to login if not
 */
function requireAuth() {
    const userId = getCurrentUserId();
    if (!userId) {
        window.location.href = 'login.html';
        return null;
    }
    return userId;
}

/**
 * Get CSS class for compatibility score badge
 * @param {number} score - Compatibility score (0-100)
 * @returns {string} CSS class name
 */
function getScoreClass(score) {
    if (score >= 80) return 'score-high';
    if (score >= 60) return 'score-medium';
    return 'score-low';
}

/**
 * Format values for display with icons/labels
 * @param {string} key - The field key
 * @param {any} value - The value to format
 * @returns {string} Formatted display string
 */
function formatValue(key, value) {
    const formatters = {
        sleep_time: {
            'early': '🌅 Early Bird',
            'late': '🌙 Night Owl',
            'flexible': '⏰ Flexible'
        },
        diet: {
            'veg': '🥗 Vegetarian',
            'eggetarian': '🥚 Eggetarian',
            'nonveg': '🍗 Non-Veg'
        },
        noise_tolerance: {
            'quiet': '🔇 Quiet',
            'moderate': '🔉 Moderate',
            'loud': '🔊 Loud OK'
        },
        tax_bracket: {
            'low': '💰 Low',
            'medium': '💰💰 Medium',
            'high': '💰💰💰 High'
        },
        cleanliness: {
            1: '⭐ Messy',
            2: '⭐⭐',
            3: '⭐⭐⭐ Average',
            4: '⭐⭐⭐⭐',
            5: '⭐⭐⭐⭐⭐ Very Clean'
        }
    };

    return formatters[key]?.[value] || value;
}

/**
 * Convert a timestamp into a relative string (e.g., "Just now", "5m ago")
 * @param {string|Date} date - The date to format
 * @returns {string} Human-readable relative time
 */
function getRelativeTime(date) {
    if (!date) return '';
    const now = new Date();
    const then = new Date(date);
    const diffInSeconds = Math.floor((now - then) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;

    return then.toLocaleDateString();
}

// ============================================
// MATCHES FUNCTIONS
// ============================================

/**
 * Clear all matches from the container
 * Call this before rendering new matches to prevent duplicates
 */
function clearMatches() {
    const container = document.getElementById('matches-container');
    if (container) {
        container.innerHTML = '';
    }
}

/**
 * Show loading state in the matches container
 */
function showLoading() {
    const container = document.getElementById('matches-container');
    if (container) {
        container.innerHTML = '<div class="loading">Finding your best matches...</div>';
    }
}

/**
 * Show empty state when no matches are found
 */
function showEmptyState() {
    const container = document.getElementById('matches-container');
    if (container) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>No Matches Yet</h3>
                <p>Be the first to join! Share with friends to find roommates.</p>
            </div>
        `;
    }
}

/**
 * Show error state with retry option
 * @param {Error} error - The error object
 */
function showError(error) {
    const container = document.getElementById('matches-container');
    if (container) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>Error Loading Matches</h3>
                <p>${error.message || 'Something went wrong. Please try again later.'}</p>
                <button onclick="loadMatches()" class="btn btn-primary">Retry</button>
            </div>
        `;
    }
}

/**
 * Show "Complete Your Profile" state when user hasn't created a profile
 */
function showNoProfileState() {
    const container = document.getElementById('matches-container');
    if (container) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>Complete Your Profile First!</h3>
                <p>You need to set up your profile before we can find matches for you.</p>
                <a href="profile.html" class="btn btn-primary">Set Up Profile</a>
            </div>
        `;
    }
}

/**
 * Create a match card DOM element
 * @param {Object} match - Match data from API
 * @param {Object} match.user - User object
 * @param {number} match.user.id - User ID
 * @param {string} match.user.name - User name
 * @param {string} match.user.sleep_time - Sleep schedule
 * @param {string} match.user.diet - Diet preference
 * @param {string} match.user.noise_tolerance - Noise tolerance
 * @param {number} match.user.budget - Monthly budget
 * @param {string} match.user.tax_bracket - Income bracket
 * @param {number} match.user.cleanliness - Cleanliness level (1-5)
 * @param {number} match.score - Compatibility score
 * @param {Array} match.languages - Array of language strings
 * @returns {HTMLElement} The match card DOM element
 */
function renderMatchCard(match) {
    // Create the main card container
    const card = document.createElement('div');
    card.className = 'match-card';

    // Create score badge (circular)
    const scoreBadge = document.createElement('div');
    scoreBadge.className = `match-score ${getScoreClass(match.score)}`;
    scoreBadge.textContent = `${match.score}%`;
    card.appendChild(scoreBadge);

    // Create name element
    const nameEl = document.createElement('div');
    nameEl.className = 'match-name';
    nameEl.textContent = match.name || 'Unknown User';
    card.appendChild(nameEl);

    // Create details grid
    const detailsGrid = document.createElement('div');
    detailsGrid.className = 'match-details';

    // Define all attributes to display
    const attributes = [
        { key: 'sleep_time', label: 'Sleep', value: match.sleep_time },
        { key: 'cleanliness', label: 'Cleanliness', value: match.cleanliness },
        { key: 'diet', label: 'Diet', value: match.diet },
        { key: 'noise_tolerance', label: 'Noise', value: match.noise_tolerance },
        { key: 'budget', label: 'Budget', value: match.budget, format: (v) => `₹${v.toLocaleString()}` },
        { key: 'tax_bracket', label: 'Income', value: match.tax_bracket }
    ];

    // Create detail elements for each attribute
    attributes.forEach(attr => {
        const detail = document.createElement('div');
        detail.className = 'match-detail';

        const label = document.createElement('label');
        label.textContent = attr.label;
        detail.appendChild(label);

        const value = document.createElement('span');
        if (attr.format) {
            value.textContent = attr.format(attr.value);
        } else {
            value.textContent = formatValue(attr.key, attr.value);
        }
        detail.appendChild(value);

        detailsGrid.appendChild(detail);
    });

    card.appendChild(detailsGrid);

    // Create languages section if languages exist
    if (match.languages && match.languages.length > 0) {
        const languagesDiv = document.createElement('div');
        languagesDiv.className = 'languages-list';

        match.languages.forEach(lang => {
            const tag = document.createElement('span');
            tag.className = 'language-tag';
            tag.textContent = lang;
            languagesDiv.appendChild(tag);
        });

        card.appendChild(languagesDiv);
    }

    return card;
}

/**
 * Render a list of matches to the container
 * @param {Array} matches - Array of match objects from API
 */
function renderMatchesList(matches) {
    const container = document.getElementById('matches-container');
    if (!container) return;

    // Clear any existing content
    clearMatches();

    // Create summary text
    const userName = getCurrentUserName();
    const summary = document.createElement('p');
    summary.style.cssText = 'margin-bottom: 20px; color: #666;';
    summary.textContent = `Found ${matches.length} potential roommate(s) for you, ${userName || 'there'}!`;
    container.appendChild(summary);

    // Create matches grid
    const grid = document.createElement('div');
    grid.className = 'matches-grid';

    // Render each match card and append to grid
    matches.forEach(match => {
        const card = renderMatchCard(match);
        grid.appendChild(card);
    });

    container.appendChild(grid);
}

/**
 * Load matches from the backend API
 * Fetches matches for the currently logged-in user
 * Handles loading states, errors, and empty results
 */
async function loadMatches() {
    const userId = getCurrentUserId();

    // Ensure user is logged in
    if (!userId) {
        window.location.href = 'login.html';
        return;
    }

    // Show loading state
    showLoading();

    try {
        // Fetch matches from API
        const response = await fetch(`${API_URL}/matches/${userId}`);

        // Handle 404 - User hasn't created a profile yet
        if (response.status === 404) {
            showNoProfileState();
            return;
        }

        // Handle other errors
        if (!response.ok) {
            throw new Error('Failed to load matches');
        }

        // Parse response
        const matches = await response.json();

        // Handle empty matches
        if (!matches || matches.length === 0) {
            showEmptyState();
            return;
        }

        // Render all matches dynamically
        renderMatchesList(matches);

    } catch (error) {
        console.error('Error loading matches:', error);
        showError(error);
    }
}

// ============================================
// AUTH FUNCTIONS
// ============================================

/**
 * Log out the current user
 * Clears localStorage and redirects to login page
 */
function logout() {
    localStorage.clear();
    window.location.href = 'login.html';
}

/**
 * Save user data to localStorage after login/registration
 * @param {Object} user - User object with id, name, email
 */
function saveUserSession(user) {
    if (user.id) localStorage.setItem('userId', user.id);
    if (user.name) localStorage.setItem('userName', user.name);
    if (user.email) localStorage.setItem('userEmail', user.email);
}

// ============================================
// EXPORTS (for module systems if needed)
// ============================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getCurrentUserId,
        getCurrentUserName,
        requireAuth,
        getScoreClass,
        formatValue,
        clearMatches,
        showLoading,
        showEmptyState,
        showError,
        showNoProfileState,
        renderMatchCard,
        renderMatchesList,
        loadMatches,
        logout,
        saveUserSession,
        API_URL
    };
}
