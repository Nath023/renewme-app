import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx' // This imports the App component from App.tsx
// './index.css' might be imported here or in App.tsx, as long as it's imported once.
// If it's in App.tsx (as shown above), you might not need it here.

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App /> {/* This renders the App component */}
  </React.StrictMode>,
)