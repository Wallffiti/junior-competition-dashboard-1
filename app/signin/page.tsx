"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  async function checkTeamCategory(userEmail: string) {
    console.log("Checking team for email:", userEmail);
  
    // First check if email matches teacherEmail
    let { data: teacherData, error: teacherError } = await supabase
      .from("teams")
      .select("teamName, category")
      .eq("teacherEmail", userEmail)
      .single();
  
    if (teacherData) {
      console.log("Found as teacher:", teacherData);
      return teacherData;
    }
  
    if (teacherError && teacherError.code !== "PGRST116") {
      console.error("Teacher query error:", teacherError);
      return null;
    }
  
    // If not a teacher, check parentEmail in teamMembers
    console.log("Not found as teacher, checking teamMembers...");
    const { data: memberData, error: memberError } = await supabase
      .from("teams")
      .select("teamName, category")
      .contains("teamMembers", JSON.stringify([{ parentEmail: userEmail }])) // Stringify the array
      .single();
  
    if (memberData) {
      console.log("Found as team member:", memberData);
      return memberData;
    }
  
    if (memberError && memberError.code !== "PGRST116") {
      console.error("Team members query error:", memberError);
    } else {
      console.log("No team found for this email in teamMembers");
    }
  
    return null;
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsLoading(true);

    // First authenticate the user
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
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
    const teamInfo = await checkTeamCategory(email);

    if (!teamInfo) {
      setIsLoading(false);
      toast({ 
        title: "Login Failed", 
        description: "No team found for this email (neither as teacher nor parent)", 
        variant: "destructive" 
      });
      await supabase.auth.signOut();
      return;
    }

    if (teamInfo.category !== "Junior-Scratch") {
      setIsLoading(false);
      toast({ 
        title: "Login Failed", 
        description: "Wrong category. Only Junior-Scratch category is allowed.", 
        variant: "destructive" 
      });
      await supabase.auth.signOut();
      return;
    }

    // If everything is correct
    setIsLoading(false);
    toast({ 
      title: "Login Successful", 
      description: `Welcome ${teamInfo.teamName}! Redirecting...`, 
      duration: 3000 
    });
    router.push("/dashboard");
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="w-full max-w-md">
        {/* Category Indicator */}
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-center">
          <p className="text-sm font-semibold text-green-900">Junior Scratch Category</p>
          <p className="text-xs text-green-700 mt-1">This login is for Junior-Scratch participants</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center">Sign in</CardTitle>
            <CardDescription className="text-center">Enter your credentials to access your account</CardDescription>
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

            {/* Wrong Category Notice */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600 mb-3">Not in Junior-Scratch category?</p>
              <div className="space-y-2">
                <a 
                  href="https://seniorscratch.bugcrusher.net/"
                  className="block w-full px-4 py-2 text-sm font-medium text-center bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200 transition-colors"
                >
                  → Senior Scratch
                </a>
                <a 
                  href="https://seniorweb.bugcrusher.net/"
                  className="block w-full px-4 py-2 text-sm font-medium text-center bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg border border-purple-200 transition-colors"
                >
                  → Senior Web (HTML)
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}