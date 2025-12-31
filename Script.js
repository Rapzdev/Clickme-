// Firebase Configuration
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, updateDoc, query, orderBy, limit, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyAXQiftlIzLeoizjJ4Y-UgpKUbK5SmuUUE",
    authDomain: "clicknow-questme.firebaseapp.com",
    projectId: "clicknow-questme",
    storageBucket: "clicknow-questme.firebasestorage.app",
    messagingSenderId: "1074756983426",
    appId: "1:1074756983426:web:f501cccd16ab86f9def29b",
    measurementId: "G-K6ZRMZJRM4"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let userLocation = null;
let currentScore = 0;
let totalClicks = 0;
let clickTimes = [];
let isAdmin = false;

// Get country from coordinates
async function getCountryFromCoords(lat, lon) {
    try {
        const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
        const data = await response.json();
        return data.countryName || 'Unknown';
    } catch (error) {
        console.error('Error getting country:', error);
        return 'Unknown';
    }
}

// Request Location
window.requestLocation = function() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const country = await getCountryFromCoords(position.coords.latitude, position.coords.longitude);
                userLocation = country;
                register();
            },
            (error) => {
                showError('❌ Lokasi diperlukan untuk pendaftaran!');
            }
        );
    } else {
        showError('❌ Browser tidak menyokong geolocation');
    }
};

// Show/Hide Forms
window.showLogin = function() {
    document.getElementById('loginForm').classList.add('active');
    document.getElementById('registerForm').classList.remove('active');
    document.querySelectorAll('.tab-btn')[0].classList.add('active');
    document.querySelectorAll('.tab-btn')[1].classList.remove('active');
    document.getElementById('authError').textContent = '';
};

window.showRegister = function() {
    document.getElementById('loginForm').classList.remove('active');
    document.getElementById('registerForm').classList.add('active');
    document.querySelectorAll('.tab-btn')[0].classList.remove('active');
    document.querySelectorAll('.tab-btn')[1].classList.add('active');
    document.getElementById('authError').textContent = '';
};

// Register
async function register() {
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value;

    if (!username || !password) {
        showError('❌ Sila isi semua medan');
        return;
    }

    if (!userLocation) {
        showError('❌ Sila benarkan lokasi');
        return;
    }

    try {
        const email = `${username.toLowerCase()}@goldenclicker.game`;
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        await setDoc(doc(db, 'users', userCredential.user.uid), {
            username: username,
            country: userLocation,
            score: 0,
            isOnline: true,
            lastActive: new Date().toISOString(),
            createdAt: new Date().toISOString()
        });

        showError('');
    } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
            showError('❌ Username sudah digunakan');
        } else if (error.code === 'auth/weak-password') {
            showError('❌ Password terlalu lemah (minimum 6 karakter)');
        } else {
            showError('❌ Ralat: ' + error.message);
        }
    }
}

// Login
window.login = async function() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!username || !password) {
        showError('❌ Sila isi semua medan');
        return;
    }

    try {
        const email = `${username.toLowerCase()}@goldenclicker.game`;
        await signInWithEmailAndPassword(auth, email, password);
        showError('');
    } catch (error) {
        showError('❌ Username atau password salah');
    }
};

// Logout
window.logout = async function() {
    if (currentUser) {
        await updateDoc(doc(db, 'users', currentUser.uid), {
            isOnline: false,
            lastActive: new Date().toISOString()
        });
    }
    await signOut(auth);
    window.location.href = 'index.html';
};

// Show Error
function showError(message) {
    document.getElementById('authError').textContent = message;
}

// Show Page
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
    }
}

// Animate click counter
function animateClickCounter() {
    const counter = document.getElementById('clickCounter');
    if (!counter) return;
    
    counter.style.animation = 'none';
    setTimeout(() => {
        counter.style.animation = 'floatUp 0.8s ease-out';
    }, 10);
}

// Add animation to CSS dynamically
const style = document.createElement('style');
style.textContent = `
    @keyframes floatUp {
        0% {
            opacity: 1;
            transform: translate(-50%, -50%) translateY(0) scale(1);
        }
        100% {
            opacity: 0;
            transform: translate(-50%, -50%) translateY(-100px) scale(1.5);
        }
    }
`;
document.head.appendChild(style);

