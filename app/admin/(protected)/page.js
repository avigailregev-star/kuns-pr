import AdminTable from '../../../components/AdminTable';

export const metadata = {
  title: 'לוח בקרה | ניהול קונסרבטוריון',
};

export default function AdminDashboard() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">ניהול רישומים</h1>
      <AdminTable />
    </div>
  );
}
