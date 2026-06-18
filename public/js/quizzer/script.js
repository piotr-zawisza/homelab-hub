(() => {
    const CONFIG = {
        autoSkipTimeMs: 1500,
        shuffleQuestions: true,
        shuffleAnswers: true
    };

    let quizData = [];
    let currentIndex = 0;
    let currentScore = 0;
    let hasAnswered = false;
    let skipTimer = null;
    let t = {};

    function shuffleArray(array) {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    async function loadTranslations() {
        t = window.DICT;

        document.getElementById('html-lang').lang = window.APP_LANG;
        document.getElementById('lang-backToHub').innerText = t.quizzer.backToHub;
        document.getElementById('lang-question').innerText = t.quizzer.question;
        document.getElementById('lang-score').innerText = t.quizzer.score;
        document.getElementById('lang-quizEnd').innerText = t.quizzer.quizEnd;
        document.getElementById('lang-yourScore').innerText = t.quizzer.yourScore;
        document.getElementById('lang-tryAgain').innerText = t.quizzer.tryAgain;

        document.getElementById('stop-btn').innerText = t.quizzer.pause;
        document.getElementById('next-btn').innerText = t.quizzer.next;
        document.getElementById('question-text').innerText = t.quizzer.loading;
    }

    async function initQuiz() {
        await loadTranslations();
        try {
            const containerUrl = document.querySelector('.quiz-container').dataset.quizUrl;
            const response = await fetch(containerUrl);

            if (!response.ok) throw new Error("Couldn't load the quiz.");

            quizData = await response.json();

            if (CONFIG.shuffleQuestions) {
                quizData = shuffleArray(quizData);
            }

            document.getElementById('total-q').innerText = quizData.length;
            loadQuestion();
            setupKeyboardSupport();
        } catch (err) {
            document.getElementById('question-text').innerText = t.quizzer.error + err.message;
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
        void questionContent.offsetWidth; // wymuszenie reflow
        questionContent.classList.add('fade-in-active');

        document.getElementById('action-buttons').style.display = 'none';
        document.getElementById('stop-btn').style.display = 'block';
        document.getElementById('next-btn').style.display = 'none';

        let entries = Object.entries(currentQ.answers);

        // Poprawne tasowanie odpowiedzi
        if (CONFIG.shuffleAnswers) {
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

        setTimeout(() => {
            timerBar.style.transition = `transform ${CONFIG.autoSkipTimeMs}ms linear`;
            timerBar.style.transform = 'scaleX(0)';
        }, 50);

        skipTimer = setTimeout(() => {
            goToNext();
        }, CONFIG.autoSkipTimeMs);
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

    document.getElementById('stop-btn').addEventListener('click', stopTimer);
    document.getElementById('next-btn').addEventListener('click', () => {
        goToNext();
    });

    function showResults() {
        document.getElementById('quiz-box').style.display = 'none';
        const resultBox = document.getElementById('result-box');
        resultBox.style.display = 'block';
        resultBox.classList.add('fade-in-active');

        document.getElementById('final-score').innerText = `${currentScore} / ${quizData.length}`;
        const percentage = Math.round((currentScore / quizData.length) * 100);
        document.getElementById('percentage-score').innerText = `${t.percentage}${percentage}%`;
    }

    function setupKeyboardSupport() {
        document.addEventListener('keydown', (e) => {
            if (document.getElementById('result-box').style.display === 'block') return;

            if (!hasAnswered) {
                const keyMap = { '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, 'a': 1, 'b': 2, 'c': 3, 'd': 4 };
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
    }

    initQuiz();
})();
