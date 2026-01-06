import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";

const menuItems = [
  {
    title: "لوحة التحكم",
    url: "/",
    icon: "fa-chart-line",
  },
  {
    title: "إدارة الحسابات",
    url: "/accounts",
    icon: "fa-link",
  },
  {
    title: "جدولة القصص",
    url: "/schedule",
    icon: "fa-calendar-plus",
  },
  {
    title: "إدارة المهام",
    url: "/jobs",
    icon: "fa-tasks",
  },
  {
    title: "التحليلات",
    url: "/analytics",
    icon: "fa-chart-pie",
  },
  {
    title: "التوصيات الذكية",
    url: "/insights",
    icon: "fa-lightbulb",
  },
  {
    title: "الملف الشخصي",
    url: "/profile",
    icon: "fa-user",
  },
];

const adminItems = [
  {
    title: "لوحة الإدارة",
    url: "/admin",
    icon: "fa-shield-halved",
  },
  {
    title: "إعدادات الجدولة",
    url: "/scheduling-settings",
    icon: "fa-cog",
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    return parts.map(p => p[0]).join("").substring(0, 2).toUpperCase();
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <i className="fas fa-calendar-days text-lg"></i>
          </div>
          <div>
            <h2 className="text-lg font-bold">منصة القصص</h2>
            <p className="text-xs text-muted-foreground">جدولة ذكية</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>القائمة الرئيسية</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    data-active={location === item.url}
                    data-testid={`link-${item.title}`}
                  >
                    <Link href={item.url}>
                      <i className={`fas ${item.icon} w-4`}></i>
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>الإدارة</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    data-active={location === item.url}
                    data-testid={`link-${item.title}`}
                  >
                    <Link href={item.url}>
                      <i className={`fas ${item.icon} w-4`}></i>
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="flex items-center gap-3 rounded-md border p-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={user?.photoURL} />
            <AvatarFallback>{getInitials(user?.displayName || "User")}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.displayName}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            className="text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-logout"
          >
            <i className="fas fa-right-from-bracket"></i>
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
