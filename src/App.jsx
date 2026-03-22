import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ZipProvider } from './context/ZipContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Bills from './pages/Bills';
import BillDetail from './pages/BillDetail';
import About from './pages/About';
import Contact from './pages/Contact';
import Admin from './pages/Admin';

function Layout() {
  const { pathname } = useLocation();
  const isAdmin = pathname === '/admin';

  return (
    <div className="min-h-screen flex flex-col bg-warm-white">
      {!isAdmin && <Navbar />}
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/bills" element={<Bills />} />
          <Route path="/bills/:id" element={<BillDetail />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </main>
      {!isAdmin && <Footer />}
    </div>
  );
}

export default function App() {
  return (
    <ZipProvider>
      <BrowserRouter>
        <Layout />
      </BrowserRouter>
    </ZipProvider>
  );
}
