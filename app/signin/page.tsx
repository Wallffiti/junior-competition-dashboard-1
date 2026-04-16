"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import Link from "next/link";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  async function checkTeamCategory(userEmail: string) {
    // First check if email matches teacherEmail - Use ilike for case-insensitive comparison
    let { data: teacherData, error: teacherError } = await supabase
      .from("teams")
      .select("teamName, category, competition_year, teacherEmail")
      .ilike("teacherEmail", userEmail.trim())
      .order("competition_year", { ascending: false });
  
    if (teacherData && teacherData.length > 0) {
      const latestTeam = teacherData[0];
      return latestTeam;
    }
  
    if (teacherError && teacherError.code !== "PGRST116") {
      console.error("Teacher query error:", teacherError);
      return null;
    }
    
    // 1. Fast path — exact case, current year
    const currentYear = parseInt(process.env.NEXT_PUBLIC_COMPETITION_YEAR || "2026", 10);
    const { data: currentExact } = await supabase
      .from("teams")
      .select("teamName, category, competition_year, teamMembers")
      .eq("competition_year", currentYear)
      .contains("teamMembers", JSON.stringify([{ studentEmail: userEmail }]))
      .limit(1);

    if (currentExact && currentExact.length > 0) {
      return currentExact[0];
    }

    // 2. Case-insensitive fallback — current year only
    const { data: yearTeams } = await supabase
      .from("teams")
      .select("teamName, category, competition_year, teamMembers")
      .eq("competition_year", currentYear);

    if (yearTeams) {
      for (const team of yearTeams) {
        const members = team.teamMembers || [];
        const found = members.some(
          (m: any) => m.studentEmail && m.studentEmail.toLowerCase() === userEmail.toLowerCase()
        );
        if (found) {
          return team;
        }
      }
    }

    // 3. Exact case, any year
    const { data: memberData, error: memberError } = await supabase
      .from("teams")
      .select("teamName, category, competition_year, teamMembers")
      .contains("teamMembers", JSON.stringify([{ studentEmail: userEmail }]))
      .order("competition_year", { ascending: false })
      .limit(1);

    if (memberData && memberData.length > 0) {
      return memberData[0];
    }
  
    if (memberError && memberError.code !== "PGRST116") {
      console.error("Team members query error:", memberError);
    }
  
    return null;
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsLoading(true);

    const trimmedEmail = email.trim().toLowerCase();

    // First authenticate the user
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

    if (authError) {
      setIsLoading(false);
      toast({ 
        title: "Login Failed", 
        description: authError.message, 
        variant: "destructive" 
      });
      return;
    }

    // Check team and category
    const teamInfo = await checkTeamCategory(trimmedEmail);

    if (!teamInfo) {
      setIsLoading(false);
      toast({ 
        title: "Login Failed", 
        description: "No team found for this email (neither as teacher nor student)", 
        variant: "destructive" 
      });
      await supabase.auth.signOut();
      return;
    }

    // Allow all categories to login (removed Junior-Scratch restriction)
    
    // If everything is correct
    setIsLoading(false);
    toast({ 
      title: "Login Successful", 
      description: `Welcome ${teamInfo.teamName} (${teamInfo.category})! Redirecting...`, 
      duration: 3000 
    });
    router.push("/dashboard");
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <Link href="https://bugcrusher.net" target="_blank" rel="noopener noreferrer">
            <Image
              src="https://bugcrusher.net/wp-content/uploads/2024/03/bugcrusher-logo-125x125.png"
              alt="BugCrusher Logo"
              width={125}
              height={125}
              priority
            />
          </Link>
        </div>
        

        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center">Bugcrusher Dashboard</CardTitle>
            <CardDescription className="text-center">Sign in to access your competition dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="m@example.com" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input 
                  id="password" 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required 
                />
              </div>
              <Button className="w-full" type="submit" disabled={isLoading}>
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            {/* Sign Up Link */}
            <div className="mt-4 text-center">
              <p className="text-sm text-gray-600">
                Do not have an account yet?{" "}
                <a 
                  href="https://challenge.bugcrusher.net/signup" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 font-medium underline"
                >
                  Click here to Sign Up
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}