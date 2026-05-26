import Sidebar from "../components/Sidebar";
import NavBar from "../components/NavBar";

const Dashboard = ({ user, onLogout }) => {

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <NavBar user={user} onLogout={onLogout} />

      <div className="flex max-w-7xl mx-auto">
        <Sidebar user={user} />

        {/* Main Feed */}
        <div className="flex-1 max-w-2xl border-r border-zinc-800 min-h-screen p-6">
          <div className="mb-6">
            <h2 className="text-3xl font-semibold">Dashboard</h2>
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

      </div>
    </div>
  );
};

export default Dashboard;