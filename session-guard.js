/* BIGOTIC DATA — SHARED 30-MINUTE INACTIVITY TRACKER */
(function () {
    'use strict';

    if (window.__bigoticIdleGuard) return;
    window.__bigoticIdleGuard = true;

    const LIMIT = 30 * 60 * 1000;
    const KEY = 'bigotic-last-activity-v1';
    const LOGIN = 'login.html';

    let lastWrite = 0;
    let ending = false;
    let lastSessionId = '';

    function getUser() {
        try {
            const user = JSON.parse(
                localStorage.getItem('user') || 'null'
            );

            return user &&
                typeof user.email === 'string' &&
                typeof user.token === 'string' &&
                user.token
                    ? user
                    : null;
        } catch (_) {
            return null;
        }
    }

    // Detect a fresh login without storing the token twice.
    // This is only a session-change marker, not authentication.
    function sessionId(token) {
        let hash = 2166136261;

        for (let i = 0; i < token.length; i++) {
            hash ^= token.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }

        return (hash >>> 0).toString(16);
    }

    function readActivity() {
        try {
            return JSON.parse(
                localStorage.getItem(KEY) || 'null'
            );
        } catch (_) {
            return null;
        }
    }

    function writeActivity(user, now) {
        try {
            localStorage.setItem(
                KEY,
                JSON.stringify({
                    email: user.email.toLowerCase(),
                    session: sessionId(user.token),
                    at: now
                })
            );

            lastWrite = now;
        } catch (_) {
            // Storage failures must not crash the page.
        }
    }

    function expire() {
        if (ending) return;
        ending = true;

        try {
            localStorage.removeItem('user');
            localStorage.removeItem(KEY);
        } catch (_) {}

        window.location.replace(
            LOGIN + '?reason=idle'
        );
    }

    function check() {
        if (ending) return false;

        const user = getUser();
        if (!user) return false;

        const now = Date.now();
        const currentSession = sessionId(user.token);
        const saved = readActivity();

        // First visit or new successful login.
        if (
            !saved ||
            saved.email !== user.email.toLowerCase() ||
            saved.session !== currentSession
        ) {
            writeActivity(user, now);
            lastSessionId = currentSession;
            return true;
        }

        const elapsed = now - Number(saved.at);

        if (
            !Number.isFinite(elapsed) ||
            elapsed < -60000 ||
            elapsed >= LIMIT
        ) {
            expire();
            return false;
        }

        lastSessionId = currentSession;
        return true;
    }

    function recordActivity() {
        if (!check()) return;

        const user = getUser();
        if (!user) return;

        const now = Date.now();

        // Avoid excessive localStorage writes.
        if (now - lastWrite < 5000) return;

        writeActivity(user, now);
    }

    check();

    [
        'pointerdown',
        'keydown',
        'input',
        'touchstart',
        'scroll'
    ].forEach(name => {
        window.addEventListener(
            name,
            recordActivity,
            { passive: true }
        );
    });

    window.addEventListener('pageshow', check);

    document.addEventListener(
        'visibilitychange',
        function () {
            if (!document.hidden) check();
        }
    );

    window.addEventListener(
        'storage',
        function (event) {
            if (
                event.key === KEY ||
                event.key === 'user'
            ) {
                check();
            }
        }
    );

    setInterval(check, 15000);
})();