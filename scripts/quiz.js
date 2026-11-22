(() => {
  "use strict";

  const questions = [
    {
      prompt: "What does the PHQ-9 ask about?",
      choices: [
        "Nine symptoms experienced over the previous two weeks",
        "A person's overall immune strength",
        "Inflammation levels measured in blood"
      ],
      answer: 0,
      explanation: "The PHQ-9 is a self-reported symptom screening measure covering the previous two weeks—not a diagnosis or a measure of every emotion."
    },
    {
      prompt: "What is hs-CRP in this project?",
      choices: [
        "A direct measure of how quickly someone recovers from illness",
        "A sensitive blood measure of C-reactive protein, a marker of inflammation",
        "A test that identifies the cause of depressive symptoms"
      ],
      answer: 1,
      explanation: "hs-CRP measures C-reactive protein. It is one nonspecific inflammation marker, not a measure of overall immune strength or recovery speed."
    },
    {
      prompt: "The charts compare symptom groups with hs-CRP. What can this observational analysis establish?",
      choices: [
        "That depressive symptoms cause inflammation",
        "Which came first: symptoms or inflammation",
        "Descriptive patterns in this survey sample, but not cause and effect"
      ],
      answer: 2,
      explanation: "An observational snapshot can describe patterns, but it cannot establish causation or which came first."
    },
    {
      prompt: "In the project’s charts, what does the >3 mg/L hs-CRP threshold do?",
      choices: [
        "Defines the displayed elevated-hs-CRP comparison",
        "Diagnoses an individual with an illness",
        "Measures the strength of the immune system"
      ],
      answer: 0,
      explanation: "It is the threshold used for a group comparison in this analysis—not a diagnosis or a comprehensive health measure."
    },
    {
      prompt: "Why are the displayed percentages described as unweighted?",
      choices: [
        "Each participant's data were removed from the analysis",
        "Survey weights were not applied to calculate population-representative estimates",
        "The percentages only include people above the hs-CRP threshold"
      ],
      answer: 1,
      explanation: "The project reports unweighted descriptions of its complete-case sample; it does not apply NHANES survey weights to estimate population percentages."
    },
    {
      prompt: "A symptom group has a higher percentage above the threshold. What does that tell you about a particular person?",
      choices: [
        "It predicts that person's hs-CRP result",
        "It confirms the person has a health condition",
        "Nothing definitive: a group percentage cannot diagnose or predict an individual"
      ],
      answer: 2,
      explanation: "Group-level percentages describe the sample, not an individual's health. They are not diagnostic or predictive."
    }
  ];

  const byId = (id) => document.getElementById(id);
  const count = byId("quiz-count");
  const streak = byId("quiz-streak");
  const progress = document.querySelector(".quiz-progress");
  const progressFill = byId("quiz-progress-fill");
  const questionTitle = byId("quiz-question");
  const options = byId("quiz-options");
  const feedback = byId("quiz-feedback");
  const scoreLabel = byId("quiz-score");
  const nextButton = byId("quiz-next");
  const actions = byId("quiz-actions");
  const results = byId("quiz-results");
  const resultsTitle = byId("quiz-results-title");
  const resultsScore = byId("quiz-results-score");
  let round = [];
  let current = 0;
  let score = 0;
  let run = 0;

  function shuffled(items) {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [result[index], result[swap]] = [result[swap], result[index]];
    }
    return result;
  }

  function updateProgress() {
    const completed = current + (feedback.hidden ? 0 : 1);
    progress.setAttribute("aria-valuenow", String(completed));
    progressFill.style.width = `${100 * completed / round.length}%`;
  }

  function renderQuestion() {
    const item = round[current];
    count.textContent = `Question ${current + 1} of ${round.length}`;
    streak.textContent = run > 1 ? `🔥 ${run} in a row` : "✨ Your turn";
    questionTitle.textContent = item.prompt;
    questionTitle.hidden = false;
    feedback.hidden = true;
    feedback.textContent = "";
    nextButton.hidden = true;
    options.hidden = false;
    options.replaceChildren();

    item.choices.forEach((choice, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "quiz-option";
      button.textContent = choice;
      button.addEventListener("click", () => selectAnswer(index));
      options.append(button);
    });
    updateProgress();
  }

  function selectAnswer(selected) {
    const item = round[current];
    const buttons = [...options.children];
    buttons.forEach((button, index) => {
      button.disabled = true;
      if (index === item.answer) button.classList.add("is-correct");
      if (index === selected && selected !== item.answer) button.classList.add("is-incorrect");
    });

    if (selected === item.answer) {
      score += 1;
      run += 1;
      feedback.replaceChildren();
      const result = document.createElement("strong");
      result.textContent = "That’s right! ";
      feedback.append(result, document.createTextNode(item.explanation));
    } else {
      run = 0;
      feedback.replaceChildren();
      const result = document.createElement("strong");
      result.textContent = "Not quite. ";
      feedback.append(result, document.createTextNode(item.explanation));
    }
    scoreLabel.textContent = `Score: ${score}`;
    feedback.hidden = false;
    nextButton.textContent = current === round.length - 1 ? "See your results" : "Next question →";
    nextButton.hidden = false;
    updateProgress();
    nextButton.focus();
  }

  function finish() {
    questionTitle.hidden = true;
    options.hidden = true;
    feedback.hidden = true;
    actions.hidden = true;
    results.hidden = false;
    progress.setAttribute("aria-valuenow", String(round.length));
    progressFill.style.width = "100%";
    resultsTitle.textContent = score === round.length ? "Perfect run!" : score >= 4 ? "Nice work!" : "Quest complete!";
    resultsScore.textContent = `You got ${score} out of ${round.length} right. ${score === round.length ? "You’ve got the key ideas down." : "A quick revisit to the findings can make them stick."}`;
    byId("quiz-restart").focus();
  }

  function start() {
    round = shuffled(questions);
    current = 0;
    score = 0;
    run = 0;
    results.hidden = true;
    actions.hidden = false;
    scoreLabel.textContent = "Score: 0";
    renderQuestion();
    questionTitle.focus();
  }

  nextButton.addEventListener("click", () => {
    current += 1;
    if (current === round.length) {
      finish();
      return;
    }
    renderQuestion();
    questionTitle.focus();
  });
  byId("quiz-restart").addEventListener("click", start);
  start();
})();
