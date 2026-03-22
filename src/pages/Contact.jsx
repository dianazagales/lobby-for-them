import { useState } from 'react';
import { submitContactMessage } from '../lib/supabase';

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState(null); // null | 'sending' | 'success' | 'error'

  function setField(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus('sending');
    const { error } = await submitContactMessage(form);
    if (error) {
      setStatus('error');
    } else {
      setStatus('success');
      setForm({ name: '', email: '', message: '' });
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-14">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-navy mb-2">Contact Us</h1>
        <p className="text-gray-600">Questions, feedback, or want to suggest a bill we should track? We'd love to hear from you.</p>
      </div>

      {status === 'success' ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center shadow-sm">
          <div className="w-14 h-14 bg-orange/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="font-extrabold text-navy text-xl mb-2">Message sent!</p>
          <p className="text-gray-500 text-sm">Thank you for reaching out. We'll get back to you soon.</p>
          <button
            onClick={() => setStatus(null)}
            className="mt-6 text-sm text-orange hover:underline font-medium"
          >
            Send another message
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Name <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                type="text"
                value={form.name}
                onChange={e => setField('name', e.target.value)}
                placeholder="Your name"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Email <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                type="email"
                value={form.email}
                onChange={e => setField('email', e.target.value)}
                placeholder="you@example.com"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Message *</label>
            <textarea
              required
              rows={6}
              value={form.message}
              onChange={e => setField('message', e.target.value)}
              placeholder="What's on your mind?"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange focus:border-transparent resize-y"
            />
          </div>

          {status === 'error' && (
            <p className="text-red-600 text-sm">Something went wrong. Please try again.</p>
          )}

          <button
            type="submit"
            disabled={status === 'sending'}
            className="bg-navy text-white font-bold px-8 py-2.5 rounded-lg text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {status === 'sending' ? 'Sending…' : 'Send Message'}
          </button>
        </form>
      )}
    </div>
  );
}
