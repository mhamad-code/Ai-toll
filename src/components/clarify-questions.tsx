"use client"

import * as React from "react"

import { Card, CardContent } from "@/components/ui/card"
import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireError,
  QuestionnaireInput,
  QuestionnaireItem,
  QuestionnaireNext,
  QuestionnairePrevious,
  QuestionnaireProgress,
  QuestionnaireSkip,
  QuestionnaireSubmit,
  QuestionnaireTitle,
} from "@/components/ui/questionnaire"
import type { QuestionSpec } from "@/lib/clarify"
import { HOVER_SHADOW } from "@/lib/ui"

export function ClarifyQuestions({
  questions,
  onAnswer,
}: {
  questions: QuestionSpec[]
  /** Receives the answers written as a message to send. */
  onAnswer: (text: string) => void
}) {
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const lines: string[] = []

    for (const q of questions) {
      const values = (q.multiple ? data.getAll(q.name) : [data.get(q.name)]).filter(
        (v): v is string => typeof v === "string" && v.trim() !== ""
      )
      if (!values.length) continue
      const labels = values.map(
        (v) => q.choices.find((c) => c.value === v)?.label ?? v
      )
      lines.push(`${q.title}: ${labels.join(", ")}`)
    }

    onAnswer(
      lines.length
        ? lines.join("\n")
        : "I skipped the questions. Please make reasonable assumptions and answer."
    )
  }

  return (
    <Card className={`mx-auto w-full max-w-md ${HOVER_SHADOW}`}>
      <CardContent>
        <Questionnaire items={questions} onSubmit={handleSubmit}>
          <QuestionnaireProgress />
          {questions.map((question) => (
            <QuestionnaireItem
              key={question.name}
              multiple={question.multiple}
              name={question.name}
              required={question.required}
            >
              <QuestionnaireTitle>{question.title}</QuestionnaireTitle>
              {question.description ? (
                <QuestionnaireDescription>
                  {question.description}
                </QuestionnaireDescription>
              ) : null}
              <QuestionnaireChoices>
                {question.choices.map((choice) => (
                  <QuestionnaireChoice
                    key={choice.value}
                    value={choice.value}
                    className={HOVER_SHADOW}
                  >
                    <span className="font-medium">{choice.label}</span>
                    {choice.description ? (
                      <span className="text-muted-foreground">
                        {choice.description}
                      </span>
                    ) : null}
                  </QuestionnaireChoice>
                ))}
                {question.input ? (
                  <QuestionnaireInput
                    aria-label={question.input.label}
                    placeholder={question.input.placeholder}
                  />
                ) : null}
              </QuestionnaireChoices>
              <QuestionnaireError />
            </QuestionnaireItem>
          ))}
          <QuestionnaireActions>
            <QuestionnairePrevious />
            <QuestionnaireSkip />
            <QuestionnaireNext>Next</QuestionnaireNext>
            <QuestionnaireSubmit>Send answers</QuestionnaireSubmit>
          </QuestionnaireActions>
        </Questionnaire>
      </CardContent>
    </Card>
  )
}
