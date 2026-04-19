import { useState } from 'react'
import { Toaster } from 'react-hot-toast'
import UploadPage from './pages/UploadPage'
import Dashboard from './pages/Dashboard'
import Chatbot from './components/Chatbot'

export default function App() {
  const [dataLoaded, setDataLoaded] = useState(false)
  const [summary, setSummary] = useState(null)

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />
      {!dataLoaded ? (
        <>
          <UploadPage onDataLoaded={(s) => { setSummary(s); setDataLoaded(true); }} />
          <Chatbot dataLoaded={false} />
        </>
      ) : (
        <Dashboard summary={summary} onReset={() => setDataLoaded(false)} />
      )}
    </div>
  )
}
