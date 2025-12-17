'use client';

/**
 * AI Chat Assistant Component
 * Floating chat widget in bottom-right corner
 * Features:
 * - Auto-prompt after 15 seconds
 * - Quick start questions
 * - Premium glassmorphism design
 * - Smooth animations
 */

import { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Sparkles, Loader2 } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const QUICK_QUESTIONS = [
  'What is IP leak and how can I prevent it?',
  'How does WebRTC leak work?',
  'What is browser fingerprinting?',
  'How can I improve my privacy score?',
  'What VPN should I use?',
  'Explain Canvas fingerprinting',
];

export function AIChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-prompt after 15 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isOpen && messages.length === 0) {
        setShowPrompt(true);
      }
    }, 15000);

    return () => clearTimeout(timer);
  }, [isOpen, messages.length]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.browserleaks.io';
      const response = await fetch(`${apiUrl}/v1/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messages.concat(userMessage).map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.data.message,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickQuestion = (question: string) => {
    setShowPrompt(false);
    setIsOpen(true);
    sendMessage(question);
  };

  return (
    <>
      {/* Floating Chat Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          setShowPrompt(false);
        }}
        className="fixed bottom-6 right-6 z-50 group"
        aria-label="Open AI Assistant"
      >
        <div className="relative">
          {/* Glow effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full blur-lg opacity-50 group-hover:opacity-75 transition-opacity animate-pulse" />

          {/* Button */}
          <div className="relative bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform duration-300">
            {isOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <MessageCircle className="w-6 h-6" />
            )}
          </div>

          {/* Notification badge */}
          {showPrompt && !isOpen && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping" />
          )}
        </div>
      </button>

      {/* Auto-prompt tooltip */}
      {showPrompt && !isOpen && (
        <div className="fixed bottom-24 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-4 max-w-xs border border-gray-200 dark:border-gray-700">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <img src="/favicon.svg" alt="AI" className="w-10 h-10" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Need help understanding your privacy results?
                </p>
                <button
                  onClick={() => {
                    setIsOpen(true);
                    setShowPrompt(false);
                  }}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                  Ask AI Assistant →
                </button>
              </div>
              <button
                onClick={() => setShowPrompt(false)}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-96 h-[600px] animate-in fade-in slide-in-from-bottom-8 duration-300">
          <div className="h-full bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-4 flex items-center gap-3">
              <img src="/favicon.svg" alt="AI" className="w-8 h-8" />
              <div className="flex-1">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Privacy Assistant
                </h3>
                <p className="text-xs text-blue-100">
                  Ask me about browser privacy
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                  <Sparkles className="w-12 h-12 mx-auto mb-4 text-blue-500 opacity-50" />
                  <p className="text-sm mb-4">
                    Hi! I'm your privacy assistant. Ask me anything about browser privacy, leaks, or fingerprinting.
                  </p>

                  {/* Quick Questions */}
                  <div className="space-y-2 mt-6">
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-3">
                      Quick Start:
                    </p>
                    {QUICK_QUESTIONS.map((question, index) => (
                      <button
                        key={index}
                        onClick={() => handleQuickQuestion(question)}
                        className="w-full text-left px-4 py-2 text-sm bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-700 hover:from-blue-100 hover:to-purple-100 dark:hover:from-gray-700 dark:hover:to-gray-600 rounded-lg transition-all duration-200 border border-blue-200/50 dark:border-gray-600/50 hover:border-blue-300 dark:hover:border-gray-500 hover:shadow-md"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      message.role === 'user'
                        ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                    } shadow-lg`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <p className={`text-xs mt-1 ${
                      message.role === 'user'
                        ? 'text-blue-100'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {message.timestamp.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Thinking...
                    </span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage(input);
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about privacy..."
                  className="flex-1 px-4 py-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-purple-500 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
