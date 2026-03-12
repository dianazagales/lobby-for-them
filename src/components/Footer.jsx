import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-navy text-white/60 text-sm py-8 mt-16">
      <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <span className="text-white font-semibold">Lobby for Them</span>
          <span className="ml-2">— Animals can't lobby. You can.</span>
        </div>
        <div className="flex gap-6">
          <Link to="/bills" className="hover:text-white transition-colors">Bills</Link>
          <Link to="/about" className="hover:text-white transition-colors">About</Link>
          <a href="https://legiscan.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">LegiScan</a>
        </div>
        <div className="text-xs text-white/40">
          Advocacy tool only. Not legal advice.
        </div>
      </div>
    </footer>
  );
}
