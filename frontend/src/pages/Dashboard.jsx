import { useState } from 'react'
import { Brain, LayoutDashboard, Users, BarChart3, FileText, RefreshCw, UserPlus } from 'lucide-react'
import OverviewTab from '../components/OverviewTab'
import StudentsTab from '../components/StudentsTab'
import AnalysisTab from '../components/AnalysisTab'
import MLTab from '../components/MLTab'
import ReportTab from '../components/ReportTab'
import PredictTab from '../components/PredictTab'
import Chatbot from '../components/Chatbot'

const TABS = [
  { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
  { id: 'ml', label: 'ML Dự đoán', icon: Brain },
  { id: 'predict', label: 'Tự nhập dự đoán', icon: UserPlus },
  { id: 'students', label: 'Học sinh', icon: Users },
  { id: 'analysis', label: 'Phân tích', icon: BarChart3 },
  { id: 'report', label: 'Báo cáo', icon: FileText },
]

export default function Dashboard({ summary, onReset }) {
  const [tab, setTab] = useState('overview')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Topbar */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-gray-900 text-lg">Student ML Dashboard</span>
              <span className="ml-3 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                {summary?.total_students?.toLocaleString()} học sinh — Độ chính xác: {summary?.model_accuracy}%
              </span>
            </div>
          </div>
          <button
            onClick={onReset}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Đổi file
          </button>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <nav className="flex gap-1 pb-0">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                  tab === id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="animate-fade-in">
          {tab === 'overview' && <OverviewTab summary={summary} />}
          {tab === 'ml' && <MLTab />}
          {tab === 'predict' && <PredictTab />}
          {tab === 'students' && <StudentsTab />}
          {tab === 'analysis' && <AnalysisTab />}
          {tab === 'report' && <ReportTab summary={summary} />}
        </div>
      </main>

      {/* Floating AI Chatbot */}
      <Chatbot dataLoaded={true} />
    </div>
  )
}
