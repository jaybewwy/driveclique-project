import { useNavigate } from "react-router-dom";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "@/components/ui/menubar";

export default function NestedDashboardMenu() {
  const navigate = useNavigate();

  return (
    <Menubar className="border-zinc-800/50 bg-transparent h-auto p-0 space-x-0">
      {/* Dashboard */}
      <MenubarMenu>
        <MenubarTrigger className="text-zinc-400 hover:text-white data-[state=open]:text-white">
          Dashboard
        </MenubarTrigger>
        <MenubarContent className="border-zinc-800 bg-zinc-900 text-white">
          <MenubarItem
            className="focus:bg-zinc-800 focus:text-white cursor-pointer"
            onSelect={() => navigate("/dashboard")}
          >
            Overview
          </MenubarItem>
          <MenubarItem
            className="focus:bg-zinc-800 focus:text-white cursor-pointer"
            onSelect={() => navigate("/settings")}
          >
            Club Analytics
          </MenubarItem>
          <MenubarSub>
            <MenubarSubTrigger className="focus:bg-zinc-800 focus:text-white data-[state=open]:bg-zinc-800 data-[state=open]:text-white">
              Quick Links
            </MenubarSubTrigger>
            <MenubarSubContent className="border-zinc-800 bg-zinc-900 text-white">
              <MenubarItem
                className="focus:bg-zinc-800 focus:text-white cursor-pointer"
                onSelect={() => navigate("/dashboard")}
              >
                Upcoming Drives
              </MenubarItem>
              <MenubarItem
                className="focus:bg-zinc-800 focus:text-white cursor-pointer"
                onSelect={() => navigate("/my-clubs")}
              >
                Club Activity
              </MenubarItem>
            </MenubarSubContent>
          </MenubarSub>
        </MenubarContent>
      </MenubarMenu>

      {/* Clubs */}
      <MenubarMenu>
        <MenubarTrigger className="text-zinc-400 hover:text-white data-[state=open]:text-white">
          Clubs
        </MenubarTrigger>
        <MenubarContent className="border-zinc-800 bg-zinc-900 text-white">
          <MenubarItem
            className="focus:bg-zinc-800 focus:text-white cursor-pointer"
            onSelect={() => navigate("/my-clubs")}
          >
            My Clubs
          </MenubarItem>
          <MenubarItem
            className="focus:bg-zinc-800 focus:text-white cursor-pointer"
            onSelect={() => navigate("/find-club")}
          >
            Find Clubs
          </MenubarItem>
          <MenubarSeparator className="bg-zinc-800" />
          <MenubarItem
            className="focus:bg-zinc-800 focus:text-white cursor-pointer"
            onSelect={() => navigate("/create-club")}
          >
            Create New Club
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      {/* Drives */}
      <MenubarMenu>
        <MenubarTrigger className="text-zinc-400 hover:text-white data-[state=open]:text-white">
          Drives
        </MenubarTrigger>
        <MenubarContent className="border-zinc-800 bg-zinc-900 text-white">
          <MenubarItem
            className="focus:bg-zinc-800 focus:text-white cursor-pointer"
            onSelect={() => navigate("/dashboard")}
          >
            Upcoming Drives
          </MenubarItem>
          <MenubarItem
            className="focus:bg-zinc-800 focus:text-white cursor-pointer"
            onSelect={() => navigate("/my-clubs")}
          >
            My RSVPs
          </MenubarItem>
          <MenubarSub>
            <MenubarSubTrigger className="focus:bg-zinc-800 focus:text-white data-[state=open]:bg-zinc-800 data-[state=open]:text-white">
              Schedule
            </MenubarSubTrigger>
            <MenubarSubContent className="border-zinc-800 bg-zinc-900 text-white">
              <MenubarItem
                className="focus:bg-zinc-800 focus:text-white cursor-pointer"
                onSelect={() => navigate("/my-clubs")}
              >
                New Drive
              </MenubarItem>
              <MenubarItem
                className="focus:bg-zinc-800 focus:text-white cursor-pointer"
                onSelect={() => navigate("/my-clubs")}
              >
                Recurring Drive
              </MenubarItem>
            </MenubarSubContent>
          </MenubarSub>
        </MenubarContent>
      </MenubarMenu>

      {/* Profile */}
      <MenubarMenu>
        <MenubarTrigger className="text-zinc-400 hover:text-white data-[state=open]:text-white">
          Profile
        </MenubarTrigger>
        <MenubarContent className="border-zinc-800 bg-zinc-900 text-white">
          <MenubarItem
            className="focus:bg-zinc-800 focus:text-white cursor-pointer"
            onSelect={() => navigate("/profile")}
          >
            My Profile
          </MenubarItem>
          <MenubarSub>
            <MenubarSubTrigger className="focus:bg-zinc-800 focus:text-white data-[state=open]:bg-zinc-800 data-[state=open]:text-white">
              Preferences
            </MenubarSubTrigger>
            <MenubarSubContent className="border-zinc-800 bg-zinc-900 text-white">
              <MenubarItem
                className="focus:bg-zinc-800 focus:text-white cursor-pointer"
                onSelect={() => navigate("/profile")}
              >
                Notifications
              </MenubarItem>
              <MenubarItem
                className="focus:bg-zinc-800 focus:text-white cursor-pointer"
                onSelect={() => navigate("/profile")}
              >
                Account Settings
              </MenubarItem>
            </MenubarSubContent>
          </MenubarSub>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
}
