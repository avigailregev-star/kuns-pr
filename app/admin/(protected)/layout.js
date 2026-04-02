import { getServerSession } from 'next-auth';
import { authOptions } from '../api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'ניהול | קונסרבטוריון',
};

export default async function AdminLayout({ children }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect('/admin/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎵</span>
          <span className="font-bold text-gray-800">קונסרבטוריון – ניהול</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">שלום, {session.user?.name}</span>
          <a
            href="/api/auth/signout"
            className="text-sm text-red-500 hover:underline"
          >
            יציאה
          </a>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
