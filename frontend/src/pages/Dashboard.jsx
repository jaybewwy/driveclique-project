import { Car } from 'lucide-react';

const Dashboard = ({ user, onLogout }) => {
  return (
    <div className="min-h-screen bg-zinc-950 p-10">
      <div className="flex justify-between items-center mb-10">
        <h1 className="text-4xl font-bold">Welcome back, {user?.name}!</h1>
        <button onClick={onLogout} className="text-red-500 hover:text-red-600">Logout</button>
      </div>
      <p className="text-zinc-400">DriveClique Dashboard - More features coming soon...</p>
    </div>
  );
};

export default Dashboard;