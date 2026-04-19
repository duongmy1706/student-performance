import { useEffect, useState } from 'react'
import axios from 'axios'
import { Filter, ChevronLeft, ChevronRight } from 'lucide-react'

const RISK_BADGE = {
  high: 'badge-high',
  medium: 'badge-medium',
  low: 'badge-low',
}
const RISK_LABEL = {
  high: '🔴 Nguy cơ cao',
  medium: '🟡 Nguy cơ TB',
  low: '🟢 An toàn',
}

export default function StudentsTab() {
  const [data, setData] = useState({ students: [], total: 0, total_pages: 1 })
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({ risk: 'high', gender: '', school_type: '', study_method: '' })
  const [expanded, setExpanded] = useState(null)

  const load = async (p = page, f = filters) => {
    setLoading(true)
    try {
      const params = { page: p, page_size: 15, sort_by: 'risk_probability', order: 'desc', ...f }
      Object.keys(params).forEach(k => !params[k] && delete params[k])
      const res = await axios.get('/api/students', { params })
      setData(res.data)
    } catch (e) {}
    setLoading(false)
  }

  useEffect(() => { load(1, filters) }, [filters])

  const setFilter = (key, val) => {
    const nf = { ...filters, [key]: val }
    setFilters(nf)
    setPage(1)
  }

  const goPage = (p) => { setPage(p); load(p) }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Danh sách học sinh cần can thiệp</h2>
          <p className="text-gray-500 text-sm">
            {data.total.toLocaleString()} học sinh phù hợp — sắp xếp theo xác suất nguy cơ (ML)
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card py-4">
        <div className="flex flex-wrap gap-3 items-center">
          <Filter className="w-4 h-4 text-gray-400" />
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 font-medium">Nguy cơ:</label>
            <select
              value={filters.risk}
              onChange={e => setFilter('risk', e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-300 outline-none"
            >
              <option value="">Tất cả</option>
              <option value="high">Nguy cơ cao</option>
              <option value="medium">Nguy cơ TB</option>
              <option value="low">An toàn</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 font-medium">Giới tính:</label>
            <select
              value={filters.gender}
              onChange={e => setFilter('gender', e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-300 outline-none"
            >
              <option value="">Tất cả</option>
              <option value="male">Nam</option>
              <option value="female">Nữ</option>
              <option value="other">Khác</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 font-medium">Loại trường:</label>
            <select
              value={filters.school_type}
              onChange={e => setFilter('school_type', e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-300 outline-none"
            >
              <option value="">Tất cả</option>
              <option value="public">Công lập</option>
              <option value="private">Tư thục</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 font-medium">Phương pháp học:</label>
            <select
              value={filters.study_method}
              onChange={e => setFilter('study_method', e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-300 outline-none"
            >
              <option value="">Tất cả</option>
              {['notes', 'textbook', 'group study', 'coaching', 'mixed', 'online videos'].map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-48"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['ID', 'Giới tính', 'Trường', 'Giờ học/ngày', 'Chuyên cần', 'PP Học', 'Xếp loại', 'Xác suất nguy cơ', 'Mức độ', 'Can thiệp'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.students.map((s) => (
                  <>
                    <tr key={s.student_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-gray-600">#{s.student_id}</td>
                      <td className="px-4 py-3 text-gray-700">{s.gender}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${s.school_type === 'private' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                          {s.school_type === 'private' ? 'Tư thục' : 'Công lập'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-semibold ${s.study_hours < 3 ? 'text-red-600' : s.study_hours < 5 ? 'text-yellow-600' : 'text-green-600'}`}>
                          {typeof s.study_hours === 'number' ? s.study_hours.toFixed(1) : s.study_hours}h
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-semibold ${s.attendance_percentage < 65 ? 'text-red-600' : s.attendance_percentage < 80 ? 'text-yellow-600' : 'text-green-600'}`}>
                          {typeof s.attendance_percentage === 'number' ? s.attendance_percentage.toFixed(1) : s.attendance_percentage}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{s.study_method}</td>
                      <td className="px-4 py-3">
                        <span className={`font-bold uppercase ${['a','b'].includes(s.final_grade) ? 'text-green-600' : ['e','f'].includes(s.final_grade) ? 'text-red-600' : 'text-gray-700'}`}>
                          {s.final_grade?.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.round((s.risk_probability || 0) * 100)}%`,
                                background: s.risk_probability > 0.6 ? '#ef4444' : s.risk_probability > 0.3 ? '#f59e0b' : '#10b981'
                              }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-gray-700">
                            {((s.risk_probability || 0) * 100).toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={RISK_BADGE[s.risk_level]}>{RISK_LABEL[s.risk_level]}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setExpanded(expanded === s.student_id ? null : s.student_id)}
                          className="text-blue-600 text-xs font-medium hover:text-blue-800 underline-offset-2 hover:underline"
                        >
                          {expanded === s.student_id ? 'Ẩn bớt' : `Xem ${s.interventions?.length || 0} gợi ý`}
                        </button>
                      </td>
                    </tr>
                    {expanded === s.student_id && (
                      <tr key={`expand-${s.student_id}`}>
                        <td colSpan={10} className="px-4 py-3 bg-blue-50">
                          <div className="font-semibold text-blue-800 mb-2 text-sm">Khuyến nghị can thiệp cá nhân hóa:</div>
                          <ul className="space-y-1.5">
                            {(s.interventions || []).map((tip, i) => (
                              <li key={i} className="text-sm text-blue-700 flex items-start gap-2">
                                <span className="mt-0.5">→</span>
                                <span>{tip}</span>
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
          <span className="text-sm text-gray-500">
            Trang {page} / {data.total_pages} — {data.total.toLocaleString()} học sinh
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => goPage(page - 1)}
              disabled={page <= 1}
              className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {[...Array(Math.min(5, data.total_pages))].map((_, i) => {
              const p = Math.max(1, page - 2) + i
              if (p > data.total_pages) return null
              return (
                <button
                  key={p}
                  onClick={() => goPage(p)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${p === page ? 'bg-blue-600 text-white' : 'border border-gray-200 hover:bg-gray-50 text-gray-700'}`}
                >
                  {p}
                </button>
              )
            })}
            <button
              onClick={() => goPage(page + 1)}
              disabled={page >= data.total_pages}
              className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
