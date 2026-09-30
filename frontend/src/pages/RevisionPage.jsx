import { useEffect, useState } from "react";

import {
  deleteSavedSolution,
  evaluateRevisionAnswer,
  generateRandomRevisionQuiz,
  generateRevisionQuiz,
  getSavedSolutions,
  renameSavedSolution,
} from "../api";

import Solution from "../components/Solution";


export default function RevisionPage() {
  const [solutions, setSolutions] =
    useState([]);

  const [
    selectedSolution,
    setSelectedSolution,
  ] = useState(null);

  const [mode, setMode] =
    useState(null);

  const [annotations, setAnnotations] =
    useState([]);

  const [
    quizQuestion,
    setQuizQuestion,
  ] = useState("");

  const [quizAnswer, setQuizAnswer] =
    useState("");

  const [evaluation, setEvaluation] =
    useState(null);

  const [quizLoading, setQuizLoading] =
    useState(false);

  const [quizError, setQuizError] =
    useState("");

  const [
    quizSolutionId,
    setQuizSolutionId,
  ] = useState(null);

  const [
    isGlobalQuiz,
    setIsGlobalQuiz,
  ] = useState(false);

  const [loading, setLoading] =
    useState(true);


  async function loadSolutions() {
    try {
      setLoading(true);

      const data =
        await getSavedSolutions();

      setSolutions(data);
    } catch (error) {
      console.error(
        "Failed to load saved solutions:",
        error
      );
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    loadSolutions();
  }, []);


  function resetQuizState() {
    setQuizQuestion("");
    setQuizAnswer("");
    setEvaluation(null);
    setQuizError("");
    setQuizSolutionId(null);
  }


  function openSolution(solution) {
    setSelectedSolution(solution);

    setAnnotations(
      Array.isArray(
        solution.annotations
      )
        ? solution.annotations
        : []
    );

    setIsGlobalQuiz(false);
    setMode(null);

    resetQuizState();
  }


  function closeModal() {
    setSelectedSolution(null);
    setIsGlobalQuiz(false);
    setMode(null);

    resetQuizState();
  }


  async function handleRename(
    solution,
    event
  ) {
    event.stopPropagation();

    const newTitle =
      window.prompt(
        "Rename this revision card:",
        solution.title
      );

    if (
      newTitle === null ||
      !newTitle.trim() ||
      newTitle.trim() ===
        solution.title
    ) {
      return;
    }

    try {
      const updated =
        await renameSavedSolution(
          solution.id,
          newTitle.trim()
        );

      setSolutions((current) =>
        current.map((item) =>
          item.id === solution.id
            ? {
                ...item,
                title:
                  updated.title,
              }
            : item
        )
      );
    } catch (error) {
      console.error(
        "Failed to rename solution:",
        error
      );
    }
  }


  async function handleDelete(
    solution,
    event
  ) {
    event.stopPropagation();

    const confirmed =
      window.confirm(
        `Delete "${solution.title}"?`
      );

    if (!confirmed) return;

    try {
      await deleteSavedSolution(
        solution.id
      );

      setSolutions((current) =>
        current.filter(
          (item) =>
            item.id !== solution.id
        )
      );

      if (
        selectedSolution?.id ===
        solution.id
      ) {
        closeModal();
      }
    } catch (error) {
      console.error(
        "Failed to delete solution:",
        error
      );
    }
  }


  async function startCardQuiz() {
    if (!selectedSolution) return;

    setMode("quiz");
    setIsGlobalQuiz(false);
    setQuizLoading(true);
    setQuizError("");

    setQuizQuestion("");
    setQuizAnswer("");
    setEvaluation(null);

    try {
      const result =
        await generateRevisionQuiz(
          selectedSolution.id
        );

      setQuizSolutionId(
        result.solution_id
      );

      setQuizQuestion(
        result.question
      );
    } catch (error) {
      console.error(
        "Failed to generate quiz:",
        error
      );

      setQuizError(
        error.message
      );
    } finally {
      setQuizLoading(false);
    }
  }


  async function startRandomQuiz() {
    setSelectedSolution(null);
    setIsGlobalQuiz(true);
    setMode("quiz");

    setQuizLoading(true);
    setQuizError("");

    setQuizQuestion("");
    setQuizAnswer("");
    setEvaluation(null);

    try {
      const result =
        await generateRandomRevisionQuiz();

      setQuizSolutionId(
        result.solution_id
      );

      setQuizQuestion(
        result.question
      );
    } catch (error) {
      console.error(
        "Failed to generate random quiz:",
        error
      );

      setQuizError(
        error.message
      );
    } finally {
      setQuizLoading(false);
    }
  }


  async function loadAnotherQuestion() {
    if (!quizSolutionId) return;

    setQuizLoading(true);
    setQuizError("");

    setQuizAnswer("");
    setEvaluation(null);

    try {
      const result =
        isGlobalQuiz
          ? await generateRandomRevisionQuiz()
          : await generateRevisionQuiz(
              quizSolutionId
            );

      setQuizSolutionId(
        result.solution_id
      );

      setQuizQuestion(
        result.question
      );
    } catch (error) {
      console.error(
        "Failed to generate question:",
        error
      );

      setQuizError(
        error.message
      );
    } finally {
      setQuizLoading(false);
    }
  }


  async function handleEvaluate() {
    if (
      !quizSolutionId ||
      !quizQuestion ||
      !quizAnswer.trim()
    ) {
      return;
    }

    setQuizLoading(true);
    setQuizError("");

    try {
      const result =
        await evaluateRevisionAnswer(
          quizSolutionId,
          quizQuestion,
          quizAnswer
        );

      setEvaluation(result);
    } catch (error) {
      console.error(
        "Failed to evaluate answer:",
        error
      );

      setQuizError(
        error.message
      );
    } finally {
      setQuizLoading(false);
    }
  }


  const modalOpen =
    selectedSolution ||
    isGlobalQuiz;


  return (
    <main className="revision-page">

      <div className="revision-header">

        <div>
          <h1>Revision</h1>

          <p>
            Review only the solutions
            you intentionally saved.
          </p>
        </div>


        <button
          className="random-quiz-button"
          onClick={startRandomQuiz}
          disabled={
            solutions.length === 0
          }
        >
          Random Quiz
        </button>

      </div>


      {loading ? (
        <div className="revision-empty">
          <p>
            Loading saved solutions...
          </p>
        </div>
      ) : solutions.length === 0 ? (
        <div className="revision-empty">

          <h2>
            No saved solutions yet
          </h2>

          <p>
            Save a solution from Chat
            and it will appear here.
          </p>

        </div>
      ) : (
        <div className="revision-grid">

          {solutions.map(
            (solution) => (
              <div
                key={solution.id}
                className="revision-card"
                role="button"
                tabIndex={0}
                onClick={() =>
                  openSolution(solution)
                }
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" ||
                    event.key === " "
                  ) {
                    openSolution(solution);
                  }
                }}
              >


                <div className="revision-card-title">
                  {solution.title}
                </div>
                
                <div className="revision-card-actions">

                  <button
                    className="revision-card-rename"
                    onClick={(event) =>
                      handleRename(
                        solution,
                        event
                      )
                    }
                  >
                    Rename
                  </button>

                <button
                  className="revision-card-delete-button"
                  onClick={(event) =>
                    handleDelete(
                      solution,
                      event
                    )
                  }
                >
                  Delete
                </button>

              </div>



              </div>
            )
          )}

        </div>
      )}


      {modalOpen && (
        <div
          className="revision-modal-backdrop"
          onClick={closeModal}
        >

          <div
            className="revision-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            <button
              className="revision-modal-close"
              onClick={closeModal}
              aria-label="Close"
            >
              ×
            </button>


            {selectedSolution &&
              mode === null && (
                <>
                  <h2>
                    {
                      selectedSolution.title
                    }
                  </h2>

                  <p className="revision-modal-question">
                    {
                      selectedSolution.question
                    }
                  </p>

                  <div className="revision-mode-buttons">

                    <button
                      onClick={() =>
                        setMode(
                          "look"
                        )
                      }
                    >
                      Look again
                    </button>

                    <button
                      onClick={
                        startCardQuiz
                      }
                    >
                      Quiz this card
                    </button>

                  </div>
                </>
              )}


            {selectedSolution &&
              mode === "look" && (
                <>
                  <button
                    className="revision-back-button"
                    onClick={() =>
                      setMode(null)
                    }
                  >
                    ← Back
                  </button>

                  <h2>
                    {
                      selectedSolution.title
                    }
                  </h2>

                  <p className="revision-modal-question">
                    {
                      selectedSolution.question
                    }
                  </p>

                  <Solution
                    answer={
                      selectedSolution.answer
                    }
                    annotations={
                      annotations
                    }
                    setAnnotations={
                      setAnnotations
                    }
                    documentId={
                      selectedSolution.document_id
                    }
                  />
                </>
              )}


            {mode === "quiz" && (
              <>
                {!isGlobalQuiz && (
                  <button
                    className="revision-back-button"
                    onClick={() =>
                      setMode(null)
                    }
                  >
                    ← Back
                  </button>
                )}

                <h2>
                  {isGlobalQuiz
                    ? "Random Quiz"
                    : "Quiz"}
                </h2>

                {isGlobalQuiz && (
                  <p className="quiz-subtitle">
                    This question was
                    randomly selected
                    from all your saved
                    revision cards.
                  </p>
                )}


                {quizError && (
                  <div className="quiz-error">
                    {quizError}
                  </div>
                )}


                {quizLoading &&
                !quizQuestion ? (
                  <p>
                    Preparing a
                    question...
                  </p>
                ) : quizQuestion ? (
                  <>
                    <div className="quiz-question">
                      {quizQuestion}
                    </div>


                    <textarea
                      className="quiz-answer"
                      placeholder="Write your answer..."
                      value={quizAnswer}
                      onChange={(event) =>
                        setQuizAnswer(
                          event
                            .target
                            .value
                        )
                      }
                    />


                    <div className="quiz-controls">

                      <button
                        onClick={
                          handleEvaluate
                        }
                        disabled={
                          quizLoading ||
                          !quizAnswer.trim()
                        }
                      >
                        {quizLoading
                          ? "Working..."
                          : "Check answer"}
                      </button>


                      <button
                        onClick={
                          loadAnotherQuestion
                        }
                        disabled={
                          quizLoading
                        }
                      >
                        {isGlobalQuiz
                          ? "Another random question"
                          : "Another question"}
                      </button>

                    </div>


                    {evaluation && (
                      <div className="quiz-feedback">

                        <div className="quiz-score">
                          {
                            evaluation.score
                          }
                          %
                        </div>


                        <p className="quiz-overall">
                          {
                            evaluation.overall
                          }
                        </p>


                        {evaluation.correct
                          ?.length > 0 && (
                          <div>
                            <h4>
                              What you got right
                            </h4>

                            <ul>
                              {evaluation.correct.map(
                                (
                                  item,
                                  index
                                ) => (
                                  <li
                                    key={
                                      index
                                    }
                                  >
                                    {item}
                                  </li>
                                )
                              )}
                            </ul>
                          </div>
                        )}


                        {evaluation
                          .key_points_missing
                          ?.length >
                          0 && (
                          <div>
                            <h4>
                              Key points missing
                            </h4>

                            <ul>
                              {evaluation.key_points_missing.map(
                                (
                                  item,
                                  index
                                ) => (
                                  <li
                                    key={
                                      index
                                    }
                                  >
                                    {item}
                                  </li>
                                )
                              )}
                            </ul>
                          </div>
                        )}


                        {evaluation.incorrect
                          ?.length > 0 && (
                          <div>
                            <h4>
                              Needs correction
                            </h4>

                            <ul>
                              {evaluation.incorrect.map(
                                (
                                  item,
                                  index
                                ) => (
                                  <li
                                    key={
                                      index
                                    }
                                  >
                                    {item}
                                  </li>
                                )
                              )}
                            </ul>
                          </div>
                        )}


                        {evaluation.suggested_answer && (
                          <div className="suggested-answer">
                            <h4>
                              Suggested answer
                            </h4>

                            <p>
                              {
                                evaluation.suggested_answer
                              }
                            </p>
                          </div>
                        )}

                      </div>
                    )}
                  </>
                ) : null}
              </>
            )}

          </div>
        </div>
      )}

    </main>
  );
}
