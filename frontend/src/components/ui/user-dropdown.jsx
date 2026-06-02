import { useState } from "react";
import {
  User, Users, Search, Settings, Bell, Car,
  Zap, Moon, HelpCircle, ExternalLink, LogOut,
  Calendar, PlusCircle,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const MENU_ITEMS = {
  status: [
    { value: "focus",   Icon: Zap,  label: "Focus Mode" },
    { value: "offline", Icon: Moon, label: "Appear Offline" },
  ],
  profile: [
    { Icon: User,     label: "My Profile",   action: "profile" },
    { Icon: Users,    label: "My Clubs",     action: "my-clubs" },
    { Icon: Search,   label: "Find Clubs",   action: "find-club" },
    { Icon: Bell,     label: "Notifications", action: "notifications" },
  ],
  drives: [
    { Icon: Calendar,    label: "Dashboard",    action: "dashboard" },
    {
      Icon: PlusCircle,
      label: "Create a Club",
      action: "create-club",
      iconClass: "text-amber-500",
      badge: { text: "New", className: "bg-amber-600 text-white text-[11px]" },
    },
  ],
  support: [
    { Icon: Settings,    label: "Settings",  action: "settings" },
    { Icon: HelpCircle,  label: "Get Help",  action: "help", RightIcon: ExternalLink },
  ],
  account: [
    { Icon: LogOut, label: "Log out", action: "logout" },
  ],
};

const getStatusColor = (status) => {
  const colors = {
    online:  "text-green-400 bg-green-900/30 border-green-500/50",
    offline: "text-zinc-400 bg-zinc-800 border-zinc-600",
    busy:    "text-red-400 bg-red-900/30 border-red-500/50",
    focus:   "text-amber-400 bg-amber-900/30 border-amber-500/50",
  };
  return colors[status?.toLowerCase()] ?? colors.online;
};

const getStatusDot = (status) => {
  const dots = {
    online:  "bg-green-500",
    offline: "bg-zinc-500",
    busy:    "bg-red-500",
    focus:   "bg-amber-500",
  };
  return dots[status?.toLowerCase()] ?? dots.online;
};

export function UserDropdown({
  user = {
    name: "Driver",
    username: "@driver",
    avatar: null,
    initials: "D",
    status: "online",
  },
  onAction = () => {},
  onStatusChange = () => {},
  selectedStatus = "online",
}) {
  const renderMenuItem = (item, index) => (
    <DropdownMenuItem
      key={index}
      className={cn(
        "p-2 rounded-lg cursor-pointer focus:bg-zinc-800 focus:text-white",
        (item.badge || item.RightIcon) && "justify-between",
      )}
      onClick={() => onAction(item.action)}
    >
      <span className="flex items-center gap-2 font-medium text-zinc-300">
        <item.Icon className={cn("size-4 shrink-0", item.iconClass ?? "text-zinc-400")} />
        {item.label}
      </span>
      {item.badge && (
        <Badge className={item.badge.className}>{item.badge.text}</Badge>
      )}
      {item.RightIcon && (
        <item.RightIcon className="size-3.5 text-zinc-500" />
      )}
    </DropdownMenuItem>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative focus:outline-none">
          <Avatar className="cursor-pointer size-9 border-2 border-zinc-700 hover:border-red-500/60 transition-colors">
            <AvatarImage src={user.avatar || undefined} alt={user.name} />
            <AvatarFallback className="bg-gradient-to-br from-red-600 to-orange-600 text-white text-sm font-semibold">
              {user.initials}
            </AvatarFallback>
          </Avatar>
          {/* online status dot */}
          <span
            className={cn(
              "absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-zinc-950",
              getStatusDot(selectedStatus),
            )}
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="no-scrollbar w-[290px] rounded-2xl bg-zinc-950 border-zinc-800 p-0 shadow-2xl shadow-black/60"
        align="end"
        sideOffset={8}
      >
        {/* User header card */}
        <section className="bg-zinc-900/80 backdrop-blur-lg rounded-2xl p-1 shadow border border-zinc-800/60">
          <div className="flex items-center gap-3 p-2">
            <div className="relative">
              <Avatar className="size-10 border-2 border-zinc-700">
                <AvatarImage src={user.avatar || undefined} alt={user.name} />
                <AvatarFallback className="bg-gradient-to-br from-red-600 to-orange-600 text-white font-semibold">
                  {user.initials}
                </AvatarFallback>
              </Avatar>
              <span
                className={cn(
                  "absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-zinc-900",
                  getStatusDot(selectedStatus),
                )}
              />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm text-white truncate">{user.name}</h3>
              <p className="text-zinc-500 text-xs truncate">{user.username}</p>
            </div>
            <Badge className={cn("border text-[11px] rounded-md capitalize px-1.5 py-0.5", getStatusColor(selectedStatus))}>
              {selectedStatus}
            </Badge>
          </div>

          {/* Status submenu */}
          <DropdownMenuGroup>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="cursor-pointer p-2 rounded-lg text-zinc-400 hover:text-white focus:bg-zinc-800 data-[state=open]:bg-zinc-800 data-[state=open]:text-white">
                <span className="flex items-center gap-2 font-medium">
                  <Zap className="size-4 text-zinc-400" />
                  Update status
                </span>
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent className="bg-zinc-900 border-zinc-800 text-white">
                  <DropdownMenuRadioGroup value={selectedStatus} onValueChange={onStatusChange}>
                    {MENU_ITEMS.status.map((s, i) => (
                      <DropdownMenuRadioItem
                        key={i}
                        value={s.value}
                        className="gap-2 focus:bg-zinc-800 focus:text-white cursor-pointer"
                      >
                        <s.Icon className="size-4 text-zinc-400" />
                        {s.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
          </DropdownMenuGroup>

          <DropdownMenuSeparator className="bg-zinc-800" />
          <DropdownMenuGroup>{MENU_ITEMS.profile.map(renderMenuItem)}</DropdownMenuGroup>

          <DropdownMenuSeparator className="bg-zinc-800" />
          <DropdownMenuGroup>{MENU_ITEMS.drives.map(renderMenuItem)}</DropdownMenuGroup>

          <DropdownMenuSeparator className="bg-zinc-800" />
          <DropdownMenuGroup>{MENU_ITEMS.support.map(renderMenuItem)}</DropdownMenuGroup>
        </section>

        {/* Account actions */}
        <section className="mt-1 p-1 rounded-2xl">
          <DropdownMenuGroup>
            {MENU_ITEMS.account.map((item, i) => (
              <DropdownMenuItem
                key={i}
                className="p-2 rounded-lg cursor-pointer focus:bg-red-500/10 focus:text-red-400 text-red-400"
                onClick={() => onAction(item.action)}
              >
                <span className="flex items-center gap-2 font-medium">
                  <item.Icon className="size-4" />
                  {item.label}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </section>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default UserDropdown;
