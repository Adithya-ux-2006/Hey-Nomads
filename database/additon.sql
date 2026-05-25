USE hey_roomie;

-- ================================
-- 1. JOIN: Users + Profiles
-- ================================
SELECT 
    u.id,
    u.name,
    u.email,
    p.city,
    p.budget,
    p.sleep_time,
    p.cleanliness
FROM users u
JOIN profiles p ON u.id = p.user_id;


-- ================================
-- 2. FILTER + JOIN (Fix Mumbai search)
-- ================================
SELECT 
    u.name,
    p.city,
    p.budget
FROM users u
JOIN profiles p ON u.id = p.user_id
WHERE LOWER(p.city) LIKE LOWER('%mumbai%');


-- ================================
-- 3. GROUP BY (Users per city)
-- ================================
SELECT 
    city,
    COUNT(*) AS total_users
FROM profiles
GROUP BY city;


-- ================================
-- 4. GROUP BY (Average budget per city)
-- ================================
SELECT 
    city,
    AVG(budget) AS avg_budget
FROM profiles
GROUP BY city;


-- ================================
-- 5. JOIN (Shortlist with names)
-- ================================
SELECT 
    u1.name AS user,
    u2.name AS shortlisted_person,
    s.created_at
FROM shortlists s
JOIN users u1 ON s.user_id = u1.id
JOIN users u2 ON s.target_id = u2.id;


-- ================================
-- 6. JOIN (Messages with names)
-- ================================
SELECT 
    u1.name AS sender,
    u2.name AS receiver,
    m.message,
    m.created_at
FROM messages m
JOIN users u1 ON m.sender_id = u1.id
JOIN users u2 ON m.receiver_id = u2.id;


-- ================================
-- 7. VIEW (Advanced concept)
-- ================================
CREATE OR REPLACE VIEW user_profile_view AS
SELECT 
    u.id,
    u.name,
    u.email,
    p.city,
    p.budget,
    p.sleep_time,
    p.cleanliness
FROM users u
JOIN profiles p ON u.id = p.user_id;


-- ================================
-- 8. USE VIEW
-- ================================
SELECT * FROM user_profile_view;


-- ================================
-- 9. MATCHING LOGIC (Basic)
-- ================================
SELECT 
    u2.name,
    p2.city,
    p2.budget
FROM profiles p1
JOIN profiles p2 ON p1.user_id != p2.user_id
JOIN users u2 ON p2.user_id = u2.id
WHERE p1.user_id = 1
AND p1.sleep_time = p2.sleep_time
AND ABS(p1.budget - p2.budget) < 5000;


-- ================================
-- 10. COUNT TOTAL USERS
-- ================================
SELECT COUNT(*) AS total_users FROM users;


-- ================================
-- 11. DISTINCT CITIES
-- ================================
SELECT DISTINCT city FROM profiles;


-- ================================
-- 12. USERS WITH HIGH CLEANLINESS
-- ================================
SELECT u.name, p.cleanliness
FROM users u
JOIN profiles p ON u.id = p.user_id
WHERE p.cleanliness >= 4;


-- ================================
-- 13. USERS WITH SAME DIET
-- ================================
SELECT u.name, p.diet
FROM users u
JOIN profiles p ON u.id = p.user_id
WHERE p.diet = 'veg';


-- ================================
-- 14. ORDER BY BUDGET
-- ================================
SELECT u.name, p.budget
FROM users u
JOIN profiles p ON u.id = p.user_id
ORDER BY p.budget DESC;


-- ================================
-- 15. LIMIT RESULTS
-- ================================
SELECT u.name, p.city
FROM users u
JOIN profiles p ON u.id = p.user_id
LIMIT 5;