// Increment Score
window.incrementScore = async function() {
    if (!currentUser) return;

    currentScore++;
    totalClicks++;
    
    // Update UI
    const scoreElement = document.getElementById('scoreValue');
    if (scoreElement) {
        scoreElement.textContent = currentScore;
    }
    
    const totalClicksElement = document.getElementById('totalClicks');
    if (totalClicksElement) {
        totalClicksElement.textContent = totalClicks;
    }

    // Animate
    animateClickCounter();

    // Track click times for CPM calculation
    const now = Date.now();
    clickTimes.push(now);
    clickTimes = clickTimes.filter(time => now - time < 60000); // Keep last minute
    
    const cpm = clickTimes.length;
    const cpmElement = document.getElementById('clicksPerMin');
    if (cpmElement) {
        cpmElement.textContent = cpm;
    }

    // Update Firebase (throttled)
    if (currentScore % 5 === 0) {
        try {
            await updateDoc(doc(db, 'users', currentUser.uid), {
                score: currentScore,
                lastActive: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error updating score:', error);
        }
    }
};

// Update user rank
async function updateUserRank() {
    if (!currentUser) return;
    
    const rankElement = document.getElementById('userRank');
    if (!rankElement) return;

    try {
        const q = query(collection(db, 'users'), orderBy('score', 'desc'));
        const snapshot = await getDocs(q);
        
        let rank = 1;
        snapshot.forEach((doc) => {
            if (doc.id === currentUser.uid) {
                rankElement.textContent = `Ranking: #${rank}`;
                return;
            }
            rank++;
        });
    } catch (error) {
        console.error('Error getting rank:', error);
    }
}

// Go to admin page
window.goToAdmin = function() {
    window.location.href = 'admin.html';
};

// Load Admin Panel (for admin.html)
async function loadAdminPanel() {
    const playersSnapshot = await getDocs(collection(db, 'users'));
    const players = [];
    let onlineCount = 0;
    let highestScore = 0;

    playersSnapshot.forEach((doc) => {
        const data = doc.data();
        players.push({ id: doc.id, ...data });
        
        if (data.isOnline) onlineCount++;
        if (data.score > highestScore) highestScore = data.score;
    });

    const totalElement = document.getElementById('totalPlayers');
    const onlineElement = document.getElementById('onlinePlayers');
    const highestElement = document.getElementById('highestScore');

    if (totalElement) totalElement.textContent = players.length;
    if (onlineElement) onlineElement.textContent = onlineCount;
    if (highestElement) highestElement.textContent = highestScore;

    const tbody = document.getElementById('playersTableBody');
    if (tbody) {
        tbody.innerHTML = '';
        players.sort((a, b) => b.score - a.score);

        players.forEach(player => {
            const row = document.createElement('tr');
            const lastActive = new Date(player.lastActive);
            const formattedDate = lastActive.toLocaleString('ms-MY');
            
            row.innerHTML = `
                <td><strong>${player.username}</strong></td>
                <td>📍 ${player.country}</td>
                <td><strong style="color: var(--gold-primary)">${player.score}</strong></td>
                <td><span class="status-badge ${player.isOnline ? 'status-online' : 'status-offline'}">
                    ${player.isOnline ? '🟢 Online' : '🔴 Offline'}
                </span></td>
                <td>${formattedDate}</td>
            `;
            tbody.appendChild(row);
        });
    }

    // Real-time updates
    onSnapshot(collection(db, 'users'), () => {
        loadAdminPanel();
    });
}

// Load Leaderboard (for leaderboard.html)
async function loadLeaderboard() {
    const topThreeContainer = document.querySelector('.top-three');
    const leaderboardBody = document.getElementById('leaderboardBody');
    
    if (!topThreeContainer && !leaderboardBody) return;

    const q = query(collection(db, 'users'), orderBy('score', 'desc'));
    
    onSnapshot(q, (snapshot) => {
        const players = [];
        snapshot.forEach((doc) => {
            players.push({ id: doc.id, ...doc.data() });
        });

        // Top 3 Podium
        if (topThreeContainer) {
            topThreeContainer.innerHTML = '';
            
            const medals = ['🥇', '🥈', '🥉'];
            const positions = ['first', 'second', 'third'];
            
            for (let i = 0; i < Math.min(3, players.length); i++) {
                const player = players[i];
                const podium = document.createElement('div');
                podium.className = `podium ${positions[i]}`;
                podium.innerHTML = `
                    <div class="medal">${medals[i]}</div>
                    <div class="podium-name">${player.username}</div>
                    <div class="podium-country">📍 ${player.country}</div>
                    <div class="podium-score">${player.score}</div>
                `;
                topThreeContainer.appendChild(podium);
            }
        }

        // Full Leaderboard List
        if (leaderboardBody) {
            leaderboardBody.innerHTML = '';
            
            players.forEach((player, index) => {
                const item = document.createElement('div');
                item.className = 'leaderboard-item';
                
                if (currentUser && player.id === currentUser.uid) {
                    item.classList.add('current-user');
                }

                const rank = index + 1;
                const rankDisplay = rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : `#${rank}`;
                
                item.innerHTML = `
                    <div class="rank">${rankDisplay}</div>
                    <div class="player-info-item">
                        <div class="player-name-item">${player.username}</div>
                    </div>
                    <div class="player-country-item">📍 ${player.country}</div>
                    <div class="score-value">${player.score}</div>
                `;
                
                leaderboardBody.appendChild(item);
            });
        }
    });
}

// Auth State Observer
onAuthStateChanged(auth, async (user) => {
    const currentPage = window.location.pathname;
    
    if (user) {
        currentUser = user;
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            currentScore = userData.score || 0;
            isAdmin = userData.username.toLowerCase() === 'rapzz';

            // Update online status
            await updateDoc(doc(db, 'users', user.uid), {
                isOnline: true,
                lastActive: new Date().toISOString()
            });

            // Route based on current page
            if (currentPage.includes('admin.html')) {
                if (!isAdmin) {
                    window.location.href = 'index.html';
                } else {
                    loadAdminPanel();
                }
            } else if (currentPage.includes('leaderboard.html')) {
                loadLeaderboard();
            } else {
                // Main game page
                showPage('gamePage');
                
                const usernameEl = document.getElementById('usernameDisplay');
                const countryEl = document.getElementById('countryDisplay');
                const scoreEl = document.getElementById('scoreValue');
                const totalClicksEl = document.getElementById('totalClicks');
                const adminBtn = document.getElementById('adminBtn');
                
                if (usernameEl) usernameEl.textContent = `${userData.username}`;
                if (countryEl) countryEl.textContent = `📍 ${userData.country}`;
                if (scoreEl) scoreEl.textContent = currentScore;
                if (totalClicksEl) totalClicksEl.textContent = totalClicks;
                
                // Show admin button if admin
                if (isAdmin && adminBtn) {
                    adminBtn.style.display = 'flex';
                }
                
                updateUserRank();
                
                // Update rank every 10 seconds
                setInterval(updateUserRank, 10000);
            }
        }
    } else {
        currentUser = null;
        currentScore = 0;
        
        // Redirect to home if not authenticated and not on home page
        if (!currentPage.includes('index.html') && currentPage !== '/') {
            window.location.href = 'index.html';
        } else {
            showPage('authPage');
        }
    }
});

// Update online status every 30 seconds
setInterval(async () => {
    if (currentUser) {
        try {
            await updateDoc(doc(db, 'users', currentUser.uid), {
                lastActive: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error updating last active:', error);
        }
    }
}, 30000);

// Save score on page unload
window.addEventListener('beforeunload', async () => {
    if (currentUser && currentScore > 0) {
        try {
            await updateDoc(doc(db, 'users', currentUser.uid), {
                score: currentScore,
                isOnline: false,
                lastActive: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error saving final score:', error);
        }
    }
});

// Check which page we're on and load accordingly
window.addEventListener('DOMContentLoaded', () => {
    const currentPage = window.location.pathname;
    
    if (currentPage.includes('leaderboard.html')) {
        loadLeaderboard();
    } else if (currentPage.includes('admin.html')) {
        if (currentUser) {
            loadAdminPanel();
        }
    }
});
