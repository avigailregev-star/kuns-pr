import AdminTable from '../../../components/AdminTable';
import TeachersTab from '../../../components/TeachersTab';

export const metadata = {
  title: 'לוח בקרה | ניהול קונסרבטוריון',
};

export default function AdminDashboard({ searchParams }) {
  const requestedTab = searchParams?.tab || 'registrations';
  const tab = requestedTab === 'schedule' ? 'teachers' : requestedTab;

  return (
    <div>
      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <a
          href="/admin"
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
            tab === 'registrations'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          רישומים
        </a>
        <a
          href="/admin?tab=handled"
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${tab === 'handled' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          טופל
        </a>
        <a
          href="/admin?tab=teachers"
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
            tab === 'teachers'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          מורים
        </a>
      </div>

      {tab === 'registrations' && (
        <>
          <h1 className="text-2xl font-bold text-gray-800 mb-6">ניהול רישומים</h1>
          <AdminTable />
        </>
      )}

      {tab === 'teachers' && <TeachersTab />}

      {tab === 'handled' && (
        <>
          <h1 className="text-2xl font-bold text-gray-800 mb-6">טופל — השיבוץ והתשלום הושלמו</h1>
          <AdminTable view="handled" />
        </>
      )}

    </div>
  );
}
