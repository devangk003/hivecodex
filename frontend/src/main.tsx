import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Import Monaco Worker configuration before any Monaco usage
import './lib/monaco-workers';

createRoot(document.getElementById('root')!).render(<App />);
