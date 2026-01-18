"use client";

import type React from "react";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { getUserTeamDetails } from "@/lib/teamHelpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Icons } from "@/components/ui/icons";

export function ProjectSubmission() {
  const [scratchFile, setScratchFile] = useState<File | null>(null);
  const [activeGrouping, setActiveGrouping] = useState<string | null>(null);
  const [is4Submission, setIs4Submission] = useState(false);
  const [isTrialChallenge, setIsTrialChallenge] = useState(false);
  const [competitionYear, setCompetitionYear] = useState<string | null>(null);
  const [isArchived, setIsArchived] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [teamDetails, setTeamDetails] = useState<{ teamId: string; teamName: string; authorName: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();

  const STORAGE_BASE_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`;
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes

  useEffect(() => {
    const fetchUserDataAndGrouping = async () => {
      const { data: user, error } = await supabase.auth.getUser();
      if (error || !user?.user?.email) {
        console.warn("⚠️ No authenticated user found:", error?.message);
        toast({
          title: "Error",
          description: "User not authenticated.",
          variant: "destructive",
        });
        return;
      }

      const teamData = await getUserTeamDetails(user.user.email);
      if (!teamData) {
        console.warn("No team data found for user:", user.user.email);
        toast({
          title: "Error",
          description: "Team data not found.",
          variant: "destructive",
        });
        return;
      }
      setTeamDetails(teamData);

      const { data: teamGroupings, error: groupingError } = await supabase
        .from("teamGroupings")
        .select("grouping")
        .eq("teamName", teamData.teamName);

      if (groupingError || !teamGroupings || teamGroupings.length === 0) {
        console.warn("No groupings found for team:", groupingError?.message);
        toast({
          title: "Error",
          description: "No groupings found for team.",
          variant: "destructive",
        });
        return;
      }

      const groupingNames = teamGroupings.map((g) => g.grouping);
      const { data: activeGroupings, error: statusError } = await supabase
        .from("groupingStatus")
        .select("grouping, is4Submission, is_trial")
        .in("grouping", groupingNames)
        .eq("status", "active");

      if (statusError || !activeGroupings || activeGroupings.length === 0) {
        console.warn("No active groupings found:", statusError?.message);
        toast({
          title: "Error",
          description: "No active grouping found.",
          variant: "destructive",
        });
        return;
      }

      const activeGroup = activeGroupings[0]?.grouping || null;
      setActiveGrouping(activeGroup);
      setIs4Submission(activeGroupings[0]?.is4Submission || false);
      setIsTrialChallenge(activeGroupings[0]?.is_trial || false);

      // Fetch competition year
      const { data: teamInfo, error: teamInfoError } = await supabase
        .from("teams")
        .select("competition_year, is_archived")
        .eq("id", teamData.teamId)
        .single();
      
      if (teamInfo?.is_archived === true) {
        setIsArchived(true);
        return;
      }
      
      if (teamInfo?.competition_year) {
        setCompetitionYear(teamInfo.competition_year);
      }
    };

    fetchUserDataAndGrouping();
  }, [toast]);

  const resetForm = () => {
    setScratchFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (formRef.current) formRef.current.reset();
  };

  const validateFile = (file: File | null): boolean => {
    if (!file) return false;

    if (!file.name.endsWith(".sb3")) {
      toast({
        title: "Invalid File",
        description: "Please upload a valid .sb3 file.",
        variant: "destructive",
      });
      return false;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "File Too Large",
        description: "File size exceeds 50MB limit.",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file && validateFile(file)) {
      setScratchFile(file);
    } else {
      setScratchFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const uploadScratchFile = async () => {
    if (!teamDetails || !scratchFile) {
      console.warn("No team details or file to upload:", { teamDetails, scratchFile });
      return null;
    }

    const filePath = `${teamDetails.teamId}/${scratchFile.name}`;
    const { data, error } = await supabase.storage
      .from("scratch-files")
      .upload(filePath, scratchFile, {
        upsert: true,
      });

    if (error) {
      console.error("Storage upload error:", error);
      toast({
        title: "Upload Error",
        description: `Failed to upload ${scratchFile.name}: ${error.message}`,
        variant: "destructive",
      });
      return null;
    }

    const publicUrl = `${STORAGE_BASE_URL}scratch-files/${filePath}`;
    return publicUrl;
  };

  const checkGroupingStatus = async () => {
    if (!teamDetails) return false;

    const { data: teamGroupings, error: groupingError } = await supabase
      .from("teamGroupings")
      .select("grouping")
      .eq("teamName", teamDetails.teamName);

    if (groupingError || !teamGroupings || teamGroupings.length === 0) {
      console.warn("No groupings found for team:", groupingError?.message);
      return false;
    }

    const groupingNames = teamGroupings.map((g) => g.grouping);
    const { data: activeGroupings, error: statusError } = await supabase
      .from("groupingStatus")
      .select("grouping")
      .in("grouping", groupingNames)
      .eq("status", "active");

    if (statusError || !activeGroupings || activeGroupings.length === 0) {
      console.warn("No active groupings found:", statusError?.message);
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (!scratchFile || !validateFile(scratchFile)) {
      toast({
        title: "Submission Failed",
        description: "Please select a valid .sb3 file under 50MB.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    const isGroupingActive = await checkGroupingStatus();
    if (!isGroupingActive) {
      toast({
        title: "Submission Blocked",
        description: "The grouping is no longer active. Reloading the page...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      return;
    }

    if (!teamDetails) {
      toast({
        title: "Submission Failed",
        description: "No team information found.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    try {
      const projectLink = await uploadScratchFile();
      if (!projectLink) {
        throw new Error("File upload failed.");
      }

      const { error } = await supabase.from("projects").insert([
        {
          teamId: teamDetails.teamId,
          authorName: teamDetails.authorName,
          projectLink,
          stage: activeGrouping,
          createdAt: new Date().toISOString(),
          penalty: is4Submission,
          trial_status: isTrialChallenge,
          competition_year: competitionYear,
        },
      ]);

      if (error) {
        throw error;
      }

      toast({
        title: "Project Submitted",
        description: "Your Scratch project has been submitted successfully.",
      });

      resetForm();
    } catch (error: any) {
      toast({
        title: "Submission Failed",
        description: error.message || "An error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isArchived) {
    return (
      <div className="p-6">
        <p>This team has been archived. Please register for a new team to participate.</p>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-semibold">Submit Scratch Project</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="scratchFile">Scratch Project File (.sb3)</Label>
            <Input
              id="scratchFile"
              type="file"
              accept=".sb3"
              onChange={handleFileChange}
              ref={fileInputRef}
              required
            />
            <p className="text-sm text-gray-500">
              Maximum file size: 50MB
            </p>
            {scratchFile && (
              <p className="text-sm text-gray-500">Selected file: {scratchFile.name}</p>
            )}
          </div>
          <div>
            <Button type="submit" className="w-full" disabled={isLoading || !scratchFile}>
              {isLoading ? <Icons.spinner className="mr-2 h-4 w-4 animate-spin" /> : "Submit Project"}
            </Button>
            {is4Submission && (
              <p className="text-sm text-yellow-600 mt-2">
                You are still able to submit project, but there will be a penalty.
              </p>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}