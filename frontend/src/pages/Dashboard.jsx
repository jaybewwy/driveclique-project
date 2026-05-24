import { useNavigate } from 'react-router-dom';
import { Car, Users, Calendar, Home, Search, Bell, Plus } from 'lucide-react';

const Dashboard = ({ user, onLogout }) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Top Navigation Bar */}
      <nav className="bg-black border-b border-zinc-800 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center">
            <Car className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold">DriveClique</h1>
        </div>

        <div className="flex-1 max-w-xl mx-8">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search clubs, drives, or members..." 
              className="w-full bg-zinc-900 border border-zinc-700 rounded-full py-3 pl-12 text-sm focus:outline-none focus:border-red-600"
            />
            <Search className="absolute left-4 top-3.5 text-zinc-500 w-5 h-5" />
          </div>
        </div>

        <div className="flex items-center gap-6">
          <button className="p-3 hover:bg-zinc-900 rounded-full"><Home className="w-6 h-6" /></button>
          <button className="p-3 hover:bg-zinc-900 rounded-full"><Users className="w-6 h-6" /></button>
          <button className="p-3 hover:bg-zinc-900 rounded-full relative">
            <Bell className="w-6 h-6" />
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center">3</span>
          </button>
          <div className="w-9 h-9 bg-zinc-700 rounded-full overflow-hidden cursor-pointer">
            <img src="https://i.pravatar.cc/128?u=alex" alt="Profile" />
          </div>
          <button onClick={onLogout} className="text-sm text-zinc-400 hover:text-red-500">Logout</button>
        </div>
      </nav>

      <div className="flex max-w-7xl mx-auto">
        {/* Left Sidebar - Navigation */}
        <div className="w-72 hidden lg:block border-r border-zinc-800 p-4 sticky top-16 h-screen overflow-y-auto">
          <div className="space-y-2">
            <div 
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-900 rounded-2xl cursor-pointer bg-zinc-900"
            >
              <Home className="w-6 h-6 text-red-500" />
              <span className="font-medium">Home</span>
            </div>

            <div 
              onClick={() => navigate('/my-clubs')}
              className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-900 rounded-2xl cursor-pointer"
            >
              <Users className="w-6 h-6" />
              <span>My Clubs</span>
            </div>

            <div className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-900 rounded-2xl cursor-pointer">
              <Calendar className="w-6 h-6" />
              <span>Upcoming Drives</span>
            </div>

            <div className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-900 rounded-2xl cursor-pointer">
              <Plus className="w-6 h-6" />
              <span>Create Drive</span>
            </div>
          </div>
        </div>

        {/* Main Feed */}
        <div className="flex-1 max-w-2xl border-r border-zinc-800 min-h-screen p-6">
          <div className="mb-6">
            <h2 className="text-3xl font-semibold">Welcome back, {user?.name || user?.username}!</h2>
            <p className="text-zinc-400">What's happening in the car community?</p>
          </div>

          <div className="bg-zinc-900 rounded-3xl p-6 mb-8">
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-zinc-700 rounded-full flex-shrink-0"></div>
              <input 
                type="text" 
                placeholder="What drive are you planning?" 
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-2xl px-6 py-3 focus:outline-none"
              />
            </div>
            <button className="mt-4 w-full bg-red-600 hover:bg-red-700 py-3 rounded-2xl font-medium">
              Create New Drive
            </button>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-80 hidden xl:block p-6 sticky top-16 h-screen overflow-y-auto">
          <h3 className="font-semibold mb-4">Your Clubs</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl"></div>
              <div>
                <p className="font-medium">Southern California Mountain Drivers</p>
                <p className="text-xs text-zinc-500">47 members</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;