// dashboard/layout.tsx
"use client";

import { useState, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { getAuthenticatedUser, getUserTeam } from "@/lib/authHelpers";
import { fetchUserTeamData } from "@/lib/authHelpers";
import { getTeamGroupings, isAnyGroupingActive } from "@/lib/groupingHelpers";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import dynamic from "next/dynamic";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Home,
  LogOut,
  Menu,
  Package,
  Send,
  ChevronDown,
  Clock,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { AdSlideshow } from "@/components/ad";
import { DashboardContent } from "@/components/dashboard-content";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);
  const [isSignedIn, setIsSignedIn] = useState<boolean | null>(null);
  const router = useRouter();
  const pathname = usePathname(); // Get the current route

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/signin");
  };

  useEffect(() => {
    const checkAuthAndAccess = async () => {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        setIsSignedIn(false);
        return;
      }

      setIsSignedIn(true);

      const email = await getAuthenticatedUser();
      if (!email) {
        setIsAllowed(false);
        return;
      }

      const teamName = await getUserTeam(email);
      if (!teamName) {
        setIsAllowed(false);
        return;
      }

      const teamGroupings = await getTeamGroupings(teamName);
      if (teamGroupings.length === 0) {
        setIsAllowed(false);
        return;
      }

      const isActive = await isAnyGroupingActive(teamGroupings);
      setIsAllowed(isActive);
    };

    checkAuthAndAccess();
  }, []);

  if (isSignedIn === null) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-lg text-gray-600">Loading...</p>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-gray-100 p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">
          You are not signed in
        </h1>
        <Button
          size="lg"
          className="bg-blue-600 hover:bg-blue-700 text-white"
          onClick={() => router.push("/signin")}
        >
          Go to Sign In
        </Button>
      </div>
    );
  }

  const isDashboardRoot = pathname === "/dashboard"; // Check if we're on the root dashboard

  return (
    <div className="flex h-screen overflow-hidden">
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="fixed top-4 left-4 z-40 lg:hidden"
          >
            <Menu className="h-4 w-4" />
            <span className="sr-only">Toggle Sidebar</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <Sidebar onSignOut={handleSignOut} />
        </SheetContent>
      </Sheet>
      <aside className="hidden w-64 overflow-y-auto border-r bg-gray-100/40 lg:block">
        <Sidebar onSignOut={handleSignOut} />
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="flex justify-center items-center">
          <AdSlideshow /> {/* Always show the slideshow */}
        </div>{" "}
        {/* Always show the slideshow */}
        <div className="container mx-auto py-6 px-4 lg:px-8 pt-16 lg:pt-6">
          {isDashboardRoot ? (
            // Show DashboardContent on /dashboard regardless of isAllowed
            <DashboardContent />
          ) : isAllowed === null ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-lg text-gray-600">Checking access...</p>
            </div>
          ) : isAllowed ? (
            children // Show children for other routes if allowed
          ) : (
            <div className="flex flex-col items-center justify-center p-6">
              <h1 className="text-center text-2xl font-bold text-gray-800 mb-4">
                Nothing to see here
              </h1>
              <Link
                href={"/previous-history"}
                className="text-blue-600 underline text-center text-sm hover:text-blue-800 transition-colors"
              >
                See your history here
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// Rest of the code (Sidebar, NavItem, UserProfile, CountdownClock) remains unchanged
const CountdownClock = dynamic(
  () =>
    import("@/components/countdown-clock").then((mod) => mod.CountdownClock),
  {
    ssr: false,
  }
);

function Sidebar({ onSignOut }: { onSignOut: () => void }) {
  const [bugsOpen, setBugsOpen] = useState(false);
  const [submissionOpen, setSubmissionOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [teamName, setTeamName] = useState<string>("Loading...");
  const [userName, setUserName] = useState<string>("User");
  const pathname = usePathname();

  useEffect(() => {
    fetchUserTeamData(setUserEmail, setTeamName, setUserName);
  }, []);

  const sidebarItems = [
    { href: "/dashboard", icon: Home, label: "Dashboard" },
    { href: "/dashboard/mission-pack", icon: Package, label: "Mission Pack" },
    {
      href: "/dashboard/submission",
      icon: Send,
      label: "Submission",
      subItems: [
        {
          href: "/dashboard/submission/bugs",
          label: "Bugs",
          subItems: [...Array(10)].map((_, i) => ({
            href: `/dashboard/submission/bugs/${i + 1}`,
            label: `Bug #${i + 1}`,
          })),
        },
        { href: "/dashboard/submission/enhancement", label: "Enhancement" },
        {
          href: "/dashboard/submission/brainstorm-map",
          label: "Brainstorm Map",
        },
        { href: "/dashboard/submission/presentation", label: "Presentation" },
        { href: "/dashboard/submission/project", label: "Project Files" },
      ],
    },
    { href: "/dashboard/history", icon: Clock, label: "History" },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center border-b px-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 font-semibold"
        >
          <span className="text-lg">{teamName}</span>
        </Link>
      </div>
      <ScrollArea className="flex-1 py-4">
        <nav className="space-y-1 px-2">
          <div className="mb-4">
            <CountdownClock teamName={teamName} />
          </div>
          {sidebarItems.map((item) => (
            <div key={item.href}>
              {item.subItems ? (
                <div>
                  <button
                    onClick={() => setSubmissionOpen(!submissionOpen)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      submissionOpen
                        ? "bg-gray-200 text-gray-900"
                        : "text-gray-700 hover:bg-gray-200 hover:text-gray-900"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                    <ChevronDown
                      className={cn(
                        "ml-auto h-4 w-4 transition-transform",
                        submissionOpen && "rotate-180"
                      )}
                    />
                  </button>
                  {submissionOpen && (
                    <div className="mt-1 space-y-1 pl-4">
                      {item.subItems.map((subItem) => (
                        <div key={subItem.href}>
                          {subItem.subItems ? (
                            <div>
                              <button
                                onClick={() => setBugsOpen(!bugsOpen)}
                                className={cn(
                                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                                  bugsOpen
                                    ? "bg-gray-200 text-gray-900"
                                    : "text-gray-700 hover:bg-gray-200 hover:text-gray-900"
                                )}
                              >
                                {subItem.label}
                                <ChevronDown
                                  className={cn(
                                    "ml-auto h-4 w-4 transition-transform",
                                    bugsOpen && "rotate-180"
                                  )}
                                />
                              </button>
                              {bugsOpen && (
                                <div className="mt-1 space-y-1 pl-4">
                                  {subItem.subItems.map((bugItem) => (
                                    <NavItem
                                      key={bugItem.href}
                                      href={bugItem.href}
                                      className="py-2"
                                    >
                                      {bugItem.label}
                                    </NavItem>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <NavItem href={subItem.href} className="py-2">
                              {subItem.label}
                            </NavItem>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <NavItem href={item.href} icon={item.icon}>
                  {item.label}
                </NavItem>
              )}
            </div>
          ))}
        </nav>
      </ScrollArea>
      <div className="border-t p-4">
        <UserProfile
          onSignOut={onSignOut}
          userName={userName}
          userEmail={userEmail}
        />
      </div>
    </div>
  );
}

function NavItem({
  href,
  icon: Icon,
  children,
  className,
}: {
  href: string;
  icon?: React.ElementType;
  children: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        pathname === href
          ? "bg-gray-200 text-gray-900"
          : "text-gray-700 hover:bg-gray-200 hover:text-gray-900",
        className
      )}
    >
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </Link>
  );
}

function UserProfile({
  onSignOut,
  userName,
  userEmail,
}: {
  onSignOut: () => void;
  userName: string;
  userEmail: string | null;
}) {
  return (
    <div className="flex items-center gap-3 w-full">
      <Avatar>
        <AvatarImage src="/avatars/01.png" alt={userName} />
        <AvatarFallback>{userName.charAt(0)}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium truncate block">{userName}</span>
        <span className="text-xs text-gray-500 truncate block">
          {userEmail || "N/A"}
        </span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="ml-auto flex-shrink-0"
        onClick={onSignOut}
      >
        <LogOut className="h-4 w-4" />
        <span className="sr-only">Sign out</span>
      </Button>
    </div>
  );
}
