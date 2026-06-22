(() => {
    const CONFIG = window.APP_CONFIG || {};

    let quizData = [];
    let currentIndex = 0;
    let currentScore = 0;
    let hasAnswered = false;
    let skipTimer = null;
    let currentQuizFile = null;
    let t = {};

    const appContextEl = document.getElementById('app-context');
    if (appContextEl) {
        try {
            const ctx = JSON.parse(appContextEl.textContent);
            t = ctx.dict || {};
        } catch (e) { }
    }

    function shuffleArray(array) {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    async function initQuiz(quizFileName) {
        try {
            currentQuizFile = quizFileName;
            currentIndex = 0;
            currentScore = 0;
            hasAnswered = false;
            clearTimeout(skipTimer);
            document.getElementById('score').innerText = '0';
            document.getElementById('quiz-progress').style.width = '0%';

            const containerUrl = `/data/quizzer/quiz-set/${quizFileName}.json`;
            console.log(`[Quizzer] Downloading quiz data from: ${containerUrl}`);
            const response = await fetch(containerUrl);

            if (!response.ok) {
                throw new Error(`HTTP Error ${response.status}: Couldn't find quiz file.`);
            }

            quizData = await response.json();

            if (!Array.isArray(quizData) || quizData.length === 0) {
                throw new Error("Invalid quiz data file");
            }

            if (CONFIG.SHUFFLE_QUESTIONS) {
                quizData = shuffleArray(quizData);
            }

            document.getElementById('total-q').innerText = quizData.length;
            loadQuestion();

        } catch (err) {
            console.error("[Quizzer] Critical error while initializing:", err);
            const qText = document.getElementById('question-text');
            if (qText) {
                const errorPrefix = (t && t.quizzer && t.quizzer.error) ? t.quizzer.error : "Error: ";
                qText.innerText = errorPrefix + err.message;
                qText.style.color = "#ff5252";
            }
        }
    }

    function loadQuestion() {
        hasAnswered = false;
        const currentQ = quizData[currentIndex];

        document.getElementById('current-q').innerText = currentIndex + 1;
        document.getElementById('question-text').innerHTML = currentQ.question;

        const progressPercent = ((currentIndex) / quizData.length) * 100;
        document.getElementById('quiz-progress').style.width = `${progressPercent}%`;

        const answersContainer = document.getElementById('answers-container');
        answersContainer.innerHTML = '';

        const questionContent = document.getElementById('question-content');
        questionContent.classList.remove('fade-in-active');
        void questionContent.offsetWidth;
        questionContent.classList.add('fade-in-active');

        document.getElementById('action-buttons').style.display = 'none';
        document.getElementById('stop-btn').style.display = 'block';
        document.getElementById('next-btn').style.display = 'none';

        let entries = Object.entries(currentQ.answers);

        if (CONFIG.SHUFFLE_ANSWERS) {
            entries = shuffleArray(entries);
        }

        const visualLabels = ['a', 'b', 'c', 'd', 'e', 'f'];
        entries.forEach((entry, index) => {
            const originalKey = entry[0];
            const text = entry[1];

            const btn = document.createElement('button');
            btn.className = 'answer-btn';
            btn.innerHTML = `<strong>${visualLabels[index].toUpperCase()})</strong> ${text}`;
            btn.dataset.originalKey = originalKey;
            btn.dataset.keyboardIndex = index + 1;

            btn.onclick = () => checkAnswer(originalKey, btn, currentQ.correct);
            answersContainer.appendChild(btn);
        });
    }

    function checkAnswer(selectedKey, selectedBtn, correctKey) {
        if (hasAnswered) return;
        hasAnswered = true;

        const allButtons = document.querySelectorAll('.answer-btn');
        if (selectedKey === correctKey) {
            selectedBtn.classList.add('correct');
            currentScore++;
            document.getElementById('score').innerText = currentScore;
        } else {
            selectedBtn.classList.add('wrong');
            allButtons.forEach(b => {
                if (b.dataset.originalKey === correctKey) {
                    b.classList.add('correct');
                }
            });
        }

        allButtons.forEach(b => b.disabled = true);
        document.getElementById('action-buttons').style.display = 'flex';

        const timerBar = document.getElementById('skip-timer-bar');
        timerBar.style.transition = 'none';
        timerBar.style.transform = 'scaleX(1)';

        const skipDelay = CONFIG.AUTO_SKIP_TIME_MS || 1500;

        setTimeout(() => {
            timerBar.style.transition = `transform ${skipDelay}ms linear`;
            timerBar.style.transform = 'scaleX(0)';
        }, 50);

        skipTimer = setTimeout(() => {
            goToNext();
        }, skipDelay);
    }

    function goToNext() {
        currentIndex++;
        if (currentIndex < quizData.length) {
            loadQuestion();
        } else {
            document.getElementById('quiz-progress').style.width = `100%`;
            showResults();
        }
    }

    function stopTimer() {
        clearTimeout(skipTimer);
        const timerBar = document.getElementById('skip-timer-bar');

        const computedStyle = window.getComputedStyle(timerBar);
        const currentTransform = computedStyle.getPropertyValue('transform');
        timerBar.style.transition = 'none';
        timerBar.style.transform = currentTransform;

        document.getElementById('stop-btn').style.display = 'none';
        document.getElementById('next-btn').style.display = 'block';
    }

    function showResults() {
        document.getElementById('quiz-box').style.display = 'none';
        const resultBox = document.getElementById('result-box');
        resultBox.style.display = 'block';
        resultBox.classList.add('fade-in-active');

        document.getElementById('final-score').innerText = `${currentScore} / ${quizData.length}`;
        const percentage = Math.round((currentScore / quizData.length) * 100);

        const percText = (t && t.quizzer && t.quizzer.percentage) ? t.quizzer.percentage : "Wynik: ";
        document.getElementById('percentage-score').innerText = `${percText}${percentage}%`;

        const backMenuLink = document.getElementById('btn-back-to-menu');
        if (backMenuLink) backMenuLink.style.display = 'none';
    }

    document.getElementById('stop-btn').addEventListener('click', stopTimer);
    document.getElementById('next-btn').addEventListener('click', () => goToNext());

    const tryAgainBtn = document.getElementById('lang-tryAgain');
    if (tryAgainBtn) {
        tryAgainBtn.addEventListener('click', () => {
            document.getElementById('result-box').style.display = 'none';
            document.getElementById('quiz-box').style.display = 'block';

            if (currentQuizFile) initQuiz(currentQuizFile);
        });
    }

    const returnToMenu = (e) => {
        if (e) e.preventDefault();
        clearTimeout(skipTimer);
        document.getElementById('quiz-box').style.display = 'none';
        document.getElementById('result-box').style.display = 'none';
        document.getElementById('quiz-menu').style.display = 'block';

        const backMenuLink = document.getElementById('btn-back-to-menu');
        if (backMenuLink) backMenuLink.style.display = 'none';
    };

    const chooseOtherBtn = document.getElementById('btn-choose-other');
    if (chooseOtherBtn) chooseOtherBtn.addEventListener('click', returnToMenu);

    const backMenuLink = document.getElementById('btn-back-to-menu');
    if (backMenuLink) backMenuLink.addEventListener('click', returnToMenu);

    // Wybieranie z menu
    document.querySelectorAll('.btn-select-quiz').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const fileName = e.target.getAttribute('data-file');

            document.getElementById('quiz-menu').style.display = 'none';
            document.getElementById('quiz-box').style.display = 'block';

            if (backMenuLink) backMenuLink.style.display = 'inline-flex';

            initQuiz(fileName);
        });
    });

    document.addEventListener('keydown', (e) => {
        if (document.getElementById('quiz-menu').style.display === 'block') return;
        if (document.getElementById('result-box').style.display === 'block') return;

        if (!hasAnswered) {
            const keyMap = { '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, 'a': 1, 'b': 2, 'c': 3, 'd': 4, 'e': 5, 'f': 6 };
            const mappedIndex = keyMap[e.key.toLowerCase()];

            if (mappedIndex) {
                const btnToClick = document.querySelector(`.answer-btn[data-keyboard-index="${mappedIndex}"]`);
                if (btnToClick) btnToClick.click();
            }
        } else {
            if (e.code === 'Space') {
                e.preventDefault();
                if (document.getElementById('stop-btn').style.display !== 'none') {
                    stopTimer();
                }
            } else if (e.code === 'Enter') {
                e.preventDefault();
                clearTimeout(skipTimer);
                goToNext();
            }
        }
    });

})();
