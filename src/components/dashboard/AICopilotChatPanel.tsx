'use client'

import { FormEvent, useState } from 'react'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

const suggestions = [
  'What is the safest bet today?',
  'What should I avoid?',
  'Build me the safest parlay.',
  'Which pick has the best value?',
  'What would a pro bettor do today?',
]

function formatAnswer(value: string) {
  return value.split('\n').map((line, index) => (
    <span key={`${line}-${index}`}>
      {line}
      <br />
    </span>
  ))
}

export default function AICopilotChatPanel() {
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        'Ask me about today’s safest bet, best value pick, what to avoid, or how to build a disciplined parlay.',
    },
  ])
  const [loading, setLoading] = useState(false)

  async function askCopilot(nextQuestion: string) {
    const cleanQuestion = nextQuestion.trim()

    if (!cleanQuestion) return

    setMessages((current) => [
      ...current,
      {
        role: 'user',
        content: cleanQuestion,
      },
    ])

    setQuestion('')
    setLoading(true)

    try {
      const response = await fetch('/api/ai/copilot/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        body: JSON.stringify({
          question: cleanQuestion,
        }),
      })

      const json = await response.json()

      if (!response.ok || !json.success) {
        throw new Error(json.error ?? 'Failed to ask AI Copilot')
      }

      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: json.answer,
        },
      ])
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content:
            error instanceof Error
              ? error.message
              : 'Unknown AI Copilot chat error',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    askCopilot(question)
  }

  return (
    <div className="rounded-2xl border border-blue-500/20 bg-blue-950/10 p-5 shadow-lg shadow-slate-950/30">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">AI Copilot Chat</h2>
          <p className="text-sm text-slate-400">
            Ask questions about safest picks, risk, value, parlays and pro betting decisions.
          </p>
        </div>

        <span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs font-semibold text-blue-300">
          Beta
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {suggestions.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => askCopilot(item)}
            className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300 transition hover:bg-slate-700"
          >
            {item}
          </button>
        ))}
      </div>

      <div className="mt-5 max-h-[460px] space-y-3 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/70 p-4">
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={
              message.role === 'user'
                ? 'ml-auto max-w-[90%] rounded-xl bg-blue-500/15 p-3 text-sm text-blue-100'
                : 'mr-auto max-w-[95%] rounded-xl bg-slate-900 p-3 text-sm leading-6 text-slate-300'
            }
          >
            {formatAnswer(message.content)}
          </div>
        ))}

        {loading && (
          <div className="mr-auto max-w-[95%] rounded-xl bg-slate-900 p-3 text-sm text-slate-400">
            Thinking...
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-2 md:flex-row">
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask: What is the safest bet today?"
          className="min-h-11 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500"
        />

        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Ask
        </button>
      </form>
    </div>
  )
}