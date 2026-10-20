import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './style.css';
import './accessibility.css';
import './recipe.css';
import './columns.css';
import './imports.css';
import './comparisons.css';
import './profiles.css';

// One session per tab. StrictMode is intentionally omitted: its development-only effect replay creates sessions.
ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
